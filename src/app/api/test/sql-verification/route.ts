import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/test/sql-verification
 * Direct SQL verification of stock integrity
 */
export async function GET() {
  try {
    const results: Record<string, unknown> = {}

    // 1. Check variant vs warehouse stock discrepancies
    const variantCheck = await db.query(`
      SELECT
        mpv.id as variant_id,
        mpv.variant_name,
        mp.name as product_name,
        mpv.quantity_on_hand as variant_qty,
        COALESCE(SUM(mws.quantity_on_hand), 0) as warehouse_total,
        mpv.quantity_on_hand - COALESCE(SUM(mws.quantity_on_hand), 0) as difference
      FROM market_product_variants mpv
      JOIN market_products mp ON mp.id = mpv.product_id
      LEFT JOIN market_warehouse_stock mws ON mws.variant_id = mpv.id
      GROUP BY mpv.id, mpv.variant_name, mp.name, mpv.quantity_on_hand
      HAVING ABS(mpv.quantity_on_hand - COALESCE(SUM(mws.quantity_on_hand), 0)) >= 0.001
      ORDER BY ABS(mpv.quantity_on_hand - COALESCE(SUM(mws.quantity_on_hand), 0)) DESC
    `)

    results.variantDiscrepancies = {
      count: variantCheck.rows.length,
      status: variantCheck.rows.length === 0 ? 'OK' : 'ERROR',
      items: variantCheck.rows
    }

    // 2. Check if POS order lines have variant_id column
    const posLinesSchema = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'market_pos_order_lines' AND column_name = 'variant_id'
    `)

    results.posOrderLinesHasVariantId = {
      exists: posLinesSchema.rows.length > 0,
      status: posLinesSchema.rows.length > 0 ? 'OK' : 'ERROR'
    }

    // 3. Check audit counts status
    const auditStatus = await db.query(`
      SELECT count_number, status, applied_at
      FROM audit_counts
      ORDER BY id DESC
      LIMIT 5
    `)

    results.recentAudits = auditStatus.rows

    // 4. Check if warehouse_stock has proper variant records
    const warehouseStockVariants = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE variant_id IS NOT NULL) as with_variant,
        COUNT(*) FILTER (WHERE variant_id IS NULL) as without_variant
      FROM market_warehouse_stock
    `)

    results.warehouseStockBreakdown = {
      withVariant: parseInt(warehouseStockVariants.rows[0].with_variant),
      withoutVariant: parseInt(warehouseStockVariants.rows[0].without_variant)
    }

    // 5. Sample verification: pick a random variant and verify
    const sampleVariant = await db.query(`
      SELECT
        mpv.id,
        mpv.variant_name,
        mp.name as product_name,
        mpv.quantity_on_hand as variant_qty,
        COALESCE(SUM(mws.quantity_on_hand), 0) as warehouse_total,
        ARRAY_AGG(mw.name || ': ' || mws.quantity_on_hand) as warehouse_breakdown
      FROM market_product_variants mpv
      JOIN market_products mp ON mp.id = mpv.product_id
      LEFT JOIN market_warehouse_stock mws ON mws.variant_id = mpv.id
      LEFT JOIN market_warehouses mw ON mw.id = mws.warehouse_id
      WHERE mws.quantity_on_hand > 0
      GROUP BY mpv.id, mpv.variant_name, mp.name, mpv.quantity_on_hand
      ORDER BY RANDOM()
      LIMIT 1
    `)

    if (sampleVariant.rows.length > 0) {
      const sample = sampleVariant.rows[0]
      results.sampleVerification = {
        variantId: sample.id,
        variantName: sample.variant_name,
        productName: sample.product_name,
        variantQty: parseFloat(sample.variant_qty),
        warehouseTotal: parseFloat(sample.warehouse_total),
        warehouseBreakdown: sample.warehouse_breakdown,
        match: parseFloat(sample.variant_qty) === parseFloat(sample.warehouse_total),
        status: parseFloat(sample.variant_qty) === parseFloat(sample.warehouse_total) ? 'OK' : 'ERROR'
      }
    }

    // Summary
    const allOk =
      variantCheck.rows.length === 0 &&
      posLinesSchema.rows.length > 0

    return NextResponse.json({
      success: true,
      allChecksPass: allOk,
      summary: {
        variantDiscrepancies: variantCheck.rows.length,
        posOrderLinesHasVariantId: posLinesSchema.rows.length > 0,
        status: allOk ? 'TODOS LOS CHECKS PASARON' : 'HAY PROBLEMAS'
      },
      details: results
    })

  } catch (error) {
    console.error('[SQL Verification] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
