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
 * GET /api/market/reports/margins/lots
 * Returns cost variations for a specific product
 * Groups sales ONLY by cost_price to show different purchase costs
 * If all sales have the same cost, returns 1 entry
 * Query params: productId, startDate, endDate
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

    const productId = searchParams.get('productId')
    const startDate = searchParams.get('startDate') || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]

    if (!productId) {
      return NextResponse.json({ success: false, error: 'productId es requerido' }, { status: 400 })
    }

    // Get POS sales grouped ONLY by cost price (with fallback to product cost)
    const posResult = await db.query(`
      SELECT
        COALESCE(ol.cost_price, p.cost_price, 0) as unit_cost,
        SUM(ol.quantity) as quantity,
        SUM(ol.total) as revenue,
        SUM(ol.quantity * COALESCE(ol.cost_price, p.cost_price, 0)) as cost,
        SUM(ol.total) - SUM(ol.quantity * COALESCE(ol.cost_price, p.cost_price, 0)) as profit,
        CASE WHEN SUM(ol.total) > 0
          THEN ((SUM(ol.total) - SUM(ol.quantity * COALESCE(ol.cost_price, p.cost_price, 0))) / SUM(ol.total)) * 100
          ELSE 0
        END as margin_percent,
        COUNT(DISTINCT o.id) as order_count,
        SUM(ol.quantity) as units_sold
      FROM market_pos_order_lines ol
      JOIN market_pos_orders o ON ol.order_id = o.id
      LEFT JOIN market_products p ON ol.product_id = p.id
      WHERE o.company_id = $1
        AND ol.product_id = $2
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $3 AND $4
      GROUP BY COALESCE(ol.cost_price, p.cost_price, 0)
      ORDER BY SUM(ol.total) DESC
    `, [companyId, productId, startDate, endDate])

    // Get wholesale sales grouped ONLY by cost price
    const wholesaleResult = await db.query(`
      SELECT
        COALESCE(il.cost_price, p.cost_price, 0) as unit_cost,
        SUM(il.quantity) as quantity,
        SUM(il.subtotal) as revenue,
        SUM(il.quantity * COALESCE(il.cost_price, p.cost_price, 0)) as cost,
        SUM(il.subtotal) - SUM(il.quantity * COALESCE(il.cost_price, p.cost_price, 0)) as profit,
        CASE WHEN SUM(il.subtotal) > 0
          THEN ((SUM(il.subtotal) - SUM(il.quantity * COALESCE(il.cost_price, p.cost_price, 0))) / SUM(il.subtotal)) * 100
          ELSE 0
        END as margin_percent,
        COUNT(DISTINCT i.id) as order_count,
        SUM(il.quantity) as units_sold
      FROM market_invoice_lines il
      JOIN market_invoices i ON il.invoice_id = i.id
      LEFT JOIN market_products p ON il.product_id = p.id
      WHERE i.company_id = $1
        AND il.product_id = $2
        AND i.status NOT IN ('cancelled', 'draft')
        AND DATE(i.created_at) BETWEEN $3 AND $4
      GROUP BY COALESCE(il.cost_price, p.cost_price, 0)
      ORDER BY SUM(il.subtotal) DESC
    `, [companyId, productId, startDate, endDate])

    // Map results to a unified format - simple cost variations
    const posCostVariations = posResult.rows.map((row) => {
      const unitCost = parseFloat(row.unit_cost) || 0
      return {
        unitCost,
        label: unitCost > 0 ? `$${unitCost.toFixed(2)}` : 'Sin costo',
        quantity: parseFloat(row.quantity) || 0,
        revenue: parseFloat(row.revenue) || 0,
        cost: parseFloat(row.cost) || 0,
        profit: parseFloat(row.profit) || 0,
        marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100,
        orderCount: parseInt(row.order_count) || 0,
        channel: 'POS'
      }
    })

    const wholesaleCostVariations = wholesaleResult.rows.map((row) => {
      const unitCost = parseFloat(row.unit_cost) || 0
      return {
        unitCost,
        label: unitCost > 0 ? `$${unitCost.toFixed(2)}` : 'Sin costo',
        quantity: parseFloat(row.quantity) || 0,
        revenue: parseFloat(row.revenue) || 0,
        cost: parseFloat(row.cost) || 0,
        profit: parseFloat(row.profit) || 0,
        marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100,
        orderCount: parseInt(row.order_count) || 0,
        channel: 'Mayoreo'
      }
    })

    // Combine and sort by revenue
    const allVariations = [...posCostVariations, ...wholesaleCostVariations].sort((a, b) => b.revenue - a.revenue)

    // Calculate totals
    const totals = allVariations.reduce((acc, v) => ({
      quantity: acc.quantity + v.quantity,
      revenue: acc.revenue + v.revenue,
      cost: acc.cost + v.cost,
      profit: acc.profit + v.profit,
      orderCount: acc.orderCount + v.orderCount
    }), { quantity: 0, revenue: 0, cost: 0, profit: 0, orderCount: 0 })

    return NextResponse.json({
      success: true,
      data: {
        productId: parseInt(productId),
        filters: { startDate, endDate },
        costVariations: allVariations,
        totals: {
          ...totals,
          marginPercent: totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 10000) / 100 : 0
        },
        variationCount: allVariations.length
      }
    })

  } catch (error) {
    console.error('[Margins Lots API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener variaciones de costo'
    }, { status: 500 })
  }
}
