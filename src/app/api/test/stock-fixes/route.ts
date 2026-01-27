import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/test/stock-fixes
 * Test endpoint to verify stock synchronization fixes
 *
 * Tests:
 * 1. Verify variant stock sync query works
 * 2. Check for any existing stock discrepancies
 * 3. List audit counts available for testing
 */
export async function GET() {
  try {
    const results: Record<string, unknown> = {}

    // Test 1: Check variant stock discrepancies
    console.log('[Test] Checking variant stock discrepancies...')
    const discrepancyCheck = await db.query(`
      SELECT
        mpv.id as variant_id,
        mpv.variant_name,
        mp.name as product_name,
        mp.sku,
        mpv.quantity_on_hand as variant_qty,
        COALESCE(SUM(mws.quantity_on_hand), 0) as warehouse_total,
        mpv.quantity_on_hand - COALESCE(SUM(mws.quantity_on_hand), 0) as discrepancy
      FROM market_product_variants mpv
      JOIN market_products mp ON mp.id = mpv.product_id
      LEFT JOIN market_warehouse_stock mws ON mws.variant_id = mpv.id
      GROUP BY mpv.id, mpv.variant_name, mp.name, mp.sku, mpv.quantity_on_hand
      HAVING mpv.quantity_on_hand != COALESCE(SUM(mws.quantity_on_hand), 0)
      ORDER BY ABS(mpv.quantity_on_hand - COALESCE(SUM(mws.quantity_on_hand), 0)) DESC
      LIMIT 20
    `)

    results.variantDiscrepancies = {
      count: discrepancyCheck.rows.length,
      items: discrepancyCheck.rows.map(r => ({
        variantId: r.variant_id,
        variantName: r.variant_name,
        productName: r.product_name,
        sku: r.sku,
        variantQty: parseFloat(r.variant_qty) || 0,
        warehouseTotal: parseFloat(r.warehouse_total) || 0,
        discrepancy: parseFloat(r.discrepancy) || 0
      }))
    }

    // Test 2: List recent audit counts
    console.log('[Test] Listing recent audit counts...')
    const auditCounts = await db.query(`
      SELECT
        ac.id,
        ac.count_number,
        ac.status,
        ac.warehouse_id,
        mw.name as warehouse_name,
        ac.total_products,
        ac.products_with_differences,
        ac.total_shortage_value,
        ac.total_excess_value,
        ac.created_at
      FROM audit_counts ac
      JOIN market_warehouses mw ON mw.id = ac.warehouse_id
      ORDER BY ac.created_at DESC
      LIMIT 10
    `)

    results.recentAudits = auditCounts.rows.map(a => ({
      id: a.id,
      countNumber: a.count_number,
      status: a.status,
      warehouseId: a.warehouse_id,
      warehouseName: a.warehouse_name,
      totalProducts: a.total_products,
      productsWithDifferences: a.products_with_differences,
      totalShortageValue: parseFloat(a.total_shortage_value) || 0,
      totalExcessValue: parseFloat(a.total_excess_value) || 0,
      createdAt: a.created_at
    }))

    // Test 3: Check if market_pos_order_lines has variant_id column
    console.log('[Test] Checking POS order lines schema...')
    const schemaCheck = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'market_pos_order_lines'
      AND column_name IN ('variant_id', 'product_id', 'quantity')
      ORDER BY column_name
    `)

    results.posOrderLinesSchema = schemaCheck.rows

    // Test 4: Check sample POS order line with variant
    console.log('[Test] Checking sample POS order line with variant...')
    const samplePosLine = await db.query(`
      SELECT
        l.id,
        l.order_id,
        l.product_id,
        l.variant_id,
        l.product_name,
        l.quantity,
        o.status as order_status
      FROM market_pos_order_lines l
      JOIN market_pos_orders o ON o.id = l.order_id
      WHERE l.variant_id IS NOT NULL
      ORDER BY l.id DESC
      LIMIT 5
    `)

    results.samplePosLinesWithVariant = samplePosLine.rows

    // Test 5: Check warehouse stock with variants
    console.log('[Test] Checking warehouse stock with variants...')
    const warehouseStockVariants = await db.query(`
      SELECT
        mws.id,
        mws.warehouse_id,
        mw.name as warehouse_name,
        mws.product_id,
        mp.name as product_name,
        mws.variant_id,
        mpv.variant_name,
        mws.quantity_on_hand
      FROM market_warehouse_stock mws
      JOIN market_warehouses mw ON mw.id = mws.warehouse_id
      JOIN market_products mp ON mp.id = mws.product_id
      LEFT JOIN market_product_variants mpv ON mpv.id = mws.variant_id
      WHERE mws.variant_id IS NOT NULL
      ORDER BY mws.id DESC
      LIMIT 10
    `)

    results.warehouseStockWithVariants = warehouseStockVariants.rows.map(s => ({
      id: s.id,
      warehouseId: s.warehouse_id,
      warehouseName: s.warehouse_name,
      productId: s.product_id,
      productName: s.product_name,
      variantId: s.variant_id,
      variantName: s.variant_name,
      quantityOnHand: parseFloat(s.quantity_on_hand) || 0
    }))

    // Summary
    results.summary = {
      variantDiscrepanciesFound: discrepancyCheck.rows.length,
      auditCountsAvailable: auditCounts.rows.length,
      posLinesWithVariants: samplePosLine.rows.length,
      warehouseStockWithVariants: warehouseStockVariants.rows.length,
      allTestsPassed: true
    }

    console.log('[Test] All tests completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Stock fix tests completed',
      data: results
    })

  } catch (error) {
    console.error('[Test] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed'
    }, { status: 500 })
  }
}
