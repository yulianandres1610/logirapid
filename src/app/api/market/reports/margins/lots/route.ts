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
 * Returns cost-level breakdown for a specific product
 * Groups sales by cost_price to show different purchase prices
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

    // Get POS sales grouped by cost price (simpler approach - no inventory table joins)
    const posResult = await db.query(`
      SELECT
        ol.cost_price as unit_cost,
        ol.unit_price,
        ol.is_consignment,
        ol.lot_id,
        SUM(ol.quantity) as quantity,
        SUM(ol.total) as revenue,
        SUM(ol.quantity * COALESCE(ol.cost_price, 0)) as cost,
        SUM(ol.total) - SUM(ol.quantity * COALESCE(ol.cost_price, 0)) as profit,
        CASE WHEN SUM(ol.total) > 0
          THEN ((SUM(ol.total) - SUM(ol.quantity * COALESCE(ol.cost_price, 0))) / SUM(ol.total)) * 100
          ELSE 0
        END as margin_percent,
        COUNT(DISTINCT o.id) as order_count,
        MIN(o.created_at) as first_sale,
        MAX(o.created_at) as last_sale
      FROM market_pos_order_lines ol
      JOIN market_pos_orders o ON ol.order_id = o.id
      WHERE o.company_id = $1
        AND ol.product_id = $2
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $3 AND $4
      GROUP BY ol.cost_price, ol.unit_price, ol.is_consignment, ol.lot_id
      ORDER BY SUM(ol.total) DESC
    `, [companyId, productId, startDate, endDate])

    // Get wholesale sales grouped by cost price
    const wholesaleResult = await db.query(`
      SELECT
        il.cost_price as unit_cost,
        il.unit_price,
        false as is_consignment,
        NULL::integer as lot_id,
        SUM(il.quantity) as quantity,
        SUM(il.subtotal) as revenue,
        SUM(il.quantity * COALESCE(il.cost_price, 0)) as cost,
        SUM(il.subtotal) - SUM(il.quantity * COALESCE(il.cost_price, 0)) as profit,
        CASE WHEN SUM(il.subtotal) > 0
          THEN ((SUM(il.subtotal) - SUM(il.quantity * COALESCE(il.cost_price, 0))) / SUM(il.subtotal)) * 100
          ELSE 0
        END as margin_percent,
        COUNT(DISTINCT i.id) as order_count,
        MIN(i.created_at) as first_sale,
        MAX(i.created_at) as last_sale
      FROM market_invoice_lines il
      JOIN market_invoices i ON il.invoice_id = i.id
      WHERE i.company_id = $1
        AND il.product_id = $2
        AND i.status NOT IN ('cancelled', 'draft')
        AND DATE(i.created_at) BETWEEN $3 AND $4
      GROUP BY il.cost_price, il.unit_price
      ORDER BY SUM(il.subtotal) DESC
    `, [companyId, productId, startDate, endDate])

    // Map results to a unified format
    const posLots = posResult.rows.map((row, idx) => {
      const unitCost = parseFloat(row.unit_cost) || 0
      const isConsignment = row.is_consignment === true
      const lotId = row.lot_id

      // Determine source and label
      let lotSource: string
      let lotNumber: string

      if (isConsignment) {
        lotSource = 'consignment'
        lotNumber = lotId ? `CONS-${lotId}` : `CONSIGNACION-${idx + 1}`
      } else if (lotId) {
        lotSource = 'purchase'
        lotNumber = `COMPRA-${lotId}`
      } else {
        lotSource = 'direct'
        lotNumber = unitCost > 0 ? `COSTO-$${unitCost.toFixed(2)}` : 'SIN-COSTO'
      }

      return {
        lotId,
        lotNumber,
        lotSource,
        isConsignment,
        supplierName: null,
        unitCost,
        unitPrice: parseFloat(row.unit_price) || 0,
        quantity: parseFloat(row.quantity) || 0,
        revenue: parseFloat(row.revenue) || 0,
        cost: parseFloat(row.cost) || 0,
        profit: parseFloat(row.profit) || 0,
        marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100,
        orderCount: parseInt(row.order_count) || 0,
        channel: 'POS'
      }
    })

    const wholesaleLots = wholesaleResult.rows.map((row, idx) => ({
      lotId: null,
      lotNumber: `MAYOREO-${idx + 1}`,
      lotSource: 'wholesale',
      isConsignment: false,
      supplierName: null,
      unitCost: parseFloat(row.unit_cost) || 0,
      unitPrice: parseFloat(row.unit_price) || 0,
      quantity: parseFloat(row.quantity) || 0,
      revenue: parseFloat(row.revenue) || 0,
      cost: parseFloat(row.cost) || 0,
      profit: parseFloat(row.profit) || 0,
      marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100,
      orderCount: parseInt(row.order_count) || 0,
      channel: 'Mayoreo'
    }))

    // Combine and sort by revenue
    const allLots = [...posLots, ...wholesaleLots].sort((a, b) => b.revenue - a.revenue)

    // Calculate totals
    const totals = allLots.reduce((acc, lot) => ({
      quantity: acc.quantity + lot.quantity,
      revenue: acc.revenue + lot.revenue,
      cost: acc.cost + lot.cost,
      profit: acc.profit + lot.profit,
      orderCount: acc.orderCount + lot.orderCount
    }), { quantity: 0, revenue: 0, cost: 0, profit: 0, orderCount: 0 })

    return NextResponse.json({
      success: true,
      data: {
        productId: parseInt(productId),
        filters: { startDate, endDate },
        lots: allLots,
        totals: {
          ...totals,
          marginPercent: totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 10000) / 100 : 0
        },
        lotCount: allLots.length
      }
    })

  } catch (error) {
    console.error('[Margins Lots API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener detalle de lotes'
    }, { status: 500 })
  }
}
