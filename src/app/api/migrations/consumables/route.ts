import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/consumables
 * Creates tables for Consumables inventory and Asset Checkouts (tool lending)
 */
export async function POST() {
  try {
    console.log('[Migration] Starting consumables & checkouts tables migration...')

    // 1. Create market_consumable_items table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_consumable_items (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        description TEXT,
        category VARCHAR(100),
        unit VARCHAR(30) DEFAULT 'unidad',
        current_stock DECIMAL(12,3) DEFAULT 0,
        min_stock DECIMAL(12,3) DEFAULT 0,
        warehouse_id INTEGER REFERENCES market_warehouses(id) ON DELETE SET NULL,
        image_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'active',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, code)
      )
    `)
    console.log('[Migration] Created market_consumable_items table')

    // Indexes for consumable items
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_consumable_items_company
      ON market_consumable_items(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_consumable_items_code
      ON market_consumable_items(company_id, code)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_consumable_items_category
      ON market_consumable_items(company_id, category)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_consumable_items_status
      ON market_consumable_items(company_id, status)
    `)

    // 2. Create market_consumable_movements table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_consumable_movements (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES market_consumable_items(id) ON DELETE CASCADE,
        movement_type VARCHAR(20) NOT NULL,
        quantity DECIMAL(12,3) NOT NULL,
        unit_cost DECIMAL(12,2),
        supplier_name VARCHAR(255),
        invoice_ref VARCHAR(100),
        employee_id INTEGER REFERENCES market_employees(id) ON DELETE SET NULL,
        employee_name VARCHAR(255),
        reason TEXT,
        stock_before DECIMAL(12,3),
        stock_after DECIMAL(12,3),
        notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_consumable_movements table')

    // Indexes for consumable movements
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_consumable_movements_company
      ON market_consumable_movements(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_consumable_movements_item
      ON market_consumable_movements(item_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_consumable_movements_type
      ON market_consumable_movements(movement_type)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_consumable_movements_date
      ON market_consumable_movements(created_at)
    `)

    // 3. Create market_asset_checkouts table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_asset_checkouts (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        asset_id INTEGER NOT NULL REFERENCES market_fixed_assets(id) ON DELETE CASCADE,
        employee_id INTEGER NOT NULL REFERENCES market_employees(id) ON DELETE CASCADE,
        checkout_date TIMESTAMP DEFAULT NOW(),
        checkout_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        checkout_notes TEXT,
        expected_return DATE,
        return_date TIMESTAMP,
        return_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        return_notes TEXT,
        return_condition VARCHAR(20),
        status VARCHAR(20) DEFAULT 'checked_out',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_asset_checkouts table')

    // Indexes for asset checkouts
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_asset_checkouts_company
      ON market_asset_checkouts(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_asset_checkouts_asset
      ON market_asset_checkouts(asset_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_asset_checkouts_employee
      ON market_asset_checkouts(employee_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_asset_checkouts_status
      ON market_asset_checkouts(company_id, status)
    `)

    // 4. Add is_checked_out column to market_fixed_assets
    try {
      await db.query(`
        ALTER TABLE market_fixed_assets ADD COLUMN IF NOT EXISTS is_checked_out BOOLEAN DEFAULT false
      `)
      console.log('[Migration] Added is_checked_out column to market_fixed_assets')
    } catch {
      console.log('[Migration] is_checked_out column may already exist')
    }

    console.log('[Migration] Consumables & checkouts tables migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Consumables and checkouts tables created successfully',
      tables: [
        'market_consumable_items',
        'market_consumable_movements',
        'market_asset_checkouts',
        'market_fixed_assets (is_checked_out column)'
      ]
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Migration] Error creating consumables/checkouts tables:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error creating tables'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/consumables
 * Check if tables exist
 */
export async function GET() {
  try {
    const tables = [
      'market_consumable_items',
      'market_consumable_movements',
      'market_asset_checkouts'
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

    // Check is_checked_out column
    try {
      const colResult = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'market_fixed_assets'
          AND column_name = 'is_checked_out'
        )
      `)
      tableStatus['market_fixed_assets.is_checked_out'] = colResult.rows[0].exists
    } catch {
      tableStatus['market_fixed_assets.is_checked_out'] = false
    }

    const allExist = Object.values(tableStatus).every(v => v)

    return NextResponse.json({
      success: true,
      migrated: allExist,
      tables: tableStatus
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Migration] Error checking consumables/checkouts tables:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error checking tables'
    }, { status: 500 })
  }
}
