import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/routes/[code]
 *
 * Obtiene el detalle completo de una ruta para la app móvil del driver.
 * Devuelve respuesta simplificada sin objetos anidados para fácil consumo.
 *
 * @authentication Requiere cookie auth-token
 * @param code - Código de la ruta (routenumber)
 * @returns Detalle de la ruta con paradas y órdenes (estructura plana)
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
        r.warehouseid,
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

    // 2. Obtener información del almacén (campos planos)
    let warehouseName: string | null = null
    let warehouseAddress: string | null = null
    let warehouseLatitude: number | null = null
    let warehouseLongitude: number | null = null

    if (route.warehouseid) {
      const warehouseQuery = await db.query(
        `SELECT
          id,
          name,
          address,
          city,
          state,
          zip_code,
          latitude,
          longitude
        FROM warehouses
        WHERE id = $1`,
        [route.warehouseid]
      )

      if (warehouseQuery.rows.length > 0) {
        const w = warehouseQuery.rows[0]
        warehouseName = w.name
        warehouseAddress = `${w.address}, ${w.city}, ${w.state} ${w.zip_code}`
        warehouseLatitude = parseFloat(w.latitude) || 0
        warehouseLongitude = parseFloat(w.longitude) || 0
      }
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

    // 5. Obtener todas las órdenes de una vez
    let ordersMap: Record<number, {
      id: number
      ordernumber: string
      status: string
      customername: string
      firstname: string
      lastname: string
      phone: string
      street: string
      apartment: string
      city: string
      state: string
      zipcode: string
      latitude: number
      longitude: number
    }> = {}

    if (allOrderIds.length > 0) {
      const ordersQuery = await db.query(
        `SELECT
          id,
          ordernumber,
          status,
          customername,
          firstname,
          lastname,
          phone,
          street,
          apartment,
          city,
          state,
          zipcode,
          latitude,
          longitude
        FROM package_orders
        WHERE id = ANY($1)`,
        [allOrderIds]
      )

      ordersQuery.rows.forEach(order => {
        ordersMap[order.id] = order
      })
    }

    // 6. Construir array de paradas simplificadas
    const stopsList = stopsData.map((stop, index) => {
      const stopOrders = (stop.orderIds || [])
        .map(orderId => ordersMap[orderId])
        .filter(Boolean)

      // Tomar datos de dirección de la primera orden de la parada
      const firstOrder = stopOrders[0]

      // Calcular estado de la parada basado en las órdenes
      let stopStatus = 'pending'
      if (stopOrders.length > 0) {
        const allDelivered = stopOrders.every(o => o.status === 'delivered' || o.status === 'completed')
        const anyFailed = stopOrders.some(o => o.status === 'failed')
        const anyInTransit = stopOrders.some(o => o.status === 'in_transit')

        if (allDelivered) {
          stopStatus = 'completed'
        } else if (anyFailed && !stopOrders.some(o => o.status === 'pending' || o.status === 'in_transit')) {
          stopStatus = 'failed'
        } else if (anyInTransit) {
          stopStatus = 'in_progress'
        }
      }

      // Usar status de la parada si está definido, sino calcular
      const finalStatus = stop.status || stopStatus

      // Construir dirección completa como string
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

      // Coordenadas: usar de la parada si existe, sino de la primera orden
      const latitude = parseFloat(String(stop.latitude || firstOrder?.latitude || 0)) || 0
      const longitude = parseFloat(String(stop.longitude || firstOrder?.longitude || 0)) || 0

      return {
        stopNumber: stop.stopNumber || index + 1,
        status: finalStatus,
        address: fullAddress,
        latitude,
        longitude,
        orders: stopOrders.map(order => {
          // Construir dirección del cliente
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

          return {
            id: order.id,
            orderNumber: order.ordernumber,
            status: order.status || 'pending',
            customerName,
            address: orderAddress
          }
        })
      }
    })

    // 7. Calcular resumen
    const totalStops = stopsList.length
    const completedStops = stopsList.filter(s => s.status === 'completed').length
    const totalOrders = stopsList.reduce((sum, s) => sum + s.orders.length, 0)
    const completedOrders = stopsList.reduce((sum, s) =>
      sum + s.orders.filter(o => o.status === 'delivered' || o.status === 'completed').length, 0
    )
    const progress = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0

    // 8. Formatear respuesta simplificada (sin objetos anidados)
    const distanceValue = parseFloat(route.distance) || 0

    const response = {
      success: true,
      data: {
        id: route.id,
        routeCode: route.routenumber,
        status: route.status || 'pending',
        date: route.date,
        distance: `${distanceValue.toFixed(1)} mi`,
        duration: route.estimatedduration || '0 min',
        stops: totalStops,
        completedStops,
        progress,
        warehouseName,
        warehouseAddress,
        warehouseLatitude,
        warehouseLongitude,
        stopsList
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[Driver App - Route Detail] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener detalle de ruta'
    }, { status: 500 })
  }
}
