import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/pos/terminals/[id]/employees
 * Get employees that have access to a specific terminal
 * Does NOT return PIN for security
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const { id: terminalId } = await params

    if (!terminalId) {
      return NextResponse.json({
        success: false,
        error: 'Terminal ID es requerido'
      }, { status: 400 })
    }

    // Verify terminal belongs to company
    const terminalCheck = await db.query(`
      SELECT id, name, code
      FROM market_pos_terminals
      WHERE id = $1 AND company_id = $2 AND is_active = true
    `, [terminalId, companyId])

    if (terminalCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado'
      }, { status: 404 })
    }

    const terminal = terminalCheck.rows[0]

    // Get employees with access to this terminal
    const result = await db.query(`
      SELECT
        e.id as employee_id,
        e.employee_code,
        e.user_id,
        u.firstname,
        u.lastname,
        u.email,
        e.pos_pin IS NOT NULL as has_pin,
        et.can_open_session,
        et.can_close_session,
        et.can_void_orders,
        et.can_give_discount,
        et.can_refund,
        et.max_discount_percent
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      JOIN market_employee_terminals et ON e.id = et.employee_id
      WHERE e.company_id = $1
        AND et.terminal_id = $2
        AND e.status = 'active'
      ORDER BY u.firstname, u.lastname
    `, [companyId, terminalId])

    const employees = result.rows.map(emp => ({
      employeeId: emp.employee_id,
      employeeCode: emp.employee_code,
      userId: emp.user_id,
      fullName: `${emp.firstname || ''} ${emp.lastname || ''}`.trim() || emp.email,
      email: emp.email,
      hasPin: emp.has_pin,
      permissions: {
        canOpenSession: emp.can_open_session,
        canCloseSession: emp.can_close_session,
        canVoidOrders: emp.can_void_orders,
        canGiveDiscount: emp.can_give_discount,
        canRefund: emp.can_refund,
        maxDiscountPercent: parseFloat(emp.max_discount_percent) || 0
      }
    }))

    console.log('[Terminal Employees] Found', employees.length, 'employees for terminal', terminalId)

    return NextResponse.json({
      success: true,
      data: {
        terminal: {
          id: terminal.id,
          name: terminal.name,
          code: terminal.code
        },
        employees
      }
    })

  } catch (error) {
    console.error('[Terminal Employees] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener empleados'
    }, { status: 500 })
  }
}
