import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/pos-traceability
 * Migration to add supplier traceability fields to market_pos_order_lines
 * This enables tracking which supplier's product was sold (for consignment profit calculation)
 */
export async function POST() {
  try {
    const results: string[] = []

    // Add traceability columns to market_pos_order_lines
    const columns = [
      { name: 'supplier_id', type: 'INTEGER REFERENCES market_suppliers(id)' },
      { name: 'lot_id', type: 'INTEGER' },
      { name: 'cost_price', type: 'DECIMAL(12,4)' },
      { name: 'is_consignment', type: 'BOOLEAN DEFAULT false' }
    ]

    results.push('--- market_pos_order_lines ---')
    for (const col of columns) {
      try {
        await db.query(`
          ALTER TABLE market_pos_order_lines
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        results.push(`Added ${col.name} to market_pos_order_lines`)
      } catch (error: unknown) {
        const err = error as Error & { message?: string }
        if (err.message?.includes('already exists')) {
          results.push(`${col.name} already exists in market_pos_order_lines`)
        } else {
          results.push(`market_pos_order_lines.${col.name}: ${err.message}`)
        }
      }
    }

    // Create index for supplier lookup in sales
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_pos_lines_supplier
        ON market_pos_order_lines(supplier_id)
        WHERE supplier_id IS NOT NULL
      `)
      results.push('Created index idx_pos_lines_supplier')
    } catch (error: unknown) {
      const err = error as Error & { message?: string }
      results.push(`Index creation: ${err.message}`)
    }

    // Create index for consignment sales filtering
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_pos_lines_consignment
        ON market_pos_order_lines(is_consignment)
        WHERE is_consignment = true
      `)
      results.push('Created index idx_pos_lines_consignment')
    } catch (error: unknown) {
      const err = error as Error & { message?: string }
      results.push(`Index creation: ${err.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'POS traceability migration completed',
      results
    })

  } catch (error) {
    console.error('[Migration] POS traceability error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Check current state of traceability columns
    const cols = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'market_pos_order_lines'
      AND column_name IN ('supplier_id', 'lot_id', 'cost_price', 'is_consignment')
      ORDER BY column_name
    `)

    // Check indexes
    const indexes = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'market_pos_order_lines'
      AND indexname IN ('idx_pos_lines_supplier', 'idx_pos_lines_consignment')
    `)

    return NextResponse.json({
      success: true,
      columns: cols.rows,
      indexes: indexes.rows
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
