import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-production-stock
 * Fix production stock duplication issues for product 150 and similar cases
 * This migration:
 * 1. Finds production orders with duplicate lot entries
 * 2. Keeps only one lot per production order
 * 3. Recalculates warehouse stock based on actual lot quantities
 */
export async function GET() {
  const results: string[] = []

  try {
    // 1. Get all production orders and their lots
    results.push('=== ANALYZING PRODUCTION LOTS ===')

    const productionLots = await db.query(`
      SELECT
        pli.id,
        pli.production_order_id,
        pli.product_id,
        pli.warehouse_id,
        pli.lot_number,
        pli.quantity_initial,
        pli.quantity_available,
        pli.company_id,
        mpo.order_number,
        mpo.target_quantity as expected_qty,
        mpo.actual_quantity,
        mp.name as product_name
      FROM production_lot_inventory pli
      LEFT JOIN market_production_orders mpo ON mpo.id = pli.production_order_id
      LEFT JOIN market_products mp ON mp.id = pli.product_id
      ORDER BY pli.production_order_id, pli.id
    `)

    results.push(`Found ${productionLots.rows.length} production lot entries`)

    // Group by production_order_id to find duplicates
    const lotsByOrder: Record<number, typeof productionLots.rows> = {}
    for (const lot of productionLots.rows) {
      const orderId = lot.production_order_id
      if (!lotsByOrder[orderId]) {
        lotsByOrder[orderId] = []
      }
      lotsByOrder[orderId].push(lot)
    }

    // 2. Find and fix duplicates
    results.push('\n=== CHECKING FOR DUPLICATES ===')

    const duplicateOrders = Object.entries(lotsByOrder).filter(([_, lots]) => lots.length > 1)
    results.push(`Found ${duplicateOrders.length} orders with duplicate lots`)

    for (const [orderId, lots] of duplicateOrders) {
      results.push(`\nOrder ${orderId} (${lots[0].order_number}): ${lots.length} duplicate lots`)

      // Keep the first one, delete the rest
      const keepLot = lots[0]
      const deleteLots = lots.slice(1)

      results.push(`  Keeping lot ${keepLot.id} (${keepLot.lot_number}): qty=${keepLot.quantity_initial}`)

      for (const deleteLot of deleteLots) {
        results.push(`  Deleting lot ${deleteLot.id} (${deleteLot.lot_number}): qty=${deleteLot.quantity_initial}`)
        await db.query('DELETE FROM production_lot_inventory WHERE id = $1', [deleteLot.id])
      }
    }

    // 3. Recalculate warehouse stock for affected products
    results.push('\n=== RECALCULATING WAREHOUSE STOCK ===')

    // Get unique product/warehouse combinations from production lots
    const affectedProducts = await db.query(`
      SELECT DISTINCT
        pli.product_id,
        pli.warehouse_id,
        pli.variant_id,
        pli.company_id,
        mp.name as product_name
      FROM production_lot_inventory pli
      LEFT JOIN market_products mp ON mp.id = pli.product_id
    `)

    for (const product of affectedProducts.rows) {
      // Calculate total available from all FIFO sources
      const totalFromConsignment = await db.query(`
        SELECT COALESCE(SUM(quantity_available), 0) as total
        FROM consignment_lot_inventory
        WHERE product_id = $1 AND warehouse_id = $2 AND company_id = $3
          AND COALESCE(variant_id, 0) = COALESCE($4, 0)
      `, [product.product_id, product.warehouse_id, product.company_id, product.variant_id])

      const totalFromPurchase = await db.query(`
        SELECT COALESCE(SUM(quantity_available), 0) as total
        FROM purchase_lot_inventory
        WHERE product_id = $1 AND warehouse_id = $2 AND company_id = $3
          AND COALESCE(variant_id, 0) = COALESCE($4, 0)
      `, [product.product_id, product.warehouse_id, product.company_id, product.variant_id])

      const totalFromProduction = await db.query(`
        SELECT COALESCE(SUM(quantity_available), 0) as total
        FROM production_lot_inventory
        WHERE product_id = $1 AND warehouse_id = $2 AND company_id = $3
          AND COALESCE(variant_id, 0) = COALESCE($4, 0)
      `, [product.product_id, product.warehouse_id, product.company_id, product.variant_id])

      const consignmentQty = parseFloat(totalFromConsignment.rows[0]?.total) || 0
      const purchaseQty = parseFloat(totalFromPurchase.rows[0]?.total) || 0
      const productionQty = parseFloat(totalFromProduction.rows[0]?.total) || 0
      const correctTotal = consignmentQty + purchaseQty + productionQty

      // Get current warehouse stock
      const currentStock = await db.query(`
        SELECT quantity_on_hand FROM market_warehouse_stock
        WHERE product_id = $1 AND warehouse_id = $2
          AND COALESCE(variant_id, 0) = COALESCE($3, 0)
      `, [product.product_id, product.warehouse_id, product.variant_id])

      const currentQty = parseFloat(currentStock.rows[0]?.quantity_on_hand) || 0

      results.push(`\nProduct ${product.product_id} (${product.product_name}) in warehouse ${product.warehouse_id}:`)
      results.push(`  Consignment lots: ${consignmentQty}`)
      results.push(`  Purchase lots: ${purchaseQty}`)
      results.push(`  Production lots: ${productionQty}`)
      results.push(`  Correct total: ${correctTotal}`)
      results.push(`  Current stock: ${currentQty}`)

      if (Math.abs(currentQty - correctTotal) > 0.001) {
        results.push(`  ** FIXING: ${currentQty} -> ${correctTotal} **`)

        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = $1, updated_at = NOW()
          WHERE product_id = $2 AND warehouse_id = $3
            AND COALESCE(variant_id, 0) = COALESCE($4, 0)
        `, [correctTotal, product.product_id, product.warehouse_id, product.variant_id])
      } else {
        results.push(`  OK - no fix needed`)
      }
    }

    // 4. Specifically check product 150
    results.push('\n=== SPECIFIC CHECK FOR PRODUCT 150 ===')

    const product150 = await db.query(`
      SELECT
        mws.warehouse_id,
        mws.quantity_on_hand,
        mw.name as warehouse_name
      FROM market_warehouse_stock mws
      LEFT JOIN market_warehouses mw ON mw.id = mws.warehouse_id
      WHERE mws.product_id = 150
    `)

    for (const stock of product150.rows) {
      results.push(`Warehouse ${stock.warehouse_name}: ${stock.quantity_on_hand} units`)
    }

    const product150Lots = await db.query(`
      SELECT
        'production' as source,
        lot_number,
        quantity_initial,
        quantity_available,
        production_order_id as order_id
      FROM production_lot_inventory WHERE product_id = 150
      UNION ALL
      SELECT
        'consignment' as source,
        lot_number,
        quantity_initial,
        quantity_available,
        order_line_id as order_id
      FROM consignment_lot_inventory WHERE product_id = 150
      UNION ALL
      SELECT
        'purchase' as source,
        lot_number,
        quantity_initial,
        quantity_available,
        purchase_line_id as order_id
      FROM purchase_lot_inventory WHERE product_id = 150
    `)

    results.push(`\nProduct 150 lots:`)
    for (const lot of product150Lots.rows) {
      results.push(`  ${lot.source}: ${lot.lot_number} - initial: ${lot.quantity_initial}, available: ${lot.quantity_available}`)
    }

    results.push('\n=== MIGRATION COMPLETE ===')

    return NextResponse.json({
      success: true,
      message: 'Production stock fix completed',
      details: results
    })

  } catch (error) {
    console.error('[Fix Production Stock] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: results
    }, { status: 500 })
  }
}
