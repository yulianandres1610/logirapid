import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-invoice-0011
 * Full reset: invoice, deliveries, operations - ready to re-confirm and complete from warehouse
 */
export async function GET() {
  try {
    const inv = await db.query("SELECT id FROM market_invoices WHERE invoice_number = 'FAC-2026-0011'")
    if (inv.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'FAC-2026-0011 no encontrada' })
    }
    const invoiceId = inv.rows[0].id

    // 1. Reset invoice to draft (before confirm)
    await db.query(`
      UPDATE market_invoices SET status = 'draft', confirmed_at = NULL, delivered_at = NULL, updated_at = NOW()
      WHERE id = $1
    `, [invoiceId])

    // 2. Reset quantity_delivered
    await db.query('UPDATE market_invoice_lines SET quantity_delivered = 0 WHERE invoice_id = $1', [invoiceId])

    // 3. Get deliveries + operations to clean up
    const deliveries = await db.query('SELECT id, operation_id FROM market_invoice_deliveries WHERE invoice_id = $1', [invoiceId])

    for (const d of deliveries.rows) {
      // Delete delivery lines
      await db.query('DELETE FROM market_invoice_delivery_lines WHERE delivery_id = $1', [d.id])

      // Delete operation lines + operation
      if (d.operation_id) {
        await db.query('DELETE FROM market_warehouse_operation_lines WHERE operation_id = $1', [d.operation_id])
        await db.query('DELETE FROM market_warehouse_operations WHERE id = $1', [d.operation_id])
      }
    }

    // Delete deliveries
    await db.query('DELETE FROM market_invoice_deliveries WHERE invoice_id = $1', [invoiceId])

    return NextResponse.json({
      success: true,
      message: `FAC-2026-0011 reseteada a DRAFT. Entregas y operaciones eliminadas. Flujo: 1) Confirmar factura (crea operación pendiente) → 2) Ir a almacén → Entrega Mayorista → Completar (rebaja stock + consignación)`
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
