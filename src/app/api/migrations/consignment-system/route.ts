import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/consignment-system
 * Creates all tables needed for the consignment system
 */
export async function POST(request: NextRequest) {
  try {
    // Create consignment_orders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        provider_company_id INTEGER REFERENCES companies(id),
        receiver_company_id INTEGER REFERENCES companies(id),
        provider_warehouse_id INTEGER REFERENCES market_warehouses(id),
        receiver_warehouse_id INTEGER REFERENCES market_warehouses(id),

        status VARCHAR(30) DEFAULT 'draft',

        scheduled_delivery_date DATE,
        actual_delivery_date DATE,

        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
        total_items INTEGER NOT NULL DEFAULT 0,
        total_units INTEGER NOT NULL DEFAULT 0,

        provider_notes TEXT,
        receiver_notes TEXT,
        rejection_reason TEXT,

        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        received_by INTEGER REFERENCES users(id),

        created_at TIMESTAMP DEFAULT NOW(),
        approved_at TIMESTAMP,
        received_at TIMESTAMP,
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created consignment_orders table')

    // Create consignment_order_items table
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_order_items (
        id SERIAL PRIMARY KEY,
        consignment_order_id INTEGER REFERENCES consignment_orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES market_products(id),

        quantity INTEGER NOT NULL,
        quantity_received INTEGER,
        quantity_sold INTEGER DEFAULT 0,
        quantity_returned INTEGER DEFAULT 0,

        provider_cost DECIMAL(10,2) NOT NULL,
        provider_price DECIMAL(10,2) NOT NULL,
        suggested_retail_price DECIMAL(10,2),
        actual_retail_price DECIMAL(10,2),

        subtotal DECIMAL(12,2) NOT NULL,

        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created consignment_order_items table')

    // Create consignment_wallets table
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_wallets (
        id SERIAL PRIMARY KEY,
        provider_company_id INTEGER REFERENCES companies(id),
        receiver_company_id INTEGER REFERENCES companies(id),

        balance DECIMAL(12,2) DEFAULT 0,
        total_sales DECIMAL(12,2) DEFAULT 0,
        total_paid DECIMAL(12,2) DEFAULT 0,
        total_returned DECIMAL(12,2) DEFAULT 0,

        last_sale_at TIMESTAMP,
        last_payment_at TIMESTAMP,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(provider_company_id, receiver_company_id)
      )
    `)
    console.log('[Migration] Created consignment_wallets table')

    // Create consignment_wallet_transactions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_wallet_transactions (
        id SERIAL PRIMARY KEY,
        wallet_id INTEGER REFERENCES consignment_wallets(id),
        transaction_type VARCHAR(30) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        balance_after DECIMAL(12,2) NOT NULL,

        consignment_order_id INTEGER REFERENCES consignment_orders(id),
        consignment_item_id INTEGER REFERENCES consignment_order_items(id),
        pos_order_id INTEGER,

        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created consignment_wallet_transactions table')

    // Create consignment_payment_requests table
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_payment_requests (
        id SERIAL PRIMARY KEY,
        request_number VARCHAR(50) UNIQUE NOT NULL,
        wallet_id INTEGER REFERENCES consignment_wallets(id),
        provider_company_id INTEGER REFERENCES companies(id),
        receiver_company_id INTEGER REFERENCES companies(id),

        amount_requested DECIMAL(12,2) NOT NULL,
        amount_paid DECIMAL(12,2) DEFAULT 0,

        status VARCHAR(20) DEFAULT 'pending',

        payment_method VARCHAR(50),
        payment_reference VARCHAR(100),

        requested_by INTEGER REFERENCES users(id),
        paid_by INTEGER REFERENCES users(id),

        requested_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP,
        notes TEXT
      )
    `)
    console.log('[Migration] Created consignment_payment_requests table')

    // Create consignment_returns table
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_returns (
        id SERIAL PRIMARY KEY,
        return_number VARCHAR(50) UNIQUE NOT NULL,
        consignment_order_id INTEGER REFERENCES consignment_orders(id),

        status VARCHAR(20) DEFAULT 'pending',

        total_items INTEGER NOT NULL,
        total_units INTEGER NOT NULL,
        total_value DECIMAL(12,2) NOT NULL,

        reason TEXT,

        created_by INTEGER REFERENCES users(id),
        received_by INTEGER REFERENCES users(id),

        created_at TIMESTAMP DEFAULT NOW(),
        received_at TIMESTAMP
      )
    `)
    console.log('[Migration] Created consignment_returns table')

    // Create consignment_return_items table
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_return_items (
        id SERIAL PRIMARY KEY,
        consignment_return_id INTEGER REFERENCES consignment_returns(id) ON DELETE CASCADE,
        consignment_item_id INTEGER REFERENCES consignment_order_items(id),
        product_id INTEGER REFERENCES market_products(id),

        quantity INTEGER NOT NULL,
        provider_price DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL,

        reason VARCHAR(100),
        notes TEXT,

        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created consignment_return_items table')

    // Create indexes
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_consignment_orders_provider ON consignment_orders(provider_company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_consignment_orders_receiver ON consignment_orders(receiver_company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_consignment_orders_status ON consignment_orders(status)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_consignment_wallets_provider ON consignment_wallets(provider_company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_consignment_wallets_receiver ON consignment_wallets(receiver_company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_consignment_items_order ON consignment_order_items(consignment_order_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_consignment_items_product ON consignment_order_items(product_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_consignment_transactions_wallet ON consignment_wallet_transactions(wallet_id)`)
      console.log('[Migration] Created indexes')
    } catch (indexError) {
      console.log('[Migration] Some indexes may already exist, continuing...')
    }

    return NextResponse.json({
      success: true,
      message: 'Consignment system migration completed successfully',
      tables: [
        'consignment_orders',
        'consignment_order_items',
        'consignment_wallets',
        'consignment_wallet_transactions',
        'consignment_payment_requests',
        'consignment_returns',
        'consignment_return_items'
      ]
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/consignment-system
 * Check migration status
 */
export async function GET(request: NextRequest) {
  try {
    const tables = [
      'consignment_orders',
      'consignment_order_items',
      'consignment_wallets',
      'consignment_wallet_transactions',
      'consignment_payment_requests',
      'consignment_returns',
      'consignment_return_items'
    ]

    const tableStatus: Record<string, boolean> = {}

    for (const table of tables) {
      try {
        await db.query(`SELECT 1 FROM ${table} LIMIT 1`)
        tableStatus[table] = true
      } catch {
        tableStatus[table] = false
      }
    }

    const allExist = Object.values(tableStatus).every(v => v)

    return NextResponse.json({
      success: true,
      migrated: allExist,
      tables: tableStatus
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
