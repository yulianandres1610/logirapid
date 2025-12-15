import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST() {
  try {
    console.log('[Migration] Starting broker_wallet_balances migration...')

    // Create broker_wallet_balances table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS broker_wallet_balances (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        available_balance DECIMAL(15,2) DEFAULT 0,
        reserved_balance DECIMAL(15,2) DEFAULT 0,
        total_deposits DECIMAL(15,2) DEFAULT 0,
        total_withdrawals DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, currency)
      )
    `)

    console.log('[Migration] Created broker_wallet_balances table')

    // Create index for faster lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_broker_wallet_company_currency
      ON broker_wallet_balances(company_id, currency)
    `)

    // Initialize balances for existing brokers that don't have entries
    // Get all broker companies
    const brokers = await db.query(`
      SELECT id, legalname, currency, COALESCE("walletBalance"::numeric, walletbalance, 0) as current_balance
      FROM companies
      WHERE companytype = 'broker'
    `)

    let initialized = 0
    for (const broker of brokers.rows) {
      const currency = broker.currency || 'USD'
      const currentBalance = parseFloat(broker.current_balance) || 0

      // Check if balance exists
      const existing = await db.query(`
        SELECT id FROM broker_wallet_balances
        WHERE company_id = $1 AND currency = $2
      `, [broker.id, currency])

      if (existing.rows.length === 0) {
        // Create balance entry
        await db.query(`
          INSERT INTO broker_wallet_balances (company_id, currency, available_balance)
          VALUES ($1, $2, $3)
        `, [broker.id, currency, currentBalance])
        initialized++
        console.log(`[Migration] Initialized ${currency} balance for broker ${broker.legalname}: ${currentBalance}`)
      }
    }

    // Get current table structure
    const columnsResult = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'broker_wallet_balances'
      ORDER BY ordinal_position
    `)

    console.log('[Migration] Broker wallet balances migration completed')

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      initialized,
      totalBrokers: brokers.rows.length,
      columns: columnsResult.rows
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
    // Check current state
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'broker_wallet_balances'
      ) as exists
    `)

    if (!tableExists.rows[0].exists) {
      return NextResponse.json({
        success: true,
        tableExists: false,
        needsMigration: true
      })
    }

    const balances = await db.query(`
      SELECT
        bwb.id,
        bwb.company_id,
        c.legalname as company_name,
        bwb.currency,
        bwb.available_balance,
        bwb.reserved_balance,
        bwb.total_deposits,
        bwb.total_withdrawals
      FROM broker_wallet_balances bwb
      JOIN companies c ON c.id = bwb.company_id
      ORDER BY c.legalname, bwb.currency
    `)

    const stats = await db.query(`
      SELECT
        currency,
        COUNT(*) as broker_count,
        SUM(available_balance) as total_available,
        SUM(reserved_balance) as total_reserved
      FROM broker_wallet_balances
      GROUP BY currency
      ORDER BY currency
    `)

    return NextResponse.json({
      success: true,
      tableExists: true,
      needsMigration: false,
      balances: balances.rows,
      stats: stats.rows
    })

  } catch (error: any) {
    console.error('[Migration Check] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
