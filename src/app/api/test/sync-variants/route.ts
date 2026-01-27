import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/test/sync-variants
 * Synchronize all market_product_variants.quantity_on_hand
 * with the sum of market_warehouse_stock.quantity_on_hand
 *
 * This fixes any existing discrepancies caused by bugs in transfers and POS void/refund
 */
export async function POST() {
  try {
    console.log('[Sync Variants] Starting variant stock synchronization...')

    // Get all variants with their warehouse totals
    const variantsResult = await db.query(`
      SELECT
        mpv.id as variant_id,
        mpv.variant_name,
        mp.name as product_name,
        mpv.quantity_on_hand as current_qty,
        COALESCE(SUM(mws.quantity_on_hand), 0) as warehouse_total
      FROM market_product_variants mpv
      JOIN market_products mp ON mp.id = mpv.product_id
      LEFT JOIN market_warehouse_stock mws ON mws.variant_id = mpv.id
      GROUP BY mpv.id, mpv.variant_name, mp.name, mpv.quantity_on_hand
    `)

    let updatedCount = 0
    let discrepanciesFixed = 0
    const fixes: Array<{
      variantId: number
      variantName: string
      productName: string
      oldQty: number
      newQty: number
      difference: number
    }> = []

    await db.query('BEGIN')

    try {
      for (const variant of variantsResult.rows) {
        const currentQty = parseFloat(variant.current_qty) || 0
        const warehouseTotal = parseFloat(variant.warehouse_total) || 0

        // Check if there's a discrepancy (with small tolerance for floating point)
        if (Math.abs(currentQty - warehouseTotal) >= 0.001) {
          await db.query(`
            UPDATE market_product_variants
            SET quantity_on_hand = $1, updated_at = NOW()
            WHERE id = $2
          `, [warehouseTotal, variant.variant_id])

          fixes.push({
            variantId: variant.variant_id,
            variantName: variant.variant_name,
            productName: variant.product_name,
            oldQty: currentQty,
            newQty: warehouseTotal,
            difference: warehouseTotal - currentQty
          })

          discrepanciesFixed++
          console.log(`[Sync Variants] Fixed variant ${variant.variant_id} (${variant.variant_name}): ${currentQty} -> ${warehouseTotal}`)
        }

        updatedCount++
      }

      await db.query('COMMIT')

      console.log(`[Sync Variants] Completed. Checked ${updatedCount} variants, fixed ${discrepanciesFixed} discrepancies`)

      return NextResponse.json({
        success: true,
        message: `Sincronización completada. ${discrepanciesFixed} discrepancias corregidas.`,
        data: {
          totalVariantsChecked: updatedCount,
          discrepanciesFixed,
          fixes
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Sync Variants] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al sincronizar variantes'
    }, { status: 500 })
  }
}

/**
 * GET /api/test/sync-variants
 * Preview what would be synced without making changes
 */
export async function GET() {
  try {
    // Get all variants with discrepancies
    const discrepancyResult = await db.query(`
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
      HAVING ABS(mpv.quantity_on_hand - COALESCE(SUM(mws.quantity_on_hand), 0)) >= 0.001
      ORDER BY ABS(mpv.quantity_on_hand - COALESCE(SUM(mws.quantity_on_hand), 0)) DESC
    `)

    return NextResponse.json({
      success: true,
      message: `${discrepancyResult.rows.length} variantes con discrepancias encontradas`,
      data: {
        discrepancyCount: discrepancyResult.rows.length,
        discrepancies: discrepancyResult.rows.map(r => ({
          variantId: r.variant_id,
          variantName: r.variant_name,
          productName: r.product_name,
          sku: r.sku,
          currentVariantQty: parseFloat(r.variant_qty) || 0,
          correctWarehouseTotal: parseFloat(r.warehouse_total) || 0,
          discrepancy: parseFloat(r.discrepancy) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Sync Variants Preview] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener vista previa'
    }, { status: 500 })
  }
}
