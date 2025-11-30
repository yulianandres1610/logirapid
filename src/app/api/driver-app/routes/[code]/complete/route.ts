import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/driver-app/routes/[code]/complete
 * Completar/finalizar una ruta
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

    // Verificar rol DRIVER
    if (userRole !== 'DRIVER') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo drivers pueden completar rutas.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const routeCode = resolvedParams.code

    // Obtener datos opcionales del body
    let forceComplete = false
    let endNotes = ''
    try {
      const body = await request.json()
      forceComplete = body.forceComplete || false
      endNotes = body.notes || ''
    } catch {
      // Sin body está OK
    }

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
        r.starttime as "startTime",
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

    // Verificar que la ruta puede ser completada
    if (route.status === 'completada' || route.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'La ruta ya fue completada anteriormente',
        data: {
          id: route.id,
          routeNumber: route.routeNumber,
          status: 'completada'
        }
      })
    }

    if (route.status !== 'en_curso' && route.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: `La ruta debe estar en curso para completarla. Estado actual: ${route.status}`,
          currentStatus: route.status
        },
        { status: 400 }
      )
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

    // Verificar paradas pendientes
    const orderStops = stops.filter((s: any) => s.orderId || s.orderIds)
    const completedStops = orderStops.filter((s: any) =>
      s.status === 'delivered' || s.status === 'completed' || s.status === 'failed'
    )
    const pendingStops = orderStops.filter((s: any) =>
      s.status !== 'delivered' && s.status !== 'completed' && s.status !== 'failed'
    )

    // Si hay paradas pendientes y no se fuerza el cierre
    if (pendingStops.length > 0 && !forceComplete) {
      return NextResponse.json(
        {
          success: false,
          error: `Hay ${pendingStops.length} paradas pendientes. Use forceComplete=true para completar de todas formas.`,
          pendingStops: pendingStops.length,
          completedStops: completedStops.length,
          totalStops: orderStops.length
        },
        { status: 400 }
      )
    }

    // Calcular estadísticas finales
    let deliveredCount = 0
    let failedCount = 0
    const deliveredOrderIds: number[] = []
    const failedOrderIds: number[] = []

    for (const stop of orderStops) {
      const status = stop.status || 'pending'
      const stopOrderIds = stop.orderIds || (stop.orderId ? [stop.orderId] : [])

      if (status === 'delivered' || status === 'completed') {
        deliveredCount++
        deliveredOrderIds.push(...stopOrderIds)
      } else if (status === 'failed') {
        failedCount++
        failedOrderIds.push(...stopOrderIds)
      } else if (forceComplete) {
        // Si se fuerza el cierre, marcar pendientes como fallidos
        failedCount++
        failedOrderIds.push(...stopOrderIds)
        stop.status = 'failed'
        stop.failReason = 'Ruta cerrada sin completar'
      }
    }

    // Usar transacción
    await db.transaction(async (client: typeof db) => {
      // 1. Actualizar estado de la ruta a 'completada'
      await client.query(`
        UPDATE routes
        SET status = 'completada',
            endtime = NOW(),
            updatedat = NOW(),
            stops = $2
        WHERE id = $1
      `, [route.id, JSON.stringify(stops)])

      // 2. Actualizar órdenes fallidas si se forzó el cierre
      if (failedOrderIds.length > 0 && forceComplete) {
        await client.query(`
          UPDATE package_orders
          SET status = 'failed',
              updatedat = NOW()
          WHERE id = ANY($1::int[])
            AND status NOT IN ('delivered', 'completed')
        `, [failedOrderIds])
      }
    })

    // Calcular duración
    let durationMinutes = null
    if (route.startTime) {
      const start = new Date(route.startTime)
      const end = new Date()
      durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000)
    }

    return NextResponse.json({
      success: true,
      message: `Ruta ${route.routeNumber} completada exitosamente`,
      data: {
        id: route.id,
        routeNumber: route.routeNumber,
        qrCode: route.qrCode,
        status: 'completada',
        startTime: route.startTime,
        endTime: new Date().toISOString(),
        durationMinutes,
        summary: {
          totalStops: orderStops.length,
          deliveredStops: deliveredCount,
          failedStops: failedCount,
          deliveredOrders: deliveredOrderIds.length,
          failedOrders: failedOrderIds.length
        },
        notes: endNotes || null
      }
    })

  } catch (error) {
    console.error('Error completing route:', error)
    return NextResponse.json(
      { success: false, error: 'Error al completar la ruta' },
      { status: 500 }
    )
  }
}
