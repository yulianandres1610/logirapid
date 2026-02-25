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
 * Returns lot-level margin breakdown for a specific product
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

    // Get lot-level breakdown for POS sales
    const lotsResult = await db.query(`
      WITH lot_sales AS (
        SELECT
          ol.lot_id,
          ol.is_consignment,
          ol.cost_price as unit_cost,
          ol.unit_price,
          SUM(ol.quantity) as quantity,
          SUM(ol.total) as revenue,
          SUM(ol.quantity * COALESCE(ol.cost_price, 0)) as cost,
          SUM(ol.total) - SUM(ol.quantity * COALESCE(ol.cost_price, 0)) as profit
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        WHERE o.company_id = $1
          AND ol.product_id = $2
          AND o.status IN ('paid', 'completed')
          AND DATE(o.created_at) BETWEEN $3 AND $4
        GROUP BY ol.lot_id, ol.is_consignment, ol.cost_price, ol.unit_price
      )
      SELECT
        ls.lot_id,
        ls.is_consignment,
        ls.unit_cost,
        ls.unit_price,
        ls.quantity,
        ls.revenue,
        ls.cost,
        ls.profit,
        CASE WHEN ls.revenue > 0
          THEN ((ls.revenue - ls.cost) / ls.revenue) * 100
          ELSE 0
        END as margin_percent,
        -- Try to get lot number from consignment inventory
        COALESCE(
          cli.lot_number,
          pli.lot_number,
          prli.lot_number,
          CASE WHEN ls.lot_id IS NOT NULL THEN 'LOT-' || ls.lot_id ELSE 'SIN-LOTE' END
        ) as lot_number,
        -- Determine lot source
        CASE
          WHEN cli.id IS NOT NULL THEN 'consignment'
          WHEN pli.id IS NOT NULL THEN 'purchase'
          WHEN prli.id IS NOT NULL THEN 'production'
          WHEN ls.lot_id IS NULL THEN 'direct'
          ELSE 'unknown'
        END as lot_source,
        -- Get supplier name for consignment
        COALESCE(s.business_name, s.contact_name) as supplier_name
      FROM lot_sales ls
      LEFT JOIN consignment_lot_inventory cli ON ls.lot_id = cli.id AND ls.is_consignment = true
      LEFT JOIN purchase_lot_inventory pli ON ls.lot_id = pli.id AND (ls.is_consignment = false OR ls.is_consignment IS NULL)
      LEFT JOIN production_lot_inventory prli ON ls.lot_id = prli.id
      LEFT JOIN market_suppliers s ON cli.supplier_id = s.id
      ORDER BY ls.revenue DESC
    `, [companyId, productId, startDate, endDate])

    // Get wholesale sales (no lot tracking, grouped by cost price)
    const wholesaleResult = await db.query(`
      SELECT
        NULL::integer as lot_id,
        false as is_consignment,
        il.cost_price as unit_cost,
        il.unit_price,
        SUM(il.quantity) as quantity,
        SUM(il.subtotal) as revenue,
        SUM(il.quantity * COALESCE(il.cost_price, 0)) as cost,
        SUM(il.subtotal) - SUM(il.quantity * COALESCE(il.cost_price, 0)) as profit,
        CASE WHEN SUM(il.subtotal) > 0
          THEN ((SUM(il.subtotal) - SUM(il.quantity * COALESCE(il.cost_price, 0))) / SUM(il.subtotal)) * 100
          ELSE 0
        END as margin_percent,
        'MAYOREO' as lot_number,
        'wholesale' as lot_source,
        NULL as supplier_name
      FROM market_invoice_lines il
      JOIN market_wholesale_invoices i ON il.invoice_id = i.id
      WHERE i.companyid = $1
        AND il.product_id = $2
        AND i.status NOT IN ('cancelled', 'draft')
        AND DATE(i.createdat) BETWEEN $3 AND $4
      GROUP BY il.cost_price, il.unit_price
    `, [companyId, productId, startDate, endDate])

    // Combine POS and wholesale results
    const allLots = [
      ...lotsResult.rows.map(row => ({
        lotId: row.lot_id,
        lotNumber: row.lot_number,
        lotSource: row.lot_source as 'consignment' | 'purchase' | 'production' | 'direct' | 'wholesale' | 'unknown',
        isConsignment: row.is_consignment,
        supplierName: row.supplier_name,
        unitCost: parseFloat(row.unit_cost) || 0,
        unitPrice: parseFloat(row.unit_price) || 0,
        quantity: parseFloat(row.quantity) || 0,
        revenue: parseFloat(row.revenue) || 0,
        cost: parseFloat(row.cost) || 0,
        profit: parseFloat(row.profit) || 0,
        marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100
      })),
      ...wholesaleResult.rows.map(row => ({
        lotId: null,
        lotNumber: row.lot_number,
        lotSource: row.lot_source as 'consignment' | 'purchase' | 'production' | 'direct' | 'wholesale' | 'unknown',
        isConsignment: false,
        supplierName: null,
        unitCost: parseFloat(row.unit_cost) || 0,
        unitPrice: parseFloat(row.unit_price) || 0,
        quantity: parseFloat(row.quantity) || 0,
        revenue: parseFloat(row.revenue) || 0,
        cost: parseFloat(row.cost) || 0,
        profit: parseFloat(row.profit) || 0,
        marginPercent: Math.round(parseFloat(row.margin_percent) * 100) / 100
      }))
    ].sort((a, b) => b.revenue - a.revenue)

    // Calculate totals
    const totals = allLots.reduce((acc, lot) => ({
      quantity: acc.quantity + lot.quantity,
      revenue: acc.revenue + lot.revenue,
      cost: acc.cost + lot.cost,
      profit: acc.profit + lot.profit
    }), { quantity: 0, revenue: 0, cost: 0, profit: 0 })

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
