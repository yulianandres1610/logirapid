import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/stripe-connect
 *
 * Runs the Stripe Connect migration to add:
 * - stripe_account_id and related fields to companies and users tables
 * - wallet_payouts table for tracking cashout requests
 */
export async function GET() {
  const results: string[] = []
  const errors: string[] = []

  try {
    // 1. Add Stripe Connect fields to companies table
    const companyFields = [
      {
        query: `ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`,
        name: 'companies.stripe_account_id'
      },
      {
        query: `ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_account_status VARCHAR(50) DEFAULT 'not_connected'`,
        name: 'companies.stripe_account_status'
      },
      {
        query: `ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT false`,
        name: 'companies.stripe_payouts_enabled'
      },
      {
        query: `ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT false`,
        name: 'companies.stripe_charges_enabled'
      },
      {
        query: `ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN DEFAULT false`,
        name: 'companies.stripe_details_submitted'
      },
      {
        query: `ALTER TABLE companies ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMP`,
        name: 'companies.stripe_connected_at'
      }
    ]

    for (const field of companyFields) {
      try {
        await db.query(field.query)
        results.push(`✓ Added ${field.name}`)
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          results.push(`○ ${field.name} already exists`)
        } else {
          errors.push(`✗ ${field.name}: ${err.message}`)
        }
      }
    }

    // 2. Add Stripe Connect fields to users table (for drivers)
    const userFields = [
      {
        query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255)`,
        name: 'users.stripe_account_id'
      },
      {
        query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_status VARCHAR(50) DEFAULT 'not_connected'`,
        name: 'users.stripe_account_status'
      },
      {
        query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT false`,
        name: 'users.stripe_payouts_enabled'
      },
      {
        query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT false`,
        name: 'users.stripe_charges_enabled'
      },
      {
        query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN DEFAULT false`,
        name: 'users.stripe_details_submitted'
      },
      {
        query: `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMP`,
        name: 'users.stripe_connected_at'
      }
    ]

    for (const field of userFields) {
      try {
        await db.query(field.query)
        results.push(`✓ Added ${field.name}`)
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          results.push(`○ ${field.name} already exists`)
        } else {
          errors.push(`✗ ${field.name}: ${err.message}`)
        }
      }
    }

    // 3. Create indexes for stripe_account_id
    const indexes = [
      {
        query: `CREATE INDEX IF NOT EXISTS idx_companies_stripe_account ON companies(stripe_account_id)`,
        name: 'idx_companies_stripe_account'
      },
      {
        query: `CREATE INDEX IF NOT EXISTS idx_users_stripe_account ON users(stripe_account_id)`,
        name: 'idx_users_stripe_account'
      }
    ]

    for (const index of indexes) {
      try {
        await db.query(index.query)
        results.push(`✓ Created index ${index.name}`)
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          results.push(`○ Index ${index.name} already exists`)
        } else {
          errors.push(`✗ Index ${index.name}: ${err.message}`)
        }
      }
    }

    // 4. Create wallet_payouts table
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS wallet_payouts (
          id SERIAL PRIMARY KEY,

          -- Entity making the withdrawal
          entity_type VARCHAR(20) NOT NULL,
          company_id INTEGER REFERENCES companies(id),
          user_id INTEGER REFERENCES users(id),
          wallet_number VARCHAR(20) NOT NULL,

          -- Amount
          amount DECIMAL(15,2) NOT NULL,
          fee DECIMAL(15,2) DEFAULT 0,
          net_amount DECIMAL(15,2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',

          -- Stripe
          stripe_account_id VARCHAR(255) NOT NULL,
          stripe_transfer_id VARCHAR(255),
          stripe_payout_id VARCHAR(255),

          -- Status
          status VARCHAR(30) DEFAULT 'pending',
          failure_code VARCHAR(100),
          failure_message TEXT,

          -- Bank destination (from Stripe)
          bank_name VARCHAR(100),
          bank_last4 VARCHAR(4),

          -- Audit
          requested_by INTEGER REFERENCES users(id),
          requested_by_name VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at TIMESTAMP,
          paid_at TIMESTAMP,

          -- Linked wallet transaction
          transaction_id INTEGER REFERENCES wallet_transactions(id),

          -- Constraints
          CONSTRAINT chk_entity_type CHECK (entity_type IN ('company', 'user')),
          CONSTRAINT chk_entity_id CHECK (
            (entity_type = 'company' AND company_id IS NOT NULL) OR
            (entity_type = 'user' AND user_id IS NOT NULL)
          )
        )
      `)
      results.push('✓ Created table wallet_payouts')
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        results.push('○ Table wallet_payouts already exists')
      } else {
        errors.push(`✗ Table wallet_payouts: ${err.message}`)
      }
    }

    // 5. Create indexes for wallet_payouts
    const payoutIndexes = [
      {
        query: `CREATE INDEX IF NOT EXISTS idx_payouts_company ON wallet_payouts(company_id)`,
        name: 'idx_payouts_company'
      },
      {
        query: `CREATE INDEX IF NOT EXISTS idx_payouts_user ON wallet_payouts(user_id)`,
        name: 'idx_payouts_user'
      },
      {
        query: `CREATE INDEX IF NOT EXISTS idx_payouts_status ON wallet_payouts(status)`,
        name: 'idx_payouts_status'
      },
      {
        query: `CREATE INDEX IF NOT EXISTS idx_payouts_stripe_transfer ON wallet_payouts(stripe_transfer_id)`,
        name: 'idx_payouts_stripe_transfer'
      },
      {
        query: `CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON wallet_payouts(created_at DESC)`,
        name: 'idx_payouts_created_at'
      }
    ]

    for (const index of payoutIndexes) {
      try {
        await db.query(index.query)
        results.push(`✓ Created index ${index.name}`)
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          results.push(`○ Index ${index.name} already exists`)
        } else {
          errors.push(`✗ Index ${index.name}: ${err.message}`)
        }
      }
    }

    // 6. Add 'cashout' to wallet_transactions type if not exists
    // First check current enum/check constraint
    try {
      // Try to add a check constraint that includes 'cashout'
      // This is a safe operation that will fail gracefully if type already supported
      await db.query(`
        ALTER TABLE wallet_transactions
        DROP CONSTRAINT IF EXISTS wallet_transactions_type_check
      `)

      await db.query(`
        ALTER TABLE wallet_transactions
        ADD CONSTRAINT wallet_transactions_type_check
        CHECK (type IN ('recharge', 'transfer_out', 'transfer_in', 'debit', 'refund', 'cashout', 'credit_charge'))
      `)
      results.push('✓ Updated wallet_transactions type constraint to include cashout')
    } catch (err: any) {
      // Constraint might not exist or type column might be VARCHAR without constraint
      results.push(`○ wallet_transactions type constraint update skipped: ${err.message}`)
    }

    const hasErrors = errors.length > 0

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors
        ? 'Migration completed with some errors'
        : 'Stripe Connect migration completed successfully',
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: results.length + errors.length,
        successful: results.filter(r => r.startsWith('✓')).length,
        existing: results.filter(r => r.startsWith('○')).length,
        failed: errors.length
      }
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during migration',
      results,
      errors
    }, { status: 500 })
  }
}
