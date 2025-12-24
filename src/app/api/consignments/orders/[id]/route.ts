import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * GET /api/consignments/orders/[id]
 * Get a single consignment order with all details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const currentCompanyId = companyIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { id } = await params

    // Get order with company details
    const orderResult = await db.query(`
      SELECT
        co.*,
        provider.name as provider_name,
        provider.phone as provider_phone,
        provider.email as provider_email,
        provider.address as provider_address,
        provider.logo_url as provider_logo,
        receiver.name as receiver_name,
        receiver.phone as receiver_phone,
        receiver.email as receiver_email,
        receiver.address as receiver_address,
        receiver.logo_url as receiver_logo,
        pw.name as provider_warehouse_name,
        pw.address as provider_warehouse_address,
        rw.name as receiver_warehouse_name,
        rw.address as receiver_warehouse_address,
        creator.name as created_by_name,
        approver.name as approved_by_name,
        receiver_user.name as received_by_name
      FROM consignment_orders co
      LEFT JOIN companies provider ON provider.id = co.provider_company_id
      LEFT JOIN companies receiver ON receiver.id = co.receiver_company_id
      LEFT JOIN market_warehouses pw ON pw.id = co.provider_warehouse_id
      LEFT JOIN market_warehouses rw ON rw.id = co.receiver_warehouse_id
      LEFT JOIN users creator ON creator.id = co.created_by
      LEFT JOIN users approver ON approver.id = co.approved_by
      LEFT JOIN users receiver_user ON receiver_user.id = co.received_by
      WHERE co.id = $1
        AND (co.provider_company_id = $2 OR co.receiver_company_id = $2)
    `, [id, currentCompanyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Consignación no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get order items with product details
    const itemsResult = await db.query(`
      SELECT
        coi.*,
        mp.name as product_name,
        mp.sku as product_sku,
        mp.barcode as product_barcode,
        mp.image_url as product_image,
        mp.unit_type as product_unit
      FROM consignment_order_items coi
      LEFT JOIN market_products mp ON mp.id = coi.product_id
      WHERE coi.consignment_order_id = $1
      ORDER BY coi.id
    `, [id])

    const isProvider = String(order.provider_company_id) === String(currentCompanyId)
    const isReceiver = String(order.receiver_company_id) === String(currentCompanyId)

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        provider: {
          id: order.provider_company_id,
          name: order.provider_name,
          phone: order.provider_phone,
          email: order.provider_email,
          address: order.provider_address,
          logoUrl: order.provider_logo
        },
        receiver: {
          id: order.receiver_company_id,
          name: order.receiver_name,
          phone: order.receiver_phone,
          email: order.receiver_email,
          address: order.receiver_address,
          logoUrl: order.receiver_logo
        },
        providerWarehouse: {
          id: order.provider_warehouse_id,
          name: order.provider_warehouse_name,
          address: order.provider_warehouse_address
        },
        receiverWarehouse: order.receiver_warehouse_id ? {
          id: order.receiver_warehouse_id,
          name: order.receiver_warehouse_name,
          address: order.receiver_warehouse_address
        } : null,
        scheduledDeliveryDate: order.scheduled_delivery_date,
        actualDeliveryDate: order.actual_delivery_date,
        subtotal: parseFloat(order.subtotal) || 0,
        totalItems: order.total_items,
        totalUnits: order.total_units,
        providerNotes: order.provider_notes,
        receiverNotes: order.receiver_notes,
        rejectionReason: order.rejection_reason,
        createdBy: order.created_by_name,
        approvedBy: order.approved_by_name,
        receivedBy: order.received_by_name,
        createdAt: order.created_at,
        approvedAt: order.approved_at,
        receivedAt: order.received_at,
        completedAt: order.completed_at,
        isProvider,
        isReceiver,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          product: {
            id: item.product_id,
            name: item.product_name,
            sku: item.product_sku,
            barcode: item.product_barcode,
            imageUrl: item.product_image,
            unit: item.product_unit
          },
          quantity: item.quantity,
          quantityReceived: item.quantity_received,
          quantitySold: item.quantity_sold,
          quantityReturned: item.quantity_returned,
          providerCost: parseFloat(item.provider_cost) || 0,
          providerPrice: parseFloat(item.provider_price) || 0,
          suggestedRetailPrice: item.suggested_retail_price ? parseFloat(item.suggested_retail_price) : null,
          actualRetailPrice: item.actual_retail_price ? parseFloat(item.actual_retail_price) : null,
          subtotal: parseFloat(item.subtotal) || 0,
          // Calculate margins
          providerMargin: item.provider_cost > 0
            ? ((item.provider_price - item.provider_cost) / item.provider_cost * 100).toFixed(1)
            : '0',
          remainingQuantity: item.quantity - (item.quantity_sold || 0) - (item.quantity_returned || 0)
        }))
      }
    })

  } catch (error) {
    console.error('[Consignment Order GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener consignación'
    }, { status: 500 })
  }
}

/**
 * PUT /api/consignments/orders/[id]
 * Update a consignment order (only if in draft status)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const currentCompanyId = companyIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify order exists and is owned by current company
    const orderCheck = await db.query(`
      SELECT id, status FROM consignment_orders
      WHERE id = $1 AND provider_company_id = $2
    `, [id, currentCompanyId])

    if (orderCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Consignación no encontrada'
      }, { status: 404 })
    }

    if (orderCheck.rows[0].status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden editar consignaciones en borrador'
      }, { status: 400 })
    }

    const {
      providerWarehouseId,
      scheduledDeliveryDate,
      providerNotes,
      items
    } = body

    await db.query('BEGIN')

    try {
      // If items are provided, update them
      if (items && items.length > 0) {
        // Delete existing items
        await db.query(`
          DELETE FROM consignment_order_items
          WHERE consignment_order_id = $1
        `, [id])

        // Calculate new totals
        let subtotal = 0
        let totalUnits = 0

        for (const item of items) {
          const itemSubtotal = item.quantity * item.providerPrice
          subtotal += itemSubtotal
          totalUnits += item.quantity

          await db.query(`
            INSERT INTO consignment_order_items (
              consignment_order_id,
              product_id,
              quantity,
              provider_cost,
              provider_price,
              suggested_retail_price,
              subtotal
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            id,
            item.productId,
            item.quantity,
            item.providerCost,
            item.providerPrice,
            item.suggestedRetailPrice || null,
            itemSubtotal
          ])
        }

        // Update order totals
        await db.query(`
          UPDATE consignment_orders
          SET subtotal = $1,
              total_items = $2,
              total_units = $3,
              provider_warehouse_id = COALESCE($4, provider_warehouse_id),
              scheduled_delivery_date = $5,
              provider_notes = $6,
              updated_at = NOW()
          WHERE id = $7
        `, [
          subtotal,
          items.length,
          totalUnits,
          providerWarehouseId || null,
          scheduledDeliveryDate || null,
          providerNotes || null,
          id
        ])
      } else {
        // Just update metadata
        await db.query(`
          UPDATE consignment_orders
          SET provider_warehouse_id = COALESCE($1, provider_warehouse_id),
              scheduled_delivery_date = $2,
              provider_notes = $3,
              updated_at = NOW()
          WHERE id = $4
        `, [
          providerWarehouseId || null,
          scheduledDeliveryDate || null,
          providerNotes || null,
          id
        ])
      }

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Consignación actualizada'
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Consignment Order PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar consignación'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/consignments/orders/[id]
 * Delete a consignment order (only if in draft status)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const currentCompanyId = companyIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const { id } = await params

    // Verify order exists and is owned by current company
    const orderCheck = await db.query(`
      SELECT id, status, order_number FROM consignment_orders
      WHERE id = $1 AND provider_company_id = $2
    `, [id, currentCompanyId])

    if (orderCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Consignación no encontrada'
      }, { status: 404 })
    }

    if (orderCheck.rows[0].status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden eliminar consignaciones en borrador'
      }, { status: 400 })
    }

    // Delete order (items will cascade)
    await db.query(`
      DELETE FROM consignment_orders WHERE id = $1
    `, [id])

    return NextResponse.json({
      success: true,
      message: `Consignación ${orderCheck.rows[0].order_number} eliminada`
    })

  } catch (error) {
    console.error('[Consignment Order DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar consignación'
    }, { status: 500 })
  }
}
