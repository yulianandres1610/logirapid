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
 * GET /api/market/reports/sales
 * Returns sales report data with multiple dimensions
 * Query params: startDate, endDate, period, terminalId, categoryId, currency
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

    // Parse filters
    const startDate = searchParams.get('startDate') || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const period = searchParams.get('period') || 'day' // day, week, month, year
    const terminalId = searchParams.get('terminalId')
    const categoryId = searchParams.get('categoryId')
    const currency = searchParams.get('currency') || 'USD'

    console.log('[Sales Report API] Filters:', { companyId, startDate, endDate, period, terminalId })

    // Build terminal filter for POS queries
    // For subqueries without alias, use bare column name
    const posTerminalFilterBare = terminalId ? 'AND pos_terminal_id = $4' : ''
    // For queries with alias 'o', use o.pos_terminal_id
    const posTerminalFilter = terminalId ? 'AND o.pos_terminal_id = $4' : ''
    const params = terminalId
      ? [companyId, startDate, endDate, parseInt(terminalId)]
      : [companyId, startDate, endDate]

    // Get period truncation for SQL
    const periodTrunc = period === 'year' ? 'year' : period === 'month' ? 'month' : period === 'week' ? 'week' : 'day'

    // Summary statistics (POS + Wholesale)
    const summaryResult = await db.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) as total_sales,
        COUNT(*) as total_orders,
        COALESCE(AVG(total_amount), 0) as average_ticket,
        COUNT(DISTINCT DATE(created_at)) as days_with_sales
      FROM (
        SELECT total_amount, created_at FROM market_pos_orders
        WHERE company_id = $1 AND status IN ('paid', 'completed')
          AND DATE(created_at) BETWEEN $2 AND $3 ${posTerminalFilterBare}
        UNION ALL
        SELECT total_amount, created_at FROM market_invoices
        WHERE company_id = $1 AND status IN ('confirmed', 'paid', 'partial', 'delivered')
          AND DATE(created_at) BETWEEN $2 AND $3
      ) o
    `, params)

    // Previous period for comparison
    const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    const prevStartDate = new Date(new Date(startDate).getTime() - (daysDiff * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
    const prevEndDate = new Date(new Date(startDate).getTime() - (24 * 60 * 60 * 1000)).toISOString().split('T')[0]

    const prevParams = terminalId
      ? [companyId, prevStartDate, prevEndDate, parseInt(terminalId)]
      : [companyId, prevStartDate, prevEndDate]

    const prevResult = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as prev_sales
      FROM (
        SELECT total_amount, created_at FROM market_pos_orders
        WHERE company_id = $1 AND status IN ('paid', 'completed')
          AND DATE(created_at) BETWEEN $2 AND $3 ${posTerminalFilterBare}
        UNION ALL
        SELECT total_amount, created_at FROM market_invoices
        WHERE company_id = $1 AND status IN ('confirmed', 'paid', 'partial', 'delivered')
          AND DATE(created_at) BETWEEN $2 AND $3
      ) o
    `, prevParams)

    const currentSales = parseFloat(summaryResult.rows[0]?.total_sales) || 0
    const prevSales = parseFloat(prevResult.rows[0]?.prev_sales) || 0
    const percentChange = prevSales > 0 ? ((currentSales - prevSales) / prevSales) * 100 : 0

    console.log('[Sales Report API] Summary:', {
      currentSales,
      prevSales,
      totalOrders: summaryResult.rows[0]?.total_orders,
      summaryRow: summaryResult.rows[0]
    })

    // Sales by period (POS + Wholesale)
    const byPeriodResult = await db.query(`
      SELECT
        DATE_TRUNC('${periodTrunc}', created_at) as period_date,
        TO_CHAR(DATE_TRUNC('${periodTrunc}', created_at), 'YYYY-MM-DD') as date,
        COALESCE(SUM(total_amount), 0) as sales,
        COUNT(*) as orders
      FROM (
        SELECT total_amount, created_at FROM market_pos_orders
        WHERE company_id = $1 AND status IN ('paid', 'completed')
          AND DATE(created_at) BETWEEN $2 AND $3 ${posTerminalFilterBare}
        UNION ALL
        SELECT total_amount, created_at FROM market_invoices
        WHERE company_id = $1 AND status IN ('confirmed', 'paid', 'partial', 'delivered')
          AND DATE(created_at) BETWEEN $2 AND $3
      ) o
      GROUP BY DATE_TRUNC('${periodTrunc}', created_at)
      ORDER BY period_date ASC
    `, params)

    // Top products (POS + Wholesale)
    const byProductResult = await db.query(`
      SELECT
        product_id,
        product_name,
        SUM(quantity) as quantity,
        SUM(sales) as sales,
        SUM(order_count) as order_count
      FROM (
        SELECT
          ol.product_id,
          COALESCE(ol.product_name, p.name, 'Producto') as product_name,
          SUM(ol.quantity) as quantity,
          SUM(ol.total) as sales,
          COUNT(DISTINCT o.id) as order_count
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        LEFT JOIN market_products p ON ol.product_id = p.id
        WHERE o.company_id = $1
          AND o.status IN ('paid', 'completed')
          AND DATE(o.created_at) BETWEEN $2 AND $3
          ${posTerminalFilter}
        GROUP BY ol.product_id, ol.product_name, p.name
        UNION ALL
        SELECT
          il.product_id,
          COALESCE(il.product_name, p.name, 'Producto') as product_name,
          SUM(il.quantity) as quantity,
          SUM(il.subtotal) as sales,
          COUNT(DISTINCT i.id) as order_count
        FROM market_invoice_lines il
        JOIN market_invoices i ON il.invoice_id = i.id
        LEFT JOIN market_products p ON il.product_id = p.id
        WHERE i.company_id = $1
          AND i.status IN ('confirmed', 'paid', 'partial', 'delivered')
          AND DATE(i.created_at) BETWEEN $2 AND $3
        GROUP BY il.product_id, il.product_name, p.name
      ) combined
      GROUP BY product_id, product_name
      ORDER BY sales DESC
      LIMIT 20
    `, params)

    // Calculate percentage for each product
    const totalProductSales = byProductResult.rows.reduce((sum, row) => sum + parseFloat(row.sales), 0)

    // Sales by category
    const byCategoryResult = await db.query(`
      SELECT
        COALESCE(p.category, 'Sin categoría') as category_name,
        SUM(ol.total) as sales,
        SUM(ol.quantity) as quantity,
        COUNT(DISTINCT o.id) as order_count
      FROM market_pos_order_lines ol
      JOIN market_pos_orders o ON ol.order_id = o.id
      LEFT JOIN market_products p ON ol.product_id = p.id
      WHERE o.company_id = $1
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
        ${posTerminalFilter}
      GROUP BY p.category
      ORDER BY sales DESC
    `, params)

    // Sales by terminal
    const byTerminalResult = await db.query(`
      SELECT
        t.id as terminal_id,
        t.name as terminal_name,
        t.code as terminal_code,
        COALESCE(SUM(o.total_amount), 0) as sales,
        COUNT(o.id) as orders,
        COALESCE(AVG(o.total_amount), 0) as average_ticket
      FROM market_pos_terminals t
      LEFT JOIN market_pos_orders o ON t.id = o.pos_terminal_id
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
      WHERE t.company_id = $1 AND t.is_active = true
      GROUP BY t.id, t.name, t.code
      ORDER BY sales DESC
    `, [companyId, startDate, endDate])

    // Sales by payment method
    const byPaymentResult = await db.query(`
      SELECT
        COALESCE(pm.payment_method, 'efectivo') as payment_method,
        COALESCE(pm.currency, 'USD') as currency,
        COUNT(DISTINCT o.id) as orders,
        COALESCE(SUM(pm.amount), 0) as amount
      FROM market_pos_orders o
      LEFT JOIN market_pos_payments pm ON o.id = pm.order_id
      WHERE o.company_id = $1
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
        ${posTerminalFilter}
      GROUP BY pm.payment_method, pm.currency
      ORDER BY amount DESC
    `, params)

    // Sales by hour of day
    const byHourResult = await db.query(`
      SELECT
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0) as sales
      FROM market_pos_orders o
      WHERE o.company_id = $1
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
        ${posTerminalFilter}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, params)

    return NextResponse.json({
      success: true,
      data: {
        filters: {
          startDate,
          endDate,
          period,
          terminalId: terminalId ? parseInt(terminalId) : null,
          categoryId: categoryId ? parseInt(categoryId) : null,
          currency
        },
        summary: {
          totalSales: currentSales,
          totalOrders: parseInt(summaryResult.rows[0]?.total_orders) || 0,
          averageTicket: parseFloat(summaryResult.rows[0]?.average_ticket) || 0,
          daysWithSales: parseInt(summaryResult.rows[0]?.days_with_sales) || 0,
          comparison: {
            previousPeriodSales: prevSales,
            percentChange: Math.round(percentChange * 100) / 100
          }
        },
        byPeriod: byPeriodResult.rows.map(row => ({
          date: row.date,
          sales: parseFloat(row.sales) || 0,
          orders: parseInt(row.orders) || 0
        })),
        byProduct: byProductResult.rows.map(row => ({
          productId: row.product_id,
          productName: row.product_name,
          quantity: parseFloat(row.quantity) || 0,
          sales: parseFloat(row.sales) || 0,
          orderCount: parseInt(row.order_count) || 0,
          percentage: totalProductSales > 0 ? Math.round((parseFloat(row.sales) / totalProductSales) * 10000) / 100 : 0
        })),
        byCategory: byCategoryResult.rows.map(row => ({
          categoryName: row.category_name,
          sales: parseFloat(row.sales) || 0,
          quantity: parseFloat(row.quantity) || 0,
          orderCount: parseInt(row.order_count) || 0,
          percentage: currentSales > 0 ? Math.round((parseFloat(row.sales) / currentSales) * 10000) / 100 : 0
        })),
        byTerminal: byTerminalResult.rows.map(row => ({
          terminalId: row.terminal_id,
          terminalName: row.terminal_name,
          terminalCode: row.terminal_code,
          sales: parseFloat(row.sales) || 0,
          orders: parseInt(row.orders) || 0,
          averageTicket: parseFloat(row.average_ticket) || 0
        })),
        byPaymentMethod: byPaymentResult.rows.map(row => ({
          paymentMethod: row.payment_method,
          currency: row.currency,
          orders: parseInt(row.orders) || 0,
          amount: parseFloat(row.amount) || 0
        })),
        byHour: byHourResult.rows.map(row => ({
          hour: parseInt(row.hour),
          orders: parseInt(row.orders) || 0,
          sales: parseFloat(row.sales) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Sales Report API] Error:', error)
    console.error('[Sales Report API] Stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener reporte de ventas',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}
