import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/driver-app/routes/[code]/start
 * Iniciar una ruta asignada al driver
 * El driver puede usar el código QR o número de ruta
 */
export async function POST(
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

    // Verificar rol permitido (DRIVER, ADMIN, SUPER_ADMIN)
    const allowedRoles = ['DRIVER', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Rol no autorizado para iniciar rutas.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const routeCode = resolvedParams.code

    // Buscar ruta por QR code o número de ruta
    const routeQuery = `
      SELECT
        r.id,
        r.route_number as "routeNumber",
        r.qr_code as "qrCode",
        r.status,
        r.driver_id as "driverId",
        r.driver_name as "driverName",
        r.vehicle_plate as "vehiclePlate",
        r.company_id as "companyId",
        r.scheduled_date as "scheduledDate",
        r.stops
      FROM routes r
      WHERE (r.qr_code = $1 OR r.route_number = $1 OR r.id::text = $1)
    `
    const routeResult = await db.query(routeQuery, [routeCode])

    if (routeResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ruta no encontrada' },
        { status: 404 }
      )
    }

    const route = routeResult.rows[0]

    // Verificar que el driver está asignado a esta ruta
    if (route.driverId && route.driverId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Esta ruta está asignada a otro conductor' },
        { status: 403 }
      )
    }

    // Verificar que la ruta puede ser iniciada
    const validStatuses = ['asignada', 'active', 'planning']
    if (!validStatuses.includes(route.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `La ruta no puede ser iniciada. Estado actual: ${route.status}`,
          currentStatus: route.status
        },
        { status: 400 }
      )
    }

    // Si la ruta ya está en curso
    if (route.status === 'en_curso') {
      return NextResponse.json({
        success: true,
        message: 'La ruta ya está en curso',
        data: {
          id: route.id,
          routeNumber: route.routeNumber,
          qrCode: route.qrCode,
          status: 'en_curso',
          driverName: route.driverName,
          vehiclePlate: route.vehiclePlate
        }
      })
    }

    // Parsear las paradas
    let stops = route.stops
    if (typeof stops === 'string') {
      try {
        stops = JSON.parse(stops)
      } catch {
        stops = []
      }
    }
    stops = stops || []

    // Obtener todos los IDs de órdenes de las paradas
    const orderIds: number[] = []
    for (const stop of stops) {
      if (stop.orderId) {
        orderIds.push(stop.orderId)
      }
      if (stop.orderIds && Array.isArray(stop.orderIds)) {
        orderIds.push(...stop.orderIds)
      }
    }

    // Usar transacción para asegurar consistencia
    await db.transaction(async (client: typeof db) => {
      // 1. Actualizar estado de la ruta a 'en_curso' y establecer starttime
      await client.query(`
        UPDATE routes
        SET status = 'en_curso',
            starttime = NOW(),
            updatedat = NOW()
        WHERE id = $1
      `, [route.id])

      // 2. Actualizar estado de las paradas a 'pendiente' (primera parada será en_curso)
      const updatedStops = stops.map((stop: Record<string, unknown>, index: number) => ({
        ...stop,
        status: index === 0 ? 'en_curso' : 'pendiente'
      }))

      await client.query(`
        UPDATE routes
        SET stops = $1
        WHERE id = $2
      `, [JSON.stringify(updatedStops), route.id])

      // 3. Actualizar estado de las órdenes a 'en_reparto'
      if (orderIds.length > 0) {
        await client.query(`
          UPDATE package_orders
          SET status = 'en_reparto',
              updatedat = NOW()
          WHERE id = ANY($1::int[])
        `, [orderIds])
      }
    })

    // Obtener primera parada
    const firstStop = stops.find((s: any) => s.orderId || s.orderIds)

    return NextResponse.json({
      success: true,
      message: `Ruta ${route.routeNumber} iniciada exitosamente`,
      data: {
        id: route.id,
        routeNumber: route.routeNumber,
        qrCode: route.qrCode,
        status: 'en_curso',
        startTime: new Date().toISOString(),
        driverName: route.driverName,
        vehiclePlate: route.vehiclePlate,
        totalStops: stops.filter((s: any) => s.orderId || s.orderIds).length,
        totalOrders: orderIds.length,
        firstStop: firstStop ? {
          stopNumber: 1,
          address: firstStop.address,
          coordinates: firstStop.coordinates || [firstStop.lng, firstStop.lat]
        } : null
      }
    })

  } catch (error) {
    console.error('Error starting route:', error)
    return NextResponse.json(
      { success: false, error: 'Error al iniciar la ruta' },
      { status: 500 }
    )
  }
}
