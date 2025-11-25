import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/orders/pending-returns?phone=XXXXXXXXXX
 * Busca entregas de cajas vacías pendientes de retorno por teléfono del cliente
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const companyId = request.headers.get('x-company-id')

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Número de teléfono requerido' },
        { status: 400 }
      )
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID requerido en headers' },
        { status: 400 }
      )
    }

    // Buscar cliente por teléfono
    const customerQuery = `
      SELECT id, firstname, lastname, phone, email
      FROM customers
      WHERE phone = $1 AND company_id = $2
      LIMIT 1
    `
    const customerResult = await db.query(customerQuery, [phone, companyId])

    if (customerResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    const customer = customerResult.rows[0]

    console.log('[pending-returns] Cliente encontrado:', customer.id, customer.firstname, customer.lastname)

    // Buscar órdenes de entrega de cajas vacías con retorno pendiente
    const ordersQuery = `
      SELECT
        po.id,
        po.ordernumber as "orderNumber",
        po.createdat as "createdAt",
        po.customeraddress as "pickupAddress",
        po.customeraddress as "deliveryAddress",
        po.city as "pickupCity",
        po.state as "pickupState",
        po.zipcode as "pickupZipcode",
        po.city as "deliveryCity",
        po.state as "deliveryState",
        po.zipcode as "deliveryZipcode",
        COALESCE(po.boxes_delivered, 0) as "boxesDelivered",
        COALESCE(po.boxes_returned, 0) as "boxesReturned",
        COALESCE(po.return_status, 'none') as "returnStatus",
        po.customername as "senderName",
        po.phone as "senderPhone",
        po.email as "senderEmail",
        po.firstname || ' ' || po.lastname as "recipientName",
        po.phone as "recipientPhone",
        po.email as "recipientEmail",
        po.latitude as "deliveryLatitude",
        po.longitude as "deliveryLongitude",
        po.latitude as "pickupLatitude",
        po.longitude as "pickupLongitude",
        -- Contar cajas pendientes
        (COALESCE(po.boxes_delivered, 0) - COALESCE(po.boxes_returned, 0)) as "boxesPending"
      FROM package_orders po
      WHERE
        po.order_type = 'entrega'
        AND po.customerid = $1
        AND po.company_id = $2
      ORDER BY po.createdat DESC
    `

    const ordersResult = await db.query(ordersQuery, [customer.id, companyId])

    console.log('[pending-returns] Órdenes encontradas:', ordersResult.rows.length)

    // Si no hay órdenes pendientes, devolver respuesta exitosa con array vacío
    if (ordersResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          customer: {
            id: customer.id,
            firstName: customer.firstname,
            lastName: customer.lastname,
            phone: customer.phone,
            email: customer.email
          },
          pendingOrders: []
        }
      })
    }

    // Para cada orden, obtener detalle de cajas
    const ordersWithBoxes = await Promise.all(
      ordersResult.rows.map(async (order) => {
        // Obtener cajas disponibles para retorno
        const boxesQuery = `
          SELECT
            id,
            tracking_number as "trackingNumber",
            box_type as "boxType",
            estado as "status",
            ubicacion_actual as "currentLocation"
          FROM empaques
          WHERE
            delivery_order_id = $1
            AND estado IN ('entregada_vacia', 'en_cliente_vacia', 'en_cliente_llena')
            AND return_order_id IS NULL
          ORDER BY id
        `
        const boxesResult = await db.query(boxesQuery, [order.id])

        return {
          ...order,
          availableBoxes: boxesResult.rows
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          firstName: customer.firstname,
          lastName: customer.lastname,
          phone: customer.phone,
          email: customer.email
        },
        pendingOrders: ordersWithBoxes
      }
    })

  } catch (error) {
    console.error('Error in GET /api/orders/pending-returns:', error)
    console.error('Error details:', error instanceof Error ? error.message : error)
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
