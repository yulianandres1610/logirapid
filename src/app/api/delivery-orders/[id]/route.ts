import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * GET: Obtener detalles completos de una orden de entrega
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden no proporcionado'
      }, { status: 400 })
    }

    // Get order details
    const orderQuery = `
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
        createdby as "createdBy",
        createdat as "createdAt",
        updatedat as "updatedAt",
        order_type as "orderType"
      FROM package_orders
      WHERE id = $1 AND order_type = 'entrega_empaques'
    `

    const orderResult = await db.query(orderQuery, [id])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de entrega no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get empaques assigned to this order
    const empaquesQuery = `
      SELECT
        e.id,
        e.codigo,
        e.package_size_id as "packageSizeId",
        ps.name as "packageSizeName",
        ps.dimensions,
        ps.weight,
        e.estado,
        e.recipient_name as "recipientName",
        e.recipient_address as "recipientAddress",
        e.delivery_order_id as "deliveryOrderId",
        e.delivery_order_number as "deliveryOrderNumber",
        e.warehouse_id as "warehouseId",
        w.name as "warehouseName",
        e.createdat as "createdAt",
        e.updatedat as "updatedAt"
      FROM empaques e
      LEFT JOIN package_sizes ps ON e.package_size_id = ps.id
      LEFT JOIN warehouses w ON e.warehouse_id = w.id
      WHERE e.delivery_order_id = $1
      ORDER BY e.createdat DESC
    `

    const empaquesResult = await db.query(empaquesQuery, [id])

    // Group empaques by package size
    const empaquesBySize: Record<string, any> = {}
    empaquesResult.rows.forEach(empaque => {
      const sizeId = empaque.packageSizeId
      if (!empaquesBySize[sizeId]) {
        empaquesBySize[sizeId] = {
          packageSizeId: sizeId,
          packageSizeName: empaque.packageSizeName,
          dimensions: empaque.dimensions,
          weight: empaque.weight,
          quantity: 0,
          empaques: []
        }
      }
      empaquesBySize[sizeId].quantity++
      empaquesBySize[sizeId].empaques.push(empaque)
    })

    // Get warehouse details
    const warehouseQuery = `
      SELECT
        id,
        name,
        address,
        city,
        state,
        latitude,
        longitude
      FROM warehouses
      WHERE id = $1
    `

    const warehouseResult = await db.query(warehouseQuery, [order.warehouseId])
    const warehouse = warehouseResult.rows[0] || null

    // Build response
    const response = {
      order: {
        ...order,
        empaquesCount: empaquesResult.rows.length
      },
      empaques: empaquesResult.rows,
      empaquesBySize: Object.values(empaquesBySize),
      warehouse,
      summary: {
        totalEmpaques: empaquesResult.rows.length,
        packageSizeTypes: Object.keys(empaquesBySize).length,
        status: order.status,
        isScheduled: !!order.scheduledDate,
        hasCoordinates: !!order.latitude && !!order.longitude
      }
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('Error fetching delivery order details:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

/**
 * PATCH: Actualizar estado de una orden de entrega
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden no proporcionado'
      }, { status: 400 })
    }

    return await db.transaction(async (client) => {
      // Check if order exists
      const orderCheck = await client.query(
        `SELECT id, status, ordernumber as "orderNumber"
         FROM package_orders
         WHERE id = $1 AND order_type = 'entrega_empaques'`,
        [id]
      )

      if (orderCheck.rows.length === 0) {
        throw new Error('Orden de entrega no encontrada')
      }

      const currentOrder = orderCheck.rows[0]

      // Build update query dynamically
      const updates: string[] = []
      const values: any[] = []
      let paramCount = 1

      if (body.status !== undefined) {
        values.push(body.status)
        updates.push(`status = $${paramCount++}`)

        // If status changes to 'in_transit' or 'delivered', update empaques estado
        if (body.status === 'in_transit') {
          await client.query(
            `UPDATE empaques
             SET estado = 'en_ruta_entrega'
             WHERE delivery_order_id = $1 AND estado = 'asignado_entrega'`,
            [id]
          )
        } else if (body.status === 'delivered') {
          await client.query(
            `UPDATE empaques
             SET estado = 'entregado_cliente'
             WHERE delivery_order_id = $1 AND estado IN ('asignado_entrega', 'en_ruta_entrega')`,
            [id]
          )
        }
      }

      if (body.scheduledDate !== undefined) {
        values.push(body.scheduledDate)
        updates.push(`scheduleddate = $${paramCount++}`)
      }

      if (body.timeSlot !== undefined) {
        values.push(body.timeSlot)
        updates.push(`timeslot = $${paramCount++}`)
      }

      if (body.deliveryInstructions !== undefined) {
        values.push(body.deliveryInstructions)
        updates.push(`notes = $${paramCount++}`)
      }

      if (body.latitude !== undefined) {
        values.push(body.latitude)
        updates.push(`latitude = $${paramCount++}`)
      }

      if (body.longitude !== undefined) {
        values.push(body.longitude)
        updates.push(`longitude = $${paramCount++}`)
      }

      if (updates.length === 0) {
        throw new Error('No hay campos para actualizar')
      }

      // Add updated timestamp
      updates.push(`updatedat = NOW()`)

      // Add ID as last parameter
      values.push(id)
      const updateQuery = `
        UPDATE package_orders
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `

      const result = await client.query(updateQuery, values)
      const updatedOrder = result.rows[0]

      return NextResponse.json({
        success: true,
        data: {
          id: updatedOrder.id,
          orderNumber: updatedOrder.ordernumber,
          status: updatedOrder.status,
          scheduledDate: updatedOrder.scheduleddate,
          timeSlot: updatedOrder.timeslot,
          deliveryInstructions: updatedOrder.notes,
          latitude: updatedOrder.latitude,
          longitude: updatedOrder.longitude,
          updatedAt: updatedOrder.updatedat
        },
        message: `Orden ${updatedOrder.ordernumber} actualizada exitosamente`
      })
    })

  } catch (error) {
    console.error('Error updating delivery order:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

/**
 * DELETE: Cancelar una orden de entrega
 * - Solo se pueden cancelar órdenes en estado 'pending'
 * - Libera los empaques asignados
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden no proporcionado'
      }, { status: 400 })
    }

    return await db.transaction(async (client) => {
      // Check if order exists and can be canceled
      const orderCheck = await client.query(
        `SELECT id, status, ordernumber as "orderNumber"
         FROM package_orders
         WHERE id = $1 AND order_type = 'entrega_empaques'`,
        [id]
      )

      if (orderCheck.rows.length === 0) {
        throw new Error('Orden de entrega no encontrada')
      }

      const order = orderCheck.rows[0]

      if (order.status !== 'pending') {
        throw new Error(`No se puede cancelar una orden en estado '${order.status}'. Solo se pueden cancelar órdenes pendientes.`)
      }

      // Release empaques back to warehouse inventory
      await client.query(
        `UPDATE empaques
         SET estado = 'disponible_almacen',
             delivery_order_id = NULL,
             delivery_order_number = NULL,
             recipient_name = NULL,
             recipient_address = NULL
         WHERE delivery_order_id = $1`,
        [id]
      )

      // Update order status to canceled
      await client.query(
        `UPDATE package_orders
         SET status = 'cancelled',
             updatedat = NOW()
         WHERE id = $1`,
        [id]
      )

      return NextResponse.json({
        success: true,
        message: `Orden ${order.orderNumber} cancelada exitosamente. Los empaques han sido liberados al inventario.`
      })
    })

  } catch (error) {
    console.error('Error canceling delivery order:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
