import { NextRequest, NextResponse } from 'next/server'
import { Database } from 'sqlite3'
import { open } from 'sqlite'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    const orderId = params.id

    // Get the current order with route information
    const order = await db.get(`
      SELECT po.*, proute.id as routeId, proute.stops
      FROM package_orders po
      LEFT JOIN routes proute ON po.routeId = proute.id
      WHERE po.id = ?
    `, [orderId])

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Start transaction
    await db.run('BEGIN TRANSACTION')

    try {
      // 1. Change order status to 'cancelled'
      await db.run(`
        UPDATE package_orders
        SET status = 'cancelled', routeId = NULL, updatedAt = datetime('now')
        WHERE id = ?
      `, [orderId])

      // 2. If the order was in a route, remove it and re-number remaining stops
      if (order.routeId && order.stops) {
        // Parse stops JSON and remove the cancelled order
        let stops = JSON.parse(order.stops || '[]')

        // Find and remove the stop with this order
        const originalStopCount = stops.length
        stops = stops.filter((stop: any) => stop.orderId !== parseInt(orderId))

        if (stops.length === originalStopCount) {
          throw new Error('Order not found in route stops')
        }

        // 3. Re-number the remaining stops
        stops = stops.map((stop: any, index: number) => ({
          ...stop,
          stopNumber: index + 1
        }))

        // 4. Update the route with new stops
        await db.run(`
          UPDATE routes
          SET stops = ?, updatedAt = datetime('now')
          WHERE id = ?
        `, [JSON.stringify(stops), order.routeId])

        // 5. Update other orders in the route to reflect new stop numbers
        for (const stop of stops) {
          await db.run(`
            UPDATE package_orders
            SET stopNumber = ?
            WHERE id = ?
          `, [stop.stopNumber, stop.orderId])
        }
      }

      await db.run('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Order cancelled successfully',
        data: {
          orderId: parseInt(orderId),
          wasInRoute: !!order.routeId,
          remainingStops: order.routeId ? JSON.parse(order.stops || '[]').length - 1 : 0
        }
      })

    } catch (error) {
      await db.run('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Error cancelling order:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}