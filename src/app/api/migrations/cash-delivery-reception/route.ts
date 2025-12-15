import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    console.log('[Migration] Starting cash_delivery_orders reception columns migration...')

    // Add missing columns for the reception flow
    const alterations = [
      // Reception process columns
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS reception_started_at TIMESTAMP`,
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS received_bill_denominations JSONB`,
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS received_total_amount DECIMAL(15,2)`,
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS amount_matches BOOLEAN DEFAULT false`,

      // OTP columns
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS otp_code VARCHAR(10)`,
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS otp_sent_at TIMESTAMP`,
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP`,
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0`,

      // Completion columns
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`,
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS completed_by_user_id INTEGER`,
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS wallet_transaction_id INTEGER`,
      `ALTER TABLE cash_delivery_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`
    ]

    const results: { query: string; success: boolean; error?: string }[] = []

    for (const sql of alterations) {
      try {
        await db.query(sql)
        results.push({ query: sql, success: true })
        console.log(`[Migration] Success: ${sql.substring(0, 80)}...`)
      } catch (error: any) {
        // Ignore "column already exists" errors
        if (error.code === '42701') {
          results.push({ query: sql, success: true, error: 'Column already exists (OK)' })
          console.log(`[Migration] Column already exists: ${sql.substring(0, 80)}...`)
        } else {
          results.push({ query: sql, success: false, error: error.message })
          console.error(`[Migration] Error: ${sql}`, error.message)
        }
      }
    }

    // Verify table structure
    const columnsResult = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'cash_delivery_orders'
      ORDER BY ordinal_position
    `)

    console.log('[Migration] Cash delivery orders migration completed')

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
      columns: columnsResult.rows
    })

  } catch (error: any) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check current table structure
    const columnsResult = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cash_delivery_orders'
      ORDER BY ordinal_position
    `)

    const requiredColumns = [
      'reception_started_at',
      'received_bill_denominations',
      'received_total_amount',
      'amount_matches',
      'otp_code',
      'otp_sent_at',
      'otp_expires_at',
      'otp_attempts',
      'completed_at',
      'completed_by_user_id',
      'wallet_transaction_id',
      'updated_at'
    ]

    const existingColumns = columnsResult.rows.map((r: any) => r.column_name)
    const missingColumns = requiredColumns.filter(c => !existingColumns.includes(c))

    return NextResponse.json({
      success: true,
      tableExists: columnsResult.rows.length > 0,
      columns: columnsResult.rows,
      requiredColumns,
      missingColumns,
      needsMigration: missingColumns.length > 0
    })

  } catch (error: any) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
