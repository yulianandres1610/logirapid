import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Credit System Migration
 *
 * Adds credit-related columns to companies table and creates credit_charges table
 * for tracking late fees and interest charges on negative wallet balances.
 */

export async function GET(request: NextRequest) {
  try {
    console.log('Starting credit system migration...')

    // Add credit-related columns to companies table
    console.log('Adding credit columns to companies table...')

    const alterQueries = [
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(15,2) DEFAULT -200`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS negative_since TIMESTAMP`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS late_fee_charged_at TIMESTAMP`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_interest_charge_at TIMESTAMP`,
      `ALTER TABLE companies ADD COLUMN IF NOT EXISTS credit_enabled BOOLEAN DEFAULT true`
    ]

    for (const query of alterQueries) {
      try {
        await db.query(query)
        console.log(`Executed: ${query.substring(0, 60)}...`)
      } catch (e: any) {
        // Column might already exist
        console.log(`Note: ${e.message}`)
      }
    }
    console.log('Credit columns added to companies table')

    // Create credit_charges table
    console.log('Creating credit_charges table...')
    await db.query(`
      CREATE TABLE IF NOT EXISTS credit_charges (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) NOT NULL,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        balance_at_charge DECIMAL(15,2) NOT NULL,
        description TEXT,
        transaction_id INTEGER REFERENCES wallet_transactions(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('credit_charges table created')

    // Create indexes for credit_charges
    console.log('Creating credit_charges indexes...')
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_credit_charges_company ON credit_charges(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_credit_charges_type ON credit_charges(type)',
      'CREATE INDEX IF NOT EXISTS idx_credit_charges_created ON credit_charges(created_at DESC)'
    ]

    for (const idx of indexes) {
      try {
        await db.query(idx)
      } catch (e: any) {
        console.log(`Index note: ${e.message}`)
      }
    }
    console.log('credit_charges indexes created')

    // Add index on companies negative_since for cron job efficiency
    try {
      await db.query('CREATE INDEX IF NOT EXISTS idx_companies_negative_since ON companies(negative_since) WHERE negative_since IS NOT NULL')
    } catch (e: any) {
      console.log(`Companies index note: ${e.message}`)
    }

    // Check table and columns
    const creditChargesCount = await db.query('SELECT COUNT(*) as count FROM credit_charges')
    const companyCols = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'companies'
      AND column_name IN ('credit_limit', 'negative_since', 'late_fee_charged_at', 'last_interest_charge_at', 'credit_enabled')
    `)

    return NextResponse.json({
      success: true,
      message: 'Credit system migration completed successfully',
      data: {
        tablesCreated: ['credit_charges'],
        columnsAdded: companyCols.rows.map((r: any) => r.column_name),
        credit_charges_count: parseInt(creditChargesCount.rows[0]?.count || '0'),
        indexes: 4
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
 * POST - Check credit system status
 */
export async function POST(request: NextRequest) {
  try {
    // Check companies credit columns
    const companyCols = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'companies'
      AND column_name IN ('credit_limit', 'negative_since', 'late_fee_charged_at', 'last_interest_charge_at', 'credit_enabled')
      ORDER BY column_name
    `)

    // Check credit_charges table
    const chargesCols = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'credit_charges'
      ORDER BY ordinal_position
    `)

    // Check companies with negative balance
    const negativeCompanies = await db.query(`
      SELECT id, legalname, walletbalance, credit_limit, negative_since, credit_enabled
      FROM companies
      WHERE walletbalance < 0
      ORDER BY walletbalance ASC
    `)

    // Check recent credit charges
    const recentCharges = await db.query(`
      SELECT cc.*, c.legalname
      FROM credit_charges cc
      JOIN companies c ON cc.company_id = c.id
      ORDER BY cc.created_at DESC
      LIMIT 10
    `)

    return NextResponse.json({
      success: true,
      data: {
        companyCreditColumns: companyCols.rows.map((r: any) => ({
          name: r.column_name,
          type: r.data_type,
          default: r.column_default
        })),
        creditChargesTable: {
          exists: chargesCols.rows.length > 0,
          columns: chargesCols.rows.map((r: any) => ({
            name: r.column_name,
            type: r.data_type
          }))
        },
        companiesWithNegativeBalance: negativeCompanies.rows.map((r: any) => ({
          id: r.id,
          name: r.legalname,
          balance: parseFloat(r.walletbalance || '0'),
          creditLimit: parseFloat(r.credit_limit || '-200'),
          negativeSince: r.negative_since,
          creditEnabled: r.credit_enabled
        })),
        recentCharges: recentCharges.rows.map((r: any) => ({
          id: r.id,
          company: r.legalname,
          type: r.type,
          amount: parseFloat(r.amount),
          balanceAtCharge: parseFloat(r.balance_at_charge),
          createdAt: r.created_at
        }))
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
