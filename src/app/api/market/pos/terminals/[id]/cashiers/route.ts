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
 * GET /api/market/pos/terminals/[id]/cashiers
 * Get all cashiers (employees) assigned to a terminal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const terminalId = parseInt(id)

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
    const userRole = payload.role

    // Verify terminal belongs to company
    const terminalCheck = await db.query(
      'SELECT id, name FROM market_pos_terminals WHERE id = $1 AND company_id = $2',
      [terminalId, companyId]
    )

    if (terminalCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado'
      }, { status: 404 })
    }

    // If user is MARKET_MANAGER_TIENDA, verify they have access to this terminal
    if (userRole === 'MARKET_MANAGER_TIENDA') {
      const userEmployee = await db.query(`
        SELECT e.id FROM market_employees e
        WHERE e.user_id = $1 AND e.company_id = $2 AND e.status = 'active'
      `, [payload.userId, companyId])

      if (userEmployee.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No tienes acceso a este terminal'
        }, { status: 403 })
      }

      const employeeId = userEmployee.rows[0].id
      const terminalAccess = await db.query(
        'SELECT 1 FROM market_employee_terminals WHERE employee_id = $1 AND terminal_id = $2',
        [employeeId, terminalId]
      )

      if (terminalAccess.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No tienes acceso a este terminal'
        }, { status: 403 })
      }
    }

    // Get all employees assigned to this terminal
    const result = await db.query(`
      SELECT
        e.id as employee_id,
        e.employee_code,
        e.status as employee_status,
        u.id as user_id,
        u.email,
        u.firstname,
        u.lastname,
        u.role,
        et.can_open_session,
        et.can_close_session,
        et.can_void_orders,
        et.can_give_discount,
        et.can_refund,
        et.max_discount_percent,
        et.created_at as assigned_at
      FROM market_employee_terminals et
      JOIN market_employees e ON et.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE et.terminal_id = $1 AND e.company_id = $2 AND e.status = 'active'
      ORDER BY u.firstname, u.lastname
    `, [terminalId, companyId])

    // Get available employees (not assigned to this terminal)
    const availableResult = await db.query(`
      SELECT
        e.id as employee_id,
        e.employee_code,
        u.email,
        u.firstname,
        u.lastname,
        u.role
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      WHERE e.company_id = $1
        AND e.status = 'active'
        AND u.role = 'MARKET_VENDEDOR'
        AND e.id NOT IN (
          SELECT employee_id FROM market_employee_terminals WHERE terminal_id = $2
        )
      ORDER BY u.firstname, u.lastname
    `, [companyId, terminalId])

    return NextResponse.json({
      success: true,
      data: {
        terminal: {
          id: terminalCheck.rows[0].id,
          name: terminalCheck.rows[0].name
        },
        cashiers: result.rows.map(row => ({
          employeeId: row.employee_id,
          employeeCode: row.employee_code,
          userId: row.user_id,
          email: row.email,
          firstName: row.firstname,
          lastName: row.lastname,
          fullName: `${row.firstname || ''} ${row.lastname || ''}`.trim() || row.email,
          role: row.role,
          permissions: {
            canOpenSession: row.can_open_session,
            canCloseSession: row.can_close_session,
            canVoidOrders: row.can_void_orders,
            canGiveDiscount: row.can_give_discount,
            canRefund: row.can_refund,
            maxDiscountPercent: parseFloat(row.max_discount_percent) || 0
          },
          assignedAt: row.assigned_at
        })),
        availableEmployees: availableResult.rows.map(row => ({
          employeeId: row.employee_id,
          employeeCode: row.employee_code,
          email: row.email,
          firstName: row.firstname,
          lastName: row.lastname,
          fullName: `${row.firstname || ''} ${row.lastname || ''}`.trim() || row.email,
          role: row.role
        }))
      }
    })

  } catch (error) {
    console.error('[Terminal Cashiers API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener cajeros'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/pos/terminals/[id]/cashiers
 * Add a cashier to the terminal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const terminalId = parseInt(id)

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
    const userRole = payload.role

    // Only MARKET_MANAGER or MARKET_MANAGER_TIENDA can add cashiers
    if (!['MARKET_MANAGER', 'MARKET_MANAGER_TIENDA'].includes(userRole)) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para gestionar cajeros'
      }, { status: 403 })
    }

    // Verify terminal belongs to company
    const terminalCheck = await db.query(
      'SELECT id FROM market_pos_terminals WHERE id = $1 AND company_id = $2',
      [terminalId, companyId]
    )

    if (terminalCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado'
      }, { status: 404 })
    }

    // If user is MARKET_MANAGER_TIENDA, verify they have access to this terminal
    if (userRole === 'MARKET_MANAGER_TIENDA') {
      const userEmployee = await db.query(`
        SELECT e.id FROM market_employees e
        WHERE e.user_id = $1 AND e.company_id = $2 AND e.status = 'active'
      `, [payload.userId, companyId])

      if (userEmployee.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No tienes acceso a este terminal'
        }, { status: 403 })
      }

      const employeeId = userEmployee.rows[0].id
      const terminalAccess = await db.query(
        'SELECT 1 FROM market_employee_terminals WHERE employee_id = $1 AND terminal_id = $2',
        [employeeId, terminalId]
      )

      if (terminalAccess.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No tienes acceso a este terminal'
        }, { status: 403 })
      }
    }

    const body = await request.json()
    const {
      employeeId,
      canOpenSession = true,
      canCloseSession = true,
      canVoidOrders = false,
      canGiveDiscount = false,
      canRefund = false,
      maxDiscountPercent = 0
    } = body

    if (!employeeId) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar un empleado'
      }, { status: 400 })
    }

    // Verify employee exists and belongs to company
    const employeeCheck = await db.query(
      'SELECT id FROM market_employees WHERE id = $1 AND company_id = $2 AND status = $3',
      [employeeId, companyId, 'active']
    )

    if (employeeCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

    // Check if already assigned
    const existingCheck = await db.query(
      'SELECT 1 FROM market_employee_terminals WHERE employee_id = $1 AND terminal_id = $2',
      [employeeId, terminalId]
    )

    if (existingCheck.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'El empleado ya está asignado a este terminal'
      }, { status: 400 })
    }

    // Add employee to terminal
    await db.query(`
      INSERT INTO market_employee_terminals (
        employee_id, terminal_id,
        can_open_session, can_close_session, can_void_orders,
        can_give_discount, can_refund, max_discount_percent,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      employeeId,
      terminalId,
      canOpenSession,
      canCloseSession,
      canVoidOrders,
      canGiveDiscount,
      canRefund,
      maxDiscountPercent
    ])

    console.log('[Terminal Cashiers API] Added employee', employeeId, 'to terminal', terminalId)

    return NextResponse.json({
      success: true,
      message: 'Cajero agregado exitosamente'
    })

  } catch (error) {
    console.error('[Terminal Cashiers API] Error adding:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al agregar cajero'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/pos/terminals/[id]/cashiers
 * Remove a cashier from the terminal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const terminalId = parseInt(id)

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
    const userRole = payload.role

    // Only MARKET_MANAGER or MARKET_MANAGER_TIENDA can remove cashiers
    if (!['MARKET_MANAGER', 'MARKET_MANAGER_TIENDA'].includes(userRole)) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para gestionar cajeros'
      }, { status: 403 })
    }

    // Verify terminal belongs to company
    const terminalCheck = await db.query(
      'SELECT id FROM market_pos_terminals WHERE id = $1 AND company_id = $2',
      [terminalId, companyId]
    )

    if (terminalCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado'
      }, { status: 404 })
    }

    // If user is MARKET_MANAGER_TIENDA, verify they have access to this terminal
    if (userRole === 'MARKET_MANAGER_TIENDA') {
      const userEmployee = await db.query(`
        SELECT e.id FROM market_employees e
        WHERE e.user_id = $1 AND e.company_id = $2 AND e.status = 'active'
      `, [payload.userId, companyId])

      if (userEmployee.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No tienes acceso a este terminal'
        }, { status: 403 })
      }

      const employeeId = userEmployee.rows[0].id
      const terminalAccess = await db.query(
        'SELECT 1 FROM market_employee_terminals WHERE employee_id = $1 AND terminal_id = $2',
        [employeeId, terminalId]
      )

      if (terminalAccess.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No tienes acceso a este terminal'
        }, { status: 403 })
      }
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    if (!employeeId) {
      return NextResponse.json({
        success: false,
        error: 'Debe especificar el empleado a remover'
      }, { status: 400 })
    }

    // Remove employee from terminal
    const deleteResult = await db.query(
      'DELETE FROM market_employee_terminals WHERE employee_id = $1 AND terminal_id = $2',
      [parseInt(employeeId), terminalId]
    )

    if (deleteResult.rowCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'El empleado no estaba asignado a este terminal'
      }, { status: 404 })
    }

    console.log('[Terminal Cashiers API] Removed employee', employeeId, 'from terminal', terminalId)

    return NextResponse.json({
      success: true,
      message: 'Cajero removido exitosamente'
    })

  } catch (error) {
    console.error('[Terminal Cashiers API] Error removing:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al remover cajero'
    }, { status: 500 })
  }
}
