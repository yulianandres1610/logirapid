import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/migrations/route-states
 * Migra los estados de rutas existentes al nuevo sistema
 *
 * Mapeo:
 * - planning → planificada
 * - active → en_curso
 * - completed → completada
 * - cancelled → cancelada
 *
 * También actualiza los estados de paradas dentro de cada ruta
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [Migración] Iniciando migración de estados de rutas...')

    // Contadores para el reporte
    let routesUpdated = 0
    let stopsUpdated = 0
    let ordersUpdated = 0

    // 1. Obtener todas las rutas con estados antiguos
    const routesResult = await db.query(`
      SELECT id, status, stops, driverid
      FROM routes
      WHERE status IN ('planning', 'active', 'completed', 'cancelled')
    `)

    console.log(`📊 [Migración] Encontradas ${routesResult.rows.length} rutas para migrar`)

    // Mapeo de estados de rutas
    const routeStatusMap: Record<string, string> = {
      'planning': 'planificada',
      'active': 'en_curso',
      'completed': 'completada',
      'cancelled': 'cancelada'
    }

    // Mapeo de estados de paradas
    const stopStatusMap: Record<string, string> = {
      'pending': 'pendiente',
      'delivered': 'completada',
      'failed': 'fallida'
    }

    for (const route of routesResult.rows) {
      const oldStatus = route.status
      let newStatus = routeStatusMap[oldStatus] || oldStatus

      // Si la ruta tiene driver y estaba en planning, debería ser 'asignada'
      if (oldStatus === 'planning' && route.driverid) {
        newStatus = 'asignada'
      }

      // Parsear y actualizar paradas
      let stops = route.stops
      if (typeof stops === 'string') {
        try {
          stops = JSON.parse(stops)
        } catch (e) {
          stops = []
        }
      }
      stops = stops || []

      let stopsModified = false
      for (const stop of stops) {
        const oldStopStatus = stop.status
        if (oldStopStatus && stopStatusMap[oldStopStatus]) {
          stop.status = stopStatusMap[oldStopStatus]
          stopsModified = true
          stopsUpdated++
        }
      }

      // Actualizar ruta
      await db.query(`
        UPDATE routes
        SET status = $1,
            stops = $2,
            updatedat = NOW()
        WHERE id = $3
      `, [newStatus, JSON.stringify(stops), route.id])

      routesUpdated++
      console.log(`✅ [Ruta ${route.id}] ${oldStatus} → ${newStatus}`)
    }

    // 2. Migrar estados de órdenes
    // in_transit → en_ruta (si la ruta está asignada) o en_reparto (si está en_curso)
    console.log('🔄 [Migración] Actualizando estados de órdenes...')

    // Primero, obtener órdenes con estado in_transit
    const ordersResult = await db.query(`
      SELECT po.id, po.status, r.status as route_status
      FROM package_orders po
      LEFT JOIN routes r ON r.id = (
        SELECT id FROM routes
        WHERE stops::text LIKE '%' || po.id || '%'
        LIMIT 1
      )
      WHERE po.status = 'in_transit'
    `)

    for (const order of ordersResult.rows) {
      let newOrderStatus = 'en_reparto' // Por defecto si la ruta está en curso

      if (order.route_status === 'asignada') {
        newOrderStatus = 'en_ruta'
      } else if (order.route_status === 'planificada') {
        newOrderStatus = 'pending' // Si la ruta no tiene driver, la orden vuelve a pending
      }

      await db.query(`
        UPDATE package_orders
        SET status = $1, updatedat = NOW()
        WHERE id = $2
      `, [newOrderStatus, order.id])

      ordersUpdated++
    }

    console.log('✅ [Migración] Completada')

    return NextResponse.json({
      success: true,
      message: 'Migración completada exitosamente',
      data: {
        routesUpdated,
        stopsUpdated,
        ordersUpdated
      }
    })

  } catch (error) {
    console.error('❌ [Error] Migración fallida:', error)
    return NextResponse.json({
      success: false,
      error: 'Error durante la migración',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/route-states
 * Obtiene un reporte del estado actual de los datos
 */
export async function GET(request: NextRequest) {
  try {
    // Contar rutas por estado
    const routeStatsResult = await db.query(`
      SELECT status, COUNT(*) as count
      FROM routes
      GROUP BY status
    `)

    // Contar órdenes por estado
    const orderStatsResult = await db.query(`
      SELECT status, COUNT(*) as count
      FROM package_orders
      GROUP BY status
    `)

    return NextResponse.json({
      success: true,
      data: {
        routeStatuses: routeStatsResult.rows,
        orderStatuses: orderStatsResult.rows,
        needsMigration: routeStatsResult.rows.some(
          (r: { status: string }) => ['planning', 'active', 'completed', 'cancelled'].includes(r.status)
        )
      }
    })

  } catch (error) {
    console.error('❌ [Error] GET /api/migrations/route-states:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener estado de migración',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
