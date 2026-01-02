import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/market/pos/auth
 * Authenticate employee for POS terminal access via PIN or Badge
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { terminalId, pin, badge } = body

    if (!terminalId) {
      return NextResponse.json({
        success: false,
        error: 'Terminal ID es requerido'
      }, { status: 400 })
    }

    if (!pin && !badge) {
      return NextResponse.json({
        success: false,
        error: 'PIN o Badge es requerido'
      }, { status: 400 })
    }

    // Find employee by badge or verify PIN
    let employee = null

    if (badge) {
      // Authenticate by badge code
      const result = await db.query(`
        SELECT
          e.id as employee_id,
          e.employee_code,
          e.user_id,
          u.email,
          u.firstname,
          u.lastname,
          e.status
        FROM market_employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.company_id = $1
          AND e.pos_badge_code = $2
          AND e.status = 'active'
      `, [companyId, badge])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Badge no reconocido'
        }, { status: 401 })
      }

      employee = result.rows[0]

    } else if (pin) {
      // Authenticate by PIN - need to check all employees with PINs
      const result = await db.query(`
        SELECT
          e.id as employee_id,
          e.employee_code,
          e.user_id,
          e.pos_pin,
          u.email,
          u.firstname,
          u.lastname,
          e.status
        FROM market_employees e
        JOIN users u ON e.user_id = u.id
        WHERE e.company_id = $1
          AND e.pos_pin IS NOT NULL
          AND e.status = 'active'
      `, [companyId])

      // Check each employee's PIN
      for (const emp of result.rows) {
        const isValidPin = await bcrypt.compare(pin, emp.pos_pin)
        if (isValidPin) {
          employee = emp
          break
        }
      }

      if (!employee) {
        return NextResponse.json({
          success: false,
          error: 'PIN inválido'
        }, { status: 401 })
      }
    }

    // Check employee has permissions on this terminal
    const permissions = await db.query(`
      SELECT
        can_open_session,
        can_close_session,
        can_void_orders,
        can_give_discount,
        can_refund,
        max_discount_percent
      FROM market_employee_terminals
      WHERE employee_id = $1 AND terminal_id = $2
    `, [employee.employee_id, terminalId])

    if (permissions.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No tienes acceso a este terminal'
      }, { status: 403 })
    }

    const perm = permissions.rows[0]

    console.log('[POS Auth] Employee authenticated:', employee.employee_code, 'Terminal:', terminalId)

    return NextResponse.json({
      success: true,
      data: {
        employeeId: employee.employee_id,
        employeeCode: employee.employee_code,
        userId: employee.user_id,
        email: employee.email,
        fullName: `${employee.firstname || ''} ${employee.lastname || ''}`.trim() || employee.email,
        permissions: {
          canOpenSession: perm.can_open_session,
          canCloseSession: perm.can_close_session,
          canVoidOrders: perm.can_void_orders,
          canGiveDiscount: perm.can_give_discount,
          canRefund: perm.can_refund,
          maxDiscountPercent: parseFloat(perm.max_discount_percent) || 0
        }
      },
      message: 'Autenticación exitosa'
    })

  } catch (error) {
    console.error('[POS Auth] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error de autenticación'
    }, { status: 500 })
  }
}
