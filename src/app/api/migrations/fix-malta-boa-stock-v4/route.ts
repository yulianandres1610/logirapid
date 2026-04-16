import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    // Show ALL warehouse stock for product 415 so we can see exactly what's happening
    const allStock = await db.query(`
      SELECT ws.warehouse_id, w.name, ws.quantity_on_hand, ws.id as stock_id
      FROM market_warehouse_stock ws
      JOIN market_warehouses w ON w.id = ws.warehouse_id
      WHERE ws.product_id = 415
      ORDER BY w.name
    `)

    const productRow = await db.query(`SELECT quantity_on_hand FROM market_products WHERE id = 415`)

    // Find ALL rows that could be Berroa
    const berroaRows = allStock.rows.filter((r: any) => r.name.toLowerCase().includes('berroa'))

    // Force update every Berroa match to 1444
    for (const row of berroaRows) {
      await db.query(`
        UPDATE market_warehouse_stock SET quantity_on_hand = 1444, updated_at = NOW() WHERE id = $1
      `, [row.stock_id])
    }

    // Recalculate total
    const totalResult = await db.query(`
      SELECT COALESCE(SUM(quantity_on_hand), 0) as total FROM market_warehouse_stock WHERE product_id = 415
    `)
    const total = parseFloat(totalResult.rows[0].total)

    await db.query(`UPDATE market_products SET quantity_on_hand = $1, updated_at = NOW() WHERE id = 415`, [total])

    // Re-read to confirm
    const afterStock = await db.query(`
      SELECT ws.warehouse_id, w.name, ws.quantity_on_hand
      FROM market_warehouse_stock ws
      JOIN market_warehouses w ON w.id = ws.warehouse_id
      WHERE ws.product_id = 415
      ORDER BY w.name
    `)

    return NextResponse.json({
      success: true,
      before: {
        productTotal: parseFloat(productRow.rows[0]?.quantity_on_hand || 0),
        warehouses: allStock.rows.map((r: any) => ({ name: r.name, id: r.warehouse_id, stockId: r.stock_id, qty: parseFloat(r.quantity_on_hand) }))
      },
      berroaRowsUpdated: berroaRows.length,
      after: {
        productTotal: total,
        warehouses: afterStock.rows.map((r: any) => ({ name: r.name, qty: parseFloat(r.quantity_on_hand) }))
      }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
