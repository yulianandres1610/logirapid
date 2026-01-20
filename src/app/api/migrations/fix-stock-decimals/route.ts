import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/fix-stock-decimals
 * Migration to change stock quantity fields from INTEGER to DECIMAL
 * This allows storing decimal quantities like 117.70 kg
 */
export async function POST() {
  try {
    console.log('[Migration] Starting fix-stock-decimals migration...')

    // 1. Alter market_warehouse_stock table
    console.log('[Migration] Altering market_warehouse_stock table...')

    await db.query(`
      ALTER TABLE market_warehouse_stock
      ALTER COLUMN quantity_on_hand TYPE DECIMAL(15,3) USING quantity_on_hand::DECIMAL(15,3)
    `)
    console.log('[Migration] Changed quantity_on_hand to DECIMAL(15,3)')

    await db.query(`
      ALTER TABLE market_warehouse_stock
      ALTER COLUMN quantity_reserved TYPE DECIMAL(15,3) USING quantity_reserved::DECIMAL(15,3)
    `)
    console.log('[Migration] Changed quantity_reserved to DECIMAL(15,3)')

    // 2. Alter market_stock_movements table if it has quantity fields
    console.log('[Migration] Altering market_stock_movements table...')

    try {
      await db.query(`
        ALTER TABLE market_stock_movements
        ALTER COLUMN quantity TYPE DECIMAL(15,3) USING quantity::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_stock_movements.quantity to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_stock_movements.quantity already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE market_stock_movements
        ALTER COLUMN quantity_before TYPE DECIMAL(15,3) USING quantity_before::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_stock_movements.quantity_before to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_stock_movements.quantity_before already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE market_stock_movements
        ALTER COLUMN quantity_after TYPE DECIMAL(15,3) USING quantity_after::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_stock_movements.quantity_after to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_stock_movements.quantity_after already DECIMAL or does not exist')
    }

    // 3. Alter market_warehouse_operation_lines table
    console.log('[Migration] Altering market_warehouse_operation_lines table...')

    try {
      await db.query(`
        ALTER TABLE market_warehouse_operation_lines
        ALTER COLUMN quantity_planned TYPE DECIMAL(15,3) USING quantity_planned::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_warehouse_operation_lines.quantity_planned to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_warehouse_operation_lines.quantity_planned already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE market_warehouse_operation_lines
        ALTER COLUMN quantity_done TYPE DECIMAL(15,3) USING quantity_done::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_warehouse_operation_lines.quantity_done to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_warehouse_operation_lines.quantity_done already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE market_warehouse_operation_lines
        ALTER COLUMN quantity TYPE DECIMAL(15,3) USING quantity::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_warehouse_operation_lines.quantity to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_warehouse_operation_lines.quantity already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE market_warehouse_operation_lines
        ALTER COLUMN quantity_received TYPE DECIMAL(15,3) USING quantity_received::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_warehouse_operation_lines.quantity_received to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_warehouse_operation_lines.quantity_received already DECIMAL or does not exist')
    }

    // 4. Alter consignment_order_items table
    console.log('[Migration] Altering consignment_order_items table...')

    try {
      await db.query(`
        ALTER TABLE consignment_order_items
        ALTER COLUMN quantity TYPE DECIMAL(15,3) USING quantity::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed consignment_order_items.quantity to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] consignment_order_items.quantity already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE consignment_order_items
        ALTER COLUMN quantity_received TYPE DECIMAL(15,3) USING quantity_received::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed consignment_order_items.quantity_received to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] consignment_order_items.quantity_received already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE consignment_order_items
        ALTER COLUMN quantity_sold TYPE DECIMAL(15,3) USING quantity_sold::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed consignment_order_items.quantity_sold to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] consignment_order_items.quantity_sold already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE consignment_order_items
        ALTER COLUMN quantity_returned TYPE DECIMAL(15,3) USING quantity_returned::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed consignment_order_items.quantity_returned to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] consignment_order_items.quantity_returned already DECIMAL or does not exist')
    }

    // 5. Alter market_purchase_items table
    console.log('[Migration] Altering market_purchase_items table...')

    try {
      await db.query(`
        ALTER TABLE market_purchase_items
        ALTER COLUMN quantity TYPE DECIMAL(15,3) USING quantity::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_purchase_items.quantity to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_purchase_items.quantity already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE market_purchase_items
        ALTER COLUMN quantity_received TYPE DECIMAL(15,3) USING quantity_received::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_purchase_items.quantity_received to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_purchase_items.quantity_received already DECIMAL or does not exist')
    }

    // 6. Alter market_products table (minimum_stock, quantity_on_hand, quantity_expected)
    console.log('[Migration] Altering market_products table...')

    try {
      await db.query(`
        ALTER TABLE market_products
        ALTER COLUMN minimum_stock TYPE DECIMAL(15,3) USING minimum_stock::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_products.minimum_stock to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_products.minimum_stock already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE market_products
        ALTER COLUMN quantity_on_hand TYPE DECIMAL(15,3) USING quantity_on_hand::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_products.quantity_on_hand to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_products.quantity_on_hand already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE market_products
        ALTER COLUMN quantity_expected TYPE DECIMAL(15,3) USING quantity_expected::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_products.quantity_expected to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_products.quantity_expected already DECIMAL or does not exist')
    }

    // 7. Alter market_product_variants table
    console.log('[Migration] Altering market_product_variants table...')

    try {
      await db.query(`
        ALTER TABLE market_product_variants
        ALTER COLUMN quantity_on_hand TYPE DECIMAL(15,3) USING quantity_on_hand::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_product_variants.quantity_on_hand to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_product_variants.quantity_on_hand already DECIMAL or does not exist')
    }

    // 8. Alter market_purchase_lines table
    console.log('[Migration] Altering market_purchase_lines table...')

    try {
      await db.query(`
        ALTER TABLE market_purchase_lines
        ALTER COLUMN quantity TYPE DECIMAL(15,3) USING quantity::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_purchase_lines.quantity to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_purchase_lines.quantity already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE market_purchase_lines
        ALTER COLUMN quantity_received TYPE DECIMAL(15,3) USING quantity_received::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_purchase_lines.quantity_received to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_purchase_lines.quantity_received already DECIMAL or does not exist')
    }

    // 9. Alter market_order_lines table
    console.log('[Migration] Altering market_order_lines table...')

    try {
      await db.query(`
        ALTER TABLE market_order_lines
        ALTER COLUMN quantity TYPE DECIMAL(15,3) USING quantity::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_order_lines.quantity to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_order_lines.quantity already DECIMAL or does not exist')
    }

    try {
      await db.query(`
        ALTER TABLE market_order_lines
        ALTER COLUMN quantity_prepared TYPE DECIMAL(15,3) USING quantity_prepared::DECIMAL(15,3)
      `)
      console.log('[Migration] Changed market_order_lines.quantity_prepared to DECIMAL(15,3)')
    } catch (e) {
      console.log('[Migration] market_order_lines.quantity_prepared already DECIMAL or does not exist')
    }

    console.log('[Migration] fix-stock-decimals migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Migration completed: All quantity fields changed to DECIMAL(15,3)'
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
    name: 'fix-stock-decimals',
    description: 'Changes stock quantity fields from INTEGER to DECIMAL(15,3) to support decimal quantities',
    tables_affected: [
      'market_warehouse_stock',
      'market_stock_movements',
      'market_warehouse_operation_lines',
      'consignment_order_items',
      'market_purchase_items',
      'market_products',
      'market_product_variants',
      'market_purchase_lines',
      'market_order_lines'
    ],
    warning: 'Run this migration to fix decimal stock quantities. Execute: POST /api/migrations/fix-stock-decimals'
  })
}
