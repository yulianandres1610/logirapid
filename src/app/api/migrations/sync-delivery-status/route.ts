import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/sync-delivery-status
 * Sync delivery status with warehouse operations that have been completed
 * Optional: ?invoiceId=8 to sync specific invoice
 * Optional: ?force=true to also check invoices marked as delivered
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')
    const force = searchParams.get('force') === 'true'

    // Ensure columns exist
    await db.query(`ALTER TABLE market_invoice_deliveries ADD COLUMN IF NOT EXISTS dispatched_by INTEGER REFERENCES users(id)`)
    await db.query(`ALTER TABLE market_invoice_deliveries ADD COLUMN IF NOT EXISTS delivered_by INTEGER REFERENCES users(id)`)

    // Build query based on parameters
    let whereClause = 'WHERE o.status = \'done\''
    const params: (string | number)[] = []

    if (!force) {
      whereClause += ' AND d.status != \'delivered\''
    }

    if (invoiceId) {
      params.push(parseInt(invoiceId))
      whereClause += ` AND i.id = $${params.length}`
    }

    // First, check if we need to sync based on invoice status (delivered invoice but pending delivery)
    if (invoiceId) {
      const invoiceCheck = await db.query(`
        SELECT
          i.id as invoice_id,
          i.invoice_number,
          i.status as invoice_status,
          i.delivered_at,
          d.id as delivery_id,
          d.delivery_number,
          d.status as delivery_status,
          d.operation_id
        FROM market_invoices i
        LEFT JOIN market_invoice_deliveries d ON d.invoice_id = i.id
        WHERE i.id = $1
      `, [parseInt(invoiceId)])

      // If invoice is delivered but delivery is not, fix it directly
      for (const row of invoiceCheck.rows) {
        if (row.invoice_status === 'delivered' && row.delivery_id && row.delivery_status !== 'delivered') {
          await db.query(`
            UPDATE market_invoice_deliveries SET
              status = 'delivered',
              dispatched_at = COALESCE(dispatched_at, $1),
              delivered_at = COALESCE(delivered_at, $1)
            WHERE id = $2
          `, [row.delivered_at || new Date(), row.delivery_id])

          // Update delivery lines
          await db.query(`
            UPDATE market_invoice_delivery_lines SET
              quantity_delivered = quantity_to_deliver
            WHERE delivery_id = $1 AND quantity_delivered < quantity_to_deliver
          `, [row.delivery_id])

          return NextResponse.json({
            success: true,
            message: '1 entrega actualizada (basado en estado de factura)',
            data: {
              updates: [{
                deliveryNumber: row.delivery_number,
                invoiceNumber: row.invoice_number,
                oldStatus: row.delivery_status,
                newStatus: 'delivered',
                reason: 'Invoice is delivered'
              }]
            }
          })
        }
      }
    }

    // Find all deliveries linked to completed operations
    const result = await db.query(`
      SELECT
        d.id as delivery_id,
        d.delivery_number,
        d.status as delivery_status,
        o.id as operation_id,
        o.operation_number,
        o.status as operation_status,
        o.completed_at,
        o.completed_by,
        i.id as invoice_id,
        i.invoice_number,
        i.status as invoice_status
      FROM market_invoice_deliveries d
      JOIN market_warehouse_operations o ON o.id = d.operation_id
      JOIN market_invoices i ON i.id = d.invoice_id
      ${whereClause}
    `, params)

    const updates: Array<{
      deliveryNumber: string
      operationNumber: string
      invoiceNumber: string
      oldStatus: string
      newStatus: string
    }> = []

    for (const row of result.rows) {
      // Update delivery status
      await db.query(`
        UPDATE market_invoice_deliveries SET
          status = 'delivered',
          dispatched_at = COALESCE(dispatched_at, $1),
          dispatched_by = COALESCE(dispatched_by, $2),
          delivered_at = COALESCE(delivered_at, $1),
          delivered_by = COALESCE(delivered_by, $2)
        WHERE id = $3
      `, [row.completed_at, row.completed_by, row.delivery_id])

      // Update delivery lines from operation lines
      await db.query(`
        UPDATE market_invoice_delivery_lines dl SET
          quantity_delivered = (
            SELECT COALESCE(ol.quantity_validated, ol.quantity_planned)
            FROM market_warehouse_operation_lines ol
            WHERE ol.operation_id = $1 AND ol.product_id = dl.product_id
            AND (ol.variant_id = dl.variant_id OR (ol.variant_id IS NULL AND dl.variant_id IS NULL))
            LIMIT 1
          )
        WHERE dl.delivery_id = $2
      `, [row.operation_id, row.delivery_id])

      updates.push({
        deliveryNumber: row.delivery_number,
        operationNumber: row.operation_number,
        invoiceNumber: row.invoice_number,
        oldStatus: row.delivery_status,
        newStatus: 'delivered'
      })
    }

    return NextResponse.json({
      success: true,
      message: `${updates.length} entregas actualizadas`,
      data: { updates }
    })

  } catch (error) {
    console.error('[Migration Sync Delivery Status] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al sincronizar estados'
    }, { status: 500 })
  }
}
