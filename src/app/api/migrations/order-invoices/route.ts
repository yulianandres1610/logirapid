import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/order-invoices
 * Creates the order_invoices table for storing invoice/receipt files
 */
export async function GET() {
  try {
    console.log('[Migration] Creating order_invoices table...')

    // Create the order_invoices table
    await db.query(`
      CREATE TABLE IF NOT EXISTS order_invoices (
        id SERIAL PRIMARY KEY,

        -- Reference to order (one of the two)
        consignment_order_id INTEGER REFERENCES consignment_orders(id) ON DELETE CASCADE,
        purchase_id INTEGER REFERENCES market_purchases(id) ON DELETE CASCADE,

        -- File information
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        storage_path VARCHAR(500) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size BIGINT NOT NULL,

        -- Metadata
        company_id INTEGER NOT NULL REFERENCES companies(id),
        uploaded_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        -- Constraint: must have one of the two references
        CONSTRAINT order_invoice_reference CHECK (
          (consignment_order_id IS NOT NULL AND purchase_id IS NULL) OR
          (consignment_order_id IS NULL AND purchase_id IS NOT NULL)
        )
      )
    `)

    console.log('[Migration] Table created, adding indexes...')

    // Create indexes for faster lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_order_invoices_consignment
      ON order_invoices(consignment_order_id)
      WHERE consignment_order_id IS NOT NULL
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_order_invoices_purchase
      ON order_invoices(purchase_id)
      WHERE purchase_id IS NOT NULL
    `)

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_order_invoices_company
      ON order_invoices(company_id)
    `)

    console.log('[Migration] order_invoices migration completed successfully')

    return NextResponse.json({
      success: true,
      message: 'order_invoices table created successfully'
    })

  } catch (error) {
    console.error('[Migration] Error creating order_invoices table:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}
