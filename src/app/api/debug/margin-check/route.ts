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
 * GET /api/debug/margin-check?productName=Gustatini
 * Debug endpoint to check margin calculation for specific products
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
    const productName = searchParams.get('productName') || ''
    const today = new Date().toISOString().split('T')[0]

    // 1. Check product data
    const productsResult = await db.query(`
      SELECT id, name, sku, cost_price, selling_price,
        CASE WHEN selling_price > 0
          THEN ((selling_price - COALESCE(cost_price, 0)) / selling_price) * 100
          ELSE 0
        END as theoretical_margin
      FROM market_products
      WHERE company_id = $1
        AND LOWER(name) LIKE LOWER($2)
      LIMIT 10
    `, [companyId, `%${productName}%`])

    // 2. Check POS order lines for today with these products
    const posLinesResult = await db.query(`
      SELECT
        ol.id as line_id,
        ol.product_id,
        ol.product_name,
        ol.quantity,
        ol.unit_price,
        ol.cost_price as line_cost_price,
        ol.total as line_total,
        o.order_number,
        o.created_at,
        p.cost_price as product_cost_price,
        p.selling_price as product_selling_price
      FROM market_pos_order_lines ol
      JOIN market_pos_orders o ON ol.order_id = o.id
      LEFT JOIN market_products p ON ol.product_id = p.id
      WHERE o.company_id = $1
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) = $2
        AND LOWER(ol.product_name) LIKE LOWER($3)
      ORDER BY o.created_at DESC
      LIMIT 20
    `, [companyId, today, `%${productName}%`])

    // 3. Check invoice lines for today with these products
    const invoiceLinesResult = await db.query(`
      SELECT
        il.id as line_id,
        il.product_id,
        il.product_name,
        il.quantity,
        il.unit_price,
        il.cost_price as line_cost_price,
        il.subtotal as line_subtotal,
        i.invoice_number,
        i.created_at,
        p.cost_price as product_cost_price,
        p.selling_price as product_selling_price
      FROM market_invoice_lines il
      JOIN market_invoices i ON il.invoice_id = i.id
      LEFT JOIN market_products p ON il.product_id = p.id
      WHERE i.company_id = $1
        AND i.status NOT IN ('cancelled', 'draft')
        AND DATE(i.created_at) = $2
        AND LOWER(il.product_name) LIKE LOWER($3)
      ORDER BY i.created_at DESC
      LIMIT 20
    `, [companyId, today, `%${productName}%`])

    // 4. Check purchase lot inventory for these products
    const purchaseLotsResult = await db.query(`
      SELECT
        pli.id,
        pli.product_id,
        p.name as product_name,
        pli.unit_cost,
        pli.quantity_available,
        pli.quantity_sold,
        pli.received_at
      FROM purchase_lot_inventory pli
      JOIN market_products p ON pli.product_id = p.id
      WHERE pli.company_id = $1
        AND LOWER(p.name) LIKE LOWER($2)
      ORDER BY pli.received_at DESC
      LIMIT 10
    `, [companyId, `%${productName}%`])

    // 5. Calculate what the margin report would show
    const marginCalcResult = await db.query(`
      WITH pos_sales AS (
        SELECT
          ol.product_id,
          ol.product_name,
          COALESCE(ol.cost_price, p.cost_price, 0) as effective_cost,
          ol.quantity,
          ol.total as revenue,
          ol.quantity * COALESCE(ol.cost_price, p.cost_price, 0) as total_cost,
          'POS' as source
        FROM market_pos_order_lines ol
        JOIN market_pos_orders o ON ol.order_id = o.id
        LEFT JOIN market_products p ON ol.product_id = p.id
        WHERE o.company_id = $1
          AND o.status IN ('paid', 'completed')
          AND DATE(o.created_at) = $2
          AND LOWER(ol.product_name) LIKE LOWER($3)
      ),
      wholesale_sales AS (
        SELECT
          il.product_id,
          il.product_name,
          COALESCE(il.cost_price, p.cost_price, 0) as effective_cost,
          il.quantity,
          il.subtotal as revenue,
          il.quantity * COALESCE(il.cost_price, p.cost_price, 0) as total_cost,
          'Wholesale' as source
        FROM market_invoice_lines il
        JOIN market_invoices i ON il.invoice_id = i.id
        LEFT JOIN market_products p ON il.product_id = p.id
        WHERE i.company_id = $1
          AND i.status NOT IN ('cancelled', 'draft')
          AND DATE(i.created_at) = $2
          AND LOWER(il.product_name) LIKE LOWER($3)
      )
      SELECT * FROM pos_sales
      UNION ALL
      SELECT * FROM wholesale_sales
    `, [companyId, today, `%${productName}%`])

    return NextResponse.json({
      success: true,
      debug: {
        searchedFor: productName,
        date: today,
        products: productsResult.rows.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          costPrice: parseFloat(p.cost_price) || 0,
          sellingPrice: parseFloat(p.selling_price) || 0,
          theoreticalMargin: Math.round(parseFloat(p.theoretical_margin) * 100) / 100
        })),
        posLines: posLinesResult.rows.map(l => ({
          lineId: l.line_id,
          productId: l.product_id,
          productName: l.product_name,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unit_price),
          lineCostPrice: l.line_cost_price !== null ? parseFloat(l.line_cost_price) : null,
          lineTotal: parseFloat(l.line_total),
          orderNumber: l.order_number,
          createdAt: l.created_at,
          productCostPrice: l.product_cost_price !== null ? parseFloat(l.product_cost_price) : null,
          productSellingPrice: l.product_selling_price !== null ? parseFloat(l.product_selling_price) : null
        })),
        invoiceLines: invoiceLinesResult.rows.map(l => ({
          lineId: l.line_id,
          productId: l.product_id,
          productName: l.product_name,
          quantity: parseFloat(l.quantity),
          unitPrice: parseFloat(l.unit_price),
          lineCostPrice: l.line_cost_price !== null ? parseFloat(l.line_cost_price) : null,
          lineSubtotal: parseFloat(l.line_subtotal),
          invoiceNumber: l.invoice_number,
          createdAt: l.created_at,
          productCostPrice: l.product_cost_price !== null ? parseFloat(l.product_cost_price) : null,
          productSellingPrice: l.product_selling_price !== null ? parseFloat(l.product_selling_price) : null
        })),
        purchaseLots: purchaseLotsResult.rows.map(l => ({
          id: l.id,
          productId: l.product_id,
          productName: l.product_name,
          unitCost: parseFloat(l.unit_cost),
          quantityAvailable: parseFloat(l.quantity_available),
          quantitySold: parseFloat(l.quantity_sold),
          receivedAt: l.received_at
        })),
        marginCalculation: marginCalcResult.rows.map(r => ({
          productId: r.product_id,
          productName: r.product_name,
          effectiveCost: parseFloat(r.effective_cost),
          quantity: parseFloat(r.quantity),
          revenue: parseFloat(r.revenue),
          totalCost: parseFloat(r.total_cost),
          calculatedMargin: parseFloat(r.revenue) > 0
            ? Math.round(((parseFloat(r.revenue) - parseFloat(r.total_cost)) / parseFloat(r.revenue)) * 10000) / 100
            : 0,
          source: r.source
        }))
      }
    })

  } catch (error) {
    console.error('[Debug Margin Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar márgenes'
    }, { status: 500 })
  }
}
