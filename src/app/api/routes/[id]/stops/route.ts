import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// GET: Obtener todas las paradas de una ruta con sus órdenes y comprobantes
// NOTA: Este API es para PRIMERA MILLA (recogida a domicilio)
// Muestra datos del REMITENTE (cliente que envía), no del destinatario
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.id)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (isNaN(routeId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta inválido'
      }, { status: 400 })
    }

    // Obtener la ruta primero
    let routeQuery = 'SELECT * FROM routes WHERE id = $1'
    const routeParams: any[] = [routeId]

    if (!isSuperAdmin && headerCompanyId) {
      routeQuery += ' AND company_id = $2'
      routeParams.push(headerCompanyId)
    }

    const routeResult = await db.query(routeQuery, routeParams)

    if (routeResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ruta no encontrada'
      }, { status: 404 })
    }

    const route = routeResult.rows[0]
    const companyId = route.company_id

    // Parsear waypoints de la ruta
    let waypoints: any[] = []
    try {
      if (route.stops) {
        // Soportar tanto string JSON como array directo
        waypoints = typeof route.stops === 'string'
          ? JSON.parse(route.stops)
          : (Array.isArray(route.stops) ? route.stops : [])
      }
    } catch (e) {
      console.error('Error parsing route stops:', e)
      waypoints = []
    }

    // Obtener todos los order IDs de los waypoints
    // Soporta ambos formatos: orderId (singular) y orderIds (array)
    const orderIds: number[] = []
    for (const wp of waypoints) {
      if (wp.orderId) {
        orderIds.push(wp.orderId)
      } else if (wp.orderIds && Array.isArray(wp.orderIds)) {
        orderIds.push(...wp.orderIds)
      }
    }

    // Eliminar duplicados
    const uniqueOrderIds = [...new Set(orderIds)]

    if (uniqueOrderIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          routeId: route.id,
          routeNumber: route.route_number || route.routenumber,
          status: route.status,
          driverName: route.driver_name || route.drivername,
          vehiclePlate: route.vehicle_plate || route.vehicleplate,
          stops: []
        }
      })
    }

    // Obtener todas las órdenes asociadas
    const orderPlaceholders = uniqueOrderIds.map((_: any, i: number) => `$${i + 1}`).join(',')
    const ordersQuery = `
      SELECT
        id, ordernumber, customername, phone as customerphone, customeraddress,
        firstname, lastname, street, apartment, city, state, country, zipcode,
        latitude, longitude, services, status, order_type,
        office_order_data, customerid,
        createdat as created_at
      FROM package_orders
      WHERE id IN (${orderPlaceholders})
    `
    const ordersResult = await db.query(ordersQuery, uniqueOrderIds)

    // Obtener empaques asignados a las órdenes (por order_number)
    const orderNumbers = ordersResult.rows.map((o: any) => o.ordernumber).filter(Boolean)
    let empaquesMap = new Map()

    if (orderNumbers.length > 0) {
      try {
        const empaqueParams = orderNumbers.map((_: any, i: number) => `$${i + 1}`).join(',')
        // Query simplificada con solo campos básicos que seguro existen
        const empaquesQuery = `
          SELECT
            e.id, e.codigo, e.tipo, e.estado,
            t.orden_numero, t.servicio_nombre
          FROM empaques e
          LEFT JOIN empaques_trazabilidad t ON e.id = t.empaque_id
            AND t.accion LIKE 'asignado%'
          WHERE t.orden_numero IN (${empaqueParams})
        `
        const empaquesResult = await db.query(empaquesQuery, orderNumbers)

        // Agrupar empaques por orden_numero y servicio_nombre
        for (const emp of empaquesResult.rows) {
          const key = `${emp.orden_numero}_${emp.servicio_nombre || 'default'}`
          if (!empaquesMap.has(key)) {
            empaquesMap.set(key, [])
          }
          empaquesMap.get(key).push({
            id: emp.id,
            codigo: emp.codigo,
            tipo: emp.tipo,
            estado: emp.estado
          })
        }
      } catch (e) {
        console.log('Error fetching empaques:', e)
        // La tabla puede no tener todos los campos, continuar sin empaques
      }
    }

    // Crear mapa de órdenes por ID
    const ordersMap = new Map()
    for (const order of ordersResult.rows) {
      // Parsear services si es string
      let services = []
      try {
        services = typeof order.services === 'string'
          ? JSON.parse(order.services)
          : (order.services || [])
      } catch (e) {
        services = []
      }

      // Agregar empaques a cada servicio
      // Nota: services puede ser un array de strings o de objetos
      services = services.map((svc: any, idx: number) => {
        // Si el servicio es un string, convertirlo a objeto
        const serviceObj = typeof svc === 'string'
          ? { name: svc, type: 'service' }
          : svc

        const svcName = serviceObj.name || serviceObj.type || `service_${idx}`
        const empaqueKey = `${order.ordernumber}_${svcName}`
        const defaultKey = `${order.ordernumber}_default`

        return {
          ...serviceObj,
          empaques: empaquesMap.get(empaqueKey) || empaquesMap.get(defaultKey) || []
        }
      })

      // PRIMERA MILLA: Usar datos del REMITENTE (cliente que envía)
      // Los campos directos de package_orders son los del remitente
      const senderName = order.customername || `${order.firstname || ''} ${order.lastname || ''}`.trim() || 'Cliente'
      const senderPhone = order.customerphone || order.phone || ''

      // Construir dirección completa del remitente
      const senderAddress = order.customeraddress ||
        [order.street, order.apartment].filter(Boolean).join(', ') ||
        'Dirección no disponible'

      const senderCity = order.city || ''
      const senderState = order.state || ''
      const senderCountry = order.country || ''
      const senderZipcode = order.zipcode || ''

      ordersMap.set(order.id, {
        ...order,
        services,
        // Datos del REMITENTE (para primera milla)
        sendername: senderName,
        senderphone: senderPhone,
        senderaddress: senderAddress,
        sendercity: senderCity,
        senderstate: senderState,
        sendercountry: senderCountry,
        senderzipcode: senderZipcode,
        customerid: order.customerid,
        deliverytype: order.order_type
      })
    }

    // Obtener comprobantes de entrega para estas órdenes
    const proofsQuery = `
      SELECT
        id, order_id, order_number,
        signature_data IS NOT NULL as has_signature,
        signature_storage_path,
        signer_name, signer_relation,
        photos,
        delivery_latitude, delivery_longitude,
        notes, created_at, created_by_name
      FROM delivery_proofs
      WHERE order_id IN (${orderPlaceholders})
      AND company_id = $${uniqueOrderIds.length + 1}
    `

    let proofsMap = new Map()
    try {
      const proofsResult = await db.query(proofsQuery, [...uniqueOrderIds, companyId])
      for (const proof of proofsResult.rows) {
        let photos = []
        try {
          photos = typeof proof.photos === 'string'
            ? JSON.parse(proof.photos)
            : (proof.photos || [])
        } catch (e) {
          photos = []
        }
        proofsMap.set(proof.order_id, {
          id: proof.id,
          hasSignature: proof.has_signature,
          signerName: proof.signer_name,
          signerRelation: proof.signer_relation,
          photosCount: photos.length,
          photos: photos,
          latitude: proof.delivery_latitude,
          longitude: proof.delivery_longitude,
          notes: proof.notes,
          createdAt: proof.created_at,
          createdByName: proof.created_by_name
        })
      }
    } catch (e) {
      // La tabla puede no existir aún
      console.log('Delivery proofs table may not exist yet:', e)
    }

    // Construir estructura de paradas agrupadas por dirección
    // PRIMERA MILLA: Agrupar por dirección del REMITENTE (cliente que envía)
    const stopsMap = new Map()

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i]

      // Obtener los IDs de órdenes del waypoint (soporta ambos formatos)
      let waypointOrderIds: number[] = []
      if (wp.orderId) {
        waypointOrderIds = [wp.orderId]
      } else if (wp.orderIds && Array.isArray(wp.orderIds)) {
        waypointOrderIds = wp.orderIds
      }

      if (waypointOrderIds.length === 0) continue // Skip warehouse waypoints

      // Procesar cada orden en este waypoint
      for (const orderId of waypointOrderIds) {
        const order = ordersMap.get(orderId)
        if (!order) continue

        // Usar coordenadas del waypoint si la orden no las tiene
        const lat = order.latitude || wp.latitude || wp.lat || 0
        const lng = order.longitude || wp.longitude || wp.lng || 0

        // Usar dirección del REMITENTE como clave de parada (primera milla)
        const stopKey = `${lat}_${lng}`

        if (!stopsMap.has(stopKey)) {
          stopsMap.set(stopKey, {
            stopNumber: stopsMap.size + 1,
            // Dirección del REMITENTE (cliente que envía)
            address: order.senderaddress || wp.address || order.customeraddress || 'Dirección no disponible',
            city: order.sendercity || '',
            state: order.senderstate || '',
            country: order.sendercountry || '',
            zipcode: order.senderzipcode || '',
            coordinates: [parseFloat(lng), parseFloat(lat)],
            orders: [],
            // Guardar el estado del waypoint si existe (del JSON de la ruta)
            waypointStatus: wp.status || null
          })
        }

        const stop = stopsMap.get(stopKey)
        const proof = proofsMap.get(order.id)

        stop.orders.push({
          id: order.id,
          orderNumber: order.ordernumber,
          customerId: order.customerid,
          // Datos del REMITENTE (cliente que envía - para primera milla)
          senderName: order.sendername,
          senderPhone: order.senderphone,
          senderAddress: order.senderaddress,
          senderCity: order.sendercity,
          senderState: order.senderstate,
          senderZipcode: order.senderzipcode,
          // Servicios con empaques
          services: order.services,
          status: order.status,
          deliveryType: order.deliverytype,
          proofStatus: proof ? 'completed' : 'none',
          deliveredAt: proof?.createdAt || null,
          hasProof: !!proof,
          proof: proof || null
        })
      }
    }

    // Determinar estado de cada parada
    // Priorizar el estado guardado en el waypoint (JSON de la ruta) sobre el calculado
    const stops = Array.from(stopsMap.values()).map(stop => {
      const allDelivered = stop.orders.every((o: any) => o.status === 'delivered' || o.status === 'completed' || o.status === 'en_bodega')
      const anyFailed = stop.orders.some((o: any) => o.status === 'failed' || o.status === 'cancelled')
      const allHaveProof = stop.orders.every((o: any) => o.hasProof)
      const anyEnReparto = stop.orders.some((o: any) => o.status === 'en_reparto')

      // Determinar estado final:
      // 1. Si el waypoint tiene estado guardado (de iniciar ruta), usarlo
      // 2. Si no, calcularlo basado en las órdenes
      let finalStatus = stop.waypointStatus

      if (!finalStatus) {
        // Calcular basado en órdenes si no hay estado guardado
        if (allDelivered) {
          finalStatus = 'completada'
        } else if (anyFailed) {
          finalStatus = 'fallida'
        } else if (anyEnReparto) {
          finalStatus = 'en_curso'
        } else {
          finalStatus = 'pendiente'
        }
      }

      // Limpiar el campo temporal waypointStatus antes de retornar
      const { waypointStatus, ...stopWithoutWaypointStatus } = stop

      return {
        ...stopWithoutWaypointStatus,
        status: finalStatus,
        proofComplete: allHaveProof
      }
    })

    // Calcular estado sugerido de la ruta basado en las paradas
    const totalStops = stops.length
    // Considerar tanto estados nuevos (español) como legacy (inglés)
    const completedStops = stops.filter(s => s.status === 'delivered' || s.status === 'completada').length
    const failedStops = stops.filter(s => s.status === 'failed' || s.status === 'fallida').length
    const pendingStops = stops.filter(s => s.status === 'pending' || s.status === 'pendiente').length
    const enCursoStops = stops.filter(s => s.status === 'en_curso').length

    // Determinar estado calculado de la ruta:
    // - Si todas las paradas están completadas -> completada
    // - Si hay al menos una parada en curso o completada -> en_curso
    // - Si todas están pendientes -> depende del estado actual
    let calculatedRouteStatus = route.status
    if (totalStops > 0) {
      if (completedStops === totalStops) {
        calculatedRouteStatus = 'completada'
      } else if (completedStops > 0 || enCursoStops > 0 || route.status === 'active' || route.status === 'en_curso') {
        calculatedRouteStatus = 'en_curso'
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        routeId: route.id,
        routeNumber: route.route_number || route.routenumber,
        status: route.status,
        calculatedStatus: calculatedRouteStatus,
        driverName: route.driver_name || route.drivername,
        driverId: route.driver_id || route.driverid,
        vehiclePlate: route.vehicle_plate || route.vehicleplate,
        vehicleId: route.vehicle_id || route.vehicleid,
        totalDistance: route.distance,
        totalDuration: route.duration,
        scheduledDate: route.scheduled_date || route.scheduleddate,
        stops,
        // Resumen de paradas
        stopsSummary: {
          total: totalStops,
          completed: completedStops,
          pending: pendingStops,
          failed: failedStops,
          enCurso: enCursoStops
        }
      }
    })

  } catch (error) {
    console.error('Error getting route stops:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener paradas de la ruta'
    }, { status: 500 })
  }
}
