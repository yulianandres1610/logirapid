import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/delete-purchase?purchaseNumber=PUR-2026-0012
 * Deletes a purchase order and all related data, reverting stock if received
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const purchaseNumber = searchParams.get('purchaseNumber')

    if (!purchaseNumber) {
      return NextResponse.json({
        success: false,
        error: 'purchaseNumber parameter required'
      }, { status: 400 })
    }

    // Find the purchase order
    const purchaseResult = await db.query(
      'SELECT id, purchase_number, status, warehouse_id, company_id FROM market_purchases WHERE purchase_number = $1',
      [purchaseNumber]
    )

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No purchase found with purchase_number: ${purchaseNumber}`
      }, { status: 404 })
    }

    const purchase = purchaseResult.rows[0]
    const purchaseId = purchase.id
    const warehouseId = purchase.warehouse_id
    const deletions: string[] = []

    // Get all lines to revert stock
    const linesResult = await db.query(
      'SELECT id, product_id, variant_id, quantity, quantity_received FROM market_purchase_lines WHERE purchase_id = $1',
      [purchaseId]
    )

    // If order was received (partially or fully), revert stock changes
    for (const line of linesResult.rows) {
      const qtyReceived = parseFloat(line.quantity_received) || 0
      const qtyOrdered = parseFloat(line.quantity) || 0

      if (qtyReceived > 0) {
        // Revert market_products quantity_on_hand
        await db.query(`
          UPDATE market_products
          SET quantity_on_hand = GREATEST(0, COALESCE(quantity_on_hand, 0) - $1),
              updated_at = NOW()
          WHERE id = $2
        `, [qtyReceived, line.product_id])

        // Revert variant stock if applicable
        if (line.variant_id) {
          await db.query(`
            UPDATE market_product_variants
            SET quantity_on_hand = GREATEST(0, COALESCE(quantity_on_hand, 0) - $1),
                updated_at = NOW()
            WHERE id = $2
          `, [qtyReceived, line.variant_id])
        }

        // Revert warehouse stock if applicable
        if (warehouseId) {
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = GREATEST(0, COALESCE(quantity_on_hand, 0) - $1),
                updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3
              AND ${line.variant_id ? 'variant_id = $4' : 'variant_id IS NULL'}
          `, line.variant_id
            ? [qtyReceived, warehouseId, line.product_id, line.variant_id]
            : [qtyReceived, warehouseId, line.product_id])
        }
      }

      // Revert quantity_expected for non-received items
      const qtyExpectedToRevert = qtyOrdered - qtyReceived
      if (qtyExpectedToRevert > 0 && (purchase.status === 'comprada' || purchase.status === 'pendiente' || purchase.status === 'draft')) {
        await db.query(`
          UPDATE market_products
          SET quantity_expected = GREATEST(0, COALESCE(quantity_expected, 0) - $1),
              updated_at = NOW()
          WHERE id = $2
        `, [qtyExpectedToRevert, line.product_id])
      }
    }

    if (linesResult.rows.some(l => parseFloat(l.quantity_received) > 0)) {
      deletions.push(`stock_reverted: ${linesResult.rows.filter(l => parseFloat(l.quantity_received) > 0).length} lines`)
    }

    // 1. Delete inventory movements referencing this purchase
    const movementsResult = await db.query(
      "DELETE FROM market_inventory_movements WHERE reference_type = 'purchase' AND reference_id = $1",
      [purchaseId]
    )
    deletions.push(`inventory_movements: ${movementsResult.rowCount} rows`)

    // 2. Delete purchase lines
    const linesDelResult = await db.query(
      'DELETE FROM market_purchase_lines WHERE purchase_id = $1',
      [purchaseId]
    )
    deletions.push(`purchase_lines: ${linesDelResult.rowCount} rows`)

    // 3. Delete the purchase order itself
    const purchaseDelResult = await db.query(
      'DELETE FROM market_purchases WHERE id = $1',
      [purchaseId]
    )
    deletions.push(`purchase_order: ${purchaseDelResult.rowCount} rows`)

    return NextResponse.json({
      success: true,
      message: `Purchase "${purchaseNumber}" deleted successfully`,
      purchaseId,
      status: purchase.status,
      deletions
    })
  } catch (error) {
    console.error('Error deleting purchase:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error deleting purchase'
    }, { status: 500 })
  }
}
