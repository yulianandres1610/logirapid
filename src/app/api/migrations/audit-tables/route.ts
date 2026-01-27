import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/audit-tables
 * Creates tables for the Audit Portal (auditoria.logirapid.com)
 */
export async function GET() {
  try {
    console.log('[Migration] Creating audit tables...')

    // Create audit_counts table
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_counts (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        count_number VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'in_progress',
        counted_by INTEGER NOT NULL,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,

        total_products INTEGER DEFAULT 0,
        products_with_differences INTEGER DEFAULT 0,
        total_shortage_value DECIMAL(12,2) DEFAULT 0,
        total_excess_value DECIMAL(12,2) DEFAULT 0,
        total_stock_at_cost DECIMAL(12,2) DEFAULT 0,
        total_stock_at_sale DECIMAL(12,2) DEFAULT 0,

        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] audit_counts table created')

    // Add unique constraint if not exists
    try {
      await db.query(`
        ALTER TABLE audit_counts
        ADD CONSTRAINT audit_count_number_unique UNIQUE (company_id, count_number)
      `)
      console.log('[Migration] Added unique constraint on audit_counts')
    } catch (e: unknown) {
      const error = e as { code?: string }
      // 42710 = constraint already exists, 42P07 = relation already exists
      if (error.code !== '42710' && error.code !== '42P07') throw e
    }

    // Create indexes on audit_counts
    try {
      await db.query(`CREATE INDEX idx_audit_counts_company ON audit_counts(company_id)`)
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42P07') throw e
    }

    try {
      await db.query(`CREATE INDEX idx_audit_counts_warehouse ON audit_counts(warehouse_id)`)
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42P07') throw e
    }

    try {
      await db.query(`CREATE INDEX idx_audit_counts_status ON audit_counts(status)`)
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42P07') throw e
    }

    try {
      await db.query(`CREATE INDEX idx_audit_counts_date ON audit_counts(created_at)`)
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42P07') throw e
    }

    console.log('[Migration] audit_counts indexes created')

    // Add apply columns to audit_counts (for applying audit adjustments)
    try {
      await db.query(`ALTER TABLE audit_counts ADD COLUMN applied_at TIMESTAMP`)
      console.log('[Migration] Added applied_at column to audit_counts')
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42701') throw e // Ignore if column exists
    }

    try {
      await db.query(`ALTER TABLE audit_counts ADD COLUMN applied_by INTEGER`)
      console.log('[Migration] Added applied_by column to audit_counts')
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42701') throw e
    }

    try {
      await db.query(`ALTER TABLE audit_counts ADD COLUMN apply_notes TEXT`)
      console.log('[Migration] Added apply_notes column to audit_counts')
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42701') throw e
    }

    // Create audit_count_lines table
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_count_lines (
        id SERIAL PRIMARY KEY,
        count_id INTEGER NOT NULL REFERENCES audit_counts(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,

        product_name VARCHAR(255),
        product_sku VARCHAR(100),
        product_barcode VARCHAR(100),
        product_image TEXT,
        cost_price DECIMAL(12,2) DEFAULT 0,
        selling_price DECIMAL(12,2) DEFAULT 0,

        system_quantity DECIMAL(12,2) DEFAULT 0,
        counted_quantity DECIMAL(12,2) DEFAULT 0,
        difference DECIMAL(12,2) DEFAULT 0,

        difference_value_cost DECIMAL(12,2) DEFAULT 0,
        difference_value_sale DECIMAL(12,2) DEFAULT 0,

        scanned_at TIMESTAMP DEFAULT NOW(),
        notes TEXT
      )
    `)
    console.log('[Migration] audit_count_lines table created')

    // Create indexes on audit_count_lines
    try {
      await db.query(`CREATE INDEX idx_audit_count_lines_count ON audit_count_lines(count_id)`)
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42P07') throw e
    }

    try {
      await db.query(`CREATE INDEX idx_audit_count_lines_product ON audit_count_lines(product_id)`)
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42P07') throw e
    }

    try {
      await db.query(`CREATE INDEX idx_audit_count_lines_difference ON audit_count_lines(difference) WHERE difference != 0`)
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42P07') throw e
    }

    console.log('[Migration] audit_count_lines indexes created')

    // Create audit_count_history table for traceability
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_count_history (
        id SERIAL PRIMARY KEY,
        count_id INTEGER NOT NULL REFERENCES audit_counts(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        performed_by INTEGER NOT NULL,
        performed_at TIMESTAMP DEFAULT NOW(),
        changes_summary JSONB,
        notes TEXT
      )
    `)
    console.log('[Migration] audit_count_history table created')

    try {
      await db.query(`CREATE INDEX idx_audit_count_history_count ON audit_count_history(count_id)`)
    } catch (e: unknown) {
      const error = e as { code?: string }
      if (error.code !== '42P07') throw e
    }

    console.log('[Migration] All audit tables created successfully')

    return NextResponse.json({
      success: true,
      message: 'Audit tables created successfully',
      tables: ['audit_counts', 'audit_count_lines', 'audit_count_history']
    })

  } catch (error) {
    console.error('[Migration] Error creating audit tables:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/migrations/audit-tables
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
