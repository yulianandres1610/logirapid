import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * POST: Crear orden de entrega de empaques vacíos
 *
 * Flujo:
 * 1. Validar inventario disponible en el almacén
 * 2. Crear la orden en package_orders con order_type='entrega_empaques'
 * 3. Asignar empaques específicos (actualizar estado a 'asignado_entrega')
 * 4. Vincular empaques con la orden (delivery_order_id, delivery_order_number)
 * 5. Actualizar inventario (trigger automático)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('POST /api/delivery-orders received body:', body)

    // ================================================
    // 1. VALIDACIONES
    // ================================================

    if (!body.orderNumber || !body.customerName || !body.customerAddress || !body.warehouseId) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos: orderNumber, customerName, customerAddress, warehouseId'
      }, { status: 400 })
    }

    // Validate order number format
    if (!body.orderNumber.startsWith('DELIVERY')) {
      return NextResponse.json({
        success: false,
        error: 'Las órdenes de entrega deben tener un número que comience con DELIVERY'
      }, { status: 400 })
    }

    // Validate empaques array
    if (!body.empaques || !Array.isArray(body.empaques) || body.empaques.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe especificar al menos un empaque para entregar'
      }, { status: 400 })
    }

    return await db.transaction(async (client) => {
      // ================================================
      // 2. VERIFICAR INVENTARIO DISPONIBLE
      // ================================================

      for (const empaqueRequest of body.empaques) {
        const { package_size_id, quantity, codigos } = empaqueRequest

        if (codigos && codigos.length > 0) {
          // Modo específico: verificar que cada código existe y está disponible
          for (const codigo of codigos) {
            const empaqueCheck = await client.query(
              `SELECT id, estado, warehouse_id
               FROM empaques
               WHERE codigo = $1`,
              [codigo]
            )

            if (empaqueCheck.rows.length === 0) {
              throw new Error(`El empaque con código ${codigo} no existe`)
            }

            const empaque = empaqueCheck.rows[0]

            if (empaque.estado !== 'disponible_almacen') {
              throw new Error(`El empaque ${codigo} no está disponible (estado actual: ${empaque.estado})`)
            }

            if (parseInt(empaque.warehouse_id) !== parseInt(body.warehouseId)) {
              throw new Error(`El empaque ${codigo} no pertenece al almacén seleccionado`)
            }
          }
        } else {
          // Modo automático: verificar inventario disponible
          const inventoryCheck = await client.query(
            `SELECT available_quantity
             FROM empaque_inventory
             WHERE warehouse_id = $1 AND package_size_id = $2`,
            [body.warehouseId, package_size_id]
          )

          if (inventoryCheck.rows.length === 0) {
            throw new Error('No hay inventario configurado para este tamaño de empaque en el almacén')
          }

          const available = inventoryCheck.rows[0].available_quantity

          if (available < quantity) {
            throw new Error(`Inventario insuficiente. Solicitado: ${quantity}, Disponible: ${available}`)
          }
        }
      }

      // ================================================
      // 3. CREAR ORDEN DE ENTREGA
      // ================================================

      // Get warehouse info
      const warehouseResult = await client.query(
        'SELECT name FROM warehouses WHERE id = $1',
        [body.warehouseId]
      )

      const warehouseName = warehouseResult.rows[0]?.name || 'Unknown Warehouse'

      // Prepare services JSON (empty for delivery orders)
      const servicesJson = JSON.stringify([])

      const insertOrderQuery = `
        INSERT INTO package_orders (
          customername, customeraddress, ordernumber,
          services, notes, scheduleddate, timeslot, status,
          createdby, latitude, longitude,
          warehouse_id, warehouse_name, order_type,
          createdat, updatedat
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7, $8,
          $9, $10, $11,
          $12, $13, $14,
          NOW(), NOW()
        )
        RETURNING *
      `

      const orderValues = [
        body.customerName,
        body.customerAddress,
        body.orderNumber,
        servicesJson,
        body.deliveryInstructions || null,
        body.scheduledDate || null,
        body.timeSlot || null,
        'pending', // initial status
        body.createdBy || 'system',
        body.latitude || null,
        body.longitude || null,
        body.warehouseId,
        warehouseName,
        'entrega_empaques'
      ]

      const orderResult = await client.query(insertOrderQuery, orderValues)
      const newOrder = orderResult.rows[0]

      // ================================================
      // 4. ASIGNAR EMPAQUES A LA ORDEN
      // ================================================

      const assignedEmpaques = []

      for (const empaqueRequest of body.empaques) {
        const { package_size_id, quantity, codigos } = empaqueRequest

        let empaquesToAssign = []

        if (codigos && codigos.length > 0) {
          // Modo específico: usar códigos proporcionados
          empaquesToAssign = codigos
        } else {
          // Modo automático: seleccionar empaques disponibles
          const selectEmpaques = await client.query(
            `SELECT codigo
             FROM empaques
             WHERE warehouse_id = $1
               AND package_size_id = $2
               AND estado = 'disponible_almacen'
             LIMIT $3`,
            [body.warehouseId, package_size_id, quantity]
          )

          empaquesToAssign = selectEmpaques.rows.map(row => row.codigo)

          if (empaquesToAssign.length < quantity) {
            throw new Error(`No se pudieron encontrar suficientes empaques disponibles. Necesarios: ${quantity}, Encontrados: ${empaquesToAssign.length}`)
          }
        }

        // Actualizar estado de empaques y vincular con la orden
        for (const codigo of empaquesToAssign) {
          await client.query(
            `UPDATE empaques
             SET estado = 'asignado_entrega',
                 delivery_order_id = $1,
                 delivery_order_number = $2,
                 recipient_name = $3,
                 recipient_address = $4
             WHERE codigo = $5`,
            [newOrder.id, newOrder.ordernumber, body.customerName, body.customerAddress, codigo]
          )

          assignedEmpaques.push(codigo)
        }
      }

      // ================================================
      // 5. RESPUESTA EXITOSA
      // ================================================

      const formattedOrder = {
        id: newOrder.id,
        orderNumber: newOrder.ordernumber,
        customerName: newOrder.customername,
        customerAddress: newOrder.customeraddress,
        warehouseId: newOrder.warehouse_id,
        warehouseName: newOrder.warehouse_name,
        scheduledDate: newOrder.scheduleddate,
        timeSlot: newOrder.timeslot,
        deliveryInstructions: newOrder.notes,
        status: newOrder.status,
        orderType: newOrder.order_type,
        latitude: newOrder.latitude,
        longitude: newOrder.longitude,
        createdAt: newOrder.createdat,
        assignedEmpaques: assignedEmpaques,
        empaquesCount: assignedEmpaques.length
      }

      console.log('✅ Delivery order created successfully:', formattedOrder)

      return NextResponse.json({
        success: true,
        data: formattedOrder,
        message: `Orden de entrega ${newOrder.ordernumber} creada exitosamente con ${assignedEmpaques.length} empaque(s)`
      }, { status: 201 })
    })

  } catch (error) {
    console.error('Error creating delivery order:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al crear orden de entrega'
    }, { status: 500 })
  }
}

/**
 * GET: Obtener órdenes de entrega con filtros y paginación
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const searchTerm = searchParams.get('search')
    const statusFilter = searchParams.get('status')
    const warehouseId = searchParams.get('warehouseId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build WHERE conditions
    const conditions = ["order_type = 'entrega_empaques'"]
    const params: any[] = []

    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`
      params.push(searchPattern, searchPattern, searchPattern)
      conditions.push(`(
        ordernumber ILIKE $${params.length - 2} OR
        customername ILIKE $${params.length - 1} OR
        customeraddress::text ILIKE $${params.length}
      )`)
    }

    if (statusFilter && statusFilter !== 'all') {
      params.push(statusFilter)
      conditions.push(`status = $${params.length}`)
    }

    if (warehouseId) {
      params.push(parseInt(warehouseId))
      conditions.push(`warehouse_id = $${params.length}`)
    }

    if (dateFrom) {
      params.push(dateFrom)
      conditions.push(`scheduleddate >= $${params.length}`)
    }

    if (dateTo) {
      params.push(dateTo)
      conditions.push(`scheduleddate <= $${params.length}`)
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`
    const offset = (page - 1) * limit
    params.push(limit, offset)

    const dataQuery = `
      SELECT
        id,
        customername as "customerName",
        customeraddress as "customerAddress",
        ordernumber as "orderNumber",
        scheduleddate as "scheduledDate",
        timeslot as "timeSlot",
        status,
        latitude,
        longitude,
        warehouse_id as "warehouseId",
        warehouse_name as "warehouseName",
        notes as "deliveryInstructions",
        createdat as "createdAt",
        updatedat as "updatedAt",
        COUNT(*) OVER() as total_count
      FROM package_orders
      ${whereClause}
      ORDER BY createdat DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const result = await db.query(dataQuery, params)

    // Get empaques count for each order
    const ordersWithCounts = await Promise.all(
      result.rows.map(async (order) => {
        const countResult = await db.query(
          'SELECT COUNT(*) as count FROM empaques WHERE delivery_order_id = $1',
          [order.id]
        )

        return {
          ...order,
          empaquesCount: parseInt(countResult.rows[0]?.count || '0'),
          total_count: parseInt(order.total_count)
        }
      })
    )

    const totalCount = ordersWithCounts.length > 0 ? ordersWithCounts[0].total_count : 0
    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      success: true,
      data: {
        orders: ordersWithCounts,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: totalCount,
          itemsPerPage: limit
        }
      }
    })

  } catch (error) {
    console.error('Error fetching delivery orders:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
