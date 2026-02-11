import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-perlas-returns
 * Investigate and show the discrepancy with perlas de olor in order 7
 */
export async function GET() {
  try {
    const results: Record<string, unknown> = {}

    // 1. Get all products in order 7
    const orderProducts = await db.query(`
      SELECT
        ol.id as order_line_id,
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
    results.orderProducts = orderProducts.rows

    // 2. Find "perlas de olor" products
    const perlasProducts = await db.query(`
      SELECT id, name, sku FROM market_products
      WHERE LOWER(name) LIKE '%perla%'
    `)
    results.perlasProducts = perlasProducts.rows

    // 3. Check if perlas is in order 7
    const perlasInOrder = orderProducts.rows.filter(
      (p: { product_name: string }) => p.product_name.toLowerCase().includes('perla')
    )
    results.perlasInOrder = perlasInOrder

    // 4. Get all returns for order 7
    const returns = await db.query(`
      SELECT
        r.id,
        r.return_number,
        r.status,
        r.total_units,
        r.total_value,
        r.created_at
      FROM consignment_returns r
      WHERE r.order_id = 7
      ORDER BY r.created_at
    `)
    results.returns = returns.rows

    // 5. Get all return lines for order 7 with product names
    const returnLines = await db.query(`
      SELECT
        rl.id as return_line_id,
        rl.return_id,
        r.return_number,
        r.status as return_status,
        rl.order_line_id,
        rl.product_id,
        p.name as product_name,
        rl.quantity_to_return,
        rl.quantity_validated
      FROM consignment_return_lines rl
      JOIN consignment_returns r ON r.id = rl.return_id
      JOIN market_products p ON p.id = rl.product_id
      WHERE r.order_id = 7
      ORDER BY rl.return_id, rl.id
    `)
    results.returnLines = returnLines.rows

    // 6. Find perlas in return lines (these should NOT exist if perlas wasn't in order 7)
    const perlasInReturnLines = returnLines.rows.filter(
      (rl: { product_name: string }) => rl.product_name.toLowerCase().includes('perla')
    )
    results.perlasInReturnLines = perlasInReturnLines

    // 7. Get inventory movements for products in order 7 that reference consignment_return
    const productIds = orderProducts.rows.map((p: { product_id: number }) => p.product_id)
    let movements: { rows: unknown[] } = { rows: [] }

    if (productIds.length > 0) {
      movements = await db.query(`
        SELECT
          m.id,
          m.product_id,
          p.name as product_name,
          m.movement_type,
          m.quantity,
          m.reference_type,
          m.reference_id,
          m.notes,
          m.created_at
        FROM market_inventory_movements m
        JOIN market_products p ON p.id = m.product_id
        WHERE m.reference_type = 'consignment_return'
          AND m.reference_id IN (SELECT id FROM consignment_returns WHERE order_id = 7)
        ORDER BY m.created_at DESC
      `)
    }
    results.movements = movements.rows

    // 8. Analysis
    results.analysis = {
      productsInOrder7: orderProducts.rows.map((p: { product_id: number; product_name: string }) => ({
        id: p.product_id,
        name: p.product_name
      })),
      perlasProductIds: perlasProducts.rows.map((p: { id: number }) => p.id),
      perlasIsInOrder7: perlasInOrder.length > 0,
      perlasIsInReturnLines: perlasInReturnLines.length > 0,
      discrepancy: perlasInReturnLines.length > 0 && perlasInOrder.length === 0
        ? 'DISCREPANCY: Perlas appears in return lines but NOT in order 7'
        : 'No discrepancy detected for perlas'
    }

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
 * Fix the perlas de olor discrepancy by removing invalid return lines and movements
 */
export async function POST() {
  try {
    const results: string[] = []

    // 1. Get all products in order 7
    const orderProducts = await db.query(`
      SELECT ol.product_id FROM consignment_order_lines ol WHERE ol.order_id = 7
    `)
    const validProductIds = new Set(orderProducts.rows.map((p: { product_id: number }) => p.product_id))
    results.push(`Order 7 has ${validProductIds.size} valid products`)

    // 2. Find invalid return lines (products not in order 7)
    const invalidReturnLines = await db.query(`
      SELECT
        rl.id,
        rl.return_id,
        rl.product_id,
        p.name as product_name,
        r.return_number,
        rl.quantity_validated
      FROM consignment_return_lines rl
      JOIN consignment_returns r ON r.id = rl.return_id
      JOIN market_products p ON p.id = rl.product_id
      WHERE r.order_id = 7
    `)

    let deletedLines = 0
    let deletedMovements = 0
    let recalculatedOrders = 0

    for (const line of invalidReturnLines.rows as Array<{
      id: number
      return_id: number
      product_id: number
      product_name: string
      return_number: string
      quantity_validated: number
    }>) {
      if (!validProductIds.has(line.product_id)) {
        // This return line is for a product not in order 7 - delete it
        await db.query('DELETE FROM consignment_return_lines WHERE id = $1', [line.id])
        results.push(`Deleted invalid return line for "${line.product_name}" (product ${line.product_id}) from return ${line.return_number}`)
        deletedLines++

        // Also delete any inventory movements for this product related to this return
        const deletedMvmts = await db.query(`
          DELETE FROM market_inventory_movements
          WHERE product_id = $1
            AND reference_type = 'consignment_return'
            AND reference_id = $2
          RETURNING id
        `, [line.product_id, line.return_id])

        if (deletedMvmts.rows.length > 0) {
          results.push(`Deleted ${deletedMvmts.rows.length} inventory movements for product ${line.product_id}`)
          deletedMovements += deletedMvmts.rows.length
        }
      }
    }

    // 3. Recalculate order totals
    const orderTotalResult = await db.query(`
      SELECT COALESCE(SUM(rl.quantity_validated * rl.unit_cost), 0) as total_returned_value
      FROM consignment_return_lines rl
      JOIN consignment_returns r ON r.id = rl.return_id
      WHERE r.order_id = 7 AND r.status = 'completed'
    `)
    const newTotalReturned = parseFloat(orderTotalResult.rows[0]?.total_returned_value) || 0

    await db.query(`
      UPDATE consignment_orders SET total_returned = $1 WHERE id = 7
    `, [newTotalReturned])
    results.push(`Updated order 7 total_returned to ${newTotalReturned}`)
    recalculatedOrders++

    // 4. Recalculate each return's totals
    const returnsForOrder = await db.query(`
      SELECT r.id FROM consignment_returns r WHERE r.order_id = 7
    `)

    for (const ret of returnsForOrder.rows as Array<{ id: number }>) {
      const returnTotals = await db.query(`
        SELECT
          COUNT(*) as total_items,
          COALESCE(SUM(quantity_validated), 0) as total_units,
          COALESCE(SUM(quantity_validated * unit_cost), 0) as total_value
        FROM consignment_return_lines
        WHERE return_id = $1
      `, [ret.id])

      await db.query(`
        UPDATE consignment_returns
        SET
          total_items = $1,
          total_units = $2,
          total_value = $3
        WHERE id = $4
      `, [
        returnTotals.rows[0].total_items,
        returnTotals.rows[0].total_units,
        returnTotals.rows[0].total_value,
        ret.id
      ])
      results.push(`Recalculated totals for return ${ret.id}`)
    }

    // 5. Delete any empty returns (no lines left)
    const emptyReturns = await db.query(`
      DELETE FROM consignment_returns
      WHERE order_id = 7
        AND NOT EXISTS (SELECT 1 FROM consignment_return_lines WHERE return_id = consignment_returns.id)
      RETURNING id, return_number
    `)

    for (const ret of emptyReturns.rows as Array<{ id: number; return_number: string }>) {
      results.push(`Deleted empty return ${ret.return_number}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Perlas discrepancy fixed',
      summary: {
        deletedReturnLines: deletedLines,
        deletedMovements,
        recalculatedOrders,
        deletedEmptyReturns: emptyReturns.rows.length
      },
      results
    })

  } catch (error) {
    console.error('[Migration Fix] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
