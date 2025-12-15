import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/migrations/remittance-orders-setup
 * Creates the remittance_orders table and generate_remittance_order_number function
 */
export async function POST() {
  try {
    console.log('[Migration] Setting up remittance_orders table and functions...')

    // 1. Create remittance_orders table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS remittance_orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50) UNIQUE NOT NULL,

        -- Company info
        selling_company_id INTEGER NOT NULL,
        sold_by_user_id INTEGER NOT NULL,
        broker_company_id INTEGER,

        -- Location
        broker_province VARCHAR(100),
        broker_municipality VARCHAR(100),

        -- Product/Service
        product_id INTEGER,
        product_name VARCHAR(255),
        service_type VARCHAR(100),

        -- Amounts
        send_amount DECIMAL(15,2) NOT NULL,
        send_currency VARCHAR(10) DEFAULT 'USD',
        receive_amount DECIMAL(15,2),
        receive_currency VARCHAR(10) DEFAULT 'USD',
        exchange_rate DECIMAL(15,4) DEFAULT 1,
        service_fee DECIMAL(15,2) DEFAULT 0,
        service_fee_percentage DECIMAL(5,2) DEFAULT 0,
        delivery_fee DECIMAL(15,2) DEFAULT 0,
        total_charged DECIMAL(15,2) NOT NULL,

        -- Recipient info
        recipient_name VARCHAR(255) NOT NULL,
        recipient_phone VARCHAR(50) NOT NULL,
        recipient_id_number VARCHAR(50),
        recipient_address TEXT,
        recipient_neighborhood VARCHAR(255),
        recipient_province VARCHAR(100),
        recipient_municipality VARCHAR(100),
        recipient_address_references TEXT,

        -- Alternate contact
        has_alternate_contact BOOLEAN DEFAULT false,
        alternate_contact_name VARCHAR(255),
        alternate_contact_phone VARCHAR(50),

        -- Sender info
        sender_name VARCHAR(255) NOT NULL,
        sender_phone VARCHAR(50),
        sender_email VARCHAR(255),
        sender_id_type VARCHAR(50),
        sender_id_number VARCHAR(50),

        -- Status
        status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'pending',
        estimated_delivery VARCHAR(100),

        -- Payment
        payment_method VARCHAR(50),
        payment_reference VARCHAR(255),
        cash_received DECIMAL(15,2),
        cash_change DECIMAL(15,2),

        -- Delivery proof
        delivery_proof_id INTEGER,
        delivered_by_user_id INTEGER,
        delivered_at TIMESTAMP,
        delivery_proof_photo TEXT,
        delivery_signature TEXT,
        delivery_notes TEXT,

        -- Rejection
        rejection_reason VARCHAR(100),
        rejection_notes TEXT,
        rejected_at TIMESTAMP,
        rejected_by_user_id INTEGER,

        -- Cancellation
        cancelled_at TIMESTAMP,
        cancelled_by_user_id INTEGER,
        cancellation_reason TEXT,

        -- Status timestamps
        confirmed_at TIMESTAMP,
        in_delivery_at TIMESTAMP,

        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created remittance_orders table')

    // 2. Create sequence for order numbers if not exists
    await db.query(`
      CREATE SEQUENCE IF NOT EXISTS remittance_order_seq START WITH 1
    `)
    console.log('[Migration] Created remittance_order_seq sequence')

    // 3. Drop existing function if exists (to recreate with correct definition)
    await db.query(`
      DROP FUNCTION IF EXISTS generate_remittance_order_number()
    `)

    // 4. Create the generate_remittance_order_number function
    await db.query(`
      CREATE OR REPLACE FUNCTION generate_remittance_order_number()
      RETURNS VARCHAR(50) AS $$
      DECLARE
        v_seq INTEGER;
        v_year VARCHAR(4);
        v_order_number VARCHAR(50);
      BEGIN
        -- Get next sequence value
        SELECT nextval('remittance_order_seq') INTO v_seq;

        -- Get current year
        v_year := TO_CHAR(NOW(), 'YYYY');

        -- Format: REM-YYYY-NNNNNN (e.g., REM-2025-000001)
        v_order_number := 'REM-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');

        RETURN v_order_number;
      END;
      $$ LANGUAGE plpgsql
    `)
    console.log('[Migration] Created generate_remittance_order_number function')

    // 5. Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_remittance_orders_company ON remittance_orders(selling_company_id);
      CREATE INDEX IF NOT EXISTS idx_remittance_orders_broker ON remittance_orders(broker_company_id);
      CREATE INDEX IF NOT EXISTS idx_remittance_orders_status ON remittance_orders(status);
      CREATE INDEX IF NOT EXISTS idx_remittance_orders_created ON remittance_orders(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_remittance_orders_order_number ON remittance_orders(order_number);
    `)
    console.log('[Migration] Created indexes')

    // 6. Test the function
    const testResult = await db.query('SELECT generate_remittance_order_number() as test_order_number')
    const testOrderNumber = testResult.rows[0].test_order_number

    return NextResponse.json({
      success: true,
      message: 'Remittance orders setup completed',
      testOrderNumber,
      tables: ['remittance_orders'],
      functions: ['generate_remittance_order_number'],
      indexes: [
        'idx_remittance_orders_company',
        'idx_remittance_orders_broker',
        'idx_remittance_orders_status',
        'idx_remittance_orders_created',
        'idx_remittance_orders_order_number'
      ]
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
    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'remittance_orders'
      ) as table_exists
    `)

    // Check if function exists
    const functionCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'generate_remittance_order_number'
      ) as function_exists
    `)

    // Check sequence
    const sequenceCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM pg_sequences
        WHERE schemaname = 'public'
        AND sequencename = 'remittance_order_seq'
      ) as sequence_exists
    `)

    const tableExists = tableCheck.rows[0].table_exists
    const functionExists = functionCheck.rows[0].function_exists
    const sequenceExists = sequenceCheck.rows[0].sequence_exists

    // Count existing orders
    let orderCount = 0
    if (tableExists) {
      const countResult = await db.query('SELECT COUNT(*) as count FROM remittance_orders')
      orderCount = parseInt(countResult.rows[0].count)
    }

    return NextResponse.json({
      success: true,
      status: {
        tableExists,
        functionExists,
        sequenceExists,
        orderCount
      },
      needsMigration: !tableExists || !functionExists || !sequenceExists
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
