import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/debug/check-delivery?invoiceId=8
 * Check delivery and operation status for an invoice
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId') || '8'

    // Get invoice
    const invoiceResult = await db.query(`
      SELECT id, invoice_number, status, delivered_at
      FROM market_invoices WHERE id = $1
    `, [invoiceId])

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })
    }

    const invoice = invoiceResult.rows[0]

    // Get deliveries
    const deliveriesResult = await db.query(`
      SELECT
        d.id, d.delivery_number, d.status, d.operation_id,
        d.created_at, d.dispatched_at, d.delivered_at,
        d.created_by, d.dispatched_by, d.delivered_by
      FROM market_invoice_deliveries d
      WHERE d.invoice_id = $1
    `, [invoiceId])

    // Get operations
    const operationsResult = await db.query(`
      SELECT
        o.id, o.operation_number, o.status, o.validation_status,
        o.completed_at, o.completed_by
      FROM market_warehouse_operations o
      WHERE o.reference_type = 'wholesale_invoice' AND o.reference_id = $1
    `, [invoiceId])

    return NextResponse.json({
      success: true,
      data: {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          status: invoice.status,
          deliveredAt: invoice.delivered_at
        },
        deliveries: deliveriesResult.rows.map(d => ({
          id: d.id,
          deliveryNumber: d.delivery_number,
          status: d.status,
          operationId: d.operation_id,
          createdAt: d.created_at,
          dispatchedAt: d.dispatched_at,
          deliveredAt: d.delivered_at,
          createdBy: d.created_by,
          dispatchedBy: d.dispatched_by,
          deliveredBy: d.delivered_by
        })),
        operations: operationsResult.rows.map(o => ({
          id: o.id,
          operationNumber: o.operation_number,
          status: o.status,
          validationStatus: o.validation_status,
          completedAt: o.completed_at,
          completedBy: o.completed_by
        }))
      }
    })

  } catch (error) {
    console.error('[Debug Check Delivery] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
