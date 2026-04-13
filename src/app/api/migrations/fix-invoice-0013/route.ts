import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

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

    // Clean existing
    const existingDel = await db.query('SELECT id, operation_id FROM market_invoice_deliveries WHERE invoice_id = $1', [invoice.id])
    for (const d of existingDel.rows) {
      await db.query('DELETE FROM market_invoice_delivery_lines WHERE delivery_id = $1', [d.id])
      if (d.operation_id) {
        await db.query('DELETE FROM market_warehouse_operation_lines WHERE operation_id = $1', [d.operation_id])
        await db.query('DELETE FROM market_warehouse_operations WHERE id = $1', [d.operation_id])
      }
    }
    await db.query('DELETE FROM market_invoice_deliveries WHERE invoice_id = $1', [invoice.id])
    await db.query('UPDATE market_invoice_lines SET quantity_delivered = 0 WHERE invoice_id = $1', [invoice.id])

    const yr = new Date().getFullYear()
    const userRes = await db.query('SELECT u.id FROM users u JOIN user_companies uc ON uc.user_id = u.id WHERE uc.company_id = $1 LIMIT 1', [invoice.company_id])
    const userId = userRes.rows[0]?.id || 1

    const lines = await db.query('SELECT id, product_id, variant_id, product_name, quantity, warehouse_quantities FROM market_invoice_lines WHERE invoice_id = $1', [invoice.id])

    // Group by warehouse
    const linesByWh = new Map<number, Array<{ lineId: number; productId: number; variantId: number | null; quantity: number }>>()
    for (const line of lines.rows) {
      const wq = typeof line.warehouse_quantities === 'string' ? JSON.parse(line.warehouse_quantities || '{}') : (line.warehouse_quantities || {})
      const hasWQ = Object.keys(wq).length > 0 && Object.values(wq).some((v: any) => parseFloat(String(v)) > 0)
      if (hasWQ) {
        for (const [wIdStr, qty] of Object.entries(wq)) {
          const wId = parseInt(wIdStr); const q = parseFloat(String(qty)) || 0
          if (q <= 0) continue
          if (!linesByWh.has(wId)) linesByWh.set(wId, [])
          linesByWh.get(wId)!.push({ lineId: line.id, productId: line.product_id, variantId: line.variant_id, quantity: q })
        }
      } else {
        let wId = invoice.warehouse_id
        if (!wId) { const wr = await db.query('SELECT id FROM market_warehouses WHERE company_id = $1 AND is_active = true ORDER BY is_central DESC NULLS LAST LIMIT 1', [invoice.company_id]); wId = wr.rows[0]?.id }
        if (wId) { if (!linesByWh.has(wId)) linesByWh.set(wId, []); linesByWh.get(wId)!.push({ lineId: line.id, productId: line.product_id, variantId: line.variant_id, quantity: parseFloat(line.quantity) }) }
      }
    }

    const whNames = new Map<number, string>()
    const whIds = Array.from(linesByWh.keys())
    if (whIds.length > 0) { const wr = await db.query('SELECT id, name FROM market_warehouses WHERE id = ANY($1)', [whIds]); for (const w of wr.rows) whNames.set(w.id, w.name) }

    const opNumRes = await db.query("SELECT operation_number FROM market_warehouse_operations WHERE company_id = $1 AND operation_number LIKE $2 ORDER BY id DESC LIMIT 1", [invoice.company_id, `WD-${yr}-%`])
    let opNext = 1; if (opNumRes.rows.length > 0) { const m = opNumRes.rows[0].operation_number.match(/WD-\d{4}-(\d+)/); if (m) opNext = parseInt(m[1]) + 1 }
    const delNumRes = await db.query("SELECT delivery_number FROM market_invoice_deliveries WHERE delivery_number LIKE $1 ORDER BY id DESC LIMIT 1", [`ENT-${yr}-%`])
    let delNext = 1; if (delNumRes.rows.length > 0) { const m = delNumRes.rows[0].delivery_number.match(/ENT-\d{4}-(\d+)/); if (m) delNext = parseInt(m[1]) + 1 }

    const created: string[] = []
    let counter = 0
    for (const [whId, whLines] of linesByWh) {
      const opNumber = `WD-${yr}-${String(opNext + counter).padStart(4, '0')}`
      const delNumber = `ENT-${yr}-${String(delNext + counter).padStart(4, '0')}`
      counter++
      const opRes = await db.query(`INSERT INTO market_warehouse_operations (company_id, operation_number, operation_type, status, source_warehouse_id, reference_type, reference_id, reference_number, notes, created_by, created_at) VALUES ($1, $2, 'wholesale_delivery', 'confirmed', $3, 'wholesale_invoice', $4, $5, $6, $7, NOW()) RETURNING id`, [invoice.company_id, opNumber, whId, invoice.id, invoice.invoice_number, `Entrega desde ${whNames.get(whId)} - ${invoice.business_name}`, userId])
      const delivRes = await db.query(`INSERT INTO market_invoice_deliveries (invoice_id, delivery_number, warehouse_id, operation_id, status, delivery_address, notes, created_by, created_at) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, NOW()) RETURNING id`, [invoice.id, delNumber, whId, opRes.rows[0].id, invoice.address || '', `Entrega desde ${whNames.get(whId)}`, userId])
      for (const item of whLines) {
        await db.query('INSERT INTO market_warehouse_operation_lines (operation_id, product_id, variant_id, quantity_planned, created_at) VALUES ($1, $2, $3, $4, NOW())', [opRes.rows[0].id, item.productId, item.variantId, item.quantity])
        await db.query('INSERT INTO market_invoice_delivery_lines (delivery_id, invoice_line_id, product_id, variant_id, quantity_to_deliver, quantity_delivered, created_at) VALUES ($1, $2, $3, $4, $5, 0, NOW())', [delivRes.rows[0].id, item.lineId, item.productId, item.variantId, item.quantity])
      }
      created.push(`${delNumber} → ${whNames.get(whId)} (${whLines.length} productos)`)
    }

    await db.query("UPDATE market_invoices SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1", [invoice.id])

    return NextResponse.json({ success: true, message: `${created.length} entregas creadas`, deliveries: created })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
