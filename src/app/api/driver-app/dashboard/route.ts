import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/dashboard
 * Dashboard del driver con estadísticas, inventario y ruta activa
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

    // Decodificar token (formato: id:email:role)
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

    // Obtener datos del driver
    const driverQuery = `
      SELECT
        u.id,
        u.firstname as "firstName",
        u.lastname as "lastName",
        u.email,
        u.phone,
        u.status,
        COALESCE(di.cajas_vacias_count, 0) as "cajasVacias",
        COALESCE(di.bultos_count, 0) as "bultos",
        COALESCE(di.cajas_vacias_capacity, 50) as "cajasVaciasCapacity",
        COALESCE(di.bultos_capacity, 100) as "bultosCapacity",
        c.id as "companyId",
        c.legalname as "companyName"
      FROM users u
      LEFT JOIN user_companies uc ON u.id = uc.userid
      LEFT JOIN companies c ON uc.companyid = c.id
      LEFT JOIN driver_inventory di ON u.id = di.driver_id
      WHERE u.id = $1
    `
    const driverResult = await db.query(driverQuery, [userId])

    if (driverResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Driver no encontrado' },
        { status: 404 }
      )
    }

    const driver = driverResult.rows[0]

    // Buscar ruta activa asignada al driver
    const routeQuery = `
      SELECT
        id,
        route_number as "routeNumber",
        status,
        distance,
        duration,
        scheduled_date as "scheduledDate",
        stops
      FROM routes
      WHERE driver_id = $1
        AND status IN ('active', 'planning')
      ORDER BY created_at DESC
      LIMIT 1
    `
    const routeResult = await db.query(routeQuery, [userId])

    let rutaActiva = null
    if (routeResult.rows.length > 0) {
      const route = routeResult.rows[0]

      // Calcular paradas completadas
      let totalStops = 0
      let completedStops = 0

      if (route.stops) {
        try {
          const stops = typeof route.stops === 'string'
            ? JSON.parse(route.stops)
            : route.stops

          if (Array.isArray(stops)) {
            // Obtener IDs de órdenes de los waypoints
            const orderIds: number[] = []
            for (const wp of stops) {
              if (wp.orderId) orderIds.push(wp.orderId)
              if (wp.orderIds) orderIds.push(...wp.orderIds)
            }

            totalStops = [...new Set(orderIds)].length

            if (orderIds.length > 0) {
              const uniqueIds = [...new Set(orderIds)]
              const statusQuery = `
                SELECT COUNT(*) as completed
                FROM package_orders
                WHERE id = ANY($1)
                  AND status IN ('delivered', 'completed')
              `
              const statusResult = await db.query(statusQuery, [uniqueIds])
              completedStops = parseInt(statusResult.rows[0].completed)
            }
          }
        } catch (e) {
          console.error('Error parsing route stops:', e)
        }
      }

      rutaActiva = {
        id: route.id,
        routeNumber: route.routeNumber,
        status: route.status,
        totalStops,
        completedStops,
        distance: route.distance,
        duration: route.duration,
        scheduledDate: route.scheduledDate
      }
    }

    // Calcular estadísticas de entregas
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    // Entregas de hoy (empaques entregados por este driver hoy)
    const entregasHoyQuery = `
      SELECT COUNT(*) as count
      FROM empaques
      WHERE driver_id = $1
        AND estado = 'entregado'
        AND updated_at >= $2
    `
    const entregasHoyResult = await db.query(entregasHoyQuery, [userId, today.toISOString()])
    const entregasHoy = parseInt(entregasHoyResult.rows[0].count)

    // Entregas de la semana
    const entregasSemanaQuery = `
      SELECT COUNT(*) as count
      FROM empaques
      WHERE driver_id = $1
        AND estado = 'entregado'
        AND updated_at >= $2
    `
    const entregasSemanaResult = await db.query(entregasSemanaQuery, [userId, weekAgo.toISOString()])
    const entregasSemana = parseInt(entregasSemanaResult.rows[0].count)

    // Pendientes (empaques en_reparto asignados al driver)
    const pendientesQuery = `
      SELECT COUNT(*) as count
      FROM empaques
      WHERE driver_id = $1
        AND estado = 'en_reparto'
    `
    const pendientesResult = await db.query(pendientesQuery, [userId])
    const pendientes = parseInt(pendientesResult.rows[0].count)

    return NextResponse.json({
      success: true,
      data: {
        driver: {
          id: driver.id,
          firstName: driver.firstName,
          lastName: driver.lastName,
          email: driver.email,
          phone: driver.phone,
          companyId: driver.companyId,
          companyName: driver.companyName
        },
        inventory: {
          cajasVacias: driver.cajasVacias,
          cajasVaciasCapacity: driver.cajasVaciasCapacity,
          bultos: driver.bultos,
          bultosCapacity: driver.bultosCapacity
        },
        rutaActiva,
        estadisticas: {
          entregasHoy,
          entregasSemana,
          pendientes
        }
      }
    })

  } catch (error) {
    console.error('Error fetching driver dashboard:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener dashboard del driver' },
      { status: 500 }
    )
  }
}
