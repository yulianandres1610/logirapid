import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET() {
  try {
    const whResult = await db.query(`
      SELECT id, name FROM market_warehouses WHERE LOWER(name) LIKE '%berroa%' LIMIT 1
    `)
    if (whResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Almacen Berroa no encontrado' })
    }
    const whId = whResult.rows[0].id

    // Set Berroa to exactly 1444
    await db.query(`
      UPDATE market_warehouse_stock
      SET quantity_on_hand = 1444, updated_at = NOW()
      WHERE warehouse_id = $1 AND product_id = 415 AND COALESCE(variant_id, 0) = 0
    `, [whId])

    // Recalculate total from all warehouses
    const totalResult = await db.query(`
      SELECT COALESCE(SUM(quantity_on_hand), 0) as total
      FROM market_warehouse_stock WHERE product_id = 415
    `)
    const total = parseFloat(totalResult.rows[0].total)

    await db.query(`
      UPDATE market_products SET quantity_on_hand = $1, updated_at = NOW() WHERE id = 415
    `, [total])

    return NextResponse.json({
      success: true,
      data: { berroa: 1444, total }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
