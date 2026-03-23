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

        -- Pricing (4 decimales para precios precisos)
        cost_price DECIMAL(10,4) NOT NULL,
        selling_price DECIMAL(10,4) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',

        -- Identifiers
        sku VARCHAR(100),
        barcode VARCHAR(100),

        -- Supplier
        supplier_name VARCHAR(255),
        supplier_contact VARCHAR(100),
        supplier_reference VARCHAR(100),

        -- Inventory (DECIMAL for decimal quantities like kg, lb)
        quantity_on_hand DECIMAL(15,3) DEFAULT 0,
        quantity_expected DECIMAL(15,3) DEFAULT 0,
        minimum_stock DECIMAL(15,3) DEFAULT 0,

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

        quantity DECIMAL(15,3) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(12,2) NOT NULL,

        quantity_received DECIMAL(15,3) DEFAULT 0,

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

        quantity DECIMAL(15,3) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(12,2) NOT NULL,

        -- Preparation status
        quantity_prepared DECIMAL(15,3) DEFAULT 0,
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

    // 6. Add unit_of_measure column to market_products
    try {
      await db.query(`
        ALTER TABLE market_products
        ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(20) DEFAULT 'unidad'
      `)
      console.log('[Migration] Added unit_of_measure column to market_products')
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        console.log(`[Migration] Note: unit_of_measure - ${e.message}`)
      }
    }

    // 6.1 Add has_variants column to market_products
    try {
      await db.query(`
        ALTER TABLE market_products
        ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false
      `)
      console.log('[Migration] Added has_variants column to market_products')
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        console.log(`[Migration] Note: has_variants - ${e.message}`)
      }
    }

    // 7. Create market_variant_types table (tipos personalizables por empresa)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_variant_types (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        type_name VARCHAR(50) NOT NULL,
        possible_values TEXT[],
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, type_name)
      )
    `)
    console.log('[Migration] Created market_variant_types table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_variant_types_company ON market_variant_types(company_id)
    `)

    // 8. Create market_product_variants table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES market_products(id) ON DELETE CASCADE,
        variant_name VARCHAR(100) NOT NULL,
        sku VARCHAR(100),
        barcode VARCHAR(100),
        cost_price DECIMAL(10,4),
        selling_price DECIMAL(10,4),
        quantity_on_hand DECIMAL(15,3) DEFAULT 0,
        image_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_product_variants table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_product_variants_product ON market_product_variants(product_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_product_variants_sku ON market_product_variants(sku)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_product_variants_barcode ON market_product_variants(barcode)
    `)

    // 9. Create market_variant_options table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_variant_options (
        id SERIAL PRIMARY KEY,
        variant_id INTEGER NOT NULL REFERENCES market_product_variants(id) ON DELETE CASCADE,
        option_type VARCHAR(50) NOT NULL,
        option_value VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_variant_options table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_variant_options_variant ON market_variant_options(variant_id)
    `)

    // 10. Create market_warehouses table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_warehouses (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,

        -- Tipo
        is_central BOOLEAN DEFAULT false,
        warehouse_type VARCHAR(50) DEFAULT 'storage',

        -- Ubicación completa (estilo empresa/broker)
        address TEXT,
        address_line2 TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        municipality VARCHAR(100),
        postal_code VARCHAR(20),
        country VARCHAR(100) DEFAULT 'Cuba',

        -- Coordenadas para rutas (Mapbox)
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),

        -- Contacto
        manager_name VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),

        -- Config
        is_active BOOLEAN DEFAULT true,
        allow_negative_stock BOOLEAN DEFAULT false,

        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(company_id, code)
      )
    `)
    console.log('[Migration] Created market_warehouses table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_warehouses_company ON market_warehouses(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_warehouses_central ON market_warehouses(company_id, is_central)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_warehouses_location ON market_warehouses(latitude, longitude)
    `)

    // 11. Create market_warehouse_stock table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_warehouse_stock (
        id SERIAL PRIMARY KEY,
        warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES market_products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES market_product_variants(id) ON DELETE CASCADE,

        quantity_on_hand DECIMAL(15,3) DEFAULT 0,
        quantity_reserved DECIMAL(15,3) DEFAULT 0,

        -- Ubicación dentro del almacén (opcional)
        location_code VARCHAR(50),

        last_counted_at TIMESTAMP,
        last_movement_at TIMESTAMP,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_warehouse_stock table')

    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_stock_unique
      ON market_warehouse_stock(warehouse_id, product_id, COALESCE(variant_id, 0))
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse ON market_warehouse_stock(warehouse_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_stock_product ON market_warehouse_stock(product_id)
    `)

    // 12. Create market_warehouse_operations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_warehouse_operations (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        operation_number VARCHAR(50) NOT NULL,

        -- Tipo de operación: transfer, reception, picking, scrap, adjustment
        operation_type VARCHAR(50) NOT NULL,

        -- Almacenes involucrados
        source_warehouse_id INTEGER REFERENCES market_warehouses(id),
        destination_warehouse_id INTEGER REFERENCES market_warehouses(id),

        -- Referencias
        reference_type VARCHAR(50),
        reference_id INTEGER,

        -- Estado: draft, confirmed, in_progress, done, cancelled
        status VARCHAR(50) DEFAULT 'draft',

        -- Fechas
        scheduled_date DATE,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,

        -- Notas
        notes TEXT,
        internal_notes TEXT,

        -- Auditoría
        created_by INTEGER REFERENCES users(id),
        confirmed_by INTEGER REFERENCES users(id),
        completed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(company_id, operation_number)
      )
    `)
    console.log('[Migration] Created market_warehouse_operations table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_operations_company ON market_warehouse_operations(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_operations_type ON market_warehouse_operations(operation_type)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_warehouse_operations_status ON market_warehouse_operations(status)
    `)

    // 13. Create market_warehouse_operation_lines table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_warehouse_operation_lines (
        id SERIAL PRIMARY KEY,
        operation_id INTEGER NOT NULL REFERENCES market_warehouse_operations(id) ON DELETE CASCADE,

        product_id INTEGER NOT NULL REFERENCES market_products(id),
        variant_id INTEGER REFERENCES market_product_variants(id),

        -- Cantidades (DECIMAL for kg, lb, etc.)
        quantity_planned DECIMAL(15,3) NOT NULL,
        quantity_done DECIMAL(15,3) DEFAULT 0,

        -- Para picking: ubicación
        source_location VARCHAR(50),
        destination_location VARCHAR(50),

        -- Lote/Serie (opcional futuro)
        lot_number VARCHAR(100),
        serial_number VARCHAR(100),

        -- Scrap: motivo
        scrap_reason VARCHAR(255),

        -- Estado de la línea: pending, partial, done
        line_status VARCHAR(50) DEFAULT 'pending',

        -- Escaneo
        scanned_at TIMESTAMP,
        scanned_by INTEGER REFERENCES users(id),

        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_warehouse_operation_lines table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_operation_lines_operation ON market_warehouse_operation_lines(operation_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_operation_lines_product ON market_warehouse_operation_lines(product_id)
    `)

    // 14. Create market_stock_movements table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_stock_movements (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        -- Producto
        product_id INTEGER NOT NULL REFERENCES market_products(id),
        variant_id INTEGER REFERENCES market_product_variants(id),

        -- Tipo de movimiento: in, out, transfer, adjustment, scrap
        movement_type VARCHAR(50) NOT NULL,

        -- Almacenes
        from_warehouse_id INTEGER REFERENCES market_warehouses(id),
        to_warehouse_id INTEGER REFERENCES market_warehouses(id),

        -- Cantidades
        quantity INTEGER NOT NULL,
        quantity_before INTEGER,
        quantity_after INTEGER,

        -- Referencia
        operation_id INTEGER REFERENCES market_warehouse_operations(id),
        reference_type VARCHAR(50),
        reference_id INTEGER,

        -- Auditoría
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_stock_movements table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON market_stock_movements(product_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse ON market_stock_movements(from_warehouse_id, to_warehouse_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON market_stock_movements(created_at DESC)
    `)

    // 15. Create odoo_product_mapping table
    await db.query(`
      CREATE TABLE IF NOT EXISTS odoo_product_mapping (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        local_product_id INTEGER NOT NULL REFERENCES market_products(id) ON DELETE CASCADE,
        odoo_product_id INTEGER NOT NULL,
        odoo_variant_id INTEGER,
        last_sync_at TIMESTAMP,
        sync_direction VARCHAR(20) DEFAULT 'both',
        sync_status VARCHAR(20) DEFAULT 'synced',
        created_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(company_id, local_product_id),
        UNIQUE(company_id, odoo_product_id)
      )
    `)
    console.log('[Migration] Created odoo_product_mapping table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_odoo_mapping_company ON odoo_product_mapping(company_id)
    `)

    // 16. Create odoo_sync_logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS odoo_sync_logs (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        sync_type VARCHAR(50) NOT NULL,
        direction VARCHAR(20) NOT NULL,
        products_imported INTEGER DEFAULT 0,
        products_exported INTEGER DEFAULT 0,
        products_updated INTEGER DEFAULT 0,
        errors JSONB,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'in_progress',
        triggered_by INTEGER REFERENCES users(id)
      )
    `)
    console.log('[Migration] Created odoo_sync_logs table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_odoo_sync_logs_company ON odoo_sync_logs(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_odoo_sync_logs_status ON odoo_sync_logs(status)
    `)

    // 17. Create market_suppliers table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_suppliers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        -- Identificación
        supplier_code VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        legal_name VARCHAR(255),
        tax_id VARCHAR(50),

        -- Contacto principal
        contact_person VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        mobile VARCHAR(50),

        -- Dirección
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Cuba',
        postal_code VARCHAR(20),

        -- Información comercial
        payment_terms VARCHAR(100),
        credit_limit DECIMAL(12,2),
        currency VARCHAR(10) DEFAULT 'USD',

        -- Categorías que suministra
        categories TEXT[],

        -- Estado
        is_active BOOLEAN DEFAULT true,
        rating INTEGER DEFAULT 3,
        notes TEXT,

        -- Auditoría
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_suppliers table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_suppliers_company ON market_suppliers(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_suppliers_code ON market_suppliers(company_id, supplier_code)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_suppliers_name ON market_suppliers(company_id, LOWER(name))
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_suppliers_active ON market_suppliers(company_id, is_active)
    `)

    // 18. Add lot/expiration columns to market_purchase_lines
    const purchaseLineColumns = [
      { name: 'lot_number', type: 'VARCHAR(100)' },
      { name: 'expiration_date', type: 'DATE' },
      { name: 'manufacturing_date', type: 'DATE' }
    ]

    for (const col of purchaseLineColumns) {
      try {
        await db.query(`
          ALTER TABLE market_purchase_lines
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        console.log(`[Migration] Added column ${col.name} to market_purchase_lines`)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          console.log(`[Migration] Note: ${col.name} - ${e.message}`)
        }
      }
    }

    // 19. Add supplier_id and warehouse_id to market_purchases
    const purchaseColumns = [
      { name: 'supplier_id', type: 'INTEGER REFERENCES market_suppliers(id)' },
      { name: 'warehouse_id', type: 'INTEGER REFERENCES market_warehouses(id)' }
    ]

    for (const col of purchaseColumns) {
      try {
        await db.query(`
          ALTER TABLE market_purchases
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        console.log(`[Migration] Added column ${col.name} to market_purchases`)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          console.log(`[Migration] Note: ${col.name} - ${e.message}`)
        }
      }
    }

    // ========================================
    // POINT OF SALE (POS) TABLES
    // ========================================

    // 20. Create market_pricelists table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_pricelists (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        type VARCHAR(20) DEFAULT 'fixed',
        currency VARCHAR(10) DEFAULT 'USD',
        valid_from DATE,
        valid_until DATE,
        is_active BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_pricelists table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_pricelists_company ON market_pricelists(company_id)
    `)

    // 21. Create market_pricelist_items table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_pricelist_items (
        id SERIAL PRIMARY KEY,
        pricelist_id INTEGER NOT NULL REFERENCES market_pricelists(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES market_products(id),
        category_id INTEGER,
        price_type VARCHAR(20) DEFAULT 'fixed',
        fixed_price DECIMAL(12,3),
        discount_percent DECIMAL(5,2),
        discount_amount DECIMAL(12,3),
        min_quantity INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_pricelist_items table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pricelist_items_pricelist ON market_pricelist_items(pricelist_id)
    `)

    // 22. Create market_pos_terminals table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_pos_terminals (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        warehouse_id INTEGER REFERENCES market_warehouses(id),
        pricelist_id INTEGER REFERENCES market_pricelists(id),
        allow_price_edit BOOLEAN DEFAULT false,
        allow_discount BOOLEAN DEFAULT true,
        max_discount_percent DECIMAL(5,2) DEFAULT 100,
        require_customer BOOLEAN DEFAULT false,
        default_currency VARCHAR(10) DEFAULT 'USD',
        accepted_currencies TEXT[] DEFAULT '{"USD","CUP","MLC"}',
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, code)
      )
    `)
    console.log('[Migration] Created market_pos_terminals table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_terminals_company ON market_pos_terminals(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_terminals_warehouse ON market_pos_terminals(warehouse_id)
    `)

    // 23. Create market_pos_users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_pos_users (
        id SERIAL PRIMARY KEY,
        pos_terminal_id INTEGER NOT NULL REFERENCES market_pos_terminals(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        can_open_session BOOLEAN DEFAULT true,
        can_close_session BOOLEAN DEFAULT true,
        can_void_orders BOOLEAN DEFAULT false,
        can_give_discount BOOLEAN DEFAULT true,
        can_refund BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(pos_terminal_id, user_id)
      )
    `)
    console.log('[Migration] Created market_pos_users table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_users_terminal ON market_pos_users(pos_terminal_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_users_user ON market_pos_users(user_id)
    `)

    // 24. Create market_pos_sessions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_pos_sessions (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        pos_terminal_id INTEGER NOT NULL REFERENCES market_pos_terminals(id),
        session_code VARCHAR(50),
        opened_by INTEGER REFERENCES users(id),
        closed_by INTEGER REFERENCES users(id),
        opened_at TIMESTAMP DEFAULT NOW(),
        closed_at TIMESTAMP,
        opening_cash_usd DECIMAL(12,2) DEFAULT 0,
        opening_cash_cup DECIMAL(12,2) DEFAULT 0,
        opening_cash_mlc DECIMAL(12,2) DEFAULT 0,
        closing_cash_usd DECIMAL(12,2),
        closing_cash_cup DECIMAL(12,2),
        closing_cash_mlc DECIMAL(12,2),
        total_sales DECIMAL(12,2) DEFAULT 0,
        total_refunds DECIMAL(12,2) DEFAULT 0,
        total_orders INTEGER DEFAULT 0,
        cash_difference DECIMAL(12,2),
        status VARCHAR(20) DEFAULT 'open',
        opening_notes TEXT,
        closing_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_pos_sessions table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_sessions_terminal ON market_pos_sessions(pos_terminal_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_sessions_status ON market_pos_sessions(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_sessions_company ON market_pos_sessions(company_id)
    `)

    // 25. Create market_pos_orders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_pos_orders (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        pos_session_id INTEGER REFERENCES market_pos_sessions(id),
        pos_terminal_id INTEGER NOT NULL REFERENCES market_pos_terminals(id),
        warehouse_id INTEGER REFERENCES market_warehouses(id),
        order_number VARCHAR(50),
        customer_id INTEGER,
        customer_name VARCHAR(255),
        subtotal DECIMAL(12,2) DEFAULT 0,
        discount_amount DECIMAL(12,2) DEFAULT 0,
        tax_amount DECIMAL(12,2) DEFAULT 0,
        total_amount DECIMAL(12,2) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'USD',
        status VARCHAR(20) DEFAULT 'draft',
        offline_id VARCHAR(100),
        synced_at TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_pos_orders table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_orders_session ON market_pos_orders(pos_session_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_orders_status ON market_pos_orders(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_orders_offline ON market_pos_orders(offline_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_orders_terminal ON market_pos_orders(pos_terminal_id)
    `)

    // 26. Create market_pos_order_lines table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_pos_order_lines (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES market_pos_orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES market_products(id),
        product_name VARCHAR(255),
        product_sku VARCHAR(100),
        quantity DECIMAL(12,3) DEFAULT 1,
        unit_price DECIMAL(12,2),
        discount_percent DECIMAL(5,2) DEFAULT 0,
        discount_amount DECIMAL(12,2) DEFAULT 0,
        subtotal DECIMAL(12,2),
        tax_amount DECIMAL(12,2) DEFAULT 0,
        total DECIMAL(12,2),
        promotion_id INTEGER,
        promotion_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_pos_order_lines table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_order_lines_order ON market_pos_order_lines(order_id)
    `)

    // 27. Create market_pos_payments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_pos_payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES market_pos_orders(id) ON DELETE CASCADE,
        payment_method VARCHAR(50),
        amount DECIMAL(12,2),
        currency VARCHAR(10) DEFAULT 'USD',
        amount_tendered DECIMAL(12,2),
        change_amount DECIMAL(12,2),
        reference VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_pos_payments table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_pos_payments_order ON market_pos_payments(order_id)
    `)

    // 28. Create market_promotions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_promotions (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        type VARCHAR(50),
        discount_percent DECIMAL(5,2),
        discount_amount DECIMAL(12,2),
        min_quantity INTEGER,
        min_amount DECIMAL(12,2),
        buy_quantity INTEGER,
        get_quantity INTEGER,
        applies_to VARCHAR(50),
        product_ids INTEGER[],
        category_ids INTEGER[],
        pos_terminal_ids INTEGER[],
        valid_from TIMESTAMP,
        valid_until TIMESTAMP,
        max_uses INTEGER,
        current_uses INTEGER DEFAULT 0,
        max_uses_per_customer INTEGER,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_promotions table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_promotions_company ON market_promotions(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_promotions_active ON market_promotions(is_active, valid_from, valid_until)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_promotions_code ON market_promotions(code)
    `)

    // 29. Add validation columns to market_warehouse_operations for transfer validation
    const operationValidationColumns = [
      { name: 'validation_status', type: "VARCHAR(50) DEFAULT NULL" },  // null, pending_validation, validated
      { name: 'validated_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'validated_at', type: 'TIMESTAMP' },
      { name: 'discrepancy_notes', type: 'TEXT' }  // Required note when quantities don't match
    ]

    for (const col of operationValidationColumns) {
      try {
        await db.query(`
          ALTER TABLE market_warehouse_operations
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        console.log(`[Migration] Added column ${col.name} to market_warehouse_operations`)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          console.log(`[Migration] Note: ${col.name} - ${e.message}`)
        }
      }
    }

    // 30. Add quantity_validated column to operation lines
    try {
      await db.query(`
        ALTER TABLE market_warehouse_operation_lines
        ADD COLUMN IF NOT EXISTS quantity_validated INTEGER DEFAULT 0
      `)
      console.log('[Migration] Added quantity_validated column to market_warehouse_operation_lines')
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        console.log(`[Migration] Note: quantity_validated - ${e.message}`)
      }
    }

    // 31. Update price columns to support 4 decimals for precise pricing
    const priceColumnUpdates = [
      { table: 'market_products', column: 'cost_price' },
      { table: 'market_products', column: 'selling_price' },
      { table: 'market_product_variants', column: 'cost_price' },
      { table: 'market_product_variants', column: 'selling_price' }
    ]

    for (const { table, column } of priceColumnUpdates) {
      try {
        await db.query(`
          ALTER TABLE ${table}
          ALTER COLUMN ${column} TYPE DECIMAL(10,4)
        `)
        console.log(`[Migration] Updated ${table}.${column} to DECIMAL(10,4)`)
      } catch (e: any) {
        // Ignore if already the correct type
        console.log(`[Migration] Note: ${table}.${column} - ${e.message}`)
      }
    }

    // 32. Add weight product fields to market_products
    const weightProductColumns = [
      { name: 'weight_barcode_prefix', type: 'VARCHAR(10)' },
      { name: 'is_weight_product', type: 'BOOLEAN DEFAULT false' }
    ]

    for (const col of weightProductColumns) {
      try {
        await db.query(`
          ALTER TABLE market_products
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        console.log(`[Migration] Added column ${col.name} to market_products`)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          console.log(`[Migration] Note: ${col.name} - ${e.message}`)
        }
      }
    }

    // Index for weight barcode prefix
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_market_products_weight_prefix
      ON market_products(weight_barcode_prefix) WHERE weight_barcode_prefix IS NOT NULL
    `)
    console.log('[Migration] Created index for weight_barcode_prefix')

    // 33. Create market_weight_labels_log table for label printing history
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_weight_labels_log (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES market_products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES market_product_variants(id) ON DELETE SET NULL,
        weight_kg DECIMAL(10,4) NOT NULL,
        price_cup DECIMAL(12,2) NOT NULL,
        barcode_generated VARCHAR(20) NOT NULL,
        printed_by INTEGER REFERENCES users(id),
        printed_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_weight_labels_log table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_weight_labels_company ON market_weight_labels_log(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_weight_labels_product ON market_weight_labels_log(product_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_weight_labels_date ON market_weight_labels_log(printed_at DESC)
    `)

    // ========================================
    // PRODUCTION/DOSIFICATION TABLES
    // ========================================

    // 34. Create market_production_orders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_production_orders (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

        -- Identificación
        order_number VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',

        -- Producto fuente (materia prima)
        source_product_id INTEGER NOT NULL REFERENCES market_products(id),
        source_variant_id INTEGER REFERENCES market_product_variants(id),
        source_warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),
        source_quantity DECIMAL(15,3) DEFAULT 1,
        source_unit_cost DECIMAL(12,4),
        source_weight_kg DECIMAL(10,4) NOT NULL,

        -- Producto final (manufacturado)
        target_product_id INTEGER NOT NULL REFERENCES market_products(id),
        target_variant_id INTEGER REFERENCES market_product_variants(id),
        target_warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),
        target_portion_weight_kg DECIMAL(10,4) NOT NULL,
        target_quantity INTEGER NOT NULL,

        -- Cálculos
        expected_total_weight_kg DECIMAL(10,4),
        waste_surplus_kg DECIMAL(10,4),
        waste_surplus_type VARCHAR(10),

        -- Cantidad real recibida
        actual_quantity INTEGER,
        actual_waste_surplus_kg DECIMAL(10,4),

        -- Costos
        materials_cost DECIMAL(12,2) DEFAULT 0,
        labor_cost DECIMAL(12,2) DEFAULT 0,
        total_cost DECIMAL(12,2) DEFAULT 0,
        cost_per_unit DECIMAL(12,4),

        -- Documentos
        production_doc_printed BOOLEAN DEFAULT false,
        reception_doc_printed BOOLEAN DEFAULT false,

        -- Auditoría
        created_by INTEGER REFERENCES users(id),
        completed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        notes TEXT,

        UNIQUE(company_id, order_number)
      )
    `)
    console.log('[Migration] Created market_production_orders table')

    // 34.1 Add essential columns for existing tables
    const productionOrderColumns = [
      { name: 'order_number', type: "VARCHAR(20)" },
      { name: 'source_quantity', type: 'DECIMAL(15,3) DEFAULT 1' },
      { name: 'source_unit_cost', type: 'DECIMAL(12,4)' }
    ]

    for (const col of productionOrderColumns) {
      try {
        await db.query(`
          ALTER TABLE market_production_orders
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        console.log(`[Migration] Added column ${col.name} to market_production_orders`)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          console.log(`[Migration] Note: ${col.name} - ${e.message}`)
        }
      }
    }

    // Migrate existing data: copy source_cost_per_kg to source_unit_cost where not set
    try {
      await db.query(`
        UPDATE market_production_orders
        SET source_unit_cost = source_cost_per_kg,
            source_quantity = 1
        WHERE source_unit_cost IS NULL AND source_cost_per_kg IS NOT NULL
      `)
      console.log('[Migration] Migrated existing source_cost_per_kg to source_unit_cost')
    } catch (e: any) {
      console.log(`[Migration] Note: migration of cost columns - ${e.message}`)
    }

    // Generate order_number for any rows that don't have one
    try {
      await db.query(`
        UPDATE market_production_orders
        SET order_number = 'PRD-' || EXTRACT(YEAR FROM created_at)::TEXT || '-' || LPAD(id::TEXT, 4, '0')
        WHERE order_number IS NULL OR order_number = ''
      `)
      console.log('[Migration] Generated order_numbers for existing production orders')
    } catch (e: any) {
      console.log(`[Migration] Note: order_number generation - ${e.message}`)
    }

    // Add unique constraint if not exists
    try {
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_production_orders_order_number
        ON market_production_orders(company_id, order_number)
      `)
      console.log('[Migration] Added unique index for order_number')
    } catch (e: any) {
      console.log(`[Migration] Note: unique index - ${e.message}`)
    }

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_orders_company ON market_production_orders(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_orders_status ON market_production_orders(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_orders_date ON market_production_orders(created_at DESC)
    `)

    // 35. Create market_production_materials table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_production_materials (
        id SERIAL PRIMARY KEY,
        production_order_id INTEGER NOT NULL REFERENCES market_production_orders(id) ON DELETE CASCADE,

        -- Material usado (bolsas, etiquetas, etc.)
        product_id INTEGER NOT NULL REFERENCES market_products(id),
        variant_id INTEGER REFERENCES market_product_variants(id),
        warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),

        quantity DECIMAL(15,3) NOT NULL,
        unit_cost DECIMAL(12,4),
        total_cost DECIMAL(12,2),

        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_production_materials table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_materials_order ON market_production_materials(production_order_id)
    `)

    // 36. Create market_production_log table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_production_log (
        id SERIAL PRIMARY KEY,
        production_order_id INTEGER NOT NULL REFERENCES market_production_orders(id) ON DELETE CASCADE,

        action VARCHAR(50) NOT NULL,
        details JSONB,
        performed_by INTEGER REFERENCES users(id),
        performed_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_production_log table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_log_order ON market_production_log(production_order_id)
    `)

    // ========================================
    // PRODUCTION LOT INVENTORY (FIFO)
    // ========================================

    // 37. Create production_lot_inventory table for FIFO tracking of produced items
    await db.query(`
      CREATE TABLE IF NOT EXISTS production_lot_inventory (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES market_products(id) ON DELETE CASCADE,
        variant_id INTEGER REFERENCES market_product_variants(id) ON DELETE SET NULL,
        production_order_id INTEGER NOT NULL REFERENCES market_production_orders(id) ON DELETE CASCADE,

        lot_number VARCHAR(50) NOT NULL,
        expiration_date DATE,
        manufacturing_date DATE DEFAULT CURRENT_DATE,

        quantity_initial DECIMAL(15,3) NOT NULL,
        quantity_available DECIMAL(15,3) NOT NULL,
        quantity_sold DECIMAL(15,3) DEFAULT 0,

        unit_cost DECIMAL(12,4),

        received_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(company_id, lot_number)
      )
    `)
    console.log('[Migration] Created production_lot_inventory table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_lot_fifo
      ON production_lot_inventory(company_id, product_id, warehouse_id, received_at ASC)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_lot_company
      ON production_lot_inventory(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_lot_warehouse
      ON production_lot_inventory(warehouse_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_lot_product
      ON production_lot_inventory(product_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_lot_order
      ON production_lot_inventory(production_order_id)
    `)

    // 38. Add lot tracking columns to market_production_orders
    const lotTrackingColumns = [
      { name: 'lot_number', type: 'VARCHAR(50)' },
      { name: 'expiration_date', type: 'DATE' },
      { name: 'materials_validation_status', type: "VARCHAR(20) DEFAULT NULL" },
      { name: 'materials_validated_at', type: 'TIMESTAMP' },
      { name: 'materials_validated_by', type: 'INTEGER REFERENCES users(id)' }
    ]

    for (const col of lotTrackingColumns) {
      try {
        await db.query(`
          ALTER TABLE market_production_orders
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
        console.log(`[Migration] Added column ${col.name} to market_production_orders`)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          console.log(`[Migration] Note: ${col.name} - ${e.message}`)
        }
      }
    }

    // 39. Create material validation tracking table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_production_material_validations (
        id SERIAL PRIMARY KEY,
        production_order_id INTEGER NOT NULL REFERENCES market_production_orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES market_products(id),
        variant_id INTEGER REFERENCES market_product_variants(id),

        quantity_expected DECIMAL(15,3) NOT NULL,
        quantity_validated DECIMAL(15,3) DEFAULT 0,

        scanned_at TIMESTAMP,
        scanned_by INTEGER REFERENCES users(id),

        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_production_material_validations table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_material_validations_order
      ON market_production_material_validations(production_order_id)
    `)

    // ========================================
    // PRODUCTION FORMULAS & PLANNING
    // ========================================

    // 40. Create market_production_formulas table (Recipe definitions)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_production_formulas (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        code VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        target_product_id INTEGER REFERENCES market_products(id),
        yield_quantity DECIMAL(15,3) NOT NULL DEFAULT 1,
        yield_unit VARCHAR(20) DEFAULT 'unidad',
        labor_cost_per_batch DECIMAL(10,2) DEFAULT 0,
        estimated_time_minutes INTEGER,
        notes TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, code)
      )
    `)
    console.log('[Migration] Created market_production_formulas table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_formulas_company
      ON market_production_formulas(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_formulas_product
      ON market_production_formulas(target_product_id)
    `)

    // 41. Create market_production_formula_lines table (Formula ingredients)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_production_formula_lines (
        id SERIAL PRIMARY KEY,
        formula_id INTEGER NOT NULL REFERENCES market_production_formulas(id) ON DELETE CASCADE,
        raw_material_id INTEGER NOT NULL REFERENCES market_products(id),
        quantity DECIMAL(15,4) NOT NULL,
        is_critical BOOLEAN DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_production_formula_lines table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_formula_lines_formula
      ON market_production_formula_lines(formula_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_formula_lines_material
      ON market_production_formula_lines(raw_material_id)
    `)

    // 42. Create market_production_plans table (Production planning)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_production_plans (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        plan_number VARCHAR(30) NOT NULL,
        formula_id INTEGER NOT NULL REFERENCES market_production_formulas(id),
        warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),
        target_warehouse_id INTEGER REFERENCES market_warehouses(id),
        planned_date DATE NOT NULL,
        planned_quantity DECIMAL(15,3) NOT NULL,
        batches INTEGER DEFAULT 1,
        status VARCHAR(30) DEFAULT 'draft',
        lot_number VARCHAR(50),
        barcode VARCHAR(50),
        actual_quantity DECIMAL(15,3),
        waste_quantity DECIMAL(15,3) DEFAULT 0,
        materials_cost DECIMAL(12,2) DEFAULT 0,
        labor_cost DECIMAL(12,2) DEFAULT 0,
        total_cost DECIMAL(12,2) DEFAULT 0,
        cost_per_unit DECIMAL(12,4),
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        scheduled_by INTEGER REFERENCES users(id),
        materials_issued_by INTEGER REFERENCES users(id),
        materials_issued_at TIMESTAMP,
        started_by INTEGER REFERENCES users(id),
        started_at TIMESTAMP,
        completed_by INTEGER REFERENCES users(id),
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, plan_number)
      )
    `)
    console.log('[Migration] Created market_production_plans table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_plans_company
      ON market_production_plans(company_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_plans_formula
      ON market_production_plans(formula_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_plans_status
      ON market_production_plans(status)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_plans_date
      ON market_production_plans(planned_date)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_production_plans_warehouse
      ON market_production_plans(warehouse_id)
    `)

    // 43. Create market_production_plan_materials table (Materials for each plan)
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_production_plan_materials (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER NOT NULL REFERENCES market_production_plans(id) ON DELETE CASCADE,
        raw_material_id INTEGER NOT NULL REFERENCES market_products(id),
        quantity_required DECIMAL(15,4) NOT NULL,
        quantity_issued DECIMAL(15,4) DEFAULT 0,
        unit_cost DECIMAL(10,4),
        total_cost DECIMAL(12,2),
        status VARCHAR(20) DEFAULT 'pending',
        issued_at TIMESTAMP,
        issued_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_production_plan_materials table')

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_plan_materials_plan
      ON market_production_plan_materials(plan_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_plan_materials_material
      ON market_production_plan_materials(raw_material_id)
    `)
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_plan_materials_status
      ON market_production_plan_materials(status)
    `)

    // ========================================
    // CONSIGNMENT DATA SYNC
    // ========================================
    // Sync consignment_orders.total_sold from line items (fix for historical data)
    console.log('[Migration] Syncing consignment_orders.total_sold from line items...')

    try {
      const consignmentSyncResult = await db.query(`
        UPDATE consignment_orders o
        SET
          total_sold = COALESCE((
            SELECT SUM(ol.quantity_sold * ol.unit_cost)
            FROM consignment_order_lines ol
            WHERE ol.order_id = o.id
          ), 0),
          updated_at = NOW()
        RETURNING id, order_number, total_sold
      `)

      const syncedOrders = consignmentSyncResult.rows.length
      const totalSynced = consignmentSyncResult.rows.reduce((sum: number, r: any) => sum + parseFloat(r.total_sold || 0), 0)

      console.log('[Migration] Consignment sync completed:', {
        ordersUpdated: syncedOrders,
        totalSoldSynced: totalSynced
      })
    } catch (e: any) {
      // Table might not exist in some environments
      console.log('[Migration] Note: consignment sync - ', e.message)
    }

    // PRINT QUEUE CLEANUP - Clear pending/queued print jobs
    console.log('[Migration] Clearing pending print jobs queue...')
    try {
      const clearQueueResult = await db.query(`
        UPDATE print_jobs
        SET status = 'cancelled',
            error_message = 'Cancelled by system cleanup',
            updated_at = NOW()
        WHERE status IN ('pending', 'queued', 'sent')
        RETURNING id, job_number
      `)
      console.log('[Migration] Print queue cleared:', clearQueueResult.rows.length, 'jobs cancelled')
    } catch (e: any) {
      console.log('[Migration] Note: print queue cleanup - ', e.message)
    }

    // Add signature columns to market_quotes for digital signature feature
    console.log('[Migration] Adding signature columns to market_quotes...')
    try {
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signature_token UUID`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signature_data TEXT`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signer_name VARCHAR(255)`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signer_ip VARCHAR(45)`)
      await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_signature_token ON market_quotes(signature_token) WHERE signature_token IS NOT NULL`)
      console.log('[Migration] Added signature columns to market_quotes')
    } catch (e: any) {
      console.log('[Migration] Note: signature columns -', e.message)
    }

    // Upgrade pricelist_items decimal precision to 3 decimals
    try {
      await db.query(`ALTER TABLE market_pricelist_items ALTER COLUMN fixed_price TYPE DECIMAL(12,3)`)
      await db.query(`ALTER TABLE market_pricelist_items ALTER COLUMN discount_amount TYPE DECIMAL(12,3)`)
      console.log('[Migration] Upgraded pricelist_items price columns to 3 decimals')
    } catch (e: any) {
      console.log('[Migration] Note: pricelist decimal upgrade -', e.message)
    }

    // Get table stats
    const tables = [
      'market_products',
      'market_purchases',
      'market_purchase_lines',
      'market_orders',
      'market_order_lines',
      'market_inventory_movements',
      'market_variant_types',
      'market_product_variants',
      'market_variant_options',
      'market_warehouses',
      'market_warehouse_stock',
      'market_warehouse_operations',
      'market_warehouse_operation_lines',
      'market_stock_movements',
      'odoo_product_mapping',
      'odoo_sync_logs',
      'market_suppliers',
      'market_pricelists',
      'market_pricelist_items',
      'market_pos_terminals',
      'market_pos_users',
      'market_pos_sessions',
      'market_pos_orders',
      'market_pos_order_lines',
      'market_pos_payments',
      'market_promotions',
      'market_weight_labels_log',
      'market_production_orders',
      'market_production_materials',
      'market_production_log',
      'production_lot_inventory',
      'market_production_material_validations',
      'market_production_formulas',
      'market_production_formula_lines',
      'market_production_plans',
      'market_production_plan_materials'
    ]
    const tableStats = []

    for (const table of tables) {
      try {
        const result = await db.query(`SELECT COUNT(*) as count FROM ${table}`)
        tableStats.push({ table, count: result.rows[0].count })
      } catch (e) {
        tableStats.push({ table, count: 0, error: 'Table not found' })
      }
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
    const tables = [
      'market_products',
      'market_purchases',
      'market_purchase_lines',
      'market_orders',
      'market_order_lines',
      'market_inventory_movements',
      'market_variant_types',
      'market_product_variants',
      'market_variant_options',
      'market_warehouses',
      'market_warehouse_stock',
      'market_warehouse_operations',
      'market_warehouse_operation_lines',
      'market_stock_movements',
      'odoo_product_mapping',
      'odoo_sync_logs',
      'market_suppliers',
      'market_pricelists',
      'market_pricelist_items',
      'market_pos_terminals',
      'market_pos_users',
      'market_pos_sessions',
      'market_pos_orders',
      'market_pos_order_lines',
      'market_pos_payments',
      'market_promotions',
      'market_production_orders',
      'market_production_materials',
      'market_production_log',
      'production_lot_inventory',
      'market_production_material_validations',
      'market_production_formulas',
      'market_production_formula_lines',
      'market_production_plans',
      'market_production_plan_materials'
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
