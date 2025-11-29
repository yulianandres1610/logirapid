import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/routes/[code]/stops
 * Obtener las paradas de una ruta usando el código QR o routeNumber
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // Obtener usuario del token
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Decodificar token
    let userId: number
    let userRole: string
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [id, , role] = decoded.split(':')
      userId = parseInt(id)
      userRole = role
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Verificar rol DRIVER
    if (userRole !== 'DRIVER') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo drivers pueden acceder.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const routeCode = decodeURIComponent(resolvedParams.code)

    // Buscar ruta por código QR o route_number
    const routeQuery = `
      SELECT
        r.id,
        r.route_number as "routeNumber",
        r.qr_code as "qrCode",
        r.status,
        r.driver_id as "driverId",
        r.driver_name as "driverName",
        r.company_id as "companyId",
        r.stops,
        r.distance,
        r.duration,
        r.scheduled_date as "scheduledDate",
        r.vehicle_plate as "vehiclePlate",
        r.vehicle_id as "vehicleId"
      FROM routes r
      WHERE r.qr_code = $1 OR r.route_number = $1
    `
    const routeResult = await db.query(routeQuery, [routeCode])

    if (routeResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ruta no encontrada' },
        { status: 404 }
      )
    }

    const route = routeResult.rows[0]

    // Verificar que el driver está asignado a la ruta
    if (route.driverId && route.driverId !== userId) {
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para ver esta ruta' },
        { status: 403 }
      )
    }

    // Parsear waypoints de la ruta
    let waypoints: any[] = []
    try {
      waypoints = typeof route.stops === 'string'
        ? JSON.parse(route.stops)
        : (Array.isArray(route.stops) ? route.stops : [])
    } catch {
      waypoints = []
    }

    // Obtener todos los order IDs de los waypoints
    const orderIds: number[] = []
    for (const wp of waypoints) {
      if (wp.orderId) {
        orderIds.push(wp.orderId)
      } else if (wp.orderIds && Array.isArray(wp.orderIds)) {
        orderIds.push(...wp.orderIds)
      }
    }

    const uniqueOrderIds = [...new Set(orderIds)]

    if (uniqueOrderIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          routeId: route.id,
          routeNumber: route.routeNumber,
          qrCode: route.qrCode,
          status: route.status,
          driverName: route.driverName,
          vehiclePlate: route.vehiclePlate,
          distance: route.distance,
          duration: route.duration,
          scheduledDate: route.scheduledDate,
          stops: [],
          stopsSummary: {
            total: 0,
            completed: 0,
            pending: 0,
            failed: 0
          }
        }
      })
    }

    // Obtener todas las órdenes asociadas
    const orderPlaceholders = uniqueOrderIds.map((_, i) => `$${i + 1}`).join(',')
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

    // Obtener empaques asignados a las órdenes
    const orderNumbers = ordersResult.rows.map((o: any) => o.ordernumber).filter(Boolean)
    const empaquesMap = new Map()

    if (orderNumbers.length > 0) {
      try {
        const empaqueParams = orderNumbers.map((_: any, i: number) => `$${i + 1}`).join(',')
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
      }
    }

    // Crear mapa de órdenes por ID
    const ordersMap = new Map()
    for (const order of ordersResult.rows) {
      let services = []
      try {
        services = typeof order.services === 'string'
          ? JSON.parse(order.services)
          : (order.services || [])
      } catch {
        services = []
      }

      // Agregar empaques a cada servicio
      services = services.map((svc: any, idx: number) => {
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

      // PRIMERA MILLA: Usar datos del REMITENTE
      const senderName = order.customername || `${order.firstname || ''} ${order.lastname || ''}`.trim() || 'Cliente'
      const senderPhone = order.customerphone || order.phone || ''
      const senderAddress = order.customeraddress ||
        [order.street, order.apartment].filter(Boolean).join(', ') ||
        'Dirección no disponible'

      ordersMap.set(order.id, {
        ...order,
        services,
        sendername: senderName,
        senderphone: senderPhone,
        senderaddress: senderAddress,
        sendercity: order.city || '',
        senderstate: order.state || '',
        sendercountry: order.country || '',
        senderzipcode: order.zipcode || '',
        customerid: order.customerid,
        deliverytype: order.order_type
      })
    }

    // Obtener comprobantes de entrega
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

    const proofsMap = new Map()
    try {
      const proofsResult = await db.query(proofsQuery, [...uniqueOrderIds, route.companyId])
      for (const proof of proofsResult.rows) {
        let photos = []
        try {
          photos = typeof proof.photos === 'string'
            ? JSON.parse(proof.photos)
            : (proof.photos || [])
        } catch {
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
      console.log('Delivery proofs table may not exist yet:', e)
    }

    // Construir estructura de paradas
    const stopsMap = new Map()
    let stopCounter = 0

    for (const wp of waypoints) {
      let waypointOrderIds: number[] = []
      if (wp.orderId) {
        waypointOrderIds = [wp.orderId]
      } else if (wp.orderIds && Array.isArray(wp.orderIds)) {
        waypointOrderIds = wp.orderIds
      }

      if (waypointOrderIds.length === 0) continue // Skip warehouse waypoints

      for (const orderId of waypointOrderIds) {
        const order = ordersMap.get(orderId)
        if (!order) continue

        const lat = order.latitude || wp.latitude || wp.lat || 0
        const lng = order.longitude || wp.longitude || wp.lng || 0
        const stopKey = `${lat}_${lng}`

        if (!stopsMap.has(stopKey)) {
          stopCounter++
          stopsMap.set(stopKey, {
            stopNumber: stopCounter,
            address: order.senderaddress || wp.address || 'Dirección no disponible',
            city: order.sendercity || '',
            state: order.senderstate || '',
            country: order.sendercountry || '',
            zipcode: order.senderzipcode || '',
            coordinates: [parseFloat(lng), parseFloat(lat)],
            orders: []
          })
        }

        const stop = stopsMap.get(stopKey)
        const proof = proofsMap.get(order.id)

        stop.orders.push({
          id: order.id,
          orderNumber: order.ordernumber,
          customerId: order.customerid,
          senderName: order.sendername,
          senderPhone: order.senderphone,
          senderAddress: order.senderaddress,
          senderCity: order.sendercity,
          senderState: order.senderstate,
          senderZipcode: order.senderzipcode,
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
    const stops = Array.from(stopsMap.values()).map(stop => {
      const allDelivered = stop.orders.every((o: any) => o.status === 'delivered' || o.status === 'completed')
      const anyFailed = stop.orders.some((o: any) => o.status === 'failed' || o.status === 'cancelled')
      const allHaveProof = stop.orders.every((o: any) => o.hasProof)

      return {
        ...stop,
        status: allDelivered ? 'delivered' : (anyFailed ? 'failed' : 'pending'),
        proofComplete: allHaveProof
      }
    })

    // Calcular resumen
    const totalStops = stops.length
    const completedStops = stops.filter(s => s.status === 'delivered').length
    const failedStops = stops.filter(s => s.status === 'failed').length
    const pendingStops = stops.filter(s => s.status === 'pending').length

    return NextResponse.json({
      success: true,
      data: {
        routeId: route.id,
        routeNumber: route.routeNumber,
        qrCode: route.qrCode,
        status: route.status,
        driverName: route.driverName,
        driverId: route.driverId,
        vehiclePlate: route.vehiclePlate,
        vehicleId: route.vehicleId,
        distance: route.distance,
        duration: route.duration,
        scheduledDate: route.scheduledDate,
        stops,
        stopsSummary: {
          total: totalStops,
          completed: completedStops,
          pending: pendingStops,
          failed: failedStops
        }
      }
    })

  } catch (error) {
    console.error('Error getting route stops:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener paradas de la ruta' },
      { status: 500 }
    )
  }
}
