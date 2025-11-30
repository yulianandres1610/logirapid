import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import jwt from 'jsonwebtoken'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

// Helper para autenticación JWT
async function authenticateRequest(request: NextRequest): Promise<{ userId: number; userRole: string; userName: string } | null> {
  const token = request.cookies.get('auth-token')?.value

  // Intentar obtener de headers primero (inyectados por middleware)
  let tokenUserId: number | undefined = parseInt(request.headers.get('x-user-id') || '')
  let userRole: string | undefined = request.headers.get('x-user-role') || undefined
  let userName: string = request.headers.get('x-user-email') || ''

  // Si no hay headers válidos, decodificar JWT
  if (!tokenUserId || isNaN(tokenUserId) || !userRole) {
    if (!token) return null

    try {
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      const decoded = jwt.verify(token, jwtSecret) as any
      tokenUserId = decoded.userId
      userRole = decoded.role
      userName = decoded.email || ''
    } catch {
      return null
    }
  }

  if (!tokenUserId || !userRole) return null

  return { userId: tokenUserId, userRole, userName }
}

/**
 * GET /api/driver-app/stops/[routeId]/[stopNumber]
 * Obtener información completa de una parada específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string; stopNumber: string }> }
) {
  try {
    // Autenticar usuario
    const auth = await authenticateRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const { userId, userRole } = auth

    // Solo DRIVER y roles admin pueden acceder
    const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'MANAGER']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.routeId)
    const stopNumber = parseInt(resolvedParams.stopNumber)

    if (isNaN(routeId) || isNaN(stopNumber)) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos' },
        { status: 400 }
      )
    }

    // Obtener la ruta
    const routeQuery = `
      SELECT
        r.id,
        r.routenumber as "routeNumber",
        r.status,
        r.driverid as "driverId",
        r.company_id as "companyId",
        r.stops
      FROM routes r
      WHERE r.id = $1
    `
    const routeResult = await db.query(routeQuery, [routeId])

    if (routeResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ruta no encontrada' },
        { status: 404 }
      )
    }

    const route = routeResult.rows[0]

    // Verificar que el driver está asignado a la ruta (solo para DRIVER)
    if (userRole === 'DRIVER' && route.driverId && route.driverId !== userId) {
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para ver esta parada' },
        { status: 403 }
      )
    }

    // Parsear waypoints
    let waypoints: any[] = []
    try {
      waypoints = typeof route.stops === 'string'
        ? JSON.parse(route.stops)
        : (Array.isArray(route.stops) ? route.stops : [])
    } catch {
      waypoints = []
    }

    // Obtener todos los order IDs
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
      return NextResponse.json(
        { success: false, error: 'No hay paradas en esta ruta' },
        { status: 404 }
      )
    }

    // Obtener órdenes
    const orderPlaceholders = uniqueOrderIds.map((_, i) => `$${i + 1}`).join(',')
    const ordersQuery = `
      SELECT
        id, ordernumber, customername, phone as customerphone, customeraddress,
        firstname, lastname, street, apartment, city, state, country, zipcode,
        latitude, longitude, services, status, order_type, customerid
      FROM package_orders
      WHERE id IN (${orderPlaceholders})
    `
    const ordersResult = await db.query(ordersQuery, uniqueOrderIds)

    // Crear mapa de órdenes
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

      const senderName = order.customername || `${order.firstname || ''} ${order.lastname || ''}`.trim() || 'Cliente'
      const senderPhone = order.customerphone || ''
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
        senderzipcode: order.zipcode || ''
      })
    }

    // Construir paradas y encontrar la solicitada
    const stopsMap = new Map()
    let stopCounter = 0

    for (const wp of waypoints) {
      let waypointOrderIds: number[] = []
      if (wp.orderId) {
        waypointOrderIds = [wp.orderId]
      } else if (wp.orderIds && Array.isArray(wp.orderIds)) {
        waypointOrderIds = wp.orderIds
      }

      if (waypointOrderIds.length === 0) continue

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
            zipcode: order.senderzipcode || '',
            coordinates: [parseFloat(lng), parseFloat(lat)],
            orderIds: []
          })
        }

        stopsMap.get(stopKey).orderIds.push(order.id)
      }
    }

    // Encontrar la parada solicitada
    const stop = Array.from(stopsMap.values()).find(s => s.stopNumber === stopNumber)

    if (!stop) {
      return NextResponse.json(
        { success: false, error: `Parada ${stopNumber} no encontrada en esta ruta` },
        { status: 404 }
      )
    }

    // Obtener empaques para las órdenes de esta parada
    const stopOrderNumbers = stop.orderIds
      .map((id: number) => ordersMap.get(id)?.ordernumber)
      .filter(Boolean)

    const empaquesMap = new Map()
    if (stopOrderNumbers.length > 0) {
      try {
        const empaqueParams = stopOrderNumbers.map((_: any, i: number) => `$${i + 1}`).join(',')
        const empaquesQuery = `
          SELECT
            e.id, e.codigo, e.tipo, e.estado,
            t.orden_numero, t.servicio_nombre
          FROM empaques e
          LEFT JOIN empaques_trazabilidad t ON e.id = t.empaque_id
            AND t.accion LIKE 'asignado%'
          WHERE t.orden_numero IN (${empaqueParams})
        `
        const empaquesResult = await db.query(empaquesQuery, stopOrderNumbers)

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

    // Obtener delivery proofs para las órdenes de esta parada
    const proofsMap = new Map()
    if (stop.orderIds.length > 0) {
      try {
        const proofPlaceholders = stop.orderIds.map((_: any, i: number) => `$${i + 1}`).join(',')
        const proofsQuery = `
          SELECT
            id, order_id, order_number,
            signature_data,
            signature_storage_path,
            signer_name, signer_relation,
            photos,
            delivery_latitude, delivery_longitude,
            notes, created_at, created_by_name
          FROM delivery_proofs
          WHERE order_id IN (${proofPlaceholders})
          AND company_id = $${stop.orderIds.length + 1}
        `
        const proofsResult = await db.query(proofsQuery, [...stop.orderIds, route.companyId])

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
            hasSignature: !!proof.signature_data || !!proof.signature_storage_path,
            signatureData: proof.signature_data,
            signatureStoragePath: proof.signature_storage_path,
            signerName: proof.signer_name,
            signerRelation: proof.signer_relation,
            photos,
            latitude: proof.delivery_latitude,
            longitude: proof.delivery_longitude,
            notes: proof.notes,
            createdAt: proof.created_at,
            createdByName: proof.created_by_name
          })
        }
      } catch (e) {
        console.log('Error fetching proofs:', e)
      }
    }

    // Construir órdenes con toda la información
    const orders = stop.orderIds.map((orderId: number) => {
      const order = ordersMap.get(orderId)
      if (!order) return null

      // Agregar empaques a servicios
      const servicesWithEmpaques = order.services.map((svc: any, idx: number) => {
        const serviceObj = typeof svc === 'string' ? { name: svc } : svc
        const svcName = serviceObj.name || serviceObj.type || `service_${idx}`
        const empaqueKey = `${order.ordernumber}_${svcName}`
        const defaultKey = `${order.ordernumber}_default`

        return {
          ...serviceObj,
          empaques: empaquesMap.get(empaqueKey) || empaquesMap.get(defaultKey) || []
        }
      })

      const proof = proofsMap.get(orderId)

      return {
        id: order.id,
        orderNumber: order.ordernumber,
        customerId: order.customerid,
        senderName: order.sendername,
        senderPhone: order.senderphone,
        senderAddress: order.senderaddress,
        senderCity: order.sendercity,
        senderState: order.senderstate,
        senderZipcode: order.senderzipcode,
        services: servicesWithEmpaques,
        status: order.status,
        deliveryType: order.order_type,
        hasProof: !!proof,
        proof: proof || null
      }
    }).filter(Boolean)

    // Determinar estado de la parada
    const allDelivered = orders.every((o: any) => o.status === 'delivered' || o.status === 'completed')
    const anyFailed = orders.some((o: any) => o.status === 'failed' || o.status === 'cancelled')
    const allHaveProof = orders.every((o: any) => o.hasProof)

    return NextResponse.json({
      success: true,
      data: {
        routeId: route.id,
        routeNumber: route.routeNumber,
        stopNumber: stop.stopNumber,
        address: stop.address,
        city: stop.city,
        state: stop.state,
        zipcode: stop.zipcode,
        coordinates: stop.coordinates,
        status: allDelivered ? 'delivered' : (anyFailed ? 'failed' : 'pending'),
        proofComplete: allHaveProof,
        orders
      }
    })

  } catch (error) {
    console.error('Error getting stop info:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener información de la parada' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/driver-app/stops/[routeId]/[stopNumber]
 * Actualizar información de una parada (firma, fotos, coordenadas)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string; stopNumber: string }> }
) {
  try {
    // Autenticar usuario
    const auth = await authenticateRequest(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const { userId, userRole, userName } = auth

    // Solo DRIVER y roles admin pueden actualizar
    const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN', 'MANAGER']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.routeId)
    const stopNumber = parseInt(resolvedParams.stopNumber)

    if (isNaN(routeId) || isNaN(stopNumber)) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos' },
        { status: 400 }
      )
    }

    // Obtener datos del request
    const body = await request.json()
    const {
      orderId,
      signatureData,
      signatureStoragePath,
      signerName,
      signerRelation,
      photos = [],
      latitude,
      longitude,
      notes,
      markAsDelivered = false
    } = body

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'El ID de la orden es requerido' },
        { status: 400 }
      )
    }

    // Obtener la ruta
    const routeQuery = `
      SELECT
        r.id,
        r.driverid as "driverId",
        r.company_id as "companyId",
        r.stops
      FROM routes r
      WHERE r.id = $1
    `
    const routeResult = await db.query(routeQuery, [routeId])

    if (routeResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ruta no encontrada' },
        { status: 404 }
      )
    }

    const route = routeResult.rows[0]

    // Verificar que el driver está asignado a la ruta (solo para DRIVER)
    if (userRole === 'DRIVER' && route.driverId && route.driverId !== userId) {
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para actualizar esta parada' },
        { status: 403 }
      )
    }

    // Obtener la orden
    const orderQuery = `
      SELECT id, ordernumber, status, company_id
      FROM package_orders
      WHERE id = $1
    `
    const orderResult = await db.query(orderQuery, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const order = orderResult.rows[0]

    // Obtener nombre del driver
    const driverQuery = `SELECT firstname, lastname FROM users WHERE id = $1`
    const driverResult = await db.query(driverQuery, [userId])
    const driverName = driverResult.rows.length > 0
      ? `${driverResult.rows[0].firstname} ${driverResult.rows[0].lastname}`
      : userName

    // Validar que tiene firma Y foto si quiere marcar como entregado
    if (markAsDelivered) {
      const hasSignature = signatureData || signatureStoragePath
      const hasPhoto = photos && photos.length > 0

      if (!hasSignature || !hasPhoto) {
        return NextResponse.json(
          { success: false, error: 'Se requiere firma y al menos una foto para marcar como entregado' },
          { status: 400 }
        )
      }
    }

    // Buscar si ya existe un delivery proof para esta orden
    const existingProofQuery = `
      SELECT id FROM delivery_proofs
      WHERE order_id = $1 AND company_id = $2
    `
    const existingProofResult = await db.query(existingProofQuery, [orderId, route.companyId])

    let proofId: number

    if (existingProofResult.rows.length > 0) {
      // Actualizar proof existente
      proofId = existingProofResult.rows[0].id
      const updateProofQuery = `
        UPDATE delivery_proofs
        SET
          signature_data = COALESCE($1, signature_data),
          signature_storage_path = COALESCE($2, signature_storage_path),
          signer_name = COALESCE($3, signer_name),
          signer_relation = COALESCE($4, signer_relation),
          photos = COALESCE($5, photos),
          delivery_latitude = COALESCE($6, delivery_latitude),
          delivery_longitude = COALESCE($7, delivery_longitude),
          notes = COALESCE($8, notes),
          updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `
      await db.query(updateProofQuery, [
        signatureData || null,
        signatureStoragePath || null,
        signerName || null,
        signerRelation || null,
        photos.length > 0 ? JSON.stringify(photos) : null,
        latitude || null,
        longitude || null,
        notes || null,
        proofId
      ])
    } else {
      // Crear nuevo delivery proof
      const insertProofQuery = `
        INSERT INTO delivery_proofs (
          order_id, order_number,
          signature_data, signature_storage_path,
          signer_name, signer_relation,
          photos,
          delivery_latitude, delivery_longitude,
          notes,
          created_by, created_by_name,
          company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `
      const insertResult = await db.query(insertProofQuery, [
        orderId,
        order.ordernumber,
        signatureData || null,
        signatureStoragePath || null,
        signerName || null,
        signerRelation || null,
        JSON.stringify(photos),
        latitude || null,
        longitude || null,
        notes || null,
        userId,
        driverName,
        route.companyId
      ])
      proofId = insertResult.rows[0].id
    }

    // Si markAsDelivered, actualizar estado de la orden
    if (markAsDelivered) {
      const updateOrderQuery = `
        UPDATE package_orders
        SET
          status = 'delivered',
          updated_at = NOW()
        WHERE id = $1
      `
      await db.query(updateOrderQuery, [orderId])

      // Actualizar empaques a 'entregado'
      try {
        const updateEmpaquesQuery = `
          UPDATE empaques
          SET
            estado = 'entregado',
            updated_at = NOW()
          WHERE order_number = $1
        `
        await db.query(updateEmpaquesQuery, [order.ordernumber])

        // Registrar en trazabilidad
        const trazabilidadQuery = `
          INSERT INTO empaques_trazabilidad (
            empaque_id,
            accion,
            orden_numero,
            usuario_id,
            usuario_nombre,
            notas,
            fecha
          )
          SELECT
            e.id,
            'entregado',
            e.order_number,
            $1,
            $2,
            $3,
            NOW()
          FROM empaques e
          WHERE e.order_number = $4
        `
        await db.query(trazabilidadQuery, [
          userId,
          driverName,
          `Entregado por driver desde app móvil. Parada ${stopNumber} de ruta ${routeId}`,
          order.ordernumber
        ])
      } catch (e) {
        console.log('Error updating empaques:', e)
      }
    }

    return NextResponse.json({
      success: true,
      message: markAsDelivered
        ? 'Parada cerrada y orden marcada como entregada'
        : 'Información de parada actualizada',
      data: {
        proofId,
        orderId,
        orderNumber: order.ordernumber,
        status: markAsDelivered ? 'delivered' : order.status,
        hasSignature: !!(signatureData || signatureStoragePath),
        hasPhotos: photos.length > 0,
        coordinates: latitude && longitude ? { latitude, longitude } : null
      }
    })

  } catch (error) {
    console.error('Error updating stop:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar información de la parada' },
      { status: 500 }
    )
  }
}
