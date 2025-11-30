import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import jwt from 'jsonwebtoken'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/routes
 * Obtener las rutas asignadas al usuario logueado
 *
 * Query Params:
 * - userId: (opcional) ID del usuario. Si no se especifica, usa el usuario del token
 * - status: (opcional) Filtrar por estado de ruta (active, completed, cancelled, all)
 * - page: (opcional) Número de página para paginación
 * - limit: (opcional) Cantidad de resultados por página
 *
 * Roles permitidos: Cualquier usuario autenticado puede ver sus propias rutas
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener usuario del token o headers (inyectados por middleware)
    const token = request.cookies.get('auth-token')?.value

    // Intentar obtener de headers primero (inyectados por middleware)
    let tokenUserId: number | undefined = parseInt(request.headers.get('x-user-id') || '')
    let userRole: string | undefined = request.headers.get('x-user-role') || undefined

    // Si no hay headers válidos, decodificar JWT
    if (!tokenUserId || isNaN(tokenUserId) || !userRole) {
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'No autenticado' },
          { status: 401 }
        )
      }

      // Decodificar JWT token
      try {
        const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const decoded = jwt.verify(token, jwtSecret) as any
        tokenUserId = decoded.userId
        userRole = decoded.role
      } catch (error) {
        console.error('[driver-app/routes] JWT decode error:', error)
        return NextResponse.json(
          { success: false, error: 'Token inválido' },
          { status: 401 }
        )
      }
    }

    if (!tokenUserId || !userRole) {
      return NextResponse.json(
        { success: false, error: 'No se pudo obtener información del usuario' },
        { status: 401 }
      )
    }

    // Obtener userId de query params o usar el del token
    const { searchParams } = new URL(request.url)
    const queryUserId = searchParams.get('userId')

    // Si se especifica un userId diferente, solo ADMIN/SUPER_ADMIN/MANAGER pueden ver rutas de otros
    let userId = tokenUserId
    if (queryUserId) {
      const requestedUserId = parseInt(queryUserId)
      if (requestedUserId !== tokenUserId) {
        const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'MANAGER']
        if (!adminRoles.includes(userRole)) {
          return NextResponse.json(
            { success: false, error: 'No tienes permisos para ver rutas de otros usuarios' },
            { status: 403 }
          )
        }
      }
      userId = requestedUserId
    }

    // Obtener otros parámetros de query
    // Status puede ser: all, active (incluye asignada, en_curso, activa), completed (completada), cancelled (cancelada)
    const status = searchParams.get('status') || 'active'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Construir query base con JOIN a warehouses para obtener origen
    let query = `
      SELECT
        r.id,
        r.routenumber as "routeNumber",
        r.qrcode as "qrCode",
        r.status,
        r.distance,
        r.estimatedduration as "estimatedDuration",
        r.date as "scheduledDate",
        r.vehicleplate as "vehiclePlate",
        r.vehicleid as "vehicleId",
        r.stops,
        r.createdat as "createdAt",
        r.company_id as "companyId",
        r.warehouseid as "warehouseId",
        r.totalpackages as "totalPackages",
        r.deliveredpackages as "deliveredPackages",
        r.starttime as "startTime",
        r.endtime as "endTime",
        r.actualduration as "actualDuration",
        w.name as "warehouseName",
        w.address as "warehouseAddress",
        w.city as "warehouseCity",
        w.state as "warehouseState",
        w.latitude as "warehouseLatitude",
        w.longitude as "warehouseLongitude"
      FROM routes r
      LEFT JOIN warehouses w ON r.warehouseid::integer = w.id
      WHERE r.driverid = $1
    `
    const params: any[] = [userId]
    let paramIndex = 2

    // Filtrar por estado
    // 'active' incluye rutas asignadas, en curso, activas (todas las que el driver puede trabajar)
    // 'completed' incluye rutas completadas
    // 'cancelled' incluye rutas canceladas
    // 'all' no filtra por estado
    if (status === 'active') {
      query += ` AND r.status IN ('asignada', 'en_curso', 'activa', 'active', 'planning')`
    } else if (status === 'completed') {
      query += ` AND r.status IN ('completada', 'completed')`
    } else if (status === 'cancelled') {
      query += ` AND r.status IN ('cancelada', 'cancelled')`
    } else if (status !== 'all') {
      // Si se pasa un status específico, filtrar exactamente por ese
      query += ` AND r.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    // Ordenar por fecha programada desc
    query += ` ORDER BY r.date DESC, r.createdat DESC`

    // Agregar paginación
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const routesResult = await db.query(query, params)

    // Obtener todos los IDs de órdenes de todas las rutas para hacer una sola consulta
    const allOrderIds: number[] = []
    routesResult.rows.forEach((route: any) => {
      let stops: any[] = []
      try {
        stops = typeof route.stops === 'string'
          ? JSON.parse(route.stops)
          : (Array.isArray(route.stops) ? route.stops : [])
      } catch {
        stops = []
      }
      stops.forEach((stop: any) => {
        if (stop.orderIds) {
          allOrderIds.push(...stop.orderIds)
        } else if (stop.orderId) {
          allOrderIds.push(stop.orderId)
        }
      })
    })

    // Consultar todas las órdenes de una vez
    let ordersMap: Map<number, any> = new Map()
    if (allOrderIds.length > 0) {
      const uniqueOrderIds = [...new Set(allOrderIds)]
      const ordersResult = await db.query(`
        SELECT
          id,
          ordernumber as "orderNumber",
          customerid as "customerId",
          customername as "customerName",
          customeraddress as "customerAddress",
          firstname as "firstName",
          lastname as "lastName",
          phone,
          email,
          street,
          apartment,
          city,
          state,
          zipcode as "zipCode",
          country,
          latitude,
          longitude,
          status,
          order_type as "orderType",
          services,
          notes,
          customernotes as "customerNotes",
          scheduleddate as "scheduledDate",
          timeslot as "timeSlot",
          boxcount as "boxCount",
          boxes,
          boxes_delivered as "boxesDelivered",
          boxes_returned as "boxesReturned",
          pending_return as "pendingReturn",
          return_status as "returnStatus",
          proof_status as "proofStatus",
          delivered_at as "deliveredAt",
          office_order_data as "officeOrderData"
        FROM package_orders
        WHERE id = ANY($1)
      `, [uniqueOrderIds])

      ordersResult.rows.forEach((order: any) => {
        ordersMap.set(order.id, order)
      })
    }

    // Contar total para paginación
    let countQuery = `
      SELECT COUNT(*) as total
      FROM routes r
      WHERE r.driverid = $1
    `
    const countParams: any[] = [userId]

    // Usar el mismo criterio de filtro para el conteo
    if (status === 'active') {
      countQuery += ` AND r.status IN ('asignada', 'en_curso', 'activa', 'active', 'planning')`
    } else if (status === 'completed') {
      countQuery += ` AND r.status IN ('completada', 'completed')`
    } else if (status === 'cancelled') {
      countQuery += ` AND r.status IN ('cancelada', 'cancelled')`
    } else if (status !== 'all') {
      countQuery += ` AND r.status = $2`
      countParams.push(status)
    }

    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Procesar rutas para calcular paradas completadas y extraer origen/destino
    const routes = routesResult.rows.map((route: any) => {
      // Parsear stops
      let stops: any[] = []
      try {
        stops = typeof route.stops === 'string'
          ? JSON.parse(route.stops)
          : (Array.isArray(route.stops) ? route.stops : [])
      } catch {
        stops = []
      }

      // Contar paradas (excluyendo warehouse waypoints)
      const orderStops = stops.filter((s: any) => s.orderId || s.orderIds)
      const totalStops = orderStops.length

      // Calcular paradas completadas basado en status de órdenes
      let completedStops = 0
      let pendingStops = 0
      let failedStops = 0

      orderStops.forEach((stop: any) => {
        if (stop.status === 'delivered' || stop.status === 'completed' || stop.status === 'entregado') {
          completedStops++
        } else if (stop.status === 'failed' || stop.status === 'cancelled' || stop.status === 'fallido') {
          failedStops++
        } else {
          pendingStops++
        }
      })

      // Construir información de origen (warehouse)
      const origin = route.warehouseName ? {
        name: route.warehouseName,
        address: route.warehouseAddress,
        city: route.warehouseCity,
        state: route.warehouseState,
        fullAddress: `${route.warehouseAddress || ''}, ${route.warehouseCity || ''}, ${route.warehouseState || ''}`.replace(/^,\s*|,\s*$/g, '').trim(),
        coordinates: route.warehouseLatitude && route.warehouseLongitude ? {
          latitude: parseFloat(route.warehouseLatitude),
          longitude: parseFloat(route.warehouseLongitude)
        } : null
      } : null

      // Obtener información del destino (última parada con órdenes)
      const lastOrderStop = orderStops.length > 0 ? orderStops[orderStops.length - 1] : null
      const destination = lastOrderStop ? {
        address: lastOrderStop.address || 'Dirección no disponible',
        coordinates: lastOrderStop.latitude && lastOrderStop.longitude ? {
          latitude: parseFloat(lastOrderStop.latitude),
          longitude: parseFloat(lastOrderStop.longitude)
        } : (lastOrderStop.coordinates ? {
          longitude: lastOrderStop.coordinates[0],
          latitude: lastOrderStop.coordinates[1]
        } : null),
        orderNumbers: lastOrderStop.orderNumbers || (lastOrderStop.orderId ? [lastOrderStop.orderId] : [])
      } : null

      // Parsear distancia y duración
      const distanceValue = parseFloat(route.distance) || 0
      const durationStr = route.estimatedDuration || '0 min'

      // Extraer minutos de la duración (formato: "43 min" o "1 hr 20 min")
      let durationMinutes = 0
      if (durationStr) {
        const hrMatch = durationStr.match(/(\d+)\s*hr/)
        const minMatch = durationStr.match(/(\d+)\s*min/)
        if (hrMatch) durationMinutes += parseInt(hrMatch[1]) * 60
        if (minMatch) durationMinutes += parseInt(minMatch[1])
      }

      return {
        id: route.id,
        routeCode: route.routeNumber, // Código de la ruta
        routeNumber: route.routeNumber,
        qrCode: route.qrCode,
        status: route.status,

        // Información de paradas
        totalStops,
        completedStops,
        pendingStops,
        failedStops,

        // Información de distancia y tiempo
        distance: {
          value: distanceValue,
          unit: 'miles',
          formatted: `${distanceValue.toFixed(2)} mi`
        },
        estimatedDuration: {
          minutes: durationMinutes,
          formatted: durationStr
        },
        actualDuration: route.actualDuration,

        // Origen y destino
        origin,
        destination,

        // Información del vehículo
        vehiclePlate: route.vehiclePlate,
        vehicleId: route.vehicleId,

        // Paquetes totales
        totalPackages: route.totalPackages || totalStops,
        deliveredPackages: route.deliveredPackages || completedStops,

        // Fechas y tiempos
        scheduledDate: route.scheduledDate,
        startTime: route.startTime,
        endTime: route.endTime,
        createdAt: route.createdAt,

        // Array de paradas con detalles completos para navegación y gestión
        stops: orderStops.map((stop: any, index: number) => {
          // Obtener los IDs de órdenes de esta parada
          const stopOrderIds: number[] = stop.orderIds || (stop.orderId ? [stop.orderId] : [])

          // Obtener información completa de cada orden
          const orders = stopOrderIds.map((orderId: number) => {
            const order = ordersMap.get(orderId)
            if (!order) {
              return {
                id: orderId,
                orderNumber: stop.orderNumbers?.find((on: string) => on.includes(String(orderId))) || `ORD-${orderId}`,
                status: 'unknown'
              }
            }

            // Extraer información del receptor desde office_order_data si existe
            const officeData = order.officeOrderData || {}
            const receiverInfo = officeData.receiverName ? {
              name: officeData.receiverName,
              phone: officeData.receiverPhone,
              address: officeData.destination?.fullAddress || officeData.destination?.street
            } : null

            return {
              id: order.id,
              orderNumber: order.orderNumber,
              status: order.status,
              orderType: order.orderType || 'delivery',

              // Información del cliente/remitente
              customer: {
                id: order.customerId,
                name: order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim(),
                firstName: order.firstName,
                lastName: order.lastName,
                phone: order.phone || officeData.senderPhone,
                email: order.email || officeData.senderEmail
              },

              // Dirección de la parada
              address: {
                full: order.customerAddress,
                street: order.street,
                apartment: order.apartment,
                city: order.city,
                state: order.state,
                zipCode: order.zipCode,
                country: order.country,
                coordinates: order.latitude && order.longitude ? {
                  latitude: parseFloat(order.latitude),
                  longitude: parseFloat(order.longitude)
                } : null
              },

              // Información del receptor (para envíos)
              receiver: receiverInfo,

              // Información de entrega
              delivery: {
                scheduledDate: order.scheduledDate,
                timeSlot: order.timeSlot,
                notes: order.notes,
                customerNotes: order.customerNotes
              },

              // Información de cajas/paquetes
              packages: {
                boxCount: order.boxCount || 0,
                boxes: order.boxes || [],
                boxesDelivered: order.boxesDelivered || 0,
                boxesReturned: order.boxesReturned || 0,
                pendingReturn: order.pendingReturn || false,
                returnStatus: order.returnStatus || 'none'
              },

              // Servicios
              services: order.services || [],

              // Estado de prueba de entrega
              proofStatus: order.proofStatus || 'none',
              deliveredAt: order.deliveredAt
            }
          })

          // Calcular el estado de la parada basado en las órdenes
          const allDelivered = orders.every((o: any) => ['delivered', 'completada', 'entregado', 'completed'].includes(o.status))
          const anyFailed = orders.some((o: any) => ['failed', 'fallido', 'cancelled', 'cancelada'].includes(o.status))
          const computedStopStatus = allDelivered ? 'completed' : (anyFailed ? 'partial' : 'pending')

          return {
            stopNumber: index + 1,
            sequence: stop.sequence || index + 1,
            status: stop.status || computedStopStatus,

            // Dirección de la parada
            address: stop.address || orders[0]?.address?.full || 'Dirección no disponible',
            coordinates: stop.latitude && stop.longitude ? {
              latitude: parseFloat(stop.latitude),
              longitude: parseFloat(stop.longitude)
            } : (stop.coordinates ? {
              latitude: stop.coordinates[1],
              longitude: stop.coordinates[0]
            } : orders[0]?.address?.coordinates || null),

            // Tipo de parada
            type: stop.type || orders[0]?.orderType || 'delivery',
            timeSlot: stop.timeSlot || orders[0]?.delivery?.timeSlot,

            // Resumen de órdenes
            totalOrders: orders.length,
            completedOrders: orders.filter((o: any) => ['delivered', 'completada', 'entregado', 'completed'].includes(o.status)).length,
            pendingOrders: orders.filter((o: any) => !['delivered', 'completada', 'entregado', 'completed', 'failed', 'fallido', 'cancelled', 'cancelada'].includes(o.status)).length,
            failedOrders: orders.filter((o: any) => ['failed', 'fallido', 'cancelled', 'cancelada'].includes(o.status)).length,

            // Lista de números de orden
            orderNumbers: orders.map((o: any) => o.orderNumber),

            // Detalle completo de cada orden en esta parada
            orders
          }
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        routes
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error getting user routes:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener rutas del usuario' },
      { status: 500 }
    )
  }
}
