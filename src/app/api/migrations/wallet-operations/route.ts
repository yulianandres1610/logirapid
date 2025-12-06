import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Wallet Operations Migration
 *
 * Creates two new tables for wallet operations:
 * - wallet_transactions: Track all wallet operations (recharges, transfers, debits)
 * - wallet_recharge_requests: Pending approval requests for cash/wire/zelle payments
 */

export async function GET(request: NextRequest) {
  try {
    console.log('Starting wallet operations migration...')

    // Create wallet_transactions table
    console.log('Creating wallet_transactions table...')
    await db.query(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id SERIAL PRIMARY KEY,

        -- Tipo de operacion
        type VARCHAR(30) NOT NULL,

        -- Origen (quien envia/paga)
        source_type VARCHAR(20),
        source_company_id INTEGER REFERENCES companies(id),
        source_user_id INTEGER REFERENCES users(id),
        source_wallet_number VARCHAR(20),

        -- Destino (quien recibe)
        target_type VARCHAR(20),
        target_company_id INTEGER REFERENCES companies(id),
        target_user_id INTEGER REFERENCES users(id),
        target_wallet_number VARCHAR(20),

        -- Montos
        amount DECIMAL(15,2) NOT NULL,
        fee DECIMAL(15,2) DEFAULT 0,
        net_amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',

        -- Metodo de pago (para recargas)
        payment_method VARCHAR(30),
        payment_reference VARCHAR(100),
        terminal_id INTEGER REFERENCES payment_terminals(id),

        -- Estado y aprobacion
        status VARCHAR(20) DEFAULT 'pending',
        requires_approval BOOLEAN DEFAULT false,
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        rejection_reason TEXT,

        -- Metadata
        description TEXT,
        notes TEXT,
        metadata JSONB,

        -- Auditoria
        created_by INTEGER REFERENCES users(id),
        created_by_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('wallet_transactions table created')

    // Create indexes for wallet_transactions
    console.log('Creating wallet_transactions indexes...')
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_wallet_tx_source_company ON wallet_transactions(source_company_id)',
      'CREATE INDEX IF NOT EXISTS idx_wallet_tx_target_company ON wallet_transactions(target_company_id)',
      'CREATE INDEX IF NOT EXISTS idx_wallet_tx_source_user ON wallet_transactions(source_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_wallet_tx_target_user ON wallet_transactions(target_user_id)',
      'CREATE INDEX IF NOT EXISTS idx_wallet_tx_status ON wallet_transactions(status)',
      'CREATE INDEX IF NOT EXISTS idx_wallet_tx_type ON wallet_transactions(type)',
      'CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_wallet_tx_source_wallet ON wallet_transactions(source_wallet_number)',
      'CREATE INDEX IF NOT EXISTS idx_wallet_tx_target_wallet ON wallet_transactions(target_wallet_number)'
    ]

    for (const idx of indexes) {
      try {
        await db.query(idx)
      } catch (e: any) {
        console.log(`Index note: ${e.message}`)
      }
    }
    console.log('wallet_transactions indexes created')

    // Create wallet_recharge_requests table
    console.log('Creating wallet_recharge_requests table...')
    await db.query(`
      CREATE TABLE IF NOT EXISTS wallet_recharge_requests (
        id SERIAL PRIMARY KEY,

        -- Quien solicita
        company_id INTEGER REFERENCES companies(id),
        user_id INTEGER REFERENCES users(id),
        wallet_number VARCHAR(20) NOT NULL,
        wallet_type VARCHAR(20) NOT NULL,

        -- Recarga
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'USD',
        payment_method VARCHAR(30) NOT NULL,
        payment_reference VARCHAR(100),
        payment_proof_url TEXT,

        -- Estado
        status VARCHAR(20) DEFAULT 'pending',
        processed_by INTEGER REFERENCES users(id),
        processed_by_name VARCHAR(100),
        processed_at TIMESTAMP,
        rejection_reason TEXT,

        -- Resultado
        transaction_id INTEGER REFERENCES wallet_transactions(id),

        -- Solicitante info
        requested_by INTEGER REFERENCES users(id),
        requested_by_name VARCHAR(100),
        requested_by_email VARCHAR(255),

        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('wallet_recharge_requests table created')

    // Create indexes for wallet_recharge_requests
    console.log('Creating wallet_recharge_requests indexes...')
    const requestIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_recharge_req_company ON wallet_recharge_requests(company_id)',
      'CREATE INDEX IF NOT EXISTS idx_recharge_req_user ON wallet_recharge_requests(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_recharge_req_status ON wallet_recharge_requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_recharge_req_created ON wallet_recharge_requests(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_recharge_req_wallet ON wallet_recharge_requests(wallet_number)'
    ]

    for (const idx of requestIndexes) {
      try {
        await db.query(idx)
      } catch (e: any) {
        console.log(`Index note: ${e.message}`)
      }
    }
    console.log('wallet_recharge_requests indexes created')

    // Check table counts
    const txCount = await db.query('SELECT COUNT(*) as count FROM wallet_transactions')
    const reqCount = await db.query('SELECT COUNT(*) as count FROM wallet_recharge_requests')

    return NextResponse.json({
      success: true,
      message: 'Wallet operations migration completed successfully',
      data: {
        tablesCreated: ['wallet_transactions', 'wallet_recharge_requests'],
        wallet_transactions_count: parseInt(txCount.rows[0]?.count || '0'),
        wallet_recharge_requests_count: parseInt(reqCount.rows[0]?.count || '0'),
        indexes: {
          wallet_transactions: 9,
          wallet_recharge_requests: 5
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
 * POST - Check if tables exist and their structure
 */
export async function POST(request: NextRequest) {
  try {
    // Check wallet_transactions columns
    const txColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'wallet_transactions'
      ORDER BY ordinal_position
    `)

    // Check wallet_recharge_requests columns
    const reqColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'wallet_recharge_requests'
      ORDER BY ordinal_position
    `)

    // Check indexes
    const indexes = await db.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE tablename IN ('wallet_transactions', 'wallet_recharge_requests')
    `)

    return NextResponse.json({
      success: true,
      data: {
        wallet_transactions: {
          exists: txColumns.rows.length > 0,
          columns: txColumns.rows.map(r => ({
            name: r.column_name,
            type: r.data_type,
            nullable: r.is_nullable === 'YES'
          }))
        },
        wallet_recharge_requests: {
          exists: reqColumns.rows.length > 0,
          columns: reqColumns.rows.map(r => ({
            name: r.column_name,
            type: r.data_type,
            nullable: r.is_nullable === 'YES'
          }))
        },
        indexes: indexes.rows.map(r => ({
          name: r.indexname,
          table: r.tablename
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
