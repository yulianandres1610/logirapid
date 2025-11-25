import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/orders/create-return
 * Crea una orden de retorno (recogida) basada en una entrega de cajas vacías previa
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const companyId = request.headers.get('x-company-id')
    const userName = request.headers.get('x-user-name') || 'Sistema'

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID requerido en headers' },
        { status: 400 }
      )
    }

    const {
      parentOrderId,
      selectedBoxIds,
      pickupDate,
      pickupTime,
      // Información que puede ser editada
      senderName,
      senderPhone,
      senderEmail,
      recipientName,
      recipientPhone,
      recipientEmail,
      pickupAddress,
      pickupCity,
      pickupState,
      pickupZipcode,
      pickupLatitude,
      pickupLongitude,
      deliveryAddress,
      deliveryCity,
      deliveryState,
      deliveryZipcode,
      deliveryLatitude,
      deliveryLongitude,
      notes
    } = body

    // Validaciones
    if (!parentOrderId || !selectedBoxIds || selectedBoxIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos' },
        { status: 400 }
      )
    }

    // Iniciar transacción
    await db.query('BEGIN')

    try {
      // Verificar orden padre existe y tiene cajas pendientes
      const parentOrderQuery = `
        SELECT
          id,
          order_number,
          boxes_delivered,
          boxes_returned,
          pending_return,
          sender_customer_id
        FROM package_orders
        WHERE id = $1 AND company_id = $2 AND order_type = 'entrega_cajas_vacias'
      `
      const parentOrderResult = await db.query(parentOrderQuery, [parentOrderId, companyId])

      if (parentOrderResult.rows.length === 0) {
        throw new Error('Orden padre no encontrada')
      }

      const parentOrder = parentOrderResult.rows[0]

      // Verificar que las cajas seleccionadas pertenecen a esta orden
      const boxesQuery = `
        SELECT id, tracking_number, box_type
        FROM empaques
        WHERE id = ANY($1)
        AND delivery_order_id = $2
        AND return_order_id IS NULL
      `
      const boxesResult = await db.query(boxesQuery, [selectedBoxIds, parentOrderId])

      if (boxesResult.rows.length !== selectedBoxIds.length) {
        throw new Error('Algunas cajas no están disponibles para retorno')
      }

      const boxesCount = selectedBoxIds.length

      // Generar número de orden de retorno
      const orderNumberQuery = `
        SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '[0-9]+$') AS INTEGER)), 0) + 1 as next_number
        FROM package_orders
        WHERE company_id = $1
      `
      const orderNumberResult = await db.query(orderNumberQuery, [companyId])
      const orderNumber = `RET-${String(orderNumberResult.rows[0].next_number).padStart(6, '0')}`

      // Crear orden de retorno
      const createOrderQuery = `
        INSERT INTO package_orders (
          company_id,
          order_number,
          order_type,
          parent_order_id,
          sender_customer_id,
          sender_name,
          sender_phone,
          sender_email,
          recipient_name,
          recipient_phone,
          recipient_email,
          pickup_address,
          pickup_city,
          pickup_state,
          pickup_zipcode,
          pickup_latitude,
          pickup_longitude,
          delivery_address,
          delivery_city,
          delivery_state,
          delivery_zipcode,
          delivery_latitude,
          delivery_longitude,
          pickup_date,
          pickup_time,
          status,
          boxes_delivered,
          notes,
          created_at
        ) VALUES (
          $1, $2, 'retorno', $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22,
          $23, $24, 'pending', $25, $26, NOW()
        )
        RETURNING id, order_number
      `

      const createOrderResult = await db.query(createOrderQuery, [
        companyId,
        orderNumber,
        parentOrderId,
        parentOrder.sender_customer_id,
        senderName,
        senderPhone,
        senderEmail,
        recipientName,
        recipientPhone,
        recipientEmail,
        pickupAddress,
        pickupCity,
        pickupState,
        pickupZipcode,
        pickupLatitude,
        pickupLongitude,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryZipcode,
        deliveryLatitude,
        deliveryLongitude,
        pickupDate,
        pickupTime,
        boxesCount,
        notes || ''
      ])

      const newOrder = createOrderResult.rows[0]

      // Actualizar cajas seleccionadas
      const updateBoxesQuery = `
        UPDATE empaques
        SET
          return_order_id = $1,
          estado = 'retorno_programado',
          returned_at = NOW(),
          updated_at = NOW()
        WHERE id = ANY($2)
      `
      await db.query(updateBoxesQuery, [newOrder.id, selectedBoxIds])

      // Registrar trazabilidad para cada caja
      for (const box of boxesResult.rows) {
        const trazabilidadQuery = `
          INSERT INTO empaques_trazabilidad (
            empaque_id,
            estado,
            ubicacion,
            descripcion,
            usuario,
            fecha
          ) VALUES ($1, $2, $3, $4, $5, NOW())
        `
        await db.query(trazabilidadQuery, [
          box.id,
          'retorno_programado',
          pickupAddress,
          `Caja programada para retorno en orden ${orderNumber}. Tipo: ${box.box_type}`,
          userName
        ])
      }

      // Actualizar contadores de la orden padre (el trigger también lo hace, pero aseguramos)
      const updateParentQuery = `
        UPDATE package_orders
        SET
          boxes_returned = boxes_returned + $1,
          return_status = CASE
            WHEN boxes_returned + $1 >= boxes_delivered THEN 'complete'
            WHEN boxes_returned + $1 > 0 THEN 'partial'
            ELSE 'pending'
          END,
          pending_return = CASE
            WHEN boxes_returned + $1 >= boxes_delivered THEN FALSE
            ELSE TRUE
          END
        WHERE id = $2
      `
      await db.query(updateParentQuery, [boxesCount, parentOrderId])

      // Commit de la transacción
      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Orden de retorno creada exitosamente',
        data: {
          orderId: newOrder.id,
          orderNumber: newOrder.order_number,
          boxesScheduled: boxesCount
        }
      })

    } catch (transactionError) {
      // Rollback en caso de error
      await db.query('ROLLBACK')
      throw transactionError
    }

  } catch (error) {
    console.error('Error in POST /api/orders/create-return:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
