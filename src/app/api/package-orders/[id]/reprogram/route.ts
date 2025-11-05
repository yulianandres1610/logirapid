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
    const body = await request.json()
    const { newScheduledDate, newTimeSlot } = body

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

    if (order.status !== 'in_transit') {
      return NextResponse.json({ error: 'Order must be in transit to be reprogrammed' }, { status: 400 })
    }

    if (!newScheduledDate || !newTimeSlot) {
      return NextResponse.json({ error: 'New scheduled date and time slot are required' }, { status: 400 })
    }

    if (!order.routeId || !order.stops) {
      return NextResponse.json({ error: 'Order is not assigned to a route' }, { status: 400 })
    }

    // Start transaction
    await db.run('BEGIN TRANSACTION')

    try {
      // 1. Change order status to 'reprogrammed' and update scheduled date and time
      await db.run(`
        UPDATE package_orders
        SET status = 'reprogrammed', routeId = NULL, scheduledDate = ?, timeSlot = ?, updatedAt = datetime('now')
        WHERE id = ?
      `, [newScheduledDate, newTimeSlot, orderId])

      // 2. Parse stops JSON and remove the reprogrammed order
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

      // 5. Update other orders in the route to remove routeId if needed
      for (const stop of stops) {
        await db.run(`
          UPDATE package_orders
          SET stopNumber = ?
          WHERE id = ?
        `, [stop.stopNumber, stop.orderId])
      }

      await db.run('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Order reprogrammed successfully',
        data: {
          orderId: parseInt(orderId),
          previousRouteId: order.routeId,
          newStopsCount: stops.length,
          newScheduledDate,
          newTimeSlot
        }
      })

    } catch (error) {
      await db.run('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Error reprogramming order:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}