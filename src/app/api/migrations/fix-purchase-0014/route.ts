import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-purchase-0014
 *
 * Reverses all received quantities from PUR-2026-0014 and deletes the purchase.
 * This purchase was rejected but erroneously received in the warehouse.
 */
export async function GET() {
  try {
    const purchaseNumber = 'PUR-2026-0014'

    // Find the purchase
    const purchaseResult = await db.query(`
      SELECT id, company_id, warehouse_id, status, validation_status
      FROM market_purchases
      WHERE purchase_number = $1
    `, [purchaseNumber])

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Compra ${purchaseNumber} no encontrada`
      }, { status: 404 })
    }

    const purchase = purchaseResult.rows[0]
    const purchaseId = purchase.id
    const warehouseId = purchase.warehouse_id

    // Get all lines with their received quantities
    const linesResult = await db.query(`
      SELECT id, product_id, variant_id, quantity, quantity_received
      FROM market_purchase_lines
      WHERE purchase_id = $1
    `, [purchaseId])

    const reversals: Array<{
      lineId: number
      productId: number
      variantId: number | null
      quantityReceived: number
    }> = []

    for (const line of linesResult.rows) {
      const qtyReceived = parseFloat(line.quantity_received) || 0
      if (qtyReceived > 0) {
        reversals.push({
          lineId: line.id,
          productId: parseInt(line.product_id),
          variantId: line.variant_id ? parseInt(line.variant_id) : null,
          quantityReceived: qtyReceived
        })
      }
    }

    // Execute reversal in a transaction
    await db.transaction(async (client) => {
      for (const rev of reversals) {
        // 1. Reverse quantity_on_hand in market_products (for non-variant items)
        if (!rev.variantId) {
          await client.query(`
            UPDATE market_products SET
              quantity_on_hand = GREATEST(0, COALESCE(quantity_on_hand, 0) - $1),
              updated_at = NOW()
            WHERE id = $2
          `, [rev.quantityReceived, rev.productId])
        } else {
          // Reverse variant quantity
          await client.query(`
            UPDATE market_product_variants SET
              quantity_on_hand = GREATEST(0, COALESCE(quantity_on_hand, 0) - $1)
            WHERE id = $2
          `, [rev.quantityReceived, rev.variantId])
        }

        // 2. Reverse warehouse stock
        if (warehouseId) {
          await client.query(`
            UPDATE market_warehouse_stock SET
              quantity_on_hand = GREATEST(0, quantity_on_hand - $1),
              last_movement_at = NOW(),
              updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3
              AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
          `, [rev.quantityReceived, warehouseId, rev.productId, rev.variantId])
        }

        // 3. Delete FIFO lot entries for this purchase line
        await client.query(`
          DELETE FROM purchase_lot_inventory
          WHERE purchase_line_id = $1
        `, [rev.lineId])
      }

      // 4. Delete purchase lines
      await client.query(`
        DELETE FROM market_purchase_lines WHERE purchase_id = $1
      `, [purchaseId])

      // 5. Delete the purchase
      await client.query(`
        DELETE FROM market_purchases WHERE id = $1
      `, [purchaseId])
    })

    return NextResponse.json({
      success: true,
      message: `Compra ${purchaseNumber} eliminada exitosamente. Se revirtieron ${reversals.length} lineas de inventario.`,
      data: {
        purchaseId,
        purchaseNumber,
        warehouseId,
        status: purchase.status,
        validationStatus: purchase.validation_status,
        linesReversed: reversals.length,
        details: reversals.map(r => ({
          lineId: r.lineId,
          productId: r.productId,
          variantId: r.variantId,
          quantityReversed: r.quantityReceived
        }))
      }
    })

  } catch (error) {
    console.error('[Fix Purchase 0014] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al corregir compra'
    }, { status: 500 })
  }
}
