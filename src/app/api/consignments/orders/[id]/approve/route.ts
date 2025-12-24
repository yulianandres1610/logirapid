import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface ApproveRequest {
  receiverWarehouseId: number
  receiverNotes?: string
  items?: {
    id: number
    actualRetailPrice: number
  }[]
}

/**
 * POST /api/consignments/orders/[id]/approve
 * Approve a pending consignment order (as receiver)
 * This also adds products to the receiver's inventory
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
    const body: ApproveRequest = await request.json()
    const { receiverWarehouseId, receiverNotes, items } = body

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

    // Verify order exists and is pending approval for current company as receiver
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

    if (order.status !== 'pending_approval') {
      return NextResponse.json({
        success: false,
        error: 'Esta consignación no está pendiente de aprobación'
      }, { status: 400 })
    }

    await db.query('BEGIN')

    try {
      // Update retail prices if provided
      if (items && items.length > 0) {
        for (const item of items) {
          await db.query(`
            UPDATE consignment_order_items
            SET actual_retail_price = $1
            WHERE id = $2 AND consignment_order_id = $3
          `, [item.actualRetailPrice, item.id, id])
        }
      }

      // Get all items with product details
      const orderItems = await db.query(`
        SELECT
          coi.*,
          mp.name as product_name,
          mp.sku as product_sku
        FROM consignment_order_items coi
        LEFT JOIN market_products mp ON mp.id = coi.product_id
        WHERE coi.consignment_order_id = $1
      `, [id])

      // Add products to receiver's inventory (warehouse stock)
      // The cost for receiver = provider_price
      for (const item of orderItems.rows) {
        // Check if product already exists in warehouse stock
        const stockCheck = await db.query(`
          SELECT id, quantity FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
        `, [receiverWarehouseId, item.product_id])

        if (stockCheck.rows.length > 0) {
          // Update existing stock
          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity = quantity + $1,
                updated_at = NOW()
            WHERE id = $2
          `, [item.quantity, stockCheck.rows[0].id])
        } else {
          // Create new stock entry
          await db.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id,
              product_id,
              quantity,
              min_stock,
              max_stock,
              created_at
            ) VALUES ($1, $2, $3, 0, 0, NOW())
          `, [receiverWarehouseId, item.product_id, item.quantity])
        }

        // Update quantity_received to match quantity
        await db.query(`
          UPDATE consignment_order_items
          SET quantity_received = quantity
          WHERE id = $1
        `, [item.id])
      }

      // Create or get wallet for this provider-receiver relationship
      const walletResult = await db.query(`
        INSERT INTO consignment_wallets (provider_company_id, receiver_company_id)
        VALUES ($1, $2)
        ON CONFLICT (provider_company_id, receiver_company_id)
        DO UPDATE SET updated_at = NOW()
        RETURNING id
      `, [order.provider_company_id, currentCompanyId])

      // Update order status
      await db.query(`
        UPDATE consignment_orders
        SET status = 'received',
            receiver_warehouse_id = $1,
            receiver_notes = $2,
            approved_by = $3,
            approved_at = NOW(),
            received_by = $3,
            received_at = NOW(),
            actual_delivery_date = CURRENT_DATE,
            updated_at = NOW()
        WHERE id = $4
      `, [receiverWarehouseId, receiverNotes || null, userId, id])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Consignación ${order.order_number} aprobada y recibida en ${warehouseCheck.rows[0].name}`,
        data: {
          id: order.id,
          orderNumber: order.order_number,
          status: 'received',
          itemsReceived: orderItems.rows.length,
          walletId: walletResult.rows[0].id
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Consignment Approve] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al aprobar consignación'
    }, { status: 500 })
  }
}
