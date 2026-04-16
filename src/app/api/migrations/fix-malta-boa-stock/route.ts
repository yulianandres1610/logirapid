import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    // Find Berroa warehouse
    const whResult = await db.query(`
      SELECT id, name FROM market_warehouses WHERE LOWER(name) LIKE '%berroa%' LIMIT 1
    `)

    if (whResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Almacen Berroa no encontrado' })
    }

    const warehouseId = whResult.rows[0].id
    const warehouseName = whResult.rows[0].name

    // Check current stock for product 415 in Berroa
    const stockBefore = await db.query(`
      SELECT quantity_on_hand, quantity_reserved
      FROM market_warehouse_stock
      WHERE warehouse_id = $1 AND product_id = 415 AND COALESCE(variant_id, 0) = 0
    `, [warehouseId])

    const before = stockBefore.rows[0] || { quantity_on_hand: 0, quantity_reserved: 0 }

    // Direct update - no movement record, no adjustment
    await db.query(`
      UPDATE market_warehouse_stock
      SET quantity_on_hand = 1444, updated_at = NOW()
      WHERE warehouse_id = $1 AND product_id = 415 AND COALESCE(variant_id, 0) = 0
    `, [warehouseId])

    // Also update the aggregate in market_products
    const totalStock = await db.query(`
      SELECT COALESCE(SUM(quantity_on_hand), 0) as total
      FROM market_warehouse_stock
      WHERE product_id = 415
    `)

    await db.query(`
      UPDATE market_products SET quantity_on_hand = $1, updated_at = NOW() WHERE id = 415
    `, [totalStock.rows[0].total])

    return NextResponse.json({
      success: true,
      message: `Stock de producto 415 en ${warehouseName} ajustado a 1444`,
      data: {
        warehouse: warehouseName,
        warehouseId,
        productId: 415,
        before: parseFloat(before.quantity_on_hand),
        after: 1444,
        totalAllWarehouses: parseFloat(totalStock.rows[0].total)
      }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
