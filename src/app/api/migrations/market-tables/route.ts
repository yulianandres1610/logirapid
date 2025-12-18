import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    console.log('[Migration] Starting market tables migration...')

    // 1. Add market columns to companies table
    const marketCompanyColumns = [
      { name: 'market_province', type: 'VARCHAR(100)' },
      { name: 'market_municipality', type: 'VARCHAR(100)' },
      { name: 'market_address', type: 'VARCHAR(255)' },
      { name: 'market_contact_phone', type: 'VARCHAR(20)' },
      { name: 'market_alternate_phone', type: 'VARCHAR(20)' },
      { name: 'market_delivery_hours', type: 'VARCHAR(50)' },
      { name: 'market_is_active', type: 'BOOLEAN DEFAULT true' },
      { name: 'market_categories', type: "JSONB DEFAULT '[]'" },
      { name: 'odoo_url', type: 'VARCHAR(255)' },
      { name: 'odoo_database', type: 'VARCHAR(100)' },
      { name: 'odoo_api_key', type: 'VARCHAR(255)' },
      { name: 'odoo_enabled', type: 'BOOLEAN DEFAULT false' }
    ]

    for (const col of marketCompanyColumns) {
      try {
        await db.query(`
          ALTER TABLE companies
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        console.log(`[Migration] Added column ${col.name} to companies`)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          console.log(`[Migration] Note: ${col.name} - ${e.message}`)
        }
      }
    }

    // 2. Create market_products table (Inventory)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_products (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        -- Basic info
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image_url TEXT,
        category VARCHAR(100),

        -- Pricing
        cost_price DECIMAL(10,2) NOT NULL,
        selling_price DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',

        -- Identifiers
        sku VARCHAR(100),
        barcode VARCHAR(100),

        -- Supplier
        supplier_name VARCHAR(255),
        supplier_contact VARCHAR(100),
        supplier_reference VARCHAR(100),

        -- Inventory
        quantity_on_hand INTEGER DEFAULT 0,
        quantity_expected INTEGER DEFAULT 0,
        minimum_stock INTEGER DEFAULT 0,

        -- Status
        is_active BOOLEAN DEFAULT true,

        -- Odoo sync
        odoo_product_id INTEGER,
        odoo_last_sync TIMESTAMP,

        -- Audit
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_products table')

    // Create indexes for market_products
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_products_company ON market_products(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_products_barcode ON market_products(barcode)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_products_sku ON market_products(sku)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_products_category ON market_products(company_id, category)
    `)

    // 3. Create market_purchases table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_purchases (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        -- Invoice number
        purchase_number VARCHAR(50) UNIQUE NOT NULL,

        -- Supplier
        supplier_name VARCHAR(255) NOT NULL,
        supplier_contact VARCHAR(100),
        supplier_address TEXT,

        -- Totals
        subtotal DECIMAL(12,2) DEFAULT 0,
        tax_amount DECIMAL(12,2) DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',

        -- Status: draft, confirmed, received, cancelled
        status VARCHAR(50) DEFAULT 'draft',

        -- Dates
        purchase_date DATE DEFAULT CURRENT_DATE,
        expected_date DATE,
        received_date DATE,

        -- Notes
        notes TEXT,

        -- Audit
        created_by INTEGER REFERENCES users(id),
        confirmed_by INTEGER REFERENCES users(id),
        received_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_purchases table')

    // Create market_purchase_lines table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_purchase_lines (
        id SERIAL PRIMARY KEY,
        purchase_id INTEGER NOT NULL REFERENCES market_purchases(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES market_products(id),

        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(12,2) NOT NULL,

        quantity_received INTEGER DEFAULT 0,

        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_purchase_lines table')

    // Create indexes for purchases
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_purchases_company ON market_purchases(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_purchases_status ON market_purchases(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_purchase_lines_purchase ON market_purchase_lines(purchase_id)
    `)

    // 4. Create market_orders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,

        -- Companies
        selling_company_id INTEGER NOT NULL REFERENCES companies(id),
        market_company_id INTEGER REFERENCES companies(id),

        -- Customer
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        customer_email VARCHAR(255),

        -- Delivery address
        delivery_province VARCHAR(100) NOT NULL,
        delivery_municipality VARCHAR(100) NOT NULL,
        delivery_address TEXT NOT NULL,
        delivery_address_references TEXT,
        delivery_latitude DECIMAL(10,8),
        delivery_longitude DECIMAL(11,8),

        -- Totals
        subtotal DECIMAL(12,2) DEFAULT 0,
        delivery_fee DECIMAL(10,2) DEFAULT 0,
        service_fee DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',

        -- Status: pending, accepted, preparing, ready, in_delivery, delivered, cancelled, rejected
        status VARCHAR(50) DEFAULT 'pending',

        -- Important dates
        estimated_delivery DATE,
        accepted_at TIMESTAMP,
        preparing_at TIMESTAMP,
        ready_at TIMESTAMP,
        in_delivery_at TIMESTAMP,
        delivered_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        rejected_at TIMESTAMP,

        -- Rejection
        rejection_reason VARCHAR(100),
        rejection_notes TEXT,
        rejected_by INTEGER REFERENCES users(id),

        -- Delivery proof
        delivery_proof_photo TEXT,
        delivery_signature TEXT,
        delivery_notes TEXT,
        delivered_by INTEGER REFERENCES users(id),

        -- Payment
        payment_status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(50),
        payment_reference VARCHAR(100),

        -- Route
        route_id INTEGER,

        -- Audit
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_orders table')

    // Create market_order_lines table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_order_lines (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES market_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES market_products(id),

        product_name VARCHAR(255) NOT NULL,
        product_image TEXT,

        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(12,2) NOT NULL,

        -- Preparation status
        quantity_prepared INTEGER DEFAULT 0,
        is_prepared BOOLEAN DEFAULT false,

        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_order_lines table')

    // Create indexes for orders
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_orders_selling ON market_orders(selling_company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_orders_market ON market_orders(market_company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_orders_status ON market_orders(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_orders_delivery ON market_orders(delivery_province, delivery_municipality)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_order_lines_order ON market_order_lines(order_id)
    `)

    // 5. Create market_inventory_movements table for tracking stock changes
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_inventory_movements (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        product_id INTEGER NOT NULL REFERENCES market_products(id),

        -- Movement type: purchase_in, sale_out, adjustment, return
        movement_type VARCHAR(50) NOT NULL,

        quantity INTEGER NOT NULL,
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,

        -- Reference (purchase, order, or manual)
        reference_type VARCHAR(50),
        reference_id INTEGER,
        notes TEXT,

        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_inventory_movements table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_inventory_movements_product ON market_inventory_movements(product_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_inventory_movements_company ON market_inventory_movements(company_id)
    `)

    // Get table stats
    const tables = ['market_products', 'market_purchases', 'market_purchase_lines', 'market_orders', 'market_order_lines', 'market_inventory_movements']
    const tableStats = []

    for (const table of tables) {
      const result = await db.query(`
        SELECT COUNT(*) as count FROM ${table}
      `)
      tableStats.push({ table, count: result.rows[0].count })
    }

    console.log('[Migration] Market tables migration completed')

    return NextResponse.json({
      success: true,
      message: 'Market tables migration completed successfully',
      tables: tableStats
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
    // Check current state of market tables
    const tables = ['market_products', 'market_purchases', 'market_purchase_lines', 'market_orders', 'market_order_lines', 'market_inventory_movements']
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
        const countResult = await db.query(`SELECT COUNT(*) as count FROM ${table}`)
        count = parseInt(countResult.rows[0].count)
      }

      tableStatus.push({
        table,
        exists: exists.rows[0].exists,
        count
      })
    }

    // Check market columns in companies
    const marketColumns = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'companies'
      AND column_name LIKE 'market_%' OR column_name LIKE 'odoo_%'
      ORDER BY column_name
    `)

    // Get market companies count
    const marketCompanies = await db.query(`
      SELECT COUNT(*) as count
      FROM companies
      WHERE companytype = 'market'
    `)

    const needsMigration = tableStatus.some(t => !t.exists)

    return NextResponse.json({
      success: true,
      needsMigration,
      tables: tableStatus,
      marketColumnsInCompanies: marketColumns.rows,
      marketCompaniesCount: parseInt(marketCompanies.rows[0].count)
    })

  } catch (error: any) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
