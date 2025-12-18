import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/orders/[id]
 * Get order details with lines
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const orderId = parseInt(id)

    // Get order
    const orderResult = await db.query(`
      SELECT
        mo.*,
        c.legalname as agency_name,
        u.name as rejected_by_name,
        u2.name as delivered_by_name
      FROM market_orders mo
      LEFT JOIN companies c ON mo.selling_company_id = c.id
      LEFT JOIN users u ON mo.rejected_by = u.id
      LEFT JOIN users u2 ON mo.delivered_by = u2.id
      WHERE mo.id = $1 AND mo.market_company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get lines
    const linesResult = await db.query(`
      SELECT
        mol.id,
        mol.product_id,
        mol.product_name,
        mol.product_image,
        mol.quantity,
        mol.unit_price,
        mol.total_price,
        mol.quantity_prepared,
        mol.is_prepared,
        mp.sku as product_sku,
        mp.quantity_on_hand as current_stock
      FROM market_order_lines mol
      LEFT JOIN market_products mp ON mol.product_id = mp.id
      WHERE mol.order_id = $1
      ORDER BY mol.id
    `, [orderId])

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerEmail: order.customer_email,
        deliveryProvince: order.delivery_province,
        deliveryMunicipality: order.delivery_municipality,
        deliveryAddress: order.delivery_address,
        deliveryAddressReferences: order.delivery_address_references,
        deliveryLatitude: order.delivery_latitude ? parseFloat(order.delivery_latitude) : null,
        deliveryLongitude: order.delivery_longitude ? parseFloat(order.delivery_longitude) : null,
        subtotal: parseFloat(order.subtotal) || 0,
        deliveryFee: parseFloat(order.delivery_fee) || 0,
        serviceFee: parseFloat(order.service_fee) || 0,
        totalAmount: parseFloat(order.total_amount) || 0,
        currency: order.currency || 'USD',
        status: order.status,
        estimatedDelivery: order.estimated_delivery,
        acceptedAt: order.accepted_at,
        preparingAt: order.preparing_at,
        readyAt: order.ready_at,
        inDeliveryAt: order.in_delivery_at,
        deliveredAt: order.delivered_at,
        cancelledAt: order.cancelled_at,
        rejectedAt: order.rejected_at,
        rejectionReason: order.rejection_reason,
        rejectionNotes: order.rejection_notes,
        rejectedByName: order.rejected_by_name,
        deliveryProofPhoto: order.delivery_proof_photo,
        deliverySignature: order.delivery_signature,
        deliveryNotes: order.delivery_notes,
        deliveredByName: order.delivered_by_name,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        paymentReference: order.payment_reference,
        agencyName: order.agency_name,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        lines: linesResult.rows.map(line => ({
          id: line.id,
          productId: line.product_id,
          productName: line.product_name,
          productImage: line.product_image,
          productSku: line.product_sku,
          quantity: parseInt(line.quantity) || 0,
          unitPrice: parseFloat(line.unit_price) || 0,
          totalPrice: parseFloat(line.total_price) || 0,
          quantityPrepared: parseInt(line.quantity_prepared) || 0,
          isPrepared: line.is_prepared,
          currentStock: parseInt(line.current_stock) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Market Order API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener orden'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/orders/[id]
 * Update order status (accept, prepare, ready, reject, cancel)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const userId = payload.userId
    const orderId = parseInt(id)

    const body = await request.json()
    const { action, rejectionReason, rejectionNotes, preparedLines } = body

    // Get current order
    const orderResult = await db.query(`
      SELECT id, status, market_company_id FROM market_orders WHERE id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    if (order.market_company_id !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 403 })
    }

    // Handle different actions
    if (action === 'accept') {
      if (order.status !== 'pending') {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden aceptar ordenes pendientes'
        }, { status: 400 })
      }

      await db.query(`
        UPDATE market_orders
        SET status = 'accepted',
            accepted_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `, [orderId])

      return NextResponse.json({
        success: true,
        message: 'Orden aceptada exitosamente'
      })
    }

    if (action === 'prepare') {
      if (order.status !== 'accepted') {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden preparar ordenes aceptadas'
        }, { status: 400 })
      }

      await db.query(`
        UPDATE market_orders
        SET status = 'preparing',
            preparing_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `, [orderId])

      return NextResponse.json({
        success: true,
        message: 'Orden en preparacion'
      })
    }

    if (action === 'ready') {
      if (order.status !== 'preparing' && order.status !== 'accepted') {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden marcar como listas ordenes en preparacion'
        }, { status: 400 })
      }

      await db.transaction(async (client) => {
        // Update prepared lines if provided
        if (preparedLines && Array.isArray(preparedLines)) {
          for (const line of preparedLines) {
            await client.query(`
              UPDATE market_order_lines
              SET quantity_prepared = $1, is_prepared = $2
              WHERE id = $3 AND order_id = $4
            `, [line.quantityPrepared, line.isPrepared, line.id, orderId])
          }
        } else {
          // Mark all lines as prepared
          await client.query(`
            UPDATE market_order_lines
            SET quantity_prepared = quantity, is_prepared = true
            WHERE order_id = $1
          `, [orderId])
        }

        // Deduct from inventory
        const linesResult = await client.query(`
          SELECT product_id, quantity FROM market_order_lines WHERE order_id = $1
        `, [orderId])

        for (const line of linesResult.rows) {
          await client.query(`
            UPDATE market_products
            SET quantity_on_hand = GREATEST(0, COALESCE(quantity_on_hand, 0) - $1),
                updated_at = NOW()
            WHERE id = $2
          `, [line.quantity, line.product_id])
        }

        // Update order status
        await client.query(`
          UPDATE market_orders
          SET status = 'ready',
              ready_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
        `, [orderId])
      })

      return NextResponse.json({
        success: true,
        message: 'Orden lista para entrega. Inventario actualizado.'
      })
    }

    if (action === 'reject') {
      if (order.status !== 'pending') {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden rechazar ordenes pendientes'
        }, { status: 400 })
      }

      if (!rejectionReason) {
        return NextResponse.json({
          success: false,
          error: 'Debe indicar el motivo del rechazo'
        }, { status: 400 })
      }

      await db.query(`
        UPDATE market_orders
        SET status = 'rejected',
            rejected_at = NOW(),
            rejection_reason = $1,
            rejection_notes = $2,
            rejected_by = $3,
            updated_at = NOW()
        WHERE id = $4
      `, [rejectionReason, rejectionNotes || null, userId, orderId])

      // TODO: Refund agency wallet

      return NextResponse.json({
        success: true,
        message: 'Orden rechazada'
      })
    }

    if (action === 'cancel') {
      if (!['pending', 'accepted', 'preparing'].includes(order.status)) {
        return NextResponse.json({
          success: false,
          error: 'Esta orden no puede ser cancelada'
        }, { status: 400 })
      }

      await db.query(`
        UPDATE market_orders
        SET status = 'cancelled',
            cancelled_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `, [orderId])

      // TODO: Refund agency wallet

      return NextResponse.json({
        success: true,
        message: 'Orden cancelada'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Accion no reconocida'
    }, { status: 400 })

  } catch (error) {
    console.error('[Market Order API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar orden'
    }, { status: 500 })
  }
}
