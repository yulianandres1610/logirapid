import { NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    // Check authentication
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value

    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const results: string[] = []

    // Create external_recharge_products table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS external_recharge_products (
          id SERIAL PRIMARY KEY,
          external_id INTEGER NOT NULL UNIQUE,
          slug VARCHAR(100),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          base_cost DECIMAL(10,2) NOT NULL,
          country_code VARCHAR(10),
          country_name VARCHAR(100),
          phone_pattern VARCHAR(255),
          min_amount DECIMAL(10,2),
          max_amount DECIMAL(10,2),
          accepts_range BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          last_synced_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)
      results.push('Created table: external_recharge_products')
    } catch (error: any) {
      if (error.code === '42P07') {
        results.push('Table external_recharge_products already exists')
      } else {
        throw error
      }
    }

    // Create index on external_id
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_external_recharge_products_external_id
        ON external_recharge_products(external_id)
      `)
      results.push('Created index: idx_external_recharge_products_external_id')
    } catch (error: any) {
      results.push('Index idx_external_recharge_products_external_id already exists or error: ' + error.message)
    }

    // Create index on country_code
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_external_recharge_products_country
        ON external_recharge_products(country_code)
      `)
      results.push('Created index: idx_external_recharge_products_country')
    } catch (error: any) {
      results.push('Index idx_external_recharge_products_country already exists or error: ' + error.message)
    }

    // Create recharge_product_pricing table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS recharge_product_pricing (
          id SERIAL PRIMARY KEY,
          external_product_id INTEGER NOT NULL REFERENCES external_recharge_products(id) ON DELETE CASCADE,
          company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
          margin_type VARCHAR(20) NOT NULL CHECK (margin_type IN ('percentage', 'fixed')),
          margin_value DECIMAL(10,2) NOT NULL,
          selling_price DECIMAL(10,2),
          is_enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(external_product_id, company_id)
        )
      `)
      results.push('Created table: recharge_product_pricing')
    } catch (error: any) {
      if (error.code === '42P07') {
        results.push('Table recharge_product_pricing already exists')
      } else {
        throw error
      }
    }

    // Create index on company_id for pricing
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_recharge_product_pricing_company
        ON recharge_product_pricing(company_id)
      `)
      results.push('Created index: idx_recharge_product_pricing_company')
    } catch (error: any) {
      results.push('Index idx_recharge_product_pricing_company already exists or error: ' + error.message)
    }

    // Create recharge_promotions table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS recharge_promotions (
          id SERIAL PRIMARY KEY,
          external_id VARCHAR(100) NOT NULL,
          external_product_id INTEGER REFERENCES external_recharge_products(id) ON DELETE CASCADE,
          min_amount DECIMAL(10,2),
          valid_from TIMESTAMP,
          valid_to TIMESTAMP,
          summary TEXT,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          last_synced_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)
      results.push('Created table: recharge_promotions')
    } catch (error: any) {
      if (error.code === '42P07') {
        results.push('Table recharge_promotions already exists')
      } else {
        throw error
      }
    }

    // Create index on external_product_id for promotions
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_recharge_promotions_product
        ON recharge_promotions(external_product_id)
      `)
      results.push('Created index: idx_recharge_promotions_product')
    } catch (error: any) {
      results.push('Index idx_recharge_promotions_product already exists or error: ' + error.message)
    }

    // Create index on validity dates
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_recharge_promotions_dates
        ON recharge_promotions(valid_from, valid_to)
      `)
      results.push('Created index: idx_recharge_promotions_dates')
    } catch (error: any) {
      results.push('Index idx_recharge_promotions_dates already exists or error: ' + error.message)
    }

    // Create recharge_orders table for tracking executed recharges
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS recharge_orders (
          id SERIAL PRIMARY KEY,
          order_number VARCHAR(50) NOT NULL UNIQUE,
          external_reference VARCHAR(100),
          univcell_order_id VARCHAR(100),
          external_product_id INTEGER REFERENCES external_recharge_products(id),
          product_name VARCHAR(255),
          destination VARCHAR(100) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          cost DECIMAL(10,2) NOT NULL,
          selling_price DECIMAL(10,2) NOT NULL,
          profit DECIMAL(10,2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          status VARCHAR(50) DEFAULT 'pending',
          result_code INTEGER,
          result_message TEXT,
          confirmation_code VARCHAR(100),
          company_id INTEGER REFERENCES companies(id),
          branch_id INTEGER,
          created_by INTEGER,
          customer_name VARCHAR(255),
          customer_phone VARCHAR(50),
          notes TEXT,
          scheduled_at TIMESTAMP,
          completed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)
      results.push('Created table: recharge_orders')
    } catch (error: any) {
      if (error.code === '42P07') {
        results.push('Table recharge_orders already exists')
      } else {
        throw error
      }
    }

    // Create indexes for recharge_orders
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_recharge_orders_company
        ON recharge_orders(company_id)
      `)
      results.push('Created index: idx_recharge_orders_company')
    } catch (error: any) {
      results.push('Index error: ' + error.message)
    }

    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_recharge_orders_status
        ON recharge_orders(status)
      `)
      results.push('Created index: idx_recharge_orders_status')
    } catch (error: any) {
      results.push('Index error: ' + error.message)
    }

    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_recharge_orders_created
        ON recharge_orders(created_at DESC)
      `)
      results.push('Created index: idx_recharge_orders_created')
    } catch (error: any) {
      results.push('Index error: ' + error.message)
    }

    // Create sync_logs table to track synchronization
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS recharge_sync_logs (
          id SERIAL PRIMARY KEY,
          sync_type VARCHAR(50) NOT NULL,
          products_synced INTEGER DEFAULT 0,
          promotions_synced INTEGER DEFAULT 0,
          errors TEXT,
          synced_by INTEGER,
          started_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP,
          status VARCHAR(50) DEFAULT 'in_progress'
        )
      `)
      results.push('Created table: recharge_sync_logs')
    } catch (error: any) {
      if (error.code === '42P07') {
        results.push('Table recharge_sync_logs already exists')
      } else {
        throw error
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Recharge tables migration completed',
      results,
    })
  } catch (error: any) {
    console.error('[Migration Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Migration failed',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Check if tables exist
    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'external_recharge_products',
        'recharge_product_pricing',
        'recharge_promotions',
        'recharge_orders',
        'recharge_sync_logs'
      )
    `)

    const existingTables = tables.rows.map((r: any) => r.table_name)
    const requiredTables = [
      'external_recharge_products',
      'recharge_product_pricing',
      'recharge_promotions',
      'recharge_orders',
      'recharge_sync_logs',
    ]

    const missingTables = requiredTables.filter((t) => !existingTables.includes(t))

    // Get counts if tables exist
    let counts: Record<string, number> = {}
    for (const table of existingTables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`)
        counts[table] = parseInt(result.rows[0].count)
      } catch {
        counts[table] = 0
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        existingTables,
        missingTables,
        counts,
        migrationNeeded: missingTables.length > 0,
      },
    })
  } catch (error: any) {
    console.error('[Migration Check Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to check migration status',
      },
      { status: 500 }
    )
  }
}
