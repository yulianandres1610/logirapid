import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/routes/[id]/start
 * Inicia una ruta que está en estado 'asignada'
 *
 * - Cambia estado de ruta a 'en_curso'
 * - Cambia estado de todas las paradas a 'en_curso'
 * - Cambia estado de todas las órdenes a 'en_reparto'
 * - Establece startTime = NOW()
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.id)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    console.log(`🚀 [Iniciar Ruta] Intentando iniciar ruta ID: ${routeId}`)

    if (isNaN(routeId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta inválido'
      }, { status: 400 })
    }

    // Verificar que la ruta existe y obtener sus datos
    let checkQuery = 'SELECT * FROM routes WHERE id = $1'
    const checkParams: (number | string)[] = [routeId]

    if (!isSuperAdmin && headerCompanyId) {
      checkQuery += ' AND company_id = $2'
      checkParams.push(headerCompanyId)
    }

    const routeResult = await db.query(checkQuery, checkParams)

    if (routeResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ruta no encontrada'
      }, { status: 404 })
    }

    const route = routeResult.rows[0]

    // Validar que la ruta esté en estado 'asignada' (o 'planning' legacy con driver)
    const validStatuses = ['asignada', 'planning']
    if (!validStatuses.includes(route.status)) {
      return NextResponse.json({
        success: false,
        error: `La ruta debe estar en estado "asignada" para iniciarla. Estado actual: "${route.status}"`,
        currentStatus: route.status
      }, { status: 400 })
    }

    // Validar que tenga driver asignado
    if (!route.driverid) {
      return NextResponse.json({
        success: false,
        error: 'La ruta debe tener un conductor asignado para iniciarla'
      }, { status: 400 })
    }

    // Parsear las paradas
    let stops = route.stops
    if (typeof stops === 'string') {
      try {
        stops = JSON.parse(stops)
      } catch (e) {
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

    console.log(`📦 [Órdenes] ${orderIds.length} órdenes a actualizar`)

    // Usar transacción para asegurar consistencia
    await db.transaction(async (client: typeof db) => {
      // 1. Actualizar estado de la ruta a 'en_curso' y establecer starttime
      await client.query(`
        UPDATE routes
        SET status = 'en_curso',
            starttime = NOW(),
            updatedat = NOW()
        WHERE id = $1
      `, [routeId])

      console.log(`✅ [Ruta] Estado actualizado a 'en_curso'`)

      // 2. Actualizar estado de las paradas a 'en_curso'
      const updatedStops = stops.map((stop: Record<string, unknown>) => ({
        ...stop,
        status: 'en_curso'
      }))

      await client.query(`
        UPDATE routes
        SET stops = $1
        WHERE id = $2
      `, [JSON.stringify(updatedStops), routeId])

      console.log(`✅ [Paradas] ${updatedStops.length} paradas actualizadas a 'en_curso'`)

      // 3. Actualizar estado de las órdenes a 'en_reparto'
      if (orderIds.length > 0) {
        // Usar ANY para actualizar múltiples órdenes
        await client.query(`
          UPDATE package_orders
          SET status = 'en_reparto',
              updatedat = NOW()
          WHERE id = ANY($1::int[])
        `, [orderIds])

        console.log(`✅ [Órdenes] ${orderIds.length} órdenes actualizadas a 'en_reparto'`)
      }
    })

    // Obtener la ruta actualizada
    const updatedRouteResult = await db.query(
      'SELECT * FROM routes WHERE id = $1',
      [routeId]
    )

    const updatedRoute = updatedRouteResult.rows[0]

    console.log(`🎉 [Completado] Ruta ${route.routenumber} iniciada exitosamente`)

    return NextResponse.json({
      success: true,
      message: `Ruta ${route.routenumber} iniciada exitosamente`,
      data: {
        id: updatedRoute.id,
        routeNumber: updatedRoute.routenumber,
        status: updatedRoute.status,
        previousStatus: 'asignada',
        startTime: updatedRoute.starttime,
        driverName: updatedRoute.drivername,
        totalStops: stops.length,
        totalOrders: orderIds.length
      }
    })

  } catch (error) {
    console.error('❌ [Error] POST /api/routes/[id]/start:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al iniciar la ruta',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
