import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    // 1. Find the invoice
    const inv = await db.query("SELECT id, invoice_number, status, warehouse_id, customer_id, delivered_at FROM market_invoices WHERE invoice_number = 'FAC-2026-0011'")

    // 2. Find levadura product
    const lev = await db.query("SELECT id, name, quantity_on_hand, cost_price, selling_price FROM market_products WHERE name ILIKE '%levadura%' LIMIT 5")

    // 3. Invoice lines
    const lines = inv.rows.length > 0 ? await db.query(
      'SELECT il.*, p.name as product_name FROM market_invoice_lines il JOIN market_products p ON p.id = il.product_id WHERE il.invoice_id = $1',
      [inv.rows[0]?.id]
    ) : { rows: [] }

    // 4. Deliveries
    const deliveries = inv.rows.length > 0 ? await db.query(
      'SELECT id, delivery_number, status, operation_id, dispatched_at, delivered_at FROM market_invoice_deliveries WHERE invoice_id = $1',
      [inv.rows[0]?.id]
    ) : { rows: [] }

    // 5. Delivery lines
    const deliveryLines = deliveries.rows.length > 0 ? await db.query(
      'SELECT dl.*, p.name as product_name FROM market_invoice_delivery_lines dl JOIN market_products p ON p.id = dl.product_id WHERE dl.delivery_id = $1',
      [deliveries.rows[0]?.id]
    ) : { rows: [] }

    // 6. Operation
    const ops = deliveries.rows.length > 0 && deliveries.rows[0].operation_id ? await db.query(
      'SELECT id, operation_number, status, operation_type, completed_at FROM market_warehouse_operations WHERE id = $1',
      [deliveries.rows[0].operation_id]
    ) : { rows: [] }

    // 7. Operation lines
    const opLines = ops.rows.length > 0 ? await db.query(
      'SELECT ol.*, p.name as product_name FROM market_warehouse_operation_lines ol JOIN market_products p ON p.id = ol.product_id WHERE ol.operation_id = $1',
      [ops.rows[0]?.id]
    ) : { rows: [] }

    // 8. Warehouse stock for levadura
    const levId = lev.rows[0]?.id
    const warehouseStock = levId ? await db.query(
      'SELECT ws.*, w.name as warehouse_name FROM market_warehouse_stock ws JOIN market_warehouses w ON w.id = ws.warehouse_id WHERE ws.product_id = $1',
      [levId]
    ) : { rows: [] }

    // 9. Consignment lots for levadura
    const consLots = levId ? await db.query(
      'SELECT cli.*, co.order_number FROM consignment_lot_inventory cli LEFT JOIN consignment_order_lines col ON col.id = cli.order_line_id LEFT JOIN consignment_orders co ON co.id = col.order_id WHERE cli.product_id = $1',
      [levId]
    ) : { rows: [] }

    // 10. Stock movements for levadura (last 10)
    const movements = levId ? await db.query(
      'SELECT * FROM market_stock_movements WHERE product_id = $1 ORDER BY created_at DESC LIMIT 10',
      [levId]
    ) : { rows: [] }

    return NextResponse.json({
      success: true,
      debug: {
        invoice: inv.rows[0] || null,
        levaduraProducts: lev.rows,
        invoiceLines: lines.rows.map(l => ({
          id: l.id, productName: l.product_name, quantity: l.quantity,
          quantityDelivered: l.quantity_delivered, unitPrice: l.unit_price
        })),
        deliveries: deliveries.rows,
        deliveryLines: deliveryLines.rows.map(dl => ({
          id: dl.id, productName: dl.product_name,
          quantityToDeliver: dl.quantity_to_deliver, quantityDelivered: dl.quantity_delivered
        })),
        operation: ops.rows[0] || null,
        operationLines: opLines.rows.map(ol => ({
          id: ol.id, productName: ol.product_name,
          quantityPlanned: ol.quantity_planned, quantityValidated: ol.quantity_validated
        })),
        warehouseStock: warehouseStock.rows.map(ws => ({
          warehouseId: ws.warehouse_id, warehouseName: ws.warehouse_name,
          quantityOnHand: ws.quantity_on_hand, quantityReserved: ws.quantity_reserved
        })),
        consignmentLots: consLots.rows.map(cl => ({
          id: cl.id, lotNumber: cl.lot_number, orderNumber: cl.order_number,
          quantityAvailable: cl.quantity_available, quantitySold: cl.quantity_sold,
          unitCost: cl.unit_cost, warehouseId: cl.warehouse_id
        })),
        recentMovements: movements.rows.map(m => ({
          type: m.movement_type, quantity: m.quantity,
          before: m.quantity_before, after: m.quantity_after,
          referenceType: m.reference_type, createdAt: m.created_at
        }))
      }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
