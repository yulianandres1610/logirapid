import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/fix-double-return
 * Fix the double return issue for order 7 (peine electrico para piojos)
 *
 * Problem: Product was returned twice, causing:
 * - quantity_returned = 2 (should be 1)
 * - lot quantity_available = -1 (should be 0)
 * - Missing inventory movement
 */
export async function POST() {
  try {
    console.log('[Migration] Starting fix-double-return migration...')
    const results: string[] = []

    // 1. Find the problematic order line (peine electrico - product 157)
    const orderLineResult = await db.query(`
      SELECT ol.id, ol.order_id, ol.product_id, ol.quantity_received, ol.quantity_returned,
             p.name as product_name
      FROM consignment_order_lines ol
      JOIN market_products p ON p.id = ol.product_id
      WHERE ol.order_id = 7 AND ol.product_id = 157
    `)

    if (orderLineResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Order line not found'
      }, { status: 404 })
    }

    const orderLine = orderLineResult.rows[0]
    results.push(`Found order line: ${orderLine.product_name}, received=${orderLine.quantity_received}, returned=${orderLine.quantity_returned}`)

    // 2. Fix the order line quantity_returned (should be max = quantity_received)
    const correctQuantityReturned = Math.min(orderLine.quantity_returned, orderLine.quantity_received)
    if (orderLine.quantity_returned !== correctQuantityReturned) {
      await db.query(`
        UPDATE consignment_order_lines
        SET quantity_returned = $1
        WHERE id = $2
      `, [correctQuantityReturned, orderLine.id])
      results.push(`Fixed order line ${orderLine.id}: quantity_returned ${orderLine.quantity_returned} -> ${correctQuantityReturned}`)
    }

    // 3. Find and fix the lot inventory
    const lotResult = await db.query(`
      SELECT id, quantity_initial, quantity_available, quantity_sold, quantity_returned
      FROM consignment_lot_inventory
      WHERE order_line_id = $1
    `, [orderLine.id])

    if (lotResult.rows.length > 0) {
      const lot = lotResult.rows[0]
      // Correct values: available = initial - sold - returned
      const correctReturned = correctQuantityReturned
      const correctAvailable = lot.quantity_initial - (lot.quantity_sold || 0) - correctReturned

      // If fully returned, quantity_available should be 0
      const finalAvailable = Math.max(0, correctAvailable)

      await db.query(`
        UPDATE consignment_lot_inventory
        SET quantity_available = $1, quantity_returned = $2
        WHERE id = $3
      `, [finalAvailable, correctReturned, lot.id])
      results.push(`Fixed lot ${lot.id}: quantity_available ${lot.quantity_available} -> ${finalAvailable}, quantity_returned -> ${correctReturned}`)
    }

    // 4. Fix warehouse stock for product 157
    const stockResult = await db.query(`
      SELECT ws.warehouse_id, ws.quantity_on_hand
      FROM market_warehouse_stock ws
      WHERE ws.product_id = 157
    `)

    for (const stock of stockResult.rows) {
      // If stock is negative, set to 0
      if (stock.quantity_on_hand < 0) {
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = 0
          WHERE warehouse_id = $1 AND product_id = 157
        `, [stock.warehouse_id])
        results.push(`Fixed warehouse ${stock.warehouse_id} stock: ${stock.quantity_on_hand} -> 0`)
      }
    }

    // 5. Recalculate order total_returned
    const orderTotalResult = await db.query(`
      SELECT SUM(ol.quantity_returned * ol.unit_cost) as total_returned_value
      FROM consignment_order_lines ol
      WHERE ol.order_id = 7
    `)
    const correctTotalReturned = parseFloat(orderTotalResult.rows[0]?.total_returned_value) || 0

    await db.query(`
      UPDATE consignment_orders
      SET total_returned = $1
      WHERE id = 7
    `, [correctTotalReturned])
    results.push(`Fixed order total_returned: -> ${correctTotalReturned}`)

    // 6. Check for duplicate returns and mark one as cancelled
    const duplicateReturns = await db.query(`
      SELECT r.id, r.return_number, r.status, r.total_units, r.created_at,
             (SELECT SUM(rl.quantity_to_return) FROM consignment_return_lines rl
              WHERE rl.return_id = r.id AND rl.product_id = 157) as qty_157
      FROM consignment_returns r
      WHERE r.order_id = 7
        AND EXISTS (SELECT 1 FROM consignment_return_lines rl WHERE rl.return_id = r.id AND rl.product_id = 157)
      ORDER BY r.created_at
    `)

    results.push(`Found ${duplicateReturns.rows.length} returns with product 157`)

    // If there are multiple completed returns for the same product, cancel the extra ones
    let validReturns = 0
    for (const ret of duplicateReturns.rows) {
      if (ret.status === 'completed') {
        validReturns++
        if (validReturns > 1) {
          // This is a duplicate, mark as cancelled
          await db.query(`
            UPDATE consignment_returns
            SET status = 'cancelled', notes = COALESCE(notes, '') || ' [AUTO-CANCELLED: Duplicate return]'
            WHERE id = $1
          `, [ret.id])
          results.push(`Cancelled duplicate return ${ret.return_number} (id: ${ret.id})`)
        }
      }
    }

    console.log('[Migration] fix-double-return completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Double return issue fixed',
      results
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/fix-double-return
 * Check current state of the problematic data
 */
export async function GET() {
  try {
    // Get order line data
    const orderLine = await db.query(`
      SELECT ol.*, p.name as product_name
      FROM consignment_order_lines ol
      JOIN market_products p ON p.id = ol.product_id
      WHERE ol.order_id = 7 AND ol.product_id = 157
    `)

    // Get lot data
    const lot = await db.query(`
      SELECT * FROM consignment_lot_inventory
      WHERE order_line_id = (SELECT id FROM consignment_order_lines WHERE order_id = 7 AND product_id = 157 LIMIT 1)
    `)

    // Get returns
    const returns = await db.query(`
      SELECT r.id, r.return_number, r.status, r.total_units, r.total_value, r.created_at
      FROM consignment_returns r
      WHERE r.order_id = 7
      ORDER BY r.created_at
    `)

    // Get warehouse stock
    const stock = await db.query(`
      SELECT * FROM market_warehouse_stock WHERE product_id = 157
    `)

    return NextResponse.json({
      success: true,
      data: {
        orderLine: orderLine.rows[0] || null,
        lot: lot.rows[0] || null,
        returns: returns.rows,
        stock: stock.rows
      }
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed'
    }, { status: 500 })
  }
}
