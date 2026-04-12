import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-invoice-0011
 * Reset invoice FAC-2026-0011 to confirmed status so delivery can be re-processed
 */
export async function GET() {
  try {
    // Find the invoice
    const inv = await db.query("SELECT id, invoice_number, status FROM market_invoices WHERE invoice_number = 'FAC-2026-0011'")
    if (inv.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Factura FAC-2026-0011 no encontrada' })
    }
    const invoiceId = inv.rows[0].id

    // Reset invoice to confirmed (not delivered)
    await db.query(`
      UPDATE market_invoices SET status = 'confirmed', delivered_at = NULL, updated_at = NOW()
      WHERE id = $1
    `, [invoiceId])

    // Reset quantity_delivered to 0 on all lines
    await db.query('UPDATE market_invoice_lines SET quantity_delivered = 0 WHERE invoice_id = $1', [invoiceId])

    // Delete existing deliveries and their lines
    const deliveries = await db.query('SELECT id FROM market_invoice_deliveries WHERE invoice_id = $1', [invoiceId])
    for (const d of deliveries.rows) {
      await db.query('DELETE FROM market_invoice_delivery_lines WHERE delivery_id = $1', [d.id])
    }
    await db.query('DELETE FROM market_invoice_deliveries WHERE invoice_id = $1', [invoiceId])

    return NextResponse.json({
      success: true,
      message: `Factura FAC-2026-0011 (id: ${invoiceId}) reseteada a estado confirmed. Entregas eliminadas. Puedes confirmar de nuevo para que se rebaje el stock.`
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
