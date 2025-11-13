import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params

  try {
    const orderId = params.id
    const body = await request.json()
    const { newScheduledDate, newTimeSlot } = body

    // Get the current order with route information
    const orderResult = await db.query(`
      SELECT po.*, proute.id as routeid, proute.stops
      FROM package_orders po
      LEFT JOIN routes proute ON po.routeid = proute.id
      WHERE po.id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const order = orderResult.rows[0]

    if (order.status !== 'in_transit') {
      return NextResponse.json({ error: 'Order must be in transit to be reprogrammed' }, { status: 400 })
    }

    if (!newScheduledDate || !newTimeSlot) {
      return NextResponse.json({ error: 'New scheduled date and time slot are required' }, { status: 400 })
    }

    if (!order.routeid || !order.stops) {
      return NextResponse.json({ error: 'Order is not assigned to a route' }, { status: 400 })
    }

    // Use transaction
    const result = await db.transaction(async () => {
      // 1. Change order status to 'reprogrammed' and update scheduled date and time
      await db.query(`
        UPDATE package_orders
        SET status = 'reprogrammed', routeid = NULL, scheduleddate = $1, timeslot = $2, updatedat = NOW()
        WHERE id = $3
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
      await db.query(`
        UPDATE routes
        SET stops = $1, updatedat = NOW()
        WHERE id = $2
      `, [JSON.stringify(stops), order.routeid])

      // 5. Update other orders in the route to remove routeId if needed
      for (const stop of stops) {
        await db.query(`
          UPDATE package_orders
          SET stopnumber = $1
          WHERE id = $2
        `, [stop.stopNumber, stop.orderId])
      }

      return stops
    })

    return NextResponse.json({
      success: true,
      message: 'Order reprogrammed successfully',
      data: {
        orderId: parseInt(orderId),
        previousRouteId: order.routeid,
        newStopsCount: result.length,
        newScheduledDate,
        newTimeSlot
      }
    })

  } catch (error) {
    console.error('Error reprogramming order:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}