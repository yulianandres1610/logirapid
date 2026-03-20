import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    // Fix deliveries that were incorrectly set to 'delivered' on creation
    const fixDeliveries = await db.query(`
      UPDATE market_invoice_deliveries
      SET status = 'pending', dispatched_at = NULL, delivered_at = NULL, dispatched_by = NULL, delivered_by = NULL
      WHERE status = 'delivered' AND dispatched_at = created_at
    `)

    // Fix invoices that were incorrectly set to 'delivered'
    const fixInvoices = await db.query(`
      UPDATE market_invoices
      SET status = 'confirmed', delivered_at = NULL
      WHERE status = 'delivered' AND confirmed_at IS NOT NULL
        AND id IN (SELECT invoice_id FROM market_invoice_deliveries WHERE status = 'pending')
    `)

    return NextResponse.json({
      success: true,
      data: {
        deliveriesFixed: fixDeliveries.rowCount,
        invoicesFixed: fixInvoices.rowCount
      }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
