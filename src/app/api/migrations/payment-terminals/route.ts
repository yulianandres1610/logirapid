import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Payment Terminals Migration
 *
 * This migration creates:
 * 1. company_payment_settings - Payment credentials for each company
 * 2. payment_terminals - Terminal devices for platform and companies
 */

export async function GET(request: NextRequest) {
  try {
    console.log('Starting payment terminals migration...')

    // Step 1: Create company_payment_settings table
    console.log('Creating company_payment_settings table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS company_payment_settings (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

          -- Payment Provider Selection
          active_provider VARCHAR(20) DEFAULT 'none',

          -- Square Credentials
          square_access_token VARCHAR(500),
          square_application_id VARCHAR(100),
          square_location_id VARCHAR(100),
          square_environment VARCHAR(20) DEFAULT 'sandbox',
          square_configured BOOLEAN DEFAULT false,

          -- Stripe Credentials
          stripe_secret_key VARCHAR(500),
          stripe_publishable_key VARCHAR(500),
          stripe_webhook_secret VARCHAR(500),
          stripe_configured BOOLEAN DEFAULT false,

          -- Timestamps
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)
      console.log('company_payment_settings table created')
    } catch (error: any) {
      if (!error.message?.includes('already exists')) {
        console.log('company_payment_settings note:', error.message)
      }
    }

    // Step 2: Create payment_terminals table
    console.log('Creating payment_terminals table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS payment_terminals (
          id SERIAL PRIMARY KEY,
          company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,

          -- Terminal Info
          name VARCHAR(100) NOT NULL,
          provider VARCHAR(20) NOT NULL,
          device_id VARCHAR(100),
          device_code VARCHAR(50),
          device_code_id VARCHAR(100),

          -- Status
          status VARCHAR(20) DEFAULT 'pending',
          last_seen_at TIMESTAMP,
          paired_at TIMESTAMP,

          -- Location Info
          location_name VARCHAR(100),

          -- Timestamps
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)
      console.log('payment_terminals table created')
    } catch (error: any) {
      if (!error.message?.includes('already exists')) {
        console.log('payment_terminals note:', error.message)
      }
    }

    // Step 3: Create indexes
    console.log('Creating indexes...')
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_company_payment_company ON company_payment_settings(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_terminals_company ON payment_terminals(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_terminals_device ON payment_terminals(device_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_terminals_status ON payment_terminals(status)`)
      console.log('Indexes created')
    } catch (error: any) {
      console.log('Indexes note:', error.message)
    }

    // Get current counts
    const settingsCount = await db.query('SELECT COUNT(*) as count FROM company_payment_settings')
    const terminalsCount = await db.query('SELECT COUNT(*) as count FROM payment_terminals')

    console.log('Migration completed!')

    return NextResponse.json({
      success: true,
      message: 'Payment terminals migration completed successfully',
      data: {
        tables: ['company_payment_settings', 'payment_terminals'],
        paymentSettingsCount: parseInt(settingsCount.rows[0]?.count || '0'),
        terminalsCount: parseInt(terminalsCount.rows[0]?.count || '0')
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

// POST: Check table structure
export async function POST(request: NextRequest) {
  try {
    // Check table columns
    const settingsColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'company_payment_settings'
      ORDER BY ordinal_position
    `)

    const terminalsColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'payment_terminals'
      ORDER BY ordinal_position
    `)

    return NextResponse.json({
      success: true,
      data: {
        company_payment_settings: settingsColumns.rows,
        payment_terminals: terminalsColumns.rows
      }
    })

  } catch (error) {
    console.error('Check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Check failed'
    }, { status: 500 })
  }
}
