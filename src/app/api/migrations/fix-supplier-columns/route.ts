import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/fix-supplier-columns
 * Adds missing columns to market_suppliers table
 */
export async function POST() {
  try {
    console.log('[Migration] Adding missing columns to market_suppliers...')
    const results: string[] = []

    // List of columns to add
    const columns = [
      { name: 'contact_name', type: 'VARCHAR(255)' },
      { name: 'rating', type: 'INTEGER DEFAULT 3' },
      { name: 'created_by', type: 'INTEGER' },
      { name: 'notes', type: 'TEXT' }
    ]

    for (const col of columns) {
      try {
        await db.query(`
          ALTER TABLE market_suppliers
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        results.push(`Added column ${col.name}`)
        console.log(`[Migration] Added column ${col.name}`)
      } catch (e: unknown) {
        const error = e as Error
        if (!error.message?.includes('already exists')) {
          results.push(`Column ${col.name}: ${error.message}`)
        } else {
          results.push(`Column ${col.name} already exists`)
        }
      }
    }

    // Copy data from contact_person to contact_name if contact_person has data
    try {
      await db.query(`
        UPDATE market_suppliers
        SET contact_name = contact_person
        WHERE contact_name IS NULL AND contact_person IS NOT NULL
      `)
      results.push('Copied contact_person to contact_name where needed')
    } catch (e) {
      console.log('[Migration] contact_person copy:', e)
    }

    console.log('[Migration] Supplier columns migration complete')

    return NextResponse.json({
      success: true,
      message: 'Supplier columns migration completed',
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
 * GET /api/migrations/fix-supplier-columns
 * Check current columns in market_suppliers
 */
export async function GET() {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'market_suppliers'
      ORDER BY ordinal_position
    `)

    return NextResponse.json({
      success: true,
      data: {
        columns: result.rows,
        totalColumns: result.rows.length
      }
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed'
    }, { status: 500 })
  }
}
