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
 * GET /api/market/employees/[id]/commission-balance
 * Get commission balance summary for an employee
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

    const { id } = await params
    const employeeId = parseInt(id)
    const companyId = payload.companyId

    // Get employee data including commission balance
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
      WHERE e.id = $1 AND e.company_id = $2
    `, [employeeId, companyId])

    if (employeeResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

    const employee = employeeResult.rows[0]

    // Get commission statistics
    const statsResult = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending_total,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) as paid_total,
        COALESCE(SUM(commission_amount), 0) as total_earned,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(*) as total_count
      FROM market_employee_commissions
      WHERE employee_id = $1 AND company_id = $2
    `, [employeeId, companyId])

    const stats = statsResult.rows[0]

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
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: [employee.firstname, employee.lastname].filter(Boolean).join(' ') || employee.email,
        commissionRate: parseFloat(employee.commission_rate) || 0,
        balance: parseFloat(employee.commission_balance) || 0,
        totalEarned: parseFloat(stats.total_earned) || 0,
        totalPaid: parseFloat(stats.paid_total) || 0,
        pendingTotal: parseFloat(stats.pending_total) || 0,
        pendingCount: parseInt(stats.pending_count) || 0,
        thisMonth
      }
    })

  } catch (error) {
    console.error('[Commission Balance API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener balance de comisiones'
    }, { status: 500 })
  }
}
