import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/cleanup-duplicate-variants
 * Removes duplicate variants from products, keeping only one of each unique option combination
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    console.log('[Cleanup Variants] Starting cleanup...')

    // Get all products with variants (or just one if productId specified)
    let productsQuery = `
      SELECT DISTINCT product_id
      FROM market_product_variants
    `
    const params: any[] = []

    if (productId) {
      productsQuery += ' WHERE product_id = $1'
      params.push(parseInt(productId))
    }

    const productsResult = await db.query(productsQuery, params)
    console.log('[Cleanup Variants] Found', productsResult.rows.length, 'products with variants')

    let totalDeleted = 0
    const cleanupResults: { productId: number; deleted: number; kept: number }[] = []

    for (const row of productsResult.rows) {
      const pid = row.product_id

      // Get all variants for this product with their options
      // Normalize names: lowercase, trim, and remove extra spaces
      const variantsResult = await db.query(`
        SELECT
          v.id,
          v.variant_name,
          v.created_at,
          LOWER(TRIM(REGEXP_REPLACE(v.variant_name, '\\s+', ' ', 'g'))) as normalized_name,
          COALESCE(
            (SELECT string_agg(
              LOWER(TRIM(vo.option_type)) || ':' || LOWER(TRIM(vo.option_value)),
              '|' ORDER BY LOWER(TRIM(vo.option_type))
            )
             FROM market_variant_options vo
             WHERE vo.variant_id = v.id),
            ''
          ) as option_key
        FROM market_product_variants v
        WHERE v.product_id = $1
        ORDER BY v.created_at ASC
      `, [pid])

      // Group by normalized_name (case-insensitive, trimmed) to find duplicates
      const groupedByKey = new Map<string, number[]>()
      for (const variant of variantsResult.rows) {
        // Use normalized name as key - this catches duplicates with different casing/spacing
        const key = variant.normalized_name || variant.variant_name?.toLowerCase().trim()
        if (!groupedByKey.has(key)) {
          groupedByKey.set(key, [])
        }
        groupedByKey.get(key)!.push(variant.id)
      }

      // Keep the first (oldest) variant of each group, delete the rest
      const idsToDelete: number[] = []
      let keptCount = 0

      for (const [key, ids] of groupedByKey.entries()) {
        if (ids.length > 1) {
          // Keep the first one (oldest), mark rest for deletion
          const [keep, ...duplicates] = ids
          idsToDelete.push(...duplicates)
          console.log(`[Cleanup Variants] Product ${pid}: Keeping variant ${keep} for "${key}", deleting duplicates:`, duplicates)
        }
        keptCount++
      }

      if (idsToDelete.length > 0) {
        // Delete variant options first
        await db.query(
          'DELETE FROM market_variant_options WHERE variant_id = ANY($1)',
          [idsToDelete]
        )

        // Delete duplicate variants
        const deleteResult = await db.query(
          'DELETE FROM market_product_variants WHERE id = ANY($1)',
          [idsToDelete]
        )

        totalDeleted += deleteResult.rowCount || 0
        cleanupResults.push({
          productId: pid,
          deleted: deleteResult.rowCount || 0,
          kept: keptCount
        })

        console.log(`[Cleanup Variants] Product ${pid}: Deleted ${deleteResult.rowCount} duplicates, kept ${keptCount} unique variants`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup complete. Deleted ${totalDeleted} duplicate variants.`,
      results: cleanupResults
    })

  } catch (error) {
    console.error('[Cleanup Variants] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error during cleanup'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/cleanup-duplicate-variants
 * Preview duplicates without deleting
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    // Get all variants grouped by product and option combination
    // Normalize names: lowercase, trim, and remove extra spaces
    let query = `
      SELECT
        v.product_id,
        p.name as product_name,
        v.id as variant_id,
        v.variant_name,
        v.created_at,
        LOWER(TRIM(REGEXP_REPLACE(v.variant_name, '\\s+', ' ', 'g'))) as normalized_name,
        COALESCE(
          (SELECT string_agg(
            LOWER(TRIM(vo.option_type)) || ':' || LOWER(TRIM(vo.option_value)),
            '|' ORDER BY LOWER(TRIM(vo.option_type))
          )
           FROM market_variant_options vo
           WHERE vo.variant_id = v.id),
          ''
        ) as option_key
      FROM market_product_variants v
      JOIN market_products p ON p.id = v.product_id
    `
    const params: any[] = []

    if (productId) {
      query += ' WHERE v.product_id = $1'
      params.push(parseInt(productId))
    }

    query += ' ORDER BY v.product_id, normalized_name, v.created_at'

    const result = await db.query(query, params)

    // Find duplicates
    const duplicates: any[] = []
    const groupedByProduct = new Map<number, Map<string, any[]>>()

    for (const row of result.rows) {
      if (!groupedByProduct.has(row.product_id)) {
        groupedByProduct.set(row.product_id, new Map())
      }
      const productMap = groupedByProduct.get(row.product_id)!
      // Use normalized name as key
      const key = row.normalized_name || row.variant_name?.toLowerCase().trim()

      if (!productMap.has(key)) {
        productMap.set(key, [])
      }
      productMap.get(key)!.push(row)
    }

    // Find products with duplicates
    for (const [productId, optionMap] of groupedByProduct.entries()) {
      for (const [optionKey, variants] of optionMap.entries()) {
        if (variants.length > 1) {
          duplicates.push({
            productId,
            productName: variants[0].product_name,
            optionKey,
            variants: variants.map(v => ({
              id: v.variant_id,
              name: v.variant_name,
              createdAt: v.created_at
            })),
            duplicateCount: variants.length - 1
          })
        }
      }
    }

    // If debug=true, also return all variants
    const debug = searchParams.get('debug') === 'true'

    return NextResponse.json({
      success: true,
      totalVariants: result.rows.length,
      totalDuplicates: duplicates.reduce((sum, d) => sum + d.duplicateCount, 0),
      duplicates,
      ...(debug && {
        allVariants: result.rows.map(r => ({
          id: r.variant_id,
          name: r.variant_name,
          normalizedName: r.normalized_name,
          optionKey: r.option_key
        }))
      })
    })

  } catch (error) {
    console.error('[Cleanup Variants Preview] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error checking duplicates'
    }, { status: 500 })
  }
}
