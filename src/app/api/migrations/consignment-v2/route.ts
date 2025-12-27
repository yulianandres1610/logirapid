import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/consignment-v2
 * Crea todas las tablas del sistema de consignacion v2
 */
export async function POST() {
  try {
    console.log('[Migration] Starting consignment v2 migration...')

    // 1. Proveedores de consignacion
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_suppliers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code VARCHAR(10) NOT NULL,
        name VARCHAR(255) NOT NULL,
        legal_name VARCHAR(255),
        tax_id VARCHAR(50),
        contact_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT,
        username VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, code)
      )
    `)
    console.log('[Migration] Created consignment_suppliers table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_suppliers_company
      ON consignment_suppliers(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_suppliers_username
      ON consignment_suppliers(username)
    `)

    // 2. Ordenes de consignacion
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_orders (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        order_number VARCHAR(50) UNIQUE NOT NULL,
        supplier_id INTEGER NOT NULL REFERENCES consignment_suppliers(id),
        warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),
        status VARCHAR(50) DEFAULT 'pending',
        total_items INTEGER DEFAULT 0,
        total_units INTEGER DEFAULT 0,
        total_cost DECIMAL(12,2) DEFAULT 0,
        total_sold DECIMAL(12,2) DEFAULT 0,
        total_paid DECIMAL(12,2) DEFAULT 0,
        total_returned DECIMAL(12,2) DEFAULT 0,
        consignment_date DATE,
        received_at TIMESTAMP,
        completed_at TIMESTAMP,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        received_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created consignment_orders table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_orders_company
      ON consignment_orders(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_orders_supplier
      ON consignment_orders(supplier_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_orders_warehouse
      ON consignment_orders(warehouse_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_orders_status
      ON consignment_orders(status)
    `)

    // 3. Lineas de orden
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_order_lines (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES consignment_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES market_products(id),
        quantity_ordered INTEGER NOT NULL,
        quantity_received INTEGER DEFAULT 0,
        quantity_sold INTEGER DEFAULT 0,
        quantity_returned INTEGER DEFAULT 0,
        unit_cost DECIMAL(10,2) NOT NULL,
        unit_price DECIMAL(10,2),
        lot_number VARCHAR(50),
        expiration_date DATE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created consignment_order_lines table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_order_lines_order
      ON consignment_order_lines(order_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_order_lines_product
      ON consignment_order_lines(product_id)
    `)

    // 4. Inventario por lote (FIFO)
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_lot_inventory (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),
        product_id INTEGER NOT NULL REFERENCES market_products(id),
        order_line_id INTEGER REFERENCES consignment_order_lines(id),
        supplier_id INTEGER REFERENCES consignment_suppliers(id),
        lot_number VARCHAR(50) NOT NULL,
        expiration_date DATE,
        quantity_initial INTEGER NOT NULL,
        quantity_available INTEGER NOT NULL,
        quantity_sold INTEGER DEFAULT 0,
        quantity_returned INTEGER DEFAULT 0,
        unit_cost DECIMAL(10,2) NOT NULL,
        received_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(warehouse_id, product_id, lot_number)
      )
    `)
    console.log('[Migration] Created consignment_lot_inventory table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_lot_inventory_warehouse
      ON consignment_lot_inventory(warehouse_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_lot_inventory_product
      ON consignment_lot_inventory(product_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_lot_inventory_fifo
      ON consignment_lot_inventory(warehouse_id, product_id, received_at ASC)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_lot_inventory_supplier
      ON consignment_lot_inventory(supplier_id)
    `)

    // 5. Wallet proveedor
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_supplier_wallets (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER NOT NULL REFERENCES consignment_suppliers(id) UNIQUE,
        balance_available DECIMAL(12,2) DEFAULT 0,
        balance_pending DECIMAL(12,2) DEFAULT 0,
        total_earned DECIMAL(12,2) DEFAULT 0,
        total_paid DECIMAL(12,2) DEFAULT 0,
        total_returned DECIMAL(12,2) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created consignment_supplier_wallets table')

    // 6. Transacciones wallet
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_wallet_transactions (
        id SERIAL PRIMARY KEY,
        wallet_id INTEGER NOT NULL REFERENCES consignment_supplier_wallets(id),
        order_id INTEGER REFERENCES consignment_orders(id),
        transaction_type VARCHAR(50) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        balance_after DECIMAL(12,2),
        pos_order_id INTEGER,
        pos_order_number VARCHAR(50),
        product_id INTEGER REFERENCES market_products(id),
        product_name VARCHAR(255),
        quantity INTEGER,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created consignment_wallet_transactions table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_wallet_transactions_wallet
      ON consignment_wallet_transactions(wallet_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_wallet_transactions_order
      ON consignment_wallet_transactions(order_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_wallet_transactions_type
      ON consignment_wallet_transactions(transaction_type)
    `)

    // 7. Solicitudes de pago
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_payment_requests (
        id SERIAL PRIMARY KEY,
        request_number VARCHAR(50) UNIQUE NOT NULL,
        supplier_id INTEGER NOT NULL REFERENCES consignment_suppliers(id),
        company_id INTEGER NOT NULL REFERENCES companies(id),
        amount_requested DECIMAL(12,2) NOT NULL,
        amount_paid DECIMAL(12,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(50),
        payment_reference VARCHAR(100),
        requested_at TIMESTAMP DEFAULT NOW(),
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        paid_by INTEGER REFERENCES users(id),
        paid_at TIMESTAMP,
        rejected_by INTEGER REFERENCES users(id),
        rejected_at TIMESTAMP,
        rejection_reason TEXT,
        notes TEXT
      )
    `)
    console.log('[Migration] Created consignment_payment_requests table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_payment_requests_supplier
      ON consignment_payment_requests(supplier_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_payment_requests_status
      ON consignment_payment_requests(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_payment_requests_company
      ON consignment_payment_requests(company_id)
    `)

    // 8. Ordenes de devolucion
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_returns (
        id SERIAL PRIMARY KEY,
        return_number VARCHAR(50) UNIQUE NOT NULL,
        order_id INTEGER NOT NULL REFERENCES consignment_orders(id),
        supplier_id INTEGER NOT NULL REFERENCES consignment_suppliers(id),
        warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),
        company_id INTEGER NOT NULL REFERENCES companies(id),
        status VARCHAR(50) DEFAULT 'pending',
        total_items INTEGER DEFAULT 0,
        total_units INTEGER DEFAULT 0,
        total_value DECIMAL(12,2) DEFAULT 0,
        reason TEXT,
        created_by INTEGER REFERENCES users(id),
        validated_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        validated_at TIMESTAMP
      )
    `)
    console.log('[Migration] Created consignment_returns table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_returns_order
      ON consignment_returns(order_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_returns_supplier
      ON consignment_returns(supplier_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_returns_status
      ON consignment_returns(status)
    `)

    // 9. Lineas devolucion
    await db.query(`
      CREATE TABLE IF NOT EXISTS consignment_return_lines (
        id SERIAL PRIMARY KEY,
        return_id INTEGER NOT NULL REFERENCES consignment_returns(id) ON DELETE CASCADE,
        order_line_id INTEGER REFERENCES consignment_order_lines(id),
        lot_inventory_id INTEGER REFERENCES consignment_lot_inventory(id),
        product_id INTEGER NOT NULL REFERENCES market_products(id),
        quantity_to_return INTEGER NOT NULL,
        quantity_validated INTEGER DEFAULT 0,
        unit_cost DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created consignment_return_lines table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_consignment_return_lines_return
      ON consignment_return_lines(return_id)
    `)

    // Get table counts
    const tables = [
      'consignment_suppliers',
      'consignment_orders',
      'consignment_order_lines',
      'consignment_lot_inventory',
      'consignment_supplier_wallets',
      'consignment_wallet_transactions',
      'consignment_payment_requests',
      'consignment_returns',
      'consignment_return_lines'
    ]

    const tableStats = []
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`)
        tableStats.push({ table, count: parseInt(result.rows[0].count), status: 'created' })
      } catch {
        tableStats.push({ table, count: 0, status: 'error' })
      }
    }

    console.log('[Migration] Consignment v2 migration completed')

    return NextResponse.json({
      success: true,
      message: 'Consignment v2 tables created successfully',
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
 * GET /api/migrations/consignment-v2
 * Verifica estado de las tablas
 */
export async function GET() {
  try {
    const tables = [
      'consignment_suppliers',
      'consignment_orders',
      'consignment_order_lines',
      'consignment_lot_inventory',
      'consignment_supplier_wallets',
      'consignment_wallet_transactions',
      'consignment_payment_requests',
      'consignment_returns',
      'consignment_return_lines'
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
