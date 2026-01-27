import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/test/close-pos-sessions
 * List all open POS sessions
 */
export async function GET() {
  try {
    // Find open sessions
    const openSessions = await db.query(`
      SELECT
        s.id,
        s.session_code,
        s.status,
        COALESCE(s.opening_cash_usd, 0) as opening_cash_usd,
        s.opened_at,
        t.name as terminal_name,
        t.code as terminal_code,
        w.name as warehouse_name,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as opened_by_name,
        (SELECT COUNT(*) FROM market_pos_orders WHERE pos_session_id = s.id) as order_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM market_pos_orders WHERE pos_session_id = s.id AND status = 'paid') as total_sales
      FROM market_pos_sessions s
      JOIN market_pos_terminals t ON t.id = s.pos_terminal_id
      LEFT JOIN market_warehouses w ON w.id = t.warehouse_id
      LEFT JOIN users u ON u.id = s.opened_by
      WHERE s.status = 'open'
      ORDER BY s.opened_at DESC
    `)

    // Get draft orders that might need attention
    const draftOrders = await db.query(`
      SELECT
        o.id,
        o.order_number,
        o.total_amount,
        o.created_at,
        s.session_code
      FROM market_pos_orders o
      JOIN market_pos_sessions s ON s.id = o.pos_session_id
      WHERE o.status = 'draft'
      ORDER BY o.created_at DESC
      LIMIT 10
    `)

    return NextResponse.json({
      success: true,
      data: {
        openSessions: openSessions.rows.map(s => ({
          id: s.id,
          sessionCode: s.session_code,
          status: s.status,
          terminalName: s.terminal_name,
          terminalCode: s.terminal_code,
          warehouseName: s.warehouse_name,
          openedBy: s.opened_by_name,
          openingCashUSD: parseFloat(s.opening_cash_usd) || 0,
          openedAt: s.opened_at,
          orderCount: parseInt(s.order_count),
          totalSales: parseFloat(s.total_sales) || 0
        })),
        openSessionCount: openSessions.rows.length,
        draftOrders: draftOrders.rows.map(o => ({
          id: o.id,
          orderNumber: o.order_number,
          totalAmount: parseFloat(o.total_amount) || 0,
          sessionCode: o.session_code,
          createdAt: o.created_at
        })),
        draftOrderCount: draftOrders.rows.length
      }
    })

  } catch (error) {
    console.error('[Close POS Sessions] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/test/close-pos-sessions
 * Close all open POS sessions
 */
export async function POST() {
  try {
    // First, void any draft orders (they haven't been paid)
    const draftOrders = await db.query(`
      SELECT o.id, o.order_number, o.warehouse_id
      FROM market_pos_orders o
      WHERE o.status = 'draft'
    `)

    let draftVoided = 0
    for (const order of draftOrders.rows) {
      // Get order lines to restore stock
      const lines = await db.query(`
        SELECT product_id, variant_id, quantity
        FROM market_pos_order_lines
        WHERE order_id = $1
      `, [order.id])

      await db.query('BEGIN')
      try {
        // Restore stock for each line
        for (const line of lines.rows) {
          if (!line.product_id) continue

          const variantId = line.variant_id || null

          // Restore warehouse stock
          if (order.warehouse_id) {
            await db.query(`
              UPDATE market_warehouse_stock
              SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
              WHERE warehouse_id = $2 AND product_id = $3
                AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
            `, [line.quantity, order.warehouse_id, line.product_id, variantId])
          }

          // Restore variant stock
          if (variantId) {
            await db.query(`
              UPDATE market_product_variants
              SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
              WHERE id = $2
            `, [line.quantity, variantId])
          }

          // Restore product stock
          await db.query(`
            UPDATE market_products
            SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
            WHERE id = $2
          `, [line.quantity, line.product_id])
        }

        // Mark order as voided
        await db.query(`
          UPDATE market_pos_orders
          SET status = 'voided', updated_at = NOW()
          WHERE id = $1
        `, [order.id])

        await db.query('COMMIT')
        draftVoided++
        console.log(`[Close POS] Voided draft order ${order.order_number}`)

      } catch (txError) {
        await db.query('ROLLBACK')
        console.error(`[Close POS] Error voiding order ${order.order_number}:`, txError)
      }
    }

    // Get open sessions
    const openSessions = await db.query(`
      SELECT
        s.id,
        s.session_code,
        COALESCE(s.opening_cash_usd, 0) as opening_cash_usd,
        t.id as terminal_id,
        (SELECT COALESCE(SUM(total_amount), 0) FROM market_pos_orders WHERE pos_session_id = s.id AND status = 'paid') as total_sales,
        (SELECT COALESCE(SUM(amount), 0) FROM market_pos_payments p
         JOIN market_pos_orders o ON o.id = p.order_id
         WHERE o.pos_session_id = s.id AND o.status = 'paid' AND p.payment_method = 'cash') as cash_sales,
        (SELECT COALESCE(SUM(amount), 0) FROM market_pos_payments p
         JOIN market_pos_orders o ON o.id = p.order_id
         WHERE o.pos_session_id = s.id AND o.status = 'paid' AND p.payment_method != 'cash') as other_sales
      FROM market_pos_sessions s
      JOIN market_pos_terminals t ON t.id = s.pos_terminal_id
      WHERE s.status = 'open'
    `)

    let sessionsClosed = 0
    const closedSessions: Array<{
      sessionCode: string
      openingCashUSD: number
      totalSales: number
      cashSales: number
      expectedCash: number
    }> = []

    for (const session of openSessions.rows) {
      const openingCashUSD = parseFloat(session.opening_cash_usd) || 0
      const cashSales = parseFloat(session.cash_sales) || 0
      const otherSales = parseFloat(session.other_sales) || 0
      const totalSales = parseFloat(session.total_sales) || 0
      const expectedCash = openingCashUSD + cashSales

      await db.query(`
        UPDATE market_pos_sessions
        SET
          status = 'closed',
          closed_at = NOW(),
          closing_cash_usd = $1,
          cash_difference = 0,
          total_sales = $2,
          closing_notes = 'Cerrado automáticamente - Preparación para nuevo día'
        WHERE id = $3
      `, [expectedCash, totalSales, session.id])

      closedSessions.push({
        sessionCode: session.session_code,
        openingCashUSD,
        totalSales,
        cashSales,
        expectedCash
      })

      sessionsClosed++
      console.log(`[Close POS] Closed session ${session.session_code}`)
    }

    // Final stock verification
    const discrepancyCheck = await db.query(`
      SELECT COUNT(*) as count
      FROM market_product_variants mpv
      LEFT JOIN (
        SELECT variant_id, SUM(quantity_on_hand) as total
        FROM market_warehouse_stock
        WHERE variant_id IS NOT NULL
        GROUP BY variant_id
      ) mws ON mws.variant_id = mpv.id
      WHERE ABS(mpv.quantity_on_hand - COALESCE(mws.total, 0)) >= 0.001
    `)

    const finalDiscrepancies = parseInt(discrepancyCheck.rows[0].count)

    return NextResponse.json({
      success: true,
      message: `Cierre completado: ${sessionsClosed} sesiones cerradas, ${draftVoided} órdenes borrador anuladas`,
      data: {
        draftOrdersVoided: draftVoided,
        sessionsClosed,
        closedSessions,
        finalStockCheck: {
          variantDiscrepancies: finalDiscrepancies,
          status: finalDiscrepancies === 0 ? 'OK - Sin discrepancias' : 'ERROR - Hay discrepancias'
        }
      }
    })

  } catch (error) {
    console.error('[Close POS Sessions] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
