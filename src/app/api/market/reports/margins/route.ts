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
 * GET /api/market/reports/margins
 * Returns margin analysis by product and category using HISTORICAL lot costs
 * Query params: startDate, endDate, categoryId, page, limit
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = (page - 1) * limit

    // Combined query for POS + Wholesale using HISTORICAL cost_price from order lines
    // Falls back to product.cost_price if order line cost is NULL
    const byProductResult = await db.query(`
      WITH pos_sales AS (
        SELECT
          ol.product_id,
          COALESCE(ol.product_name, p.name, 'Producto') as product_name,
          COALESCE(p.category, 'Sin categoría') as category,
          COALESCE(ol.cost_price, p.cost_price) as historical_cost,
          ol.quantity,
          ol.total as revenue,
          ol.quantity * COALESCE(ol.cost_price, p.cost_price, 0) as total_cost
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        LEFT JOIN market_products p ON ol.product_id = p.id
        WHERE o.company_id = $1
          AND o.status IN ('paid', 'completed')
          AND DATE(o.created_at) BETWEEN $2 AND $3
      ),
      wholesale_sales AS (
        SELECT
          il.product_id,
          COALESCE(il.product_name, p.name, 'Producto') as product_name,
          COALESCE(p.category, 'Sin categoría') as category,
          COALESCE(il.cost_price, p.cost_price) as historical_cost,
          il.quantity,
          il.subtotal as revenue,
          il.quantity * COALESCE(il.cost_price, p.cost_price, 0) as total_cost
        FROM market_invoice_lines il
        JOIN market_invoices i ON il.invoice_id = i.id
        LEFT JOIN market_products p ON il.product_id = p.id
        WHERE i.company_id = $1
          AND i.status NOT IN ('cancelled', 'draft')
          AND DATE(i.created_at) BETWEEN $2 AND $3
      ),
      combined AS (
        SELECT * FROM pos_sales
        UNION ALL
        SELECT * FROM wholesale_sales
      ),
      aggregated AS (
        SELECT
          product_id,
          product_name,
          category,
          SUM(quantity) as quantity_sold,
          SUM(revenue) as total_revenue,
          SUM(total_cost) as total_cost,
          SUM(revenue) - SUM(total_cost) as gross_profit,
          CASE WHEN SUM(revenue) > 0
            THEN ((SUM(revenue) - SUM(total_cost)) / SUM(revenue)) * 100
            ELSE 0
          END as margin_percent,
          COUNT(DISTINCT historical_cost) as cost_variation_count
        FROM combined
        WHERE product_id IS NOT NULL
        GROUP BY product_id, product_name, category
      )
      SELECT *, COUNT(*) OVER() as total_count
      FROM aggregated
      ORDER BY gross_profit DESC
      LIMIT $4 OFFSET $5
    `, [companyId, startDate, endDate, limit, offset])

    const totalCount = parseInt(byProductResult.rows[0]?.total_count || '0')
    const totalPages = Math.ceil(totalCount / limit)

    // Summary totals (without pagination)
    const summaryResult = await db.query(`
      WITH pos_sales AS (
        SELECT
          ol.quantity,
          ol.total as revenue,
          ol.quantity * COALESCE(ol.cost_price, p.cost_price, 0) as total_cost
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        LEFT JOIN market_products p ON ol.product_id = p.id
        WHERE o.company_id = $1
          AND o.status IN ('paid', 'completed')
          AND DATE(o.created_at) BETWEEN $2 AND $3
      ),
      wholesale_sales AS (
        SELECT
          il.quantity,
          il.subtotal as revenue,
          il.quantity * COALESCE(il.cost_price, p.cost_price, 0) as total_cost
        FROM market_invoice_lines il
        JOIN market_invoices i ON il.invoice_id = i.id
        LEFT JOIN market_products p ON il.product_id = p.id
        WHERE i.company_id = $1
          AND i.status NOT IN ('cancelled', 'draft')
          AND DATE(i.created_at) BETWEEN $2 AND $3
      ),
      combined AS (
        SELECT * FROM pos_sales
        UNION ALL
        SELECT * FROM wholesale_sales
      )
      SELECT
        SUM(revenue) as total_revenue,
        SUM(total_cost) as total_cost,
        SUM(revenue) - SUM(total_cost) as gross_profit
      FROM combined
    `, [companyId, startDate, endDate])

    const totalRevenue = parseFloat(summaryResult.rows[0]?.total_revenue || 0)
    const totalCost = parseFloat(summaryResult.rows[0]?.total_cost || 0)
    const grossProfit = totalRevenue - totalCost
    const averageMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    // Margin by category using historical costs
    const byCategoryResult = await db.query(`
      WITH pos_sales AS (
        SELECT
          COALESCE(p.category, 'Sin categoría') as category,
          ol.product_id,
          ol.total as revenue,
          ol.quantity * COALESCE(ol.cost_price, p.cost_price, 0) as total_cost
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        LEFT JOIN market_products p ON ol.product_id = p.id
        WHERE o.company_id = $1
          AND o.status IN ('paid', 'completed')
          AND DATE(o.created_at) BETWEEN $2 AND $3
      ),
      wholesale_sales AS (
        SELECT
          COALESCE(p.category, 'Sin categoría') as category,
          il.product_id,
          il.subtotal as revenue,
          il.quantity * COALESCE(il.cost_price, p.cost_price, 0) as total_cost
        FROM market_invoice_lines il
        JOIN market_invoices i ON il.invoice_id = i.id
        LEFT JOIN market_products p ON il.product_id = p.id
        WHERE i.company_id = $1
          AND i.status NOT IN ('cancelled', 'draft')
          AND DATE(i.created_at) BETWEEN $2 AND $3
      ),
      combined AS (
        SELECT * FROM pos_sales
        UNION ALL
        SELECT * FROM wholesale_sales
      )
      SELECT
        category as category_name,
        SUM(revenue) as total_revenue,
        SUM(total_cost) as total_cost,
        SUM(revenue) - SUM(total_cost) as gross_profit,
        CASE WHEN SUM(revenue) > 0
          THEN ((SUM(revenue) - SUM(total_cost)) / SUM(revenue)) * 100
          ELSE 0
        END as margin_percent,
        COUNT(DISTINCT product_id) as product_count
      FROM combined
      GROUP BY category
      ORDER BY gross_profit DESC
    `, [companyId, startDate, endDate])

    // Margin trend by month using historical costs
    const trendResult = await db.query(`
      WITH pos_sales AS (
        SELECT
          DATE_TRUNC('month', o.created_at) as month,
          ol.total as revenue,
          ol.quantity * COALESCE(ol.cost_price, p.cost_price, 0) as cost
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        LEFT JOIN market_products p ON ol.product_id = p.id
        WHERE o.company_id = $1
          AND o.status IN ('paid', 'completed')
          AND o.created_at >= CURRENT_DATE - INTERVAL '12 months'
      ),
      wholesale_sales AS (
        SELECT
          DATE_TRUNC('month', i.created_at) as month,
          il.subtotal as revenue,
          il.quantity * COALESCE(il.cost_price, p.cost_price, 0) as cost
        FROM market_invoice_lines il
        JOIN market_invoices i ON il.invoice_id = i.id
        LEFT JOIN market_products p ON il.product_id = p.id
        WHERE i.company_id = $1
          AND i.status NOT IN ('cancelled', 'draft')
          AND i.created_at >= CURRENT_DATE - INTERVAL '12 months'
      ),
      combined AS (
        SELECT * FROM pos_sales
        UNION ALL
        SELECT * FROM wholesale_sales
      )
      SELECT
        TO_CHAR(month, 'YYYY-MM') as month,
        SUM(revenue) as revenue,
        SUM(cost) as cost,
        SUM(revenue) - SUM(cost) as profit,
        CASE WHEN SUM(revenue) > 0
          THEN ((SUM(revenue) - SUM(cost)) / SUM(revenue)) * 100
          ELSE 0
        END as margin_percent
      FROM combined
      GROUP BY month
      ORDER BY month ASC
    `, [companyId])

    // Low margin products (below 15%) - from current page results
    const lowMarginProducts = byProductResult.rows.filter(row =>
      parseFloat(row.margin_percent) < 15 && parseFloat(row.quantity_sold) > 0
    )

    // High margin products (above 40%) - from current page results
    const highMarginProducts = byProductResult.rows.filter(row =>
      parseFloat(row.margin_percent) > 40 && parseFloat(row.quantity_sold) > 0
    )

    return NextResponse.json({
      success: true,
      data: {
        filters: {
          startDate,
          endDate,
          categoryId: categoryId ? parseInt(categoryId) : null
        },
        summary: {
          totalRevenue,
          totalCost,
          grossProfit,
          averageMargin: Math.round(averageMargin * 100) / 100,
          productCount: totalCount,
          lowMarginCount: lowMarginProducts.length,
          highMarginCount: highMarginProducts.length
        },
        byProduct: byProductResult.rows.map(row => ({
          productId: row.product_id,
          productName: row.product_name,
          category: row.category || 'Sin categoría',
          quantitySold: parseFloat(row.quantity_sold) || 0,
          totalRevenue: parseFloat(row.total_revenue) || 0,
          totalCost: parseFloat(row.total_cost) || 0,
          grossProfit: parseFloat(row.gross_profit) || 0,
          marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100,
          costVariationCount: parseInt(row.cost_variation_count) || 0
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages
        },
        byCategory: byCategoryResult.rows.map(row => ({
          categoryName: row.category_name,
          totalRevenue: parseFloat(row.total_revenue) || 0,
          totalCost: parseFloat(row.total_cost) || 0,
          grossProfit: parseFloat(row.gross_profit) || 0,
          marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100,
          productCount: parseInt(row.product_count) || 0
        })),
        trend: trendResult.rows.map(row => ({
          month: row.month,
          revenue: parseFloat(row.revenue) || 0,
          cost: parseFloat(row.cost) || 0,
          profit: parseFloat(row.profit) || 0,
          marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100
        })),
        alerts: {
          lowMargin: lowMarginProducts.slice(0, 10).map(row => ({
            productId: row.product_id,
            productName: row.product_name,
            marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100,
            quantitySold: parseFloat(row.quantity_sold) || 0
          })),
          highMargin: highMarginProducts.slice(0, 10).map(row => ({
            productId: row.product_id,
            productName: row.product_name,
            marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100,
            quantitySold: parseFloat(row.quantity_sold) || 0
          }))
        }
      }
    })

  } catch (error) {
    console.error('[Margins Report API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener reporte de márgenes'
    }, { status: 500 })
  }
}
