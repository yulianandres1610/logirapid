import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/fix-operation-variants
 * Migration to fix operation lines that are missing variant_id
 * This updates existing transfer operations with the correct variant information
 */
export async function POST() {
  try {
    console.log('[Migration] Starting fix-operation-variants migration...')

    // Get all operation lines that don't have a variant_id but should
    // (products that have variants)
    const linesResult = await db.query(`
      SELECT DISTINCT
        ol.id as line_id,
        ol.operation_id,
        ol.product_id,
        ol.variant_id,
        p.name as product_name
      FROM market_warehouse_operation_lines ol
      JOIN market_products p ON p.id = ol.product_id
      WHERE ol.variant_id IS NULL
      ORDER BY ol.operation_id, ol.id
    `)

    console.log(`[Migration] Found ${linesResult.rows.length} operation lines without variant_id`)

    let updatedCount = 0
    let skippedCount = 0
    const updates: { lineId: number; productName: string; variantName: string }[] = []

    for (const line of linesResult.rows) {
      // Check if this product has variants
      const variantsResult = await db.query(`
        SELECT id, variant_name, sku
        FROM market_product_variants
        WHERE product_id = $1
        ORDER BY id
      `, [line.product_id])

      if (variantsResult.rows.length === 0) {
        // Product has no variants, skip
        skippedCount++
        continue
      }

      if (variantsResult.rows.length === 1) {
        // Product has exactly one variant - use it
        const variant = variantsResult.rows[0]
        await db.query(`
          UPDATE market_warehouse_operation_lines
          SET variant_id = $1
          WHERE id = $2
        `, [variant.id, line.line_id])

        updates.push({
          lineId: line.line_id,
          productName: line.product_name,
          variantName: variant.variant_name
        })
        updatedCount++
        console.log(`[Migration] Updated line ${line.line_id}: ${line.product_name} -> ${variant.variant_name}`)
      } else {
        // Product has multiple variants - try to match based on operation context
        // Strategy: Look at what stock was reserved in source warehouse
        const operationResult = await db.query(`
          SELECT source_warehouse_id, destination_warehouse_id
          FROM market_warehouse_operations
          WHERE id = $1
        `, [line.operation_id])

        if (operationResult.rows.length > 0) {
          const op = operationResult.rows[0]

          // Check which variant has reserved stock in the source warehouse
          const stockResult = await db.query(`
            SELECT ws.variant_id, v.variant_name
            FROM market_warehouse_stock ws
            JOIN market_product_variants v ON v.id = ws.variant_id
            WHERE ws.warehouse_id = $1
              AND ws.product_id = $2
              AND ws.variant_id IS NOT NULL
              AND ws.quantity_reserved > 0
            LIMIT 1
          `, [op.source_warehouse_id, line.product_id])

          if (stockResult.rows.length > 0) {
            const variant = stockResult.rows[0]
            await db.query(`
              UPDATE market_warehouse_operation_lines
              SET variant_id = $1
              WHERE id = $2
            `, [variant.variant_id, line.line_id])

            updates.push({
              lineId: line.line_id,
              productName: line.product_name,
              variantName: variant.variant_name
            })
            updatedCount++
            console.log(`[Migration] Updated line ${line.line_id}: ${line.product_name} -> ${variant.variant_name} (from reserved stock)`)
          } else {
            // Try to find any variant with stock in source warehouse
            const anyStockResult = await db.query(`
              SELECT ws.variant_id, v.variant_name
              FROM market_warehouse_stock ws
              JOIN market_product_variants v ON v.id = ws.variant_id
              WHERE ws.warehouse_id = $1
                AND ws.product_id = $2
                AND ws.variant_id IS NOT NULL
              ORDER BY ws.quantity_on_hand DESC
              LIMIT 1
            `, [op.source_warehouse_id, line.product_id])

            if (anyStockResult.rows.length > 0) {
              const variant = anyStockResult.rows[0]
              await db.query(`
                UPDATE market_warehouse_operation_lines
                SET variant_id = $1
                WHERE id = $2
              `, [variant.variant_id, line.line_id])

              updates.push({
                lineId: line.line_id,
                productName: line.product_name,
                variantName: variant.variant_name
              })
              updatedCount++
              console.log(`[Migration] Updated line ${line.line_id}: ${line.product_name} -> ${variant.variant_name} (from available stock)`)
            } else {
              // Last resort: use the first variant
              const firstVariant = variantsResult.rows[0]
              await db.query(`
                UPDATE market_warehouse_operation_lines
                SET variant_id = $1
                WHERE id = $2
              `, [firstVariant.id, line.line_id])

              updates.push({
                lineId: line.line_id,
                productName: line.product_name,
                variantName: firstVariant.variant_name
              })
              updatedCount++
              console.log(`[Migration] Updated line ${line.line_id}: ${line.product_name} -> ${firstVariant.variant_name} (first variant fallback)`)
            }
          }
        } else {
          skippedCount++
        }
      }
    }

    console.log(`[Migration] fix-operation-variants completed: ${updatedCount} updated, ${skippedCount} skipped`)

    return NextResponse.json({
      success: true,
      message: `Migration completed: ${updatedCount} lines updated, ${skippedCount} skipped`,
      data: {
        totalProcessed: linesResult.rows.length,
        updated: updatedCount,
        skipped: skippedCount,
        updates
      }
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'fix-operation-variants',
    description: 'Updates operation lines that are missing variant_id with the correct variant information',
    usage: 'POST /api/migrations/fix-operation-variants'
  })
}
