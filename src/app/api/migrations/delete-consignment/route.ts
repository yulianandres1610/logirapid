import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/delete-consignment?orderNumber=CONS-2026-0004
 * Deletes a consignment order and all related data, reverting stock if received
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderNumber = searchParams.get('orderNumber')

    if (!orderNumber) {
      return NextResponse.json({
        success: false,
        error: 'orderNumber parameter required'
      }, { status: 400 })
    }

    // Find the consignment order
    const orderResult = await db.query(
      'SELECT id, order_number, status, warehouse_id, supplier_id, company_id FROM consignment_orders WHERE order_number = $1',
      [orderNumber]
    )

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No consignment found with order_number: ${orderNumber}`
      }, { status: 404 })
    }

    const order = orderResult.rows[0]
    const orderId = order.id
    const warehouseId = order.warehouse_id
    const deletions: string[] = []

    // If order was received, revert stock changes
    if (order.status === 'received' || order.status === 'active' || order.status === 'completed') {
      // Get all received lines to revert stock
      const linesResult = await db.query(
        'SELECT id, product_id, variant_id, quantity_received FROM consignment_order_lines WHERE order_id = $1',
        [orderId]
      )

      for (const line of linesResult.rows) {
        const qtyReceived = parseFloat(line.quantity_received) || 0
        if (qtyReceived <= 0) continue

        // Revert market_product_inventory
        if (warehouseId) {
          await db.query(`
            UPDATE market_product_inventory
            SET quantity_on_hand = GREATEST(0, COALESCE(quantity_on_hand, 0) - $1)
            WHERE warehouse_id = $2 AND product_id = $3
          `, [qtyReceived, warehouseId, line.product_id])
        }

        // Revert market_warehouse_stock (if exists)
        if (warehouseId) {
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = GREATEST(0, COALESCE(quantity_on_hand, 0) - $1),
                updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3
          `, [qtyReceived, warehouseId, line.product_id])
        }

        // Revert variant stock if applicable
        if (line.variant_id) {
          await db.query(`
            UPDATE market_product_variants
            SET quantity_on_hand = GREATEST(0, COALESCE(quantity_on_hand, 0) - $1),
                updated_at = NOW()
            WHERE id = $2
          `, [qtyReceived, line.variant_id])
        }
      }
      deletions.push(`stock_reverted: ${linesResult.rows.length} lines`)
    }

    // 1. Delete order_invoices
    const invoicesResult = await db.query(
      'DELETE FROM order_invoices WHERE consignment_order_id = $1',
      [orderId]
    )
    deletions.push(`order_invoices: ${invoicesResult.rowCount} rows`)

    // 2. Delete consignment_return_lines (for returns of this order)
    const returnsResult = await db.query(
      'SELECT id FROM consignment_returns WHERE order_id = $1',
      [orderId]
    )
    if (returnsResult.rows.length > 0) {
      const returnIds = returnsResult.rows.map(r => r.id)
      const returnLinesResult = await db.query(
        `DELETE FROM consignment_return_lines WHERE return_id = ANY($1)`,
        [returnIds]
      )
      deletions.push(`return_lines: ${returnLinesResult.rowCount} rows`)

      // 3. Delete consignment_returns
      const delReturnsResult = await db.query(
        'DELETE FROM consignment_returns WHERE order_id = $1',
        [orderId]
      )
      deletions.push(`returns: ${delReturnsResult.rowCount} rows`)
    }

    // 4. Delete consignment_wallet_transactions for this order
    const walletTxResult = await db.query(
      'DELETE FROM consignment_wallet_transactions WHERE order_id = $1',
      [orderId]
    )
    deletions.push(`wallet_transactions: ${walletTxResult.rowCount} rows`)

    // 5. Delete consignment_lot_inventory for this order's lines
    const lotResult = await db.query(
      'DELETE FROM consignment_lot_inventory WHERE order_line_id IN (SELECT id FROM consignment_order_lines WHERE order_id = $1)',
      [orderId]
    )
    deletions.push(`lot_inventory: ${lotResult.rowCount} rows`)

    // 6. Delete consignment_order_lines (CASCADE would handle but explicit is safer)
    const linesDelResult = await db.query(
      'DELETE FROM consignment_order_lines WHERE order_id = $1',
      [orderId]
    )
    deletions.push(`order_lines: ${linesDelResult.rowCount} rows`)

    // 7. Delete the consignment order itself
    const orderDelResult = await db.query(
      'DELETE FROM consignment_orders WHERE id = $1',
      [orderId]
    )
    deletions.push(`consignment_order: ${orderDelResult.rowCount} rows`)

    return NextResponse.json({
      success: true,
      message: `Consignment "${orderNumber}" deleted successfully`,
      orderId,
      status: order.status,
      deletions
    })
  } catch (error) {
    console.error('Error deleting consignment:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error deleting consignment'
    }, { status: 500 })
  }
}
