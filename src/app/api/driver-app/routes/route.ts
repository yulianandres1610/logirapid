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

    // Construir query base
    let query = `
      SELECT
        r.id,
        r.routenumber as "routeNumber",
        r.qrcode as "qrCode",
        r.status,
        r.distance,
        r.estimatedduration as "duration",
        r.date as "scheduledDate",
        r.vehicleplate as "vehiclePlate",
        r.vehicleid as "vehicleId",
        r.stops,
        r.createdat as "createdAt",
        r.company_id as "companyId"
      FROM routes r
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
    console.error('Error getting user routes:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener rutas del usuario' },
      { status: 500 }
    )
  }
}
