import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    const results: string[] = []

    // All columns needed for the dosification system
    const allColumns = [
      // Identification
      { name: 'order_number', type: 'VARCHAR(20)' },

      // Source product (raw material)
      { name: 'source_product_id', type: 'INTEGER REFERENCES market_products(id)' },
      { name: 'source_variant_id', type: 'INTEGER REFERENCES market_product_variants(id)' },
      { name: 'source_warehouse_id', type: 'INTEGER REFERENCES market_warehouses(id)' },
      { name: 'source_quantity', type: 'DECIMAL(15,3) DEFAULT 1' },
      { name: 'source_unit_cost', type: 'DECIMAL(12,4)' },
      { name: 'source_weight_kg', type: 'DECIMAL(10,4)' },

      // Target product (manufactured)
      { name: 'target_product_id', type: 'INTEGER REFERENCES market_products(id)' },
      { name: 'target_variant_id', type: 'INTEGER REFERENCES market_product_variants(id)' },
      { name: 'target_warehouse_id', type: 'INTEGER REFERENCES market_warehouses(id)' },
      { name: 'target_portion_weight_kg', type: 'DECIMAL(10,4)' },
      { name: 'target_quantity', type: 'INTEGER' },

      // Calculations
      { name: 'expected_total_weight_kg', type: 'DECIMAL(10,4)' },
      { name: 'waste_surplus_kg', type: 'DECIMAL(10,4)' },
      { name: 'waste_surplus_type', type: 'VARCHAR(10)' },

      // Actual received quantity
      { name: 'actual_quantity', type: 'INTEGER' },
      { name: 'actual_waste_surplus_kg', type: 'DECIMAL(10,4)' },

      // Costs
      { name: 'materials_cost', type: 'DECIMAL(12,2) DEFAULT 0' },
      { name: 'labor_cost', type: 'DECIMAL(12,2) DEFAULT 0' },
      { name: 'total_cost', type: 'DECIMAL(12,2) DEFAULT 0' },
      { name: 'cost_per_unit', type: 'DECIMAL(12,4)' },

      // Documents
      { name: 'production_doc_printed', type: 'BOOLEAN DEFAULT false' },
      { name: 'reception_doc_printed', type: 'BOOLEAN DEFAULT false' },

      // Lot tracking
      { name: 'lot_number', type: 'VARCHAR(50)' },
      { name: 'expiration_date', type: 'DATE' },
      { name: 'materials_validation_status', type: "VARCHAR(20) DEFAULT NULL" },
      { name: 'materials_validated_at', type: 'TIMESTAMP' },
      { name: 'materials_validated_by', type: 'INTEGER' }
    ]

    // Add all columns
    for (const col of allColumns) {
      try {
        await db.query(`
          ALTER TABLE market_production_orders
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        results.push(`Added ${col.name}`)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          results.push(`${col.name}: ${e.message}`)
        }
      }
    }

    // Generate order numbers for existing rows without one
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

    // Add unique index for order_number
    try {
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_production_orders_order_number
        ON market_production_orders(company_id, order_number)
      `)
      results.push('Added unique index for order_number')
    } catch (e: any) {
      results.push(`Unique index: ${e.message}`)
    }

    // Add other indexes
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_production_orders_company ON market_production_orders(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_production_orders_status ON market_production_orders(status)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_production_orders_date ON market_production_orders(created_at DESC)`)
      results.push('Added indexes')
    } catch (e: any) {
      results.push(`Indexes: ${e.message}`)
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
