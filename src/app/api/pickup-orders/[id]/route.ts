import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/pickup-orders/[id]
 * Obtiene detalles completos de una orden de recogida incluyendo:
 * - Datos de la orden
 * - Zona calculada por zipCode
 * - Información de ruta si está asignada
 * - Empaques asociados con trazabilidad
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'ID de orden inválido' },
        { status: 400 }
      )
    }

    // 1. Obtener orden básica (recogida o entrega - ambas necesitan detalles)
    const orderQuery = `
      SELECT
        po.*,
        c.firstname,
        c.lastname,
        c.phone as customer_phone,
        c.email as customer_email
      FROM package_orders po
      LEFT JOIN customers c ON po.customerid = c.id
      WHERE po.id = $1 AND po.order_type IN ('recogida', 'entrega')
    `
    const orderResult = await db.query(orderQuery, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const order = orderResult.rows[0]

    // 2. Extraer zipCode de la dirección para calcular zona
    let zipCode: string | null = null
    let parsedAddress: any = {}

    try {
      if (order.customeraddress) {
        // Intentar parsear como JSON
        if (typeof order.customeraddress === 'string' && order.customeraddress.startsWith('{')) {
          parsedAddress = JSON.parse(order.customeraddress)
          zipCode = parsedAddress.zipCode || parsedAddress.zip || null
        } else {
          // Si es string, extraer zipCode con regex
          const zipMatch = order.customeraddress.match(/\b\d{5}(-\d{4})?\b/)
          zipCode = zipMatch ? zipMatch[0] : null
        }
      }
    } catch (e) {
      console.error('Error parsing address:', e)
    }

    // 3. Buscar zona por zipCode
    let zone = null
    if (zipCode) {
      const zoneQuery = `
        SELECT id, name, description, zipcodes, color, timeslot, status
        FROM zones
        WHERE status = 'active'
        AND zipcodes::jsonb @> $1::jsonb
        LIMIT 1
      `
      const zoneResult = await db.query(zoneQuery, [JSON.stringify([zipCode])])
      if (zoneResult.rows.length > 0) {
        zone = zoneResult.rows[0]
      }
    }

    // 4. Buscar ruta asignada
    let route = null
    if (order.routeid) {
      const routeQuery = `
        SELECT
          r.id,
          r."routeNumber",
          r.name,
          r."driverId",
          r."driverName",
          r."vehicleId",
          r."vehiclePlate",
          r.status,
          r."totalPackages",
          r."deliveredPackages",
          r.distance,
          r.date,
          r."optimizedRoute",
          r.stops,
          r."warehouseId"
        FROM routes r
        WHERE r.id = $1
      `
      const routeResult = await db.query(routeQuery, [order.routeid])
      if (routeResult.rows.length > 0) {
        route = routeResult.rows[0]

        // Parsear stops y optimizedRoute
        try {
          if (route.stops && typeof route.stops === 'string') {
            route.stops = JSON.parse(route.stops)
          }
          if (route.optimizedRoute && typeof route.optimizedRoute === 'string') {
            route.optimizedRoute = JSON.parse(route.optimizedRoute)
          }
        } catch (e) {
          console.error('Error parsing route data:', e)
        }
      }
    }

    // 5. Buscar empaques asociados
    const empaquesQuery = `
      SELECT
        e.id,
        e.codigo,
        e.warehouse_id,
        e.estado,
        e.order_number,
        e.service_name,
        e.recipient_name,
        e.recipient_city,
        e.recipient_state,
        e.weight_lb,
        e.weight_kg,
        e.box_number,
        e.total_boxes,
        e.updated_at,
        e.updated_by_user_name,
        w.name as warehouse_name
      FROM empaques e
      LEFT JOIN warehouses w ON e.warehouse_id = w.id
      WHERE e.order_number = $1
      ORDER BY e.box_number ASC
    `
    const empaquesResult = await db.query(empaquesQuery, [order.ordernumber])

    // 6. Para cada empaque, obtener trazabilidad
    const empaques = []
    for (const empaque of empaquesResult.rows) {
      const trazQuery = `
        SELECT
          accion,
          fecha,
          warehouse_name,
          notas,
          usuario_nombre
        FROM empaque_trazabilidad
        WHERE empaque_id = $1
        ORDER BY fecha DESC
      `
      const trazResult = await db.query(trazQuery, [empaque.id])

      empaques.push({
        ...empaque,
        trazabilidad: trazResult.rows
      })
    }

    // 7. Parsear campos JSON
    try {
      if (order.services && typeof order.services === 'string') {
        order.services = JSON.parse(order.services)
      }
      if (order.boxes && typeof order.boxes === 'string') {
        order.boxes = JSON.parse(order.boxes)
      }
      if (order.servicepackages && typeof order.servicepackages === 'string') {
        order.servicepackages = JSON.parse(order.servicepackages)
      }
    } catch (e) {
      console.error('Error parsing order JSON fields:', e)
    }

    // 8. Construir respuesta completa
    const response = {
      success: true,
      data: {
        // Datos de la orden
        order: {
          id: order.id,
          orderNumber: order.ordernumber,
          customerId: order.customerid,
          customerName: order.customername || (order.firstname && order.lastname ? `${order.firstname} ${order.lastname}` : order.firstname || order.lastname || 'Sin nombre'),
          customerAddress: order.customeraddress,
          customerPhone: order.customer_phone,
          customerEmail: order.customer_email,
          services: order.services || [],
          status: order.status,
          scheduledDate: order.scheduleddate,
          timeSlot: order.timeslot,
          latitude: order.latitude,
          longitude: order.longitude,
          totalAmount: order.totalamount,
          boxCount: order.boxcount || 0,
          createdAt: order.createdat,
          notes: order.notes,
          pickupInstructions: order.customernotes,
          warehouseId: order.warehouse_id,
          warehouseName: order.warehouse_name,
          routeId: order.routeid,
          stopNumber: order.stopnumber
        },
        // Información de zona
        zone: zone ? {
          id: zone.id,
          name: zone.name,
          description: zone.description,
          zipCodes: zone.zipcodes,
          color: zone.color,
          timeSlot: zone.timeslot
        } : null,
        zipCode,
        // Información de ruta
        route: route ? {
          id: route.id,
          routeNumber: route.routeNumber,
          name: route.name,
          driverId: route.driverId,
          driverName: route.driverName,
          vehicleId: route.vehicleId,
          vehiclePlate: route.vehiclePlate,
          status: route.status,
          totalPackages: route.totalPackages,
          deliveredPackages: route.deliveredPackages,
          distance: route.distance,
          date: route.date,
          stops: route.stops || [],
          optimizedRoute: route.optimizedRoute,
          warehouseId: route.warehouseId
        } : null,
        // Empaques con trazabilidad
        empaques: empaques.map(e => ({
          id: e.id,
          codigo: e.codigo,
          warehouseId: e.warehouse_id,
          warehouseName: e.warehouse_name,
          estado: e.estado,
          serviceName: e.service_name,
          recipientName: e.recipient_name,
          recipientCity: e.recipient_city,
          recipientState: e.recipient_state,
          weightLb: e.weight_lb,
          weightKg: e.weight_kg,
          boxNumber: e.box_number,
          totalBoxes: e.total_boxes,
          updatedAt: e.updated_at,
          updatedByUserName: e.updated_by_user_name,
          trazabilidad: e.trazabilidad || []
        })),
        // Resumen
        summary: {
          totalEmpaques: empaques.length,
          totalWeightLb: empaques.reduce((sum, e) => sum + (parseFloat(e.weight_lb) || 0), 0),
          totalWeightKg: empaques.reduce((sum, e) => sum + (parseFloat(e.weight_kg) || 0), 0),
          hasRoute: !!route,
          hasZone: !!zone
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in GET /api/pickup-orders/[id]:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/pickup-orders/[id]
 * Actualiza una orden de recogida (solo si status = 'pending')
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'ID de orden inválido' },
        { status: 400 }
      )
    }

    // Verificar que la orden existe y está en pending (recogida o entrega)
    const checkQuery = 'SELECT id, status, order_type FROM package_orders WHERE id = $1 AND order_type IN ($2, $3)'
    const checkResult = await db.query(checkQuery, [orderId, 'recogida', 'entrega'])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      )
    }

    const currentOrder = checkResult.rows[0]
    if (currentOrder.status !== 'pending') {
      return NextResponse.json(
        {
          success: false,
          error: 'Solo se pueden editar órdenes en estado pendiente',
          currentStatus: currentOrder.status
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      customerName,
      customerAddress,
      customerPhone,
      customerEmail,
      scheduledDate,
      timeSlot,
      services,
      pickupInstructions,
      latitude,
      longitude,
      notes
    } = body

    // Construir update dinámico
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (customerName !== undefined) {
      updates.push(`customername = $${paramCount++}`)
      values.push(customerName)
    }

    if (customerAddress !== undefined) {
      updates.push(`customeraddress = $${paramCount++}`)
      values.push(typeof customerAddress === 'object' ? JSON.stringify(customerAddress) : customerAddress)
    }

    if (customerPhone !== undefined) {
      updates.push(`phone = $${paramCount++}`)
      values.push(customerPhone)
    }

    if (customerEmail !== undefined) {
      updates.push(`email = $${paramCount++}`)
      values.push(customerEmail)
    }

    if (scheduledDate !== undefined) {
      updates.push(`scheduleddate = $${paramCount++}`)
      values.push(scheduledDate)
    }

    if (timeSlot !== undefined) {
      updates.push(`timeslot = $${paramCount++}`)
      values.push(timeSlot)
    }

    if (services !== undefined) {
      updates.push(`services = $${paramCount++}`)
      values.push(JSON.stringify(services))
    }

    if (pickupInstructions !== undefined) {
      updates.push(`customernotes = $${paramCount++}`)
      values.push(pickupInstructions)
    }

    if (latitude !== undefined) {
      updates.push(`latitude = $${paramCount++}`)
      values.push(latitude)
    }

    if (longitude !== undefined) {
      updates.push(`longitude = $${paramCount++}`)
      values.push(longitude)
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`)
      values.push(notes)
    }

    // Agregar timestamp de actualización
    updates.push(`updatedat = CURRENT_TIMESTAMP`)

    if (updates.length === 1) { // Solo tiene el timestamp
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron campos para actualizar' },
        { status: 400 }
      )
    }

    // Agregar ID al final
    values.push(orderId)

    const updateQuery = `
      UPDATE package_orders
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `

    const result = await db.query(updateQuery, values)

    return NextResponse.json({
      success: true,
      message: 'Orden actualizada exitosamente',
      data: result.rows[0]
    })
  } catch (error) {
    console.error('Error in PATCH /api/pickup-orders/[id]:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
