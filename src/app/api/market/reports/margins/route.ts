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
 * Returns margin analysis by product and category
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

    // Margin by product (using actual sales data with FIFO cost)
    const byProductResult = await db.query(`
      WITH product_sales AS (
        SELECT
          ol.product_id,
          COALESCE(ol.product_name, p.name, 'Producto') as product_name,
          p.category,
          p.cost_price,
          p.selling_price,
          SUM(ol.quantity) as quantity_sold,
          SUM(ol.total) as total_revenue,
          SUM(ol.quantity * COALESCE(p.cost_price, 0)) as total_cost
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        LEFT JOIN market_products p ON ol.product_id = p.id
        WHERE o.company_id = $1
          AND o.status IN ('paid', 'completed')
          AND DATE(o.created_at) BETWEEN $2 AND $3
        GROUP BY ol.product_id, ol.product_name, p.name, p.category, p.cost_price, p.selling_price
      )
      SELECT
        product_id,
        product_name,
        category,
        cost_price,
        selling_price,
        quantity_sold,
        total_revenue,
        total_cost,
        (total_revenue - total_cost) as gross_profit,
        CASE WHEN total_revenue > 0
          THEN ((total_revenue - total_cost) / total_revenue) * 100
          ELSE 0
        END as margin_percent
      FROM product_sales
      ORDER BY gross_profit DESC
    `, [companyId, startDate, endDate])

    // Summary totals
    const totalRevenue = byProductResult.rows.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0)
    const totalCost = byProductResult.rows.reduce((sum, row) => sum + parseFloat(row.total_cost || 0), 0)
    const grossProfit = totalRevenue - totalCost
    const averageMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    // Margin by category
    const byCategoryResult = await db.query(`
      SELECT
        COALESCE(p.category, 'Sin categoría') as category_name,
        SUM(ol.total) as total_revenue,
        SUM(ol.quantity * COALESCE(p.cost_price, 0)) as total_cost,
        SUM(ol.total) - SUM(ol.quantity * COALESCE(p.cost_price, 0)) as gross_profit,
        CASE WHEN SUM(ol.total) > 0
          THEN ((SUM(ol.total) - SUM(ol.quantity * COALESCE(p.cost_price, 0))) / SUM(ol.total)) * 100
          ELSE 0
        END as margin_percent,
        COUNT(DISTINCT ol.product_id) as product_count
      FROM market_pos_order_lines ol
      JOIN market_pos_orders o ON ol.order_id = o.id
      LEFT JOIN market_products p ON ol.product_id = p.id
      WHERE o.company_id = $1
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
      GROUP BY p.category
      ORDER BY gross_profit DESC
    `, [companyId, startDate, endDate])

    // Margin trend by month
    const trendResult = await db.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', o.created_at), 'YYYY-MM') as month,
        SUM(ol.total) as revenue,
        SUM(ol.quantity * COALESCE(p.cost_price, 0)) as cost,
        SUM(ol.total) - SUM(ol.quantity * COALESCE(p.cost_price, 0)) as profit,
        CASE WHEN SUM(ol.total) > 0
          THEN ((SUM(ol.total) - SUM(ol.quantity * COALESCE(p.cost_price, 0))) / SUM(ol.total)) * 100
          ELSE 0
        END as margin_percent
      FROM market_pos_order_lines ol
      JOIN market_pos_orders o ON ol.order_id = o.id
      LEFT JOIN market_products p ON ol.product_id = p.id
      WHERE o.company_id = $1
        AND o.status IN ('paid', 'completed')
        AND o.created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', o.created_at)
      ORDER BY month ASC
    `, [companyId])

    // Low margin products (below 15%)
    const lowMarginProducts = byProductResult.rows.filter(row =>
      parseFloat(row.margin_percent) < 15 && parseFloat(row.quantity_sold) > 0
    )

    // High margin products (above 40%)
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
          productCount: byProductResult.rows.length,
          lowMarginCount: lowMarginProducts.length,
          highMarginCount: highMarginProducts.length
        },
        byProduct: byProductResult.rows.map(row => ({
          productId: row.product_id,
          productName: row.product_name,
          category: row.category || 'Sin categoría',
          costPrice: parseFloat(row.cost_price) || 0,
          sellingPrice: parseFloat(row.selling_price) || 0,
          quantitySold: parseFloat(row.quantity_sold) || 0,
          totalRevenue: parseFloat(row.total_revenue) || 0,
          totalCost: parseFloat(row.total_cost) || 0,
          grossProfit: parseFloat(row.gross_profit) || 0,
          marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100
        })),
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
