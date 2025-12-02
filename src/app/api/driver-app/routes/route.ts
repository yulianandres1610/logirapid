import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/routes
 *
 * Obtiene la lista de rutas asignadas al driver autenticado.
 * Devuelve información resumida para mostrar en cards.
 *
 * @authentication Requiere cookie auth-token
 * @returns Lista de rutas con código, millas, tiempo y estado
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener información del usuario desde headers (inyectados por middleware) o cookies (fallback)
    const userId = request.headers.get('x-user-id') || request.cookies.get('user-id')?.value
    const userRole = request.headers.get('x-user-role') || request.cookies.get('user-role')?.value

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado. Se requiere autenticación.'
      }, { status: 401 })
    }

    // Debug log para verificar autenticación
    console.log('[Driver App - Routes] Auth info:', { userId, userRole })

    // Obtener parámetros de query
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // pending, active, completed, all
    const limit = parseInt(searchParams.get('limit') || '20')
    const page = parseInt(searchParams.get('page') || '1')
    const offset = (page - 1) * limit

    // Construir condiciones de filtro
    const conditions: string[] = []
    const filterParams: (string | number)[] = []

    // Filtrar por driver (excepto SUPER_ADMIN y ADMIN que ven todas)
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN') {
      filterParams.push(parseInt(userId))
      conditions.push(`r.driverid = $${filterParams.length}`)
    }

    // Filtrar por estado
    if (status && status !== 'all') {
      filterParams.push(status)
      conditions.push(`r.status = $${filterParams.length}`)
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

    // Query para obtener rutas con información resumida
    const queryParams = [...filterParams, limit, offset]
    const limitParamNum = filterParams.length + 1
    const offsetParamNum = filterParams.length + 2

    const query = `
      SELECT
        r.id,
        r.routenumber as "routeCode",
        r.status,
        r.distance,
        r.estimatedduration as "estimatedDuration",
        r.date,
        r.totalpackages as "totalStops",
        r.deliveredpackages as "completedStops"
      FROM routes r
      ${whereClause}
      ORDER BY
        CASE
          WHEN r.status = 'active' THEN 1
          WHEN r.status = 'pending' THEN 2
          WHEN r.status = 'completed' THEN 3
          ELSE 4
        END,
        r.date DESC,
        r.createdat DESC
      LIMIT $${limitParamNum} OFFSET $${offsetParamNum}
    `

    const result = await db.query(query, queryParams)

    // Formatear respuesta para los cards
    const routes = result.rows.map(route => ({
      id: route.id,
      routeCode: route.routeCode || `ROUTE-${route.id}`,
      status: route.status || 'pending',
      distance: {
        value: parseFloat(route.distance) || 0,
        unit: 'mi',
        formatted: `${(parseFloat(route.distance) || 0).toFixed(1)} mi`
      },
      duration: {
        value: route.estimatedDuration || '0 min',
        formatted: route.estimatedDuration || '0 min'
      },
      date: route.date,
      progress: {
        total: route.totalStops || 0,
        completed: route.completedStops || 0,
        percentage: route.totalStops > 0
          ? Math.round((route.completedStops / route.totalStops) * 100)
          : 0
      }
    }))

    // Query para contar total (para paginación) - usa los mismos filterParams sin limit/offset
    const countQuery = `SELECT COUNT(*) as total FROM routes r ${whereClause}`
    const countResult = await db.query(countQuery, filterParams)
    const total = parseInt(countResult.rows[0]?.total || '0')

    return NextResponse.json({
      success: true,
      data: {
        routes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      }
    })

  } catch (error) {
    console.error('[Driver App - Routes] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener rutas'
    }, { status: 500 })
  }
}
