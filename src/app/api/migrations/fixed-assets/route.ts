import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/fixed-assets
 * Creates tables for the Fixed Assets (Base Material) module
 */
export async function POST() {
  try {
    console.log('[Migration] Starting fixed assets tables migration...')

    // 1. Create market_fixed_asset_categories table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_fixed_asset_categories (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20),
        parent_id INTEGER REFERENCES market_fixed_asset_categories(id) ON DELETE SET NULL,
        depreciation_years INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(company_id, code)
      )
    `)
    console.log('[Migration] Created market_fixed_asset_categories table')

    // Create indexes for categories
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_categories_company
      ON market_fixed_asset_categories(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_categories_parent
      ON market_fixed_asset_categories(parent_id)
    `)

    // 2. Create market_fixed_assets table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_fixed_assets (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        -- Identification
        asset_code VARCHAR(50) NOT NULL,
        barcode VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        description TEXT,

        -- Classification
        category_id INTEGER REFERENCES market_fixed_asset_categories(id) ON DELETE SET NULL,
        asset_type VARCHAR(50),

        -- Location
        warehouse_id INTEGER REFERENCES market_warehouses(id) ON DELETE SET NULL,
        location_code VARCHAR(100),

        -- Responsible
        responsible_employee_id INTEGER REFERENCES market_employees(id) ON DELETE SET NULL,
        responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

        -- Financial info
        acquisition_date DATE,
        acquisition_cost DECIMAL(12,2),
        currency VARCHAR(10) DEFAULT 'USD',
        current_value DECIMAL(12,2),

        -- Supplier/Origin
        supplier_id INTEGER REFERENCES market_suppliers(id) ON DELETE SET NULL,
        invoice_number VARCHAR(100),
        serial_number VARCHAR(100),
        brand VARCHAR(100),
        model VARCHAR(100),

        -- Status
        status VARCHAR(20) DEFAULT 'active',
        condition VARCHAR(20) DEFAULT 'good',

        -- Audit
        last_audit_date DATE,
        last_audit_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

        -- Metadata
        notes TEXT,
        image_url VARCHAR(500),
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(company_id, asset_code),
        UNIQUE(company_id, barcode)
      )
    `)
    console.log('[Migration] Created market_fixed_assets table')

    // Create indexes for fixed assets
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_assets_company
      ON market_fixed_assets(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_assets_barcode
      ON market_fixed_assets(barcode)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_assets_code
      ON market_fixed_assets(asset_code)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_assets_category
      ON market_fixed_assets(category_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_assets_warehouse
      ON market_fixed_assets(warehouse_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_assets_responsible
      ON market_fixed_assets(responsible_employee_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_assets_status
      ON market_fixed_assets(company_id, status)
    `)

    // 3. Create market_fixed_asset_audits table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_fixed_asset_audits (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        audit_number VARCHAR(50) NOT NULL,
        audit_date DATE NOT NULL,

        -- Scope
        warehouse_id INTEGER REFERENCES market_warehouses(id) ON DELETE SET NULL,
        category_id INTEGER REFERENCES market_fixed_asset_categories(id) ON DELETE SET NULL,

        -- Counters
        total_assets INTEGER DEFAULT 0,
        assets_found INTEGER DEFAULT 0,
        assets_missing INTEGER DEFAULT 0,
        assets_surplus INTEGER DEFAULT 0,

        -- Status
        status VARCHAR(20) DEFAULT 'in_progress',

        -- Responsible users
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        approved_at TIMESTAMP,

        notes TEXT,

        UNIQUE(company_id, audit_number)
      )
    `)
    console.log('[Migration] Created market_fixed_asset_audits table')

    // Create indexes for audits
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_audits_company
      ON market_fixed_asset_audits(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_audits_status
      ON market_fixed_asset_audits(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_audits_date
      ON market_fixed_asset_audits(audit_date)
    `)

    // 4. Create market_fixed_asset_audit_lines table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_fixed_asset_audit_lines (
        id SERIAL PRIMARY KEY,
        audit_id INTEGER NOT NULL REFERENCES market_fixed_asset_audits(id) ON DELETE CASCADE,
        asset_id INTEGER REFERENCES market_fixed_assets(id) ON DELETE SET NULL,

        -- Scan result
        scanned_barcode VARCHAR(100),
        scan_status VARCHAR(20),

        -- Location found (may differ from registered)
        found_location VARCHAR(100),
        found_warehouse_id INTEGER REFERENCES market_warehouses(id) ON DELETE SET NULL,

        -- Observed condition
        observed_condition VARCHAR(20),

        -- Metadata
        scanned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        scanned_at TIMESTAMP DEFAULT NOW(),
        notes TEXT
      )
    `)
    console.log('[Migration] Created market_fixed_asset_audit_lines table')

    // Create indexes for audit lines
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_audit_lines_audit
      ON market_fixed_asset_audit_lines(audit_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_audit_lines_asset
      ON market_fixed_asset_audit_lines(asset_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_audit_lines_barcode
      ON market_fixed_asset_audit_lines(scanned_barcode)
    `)

    // 5. Create market_fixed_asset_movements table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_fixed_asset_movements (
        id SERIAL PRIMARY KEY,
        asset_id INTEGER NOT NULL REFERENCES market_fixed_assets(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        movement_type VARCHAR(30) NOT NULL,

        -- For transfers
        from_warehouse_id INTEGER REFERENCES market_warehouses(id) ON DELETE SET NULL,
        to_warehouse_id INTEGER REFERENCES market_warehouses(id) ON DELETE SET NULL,
        from_location VARCHAR(100),
        to_location VARCHAR(100),

        -- For assignments
        from_responsible_id INTEGER REFERENCES market_employees(id) ON DELETE SET NULL,
        to_responsible_id INTEGER REFERENCES market_employees(id) ON DELETE SET NULL,

        -- For status changes
        from_status VARCHAR(20),
        to_status VARCHAR(20),

        -- Metadata
        reason TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_fixed_asset_movements table')

    // Create indexes for movements
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_movements_asset
      ON market_fixed_asset_movements(asset_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_movements_company
      ON market_fixed_asset_movements(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_movements_type
      ON market_fixed_asset_movements(movement_type)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_fixed_asset_movements_date
      ON market_fixed_asset_movements(created_at)
    `)

    console.log('[Migration] Fixed assets tables migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Fixed assets tables created successfully',
      tables: [
        'market_fixed_asset_categories',
        'market_fixed_assets',
        'market_fixed_asset_audits',
        'market_fixed_asset_audit_lines',
        'market_fixed_asset_movements'
      ]
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Migration] Error creating fixed assets tables:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error creating tables'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/fixed-assets
 * Check if tables exist
 */
export async function GET() {
  try {
    const tables = [
      'market_fixed_asset_categories',
      'market_fixed_assets',
      'market_fixed_asset_audits',
      'market_fixed_asset_audit_lines',
      'market_fixed_asset_movements'
    ]

    const tableStatus: Record<string, boolean> = {}

    for (const table of tables) {
      const result = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        )
      `, [table])
      tableStatus[table] = result.rows[0].exists
    }

    const allExist = Object.values(tableStatus).every(v => v)

    return NextResponse.json({
      success: true,
      migrated: allExist,
      tables: tableStatus
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Migration] Error checking fixed assets tables:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error checking tables'
    }, { status: 500 })
  }
}
