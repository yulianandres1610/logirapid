import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/migrations/remittance-orders-columns
 * Add missing columns to remittance_orders table
 */
export async function POST() {
  try {
    console.log('[Migration] Adding missing columns to remittance_orders...')

    const columns = [
      { name: 'delivery_proof_id', type: 'INTEGER' },
      { name: 'delivered_by_user_id', type: 'INTEGER' },
      { name: 'delivered_at', type: 'TIMESTAMP' },
      { name: 'delivery_proof_photo', type: 'TEXT' },
      { name: 'delivery_signature', type: 'TEXT' },
      { name: 'delivery_notes', type: 'TEXT' },
      { name: 'rejection_reason', type: 'VARCHAR(100)' },
      { name: 'rejection_notes', type: 'TEXT' },
      { name: 'rejected_at', type: 'TIMESTAMP' },
      { name: 'rejected_by_user_id', type: 'INTEGER' },
      { name: 'cancelled_at', type: 'TIMESTAMP' },
      { name: 'cancelled_by_user_id', type: 'INTEGER' },
      { name: 'cancellation_reason', type: 'TEXT' },
      { name: 'confirmed_at', type: 'TIMESTAMP' },
      { name: 'in_delivery_at', type: 'TIMESTAMP' }
    ]

    const results: string[] = []

    for (const col of columns) {
      try {
        await db.query(`
          ALTER TABLE remittance_orders
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        results.push(`${col.name}: added`)
        console.log(`[Migration] Added column ${col.name}`)
      } catch (e: any) {
        if (e.message.includes('already exists')) {
          results.push(`${col.name}: already exists`)
        } else {
          results.push(`${col.name}: error - ${e.message}`)
          console.error(`[Migration] Error adding ${col.name}:`, e.message)
        }
      }
    }

    // Verify columns exist
    const checkResult = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'remittance_orders'
      AND column_name IN ('delivery_proof_id', 'delivered_by_user_id', 'delivered_at', 'rejection_reason')
    `)

    return NextResponse.json({
      success: true,
      message: 'Columns migration completed',
      results,
      verifiedColumns: checkResult.rows.map(r => r.column_name)
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
    const result = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'remittance_orders'
      ORDER BY ordinal_position
    `)

    const requiredColumns = [
      'delivery_proof_id', 'delivered_by_user_id', 'delivered_at',
      'rejection_reason', 'rejected_at', 'cancelled_at', 'confirmed_at', 'in_delivery_at'
    ]

    const existingColumns = result.rows.map(r => r.column_name)
    const missingColumns = requiredColumns.filter(c => !existingColumns.includes(c))

    return NextResponse.json({
      success: true,
      totalColumns: result.rows.length,
      existingColumns,
      missingColumns,
      needsMigration: missingColumns.length > 0
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
