import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    // Find all invoices linked to quote 15
    const invoices = await db.query('SELECT id FROM market_invoices WHERE quote_id = 15')

    for (const inv of invoices.rows) {
      await db.query('DELETE FROM market_invoice_payments WHERE invoice_id = $1', [inv.id])
      await db.query('DELETE FROM market_invoice_delivery_lines WHERE delivery_id IN (SELECT id FROM market_invoice_deliveries WHERE invoice_id = $1)', [inv.id])
      await db.query('DELETE FROM market_invoice_deliveries WHERE invoice_id = $1', [inv.id])
      await db.query('DELETE FROM market_invoice_lines WHERE invoice_id = $1', [inv.id])
      await db.query('DELETE FROM market_invoices WHERE id = $1', [inv.id])
    }

    // Reset quote 15 so it can be converted again
    await db.query(`
      UPDATE market_quotes SET
        status = 'accepted',
        converted_to_invoice_id = NULL,
        updated_at = NOW()
      WHERE id = 15
    `)

    // Also fix invoice 19: reset quantity_delivered to 0 (was set prematurely on confirm)
    await db.query('UPDATE market_invoice_lines SET quantity_delivered = 0 WHERE invoice_id = 19')

    return NextResponse.json({
      success: true,
      message: `${invoices.rows.length} facturas eliminadas, cotización 15 reseteada, factura 19 quantity_delivered reseteado`
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
