import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    // Delete invoice 18 and its lines
    await db.query('DELETE FROM market_invoice_payments WHERE invoice_id = 18')
    await db.query('DELETE FROM market_invoice_delivery_lines WHERE delivery_id IN (SELECT id FROM market_invoice_deliveries WHERE invoice_id = 18)')
    await db.query('DELETE FROM market_invoice_deliveries WHERE invoice_id = 18')
    await db.query('DELETE FROM market_invoice_lines WHERE invoice_id = 18')
    await db.query('DELETE FROM market_invoices WHERE id = 18')

    // Reset quote 15 so it can be converted again
    await db.query(`
      UPDATE market_quotes SET
        status = 'accepted',
        converted_to_invoice_id = NULL,
        updated_at = NOW()
      WHERE id = 15
    `)

    return NextResponse.json({ success: true, message: 'Factura 18 eliminada, cotización 15 reseteada a accepted' })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
