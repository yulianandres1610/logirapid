import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Migration: Add variant_id support to all relevant tables
 *
 * Tables affected:
 * - market_pos_order_lines: Add variant_id for POS sales
 * - market_purchase_lines: Add variant_id for purchases
 * - consignment_order_lines: Add variant_id for consignments
 * - consignment_lot_inventory: Add variant_id for FIFO inventory
 * - market_inventory_count_lines: Already has variant_id
 * - market_warehouse_operation_lines: Already has variant_id
 * - market_warehouse_stock: Already has variant_id
 */
export async function POST() {
  try {
    console.log('[Migration] Starting variant support migration...')
    const results: string[] = []

    // 1. Add variant_id to market_pos_order_lines
    try {
      await db.query(`
        ALTER TABLE market_pos_order_lines
        ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES market_product_variants(id)
      `)
      results.push('Added variant_id to market_pos_order_lines')
      console.log('[Migration] Added variant_id to market_pos_order_lines')
    } catch (e: unknown) {
      const error = e as Error
      if (!error.message.includes('already exists')) {
        console.log(`[Migration] Note: market_pos_order_lines.variant_id - ${error.message}`)
      }
    }

    // 2. Add variant_id to market_purchase_lines
    try {
      await db.query(`
        ALTER TABLE market_purchase_lines
        ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES market_product_variants(id)
      `)
      results.push('Added variant_id to market_purchase_lines')
      console.log('[Migration] Added variant_id to market_purchase_lines')
    } catch (e: unknown) {
      const error = e as Error
      if (!error.message.includes('already exists')) {
        console.log(`[Migration] Note: market_purchase_lines.variant_id - ${error.message}`)
      }
    }

    // 3. Add variant_id to consignment_order_lines
    try {
      await db.query(`
        ALTER TABLE consignment_order_lines
        ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES market_product_variants(id)
      `)
      results.push('Added variant_id to consignment_order_lines')
      console.log('[Migration] Added variant_id to consignment_order_lines')
    } catch (e: unknown) {
      const error = e as Error
      if (!error.message.includes('already exists')) {
        console.log(`[Migration] Note: consignment_order_lines.variant_id - ${error.message}`)
      }
    }

    // 4. Add variant_id to consignment_lot_inventory
    try {
      await db.query(`
        ALTER TABLE consignment_lot_inventory
        ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES market_product_variants(id)
      `)
      results.push('Added variant_id to consignment_lot_inventory')
      console.log('[Migration] Added variant_id to consignment_lot_inventory')
    } catch (e: unknown) {
      const error = e as Error
      if (!error.message.includes('already exists')) {
        console.log(`[Migration] Note: consignment_lot_inventory.variant_id - ${error.message}`)
      }
    }

    // 5. Create index for fast barcode search on product variants
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_product_variants_barcode_active
        ON market_product_variants(barcode)
        WHERE barcode IS NOT NULL AND is_active = true
      `)
      results.push('Created index idx_product_variants_barcode_active')
      console.log('[Migration] Created index for variant barcode search')
    } catch (e: unknown) {
      const error = e as Error
      if (!error.message.includes('already exists')) {
        console.log(`[Migration] Note: idx_product_variants_barcode_active - ${error.message}`)
      }
    }

    // 6. Create index for fast SKU search on product variants
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_product_variants_sku_active
        ON market_product_variants(sku)
        WHERE sku IS NOT NULL AND is_active = true
      `)
      results.push('Created index idx_product_variants_sku_active')
      console.log('[Migration] Created index for variant SKU search')
    } catch (e: unknown) {
      const error = e as Error
      if (!error.message.includes('already exists')) {
        console.log(`[Migration] Note: idx_product_variants_sku_active - ${error.message}`)
      }
    }

    // 7. Add variant indexes to line tables for faster queries
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_pos_order_lines_variant
        ON market_pos_order_lines(variant_id)
        WHERE variant_id IS NOT NULL
      `)
      results.push('Created index idx_pos_order_lines_variant')
    } catch (e: unknown) {
      // Ignore if already exists
    }

    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_purchase_lines_variant
        ON market_purchase_lines(variant_id)
        WHERE variant_id IS NOT NULL
      `)
      results.push('Created index idx_purchase_lines_variant')
    } catch (e: unknown) {
      // Ignore if already exists
    }

    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_consignment_order_lines_variant
        ON consignment_order_lines(variant_id)
        WHERE variant_id IS NOT NULL
      `)
      results.push('Created index idx_consignment_order_lines_variant')
    } catch (e: unknown) {
      // Ignore if already exists
    }

    console.log('[Migration] Variant support migration completed')

    return NextResponse.json({
      success: true,
      message: 'Variant support migration completed successfully',
      results
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Migration] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check current state of variant columns in tables
    const tables = [
      'market_pos_order_lines',
      'market_purchase_lines',
      'consignment_order_lines',
      'consignment_lot_inventory',
      'market_warehouse_stock',
      'market_warehouse_operation_lines',
      'market_inventory_count_lines'
    ]

    const status = []

    for (const table of tables) {
      try {
        const result = await db.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = $1 AND column_name = 'variant_id'
        `, [table])

        status.push({
          table,
          hasVariantId: result.rows.length > 0
        })
      } catch (e) {
        status.push({
          table,
          hasVariantId: false,
          error: 'Table not found'
        })
      }
    }

    // Check for indexes
    const indexes = await db.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE indexname LIKE '%variant%'
      ORDER BY tablename, indexname
    `)

    const needsMigration = status.some(s => !s.hasVariantId)

    return NextResponse.json({
      success: true,
      needsMigration,
      tables: status,
      variantIndexes: indexes.rows
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Migration Check] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}
