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
 * GET /api/market/pos/sessions/[id]/report
 * Get complete session report for printing (includes products sold, denominations, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const sessionId = parseInt(id)

    // Get session with full details
    const sessionResult = await db.query(`
      SELECT
        s.*,
        t.code as terminal_code,
        t.name as terminal_name,
        t.warehouse_id,
        w.name as warehouse_name,
        c.name as company_name,
        COALESCE(uo.firstname || ' ' || uo.lastname, uo.email) as opened_by_name,
        COALESCE(uc.firstname || ' ' || uc.lastname, uc.email) as closed_by_name
      FROM market_pos_sessions s
      JOIN market_pos_terminals t ON s.pos_terminal_id = t.id
      LEFT JOIN market_warehouses w ON t.warehouse_id = w.id
      LEFT JOIN companies c ON s.company_id = c.id
      LEFT JOIN users uo ON s.opened_by = uo.id
      LEFT JOIN users uc ON s.closed_by = uc.id
      WHERE s.id = $1 AND s.company_id = $2
    `, [sessionId, companyId])

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sesión no encontrada'
      }, { status: 404 })
    }

    const session = sessionResult.rows[0]

    // Get all products sold during the session (aggregated by product)
    const productsSoldResult = await db.query(`
      SELECT
        l.product_id,
        l.product_name,
        l.product_sku,
        l.variant_id,
        SUM(l.quantity) as total_quantity,
        SUM(l.subtotal) as total_subtotal,
        SUM(l.discount_amount) as total_discount,
        SUM(l.total) as total_amount,
        AVG(l.unit_price) as avg_unit_price,
        COUNT(DISTINCT o.id) as order_count
      FROM market_pos_order_lines l
      JOIN market_pos_orders o ON l.order_id = o.id
      WHERE o.pos_session_id = $1 AND o.status = 'paid'
      GROUP BY l.product_id, l.product_name, l.product_sku, l.variant_id
      ORDER BY total_quantity DESC
    `, [sessionId])

    // Get payment summary by method and currency
    const paymentsSummaryResult = await db.query(`
      SELECT
        p.payment_method,
        p.currency,
        SUM(p.amount) as total_amount,
        SUM(COALESCE(p.amount_tendered, p.amount)) as total_tendered,
        SUM(COALESCE(p.change_amount, 0)) as total_change,
        COUNT(*) as transaction_count
      FROM market_pos_payments p
      JOIN market_pos_orders o ON p.order_id = o.id
      WHERE o.pos_session_id = $1 AND o.status = 'paid'
      GROUP BY p.payment_method, p.currency
      ORDER BY p.payment_method, p.currency
    `, [sessionId])

    // Get orders summary
    const ordersSummaryResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'paid') as paid_orders,
        COUNT(*) FILTER (WHERE status = 'voided') as voided_orders,
        COUNT(*) FILTER (WHERE status = 'refunded') as refunded_orders,
        SUM(total_amount) FILTER (WHERE status = 'paid') as total_sales,
        SUM(total_amount) FILTER (WHERE status = 'refunded') as total_refunds,
        SUM(discount_amount) FILTER (WHERE status = 'paid') as total_discounts
      FROM market_pos_orders
      WHERE pos_session_id = $1
    `, [sessionId])

    const ordersSummary = ordersSummaryResult.rows[0]

    // Calculate cash collected by currency (after change given)
    const cashSummary: Record<string, { collected: number; tendered: number; change: number; count: number }> = {}
    const otherPayments: Array<{ method: string; currency: string; amount: number; count: number }> = []

    for (const p of paymentsSummaryResult.rows) {
      const amount = parseFloat(p.total_amount) || 0
      const tendered = parseFloat(p.total_tendered) || 0
      const change = parseFloat(p.total_change) || 0
      const collected = amount - change
      const count = parseInt(p.transaction_count) || 0

      if (p.payment_method === 'cash') {
        cashSummary[p.currency] = {
          collected: p.currency === 'CUP' ? Math.round(collected) : Math.round(collected * 100) / 100,
          tendered: p.currency === 'CUP' ? Math.round(tendered) : Math.round(tendered * 100) / 100,
          change: p.currency === 'CUP' ? Math.round(change) : Math.round(change * 100) / 100,
          count
        }
      } else {
        otherPayments.push({
          method: p.payment_method,
          currency: p.currency,
          amount: Math.round(amount * 100) / 100,
          count
        })
      }
    }

    // Parse denominations if stored
    let openingDenominations = null
    let closingDenominations = null

    try {
      if (session.opening_denominations) {
        openingDenominations = typeof session.opening_denominations === 'string'
          ? JSON.parse(session.opening_denominations)
          : session.opening_denominations
      }
      if (session.closing_denominations) {
        closingDenominations = typeof session.closing_denominations === 'string'
          ? JSON.parse(session.closing_denominations)
          : session.closing_denominations
      }
    } catch (e) {
      console.error('[Session Report] Error parsing denominations:', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          sessionCode: session.session_code,
          terminalCode: session.terminal_code,
          terminalName: session.terminal_name,
          warehouseName: session.warehouse_name,
          companyName: session.company_name,
          openedBy: session.opened_by_name,
          closedBy: session.closed_by_name,
          openedAt: session.opened_at,
          closedAt: session.closed_at,
          status: session.status,
          openingNotes: session.opening_notes,
          closingNotes: session.closing_notes
        },
        openingCash: {
          usd: parseFloat(session.opening_cash_usd) || 0,
          cup: parseFloat(session.opening_cash_cup) || 0,
          mlc: parseFloat(session.opening_cash_mlc) || 0
        },
        closingCash: session.closing_cash_usd !== null ? {
          usd: parseFloat(session.closing_cash_usd) || 0,
          cup: parseFloat(session.closing_cash_cup) || 0,
          mlc: parseFloat(session.closing_cash_mlc) || 0
        } : null,
        cashDifference: session.cash_difference !== null ? parseFloat(session.cash_difference) : null,
        inventoryShortage: parseFloat(session.inventory_shortage_value) || 0,
        openingDenominations,
        closingDenominations,
        summary: {
          paidOrders: parseInt(ordersSummary.paid_orders) || 0,
          voidedOrders: parseInt(ordersSummary.voided_orders) || 0,
          refundedOrders: parseInt(ordersSummary.refunded_orders) || 0,
          totalSales: parseFloat(ordersSummary.total_sales) || 0,
          totalRefunds: parseFloat(ordersSummary.total_refunds) || 0,
          totalDiscounts: parseFloat(ordersSummary.total_discounts) || 0
        },
        cashSummary,
        otherPayments,
        productsSold: productsSoldResult.rows.map(p => ({
          productId: p.product_id,
          productName: p.product_name,
          productSku: p.product_sku,
          variantId: p.variant_id,
          quantity: parseFloat(p.total_quantity) || 0,
          subtotal: parseFloat(p.total_subtotal) || 0,
          discount: parseFloat(p.total_discount) || 0,
          total: parseFloat(p.total_amount) || 0,
          avgPrice: parseFloat(p.avg_unit_price) || 0,
          orderCount: parseInt(p.order_count) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Session Report API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener reporte'
    }, { status: 500 })
  }
}
