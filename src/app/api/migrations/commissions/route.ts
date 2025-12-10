import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Commission System Migration
 *
 * This migration creates:
 * - company_commission_config: Configuration of commissions per company/product/role
 * - employee_commissions: History of commissions paid to employees
 */

export async function GET(request: NextRequest) {
  try {
    console.log('Starting commission system migration...')

    // Step 1: Create company_commission_config table
    console.log('Creating company_commission_config table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS company_commission_config (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES product_catalog(id) ON DELETE CASCADE,

          -- Role that receives the commission
          role VARCHAR(50) NOT NULL, -- 'DRIVER', 'USER', 'MANAGER', 'ADMIN', 'ALL'

          -- Commission type
          commission_type VARCHAR(20) NOT NULL DEFAULT 'fixed', -- 'fixed' or 'percentage'
          commission_value DECIMAL(15,4) NOT NULL DEFAULT 0, -- Amount or percentage

          -- Additional configuration
          min_amount DECIMAL(15,2) DEFAULT 0, -- Minimum to pay (for percentages)
          max_amount DECIMAL(15,2) DEFAULT NULL, -- Maximum to pay (cap)

          -- Status
          is_active BOOLEAN DEFAULT true,

          -- Audit
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_by INTEGER REFERENCES users(id),
          updated_at TIMESTAMP DEFAULT NOW(),

          -- Unique constraint: one config per company/product/role
          UNIQUE(company_id, product_id, role)
        )
      `)
      console.log('company_commission_config table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('company_commission_config table already exists')
      } else {
        throw error
      }
    }

    // Step 2: Create indexes for company_commission_config
    console.log('Creating indexes for company_commission_config...')
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_commission_config_company ON company_commission_config(company_id);
        CREATE INDEX IF NOT EXISTS idx_commission_config_product ON company_commission_config(product_id);
        CREATE INDEX IF NOT EXISTS idx_commission_config_role ON company_commission_config(role);
        CREATE INDEX IF NOT EXISTS idx_commission_config_active ON company_commission_config(company_id, is_active);
      `)
      console.log('Indexes created for company_commission_config')
    } catch (error: any) {
      console.log('Index creation note:', error.message)
    }

    // Step 3: Create employee_commissions table
    console.log('Creating employee_commissions table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS employee_commissions (
          id SERIAL PRIMARY KEY,

          -- Company and employee
          company_id INTEGER NOT NULL REFERENCES companies(id),
          user_id INTEGER NOT NULL REFERENCES users(id),
          user_role VARCHAR(50) NOT NULL,

          -- Service reference
          service_type VARCHAR(50) NOT NULL, -- 'package_delivery', 'recharge', 'transfer', etc.
          service_id INTEGER, -- ID of package_order, transaction, etc.
          service_reference VARCHAR(100), -- Order number or reference

          -- Product
          product_id INTEGER REFERENCES product_catalog(id),
          product_name VARCHAR(255),
          product_price DECIMAL(15,2), -- Product price at the time

          -- Commission
          commission_config_id INTEGER REFERENCES company_commission_config(id),
          commission_type VARCHAR(20) NOT NULL, -- 'fixed' or 'percentage'
          commission_rate DECIMAL(15,4), -- The configured value (amount or %)
          commission_amount DECIMAL(15,2) NOT NULL, -- Final calculated amount

          -- Payment transaction
          transaction_id INTEGER REFERENCES wallet_transactions(id),
          transaction_number VARCHAR(100),

          -- Status
          status VARCHAR(20) DEFAULT 'paid', -- 'pending', 'paid', 'cancelled'

          -- Audit
          created_at TIMESTAMP DEFAULT NOW(),
          paid_at TIMESTAMP,

          -- Notes
          notes TEXT
        )
      `)
      console.log('employee_commissions table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('employee_commissions table already exists')
      } else {
        throw error
      }
    }

    // Step 4: Create indexes for employee_commissions
    console.log('Creating indexes for employee_commissions...')
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_emp_comm_company ON employee_commissions(company_id);
        CREATE INDEX IF NOT EXISTS idx_emp_comm_user ON employee_commissions(user_id);
        CREATE INDEX IF NOT EXISTS idx_emp_comm_service ON employee_commissions(service_type, service_id);
        CREATE INDEX IF NOT EXISTS idx_emp_comm_date ON employee_commissions(created_at);
        CREATE INDEX IF NOT EXISTS idx_emp_comm_status ON employee_commissions(status);
      `)
      console.log('Indexes created for employee_commissions')
    } catch (error: any) {
      console.log('Index creation note:', error.message)
    }

    // Step 5: Check current state
    const configCount = await db.query(`
      SELECT COUNT(*) as count FROM company_commission_config
    `)
    const commissionsCount = await db.query(`
      SELECT COUNT(*) as count FROM employee_commissions
    `)
    const productsCount = await db.query(`
      SELECT COUNT(*) as count FROM product_catalog
    `)
    const companiesCount = await db.query(`
      SELECT COUNT(*) as count FROM companies WHERE status = 'active'
    `)

    console.log('Migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Commission system migration completed',
      data: {
        tablesCreated: ['company_commission_config', 'employee_commissions'],
        currentState: {
          commissionConfigs: parseInt(configCount.rows[0]?.count || '0'),
          paidCommissions: parseInt(commissionsCount.rows[0]?.count || '0'),
          availableProducts: parseInt(productsCount.rows[0]?.count || '0'),
          activeCompanies: parseInt(companiesCount.rows[0]?.count || '0')
        }
      }
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}

/**
 * POST: Create sample commission configurations for testing
 */
export async function POST(request: NextRequest) {
  try {
    console.log('Creating sample commission configurations...')

    // Get a company and some products for sample data
    const company = await db.query(`
      SELECT id, legalname FROM companies WHERE status = 'active' ORDER BY id LIMIT 1
    `)

    if (company.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active companies found'
      }, { status: 400 })
    }

    const companyId = company.rows[0].id
    const companyName = company.rows[0].legalname

    // Get some products
    const products = await db.query(`
      SELECT id, code, name, service_category FROM product_catalog ORDER BY id LIMIT 5
    `)

    if (products.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No products found in product_catalog'
      }, { status: 400 })
    }

    let created = 0
    const errors: string[] = []

    // Create sample commissions for the first 3 products
    const sampleConfigs = [
      { role: 'DRIVER', commissionType: 'fixed', value: 2.50 },
      { role: 'USER', commissionType: 'percentage', value: 5 },
      { role: 'ALL', commissionType: 'fixed', value: 1.00 }
    ]

    for (let i = 0; i < Math.min(products.rows.length, 3); i++) {
      const product = products.rows[i]
      const config = sampleConfigs[i]

      try {
        await db.query(`
          INSERT INTO company_commission_config (
            company_id, product_id, role, commission_type, commission_value, is_active
          ) VALUES ($1, $2, $3, $4, $5, true)
          ON CONFLICT (company_id, product_id, role) DO UPDATE SET
            commission_type = EXCLUDED.commission_type,
            commission_value = EXCLUDED.commission_value,
            updated_at = NOW()
        `, [companyId, product.id, config.role, config.commissionType, config.value])
        created++
        console.log(`Created commission for ${product.name} (${config.role}): ${config.commissionType} ${config.value}`)
      } catch (error: any) {
        errors.push(`Product ${product.id}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sample commission configurations created',
      data: {
        companyId,
        companyName,
        created,
        errors: errors.length > 0 ? errors : undefined
      }
    })

  } catch (error) {
    console.error('Error creating sample commissions:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sample commissions'
    }, { status: 500 })
  }
}
