import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/accounting-tables
 * Creates all tables needed for the accounting module
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Migration] Starting accounting tables migration...')

    // 1. Create market_employees table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_employees (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        employee_code VARCHAR(20) NOT NULL,
        hire_date DATE NOT NULL,
        termination_date DATE,
        status VARCHAR(20) DEFAULT 'active',
        pay_type VARCHAR(20) NOT NULL,
        pay_rate DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        pos_pin VARCHAR(100),
        pos_badge_code VARCHAR(50),
        commission_rate DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, employee_code)
      )
    `)
    console.log('[Migration] Created market_employees table')

    // Create unique index for badge code (allowing nulls)
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_market_employees_badge_unique
      ON market_employees(company_id, pos_badge_code)
      WHERE pos_badge_code IS NOT NULL
    `)

    // Create indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_market_employees_company ON market_employees(company_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_market_employees_user ON market_employees(user_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_market_employees_status ON market_employees(status)`)

    // 2. Create market_employee_terminals table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_employee_terminals (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER NOT NULL REFERENCES market_employees(id) ON DELETE CASCADE,
        terminal_id INTEGER NOT NULL REFERENCES market_pos_terminals(id) ON DELETE CASCADE,
        can_open_session BOOLEAN DEFAULT false,
        can_close_session BOOLEAN DEFAULT false,
        can_void_orders BOOLEAN DEFAULT false,
        can_give_discount BOOLEAN DEFAULT false,
        can_refund BOOLEAN DEFAULT false,
        max_discount_percent DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, terminal_id)
      )
    `)
    console.log('[Migration] Created market_employee_terminals table')

    // 3. Create market_payroll table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_payroll (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        employee_id INTEGER NOT NULL REFERENCES market_employees(id) ON DELETE CASCADE,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        pay_date DATE,
        base_pay DECIMAL(12,2) NOT NULL,
        hours_worked DECIMAL(8,2),
        days_worked INTEGER,
        sales_total DECIMAL(12,2) DEFAULT 0,
        commission_amount DECIMAL(12,2) DEFAULT 0,
        bonus_amount DECIMAL(12,2) DEFAULT 0,
        bonus_description TEXT,
        deductions DECIMAL(12,2) DEFAULT 0,
        deduction_notes TEXT,
        gross_pay DECIMAL(12,2) NOT NULL,
        net_pay DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        status VARCHAR(20) DEFAULT 'pending',
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        paid_by INTEGER REFERENCES users(id),
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_payroll table')

    // Create indexes for payroll
    await db.query(`CREATE INDEX IF NOT EXISTS idx_market_payroll_company ON market_payroll(company_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_market_payroll_employee ON market_payroll(employee_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_market_payroll_period ON market_payroll(period_start, period_end)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_market_payroll_status ON market_payroll(status)`)

    // 4. Create market_payment_requests table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_payment_requests (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        employee_id INTEGER NOT NULL REFERENCES market_employees(id) ON DELETE CASCADE,
        request_type VARCHAR(20) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        status VARCHAR(20) DEFAULT 'pending',
        requested_at TIMESTAMP DEFAULT NOW(),
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_payment_requests table')

    // Create indexes for payment requests
    await db.query(`CREATE INDEX IF NOT EXISTS idx_payment_requests_company ON market_payment_requests(company_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_payment_requests_employee ON market_payment_requests(employee_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON market_payment_requests(status)`)

    // 5. Create market_expense_categories table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_expense_categories (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20),
        description TEXT,
        accounting_type VARCHAR(50),
        parent_id INTEGER REFERENCES market_expense_categories(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, name)
      )
    `)
    console.log('[Migration] Created market_expense_categories table')

    // Create index for categories
    await db.query(`CREATE INDEX IF NOT EXISTS idx_expense_categories_company ON market_expense_categories(company_id)`)

    // 6. Create market_expenses table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_expenses (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        description TEXT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        expense_date DATE NOT NULL,
        category_id INTEGER REFERENCES market_expense_categories(id),
        ai_category_suggestion VARCHAR(100),
        ai_confidence DECIMAL(3,2),
        ai_analysis TEXT,
        receipt_path VARCHAR(500),
        receipt_type VARCHAR(50),
        vendor_name VARCHAR(255),
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_expenses table')

    // Create indexes for expenses
    await db.query(`CREATE INDEX IF NOT EXISTS idx_market_expenses_company ON market_expenses(company_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_market_expenses_date ON market_expenses(expense_date)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_market_expenses_category ON market_expenses(category_id)`)

    // 7. Create market_accounting_periods table
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_accounting_periods (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        period_type VARCHAR(20) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_pos_sales DECIMAL(14,2) DEFAULT 0,
        total_order_sales DECIMAL(14,2) DEFAULT 0,
        total_expenses DECIMAL(14,2) DEFAULT 0,
        total_payroll DECIMAL(14,2) DEFAULT 0,
        total_commissions DECIMAL(14,2) DEFAULT 0,
        total_consignment_cost DECIMAL(14,2) DEFAULT 0,
        total_consignment_paid DECIMAL(14,2) DEFAULT 0,
        total_purchases DECIMAL(14,2) DEFAULT 0,
        gross_profit DECIMAL(14,2) DEFAULT 0,
        net_profit DECIMAL(14,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'open',
        closed_by INTEGER REFERENCES users(id),
        closed_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created market_accounting_periods table')

    // Create indexes for accounting periods
    await db.query(`CREATE INDEX IF NOT EXISTS idx_accounting_periods_company ON market_accounting_periods(company_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_accounting_periods_dates ON market_accounting_periods(start_date, end_date)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_accounting_periods_status ON market_accounting_periods(status)`)

    // 8. Add employee_id to market_pos_orders if it doesn't exist
    try {
      await db.query(`
        ALTER TABLE market_pos_orders
        ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES market_employees(id)
      `)
      console.log('[Migration] Added employee_id to market_pos_orders')
    } catch (error) {
      console.log('[Migration] employee_id column may already exist or table not found')
    }

    // 9. Insert default expense categories for existing market companies
    const companies = await db.query(`
      SELECT id FROM companies WHERE companytype = 'market'
    `)

    for (const company of companies.rows) {
      const defaultCategories = [
        { name: 'Alquiler', code: 'RENT', type: 'opex', desc: 'Gastos de alquiler del local' },
        { name: 'Servicios', code: 'UTIL', type: 'opex', desc: 'Electricidad, agua, internet, telefono' },
        { name: 'Salarios', code: 'SAL', type: 'opex', desc: 'Pago de nominas y salarios' },
        { name: 'Inventario', code: 'INV', type: 'cogs', desc: 'Compra de mercancia para venta' },
        { name: 'Transporte', code: 'TRANS', type: 'opex', desc: 'Gastos de transporte y combustible' },
        { name: 'Marketing', code: 'MKT', type: 'opex', desc: 'Publicidad y promocion' },
        { name: 'Mantenimiento', code: 'MAINT', type: 'opex', desc: 'Reparaciones y mantenimiento' },
        { name: 'Impuestos', code: 'TAX', type: 'opex', desc: 'Pagos de impuestos' },
        { name: 'Equipamiento', code: 'EQUIP', type: 'capex', desc: 'Compra de equipos y mobiliario' },
        { name: 'Otros', code: 'OTHER', type: 'opex', desc: 'Gastos varios no categorizados' }
      ]

      for (const cat of defaultCategories) {
        try {
          await db.query(`
            INSERT INTO market_expense_categories (company_id, name, code, accounting_type, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (company_id, name) DO NOTHING
          `, [company.id, cat.name, cat.code, cat.type, cat.desc])
        } catch {
          // Ignore if already exists
        }
      }
    }
    console.log('[Migration] Inserted default expense categories')

    return NextResponse.json({
      success: true,
      message: 'Accounting tables migration completed successfully',
      tables: [
        'market_employees',
        'market_employee_terminals',
        'market_payroll',
        'market_payment_requests',
        'market_expense_categories',
        'market_expenses',
        'market_accounting_periods'
      ]
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
 * GET /api/migrations/accounting-tables
 * Check migration status
 */
export async function GET() {
  try {
    const tables = [
      'market_employees',
      'market_employee_terminals',
      'market_payroll',
      'market_payment_requests',
      'market_expense_categories',
      'market_expenses',
      'market_accounting_periods'
    ]

    const status: Record<string, boolean> = {}

    for (const table of tables) {
      try {
        await db.query(`SELECT 1 FROM ${table} LIMIT 1`)
        status[table] = true
      } catch {
        status[table] = false
      }
    }

    return NextResponse.json({
      success: true,
      tables: status
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check migration status'
    }, { status: 500 })
  }
}
