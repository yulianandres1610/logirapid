import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    const results: string[] = []

    // 1. Add order_number column if not exists
    try {
      await db.query(`
        ALTER TABLE market_production_orders
        ADD COLUMN IF NOT EXISTS order_number VARCHAR(20)
      `)
      results.push('Added order_number column')
    } catch (e: any) {
      results.push(`order_number: ${e.message}`)
    }

    // 2. Generate order numbers for existing rows without one
    try {
      const updated = await db.query(`
        UPDATE market_production_orders
        SET order_number = 'PRD-' || EXTRACT(YEAR FROM created_at)::TEXT || '-' || LPAD(id::TEXT, 4, '0')
        WHERE order_number IS NULL OR order_number = ''
        RETURNING id, order_number
      `)
      results.push(`Generated order_numbers for ${updated.rowCount} rows`)
    } catch (e: any) {
      results.push(`Generate order_numbers: ${e.message}`)
    }

    // 3. Add unique index
    try {
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_production_orders_order_number
        ON market_production_orders(company_id, order_number)
      `)
      results.push('Added unique index for order_number')
    } catch (e: any) {
      results.push(`Unique index: ${e.message}`)
    }

    // 4. Add other essential columns
    const columns = [
      { name: 'source_quantity', type: 'DECIMAL(15,3) DEFAULT 1' },
      { name: 'source_unit_cost', type: 'DECIMAL(12,4)' },
      { name: 'lot_number', type: 'VARCHAR(50)' },
      { name: 'expiration_date', type: 'DATE' },
      { name: 'materials_validation_status', type: "VARCHAR(20) DEFAULT NULL" },
      { name: 'materials_validated_at', type: 'TIMESTAMP' },
      { name: 'materials_validated_by', type: 'INTEGER' }
    ]

    for (const col of columns) {
      try {
        await db.query(`
          ALTER TABLE market_production_orders
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        results.push(`Added ${col.name} column`)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          results.push(`${col.name}: ${e.message}`)
        }
      }
    }

    // 5. Verify the table structure
    const tableInfo = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'market_production_orders'
      ORDER BY ordinal_position
    `)

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results,
      columns: tableInfo.rows
    })

  } catch (error) {
    console.error('[Fix Production Orders Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}
