import { NextResponse } from 'next/server'
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
 * GET /api/market/my-commission-balance
 * Get commission balance for the currently logged-in employee
 * Used by the sidebar to show "Mi Saldo Personal"
 */
export async function GET() {
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
    const companyId = payload.companyId

    // Find employee by user_id and company_id
    const employeeResult = await db.query(`
      SELECT
        e.id,
        e.employee_code,
        e.commission_rate,
        COALESCE(e.commission_balance, 0) as commission_balance,
        u.firstname,
        u.lastname,
        u.email
      FROM market_employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.user_id = $1 AND e.company_id = $2 AND e.status = 'active'
    `, [userId, companyId])

    if (employeeResult.rows.length === 0) {
      // User is not a market employee
      return NextResponse.json({
        success: true,
        data: {
          isEmployee: false,
          balance: 0,
          commissionRate: 0
        }
      })
    }

    const employee = employeeResult.rows[0]
    const employeeId = employee.id

    // Get this month's earnings
    const thisMonthResult = await db.query(`
      SELECT COALESCE(SUM(commission_amount), 0) as this_month
      FROM market_employee_commissions
      WHERE employee_id = $1
        AND company_id = $2
        AND created_at >= date_trunc('month', CURRENT_DATE)
    `, [employeeId, companyId])

    const thisMonth = parseFloat(thisMonthResult.rows[0]?.this_month) || 0

    return NextResponse.json({
      success: true,
      data: {
        isEmployee: true,
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: [employee.firstname, employee.lastname].filter(Boolean).join(' ') || employee.email,
        commissionRate: parseFloat(employee.commission_rate) || 0,
        balance: parseFloat(employee.commission_balance) || 0,
        thisMonth
      }
    })

  } catch (error) {
    console.error('[My Commission Balance API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener balance de comisiones'
    }, { status: 500 })
  }
}
