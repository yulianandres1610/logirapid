import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/driver-app/stops/[routeId]/[stopNumber]/fail
 * Marcar una parada como fallida con razón
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string; stopNumber: string }> }
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
    let userName: string
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [id, email, role] = decoded.split(':')
      userId = parseInt(id)
      userRole = role
      userName = email
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Verificar rol DRIVER
    if (userRole !== 'DRIVER') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo drivers pueden marcar paradas como fallidas.' },
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
      reason,
      reasonCode,
      photo,
      latitude,
      longitude,
      notes
    } = body

    // Razones válidas
    const validReasons = [
      'no_responde',           // Nadie responde / No está
      'direccion_incorrecta',  // Dirección incorrecta
      'cliente_rechazo',       // Cliente rechazó el paquete
      'acceso_denegado',       // No se pudo acceder al lugar
      'zona_peligrosa',        // Zona peligrosa
      'horario_no_disponible', // Fuera de horario de entrega
      'paquete_danado',        // Paquete dañado
      'otro'                   // Otra razón (requiere notas)
    ]

    const reasonCodeToUse = reasonCode || 'otro'
    if (!validReasons.includes(reasonCodeToUse)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Razón de falla inválida',
          validReasons
        },
        { status: 400 }
      )
    }

    if (reasonCodeToUse === 'otro' && !notes && !reason) {
      return NextResponse.json(
        { success: false, error: 'Se requiere especificar la razón cuando es "otro"' },
        { status: 400 }
      )
    }

    // Obtener la ruta
    const routeQuery = `
      SELECT
        r.id,
        r.route_number as "routeNumber",
        r.driver_id as "driverId",
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

    // Verificar que el driver está asignado a la ruta
    if (route.driverId && route.driverId !== userId) {
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para actualizar esta parada' },
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

    // Encontrar la parada
    const orderStops = waypoints.filter((s: any) => s.orderId || s.orderIds)
    if (stopNumber < 1 || stopNumber > orderStops.length) {
      return NextResponse.json(
        { success: false, error: `Parada ${stopNumber} no encontrada. Total paradas: ${orderStops.length}` },
        { status: 404 }
      )
    }

    // Encontrar índice real en waypoints
    let stopIndex = -1
    let orderStopCounter = 0
    for (let i = 0; i < waypoints.length; i++) {
      if (waypoints[i].orderId || waypoints[i].orderIds) {
        orderStopCounter++
        if (orderStopCounter === stopNumber) {
          stopIndex = i
          break
        }
      }
    }

    if (stopIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'No se encontró la parada' },
        { status: 404 }
      )
    }

    const stop = waypoints[stopIndex]

    // Obtener IDs de órdenes de esta parada
    const stopOrderIds = stop.orderIds || (stop.orderId ? [stop.orderId] : [])

    // Obtener nombre del driver
    const driverQuery = `SELECT firstname, lastname FROM users WHERE id = $1`
    const driverResult = await db.query(driverQuery, [userId])
    const driverName = driverResult.rows.length > 0
      ? `${driverResult.rows[0].firstname} ${driverResult.rows[0].lastname}`
      : userName

    // Mapeo de razones a etiquetas legibles
    const reasonLabels: Record<string, string> = {
      no_responde: 'Nadie responde / No está',
      direccion_incorrecta: 'Dirección incorrecta',
      cliente_rechazo: 'Cliente rechazó el paquete',
      acceso_denegado: 'No se pudo acceder al lugar',
      zona_peligrosa: 'Zona peligrosa',
      horario_no_disponible: 'Fuera de horario de entrega',
      paquete_danado: 'Paquete dañado',
      otro: 'Otra razón'
    }

    const finalReason = reason || reasonLabels[reasonCodeToUse] || reasonCodeToUse

    // Usar transacción
    await db.transaction(async (client: typeof db) => {
      // 1. Actualizar la parada como fallida
      waypoints[stopIndex] = {
        ...stop,
        status: 'failed',
        failedAt: new Date().toISOString(),
        failReason: finalReason,
        failReasonCode: reasonCodeToUse,
        failNotes: notes || null,
        failPhoto: photo || null,
        failCoordinates: latitude && longitude ? { latitude, longitude } : null,
        failedBy: driverName
      }

      await client.query(`
        UPDATE routes
        SET stops = $1,
            updatedat = NOW()
        WHERE id = $2
      `, [JSON.stringify(waypoints), routeId])

      // 2. Actualizar órdenes a 'fallido' / 'reprogrammed'
      if (stopOrderIds.length > 0) {
        // Marcar como fallido para que pueda ser reprogramado
        await client.query(`
          UPDATE package_orders
          SET status = 'reprogrammed',
              updatedat = NOW()
          WHERE id = ANY($1::int[])
        `, [stopOrderIds])
      }

      // 3. Registrar en delivery_proofs como intento fallido
      if (stopOrderIds.length > 0) {
        // Obtener order numbers
        const orderNumbersResult = await client.query(`
          SELECT id, ordernumber FROM package_orders WHERE id = ANY($1::int[])
        `, [stopOrderIds])

        for (const order of orderNumbersResult.rows) {
          await client.query(`
            INSERT INTO delivery_proofs (
              order_id, order_number,
              photos, notes,
              delivery_latitude, delivery_longitude,
              created_by, created_by_name,
              company_id,
              delivery_status,
              fail_reason,
              fail_reason_code
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'failed', $10, $11)
            ON CONFLICT (order_id, company_id) DO UPDATE SET
              delivery_status = 'failed',
              fail_reason = $10,
              fail_reason_code = $11,
              photos = COALESCE($3, delivery_proofs.photos),
              notes = COALESCE($4, delivery_proofs.notes),
              delivery_latitude = COALESCE($5, delivery_proofs.delivery_latitude),
              delivery_longitude = COALESCE($6, delivery_proofs.delivery_longitude),
              updated_at = NOW()
          `, [
            order.id,
            order.ordernumber,
            photo ? JSON.stringify([photo]) : null,
            notes || `Entrega fallida: ${finalReason}`,
            latitude || null,
            longitude || null,
            userId,
            driverName,
            route.companyId,
            finalReason,
            reasonCodeToUse
          ])
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Parada marcada como fallida',
      data: {
        routeId,
        routeNumber: route.routeNumber,
        stopNumber,
        status: 'failed',
        reason: finalReason,
        reasonCode: reasonCodeToUse,
        affectedOrders: stopOrderIds.length,
        failedAt: new Date().toISOString(),
        failedBy: driverName
      }
    })

  } catch (error) {
    console.error('Error marking stop as failed:', error)
    return NextResponse.json(
      { success: false, error: 'Error al marcar la parada como fallida' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/driver-app/stops/[routeId]/[stopNumber]/fail
 * Obtener razones de falla disponibles
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      reasons: [
        { code: 'no_responde', label: 'Nadie responde / No está', requiresPhoto: false },
        { code: 'direccion_incorrecta', label: 'Dirección incorrecta', requiresPhoto: true },
        { code: 'cliente_rechazo', label: 'Cliente rechazó el paquete', requiresPhoto: false },
        { code: 'acceso_denegado', label: 'No se pudo acceder al lugar', requiresPhoto: true },
        { code: 'zona_peligrosa', label: 'Zona peligrosa', requiresPhoto: false },
        { code: 'horario_no_disponible', label: 'Fuera de horario de entrega', requiresPhoto: false },
        { code: 'paquete_danado', label: 'Paquete dañado', requiresPhoto: true },
        { code: 'otro', label: 'Otra razón', requiresPhoto: false, requiresNotes: true }
      ]
    }
  })
}
