import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-invoice-0013
 * Create delivery + operation for FAC-2026-0013 that was created before auto-delivery code
 */
export async function GET() {
  try {
    const inv = await db.query(`
      SELECT i.id, i.invoice_number, i.status, i.warehouse_id, i.customer_id, i.company_id,
        c.business_name, c.address
      FROM market_invoices i
      LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
      WHERE i.invoice_number = 'FAC-2026-0013'
    `)
    if (inv.rows.length === 0) return NextResponse.json({ success: false, error: 'No encontrada' })

    const invoice = inv.rows[0]

    // Check if delivery already exists
    const existing = await db.query('SELECT id FROM market_invoice_deliveries WHERE invoice_id = $1', [invoice.id])
    if (existing.rows.length > 0) return NextResponse.json({ success: false, error: 'Ya tiene entrega creada' })

    // Resolve warehouse
    let warehouseId = invoice.warehouse_id
    if (!warehouseId) {
      const wRes = await db.query(
        'SELECT id FROM market_warehouses WHERE company_id = $1 AND is_active = true ORDER BY is_central DESC NULLS LAST LIMIT 1',
        [invoice.company_id]
      )
      if (wRes.rows.length > 0) {
        warehouseId = wRes.rows[0].id
        await db.query('UPDATE market_invoices SET warehouse_id = $1 WHERE id = $2', [warehouseId, invoice.id])
      }
    }

    if (!warehouseId) return NextResponse.json({ success: false, error: 'No hay almacén disponible' })

    const yr = new Date().getFullYear()

    // Generate operation number
    const opRes = await db.query(
      "SELECT operation_number FROM market_warehouse_operations WHERE company_id = $1 AND operation_number LIKE $2 ORDER BY id DESC LIMIT 1",
      [invoice.company_id, `WD-${yr}-%`]
    )
    let opNext = 1
    if (opRes.rows.length > 0) {
      const m = opRes.rows[0].operation_number.match(/WD-\d{4}-(\d+)/)
      if (m) opNext = parseInt(m[1]) + 1
    }
    const opNumber = `WD-${yr}-${String(opNext).padStart(4, '0')}`

    // Generate delivery number
    const delRes = await db.query(
      "SELECT delivery_number FROM market_invoice_deliveries WHERE delivery_number LIKE $1 ORDER BY id DESC LIMIT 1",
      [`ENT-${yr}-%`]
    )
    let delNext = 1
    if (delRes.rows.length > 0) {
      const m = delRes.rows[0].delivery_number.match(/ENT-\d{4}-(\d+)/)
      if (m) delNext = parseInt(m[1]) + 1
    }
    const delNumber = `ENT-${yr}-${String(delNext).padStart(4, '0')}`

    // Create operation
    const opResult = await db.query(`
      INSERT INTO market_warehouse_operations (
        company_id, operation_number, operation_type, status, source_warehouse_id,
        reference_type, reference_id, reference_number, notes, created_by, created_at
      ) VALUES ($1, $2, 'wholesale_delivery', 'confirmed', $3, 'wholesale_invoice', $4, $5, $6,
        (SELECT u.id FROM users u JOIN user_companies uc ON uc.user_id = u.id WHERE uc.company_id = $1 LIMIT 1), NOW())
      RETURNING id
    `, [invoice.company_id, opNumber, warehouseId, invoice.id, invoice.invoice_number,
        `Entrega mayorista - Cliente: ${invoice.business_name || ''}`])
    const operationId = opResult.rows[0].id

    // Create delivery
    const delivResult = await db.query(`
      INSERT INTO market_invoice_deliveries (
        invoice_id, delivery_number, warehouse_id, operation_id, status, delivery_address, notes,
        created_by, created_at
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6,
        (SELECT id FROM users WHERE company_id = $7 LIMIT 1), NOW())
      RETURNING id
    `, [invoice.id, delNumber, warehouseId, operationId, invoice.address || '',
        'Entrega desde almacén', invoice.company_id])
    const deliveryId = delivResult.rows[0].id

    // Create lines
    const lines = await db.query(
      'SELECT id, product_id, variant_id, quantity FROM market_invoice_lines WHERE invoice_id = $1',
      [invoice.id]
    )
    for (const line of lines.rows) {
      const qty = parseFloat(line.quantity) || 0
      await db.query(
        'INSERT INTO market_warehouse_operation_lines (operation_id, product_id, variant_id, quantity_planned, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [operationId, line.product_id, line.variant_id, qty]
      )
      await db.query(
        'INSERT INTO market_invoice_delivery_lines (delivery_id, invoice_line_id, product_id, variant_id, quantity_to_deliver, quantity_delivered, created_at) VALUES ($1, $2, $3, $4, $5, 0, NOW())',
        [deliveryId, line.id, line.product_id, line.variant_id, qty]
      )
    }

    // Set invoice to confirmed
    await db.query("UPDATE market_invoices SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1", [invoice.id])

    return NextResponse.json({
      success: true,
      message: `Operación ${opNumber} y entrega ${delNumber} creadas para FAC-2026-0013. Ve al almacén → Entrega Mayorista → Completar para rebajar stock.`
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
