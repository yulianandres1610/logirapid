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
 * - Devuelve información detallada de paradas con órdenes y empaques
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

    // ========== OBTENER DATOS DETALLADOS PARA LA APP MÓVIL ==========

    // Obtener la ruta actualizada
    const updatedRouteResult = await db.query(
      'SELECT * FROM routes WHERE id = $1',
      [routeId]
    )
    const updatedRoute = updatedRouteResult.rows[0]

    // Parsear stops actualizados
    let stopsData = updatedRoute.stops
    if (typeof stopsData === 'string') {
      try {
        stopsData = JSON.parse(stopsData)
      } catch {
        stopsData = []
      }
    }
    stopsData = stopsData || []

    // Obtener todos los IDs de órdenes
    const allOrderIds: number[] = []
    for (const stop of stopsData) {
      if (stop.orderId) allOrderIds.push(stop.orderId)
      if (stop.orderIds && Array.isArray(stop.orderIds)) {
        allOrderIds.push(...stop.orderIds)
      }
    }

    // Consultar órdenes con detalles
    const ordersMap = new Map()
    if (allOrderIds.length > 0) {
      const ordersResult = await db.query(`
        SELECT
          id, ordernumber, customername, phone, customeraddress,
          city, state, zipcode, latitude, longitude,
          services, status, totalamount, order_type
        FROM package_orders
        WHERE id = ANY($1::int[])
      `, [allOrderIds])

      for (const order of ordersResult.rows) {
        ordersMap.set(order.id, order)
      }
    }

    // Consultar empaques de todas las órdenes
    const orderNumbers = [...ordersMap.values()].map((o: { ordernumber: string }) => o.ordernumber)
    const empaquesMap = new Map<string, Array<{
      id: number
      codigo: string
      tipo: string
      estado: string
      order_number: string
      service_name: string
      weight_lb: number
      weight_kg: number
      box_number: number
      total_boxes: number
    }>>()

    if (orderNumbers.length > 0) {
      const empaquesResult = await db.query(`
        SELECT
          id, codigo, tipo, estado, order_number, service_name,
          weight_lb, weight_kg, box_number, total_boxes
        FROM empaques
        WHERE order_number = ANY($1::text[])
        ORDER BY box_number ASC
      `, [orderNumbers])

      for (const emp of empaquesResult.rows) {
        if (!empaquesMap.has(emp.order_number)) {
          empaquesMap.set(emp.order_number, [])
        }
        empaquesMap.get(emp.order_number)!.push(emp)
      }
    }

    // Construir paradas detalladas con órdenes y empaques
    interface ServiceType {
      type?: string
      name?: string
      price?: number
      quantity?: number
    }

    const detailedStops = stopsData.map((stop: Record<string, unknown>, index: number) => {
      const stopOrderIds = (stop.orderIds as number[]) || (stop.orderId ? [stop.orderId as number] : [])

      const orders = stopOrderIds.map((orderId: number) => {
        const order = ordersMap.get(orderId)
        if (!order) return null

        // Parsear servicios
        let services = order.services
        if (typeof services === 'string') {
          try {
            services = JSON.parse(services)
          } catch {
            services = []
          }
        }
        services = services || []

        // Agregar empaques a cada servicio
        const orderEmpaques = empaquesMap.get(order.ordernumber) || []
        const servicesWithEmpaques = services.map((service: ServiceType) => ({
          ...service,
          empaques: orderEmpaques.filter((e) =>
            e.service_name === service.name || !e.service_name
          ).map((e) => ({
            id: e.id,
            codigo: e.codigo,
            tipo: e.tipo,
            estado: e.estado,
            weightLb: e.weight_lb,
            weightKg: e.weight_kg,
            boxNumber: e.box_number,
            totalBoxes: e.total_boxes
          }))
        }))

        return {
          id: order.id,
          orderNumber: order.ordernumber,
          senderName: order.customername,
          senderPhone: order.phone,
          senderAddress: order.customeraddress,
          senderCity: order.city,
          senderState: order.state,
          senderZipcode: order.zipcode,
          services: servicesWithEmpaques,
          status: 'en_reparto',
          totalAmount: order.totalamount
        }
      }).filter(Boolean)

      return {
        stopNumber: (stop.stopNumber as number) || index + 1,
        address: stop.address,
        city: stop.city,
        state: stop.state,
        zipcode: stop.zipcode,
        coordinates: stop.coordinates || [stop.longitude, stop.latitude],
        status: 'en_curso',
        orders
      }
    })

    console.log(`🎉 [Completado] Ruta ${route.routenumber} iniciada exitosamente`)

    return NextResponse.json({
      success: true,
      message: `Ruta ${route.routenumber} iniciada exitosamente`,
      data: {
        // Información de la ruta
        id: updatedRoute.id,
        routeNumber: updatedRoute.routenumber,
        status: updatedRoute.status,
        previousStatus: 'asignada',
        startTime: updatedRoute.starttime,

        // Conductor y vehículo
        driverId: updatedRoute.driverid,
        driverName: updatedRoute.drivername,
        vehicleId: updatedRoute.vehicleid || null,
        vehiclePlate: updatedRoute.vehicleplate || null,

        // Métricas
        totalDistance: updatedRoute.totaldistance || null,
        totalDuration: updatedRoute.totalduration || null,
        scheduledDate: updatedRoute.scheduleddate || null,

        // Paradas detalladas
        stops: detailedStops,

        // Resumen
        stopsSummary: {
          total: detailedStops.length,
          pending: 0,
          enCurso: detailedStops.length,
          completed: 0,
          failed: 0
        }
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
