import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { getCompanyFilter } from '@/lib/query-helpers'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * PATCH /api/routes/[id]/driver
 * Asigna o cambia el driver de una ruta
 *
 * Solo permitido para rutas en estado: planificada, planning, asignada
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.id)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (isNaN(routeId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const { driverId, driverName } = body

    console.log(`🚗 [Driver] Actualizando driver de ruta ${routeId}:`, { driverId, driverName })

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

    // Validar que la ruta esté en un estado que permita cambio de driver
    const allowedStatuses = ['planificada', 'planning', 'asignada']
    if (!allowedStatuses.includes(route.status)) {
      return NextResponse.json({
        success: false,
        error: `No se puede cambiar el conductor en una ruta con estado "${route.status}". Solo se permite para rutas planificadas o asignadas.`
      }, { status: 400 })
    }

    // Parsear las paradas actuales
    let stops = route.stops
    if (typeof stops === 'string') {
      try {
        stops = JSON.parse(stops)
      } catch (e) {
        stops = []
      }
    }
    stops = stops || []

    // Obtener IDs de órdenes para actualizar
    const orderIds: number[] = []
    for (const stop of stops) {
      if (stop.orderId) {
        orderIds.push(stop.orderId)
      }
      if (stop.orderIds && Array.isArray(stop.orderIds)) {
        orderIds.push(...stop.orderIds)
      }
    }

    // Usar transacción para consistencia
    await db.transaction(async (client: typeof db) => {
      // Determinar el nuevo estado
      // Si se asigna driver -> 'asignada'
      // Si se quita driver (null) -> 'planificada'
      const newStatus = driverId ? 'asignada' : 'planificada'

      // Actualizar la ruta
      await client.query(`
        UPDATE routes
        SET driverid = $1,
            drivername = $2,
            status = $3,
            updatedat = NOW()
        WHERE id = $4
      `, [driverId || null, driverName || null, newStatus, routeId])

      console.log(`✅ [Ruta] Driver actualizado, nuevo estado: ${newStatus}`)

      // Si se asigna driver, actualizar paradas a 'pendiente'
      if (driverId && stops.length > 0) {
        const updatedStops = stops.map((stop: Record<string, unknown>) => ({
          ...stop,
          status: 'pendiente'
        }))

        await client.query(`
          UPDATE routes
          SET stops = $1
          WHERE id = $2
        `, [JSON.stringify(updatedStops), routeId])

        console.log(`✅ [Paradas] ${updatedStops.length} paradas actualizadas a 'pendiente'`)
      }

      // Si se asigna driver, actualizar órdenes a 'en_ruta'
      if (driverId && orderIds.length > 0) {
        await client.query(`
          UPDATE package_orders
          SET status = 'en_ruta',
              updatedat = NOW()
          WHERE id = ANY($1::int[])
        `, [orderIds])

        console.log(`✅ [Órdenes] ${orderIds.length} órdenes actualizadas a 'en_ruta'`)
      }

      // Si se quita driver, revertir órdenes a 'pending'
      if (!driverId && orderIds.length > 0) {
        await client.query(`
          UPDATE package_orders
          SET status = 'pending',
              updatedat = NOW()
          WHERE id = ANY($1::int[])
        `, [orderIds])

        console.log(`✅ [Órdenes] ${orderIds.length} órdenes revertidas a 'pending'`)

        // Revertir paradas a sin estado
        const revertedStops = stops.map((stop: Record<string, unknown>) => ({
          ...stop,
          status: null
        }))

        await client.query(`
          UPDATE routes
          SET stops = $1
          WHERE id = $2
        `, [JSON.stringify(revertedStops), routeId])
      }
    })

    // Obtener la ruta actualizada
    const updatedRouteResult = await db.query(
      'SELECT * FROM routes WHERE id = $1',
      [routeId]
    )
    const updatedRoute = updatedRouteResult.rows[0]

    return NextResponse.json({
      success: true,
      message: driverId
        ? `Conductor ${driverName} asignado exitosamente`
        : 'Conductor removido de la ruta',
      data: {
        id: updatedRoute.id,
        routeNumber: updatedRoute.routenumber,
        status: updatedRoute.status,
        driverId: updatedRoute.driverid,
        driverName: updatedRoute.drivername
      }
    })

  } catch (error) {
    console.error('❌ [Error] PATCH /api/routes/[id]/driver:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar el conductor',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/routes/[id]/driver
 * Obtiene información del driver actual de la ruta
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.id)
    const { isSuperAdmin, companyId: headerCompanyId } = getCompanyFilter(request)

    if (isNaN(routeId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de ruta inválido'
      }, { status: 400 })
    }

    let query = 'SELECT id, routenumber, status, driverid, drivername FROM routes WHERE id = $1'
    const queryParams: (number | string)[] = [routeId]

    if (!isSuperAdmin && headerCompanyId) {
      query += ' AND company_id = $2'
      queryParams.push(headerCompanyId)
    }

    const result = await db.query(query, queryParams)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ruta no encontrada'
      }, { status: 404 })
    }

    const route = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        routeId: route.id,
        routeNumber: route.routenumber,
        status: route.status,
        driverId: route.driverid,
        driverName: route.drivername,
        canChangeDriver: ['planificada', 'planning', 'asignada'].includes(route.status)
      }
    })

  } catch (error) {
    console.error('❌ [Error] GET /api/routes/[id]/driver:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener información del conductor'
    }, { status: 500 })
  }
}
