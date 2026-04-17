import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_invoice_transports (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        transport_number VARCHAR(50),
        driver_name VARCHAR(255) NOT NULL,
        driver_lastname VARCHAR(255) NOT NULL,
        driver_id_card VARCHAR(20) NOT NULL,
        vehicle_brand VARCHAR(100),
        vehicle_plate VARCHAR(20) NOT NULL,
        amount DECIMAL(12,4) DEFAULT 0,
        currency VARCHAR(10) DEFAULT 'CUP',
        exchange_rate DECIMAL(12,4) DEFAULT 0,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    try { await db.query('CREATE INDEX IF NOT EXISTS idx_invoice_transports_invoice ON market_invoice_transports(invoice_id)') } catch {}

    return NextResponse.json({ success: true, message: 'market_invoice_transports table created' })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
