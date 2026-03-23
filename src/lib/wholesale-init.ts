import { db } from './database'

/**
 * Initialize wholesale module tables
 * This should be run once to create the tables
 */
export async function initializeWholesaleTables() {
  console.log('[Wholesale] Initializing tables...')

  // 1. Wholesale Customers
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_wholesale_customers (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      code VARCHAR(20) NOT NULL,
      business_name VARCHAR(255) NOT NULL,
      legal_name VARCHAR(255),
      tax_id VARCHAR(50),
      contact_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100) DEFAULT 'Cuba',
      pricelist_id INTEGER REFERENCES market_pricelists(id),
      credit_limit DECIMAL(12,2) DEFAULT 0,
      credit_days INTEGER DEFAULT 0,
      current_balance DECIMAL(12,2) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(company_id, code)
    )
  `)
  console.log('[Wholesale] Created market_wholesale_customers table')

  // 2. Quotes
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_quotes (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      quote_number VARCHAR(30) NOT NULL,
      customer_id INTEGER NOT NULL REFERENCES market_wholesale_customers(id),
      pricelist_id INTEGER REFERENCES market_pricelists(id),
      warehouse_id INTEGER REFERENCES market_warehouses(id),
      status VARCHAR(20) DEFAULT 'draft',
      subtotal DECIMAL(12,2) DEFAULT 0,
      discount_percent DECIMAL(5,2) DEFAULT 0,
      discount_amount DECIMAL(12,2) DEFAULT 0,
      total_amount DECIMAL(12,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'USD',
      valid_until DATE,
      notes TEXT,
      internal_notes TEXT,
      converted_to_invoice_id INTEGER,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      sent_at TIMESTAMP,
      accepted_at TIMESTAMP,
      UNIQUE(company_id, quote_number)
    )
  `)
  console.log('[Wholesale] Created market_quotes table')

  // 3. Quote Lines
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_quote_lines (
      id SERIAL PRIMARY KEY,
      quote_id INTEGER NOT NULL REFERENCES market_quotes(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES market_products(id),
      variant_id INTEGER REFERENCES market_product_variants(id),
      product_name VARCHAR(255) NOT NULL,
      product_sku VARCHAR(100),
      quantity DECIMAL(12,3) NOT NULL,
      unit_price DECIMAL(12,3) NOT NULL,
      original_price DECIMAL(12,3),
      discount_percent DECIMAL(5,2) DEFAULT 0,
      discount_amount DECIMAL(12,3) DEFAULT 0,
      subtotal DECIMAL(12,3) NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('[Wholesale] Created market_quote_lines table')

  // 4. Invoices
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_invoices (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      invoice_number VARCHAR(30) NOT NULL,
      customer_id INTEGER NOT NULL REFERENCES market_wholesale_customers(id),
      quote_id INTEGER REFERENCES market_quotes(id),
      pricelist_id INTEGER REFERENCES market_pricelists(id),
      warehouse_id INTEGER REFERENCES market_warehouses(id),
      status VARCHAR(20) DEFAULT 'draft',
      payment_status VARCHAR(20) DEFAULT 'pending',
      subtotal DECIMAL(12,2) DEFAULT 0,
      discount_percent DECIMAL(5,2) DEFAULT 0,
      discount_amount DECIMAL(12,2) DEFAULT 0,
      total_amount DECIMAL(12,2) DEFAULT 0,
      amount_paid DECIMAL(12,2) DEFAULT 0,
      amount_due DECIMAL(12,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'USD',
      due_date DATE,
      notes TEXT,
      internal_notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      confirmed_at TIMESTAMP,
      delivered_at TIMESTAMP,
      paid_at TIMESTAMP,
      UNIQUE(company_id, invoice_number)
    )
  `)
  console.log('[Wholesale] Created market_invoices table')

  // 5. Invoice Lines
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_invoice_lines (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES market_invoices(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES market_products(id),
      variant_id INTEGER REFERENCES market_product_variants(id),
      product_name VARCHAR(255) NOT NULL,
      product_sku VARCHAR(100),
      quantity DECIMAL(12,3) NOT NULL,
      quantity_delivered DECIMAL(12,3) DEFAULT 0,
      unit_price DECIMAL(12,3) NOT NULL,
      cost_price DECIMAL(12,3),
      original_price DECIMAL(12,3),
      discount_percent DECIMAL(5,2) DEFAULT 0,
      discount_amount DECIMAL(12,3) DEFAULT 0,
      subtotal DECIMAL(12,3) NOT NULL,
      warehouse_quantities JSONB DEFAULT '{}',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('[Wholesale] Created market_invoice_lines table')

  // Add warehouse_quantities column if table already exists
  try {
    await db.query(`ALTER TABLE market_invoice_lines ADD COLUMN IF NOT EXISTS warehouse_quantities JSONB DEFAULT '{}'`)
  } catch {
    // Column may already exist
  }

  // Add downpayment and wholesale exchange rate columns to market_invoices
  try {
    await db.query(`ALTER TABLE market_invoices ADD COLUMN IF NOT EXISTS downpayment_type VARCHAR(20)`)
    await db.query(`ALTER TABLE market_invoices ADD COLUMN IF NOT EXISTS downpayment_value DECIMAL(10,2)`)
    await db.query(`ALTER TABLE market_invoices ADD COLUMN IF NOT EXISTS downpayment_amount DECIMAL(10,2)`)
    await db.query(`ALTER TABLE market_invoices ADD COLUMN IF NOT EXISTS wholesale_exchange_rate DECIMAL(10,2)`)
    console.log('[Wholesale] Added downpayment and exchange rate columns')
  } catch {
    // Columns may already exist
  }

  // 6. Invoice Deliveries
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_invoice_deliveries (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES market_invoices(id),
      delivery_number VARCHAR(30) NOT NULL,
      warehouse_id INTEGER NOT NULL REFERENCES market_warehouses(id),
      operation_id INTEGER REFERENCES market_warehouse_operations(id),
      status VARCHAR(20) DEFAULT 'pending',
      delivery_date DATE,
      delivery_address TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      dispatched_at TIMESTAMP,
      delivered_at TIMESTAMP
    )
  `)
  console.log('[Wholesale] Created market_invoice_deliveries table')

  // 7. Invoice Delivery Lines
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_invoice_delivery_lines (
      id SERIAL PRIMARY KEY,
      delivery_id INTEGER NOT NULL REFERENCES market_invoice_deliveries(id) ON DELETE CASCADE,
      invoice_line_id INTEGER NOT NULL REFERENCES market_invoice_lines(id),
      product_id INTEGER NOT NULL,
      variant_id INTEGER,
      quantity_to_deliver DECIMAL(12,3) NOT NULL,
      quantity_delivered DECIMAL(12,3) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('[Wholesale] Created market_invoice_delivery_lines table')

  // 8. Invoice Payments
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_invoice_payments (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES market_invoices(id),
      payment_number VARCHAR(30) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      payment_method VARCHAR(50) NOT NULL,
      reference VARCHAR(100),
      payment_date DATE NOT NULL,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
  console.log('[Wholesale] Created market_invoice_payments table')

  // Add signature columns to market_quotes for digital signature feature
  try {
    await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signature_token UUID`)
    await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signature_data TEXT`)
    await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP`)
    await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signer_name VARCHAR(255)`)
    await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signer_ip VARCHAR(45)`)
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_signature_token ON market_quotes(signature_token) WHERE signature_token IS NOT NULL`)
    console.log('[Wholesale] Added signature columns to market_quotes')
  } catch {
    // Columns may already exist
  }

  // Add sales_rep_id column to quotes and invoices for commission tracking
  try {
    await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS sales_rep_id INTEGER REFERENCES users(id)`)
    await db.query(`ALTER TABLE market_invoices ADD COLUMN IF NOT EXISTS sales_rep_id INTEGER REFERENCES users(id)`)
    console.log('[Wholesale] Added sales_rep_id columns to market_quotes and market_invoices')
  } catch {
    // Columns may already exist
  }

  // Create indexes for better performance
  try {
    await db.query(`CREATE INDEX IF NOT EXISTS idx_wholesale_customers_company ON market_wholesale_customers(company_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_wholesale_customers_status ON market_wholesale_customers(status)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_quotes_company ON market_quotes(company_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_quotes_customer ON market_quotes(customer_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_quotes_status ON market_quotes(status)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_invoices_company ON market_invoices(company_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_invoices_customer ON market_invoices(customer_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON market_invoices(status)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON market_invoices(payment_status)`)
    console.log('[Wholesale] Created indexes')
  } catch (error) {
    console.log('[Wholesale] Some indexes may already exist')
  }

  console.log('[Wholesale] Tables initialization complete')
}
