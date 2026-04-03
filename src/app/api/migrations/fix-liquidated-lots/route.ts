import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/fix-liquidated-lots
 * Zero out consignment_lot_inventory for orders that are already liquidated
 * This fixes phantom stock from lots that weren't cleaned up when orders were liquidated
 */
export async function POST() {
  try {
    // Find and zero out lots belonging to liquidated orders
    const result = await db.query(`
      UPDATE consignment_lot_inventory cli
      SET quantity_available = 0
      WHERE quantity_available > 0
        AND order_line_id IN (
          SELECT col.id FROM consignment_order_lines col
          JOIN consignment_orders co ON co.id = col.order_id
          WHERE co.status = 'liquidated'
        )
      RETURNING cli.id, cli.lot_number, cli.quantity_available as was_available, cli.product_id
    `)

    const fixed = result.rows

    // Also find lots where quantity_sold + quantity_returned >= quantity_initial
    const result2 = await db.query(`
      UPDATE consignment_lot_inventory
      SET quantity_available = 0
      WHERE quantity_available > 0
        AND COALESCE(quantity_sold, 0) + COALESCE(quantity_returned, 0) >= quantity_initial
      RETURNING id, lot_number, quantity_available as was_available
    `)

    const fixed2 = result2.rows

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixed.length + fixed2.length} phantom lots`,
      data: {
        liquidatedOrderLots: fixed.length,
        oversoldLots: fixed2.length,
        details: [...fixed, ...fixed2].slice(0, 20)
      }
    })
  } catch (error) {
    console.error('[Fix Liquidated Lots]', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Preview: show lots that would be affected
    const result = await db.query(`
      SELECT
        cli.id, cli.lot_number, cli.quantity_available, cli.quantity_initial,
        COALESCE(cli.quantity_sold, 0) as quantity_sold,
        COALESCE(cli.quantity_returned, 0) as quantity_returned,
        co.order_number, co.status as order_status,
        mp.name as product_name
      FROM consignment_lot_inventory cli
      JOIN consignment_order_lines col ON col.id = cli.order_line_id
      JOIN consignment_orders co ON co.id = col.order_id
      LEFT JOIN market_products mp ON mp.id = cli.product_id
      WHERE cli.quantity_available > 0
        AND (
          co.status = 'liquidated'
          OR COALESCE(cli.quantity_sold, 0) + COALESCE(cli.quantity_returned, 0) >= cli.quantity_initial
        )
      ORDER BY co.order_number, cli.lot_number
    `)

    return NextResponse.json({
      success: true,
      data: {
        phantomLots: result.rows.length,
        lots: result.rows
      }
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
