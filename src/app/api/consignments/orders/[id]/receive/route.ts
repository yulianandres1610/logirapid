import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface ReceiveRequest {
  receiverWarehouseId: number
  items?: {
    id: number
    quantityReceived: number
  }[]
  receiverNotes?: string
}

/**
 * POST /api/consignments/orders/[id]/receive
 * Receive a consignment order in warehouse (as receiver)
 * This happens after the provider has sent the order (in_transit status)
 * This adds the products to the receiver's inventory
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
    const { receiverWarehouseId, items, receiverNotes } = body

    if (!receiverWarehouseId) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar un almacén de destino'
      }, { status: 400 })
    }

    // Verify warehouse belongs to current company
    const warehouseCheck = await db.query(`
      SELECT id, name FROM market_warehouses
      WHERE id = $1 AND company_id = $2
    `, [receiverWarehouseId, currentCompanyId])

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'El almacén seleccionado no pertenece a su empresa'
      }, { status: 400 })
    }

    // Verify order exists and is in transit for current company as receiver
    const orderCheck = await db.query(`
      SELECT
        co.id,
        co.status,
        co.order_number,
        co.provider_company_id,
        p.legalname as provider_name
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

    // Can only receive from in_transit status
    if (order.status !== 'in_transit') {
      return NextResponse.json({
        success: false,
        error: order.status === 'received'
          ? 'Esta consignación ya fue recibida'
          : 'Esta consignación no está en tránsito'
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
          SELECT id, quantity_on_hand FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
        `, [receiverWarehouseId, orderItem.product_id])

        if (stockCheck.rows.length > 0) {
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = quantity_on_hand + $1,
                updated_at = NOW()
            WHERE id = $2
          `, [quantityReceived, stockCheck.rows[0].id])
        } else {
          await db.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id,
              product_id,
              quantity_on_hand,
              quantity_reserved,
              created_at
            ) VALUES ($1, $2, $3, 0, NOW())
          `, [receiverWarehouseId, orderItem.product_id, quantityReceived])
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
            receiver_warehouse_id = $1,
            receiver_notes = COALESCE($2, receiver_notes),
            received_by = $3,
            received_at = NOW(),
            actual_delivery_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = $4
      `, [receiverWarehouseId, receiverNotes || null, userId, id])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Consignación ${order.order_number} recibida en ${warehouseCheck.rows[0].name}`,
        data: {
          id: order.id,
          orderNumber: order.order_number,
          status: 'received',
          itemsReceived: orderItems.rows.length,
          warehouseName: warehouseCheck.rows[0].name
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
