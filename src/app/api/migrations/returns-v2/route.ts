import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/returns-v2
 * Crea las tablas necesarias para el sistema de devoluciones v2
 * - POS returns tables
 * - Scrap tracking
 * - Updates to consignment_returns
 */
export async function POST() {
  try {
    console.log('[Migration] Starting returns v2 migration...')

    // 1. Make order_id nullable in consignment_returns (for lot-based returns)
    try {
      await db.query(`
        ALTER TABLE consignment_returns
        ALTER COLUMN order_id DROP NOT NULL
      `)
      console.log('[Migration] Made order_id nullable in consignment_returns')
    } catch (error) {
      // May fail if already nullable, that's OK
      console.log('[Migration] order_id already nullable or does not exist')
    }

    // 2. Add columns to consignment_return_lines if they don't exist
    try {
      await db.query(`
        ALTER TABLE consignment_return_lines
        ADD COLUMN IF NOT EXISTS quantity INTEGER,
        ADD COLUMN IF NOT EXISTS total_value DECIMAL(12,2)
      `)
      console.log('[Migration] Updated consignment_return_lines columns')
    } catch (error) {
      console.log('[Migration] consignment_return_lines columns already exist')
    }

    // 3. Add updated_at to consignment_order_lines if it doesn't exist
    try {
      await db.query(`
        ALTER TABLE consignment_order_lines
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
      `)
    } catch (error) {
      console.log('[Migration] updated_at already exists')
    }

    // 4. Add updated_at to consignment_lot_inventory if it doesn't exist
    try {
      await db.query(`
        ALTER TABLE consignment_lot_inventory
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
      `)
    } catch (error) {
      console.log('[Migration] updated_at already exists')
    }

    // 5. Create market_pos table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_pos (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        warehouse_id INTEGER REFERENCES market_warehouses(id),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_pos table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_pos_company
      ON market_pos(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_pos_warehouse
      ON market_pos(warehouse_id)
    `)

    // 6. Create pos_returns table
    await db.query(`
      CREATE TABLE IF NOT EXISTS pos_returns (
        id SERIAL PRIMARY KEY,
        return_number VARCHAR(50) UNIQUE NOT NULL,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),
        pos_id INTEGER REFERENCES market_pos(id),
        customer_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        reason TEXT,
        notes TEXT,
        total_items INTEGER DEFAULT 0,
        total_units INTEGER DEFAULT 0,
        total_value DECIMAL(12,2) DEFAULT 0,
        created_by INTEGER REFERENCES users(id),
        received_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        received_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // Add customer_name column if it doesn't exist (for existing tables)
    try {
      await db.query(`
        ALTER TABLE pos_returns
        ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)
      `)
    } catch {
      console.log('[Migration] customer_name column may already exist')
    }
    console.log('[Migration] Created pos_returns table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_returns_company
      ON pos_returns(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_returns_warehouse
      ON pos_returns(warehouse_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_returns_status
      ON pos_returns(status)
    `)

    // 7. Create pos_return_lines table
    await db.query(`
      CREATE TABLE IF NOT EXISTS pos_return_lines (
        id SERIAL PRIMARY KEY,
        return_id INTEGER NOT NULL REFERENCES pos_returns(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES market_products(id),
        quantity INTEGER NOT NULL,
        quantity_received INTEGER DEFAULT 0,
        unit_price DECIMAL(10,2) NOT NULL,
        reason TEXT,
        condition VARCHAR(50),
        received_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created pos_return_lines table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_return_lines_return
      ON pos_return_lines(return_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_return_lines_product
      ON pos_return_lines(product_id)
    `)

    // 8. Create market_pos_scrap table for tracking scrapped items
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_pos_scrap (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),
        pos_return_id INTEGER REFERENCES pos_returns(id),
        pos_return_line_id INTEGER REFERENCES pos_return_lines(id),
        product_id INTEGER NOT NULL REFERENCES market_products(id),
        quantity INTEGER NOT NULL,
        unit_cost DECIMAL(10,2),
        total_value DECIMAL(12,2),
        condition VARCHAR(50) NOT NULL,
        reason TEXT,
        scrapped_by INTEGER REFERENCES users(id),
        scrapped_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_pos_scrap table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_pos_scrap_company
      ON market_pos_scrap(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_pos_scrap_warehouse
      ON market_pos_scrap(warehouse_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_pos_scrap_product
      ON market_pos_scrap(product_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_pos_scrap_condition
      ON market_pos_scrap(condition)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_pos_scrap_date
      ON market_pos_scrap(scrapped_at)
    `)

    // Get table counts
    const tables = [
      'market_pos',
      'pos_returns',
      'pos_return_lines',
      'market_pos_scrap',
      'consignment_returns',
      'consignment_return_lines'
    ]

    const tableStats = []
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`)
        tableStats.push({ table, count: parseInt(result.rows[0].count), status: 'ok' })
      } catch {
        tableStats.push({ table, count: 0, status: 'error' })
      }
    }

    console.log('[Migration] Returns v2 migration completed')

    return NextResponse.json({
      success: true,
      message: 'Returns v2 tables created/updated successfully',
      tables: tableStats
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
 * GET /api/migrations/returns-v2
 * Verifica estado de las tablas
 */
export async function GET() {
  try {
    const tables = [
      'market_pos',
      'pos_returns',
      'pos_return_lines',
      'market_pos_scrap'
    ]

    const tableStatus = []
    for (const table of tables) {
      const exists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = $1
        ) as exists
      `, [table])

      let count = 0
      if (exists.rows[0].exists) {
        try {
          const countResult = await db.query(`SELECT COUNT(*) as count FROM ${table}`)
          count = parseInt(countResult.rows[0].count)
        } catch {
          count = 0
        }
      }

      tableStatus.push({
        table,
        exists: exists.rows[0].exists,
        count
      })
    }

    const needsMigration = tableStatus.some(t => !t.exists)

    return NextResponse.json({
      success: true,
      needsMigration,
      tables: tableStatus
    })

  } catch (error) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed'
    }, { status: 500 })
  }
}
