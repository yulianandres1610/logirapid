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
 * GET /api/market/accounting/dashboard
 * Get accounting dashboard statistics
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

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)
    const periodType = searchParams.get('period') || 'month' // week, month, year

    // Calculate date range
    let startDate: string
    let endDate: string
    const now = new Date()

    switch (periodType) {
      case 'week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        startDate = weekStart.toISOString().split('T')[0]
        endDate = now.toISOString().split('T')[0]
        break
      case 'year':
        startDate = `${now.getFullYear()}-01-01`
        endDate = now.toISOString().split('T')[0]
        break
      case 'month':
      default:
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        endDate = now.toISOString().split('T')[0]
    }

    // Helper for safe queries with logging
    const safeQuery = async (queryName: string, query: string, params: any[]) => {
      try {
        const result = await db.query(query, params)
        console.log(`[Dashboard] ${queryName}: ${result.rows.length} rows`)
        return result
      } catch (error) {
        console.error(`[Dashboard] ${queryName} failed:`, error instanceof Error ? error.message : error)
        return { rows: [{}] }
      }
    }

    // Get POS sales
    const posSales = await safeQuery('POS Sales', `
      SELECT
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as order_count
      FROM market_pos_orders
      WHERE company_id = $1
        AND created_at >= $2
        AND created_at <= ($3::date + interval '1 day')
        AND status IN ('paid', 'completed')
    `, [companyId, startDate, endDate])

    // Get order sales (online orders)
    const orderSales = await safeQuery('Order Sales', `
      SELECT
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as order_count
      FROM market_orders
      WHERE market_company_id = $1
        AND created_at >= $2
        AND created_at <= ($3::date + interval '1 day')
        AND status = 'delivered'
    `, [companyId, startDate, endDate])

    // Get expenses for period
    const expenses = await safeQuery('Expenses Period', `
      SELECT
        COALESCE(SUM(amount), 0) as total_expenses,
        COUNT(*) as expense_count
      FROM market_expenses
      WHERE company_id = $1
        AND expense_date >= $2
        AND expense_date <= $3
    `, [companyId, startDate, endDate])

    // Get ALL expenses (no date filter) for debugging
    const allExpenses = await safeQuery('All Expenses', `
      SELECT
        COALESCE(SUM(amount), 0) as total_expenses,
        COUNT(*) as expense_count,
        MIN(expense_date) as first_expense,
        MAX(expense_date) as last_expense
      FROM market_expenses
      WHERE company_id = $1
    `, [companyId])

    console.log('[Dashboard] All expenses for company:', allExpenses.rows[0])
    console.log('[Dashboard] Date range:', startDate, 'to', endDate)

    // Get expenses by category
    const expensesByCategory = await safeQuery('Expenses by Category', `
      SELECT
        c.name as category_name,
        c.accounting_type,
        COALESCE(SUM(e.amount), 0) as total
      FROM market_expenses e
      LEFT JOIN market_expense_categories c ON e.category_id = c.id
      WHERE e.company_id = $1
        AND e.expense_date >= $2
        AND e.expense_date <= $3
      GROUP BY c.id, c.name, c.accounting_type
      ORDER BY total DESC
      LIMIT 10
    `, [companyId, startDate, endDate])

    // If no expenses in period, get all-time categories
    let finalExpensesByCategory = expensesByCategory
    if (expensesByCategory.rows.length === 0 || !expensesByCategory.rows[0].category_name) {
      finalExpensesByCategory = await safeQuery('All Expenses by Category', `
        SELECT
          c.name as category_name,
          c.accounting_type,
          COALESCE(SUM(e.amount), 0) as total
        FROM market_expenses e
        LEFT JOIN market_expense_categories c ON e.category_id = c.id
        WHERE e.company_id = $1
        GROUP BY c.id, c.name, c.accounting_type
        ORDER BY total DESC
        LIMIT 10
      `, [companyId])
    }

    // Get payroll totals
    const payroll = await safeQuery('Payroll', `
      SELECT
        COALESCE(SUM(net_pay) FILTER (WHERE status = 'pending'), 0) as pending_payroll,
        COALESCE(SUM(net_pay) FILTER (WHERE status = 'paid'), 0) as paid_payroll,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count
      FROM market_payroll
      WHERE company_id = $1
        AND period_start >= $2
        AND period_end <= $3
    `, [companyId, startDate, endDate])

    // Get employee stats
    const employees = await safeQuery('Employees', `
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'terminated') as terminated_count
      FROM market_employees
      WHERE company_id = $1
    `, [companyId])

    // Get payment requests
    const requests = await safeQuery('Payment Requests', `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0) as pending_amount
      FROM market_payment_requests
      WHERE company_id = $1
    `, [companyId])

    // Get consignment costs
    const consignments = await safeQuery('Consignments', `
      SELECT
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(total_sold), 0) as total_sold
      FROM consignment_orders
      WHERE company_id = $1
        AND consignment_date >= $2
        AND consignment_date <= $3
        AND status != 'cancelled'
    `, [companyId, startDate, endDate])

    // Get purchases
    const purchases = await safeQuery('Purchases', `
      SELECT
        COALESCE(SUM(total_amount), 0) as total_purchases
      FROM market_purchases
      WHERE company_id = $1
        AND purchase_date >= $2
        AND purchase_date <= $3
        AND status != 'cancelled'
    `, [companyId, startDate, endDate])

    // Calculate totals
    const totalSales = (parseFloat(posSales.rows[0]?.total_sales) || 0) + (parseFloat(orderSales.rows[0]?.total_sales) || 0)
    const totalExpenses = parseFloat(expenses.rows[0]?.total_expenses) || 0
    const totalPayroll = parseFloat(payroll.rows[0]?.paid_payroll) || 0
    const totalCOGS = (parseFloat(purchases.rows[0]?.total_purchases) || 0) + (parseFloat(consignments.rows[0]?.total_cost) || 0)

    const grossProfit = totalSales - totalCOGS
    const netProfit = grossProfit - totalExpenses - totalPayroll

    // Get daily sales for chart
    const dailySales = await safeQuery('Daily Sales', `
      SELECT
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as sales
      FROM market_pos_orders
      WHERE company_id = $1
        AND created_at >= $2
        AND created_at <= ($3::date + interval '1 day')
        AND status IN ('paid', 'completed')
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [companyId, startDate, endDate])

    // Get daily expenses for chart
    const dailyExpenses = await safeQuery('Daily Expenses', `
      SELECT
        expense_date as date,
        COALESCE(SUM(amount), 0) as expenses
      FROM market_expenses
      WHERE company_id = $1
        AND expense_date >= $2
        AND expense_date <= $3
      GROUP BY expense_date
      ORDER BY expense_date
    `, [companyId, startDate, endDate])

    // Get top selling employees
    const topEmployees = await safeQuery('Top Employees', `
      SELECT
        e.employee_code,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_sales
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN market_pos_orders o ON e.id = o.employee_id
        AND o.created_at >= $2
        AND o.created_at <= ($3::date + interval '1 day')
        AND o.status IN ('paid', 'completed')
      WHERE e.company_id = $1 AND e.status = 'active'
      GROUP BY e.id, e.employee_code, u.firstname, u.lastname, u.email
      HAVING COUNT(o.id) > 0
      ORDER BY total_sales DESC
      LIMIT 5
    `, [companyId, startDate, endDate])

    return NextResponse.json({
      success: true,
      data: {
        period: {
          type: periodType,
          startDate,
          endDate
        },
        summary: {
          totalSales: Math.round(totalSales * 100) / 100,
          posSales: parseFloat(posSales.rows[0]?.total_sales) || 0,
          posOrderCount: parseInt(posSales.rows[0]?.order_count) || 0,
          orderSales: parseFloat(orderSales.rows[0]?.total_sales) || 0,
          onlineOrderCount: parseInt(orderSales.rows[0]?.order_count) || 0,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          expenseCount: parseInt(expenses.rows[0]?.expense_count) || 0,
          totalPayroll: Math.round(totalPayroll * 100) / 100,
          pendingPayroll: parseFloat(payroll.rows[0]?.pending_payroll) || 0,
          totalCOGS: Math.round(totalCOGS * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          netProfit: Math.round(netProfit * 100) / 100,
          profitMargin: totalSales > 0 ? Math.round((netProfit / totalSales) * 10000) / 100 : 0
        },
        employees: {
          activeCount: parseInt(employees.rows[0]?.active_count) || 0,
          terminatedCount: parseInt(employees.rows[0]?.terminated_count) || 0
        },
        pendingRequests: {
          count: parseInt(requests.rows[0]?.pending_count) || 0,
          amount: parseFloat(requests.rows[0]?.pending_amount) || 0
        },
        expensesByCategory: finalExpensesByCategory.rows.filter(row => row.category_name).map(row => ({
          categoryName: row.category_name || 'Sin categoría',
          accountingType: row.accounting_type,
          total: parseFloat(row.total) || 0
        })),
        // Debug info
        allTimeExpenses: {
          total: parseFloat(allExpenses.rows[0]?.total_expenses) || 0,
          count: parseInt(allExpenses.rows[0]?.expense_count) || 0,
          firstDate: allExpenses.rows[0]?.first_expense,
          lastDate: allExpenses.rows[0]?.last_expense
        },
        topEmployees: topEmployees.rows.map(row => ({
          employeeCode: row.employee_code,
          name: row.name,
          orderCount: parseInt(row.order_count) || 0,
          totalSales: parseFloat(row.total_sales) || 0
        })),
        charts: {
          dailySales: dailySales.rows.map(row => ({
            date: row.date,
            sales: parseFloat(row.sales) || 0
          })),
          dailyExpenses: dailyExpenses.rows.map(row => ({
            date: row.date,
            expenses: parseFloat(row.expenses) || 0
          }))
        }
      }
    })

  } catch (error) {
    console.error('[Accounting Dashboard API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener dashboard'
    }, { status: 500 })
  }
}
