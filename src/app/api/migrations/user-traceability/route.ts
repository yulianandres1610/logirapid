import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * User Traceability & Payment Distribution Migration
 *
 * This migration adds:
 * - order_activity_log: Audit trail of all user actions on orders
 * - order_participants: Key users who touched each order (creator, completer, packer)
 * - payment_distribution: Record of payment breakdown for each completed order
 * - Modifications to existing tables for provider tracking and multi-activity commissions
 */

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Starting user traceability migration...')

    // ========================================
    // STEP 1: Create order_activity_log table
    // ========================================
    console.log('📋 Creating order_activity_log table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS order_activity_log (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES package_orders(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id),

          -- Actor
          user_id INTEGER NOT NULL REFERENCES users(id),
          user_role VARCHAR(50) NOT NULL,
          user_name VARCHAR(255),

          -- Action
          activity_type VARCHAR(50) NOT NULL,
          -- Values: 'created', 'picked_up', 'packed', 'delivered', 'cancelled', 'payment_received'

          previous_status VARCHAR(50),
          new_status VARCHAR(50),

          -- Context
          route_id INTEGER REFERENCES routes(id),
          stop_number INTEGER,
          metadata JSONB DEFAULT '{}',

          -- Geolocation
          latitude DECIMAL(10,8),
          longitude DECIMAL(11,8),

          source VARCHAR(30) DEFAULT 'web',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)
      console.log('✅ order_activity_log table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️ order_activity_log table already exists')
      } else {
        throw error
      }
    }

    // Create indexes for order_activity_log
    console.log('📋 Creating indexes for order_activity_log...')
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_activity_order ON order_activity_log(order_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_activity_user ON order_activity_log(user_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_activity_type ON order_activity_log(activity_type)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_activity_company ON order_activity_log(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_activity_created_at ON order_activity_log(created_at)`)
      console.log('✅ Indexes created for order_activity_log')
    } catch (error: any) {
      console.log('ℹ️ Index creation note:', error.message)
    }

    // ========================================
    // STEP 2: Create order_participants table
    // ========================================
    console.log('📋 Creating order_participants table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS order_participants (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL UNIQUE REFERENCES package_orders(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id),

          -- Creator of the order
          created_by_user_id INTEGER REFERENCES users(id),
          created_by_role VARCHAR(50),
          created_at TIMESTAMP,

          -- Delivery completer
          completed_by_user_id INTEGER REFERENCES users(id),
          completed_by_role VARCHAR(50),
          completed_at TIMESTAMP,

          -- Extensible roles (future)
          packed_by_user_id INTEGER REFERENCES users(id),
          packed_by_role VARCHAR(50),
          packed_at TIMESTAMP,

          additional_participants JSONB DEFAULT '[]',
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)
      console.log('✅ order_participants table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️ order_participants table already exists')
      } else {
        throw error
      }
    }

    // Create indexes for order_participants
    console.log('📋 Creating indexes for order_participants...')
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_participants_created_by ON order_participants(created_by_user_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_participants_completed_by ON order_participants(completed_by_user_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_participants_company ON order_participants(company_id)`)
      console.log('✅ Indexes created for order_participants')
    } catch (error: any) {
      console.log('ℹ️ Index creation note:', error.message)
    }

    // ========================================
    // STEP 3: Create payment_distribution table
    // ========================================
    console.log('📋 Creating payment_distribution table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS payment_distribution (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES package_orders(id),
          company_id INTEGER NOT NULL REFERENCES companies(id),
          billing_log_id INTEGER REFERENCES service_billing_log(id),

          -- Total amounts
          gross_amount DECIMAL(15,2) NOT NULL,
          provider_cost DECIMAL(15,2) DEFAULT 0,
          platform_fee DECIMAL(15,2) DEFAULT 0,
          company_profit DECIMAL(15,2) DEFAULT 0,
          total_commissions DECIMAL(15,2) DEFAULT 0,

          status VARCHAR(20) DEFAULT 'pending',
          -- Values: 'pending', 'processed', 'failed', 'partial'

          -- Details
          products JSONB NOT NULL,
          commission_breakdown JSONB DEFAULT '[]',
          -- [{userId, userRole, activityType, amount, productId, transactionId}]

          provider_payments JSONB DEFAULT '[]',
          -- [{providerCompanyId, providerName, amount, transactionId}]

          processed_at TIMESTAMP,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)
      console.log('✅ payment_distribution table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️ payment_distribution table already exists')
      } else {
        throw error
      }
    }

    // Create indexes for payment_distribution
    console.log('📋 Creating indexes for payment_distribution...')
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_distribution_order ON payment_distribution(order_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_distribution_status ON payment_distribution(status)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_distribution_company ON payment_distribution(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_distribution_created ON payment_distribution(created_at)`)
      console.log('✅ Indexes created for payment_distribution')
    } catch (error: any) {
      console.log('ℹ️ Index creation note:', error.message)
    }

    // ========================================
    // STEP 4: Add provider_company_id to product_catalog
    // ========================================
    console.log('📋 Adding provider_company_id to product_catalog...')
    try {
      await db.query(`
        ALTER TABLE product_catalog
        ADD COLUMN IF NOT EXISTS provider_company_id INTEGER REFERENCES companies(id)
      `)
      console.log('✅ Added provider_company_id column to product_catalog')
    } catch (error: any) {
      console.log('ℹ️ provider_company_id column note:', error.message)
    }

    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_product_provider ON product_catalog(provider_company_id)`)
      console.log('✅ Index created for product_catalog.provider_company_id')
    } catch (error: any) {
      console.log('ℹ️ Index note:', error.message)
    }

    // ========================================
    // STEP 5: Add activity_type to company_commission_config
    // ========================================
    console.log('📋 Adding activity_type to company_commission_config...')
    try {
      await db.query(`
        ALTER TABLE company_commission_config
        ADD COLUMN IF NOT EXISTS activity_type VARCHAR(50) DEFAULT 'delivery'
      `)
      console.log('✅ Added activity_type column to company_commission_config')
    } catch (error: any) {
      console.log('ℹ️ activity_type column note:', error.message)
    }

    // Update unique constraint to include activity_type
    console.log('📋 Updating unique constraint on company_commission_config...')
    try {
      // First try to drop old constraint if exists
      await db.query(`
        ALTER TABLE company_commission_config
        DROP CONSTRAINT IF EXISTS company_commission_config_company_id_product_id_role_key
      `)
    } catch (error: any) {
      console.log('ℹ️ Old constraint note:', error.message)
    }

    try {
      await db.query(`
        ALTER TABLE company_commission_config
        DROP CONSTRAINT IF EXISTS unique_commission_config
      `)
    } catch (error: any) {
      console.log('ℹ️ Constraint note:', error.message)
    }

    try {
      await db.query(`
        ALTER TABLE company_commission_config
        ADD CONSTRAINT unique_commission_config
        UNIQUE (company_id, product_id, role, activity_type)
      `)
      console.log('✅ Unique constraint updated on company_commission_config')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️ Unique constraint already exists')
      } else {
        console.log('ℹ️ Constraint note:', error.message)
      }
    }

    // ========================================
    // STEP 6: Add user tracking columns to package_orders
    // ========================================
    console.log('📋 Adding user tracking columns to package_orders...')
    try {
      await db.query(`
        ALTER TABLE package_orders
        ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id)
      `)
      console.log('✅ Added created_by_user_id column to package_orders')
    } catch (error: any) {
      console.log('ℹ️ created_by_user_id column note:', error.message)
    }

    try {
      await db.query(`
        ALTER TABLE package_orders
        ADD COLUMN IF NOT EXISTS completed_by_user_id INTEGER REFERENCES users(id)
      `)
      console.log('✅ Added completed_by_user_id column to package_orders')
    } catch (error: any) {
      console.log('ℹ️ completed_by_user_id column note:', error.message)
    }

    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_created_by_user ON package_orders(created_by_user_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_completed_by_user ON package_orders(completed_by_user_id)`)
      console.log('✅ Indexes created for package_orders user tracking')
    } catch (error: any) {
      console.log('ℹ️ Index note:', error.message)
    }

    // ========================================
    // STEP 7: Add platform_fee_percentage to companies
    // ========================================
    console.log('📋 Adding platform_fee_percentage to companies...')
    try {
      await db.query(`
        ALTER TABLE companies
        ADD COLUMN IF NOT EXISTS platform_fee_percentage DECIMAL(5,2) DEFAULT 10.00
      `)
      console.log('✅ Added platform_fee_percentage column to companies')
    } catch (error: any) {
      console.log('ℹ️ platform_fee_percentage column note:', error.message)
    }

    // ========================================
    // STEP 8: Migrate existing data (map createdBy to user_id)
    // ========================================
    console.log('📋 Attempting to migrate existing createdBy data...')
    try {
      // Try to map existing createdBy (text email) to user_id
      const migrated = await db.query(`
        UPDATE package_orders po
        SET created_by_user_id = u.id
        FROM users u
        WHERE po.createdby = u.email
          AND po.created_by_user_id IS NULL
          AND po.createdby IS NOT NULL
      `)
      console.log(`✅ Migrated ${migrated.rowCount || 0} existing orders with createdBy mapping`)
    } catch (error: any) {
      console.log('ℹ️ Data migration note:', error.message)
    }

    // Create order_participants for existing orders that have created_by_user_id
    console.log('📋 Creating order_participants for existing orders...')
    try {
      const existingOrders = await db.query(`
        SELECT po.id, po.company_id, po.created_by_user_id, u.role, po.createdat
        FROM package_orders po
        LEFT JOIN users u ON po.created_by_user_id = u.id
        WHERE po.created_by_user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM order_participants op WHERE op.order_id = po.id
          )
      `)

      let participantsCreated = 0
      for (const order of existingOrders.rows) {
        try {
          await db.query(`
            INSERT INTO order_participants (
              order_id, company_id, created_by_user_id, created_by_role, created_at
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (order_id) DO NOTHING
          `, [order.id, order.company_id, order.created_by_user_id, order.role || 'USER', order.createdat])
          participantsCreated++
        } catch (err) {
          // Ignore individual insert errors
        }
      }
      console.log(`✅ Created ${participantsCreated} order_participants for existing orders`)
    } catch (error: any) {
      console.log('ℹ️ Participants creation note:', error.message)
    }

    // ========================================
    // STEP 9: Verify migration status
    // ========================================
    console.log('📋 Verifying migration status...')

    const activityLogCount = await db.query(`SELECT COUNT(*) as count FROM order_activity_log`)
    const participantsCount = await db.query(`SELECT COUNT(*) as count FROM order_participants`)
    const distributionCount = await db.query(`SELECT COUNT(*) as count FROM payment_distribution`)

    // Check if columns exist
    const productCatalogCols = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'product_catalog'
      AND column_name = 'provider_company_id'
    `)

    const commissionConfigCols = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'company_commission_config'
      AND column_name = 'activity_type'
    `)

    const packageOrderCols = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'package_orders'
      AND column_name IN ('created_by_user_id', 'completed_by_user_id')
    `)

    const companiesCols = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'companies'
      AND column_name = 'platform_fee_percentage'
    `)

    // Check orders with user tracking
    const ordersWithCreator = await db.query(`
      SELECT COUNT(*) as count FROM package_orders WHERE created_by_user_id IS NOT NULL
    `)

    console.log('🎉 Migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'User traceability migration completed',
      data: {
        tablesCreated: [
          'order_activity_log',
          'order_participants',
          'payment_distribution'
        ],
        columnsAdded: {
          product_catalog: productCatalogCols.rows.length > 0 ? ['provider_company_id'] : [],
          company_commission_config: commissionConfigCols.rows.length > 0 ? ['activity_type'] : [],
          package_orders: packageOrderCols.rows.map((r: any) => r.column_name),
          companies: companiesCols.rows.length > 0 ? ['platform_fee_percentage'] : []
        },
        currentState: {
          activityLogs: parseInt(activityLogCount.rows[0]?.count || '0'),
          orderParticipants: parseInt(participantsCount.rows[0]?.count || '0'),
          paymentDistributions: parseInt(distributionCount.rows[0]?.count || '0'),
          ordersWithCreator: parseInt(ordersWithCreator.rows[0]?.count || '0')
        }
      }
    })

  } catch (error) {
    console.error('❌ Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}
