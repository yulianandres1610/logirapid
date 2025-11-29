import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/routes
 * Obtener las rutas asignadas al driver logueado
 */
export async function GET(request: NextRequest) {
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

    // Obtener parámetros de query
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Construir query base
    let query = `
      SELECT
        r.id,
        r.route_number as "routeNumber",
        r.qr_code as "qrCode",
        r.status,
        r.distance,
        r.duration,
        r.scheduled_date as "scheduledDate",
        r.vehicle_plate as "vehiclePlate",
        r.vehicle_id as "vehicleId",
        r.stops,
        r.created_at as "createdAt",
        r.company_id as "companyId"
      FROM routes r
      WHERE r.driver_id = $1
    `
    const params: any[] = [userId]
    let paramIndex = 2

    // Filtrar por estado
    if (status !== 'all') {
      query += ` AND r.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    // Ordenar por fecha programada desc
    query += ` ORDER BY r.scheduled_date DESC, r.created_at DESC`

    // Agregar paginación
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const routesResult = await db.query(query, params)

    // Contar total para paginación
    let countQuery = `
      SELECT COUNT(*) as total
      FROM routes r
      WHERE r.driver_id = $1
    `
    const countParams: any[] = [userId]

    if (status !== 'all') {
      countQuery += ` AND r.status = $2`
      countParams.push(status)
    }

    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Procesar rutas para calcular paradas completadas
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
      // Por ahora, usar el status de la parada si existe
      let completedStops = 0
      let pendingStops = 0
      let failedStops = 0

      orderStops.forEach((stop: any) => {
        if (stop.status === 'delivered' || stop.status === 'completed') {
          completedStops++
        } else if (stop.status === 'failed' || stop.status === 'cancelled') {
          failedStops++
        } else {
          pendingStops++
        }
      })

      return {
        id: route.id,
        routeNumber: route.routeNumber,
        qrCode: route.qrCode,
        status: route.status,
        totalStops,
        completedStops,
        pendingStops,
        failedStops,
        distance: route.distance,
        duration: route.duration,
        scheduledDate: route.scheduledDate,
        vehiclePlate: route.vehiclePlate,
        vehicleId: route.vehicleId,
        createdAt: route.createdAt
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
    console.error('Error getting driver routes:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener rutas del driver' },
      { status: 500 }
    )
  }
}
