import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params

  try {
    const orderId = params.id

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

    // Use transaction
    const result = await db.transaction(async () => {
      // 1. Change order status to 'cancelled'
      await db.query(`
        UPDATE package_orders
        SET status = 'cancelled', routeid = NULL, updatedat = NOW()
        WHERE id = $1
      `, [orderId])

      let remainingStops = 0

      // 2. If the order was in a route, remove it and re-number remaining stops
      if (order.routeid && order.stops) {
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
        await db.query(`
          UPDATE routes
          SET stops = $1, updatedat = NOW()
          WHERE id = $2
        `, [JSON.stringify(stops), order.routeid])

        // 5. Update other orders in the route to reflect new stop numbers
        for (const stop of stops) {
          await db.query(`
            UPDATE package_orders
            SET stopnumber = $1
            WHERE id = $2
          `, [stop.stopNumber, stop.orderId])
        }

        remainingStops = stops.length
      }

      return remainingStops
    })

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        orderId: parseInt(orderId),
        wasInRoute: !!order.routeid,
        remainingStops: result
      }
    })

  } catch (error) {
    console.error('Error cancelling order:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}