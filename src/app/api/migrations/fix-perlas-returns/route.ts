import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-perlas-returns
 * Show current state of returns for order 7
 */
export async function GET() {
  try {
    const results: Record<string, unknown> = {}

    // Get all returns for order 7 with product names
    const returns = await db.query(`
      SELECT
        r.id,
        r.return_number,
        r.status,
        r.total_units,
        r.total_value,
        r.created_at,
        rl.id as line_id,
        rl.product_id,
        p.name as product_name,
        rl.quantity_validated,
        rl.unit_cost,
        rl.lot_inventory_id
      FROM consignment_returns r
      JOIN consignment_return_lines rl ON rl.return_id = r.id
      JOIN market_products p ON p.id = rl.product_id
      WHERE r.order_id = 7
      ORDER BY r.id
    `)
    results.returns = returns.rows

    // Get order lines with returned quantities
    const orderLines = await db.query(`
      SELECT
        ol.id,
        ol.product_id,
        p.name as product_name,
        ol.quantity_received,
        ol.quantity_sold,
        ol.quantity_returned
      FROM consignment_order_lines ol
      JOIN market_products p ON p.id = ol.product_id
      WHERE ol.order_id = 7
      ORDER BY ol.id
    `)
    results.orderLines = orderLines.rows

    // Get lot inventory
    const lots = await db.query(`
      SELECT
        li.id,
        li.product_id,
        p.name as product_name,
        li.quantity_initial,
        li.quantity_available,
        li.quantity_sold,
        li.quantity_returned
      FROM consignment_lot_inventory li
      JOIN market_products p ON p.id = li.product_id
      WHERE li.order_id = 7
      ORDER BY li.id
    `)
    results.lots = lots.rows

    // Get wallet balance
    const wallet = await db.query(`
      SELECT balance_available, total_returned
      FROM consignment_supplier_wallets
      WHERE supplier_id = 13
    `)
    results.wallet = wallet.rows[0]

    return NextResponse.json({
      success: true,
      data: results
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/migrations/fix-perlas-returns
 * Remove perlas de olor returns (keep only peine para piojos)
 *
 * Returns to DELETE:
 * - DEV-SUPP-2026-0002 (id=4): Perlas de olor 345g (product 152)
 * - DEV-SUPP-2026-0003 (id=5): Perlas de olor Spring Fresh (product 154)
 *
 * Return to KEEP:
 * - DEV-SUPP-2026-0001 (id=3): Peine eléctrico para piojos (product 157)
 */
export async function POST() {
  try {
    const results: string[] = []

    // Returns to delete (perlas de olor)
    const returnsToDelete = [4, 5] // DEV-SUPP-2026-0002, DEV-SUPP-2026-0003

    // Products affected
    const productsToRestore = [
      { productId: 152, orderLineId: 15, lotId: 24, qty: 1 }, // Perlas de olor 345g
      { productId: 154, orderLineId: 17, lotId: 26, qty: 1 }, // Perlas de olor Spring Fresh
    ]

    // Start transaction
    await db.query('BEGIN')

    try {
      // 1. Get return values before deleting (for wallet adjustment)
      const returnValues = await db.query(`
        SELECT r.id, r.total_value
        FROM consignment_returns r
        WHERE r.id = ANY($1)
      `, [returnsToDelete])

      let totalValueToRestore = 0
      for (const r of returnValues.rows as Array<{ id: number; total_value: string }>) {
        totalValueToRestore += parseFloat(r.total_value) || 0
      }
      results.push(`Total value to restore to wallet: $${totalValueToRestore.toFixed(2)}`)

      // 2. Delete return lines
      const deletedLines = await db.query(`
        DELETE FROM consignment_return_lines
        WHERE return_id = ANY($1)
        RETURNING id, product_id
      `, [returnsToDelete])
      results.push(`Deleted ${deletedLines.rows.length} return lines`)

      // 3. Delete the returns
      const deletedReturns = await db.query(`
        DELETE FROM consignment_returns
        WHERE id = ANY($1)
        RETURNING id, return_number
      `, [returnsToDelete])
      for (const r of deletedReturns.rows as Array<{ return_number: string }>) {
        results.push(`Deleted return ${r.return_number}`)
      }

      // 4. Restore lot inventory (add back quantity_available, subtract quantity_returned)
      for (const p of productsToRestore) {
        await db.query(`
          UPDATE consignment_lot_inventory
          SET quantity_available = quantity_available + $1,
              quantity_returned = COALESCE(quantity_returned, 0) - $1
          WHERE id = $2
        `, [p.qty, p.lotId])
        results.push(`Restored ${p.qty} unit to lot ${p.lotId}`)
      }

      // 5. Reset quantity_returned on order lines
      for (const p of productsToRestore) {
        await db.query(`
          UPDATE consignment_order_lines
          SET quantity_returned = COALESCE(quantity_returned, 0) - $1
          WHERE id = $2
        `, [p.qty, p.orderLineId])
        results.push(`Reset quantity_returned on order line ${p.orderLineId}`)
      }

      // 6. Update warehouse stock (add back the quantity)
      for (const p of productsToRestore) {
        // Get warehouse_id from the deleted returns (warehouse 3 for these)
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = quantity_on_hand + $1,
              updated_at = NOW()
          WHERE warehouse_id = 3 AND product_id = $2
        `, [p.qty, p.productId])
        results.push(`Restored ${p.qty} unit to warehouse stock for product ${p.productId}`)
      }

      // 7. Delete inventory movements for these returns
      const deletedMovements = await db.query(`
        DELETE FROM market_inventory_movements
        WHERE reference_type = 'consignment_return'
          AND reference_id = ANY($1)
        RETURNING id
      `, [returnsToDelete])
      results.push(`Deleted ${deletedMovements.rows.length} inventory movements`)

      // 8. Update wallet (restore balance)
      await db.query(`
        UPDATE consignment_supplier_wallets
        SET balance_available = balance_available + $1,
            total_returned = COALESCE(total_returned, 0) - $1
        WHERE supplier_id = 13
      `, [totalValueToRestore])
      results.push(`Restored $${totalValueToRestore.toFixed(2)} to supplier wallet`)

      // 9. Delete wallet transactions for these returns
      const deletedTxns = await db.query(`
        DELETE FROM consignment_wallet_transactions
        WHERE notes LIKE '%DEV-SUPP-2026-0002%' OR notes LIKE '%DEV-SUPP-2026-0003%'
        RETURNING id
      `, [])
      results.push(`Deleted ${deletedTxns.rows.length} wallet transactions`)

      // 10. Recalculate order total_returned (only from remaining returns)
      const remainingReturned = await db.query(`
        SELECT COALESCE(SUM(rl.quantity_validated * rl.unit_cost), 0) as total
        FROM consignment_return_lines rl
        JOIN consignment_returns r ON r.id = rl.return_id
        WHERE r.order_id = 7 AND r.status = 'completed'
      `)
      const newTotalReturned = parseFloat(remainingReturned.rows[0]?.total) || 0

      await db.query(`
        UPDATE consignment_orders
        SET total_returned = $1
        WHERE id = 7
      `, [newTotalReturned])
      results.push(`Updated order total_returned to $${newTotalReturned.toFixed(2)}`)

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Perlas de olor returns removed successfully',
        summary: {
          deletedReturns: deletedReturns.rows.length,
          deletedLines: deletedLines.rows.length,
          deletedMovements: deletedMovements.rows.length,
          valueRestoredToWallet: totalValueToRestore,
          newOrderTotalReturned: newTotalReturned
        },
        results
      })

    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('[Migration Fix] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
