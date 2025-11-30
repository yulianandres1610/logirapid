import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST /api/routes/[id]/stops/[stopNumber]/complete
 * Completa una parada específica de una ruta
 *
 * - Cambia estado de la parada a 'completada'
 * - Cambia estado de las órdenes de esa parada a 'en_bodega'
 * - Si todas las paradas están completadas, cambia estado de ruta a 'completada'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stopNumber: string }> }
) {
  try {
    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.id)
    const stopNumber = parseInt(resolvedParams.stopNumber)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    console.log(`✅ [Completar Parada] Ruta ${routeId}, Parada ${stopNumber}`)

    if (isNaN(routeId) || isNaN(stopNumber)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta o número de parada inválido'
      }, { status: 400 })
    }

    // Verificar que la ruta existe
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

    // Validar que la ruta esté en estado 'en_curso'
    if (route.status !== 'en_curso') {
      return NextResponse.json({
        success: false,
        error: `La ruta debe estar en estado "en_curso" para completar paradas. Estado actual: "${route.status}"`,
        currentStatus: route.status
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

    // Buscar la parada por índice (stopNumber es 1-based)
    const stopIndex = stopNumber - 1
    if (stopIndex < 0 || stopIndex >= stops.length) {
      return NextResponse.json({
        success: false,
        error: `Parada ${stopNumber} no encontrada. La ruta tiene ${stops.length} paradas.`
      }, { status: 404 })
    }

    const stop = stops[stopIndex]

    // Verificar que la parada no esté ya completada
    if (stop.status === 'completada') {
      return NextResponse.json({
        success: false,
        error: `La parada ${stopNumber} ya está completada`
      }, { status: 400 })
    }

    // Obtener los IDs de órdenes de esta parada
    const orderIds: number[] = []
    if (stop.orderId) {
      orderIds.push(stop.orderId)
    }
    if (stop.orderIds && Array.isArray(stop.orderIds)) {
      orderIds.push(...stop.orderIds)
    }

    console.log(`📦 [Órdenes] ${orderIds.length} órdenes a actualizar a 'en_bodega'`)

    // Usar transacción para asegurar consistencia
    await db.transaction(async (client: typeof db) => {
      // 1. Actualizar estado de la parada a 'completada'
      stops[stopIndex].status = 'completada'

      await client.query(`
        UPDATE routes
        SET stops = $1,
            updatedat = NOW()
        WHERE id = $2
      `, [JSON.stringify(stops), routeId])

      console.log(`✅ [Parada] Parada ${stopNumber} actualizada a 'completada'`)

      // 2. Actualizar estado de las órdenes a 'en_bodega'
      if (orderIds.length > 0) {
        await client.query(`
          UPDATE package_orders
          SET status = 'en_bodega',
              updatedat = NOW()
          WHERE id = ANY($1::int[])
        `, [orderIds])

        console.log(`✅ [Órdenes] ${orderIds.length} órdenes actualizadas a 'en_bodega'`)
      }

      // 3. Verificar si todas las paradas están completadas
      const allStopsCompleted = stops.every(
        (s: { status: string }) => s.status === 'completada' || s.status === 'fallida'
      )

      if (allStopsCompleted) {
        // Actualizar ruta a 'completada'
        await client.query(`
          UPDATE routes
          SET status = 'completada',
              endtime = NOW(),
              deliveredpackages = totalpackages,
              updatedat = NOW()
          WHERE id = $1
        `, [routeId])

        console.log(`🎉 [Ruta] Todas las paradas completadas. Ruta marcada como 'completada'`)
      }
    })

    // Obtener datos actualizados
    const updatedRouteResult = await db.query(
      'SELECT * FROM routes WHERE id = $1',
      [routeId]
    )
    const updatedRoute = updatedRouteResult.rows[0]

    // Contar paradas completadas
    let updatedStops = updatedRoute.stops
    if (typeof updatedStops === 'string') {
      updatedStops = JSON.parse(updatedStops)
    }
    const completedStops = updatedStops.filter(
      (s: { status: string }) => s.status === 'completada'
    ).length

    return NextResponse.json({
      success: true,
      message: `Parada ${stopNumber} completada exitosamente`,
      data: {
        routeId: updatedRoute.id,
        routeNumber: updatedRoute.routenumber,
        routeStatus: updatedRoute.status,
        stopNumber,
        stopStatus: 'completada',
        ordersUpdated: orderIds.length,
        completedStops,
        totalStops: updatedStops.length,
        routeCompleted: updatedRoute.status === 'completada'
      }
    })

  } catch (error) {
    console.error('❌ [Error] POST /api/routes/[id]/stops/[stopNumber]/complete:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al completar la parada',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * POST /api/routes/[id]/stops/[stopNumber]/fail
 * Marca una parada como fallida
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stopNumber: string }> }
) {
  try {
    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.id)
    const stopNumber = parseInt(resolvedParams.stopNumber)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    const body = await request.json()
    const { status, reason } = body

    if (!status || !['completada', 'fallida'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: 'Estado inválido. Debe ser: completada o fallida'
      }, { status: 400 })
    }

    console.log(`📝 [Actualizar Parada] Ruta ${routeId}, Parada ${stopNumber} → ${status}`)

    if (isNaN(routeId) || isNaN(stopNumber)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta o número de parada inválido'
      }, { status: 400 })
    }

    // Verificar que la ruta existe
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

    // Buscar la parada
    const stopIndex = stopNumber - 1
    if (stopIndex < 0 || stopIndex >= stops.length) {
      return NextResponse.json({
        success: false,
        error: `Parada ${stopNumber} no encontrada`
      }, { status: 404 })
    }

    // Actualizar estado de la parada
    stops[stopIndex].status = status
    if (reason) {
      stops[stopIndex].failReason = reason
    }

    await db.query(`
      UPDATE routes
      SET stops = $1,
          updatedat = NOW()
      WHERE id = $2
    `, [JSON.stringify(stops), routeId])

    // Si es completada, actualizar órdenes a en_bodega
    if (status === 'completada') {
      const stop = stops[stopIndex]
      const orderIds: number[] = []
      if (stop.orderId) orderIds.push(stop.orderId)
      if (stop.orderIds) orderIds.push(...stop.orderIds)

      if (orderIds.length > 0) {
        await db.query(`
          UPDATE package_orders
          SET status = 'en_bodega',
              updatedat = NOW()
          WHERE id = ANY($1::int[])
        `, [orderIds])
      }
    }

    // Verificar si todas las paradas terminaron
    const allDone = stops.every(
      (s: { status: string }) => s.status === 'completada' || s.status === 'fallida'
    )

    if (allDone) {
      await db.query(`
        UPDATE routes
        SET status = 'completada',
            endtime = NOW(),
            updatedat = NOW()
        WHERE id = $1
      `, [routeId])
    }

    return NextResponse.json({
      success: true,
      message: `Parada ${stopNumber} actualizada a '${status}'`,
      data: {
        stopNumber,
        status,
        reason: reason || null,
        routeCompleted: allDone
      }
    })

  } catch (error) {
    console.error('❌ [Error] PATCH /api/routes/[id]/stops/[stopNumber]/complete:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar la parada',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
