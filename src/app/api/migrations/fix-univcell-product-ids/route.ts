import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/migrations/fix-univcell-product-ids
 *
 * Migration to fix univcell_product_id for manually created products.
 * Sets univcell_product_id = 7 (Cubacel CUP) for Cuban phone recharge products.
 */
export async function GET() {
  try {
    const results: string[] = []

    // Get all Cuban products with negative external_id (manually created)
    // that don't have univcell_product_id set
    const productsToFix = await db.query(`
      SELECT id, external_id, univcell_product_id, name, country_code
      FROM external_recharge_products
      WHERE country_code = 'CU'
        AND external_id < 0
        AND (univcell_product_id IS NULL OR univcell_product_id != 7)
        AND slug NOT LIKE '%nauta%'
        AND name NOT ILIKE '%nauta%'
    `)

    results.push(`Found ${productsToFix.rows.length} products to fix`)

    for (const product of productsToFix.rows) {
      // Update to use Cubacel CUP product ID (7)
      await db.query(`
        UPDATE external_recharge_products
        SET univcell_product_id = 7, updated_at = NOW()
        WHERE id = $1
      `, [product.id])

      results.push(`Fixed product ${product.id}: ${product.name} -> univcell_product_id = 7`)
    }

    // Also fix Nauta products to use product ID 8
    const nautaProducts = await db.query(`
      SELECT id, external_id, univcell_product_id, name, country_code
      FROM external_recharge_products
      WHERE country_code = 'CU'
        AND external_id < 0
        AND (univcell_product_id IS NULL OR univcell_product_id != 8)
        AND (slug LIKE '%nauta%' OR name ILIKE '%nauta%')
    `)

    results.push(`Found ${nautaProducts.rows.length} Nauta products to fix`)

    for (const product of nautaProducts.rows) {
      // Update to use Nauta CUP product ID (8)
      await db.query(`
        UPDATE external_recharge_products
        SET univcell_product_id = 8, updated_at = NOW()
        WHERE id = $1
      `, [product.id])

      results.push(`Fixed Nauta product ${product.id}: ${product.name} -> univcell_product_id = 8`)
    }

    // Log current state
    const currentState = await db.query(`
      SELECT id, external_id, univcell_product_id, name, country_code
      FROM external_recharge_products
      WHERE country_code = 'CU'
      ORDER BY id
    `)

    results.push('')
    results.push('Current Cuban products state:')
    currentState.rows.forEach(p => {
      results.push(`  ID ${p.id}: ext=${p.external_id}, univ=${p.univcell_product_id}, name=${p.name}`)
    })

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results
    })

  } catch (error: any) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Migration failed'
    }, { status: 500 })
  }
}
