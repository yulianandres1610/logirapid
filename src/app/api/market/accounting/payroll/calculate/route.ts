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
 * POST /api/market/accounting/payroll/calculate
 * Calculate payroll for an employee including commissions from POS sales
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
    const { employeeId, periodStart, periodEnd, hoursWorked, daysWorked } = body

    if (!employeeId || !periodStart || !periodEnd) {
      return NextResponse.json({
        success: false,
        error: 'Empleado y período requeridos'
      }, { status: 400 })
    }

    // Get employee info
    const employee = await db.query(`
      SELECT
        e.id,
        e.pay_type,
        e.pay_rate,
        e.currency,
        e.commission_rate,
        u.email,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as name
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      WHERE e.id = $1 AND e.company_id = $2
    `, [employeeId, companyId])

    if (employee.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

    const emp = employee.rows[0]
    const payRate = parseFloat(emp.pay_rate) || 0
    const commissionRate = parseFloat(emp.commission_rate) || 0

    // Calculate base pay based on type
    let basePay = 0
    let calculatedHours = hoursWorked
    let calculatedDays = daysWorked

    switch (emp.pay_type) {
      case 'hourly':
        if (!hoursWorked) {
          // Estimate hours from period (assuming 8 hours per day, Mon-Sat)
          const start = new Date(periodStart)
          const end = new Date(periodEnd)
          let workDays = 0
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const day = d.getDay()
            if (day !== 0) workDays++ // Exclude Sundays
          }
          calculatedHours = workDays * 8
        }
        basePay = payRate * calculatedHours
        break

      case 'daily':
        if (!daysWorked) {
          // Count days in period (excluding Sundays)
          const start = new Date(periodStart)
          const end = new Date(periodEnd)
          let workDays = 0
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const day = d.getDay()
            if (day !== 0) workDays++
          }
          calculatedDays = workDays
        }
        basePay = payRate * calculatedDays
        break

      case 'monthly':
        basePay = payRate
        break
    }

    // Get POS sales for the period
    const salesResult = await db.query(`
      SELECT
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total_sales
      FROM market_pos_orders
      WHERE employee_id = $1
        AND created_at >= $2
        AND created_at <= ($3::date + interval '1 day')
        AND status IN ('paid', 'completed')
    `, [employeeId, periodStart, periodEnd])

    const orderCount = parseInt(salesResult.rows[0]?.order_count) || 0
    const totalSales = parseFloat(salesResult.rows[0]?.total_sales) || 0

    // Calculate commission
    const commissionAmount = (totalSales * commissionRate) / 100

    // Calculate totals
    const grossPay = basePay + commissionAmount
    const netPay = grossPay // No deductions calculated yet

    console.log('[Payroll Calculate] Employee:', emp.name, 'Sales:', totalSales, 'Commission:', commissionAmount)

    return NextResponse.json({
      success: true,
      data: {
        employee: {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          payType: emp.pay_type,
          payRate: payRate,
          commissionRate: commissionRate
        },
        period: {
          start: periodStart,
          end: periodEnd
        },
        calculation: {
          basePay: Math.round(basePay * 100) / 100,
          hoursWorked: calculatedHours,
          daysWorked: calculatedDays,
          salesTotal: Math.round(totalSales * 100) / 100,
          orderCount: orderCount,
          commissionRate: commissionRate,
          commissionAmount: Math.round(commissionAmount * 100) / 100,
          grossPay: Math.round(grossPay * 100) / 100,
          netPay: Math.round(netPay * 100) / 100,
          currency: emp.currency || 'USD'
        }
      }
    })

  } catch (error) {
    console.error('[Payroll Calculate API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al calcular nómina'
    }, { status: 500 })
  }
}
