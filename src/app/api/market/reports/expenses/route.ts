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
 * GET /api/market/reports/expenses
 * Returns expense report with income vs expenses comparison
 * Query params: startDate, endDate, categoryId
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get('startDate') || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const categoryId = searchParams.get('categoryId')

    // Helper for safe queries
    const safeQuery = async (query: string, params: any[]) => {
      try {
        return await db.query(query, params)
      } catch (error) {
        console.log('[Expenses Report] Query skipped:', error instanceof Error ? error.message : error)
        return { rows: [] }
      }
    }

    // Total income from POS sales
    const incomeResult = await db.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) as total_income,
        COUNT(*) as order_count
      FROM market_pos_orders
      WHERE company_id = $1
        AND status IN ('paid', 'completed')
        AND DATE(created_at) BETWEEN $2 AND $3
    `, [companyId, startDate, endDate])

    // Total expenses
    const expenseResult = await safeQuery(`
      SELECT
        COALESCE(SUM(amount), 0) as total_expenses,
        COUNT(*) as expense_count
      FROM market_expenses
      WHERE company_id = $1
        AND DATE(expense_date) BETWEEN $2 AND $3
    `, [companyId, startDate, endDate])

    // Expenses by category
    const byCategoryResult = await safeQuery(`
      SELECT
        COALESCE(c.name, 'Sin categoría') as category_name,
        COALESCE(c.accounting_type, 'opex') as accounting_type,
        COALESCE(SUM(e.amount), 0) as amount,
        COUNT(e.id) as count
      FROM market_expenses e
      LEFT JOIN market_expense_categories c ON e.category_id = c.id
      WHERE e.company_id = $1
        AND DATE(e.expense_date) BETWEEN $2 AND $3
      GROUP BY c.name, c.accounting_type
      ORDER BY amount DESC
    `, [companyId, startDate, endDate])

    // Income vs Expenses by month
    const byMonthResult = await db.query(`
      WITH monthly_income AS (
        SELECT
          DATE_TRUNC('month', created_at) as month,
          COALESCE(SUM(total_amount), 0) as income
        FROM market_pos_orders
        WHERE company_id = $1
          AND status IN ('paid', 'completed')
          AND created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
      ),
      monthly_expenses AS (
        SELECT
          DATE_TRUNC('month', expense_date) as month,
          COALESCE(SUM(amount), 0) as expenses
        FROM market_expenses
        WHERE company_id = $1
          AND expense_date >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', expense_date)
      )
      SELECT
        TO_CHAR(COALESCE(i.month, e.month), 'YYYY-MM') as month,
        COALESCE(i.income, 0) as income,
        COALESCE(e.expenses, 0) as expenses,
        COALESCE(i.income, 0) - COALESCE(e.expenses, 0) as profit
      FROM monthly_income i
      FULL OUTER JOIN monthly_expenses e ON i.month = e.month
      ORDER BY month ASC
    `, [companyId])

    // Recent expenses
    const recentExpenses = await safeQuery(`
      SELECT
        e.id,
        e.description,
        e.amount,
        e.expense_date,
        e.vendor_name,
        COALESCE(c.name, 'Sin categoría') as category_name
      FROM market_expenses e
      LEFT JOIN market_expense_categories c ON e.category_id = c.id
      WHERE e.company_id = $1
      ORDER BY e.expense_date DESC, e.created_at DESC
      LIMIT 20
    `, [companyId])

    // COGS (Cost of Goods Sold) from sales
    const cogsResult = await db.query(`
      SELECT
        COALESCE(SUM(ol.quantity * COALESCE(p.cost_price, 0)), 0) as cogs
      FROM market_pos_order_lines ol
      JOIN market_pos_orders o ON ol.order_id = o.id
      LEFT JOIN market_products p ON ol.product_id = p.id
      WHERE o.company_id = $1
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
    `, [companyId, startDate, endDate])

    const totalIncome = parseFloat(incomeResult.rows[0]?.total_income) || 0
    const totalExpenses = parseFloat(expenseResult.rows[0]?.total_expenses) || 0
    const cogs = parseFloat(cogsResult.rows[0]?.cogs) || 0
    const grossProfit = totalIncome - cogs
    const netProfit = grossProfit - totalExpenses
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0

    // Calculate totals for percentages
    const totalCategoryExpenses = byCategoryResult.rows.reduce((sum, row) => sum + parseFloat(row.amount), 0)

    return NextResponse.json({
      success: true,
      data: {
        filters: {
          startDate,
          endDate,
          categoryId: categoryId ? parseInt(categoryId) : null
        },
        summary: {
          totalIncome,
          cogs,
          grossProfit,
          totalExpenses,
          netProfit,
          profitMargin: Math.round(profitMargin * 100) / 100,
          orderCount: parseInt(incomeResult.rows[0]?.order_count) || 0,
          expenseCount: parseInt(expenseResult.rows[0]?.expense_count) || 0
        },
        byCategory: byCategoryResult.rows.map(row => ({
          categoryName: row.category_name,
          accountingType: row.accounting_type,
          amount: parseFloat(row.amount) || 0,
          count: parseInt(row.count) || 0,
          percentage: totalCategoryExpenses > 0
            ? Math.round((parseFloat(row.amount) / totalCategoryExpenses) * 10000) / 100
            : 0
        })),
        byMonth: byMonthResult.rows.map(row => ({
          month: row.month,
          income: parseFloat(row.income) || 0,
          expenses: parseFloat(row.expenses) || 0,
          profit: parseFloat(row.profit) || 0
        })),
        recentExpenses: recentExpenses.rows.map(row => ({
          id: row.id,
          description: row.description,
          amount: parseFloat(row.amount) || 0,
          expenseDate: row.expense_date,
          vendorName: row.vendor_name,
          categoryName: row.category_name
        })),
        breakdown: {
          revenue: totalIncome,
          cogs: cogs,
          grossProfit: grossProfit,
          operatingExpenses: totalExpenses,
          netProfit: netProfit
        }
      }
    })

  } catch (error) {
    console.error('[Expenses Report API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener reporte de gastos'
    }, { status: 500 })
  }
}
