import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/migrations/apacargo-integration
 * Add ApaCargo integration columns to package_orders table
 */
export async function POST() {
  try {
    console.log('[Migration] Adding ApaCargo integration columns to package_orders...')

    const columns = [
      { name: 'apacargo_order_id', type: 'INTEGER' },
      { name: 'apacargo_code', type: 'VARCHAR(100)' },
      { name: 'apacargo_synced_at', type: 'TIMESTAMP' },
      { name: 'apacargo_status', type: 'VARCHAR(50)' },
      { name: 'apacargo_error', type: 'TEXT' },
    ]

    const results: string[] = []

    for (const col of columns) {
      try {
        await db.query(`
          ALTER TABLE package_orders
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        results.push(`${col.name}: added`)
        console.log(`[Migration] Added column ${col.name}`)
      } catch (e: unknown) {
        const error = e as Error
        if (error.message.includes('already exists')) {
          results.push(`${col.name}: already exists`)
        } else {
          results.push(`${col.name}: error - ${error.message}`)
          console.error(`[Migration] Error adding ${col.name}:`, error.message)
        }
      }
    }

    // Create index for faster lookups by apacargo_code
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_package_orders_apacargo_code
        ON package_orders(apacargo_code)
        WHERE apacargo_code IS NOT NULL
      `)
      results.push('idx_package_orders_apacargo_code: created')
    } catch (e: unknown) {
      const error = e as Error
      results.push(`index: error - ${error.message}`)
    }

    // Verify columns exist
    const checkResult = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'package_orders'
      AND column_name IN ('apacargo_order_id', 'apacargo_code', 'apacargo_synced_at', 'apacargo_status')
    `)

    return NextResponse.json({
      success: true,
      message: 'ApaCargo integration migration completed',
      results,
      verifiedColumns: checkResult.rows.map(r => r.column_name)
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
    const result = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'package_orders'
      AND column_name LIKE 'apacargo%'
      ORDER BY ordinal_position
    `)

    const requiredColumns = [
      'apacargo_order_id', 'apacargo_code', 'apacargo_synced_at', 'apacargo_status'
    ]

    const existingColumns = result.rows.map(r => r.column_name)
    const missingColumns = requiredColumns.filter(c => !existingColumns.includes(c))

    return NextResponse.json({
      success: true,
      apacargoColumns: result.rows,
      missingColumns,
      needsMigration: missingColumns.length > 0
    })

  } catch (error: unknown) {
    const err = error as Error
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}
