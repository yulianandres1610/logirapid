import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/fix-decimal-quantities
 * Fix INTEGER columns to DECIMAL for products sold by weight/volume
 */
export async function POST() {
  try {
    console.log('[Migration] Starting decimal quantities fix...')
    const results: string[] = []

    // Fix consignment_lot_inventory
    const lotTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'consignment_lot_inventory'
      ) as exists
    `)

    if (lotTableCheck.rows[0]?.exists) {
      try {
        await db.query(`
          ALTER TABLE consignment_lot_inventory
          ALTER COLUMN quantity_initial TYPE DECIMAL(12,3) USING quantity_initial::DECIMAL(12,3),
          ALTER COLUMN quantity_available TYPE DECIMAL(12,3) USING quantity_available::DECIMAL(12,3),
          ALTER COLUMN quantity_sold TYPE DECIMAL(12,3) USING quantity_sold::DECIMAL(12,3),
          ALTER COLUMN quantity_returned TYPE DECIMAL(12,3) USING quantity_returned::DECIMAL(12,3)
        `)
        results.push('consignment_lot_inventory: OK')
        console.log('[Migration] Fixed consignment_lot_inventory columns to DECIMAL')
      } catch (e) {
        results.push(`consignment_lot_inventory: ${e instanceof Error ? e.message : 'error'}`)
      }
    } else {
      results.push('consignment_lot_inventory: table not found')
    }

    // Fix consignment_order_lines
    const orderLinesTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'consignment_order_lines'
      ) as exists
    `)

    if (orderLinesTableCheck.rows[0]?.exists) {
      try {
        await db.query(`
          ALTER TABLE consignment_order_lines
          ALTER COLUMN quantity_ordered TYPE DECIMAL(12,3) USING quantity_ordered::DECIMAL(12,3),
          ALTER COLUMN quantity_received TYPE DECIMAL(12,3) USING quantity_received::DECIMAL(12,3),
          ALTER COLUMN quantity_sold TYPE DECIMAL(12,3) USING quantity_sold::DECIMAL(12,3),
          ALTER COLUMN quantity_returned TYPE DECIMAL(12,3) USING quantity_returned::DECIMAL(12,3)
        `)
        results.push('consignment_order_lines: OK')
        console.log('[Migration] Fixed consignment_order_lines columns to DECIMAL')
      } catch (e) {
        results.push(`consignment_order_lines: ${e instanceof Error ? e.message : 'error'}`)
      }
    } else {
      results.push('consignment_order_lines: table not found')
    }

    // Fix purchase_lot_inventory
    const purchaseLotTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'purchase_lot_inventory'
      ) as exists
    `)

    if (purchaseLotTableCheck.rows[0]?.exists) {
      try {
        await db.query(`
          ALTER TABLE purchase_lot_inventory
          ALTER COLUMN quantity_initial TYPE DECIMAL(12,3) USING quantity_initial::DECIMAL(12,3),
          ALTER COLUMN quantity_available TYPE DECIMAL(12,3) USING quantity_available::DECIMAL(12,3),
          ALTER COLUMN quantity_sold TYPE DECIMAL(12,3) USING quantity_sold::DECIMAL(12,3)
        `)
        results.push('purchase_lot_inventory: OK')
        console.log('[Migration] Fixed purchase_lot_inventory columns to DECIMAL')
      } catch (e) {
        results.push(`purchase_lot_inventory: ${e instanceof Error ? e.message : 'error'}`)
      }
    } else {
      results.push('purchase_lot_inventory: table not found')
    }

    // Fix consignment_wallet_transactions
    const walletTxTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'consignment_wallet_transactions'
      ) as exists
    `)

    if (walletTxTableCheck.rows[0]?.exists) {
      try {
        await db.query(`
          ALTER TABLE consignment_wallet_transactions
          ALTER COLUMN quantity TYPE DECIMAL(12,3) USING quantity::DECIMAL(12,3)
        `)
        results.push('consignment_wallet_transactions: OK')
        console.log('[Migration] Fixed consignment_wallet_transactions.quantity to DECIMAL')
      } catch (e) {
        results.push(`consignment_wallet_transactions: ${e instanceof Error ? e.message : 'error'}`)
      }
    } else {
      results.push('consignment_wallet_transactions: table not found')
    }

    console.log('[Migration] Decimal quantities fix completed:', results)

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/fix-decimal-quantities
 * Check current column types
 */
export async function GET() {
  try {
    const columnInfo = await db.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_name IN (
        'consignment_lot_inventory',
        'consignment_order_lines',
        'purchase_lot_inventory',
        'consignment_wallet_transactions'
      )
      AND column_name LIKE 'quantity%'
      ORDER BY table_name, column_name
    `)

    return NextResponse.json({
      success: true,
      columns: columnInfo.rows
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed'
    }, { status: 500 })
  }
}
