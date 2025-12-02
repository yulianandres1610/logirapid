import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/routes/[code]
 *
 * Obtiene el detalle completo de una ruta para la app móvil del driver.
 * Incluye: información de ruta, vehículo, almacén, paradas y órdenes.
 *
 * @authentication Requiere cookie auth-token
 * @param code - Código de la ruta (routenumber)
 * @returns Detalle completo de la ruta con paradas y órdenes
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

    // 2. Obtener información del almacén
    let warehouse = null
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
        warehouse = {
          id: w.id,
          name: w.name,
          address: `${w.address}, ${w.city}, ${w.state} ${w.zip_code}`,
          coordinates: {
            latitude: parseFloat(w.latitude) || 0,
            longitude: parseFloat(w.longitude) || 0
          }
        }
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
      timeslot: string
      services: string
      proof_image_url: string
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
          longitude,
          timeslot,
          services,
          proof_image_url
        FROM package_orders
        WHERE id = ANY($1)`,
        [allOrderIds]
      )

      ordersQuery.rows.forEach(order => {
        ordersMap[order.id] = order
      })
    }

    // 6. Construir array de paradas con órdenes
    const stops = stopsData.map((stop, index) => {
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

      // Construir dirección
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
      const latitude = stop.latitude || firstOrder?.latitude || 0
      const longitude = stop.longitude || firstOrder?.longitude || 0

      // Contar órdenes completadas
      const completedOrders = stopOrders.filter(
        o => o.status === 'delivered' || o.status === 'completed'
      ).length

      return {
        stopNumber: stop.stopNumber || index + 1,
        status: finalStatus,
        address: {
          full: fullAddress,
          street: street,
          apartment: apartment || null,
          city: city,
          state: state,
          zipcode: zipcode,
          country: 'US'
        },
        zone: city && zipcode ? `${city} / ${zipcode}` : city || zipcode || 'Sin zona',
        coordinates: {
          latitude: parseFloat(String(latitude)) || 0,
          longitude: parseFloat(String(longitude)) || 0
        },
        orders: stopOrders.map(order => {
          // Parsear servicios
          let services: Array<{ name: string; quantity: number }> = []
          if (order.services) {
            try {
              const parsed = typeof order.services === 'string'
                ? JSON.parse(order.services)
                : order.services
              if (Array.isArray(parsed)) {
                services = parsed.map((s: { name?: string; type?: string; quantity?: number }) => ({
                  name: s.name || s.type || 'Servicio',
                  quantity: s.quantity || 1
                }))
              }
            } catch {
              services = []
            }
          }

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
            customerPhone: order.phone || null,
            services,
            timeSlot: order.timeslot || null,
            hasProof: !!order.proof_image_url
          }
        }),
        totalOrders: stopOrders.length,
        completedOrders
      }
    })

    // 7. Calcular resumen
    const totalStops = stops.length
    const completedStops = stops.filter(s => s.status === 'completed').length
    const pendingStops = stops.filter(s => s.status === 'pending' || s.status === 'in_progress').length
    const failedStops = stops.filter(s => s.status === 'failed').length
    const totalOrders = stops.reduce((sum, s) => sum + s.totalOrders, 0)
    const completedOrders = stops.reduce((sum, s) => sum + s.completedOrders, 0)
    const percentage = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0

    // 8. Formatear respuesta
    const response = {
      success: true,
      data: {
        route: {
          id: route.id,
          routeCode: route.routenumber,
          status: route.status || 'pending',
          date: route.date,
          distance: {
            value: parseFloat(route.distance) || 0,
            unit: 'mi',
            formatted: `${(parseFloat(route.distance) || 0).toFixed(1)} mi`
          },
          duration: {
            value: route.estimatedduration || '0 min',
            formatted: route.estimatedduration || '0 min'
          },
          vehicle: route.vehicleid ? {
            id: route.vehicleid,
            plate: route.vehicleplate || 'Sin placa',
            type: null // Se podría obtener de la tabla vehicles si existe
          } : null,
          driver: route.driverid ? {
            id: route.driverid,
            name: route.drivername || 'Sin nombre'
          } : null,
          warehouse,
          summary: {
            totalStops,
            completedStops,
            pendingStops,
            failedStops,
            totalOrders,
            completedOrders,
            percentage
          }
        },
        stops
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
