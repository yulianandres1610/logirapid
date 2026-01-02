import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface EmployeeJWTPayload {
  type: string
  userId: number
  employeeId: number
  employeeCode: string
  email: string
  companyId: number
  companyName: string
  role: string
}

/**
 * GET /api/employee/payroll
 * Get employee's payroll history
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('employee-auth-token')?.value

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: EmployeeJWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(token, secret) as EmployeeJWTPayload

      if (payload.type !== 'employee') {
        throw new Error('Invalid token type')
      }
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const employeeId = payload.employeeId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT
        id,
        period_start,
        period_end,
        pay_date,
        base_pay,
        hours_worked,
        days_worked,
        sales_total,
        commission_amount,
        bonus_amount,
        bonus_description,
        deductions,
        gross_pay,
        net_pay,
        currency,
        status,
        paid_at,
        created_at
      FROM market_payroll
      WHERE employee_id = $1
    `
    const params: any[] = [employeeId]
    let paramIndex = 2

    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex++}`
      params.push(status)
    }

    query += ` ORDER BY period_end DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get totals
    const totalsResult = await db.query(`
      SELECT
        COALESCE(SUM(net_pay) FILTER (WHERE status = 'paid'), 0) as total_paid,
        COALESCE(SUM(net_pay) FILTER (WHERE status IN ('pending', 'approved')), 0) as total_pending,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'paid'), 0) as total_commissions
      FROM market_payroll
      WHERE employee_id = $1
    `, [employeeId])

    return NextResponse.json({
      success: true,
      data: {
        payrolls: result.rows.map(row => ({
          id: row.id,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          payDate: row.pay_date,
          basePay: parseFloat(row.base_pay) || 0,
          hoursWorked: row.hours_worked ? parseFloat(row.hours_worked) : null,
          daysWorked: row.days_worked,
          salesTotal: parseFloat(row.sales_total) || 0,
          commissionAmount: parseFloat(row.commission_amount) || 0,
          bonusAmount: parseFloat(row.bonus_amount) || 0,
          bonusDescription: row.bonus_description,
          deductions: parseFloat(row.deductions) || 0,
          grossPay: parseFloat(row.gross_pay) || 0,
          netPay: parseFloat(row.net_pay) || 0,
          currency: row.currency,
          status: row.status,
          paidAt: row.paid_at,
          createdAt: row.created_at
        })),
        totals: {
          totalPaid: parseFloat(totalsResult.rows[0]?.total_paid) || 0,
          totalPending: parseFloat(totalsResult.rows[0]?.total_pending) || 0,
          totalCommissions: parseFloat(totalsResult.rows[0]?.total_commissions) || 0
        }
      }
    })

  } catch (error) {
    console.error('[Employee Payroll] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener nóminas'
    }, { status: 500 })
  }
}
