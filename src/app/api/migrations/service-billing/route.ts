import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Service Billing System Migration
 *
 * This migration adds:
 * - billing_status, billed_at, billing_transaction_id columns to package_orders
 * - service_billing_log table for audit trail
 */

export async function GET(request: NextRequest) {
  try {
    console.log('Starting service billing migration...')

    // Step 1: Add billing columns to package_orders
    console.log('Adding billing columns to package_orders...')

    try {
      await db.query(`
        ALTER TABLE package_orders ADD COLUMN IF NOT EXISTS
          billing_status VARCHAR(20) DEFAULT 'pending'
      `)
      console.log('Added billing_status column')
    } catch (error: any) {
      console.log('billing_status column note:', error.message)
    }

    try {
      await db.query(`
        ALTER TABLE package_orders ADD COLUMN IF NOT EXISTS
          billed_at TIMESTAMP
      `)
      console.log('Added billed_at column')
    } catch (error: any) {
      console.log('billed_at column note:', error.message)
    }

    try {
      await db.query(`
        ALTER TABLE package_orders ADD COLUMN IF NOT EXISTS
          billing_transaction_id INTEGER
      `)
      console.log('Added billing_transaction_id column')
    } catch (error: any) {
      console.log('billing_transaction_id column note:', error.message)
    }

    // Step 2: Create service_billing_log table
    console.log('Creating service_billing_log table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS service_billing_log (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id),
          order_id INTEGER REFERENCES package_orders(id),
          service_type VARCHAR(50) NOT NULL,

          -- Amounts
          gross_amount DECIMAL(15,2) NOT NULL,      -- Total gross
          platform_cost DECIMAL(15,2),               -- Platform cost
          company_margin DECIMAL(15,2),              -- Company margin
          commission_paid DECIMAL(15,2) DEFAULT 0,   -- Commission to employee

          -- Related transactions
          debit_transaction_id INTEGER,
          commission_transaction_id INTEGER,

          -- User
          processed_by INTEGER REFERENCES users(id),
          processed_by_role VARCHAR(50),

          -- Audit
          created_at TIMESTAMP DEFAULT NOW(),

          -- Metadata
          products JSONB  -- Detail of billed products
        )
      `)
      console.log('service_billing_log table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('service_billing_log table already exists')
      } else {
        throw error
      }
    }

    // Step 3: Create indexes
    console.log('Creating indexes for service_billing_log...')
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_billing_log_company ON service_billing_log(company_id);
        CREATE INDEX IF NOT EXISTS idx_billing_log_order ON service_billing_log(order_id);
        CREATE INDEX IF NOT EXISTS idx_billing_log_date ON service_billing_log(created_at);
        CREATE INDEX IF NOT EXISTS idx_billing_log_type ON service_billing_log(service_type);
      `)
      console.log('Indexes created for service_billing_log')
    } catch (error: any) {
      console.log('Index creation note:', error.message)
    }

    // Step 4: Create index on package_orders billing_status
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_package_orders_billing ON package_orders(billing_status);
      `)
      console.log('Index created for package_orders.billing_status')
    } catch (error: any) {
      console.log('Index creation note:', error.message)
    }

    // Step 5: Check current state
    const ordersWithBilling = await db.query(`
      SELECT billing_status, COUNT(*) as count
      FROM package_orders
      GROUP BY billing_status
    `)

    const billingLogs = await db.query(`
      SELECT COUNT(*) as count FROM service_billing_log
    `)

    console.log('Migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Service billing migration completed',
      data: {
        columnsAdded: ['billing_status', 'billed_at', 'billing_transaction_id'],
        tablesCreated: ['service_billing_log'],
        currentState: {
          ordersByBillingStatus: ordersWithBilling.rows,
          billingLogs: parseInt(billingLogs.rows[0]?.count || '0')
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
