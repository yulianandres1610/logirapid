import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface ReceiveRequest {
  items?: {
    id: number
    quantityReceived: number
  }[]
  receiverNotes?: string
}

/**
 * POST /api/consignments/orders/[id]/receive
 * Confirm physical receipt of products (if approval was separate)
 * Allows adjusting received quantities if different from sent
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const userIdCookie = cookieStore.get('user-id')
    const currentCompanyId = companyIdCookie?.value
    const userId = userIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { id } = await params
    const body: ReceiveRequest = await request.json()
    const { items, receiverNotes } = body

    // Verify order exists and is in transit for current company as receiver
    const orderCheck = await db.query(`
      SELECT
        co.id,
        co.status,
        co.order_number,
        co.receiver_warehouse_id,
        co.provider_company_id,
        p.name as provider_name
      FROM consignment_orders co
      LEFT JOIN companies p ON p.id = co.provider_company_id
      WHERE co.id = $1 AND co.receiver_company_id = $2
    `, [id, currentCompanyId])

    if (orderCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Consignación no encontrada'
      }, { status: 404 })
    }

    const order = orderCheck.rows[0]

    // Can receive from approved or in_transit status
    if (!['approved', 'in_transit'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: 'Esta consignación no está lista para recibir'
      }, { status: 400 })
    }

    if (!order.receiver_warehouse_id) {
      return NextResponse.json({
        success: false,
        error: 'No se ha asignado un almacén de destino'
      }, { status: 400 })
    }

    await db.query('BEGIN')

    try {
      // Get all order items
      const orderItems = await db.query(`
        SELECT id, product_id, quantity FROM consignment_order_items
        WHERE consignment_order_id = $1
      `, [id])

      // Process received quantities
      for (const orderItem of orderItems.rows) {
        const receivedItem = items?.find(i => i.id === orderItem.id)
        const quantityReceived = receivedItem?.quantityReceived ?? orderItem.quantity

        // Update received quantity
        await db.query(`
          UPDATE consignment_order_items
          SET quantity_received = $1
          WHERE id = $2
        `, [quantityReceived, orderItem.id])

        // Add to warehouse stock
        const stockCheck = await db.query(`
          SELECT id, quantity FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
        `, [order.receiver_warehouse_id, orderItem.product_id])

        if (stockCheck.rows.length > 0) {
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity = quantity + $1,
                updated_at = NOW()
            WHERE id = $2
          `, [quantityReceived, stockCheck.rows[0].id])
        } else {
          await db.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id,
              product_id,
              quantity,
              min_stock,
              max_stock,
              created_at
            ) VALUES ($1, $2, $3, 0, 0, NOW())
          `, [order.receiver_warehouse_id, orderItem.product_id, quantityReceived])
        }
      }

      // Ensure wallet exists
      await db.query(`
        INSERT INTO consignment_wallets (provider_company_id, receiver_company_id)
        VALUES ($1, $2)
        ON CONFLICT (provider_company_id, receiver_company_id)
        DO UPDATE SET updated_at = NOW()
      `, [order.provider_company_id, currentCompanyId])

      // Update order status
      await db.query(`
        UPDATE consignment_orders
        SET status = 'received',
            receiver_notes = COALESCE($1, receiver_notes),
            received_by = $2,
            received_at = NOW(),
            actual_delivery_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = $3
      `, [receiverNotes || null, userId, id])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Consignación ${order.order_number} recibida exitosamente`,
        data: {
          id: order.id,
          orderNumber: order.order_number,
          status: 'received',
          itemsReceived: orderItems.rows.length
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Consignment Receive] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al recibir consignación'
    }, { status: 500 })
  }
}
