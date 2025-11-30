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

    // Permitir reprogramación en varios estados
    const allowedStatuses = ['in_transit', 'pending', 'en_ruta', 'en_reparto']
    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json({
        error: `No se puede reprogramar una orden con estado "${order.status}". Estados permitidos: ${allowedStatuses.join(', ')}`
      }, { status: 400 })
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
      let stops = typeof order.stops === 'string'
        ? JSON.parse(order.stops || '[]')
        : (Array.isArray(order.stops) ? order.stops : [])

      const orderIdNum = parseInt(orderId)

      // Find and remove the stop with this order
      // Soporta ambos formatos: orderId (singular) y orderIds (array)
      const originalStopCount = stops.length
      stops = stops.filter((stop: any) => {
        // Si tiene orderId singular
        if (stop.orderId !== undefined) {
          return Number(stop.orderId) !== orderIdNum
        }
        // Si tiene orderIds array
        if (stop.orderIds && Array.isArray(stop.orderIds)) {
          return !stop.orderIds.some((id: number | string) => Number(id) === orderIdNum)
        }
        return true
      })

      if (stops.length === originalStopCount) {
        // Si no se encontró en la estructura normal, intentar buscar en formato de waypoints
        console.log('⚠️ Orden no encontrada en stops, intentando buscar en waypoints...')
        console.log('Order ID buscado:', orderIdNum)
        console.log('Stops:', JSON.stringify(stops.slice(0, 3), null, 2))
      }

      // 3. Re-number the remaining stops
      stops = stops.map((stop: any, index: number) => ({
        ...stop,
        stopNumber: index + 1
      }))

      // 4. Verificar si la ruta quedó vacía
      let routeDeleted = false
      if (stops.length === 0) {
        // Eliminar la ruta vacía
        await db.query(`
          DELETE FROM routes
          WHERE id = $1
        `, [order.routeid])
        routeDeleted = true
        console.log(`🗑️ [Ruta] Ruta ${order.routeid} eliminada (quedó vacía)`)
      } else {
        // 5. Update the route with new stops
        await db.query(`
          UPDATE routes
          SET stops = $1, updatedat = NOW()
          WHERE id = $2
        `, [JSON.stringify(stops), order.routeid])

        // 6. Update other orders in the route to update stopNumber
        for (const stop of stops) {
          await db.query(`
            UPDATE package_orders
            SET stopnumber = $1
            WHERE id = $2
          `, [stop.stopNumber, stop.orderId])
        }
      }

      return { stops, routeDeleted }
    })

    return NextResponse.json({
      success: true,
      message: result.routeDeleted
        ? 'Orden reprogramada y ruta eliminada (era la única orden)'
        : 'Orden reprogramada exitosamente',
      data: {
        orderId: parseInt(orderId),
        previousRouteId: order.routeid,
        newStopsCount: result.stops.length,
        newScheduledDate,
        newTimeSlot,
        routeDeleted: result.routeDeleted
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