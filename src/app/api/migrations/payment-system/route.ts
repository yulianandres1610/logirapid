import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

// POST: Run the payment system migration
export async function POST(request: NextRequest) {
  try {
    console.log('[Migration] Starting payment system migration...')

    // 1. Add payment_status column
    try {
      await db.query(`
        ALTER TABLE package_orders
        ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending_payment'
      `)
      console.log('[Migration] Added payment_status column')
    } catch (err: any) {
      if (!err.message?.includes('already exists')) throw err
    }

    // 2. Add paid_amount column
    try {
      await db.query(`
        ALTER TABLE package_orders
        ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(15,2) DEFAULT 0
      `)
      console.log('[Migration] Added paid_amount column')
    } catch (err: any) {
      if (!err.message?.includes('already exists')) throw err
    }

    // 3. Add payment_confirmed_at column
    try {
      await db.query(`
        ALTER TABLE package_orders
        ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP NULL
      `)
      console.log('[Migration] Added payment_confirmed_at column')
    } catch (err: any) {
      if (!err.message?.includes('already exists')) throw err
    }

    // 4. Add payment_confirmed_by column
    try {
      await db.query(`
        ALTER TABLE package_orders
        ADD COLUMN IF NOT EXISTS payment_confirmed_by INTEGER NULL
      `)
      console.log('[Migration] Added payment_confirmed_by column')
    } catch (err: any) {
      if (!err.message?.includes('already exists')) throw err
    }

    // 5. Create order_payments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES package_orders(id) ON DELETE CASCADE,
        payment_method VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        reference VARCHAR(100),
        cash_received DECIMAL(15,2),
        change_amount DECIMAL(15,2),
        notes TEXT,
        registered_by INTEGER NOT NULL,
        registered_by_name VARCHAR(100),
        registered_at TIMESTAMP DEFAULT NOW(),
        source VARCHAR(20) DEFAULT 'dashboard',
        company_id INTEGER NOT NULL
      )
    `)
    console.log('[Migration] Created order_payments table')

    // 6. Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_order_payments_company_id ON order_payments(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_order_payments_method ON order_payments(payment_method)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_package_orders_payment_status ON package_orders(payment_status)
    `)
    console.log('[Migration] Created indexes')

    // 7. Update existing orders with payment_status
    // Orders with COD should be pending_payment
    const codResult = await db.query(`
      UPDATE package_orders
      SET payment_status = 'pending_payment'
      WHERE paymentmethod = 'cod'
        AND (payment_status IS NULL OR payment_status = '')
    `)
    console.log(`[Migration] Updated ${codResult.rowCount} COD orders to pending_payment`)

    // Orders with totalAmount = 0 are considered paid (no payment needed)
    const zeroCostResult = await db.query(`
      UPDATE package_orders
      SET payment_status = 'paid', paid_amount = 0
      WHERE (payment_status IS NULL OR payment_status = '')
        AND (totalamount = 0 OR totalamount IS NULL)
    `)
    console.log(`[Migration] Updated ${zeroCostResult.rowCount} zero-cost orders to paid`)

    // Remaining orders with amount > 0 should be pending_payment
    const pendingResult = await db.query(`
      UPDATE package_orders
      SET payment_status = 'pending_payment'
      WHERE (payment_status IS NULL OR payment_status = '')
        AND totalamount > 0
    `)
    console.log(`[Migration] Updated ${pendingResult.rowCount} orders to pending_payment`)

    return NextResponse.json({
      success: true,
      message: 'Payment system migration completed successfully',
      details: {
        codOrdersUpdated: codResult.rowCount,
        zeroCostOrdersUpdated: zeroCostResult.rowCount,
        pendingOrdersUpdated: pendingResult.rowCount
      }
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET: Check migration status
export async function GET(request: NextRequest) {
  try {
    // Check if columns exist
    const columnsCheck = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'package_orders'
      AND column_name IN ('payment_status', 'paid_amount', 'payment_confirmed_at', 'payment_confirmed_by')
    `)

    // Check if order_payments table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'order_payments'
      ) as exists
    `)

    // Count orders by payment_status
    const statusCount = await db.query(`
      SELECT payment_status, COUNT(*) as count
      FROM package_orders
      GROUP BY payment_status
    `)

    return NextResponse.json({
      success: true,
      data: {
        columnsExist: columnsCheck.rows.map(r => r.column_name),
        orderPaymentsTableExists: tableCheck.rows[0]?.exists || false,
        paymentStatusCounts: statusCount.rows
      }
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to check migration status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
