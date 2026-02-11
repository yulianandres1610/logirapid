import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/fix-return-columns
 * Adds missing columns to consignment return tables
 */
export async function POST() {
  try {
    console.log('[Migration] Starting fix-return-columns migration...')
    const results: string[] = []

    // 1. Add notes column to consignment_returns if not exists
    try {
      await db.query(`
        ALTER TABLE consignment_returns
        ADD COLUMN IF NOT EXISTS notes TEXT
      `)
      results.push('Added notes column to consignment_returns')
    } catch (e) {
      results.push('notes column already exists or error: ' + (e as Error).message)
    }

    // 2. Add quantity_validated column to consignment_return_lines if not exists
    try {
      await db.query(`
        ALTER TABLE consignment_return_lines
        ADD COLUMN IF NOT EXISTS quantity_validated INTEGER DEFAULT 0
      `)
      results.push('Added quantity_validated column to consignment_return_lines')
    } catch (e) {
      results.push('quantity_validated column already exists')
    }

    // 3. Add quantity_returned column to consignment_order_lines if not exists
    try {
      await db.query(`
        ALTER TABLE consignment_order_lines
        ADD COLUMN IF NOT EXISTS quantity_returned INTEGER DEFAULT 0
      `)
      results.push('Added quantity_returned column to consignment_order_lines')
    } catch (e) {
      results.push('quantity_returned column already exists')
    }

    // 4. Add total_returned column to consignment_orders if not exists
    try {
      await db.query(`
        ALTER TABLE consignment_orders
        ADD COLUMN IF NOT EXISTS total_returned DECIMAL(12,2) DEFAULT 0
      `)
      results.push('Added total_returned column to consignment_orders')
    } catch (e) {
      results.push('total_returned column already exists')
    }

    // 5. Check if supplier wallet exists for supplier 13
    try {
      const walletCheck = await db.query(`
        SELECT COUNT(*) as count FROM consignment_supplier_wallets WHERE supplier_id = 13
      `)
      if (parseInt(walletCheck.rows[0].count) === 0) {
        // Create wallet for supplier 13
        await db.query(`
          INSERT INTO consignment_supplier_wallets (supplier_id, balance_available, balance_pending, total_earned, total_paid, total_returned)
          VALUES (13, 0, 0, 0, 0, 0)
          ON CONFLICT (supplier_id) DO NOTHING
        `)
        results.push('Created wallet for supplier 13')
      } else {
        results.push('Wallet for supplier 13 already exists')
      }
    } catch (e) {
      results.push('Wallet check/creation error: ' + (e as Error).message)
    }

    // 6. Drop the UNIQUE constraint on consignment_supplier_wallets if it references consignment_suppliers
    try {
      await db.query(`
        ALTER TABLE consignment_supplier_wallets
        DROP CONSTRAINT IF EXISTS consignment_supplier_wallets_supplier_id_key
      `)
      results.push('Dropped old supplier_id unique constraint')
    } catch (e) {
      results.push('Could not drop constraint: ' + (e as Error).message)
    }

    console.log('[Migration] fix-return-columns migration completed')

    return NextResponse.json({
      success: true,
      message: 'Return columns fixed successfully',
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
 * GET /api/migrations/fix-return-columns
 * Check column status
 */
export async function GET() {
  try {
    const columns = [
      { table: 'consignment_returns', column: 'notes' },
      { table: 'consignment_return_lines', column: 'quantity_validated' },
      { table: 'consignment_order_lines', column: 'quantity_returned' },
      { table: 'consignment_orders', column: 'total_returned' }
    ]

    const status = []
    for (const col of columns) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = $1 AND column_name = $2
        ) as exists
      `, [col.table, col.column])

      status.push({
        table: col.table,
        column: col.column,
        exists: result.rows[0].exists
      })
    }

    // Check wallet for supplier 13
    let walletExists = false
    try {
      const walletCheck = await db.query(`
        SELECT COUNT(*) as count FROM consignment_supplier_wallets WHERE supplier_id = 13
      `)
      walletExists = parseInt(walletCheck.rows[0].count) > 0
    } catch {
      walletExists = false
    }

    return NextResponse.json({
      success: true,
      columns: status,
      walletForSupplier13: walletExists
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed'
    }, { status: 500 })
  }
}
