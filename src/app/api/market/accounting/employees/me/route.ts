import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

/**
 * GET /api/market/accounting/employees/me
 * Get current logged-in employee's data (including warehouseId)
 */
export async function GET(request: NextRequest) {
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

    const userId = payload.userId

    // Get employee data for current user
    const result = await db.query(`
      SELECT
        e.id,
        e.user_id,
        e.company_id,
        e.employee_code,
        e.warehouse_id,
        e.status,
        u.email,
        u.firstname,
        u.lastname,
        u.role,
        w.name as warehouse_name,
        w.code as warehouse_code
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN market_warehouses w ON e.warehouse_id = w.id
      WHERE e.user_id = $1
    `, [userId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

    const employee = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: employee.id,
        userId: employee.user_id,
        companyId: employee.company_id,
        employeeCode: employee.employee_code,
        email: employee.email,
        firstName: employee.firstname,
        lastName: employee.lastname,
        role: employee.role,
        status: employee.status,
        warehouseId: employee.warehouse_id,
        warehouseName: employee.warehouse_name,
        warehouseCode: employee.warehouse_code
      }
    })

  } catch (error) {
    console.error('[Employees Me API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener empleado'
    }, { status: 500 })
  }
}
