import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-delivery-8
 * Force fix delivery status for invoice 8
 */
export async function GET() {
  try {
    // Ensure columns exist
    await db.query(`ALTER TABLE market_invoice_deliveries ADD COLUMN IF NOT EXISTS dispatched_by INTEGER REFERENCES users(id)`)
    await db.query(`ALTER TABLE market_invoice_deliveries ADD COLUMN IF NOT EXISTS delivered_by INTEGER REFERENCES users(id)`)

    // Get invoice 8 data
    const invoiceResult = await db.query(`
      SELECT id, status, delivered_at FROM market_invoices WHERE id = 8
    `)

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice 8 not found' })
    }

    const invoice = invoiceResult.rows[0]

    // Get the delivery for invoice 8
    const deliveryResult = await db.query(`
      SELECT d.*, o.status as operation_status, o.completed_at, o.completed_by
      FROM market_invoice_deliveries d
      LEFT JOIN market_warehouse_operations o ON o.id = d.operation_id
      WHERE d.invoice_id = 8
    `)

    if (deliveryResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No delivery found for invoice 8' })
    }

    const delivery = deliveryResult.rows[0]
    const updates: string[] = []

    // If invoice is delivered, the delivery should also be delivered
    if (invoice.status === 'delivered' && delivery.status !== 'delivered') {
      await db.query(`
        UPDATE market_invoice_deliveries SET
          status = 'delivered',
          dispatched_at = COALESCE(dispatched_at, $1),
          delivered_at = COALESCE(delivered_at, $1),
          dispatched_by = COALESCE(dispatched_by, $2),
          delivered_by = COALESCE(delivered_by, $2)
        WHERE id = $3
      `, [
        delivery.completed_at || invoice.delivered_at || new Date(),
        delivery.completed_by || 1,
        delivery.id
      ])
      updates.push(`Delivery ${delivery.delivery_number} updated to 'delivered'`)
    }

    // If operation is done but delivery is pending
    if (delivery.operation_status === 'done' && delivery.status === 'pending') {
      await db.query(`
        UPDATE market_invoice_deliveries SET
          status = 'delivered',
          dispatched_at = COALESCE(dispatched_at, $1),
          delivered_at = COALESCE(delivered_at, $1),
          dispatched_by = COALESCE(dispatched_by, $2),
          delivered_by = COALESCE(delivered_by, $2)
        WHERE id = $3
      `, [
        delivery.completed_at || new Date(),
        delivery.completed_by || 1,
        delivery.id
      ])
      updates.push(`Delivery ${delivery.delivery_number} synced from operation status`)
    }

    // Update delivery lines
    if (updates.length > 0) {
      await db.query(`
        UPDATE market_invoice_delivery_lines dl SET
          quantity_delivered = quantity_to_deliver
        WHERE dl.delivery_id = $1 AND quantity_delivered < quantity_to_deliver
      `, [delivery.id])
      updates.push('Delivery lines quantities updated')
    }

    return NextResponse.json({
      success: true,
      data: {
        invoice: {
          id: invoice.id,
          status: invoice.status,
          deliveredAt: invoice.delivered_at
        },
        delivery: {
          id: delivery.id,
          deliveryNumber: delivery.delivery_number,
          previousStatus: delivery.status,
          operationStatus: delivery.operation_status,
          completedAt: delivery.completed_at
        },
        updates: updates.length > 0 ? updates : ['No updates needed - delivery already synced']
      }
    })

  } catch (error) {
    console.error('[Fix Delivery 8] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
