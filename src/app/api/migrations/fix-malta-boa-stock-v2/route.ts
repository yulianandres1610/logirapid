import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    // Get all warehouse stock for product 415
    const allStock = await db.query(`
      SELECT ws.warehouse_id, w.name as warehouse_name, ws.quantity_on_hand
      FROM market_warehouse_stock ws
      JOIN market_warehouses w ON w.id = ws.warehouse_id
      WHERE ws.product_id = 415 AND COALESCE(ws.variant_id, 0) = 0
    `)

    // Find Berroa
    const berroa = allStock.rows.find((r: any) => r.warehouse_name.toLowerCase().includes('berroa'))
    if (!berroa) {
      return NextResponse.json({ success: false, error: 'Almacen Berroa no encontrado' })
    }

    // Calculate stock in other warehouses
    const otherStock = allStock.rows
      .filter((r: any) => r.warehouse_id !== berroa.warehouse_id)
      .reduce((sum: number, r: any) => sum + parseFloat(r.quantity_on_hand || 0), 0)

    // Set Berroa stock so total = 1444
    const berroaTarget = 1444 - otherStock

    // Update Berroa
    await db.query(`
      UPDATE market_warehouse_stock
      SET quantity_on_hand = $1, updated_at = NOW()
      WHERE warehouse_id = $2 AND product_id = 415 AND COALESCE(variant_id, 0) = 0
    `, [berroaTarget, berroa.warehouse_id])

    // Update product aggregate to 1444
    await db.query(`
      UPDATE market_products SET quantity_on_hand = 1444, updated_at = NOW() WHERE id = 415
    `)

    return NextResponse.json({
      success: true,
      message: `Stock total de producto 415 ajustado a 1444`,
      data: {
        berroaWarehouseId: berroa.warehouse_id,
        berroaBefore: parseFloat(berroa.quantity_on_hand),
        berroaAfter: berroaTarget,
        otherWarehouses: otherStock,
        totalProduct: 1444,
        allWarehouses: allStock.rows.map((r: any) => ({
          name: r.warehouse_name,
          id: r.warehouse_id,
          stock: r.warehouse_id === berroa.warehouse_id ? berroaTarget : parseFloat(r.quantity_on_hand)
        }))
      }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
