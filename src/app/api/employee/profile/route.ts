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
 * GET /api/employee/profile
 * Get employee profile and stats
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

    // Get employee details
    const employeeResult = await db.query(`
      SELECT
        e.id,
        e.employee_code,
        e.hire_date,
        e.status,
        e.pay_type,
        e.pay_rate,
        e.currency,
        e.commission_rate,
        u.email,
        u.firstname,
        u.lastname,
        u.phone,
        u.role,
        c.name as company_name
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      JOIN companies c ON e.company_id = c.id
      WHERE e.id = $1
    `, [employeeId])

    if (employeeResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

    const employee = employeeResult.rows[0]

    // Get current month stats
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = now.toISOString().split('T')[0]

    // Get sales this month
    const salesResult = await db.query(`
      SELECT
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total_sales
      FROM market_pos_orders
      WHERE employee_id = $1
        AND created_at >= $2
        AND created_at <= ($3::date + interval '1 day')
        AND status IN ('paid', 'completed')
    `, [employeeId, monthStart, monthEnd])

    // Get pending payroll
    const pendingPayrollResult = await db.query(`
      SELECT
        COALESCE(SUM(net_pay), 0) as pending_amount,
        COUNT(*) as pending_count
      FROM market_payroll
      WHERE employee_id = $1
        AND status IN ('pending', 'approved')
    `, [employeeId])

    // Get pending payment requests
    const pendingRequestsResult = await db.query(`
      SELECT
        COALESCE(SUM(amount), 0) as pending_amount,
        COUNT(*) as pending_count
      FROM market_payment_requests
      WHERE employee_id = $1
        AND status = 'pending'
    `, [employeeId])

    // Get last paid payroll
    const lastPayrollResult = await db.query(`
      SELECT
        net_pay,
        period_start,
        period_end,
        paid_at
      FROM market_payroll
      WHERE employee_id = $1
        AND status = 'paid'
      ORDER BY paid_at DESC
      LIMIT 1
    `, [employeeId])

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: employee.id,
          employeeCode: employee.employee_code,
          email: employee.email,
          firstName: employee.firstname,
          lastName: employee.lastname,
          fullName: `${employee.firstname || ''} ${employee.lastname || ''}`.trim() || employee.email,
          phone: employee.phone,
          role: employee.role,
          hireDate: employee.hire_date,
          status: employee.status,
          payType: employee.pay_type,
          payRate: parseFloat(employee.pay_rate),
          currency: employee.currency,
          commissionRate: parseFloat(employee.commission_rate) || 0,
          companyName: employee.company_name
        },
        stats: {
          currentMonth: {
            orderCount: parseInt(salesResult.rows[0]?.order_count) || 0,
            totalSales: parseFloat(salesResult.rows[0]?.total_sales) || 0,
            estimatedCommission: ((parseFloat(salesResult.rows[0]?.total_sales) || 0) * (parseFloat(employee.commission_rate) || 0)) / 100
          },
          pendingPayroll: {
            amount: parseFloat(pendingPayrollResult.rows[0]?.pending_amount) || 0,
            count: parseInt(pendingPayrollResult.rows[0]?.pending_count) || 0
          },
          pendingRequests: {
            amount: parseFloat(pendingRequestsResult.rows[0]?.pending_amount) || 0,
            count: parseInt(pendingRequestsResult.rows[0]?.pending_count) || 0
          },
          lastPayroll: lastPayrollResult.rows[0] ? {
            netPay: parseFloat(lastPayrollResult.rows[0].net_pay),
            periodStart: lastPayrollResult.rows[0].period_start,
            periodEnd: lastPayrollResult.rows[0].period_end,
            paidAt: lastPayrollResult.rows[0].paid_at
          } : null
        }
      }
    })

  } catch (error) {
    console.error('[Employee Profile] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener perfil'
    }, { status: 500 })
  }
}
