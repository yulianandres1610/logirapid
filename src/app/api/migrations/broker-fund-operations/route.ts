import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

/**
 * POST /api/migrations/broker-fund-operations
 * Creates database functions for broker fund reservation and delivery completion
 */
export async function POST() {
  try {
    console.log('[Migration] Starting broker fund operations migration...')

    // 1. Create broker_reservations table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS broker_reservations (
        id SERIAL PRIMARY KEY,
        broker_company_id INTEGER NOT NULL REFERENCES companies(id),
        remittance_order_id INTEGER NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        amount DECIMAL(15,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'reserved',
        reserved_at TIMESTAMP DEFAULT NOW(),
        released_at TIMESTAMP,
        released_by INTEGER,
        release_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(remittance_order_id)
      )
    `)
    console.log('[Migration] Created broker_reservations table')

    // 2. Create broker_wallet_transactions table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS broker_wallet_transactions (
        id SERIAL PRIMARY KEY,
        broker_company_id INTEGER NOT NULL REFERENCES companies(id),
        currency VARCHAR(10) NOT NULL DEFAULT 'USD',
        transaction_type VARCHAR(50) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        balance_before DECIMAL(15,2),
        balance_after DECIMAL(15,2),
        reserved_before DECIMAL(15,2),
        reserved_after DECIMAL(15,2),
        reference_type VARCHAR(50),
        reference_id INTEGER,
        created_by INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    console.log('[Migration] Created broker_wallet_transactions table')

    // 3. Add rejection columns to remittance_orders if not exist
    const rejectionColumns = [
      { name: 'rejection_reason', type: 'VARCHAR(100)' },
      { name: 'rejection_notes', type: 'TEXT' },
      { name: 'rejected_at', type: 'TIMESTAMP' },
      { name: 'rejected_by_user_id', type: 'INTEGER' }
    ]

    for (const col of rejectionColumns) {
      try {
        await db.query(`
          ALTER TABLE remittance_orders
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `)
      } catch (e: any) {
        if (!e.message.includes('already exists')) {
          console.log(`[Migration] Note: ${col.name} - ${e.message}`)
        }
      }
    }
    console.log('[Migration] Added rejection columns to remittance_orders')

    // 4. Drop existing functions to avoid parameter name conflicts
    // Use DO block to dynamically drop all versions of these functions
    await db.query(`
      DO $$
      DECLARE
        func_rec RECORD;
      BEGIN
        FOR func_rec IN
          SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
          AND p.proname IN ('reserve_broker_funds', 'complete_broker_delivery', 'release_broker_funds_cancelled', 'release_broker_funds_delivered')
        LOOP
          EXECUTE format('DROP FUNCTION IF EXISTS %I(%s) CASCADE', func_rec.proname, func_rec.args);
        END LOOP;
      END $$
    `)
    console.log('[Migration] Dropped existing functions')

    // 5. Create reserve_broker_funds function
    await db.query(`
      CREATE OR REPLACE FUNCTION reserve_broker_funds(
        p_broker_id INTEGER,
        p_currency VARCHAR(10),
        p_amount DECIMAL(15,2),
        p_order_id INTEGER,
        p_user_id INTEGER
      ) RETURNS BOOLEAN AS $$
      DECLARE
        v_available DECIMAL(15,2);
        v_balance_before DECIMAL(15,2);
        v_reserved_before DECIMAL(15,2);
      BEGIN
        -- Lock row for update
        SELECT available_balance, reserved_balance
        INTO v_available, v_reserved_before
        FROM broker_wallet_balances
        WHERE company_id = p_broker_id AND currency = p_currency
        FOR UPDATE;

        -- If no balance record exists, create one
        IF v_available IS NULL THEN
          INSERT INTO broker_wallet_balances (company_id, currency, available_balance, reserved_balance)
          VALUES (p_broker_id, p_currency, 0, 0);
          v_available := 0;
          v_reserved_before := 0;
        END IF;

        -- Check if enough balance
        IF v_available < p_amount THEN
          RETURN FALSE;
        END IF;

        v_balance_before := v_available;

        -- Update balances
        UPDATE broker_wallet_balances
        SET available_balance = available_balance - p_amount,
            reserved_balance = reserved_balance + p_amount,
            updated_at = NOW()
        WHERE company_id = p_broker_id AND currency = p_currency;

        -- Create reservation record
        INSERT INTO broker_reservations (
          broker_company_id, remittance_order_id, currency, amount, status, reserved_at
        ) VALUES (p_broker_id, p_order_id, p_currency, p_amount, 'reserved', NOW())
        ON CONFLICT (remittance_order_id) DO UPDATE
        SET amount = EXCLUDED.amount, status = 'reserved', reserved_at = NOW();

        -- Log to broker_wallet_transactions
        INSERT INTO broker_wallet_transactions (
          broker_company_id, currency, transaction_type, amount,
          balance_before, balance_after, reserved_before, reserved_after,
          reference_type, reference_id, created_by, notes
        ) VALUES (
          p_broker_id, p_currency, 'reservation', p_amount,
          v_balance_before, v_balance_before - p_amount,
          v_reserved_before, v_reserved_before + p_amount,
          'remittance_order', p_order_id, p_user_id,
          'Reserva para orden de remesa #' || p_order_id
        );

        -- Also log to main wallet_transactions
        INSERT INTO wallet_transactions (
          type, source_type, source_company_id, amount, currency,
          status, description, created_by
        ) VALUES (
          'reserve', 'company', p_broker_id, p_amount, p_currency,
          'completed', 'Reserva para orden de remesa #' || p_order_id, p_user_id
        );

        RETURN TRUE;
      END;
      $$ LANGUAGE plpgsql
    `)
    console.log('[Migration] Created reserve_broker_funds function')

    // 5. Create complete_broker_delivery function
    await db.query(`
      CREATE OR REPLACE FUNCTION complete_broker_delivery(
        p_order_id INTEGER,
        p_user_id INTEGER
      ) RETURNS BOOLEAN AS $$
      DECLARE
        v_reservation RECORD;
        v_reserved_before DECIMAL(15,2);
        v_available_before DECIMAL(15,2);
      BEGIN
        -- Get reservation
        SELECT * INTO v_reservation
        FROM broker_reservations
        WHERE remittance_order_id = p_order_id AND status = 'reserved'
        FOR UPDATE;

        IF v_reservation IS NULL THEN
          RETURN FALSE;
        END IF;

        -- Get current balances
        SELECT available_balance, reserved_balance
        INTO v_available_before, v_reserved_before
        FROM broker_wallet_balances
        WHERE company_id = v_reservation.broker_company_id
          AND currency = v_reservation.currency;

        -- Reduce reserved balance (money was delivered to recipient)
        UPDATE broker_wallet_balances
        SET reserved_balance = reserved_balance - v_reservation.amount,
            updated_at = NOW()
        WHERE company_id = v_reservation.broker_company_id
          AND currency = v_reservation.currency;

        -- Update reservation status
        UPDATE broker_reservations
        SET status = 'completed', released_at = NOW(), released_by = p_user_id
        WHERE id = v_reservation.id;

        -- Log to broker_wallet_transactions
        INSERT INTO broker_wallet_transactions (
          broker_company_id, currency, transaction_type, amount,
          balance_before, balance_after, reserved_before, reserved_after,
          reference_type, reference_id, created_by, notes
        ) VALUES (
          v_reservation.broker_company_id, v_reservation.currency, 'delivery', v_reservation.amount,
          v_available_before, v_available_before,
          v_reserved_before, v_reserved_before - v_reservation.amount,
          'remittance_order', p_order_id, p_user_id,
          'Entrega completada - Orden #' || p_order_id
        );

        -- Log to main wallet_transactions
        INSERT INTO wallet_transactions (
          type, source_type, source_company_id, amount, currency,
          status, description, created_by
        ) VALUES (
          'debit', 'company', v_reservation.broker_company_id, v_reservation.amount, v_reservation.currency,
          'completed', 'Entrega remesa orden #' || p_order_id, p_user_id
        );

        RETURN TRUE;
      END;
      $$ LANGUAGE plpgsql
    `)
    console.log('[Migration] Created complete_broker_delivery function')

    // 6. Create release_broker_funds_cancelled function
    await db.query(`
      CREATE OR REPLACE FUNCTION release_broker_funds_cancelled(
        p_order_id INTEGER,
        p_user_id INTEGER,
        p_reason TEXT DEFAULT NULL
      ) RETURNS BOOLEAN AS $$
      DECLARE
        v_reservation RECORD;
        v_available_before DECIMAL(15,2);
        v_reserved_before DECIMAL(15,2);
      BEGIN
        -- Get reservation
        SELECT * INTO v_reservation
        FROM broker_reservations
        WHERE remittance_order_id = p_order_id AND status = 'reserved'
        FOR UPDATE;

        IF v_reservation IS NULL THEN
          RETURN FALSE;
        END IF;

        -- Get current balances
        SELECT available_balance, reserved_balance
        INTO v_available_before, v_reserved_before
        FROM broker_wallet_balances
        WHERE company_id = v_reservation.broker_company_id
          AND currency = v_reservation.currency;

        -- Return funds to available balance
        UPDATE broker_wallet_balances
        SET available_balance = available_balance + v_reservation.amount,
            reserved_balance = reserved_balance - v_reservation.amount,
            updated_at = NOW()
        WHERE company_id = v_reservation.broker_company_id
          AND currency = v_reservation.currency;

        -- Update reservation status
        UPDATE broker_reservations
        SET status = 'cancelled',
            released_at = NOW(),
            released_by = p_user_id,
            release_reason = p_reason
        WHERE id = v_reservation.id;

        -- Log to broker_wallet_transactions
        INSERT INTO broker_wallet_transactions (
          broker_company_id, currency, transaction_type, amount,
          balance_before, balance_after, reserved_before, reserved_after,
          reference_type, reference_id, created_by, notes
        ) VALUES (
          v_reservation.broker_company_id, v_reservation.currency, 'refund', v_reservation.amount,
          v_available_before, v_available_before + v_reservation.amount,
          v_reserved_before, v_reserved_before - v_reservation.amount,
          'remittance_order', p_order_id, p_user_id,
          COALESCE('Cancelación: ' || p_reason, 'Orden cancelada #' || p_order_id)
        );

        -- Log to main wallet_transactions
        INSERT INTO wallet_transactions (
          type, source_type, source_company_id, amount, currency,
          status, description, created_by
        ) VALUES (
          'refund', 'company', v_reservation.broker_company_id, v_reservation.amount, v_reservation.currency,
          'completed', 'Liberación fondos - Orden cancelada #' || p_order_id, p_user_id
        );

        RETURN TRUE;
      END;
      $$ LANGUAGE plpgsql
    `)
    console.log('[Migration] Created release_broker_funds_cancelled function')

    // 6b. Create release_broker_funds_delivered function (alias for complete_broker_delivery)
    await db.query(`
      CREATE OR REPLACE FUNCTION release_broker_funds_delivered(
        p_order_id INTEGER,
        p_user_id INTEGER
      ) RETURNS BOOLEAN AS $$
      BEGIN
        -- Just call complete_broker_delivery
        RETURN complete_broker_delivery(p_order_id, p_user_id);
      END;
      $$ LANGUAGE plpgsql
    `)
    console.log('[Migration] Created release_broker_funds_delivered function')

    // 7. Create remittance_delivery_proofs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS remittance_delivery_proofs (
        id SERIAL PRIMARY KEY,
        remittance_order_id INTEGER NOT NULL REFERENCES remittance_orders(id),
        order_number VARCHAR(50) NOT NULL,

        -- Denominaciones entregadas
        bill_denominations JSONB NOT NULL DEFAULT '{}',
        total_delivered DECIMAL(15,2) NOT NULL,
        delivery_currency VARCHAR(10) NOT NULL,

        -- Firma del cliente
        signature_data TEXT,
        signature_storage_path VARCHAR(500),
        signer_name VARCHAR(255) NOT NULL,
        signer_id_number VARCHAR(50),
        signer_relation VARCHAR(50) DEFAULT 'recipient',

        -- Fotos
        photos JSONB DEFAULT '[]',

        -- Ubicación
        delivery_latitude DECIMAL(10,8),
        delivery_longitude DECIMAL(11,8),

        -- Metadata
        delivery_notes TEXT,
        delivered_by_user_id INTEGER,
        delivered_by_name VARCHAR(255),
        delivered_at TIMESTAMP DEFAULT NOW(),

        -- Recibo
        receipt_sent_via VARCHAR(20),
        receipt_sent_at TIMESTAMP,
        receipt_pdf_path VARCHAR(500),

        company_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(remittance_order_id)
      )
    `)
    console.log('[Migration] Created remittance_delivery_proofs table')

    // 8. Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_broker_reservations_order
      ON broker_reservations(remittance_order_id);

      CREATE INDEX IF NOT EXISTS idx_broker_reservations_broker
      ON broker_reservations(broker_company_id, status);

      CREATE INDEX IF NOT EXISTS idx_broker_wallet_transactions_broker
      ON broker_wallet_transactions(broker_company_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_remittance_delivery_proofs_order
      ON remittance_delivery_proofs(remittance_order_id);
    `)
    console.log('[Migration] Created indexes')

    return NextResponse.json({
      success: true,
      message: 'Broker fund operations migration completed',
      tables: ['broker_reservations', 'broker_wallet_transactions', 'remittance_delivery_proofs'],
      functions: ['reserve_broker_funds', 'complete_broker_delivery', 'release_broker_funds_cancelled', 'release_broker_funds_delivered']
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
    const tables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('broker_reservations', 'broker_wallet_transactions', 'remittance_delivery_proofs')
    `)

    const functions = await db.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('reserve_broker_funds', 'complete_broker_delivery', 'release_broker_funds_cancelled', 'release_broker_funds_delivered')
    `)

    return NextResponse.json({
      success: true,
      tables: tables.rows.map(r => r.table_name),
      functions: functions.rows.map(r => r.routine_name),
      needsMigration: tables.rows.length < 3 || functions.rows.length < 4
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
