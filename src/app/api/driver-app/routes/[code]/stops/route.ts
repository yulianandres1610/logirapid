import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/routes/[code]/stops
 *
 * Obtiene la lista completa de paradas con toda la información detallada de cada orden.
 * Si la ruta está en estado 'pending' o 'asignada', la cambia automáticamente a 'en_curso'.
 * Diseñado para la vista de lista de paradas en la app móvil del driver.
 *
 * @authentication Requiere cookie auth-token
 * @param code - Código de la ruta (routenumber)
 * @returns Lista de paradas ordenadas con información completa de cada orden
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    // Obtener información del usuario desde headers (inyectados por middleware)
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Se requiere autenticación.'
      }, { status: 401 })
    }

    // 1. Obtener la ruta por código
    const routeQuery = await db.query(
      `SELECT
        r.id,
        r.routenumber,
        r.status,
        r.distance,
        r.estimatedduration,
        r.date,
        r.driverid,
        r.drivername,
        r.vehicleid,
        r.vehicleplate,
        r.stops,
        r.totalpackages,
        r.deliveredpackages
      FROM routes r
      WHERE r.routenumber = $1`,
      [code]
    )

    if (routeQuery.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ruta no encontrada'
      }, { status: 404 })
    }

    const route = routeQuery.rows[0]
    let routeStatus = route.status
    let statusChanged = false

    // 2. Cambiar estado de ruta si está pendiente/asignada -> en_curso
    const statusesToChange = ['pending', 'asignada', 'assigned']
    if (statusesToChange.includes(routeStatus?.toLowerCase())) {
      await db.query(
        `UPDATE routes SET status = 'en_curso', updatedat = NOW() WHERE id = $1`,
        [route.id]
      )
      routeStatus = 'en_curso'
      statusChanged = true

      // También actualizar órdenes asociadas a in_transit si están pending
      await db.query(
        `UPDATE package_orders
         SET status = 'in_transit', updatedat = NOW()
         WHERE routeid = $1 AND status = 'pending'`,
        [route.id]
      )
    }

    // 3. Parsear paradas del JSON
    let stopsData: Array<{
      stopNumber: number
      orderIds: number[]
      status?: string
      address?: string
      latitude?: number
      longitude?: number
    }> = []

    if (route.stops) {
      try {
        stopsData = typeof route.stops === 'string'
          ? JSON.parse(route.stops)
          : route.stops
      } catch {
        stopsData = []
      }
    }

    // 4. Obtener todos los orderIds de las paradas
    const allOrderIds: number[] = []
    stopsData.forEach(stop => {
      if (stop.orderIds && Array.isArray(stop.orderIds)) {
        allOrderIds.push(...stop.orderIds)
      }
    })

    // 5. Obtener todas las órdenes con información completa
    interface OrderData {
      id: number
      ordernumber: string
      status: string
      order_type: string
      scheduleddate: string
      timeslot: string
      customername: string
      firstname: string
      lastname: string
      phone: string
      email: string
      street: string
      apartment: string
      city: string
      state: string
      zipcode: string
      country: string
      latitude: number
      longitude: number
      customernotes: string
      notes: string
      boxcount: number
      boxes: string
      boxes_delivered: number
      boxes_returned: number
      pending_return: boolean
      return_status: string
      proof_status: string
      delivered_at: string
      subtotal: string
      taxamount: string
      totalamount: string
      paymentmethod: string
      services: string
      servicepackages: string
      createdat: string
    }

    let ordersMap: Record<number, OrderData> = {}

    if (allOrderIds.length > 0) {
      const ordersQuery = await db.query(
        `SELECT
          id,
          ordernumber,
          status,
          order_type,
          scheduleddate,
          timeslot,
          customername,
          firstname,
          lastname,
          phone,
          email,
          street,
          apartment,
          city,
          state,
          zipcode,
          country,
          latitude,
          longitude,
          customernotes,
          notes,
          boxcount,
          boxes,
          boxes_delivered,
          boxes_returned,
          pending_return,
          return_status,
          proof_status,
          delivered_at,
          subtotal,
          taxamount,
          totalamount,
          paymentmethod,
          services,
          servicepackages,
          createdat
        FROM package_orders
        WHERE id = ANY($1)`,
        [allOrderIds]
      )

      ordersQuery.rows.forEach(order => {
        ordersMap[order.id] = order
      })
    }

    // 6. Construir lista de paradas con órdenes detalladas
    const stopsList = stopsData.map((stop, index) => {
      const stopOrders = (stop.orderIds || [])
        .map(orderId => ordersMap[orderId])
        .filter(Boolean)

      // Datos de la primera orden para la dirección de la parada
      const firstOrder = stopOrders[0]

      // Calcular estado de la parada
      let stopStatus = 'pending'
      if (stopOrders.length > 0) {
        const allDelivered = stopOrders.every(o =>
          o.status === 'delivered' || o.status === 'completed'
        )
        const anyFailed = stopOrders.some(o => o.status === 'failed')
        const anyInTransit = stopOrders.some(o => o.status === 'in_transit')

        if (allDelivered) {
          stopStatus = 'completed'
        } else if (anyFailed && !stopOrders.some(o =>
          o.status === 'pending' || o.status === 'in_transit'
        )) {
          stopStatus = 'failed'
        } else if (anyInTransit) {
          stopStatus = 'in_progress'
        }
      }

      const finalStatus = stop.status || stopStatus

      // Construir dirección completa
      const street = firstOrder?.street || ''
      const apartment = firstOrder?.apartment || ''
      const city = firstOrder?.city || ''
      const state = firstOrder?.state || ''
      const zipcode = firstOrder?.zipcode || ''
      const addressParts = [street]
      if (apartment) addressParts.push(apartment)
      if (city) addressParts.push(city)
      if (state) addressParts.push(state)
      if (zipcode) addressParts.push(zipcode)
      const fullAddress = addressParts.join(', ')

      // Coordenadas
      const latitude = parseFloat(String(stop.latitude || firstOrder?.latitude || 0)) || 0
      const longitude = parseFloat(String(stop.longitude || firstOrder?.longitude || 0)) || 0

      // Construir órdenes con información completa
      const orders = stopOrders.map(order => {
        // Dirección completa del cliente
        const orderAddressParts = [order.street]
        if (order.apartment) orderAddressParts.push(order.apartment)
        if (order.city) orderAddressParts.push(order.city)
        if (order.state) orderAddressParts.push(order.state)
        if (order.zipcode) orderAddressParts.push(order.zipcode)
        const orderAddress = orderAddressParts.join(', ')

        // Nombre del cliente
        const customerName = order.customername ||
          (order.firstname && order.lastname
            ? `${order.firstname} ${order.lastname}`
            : order.firstname || order.lastname || 'Cliente')

        // Parsear boxes si es JSON
        let boxesData = null
        if (order.boxes) {
          try {
            boxesData = typeof order.boxes === 'string'
              ? JSON.parse(order.boxes)
              : order.boxes
          } catch {
            boxesData = null
          }
        }

        // Parsear services si es JSON
        let servicesData = null
        if (order.services) {
          try {
            servicesData = typeof order.services === 'string'
              ? JSON.parse(order.services)
              : order.services
          } catch {
            servicesData = null
          }
        }

        // Formatear timeSlot
        const timeSlotMap: { [key: string]: string } = {
          'morning': '8:00 AM - 12:00 PM',
          'afternoon': '12:00 PM - 5:00 PM',
          'evening': '5:00 PM - 8:00 PM',
          'all_day': '8:00 AM - 8:00 PM'
        }
        const timeSlotFormatted = timeSlotMap[order.timeslot] || order.timeslot || ''

        return {
          id: order.id,
          orderNumber: order.ordernumber,
          status: order.status || 'pending',
          orderType: order.order_type || 'pickup',
          scheduledDate: order.scheduleddate,
          timeSlot: order.timeslot || '',
          timeSlotFormatted,
          customerName,
          customerFirstName: order.firstname || '',
          customerLastName: order.lastname || '',
          customerPhone: order.phone || '',
          customerEmail: order.email || '',
          address: orderAddress,
          street: order.street || '',
          apartment: order.apartment || '',
          city: order.city || '',
          state: order.state || '',
          zipcode: order.zipcode || '',
          country: order.country || 'US',
          latitude: parseFloat(String(order.latitude)) || 0,
          longitude: parseFloat(String(order.longitude)) || 0,
          customerNotes: order.customernotes || '',
          internalNotes: order.notes || '',
          boxCount: order.boxcount || 0,
          boxes: boxesData,
          boxesDelivered: order.boxes_delivered || 0,
          boxesReturned: order.boxes_returned || 0,
          pendingReturn: order.pending_return || false,
          returnStatus: order.return_status || null,
          proofStatus: order.proof_status || null,
          deliveredAt: order.delivered_at || null,
          subtotal: parseFloat(order.subtotal) || 0,
          tax: parseFloat(order.taxamount) || 0,
          total: parseFloat(order.totalamount) || 0,
          paymentMethod: order.paymentmethod || '',
          services: servicesData,
          createdAt: order.createdat
        }
      })

      // Calcular totales de la parada
      const totalBoxes = orders.reduce((sum, o) => sum + (o.boxCount || 0), 0)
      const totalAmount = orders.reduce((sum, o) => sum + (o.total || 0), 0)
      const ordersCount = orders.length
      const completedOrders = orders.filter(o =>
        o.status === 'delivered' || o.status === 'completed'
      ).length

      return {
        stopNumber: stop.stopNumber || index + 1,
        status: finalStatus,
        address: fullAddress,
        latitude,
        longitude,
        ordersCount,
        completedOrders,
        totalBoxes,
        totalAmount: Math.round(totalAmount * 100) / 100,
        orders
      }
    })

    // 7. Calcular resumen general
    const totalStops = stopsList.length
    const completedStops = stopsList.filter(s => s.status === 'completed').length
    const totalOrders = stopsList.reduce((sum, s) => sum + s.ordersCount, 0)
    const completedOrders = stopsList.reduce((sum, s) => sum + s.completedOrders, 0)
    const progress = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0

    // 8. Formatear respuesta
    const distanceValue = parseFloat(route.distance) || 0

    const response = {
      success: true,
      data: {
        routeId: route.id,
        routeCode: route.routenumber,
        routeStatus: routeStatus,
        statusChanged,
        date: route.date,
        distance: `${distanceValue.toFixed(1)} mi`,
        duration: route.estimatedduration || '0 min',
        driverName: route.drivername || '',
        vehiclePlate: route.vehicleplate || '',
        totalStops,
        completedStops,
        totalOrders,
        completedOrders,
        progress,
        stops: stopsList
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[Driver App - Route Stops] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener paradas de la ruta'
    }, { status: 500 })
  }
}
