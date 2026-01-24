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
 * GET /api/market/pos/orders/[id]
 * Get order details with lines and payments
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const orderId = parseInt(id)

    // Get order
    const orderResult = await db.query(`
      SELECT
        o.*,
        t.name as terminal_name,
        t.code as terminal_code,
        s.session_code,
        w.name as warehouse_name,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name,
        COALESCE(c.firstname || ' ' || c.lastname, c.firstname, c.lastname) as customer_full_name,
        c.phone as customer_phone,
        c.email as customer_email
      FROM market_pos_orders o
      LEFT JOIN market_pos_terminals t ON o.pos_terminal_id = t.id
      LEFT JOIN market_pos_sessions s ON o.pos_session_id = s.id
      LEFT JOIN market_warehouses w ON o.warehouse_id = w.id
      LEFT JOIN users u ON o.created_by = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = $1 AND o.company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get order lines
    const linesResult = await db.query(`
      SELECT
        l.*,
        p.barcode,
        p.image_url
      FROM market_pos_order_lines l
      LEFT JOIN market_products p ON l.product_id = p.id
      WHERE l.order_id = $1
      ORDER BY l.id
    `, [orderId])

    // Get payments
    const paymentsResult = await db.query(`
      SELECT * FROM market_pos_payments
      WHERE order_id = $1
      ORDER BY id
    `, [orderId])

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        sessionId: order.pos_session_id,
        sessionCode: order.session_code,
        terminalId: order.pos_terminal_id,
        terminalName: order.terminal_name,
        terminalCode: order.terminal_code,
        warehouseId: order.warehouse_id,
        warehouseName: order.warehouse_name,
        customer: order.customer_id ? {
          id: order.customer_id,
          name: order.customer_full_name || order.customer_name,
          phone: order.customer_phone,
          email: order.customer_email
        } : null,
        subtotal: parseFloat(order.subtotal) || 0,
        discountAmount: parseFloat(order.discount_amount) || 0,
        taxAmount: parseFloat(order.tax_amount) || 0,
        totalAmount: parseFloat(order.total_amount) || 0,
        currency: order.currency,
        status: order.status,
        offlineId: order.offline_id,
        syncedAt: order.synced_at,
        createdBy: order.created_by,
        createdByName: order.created_by_name,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        lines: linesResult.rows.map(line => ({
          id: line.id,
          productId: line.product_id,
          productName: line.product_name,
          productSku: line.product_sku,
          barcode: line.barcode,
          imageUrl: line.image_url,
          quantity: parseFloat(line.quantity) || 1,
          unitPrice: parseFloat(line.unit_price) || 0,
          originalPrice: line.original_price ? parseFloat(line.original_price) : undefined,
          discountPercent: parseFloat(line.discount_percent) || 0,
          discountAmount: parseFloat(line.discount_amount) || 0,
          subtotal: parseFloat(line.subtotal) || 0,
          taxAmount: parseFloat(line.tax_amount) || 0,
          total: parseFloat(line.total) || 0,
          promotionId: line.promotion_id,
          promotionName: line.promotion_name
        })),
        payments: paymentsResult.rows.map(p => ({
          id: p.id,
          method: p.payment_method,
          amount: parseFloat(p.amount) || 0,
          currency: p.currency,
          amountTendered: p.amount_tendered ? parseFloat(p.amount_tendered) : null,
          changeAmount: p.change_amount ? parseFloat(p.change_amount) : null,
          reference: p.reference,
          createdAt: p.created_at
        }))
      }
    })

  } catch (error) {
    console.error('[POS Order API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener orden'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/pos/orders/[id]
 * Update order (add payment, void, refund)
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const userId = payload.userId
    const orderId = parseInt(id)

    const body = await request.json()
    const { action, payments, reason } = body

    // Get order
    const orderResult = await db.query(`
      SELECT o.*, s.status as session_status, t.id as terminal_id
      FROM market_pos_orders o
      JOIN market_pos_sessions s ON o.pos_session_id = s.id
      JOIN market_pos_terminals t ON o.pos_terminal_id = t.id
      WHERE o.id = $1 AND o.company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Handle different actions
    if (action === 'pay') {
      if (order.status === 'paid') {
        return NextResponse.json({
          success: false,
          error: 'La orden ya está pagada'
        }, { status: 400 })
      }

      if (!payments || payments.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Se requieren pagos'
        }, { status: 400 })
      }

      // Add payments
      for (const payment of payments) {
        await db.query(`
          INSERT INTO market_pos_payments (
            order_id, payment_method, amount, currency,
            amount_tendered, change_amount, reference,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          orderId,
          payment.method || 'cash',
          payment.amount || 0,
          payment.currency || 'USD',
          payment.amountTendered || null,
          payment.changeAmount || null,
          payment.reference || null
        ])
      }

      // Calculate total paid
      const paidResult = await db.query(`
        SELECT SUM(amount) as total FROM market_pos_payments WHERE order_id = $1
      `, [orderId])

      const totalPaid = parseFloat(paidResult.rows[0].total) || 0
      const totalAmount = parseFloat(order.total_amount) || 0

      if (totalPaid >= totalAmount) {
        await db.query(`
          UPDATE market_pos_orders SET status = 'paid', updated_at = NOW()
          WHERE id = $1
        `, [orderId])
      }

      console.log('[POS Order] Payment added:', orderId, 'Total paid:', totalPaid)

      return NextResponse.json({
        success: true,
        data: { totalPaid, totalAmount, status: totalPaid >= totalAmount ? 'paid' : 'draft' },
        message: 'Pago registrado exitosamente'
      })
    }

    if (action === 'void') {
      if (order.status === 'voided') {
        return NextResponse.json({
          success: false,
          error: 'La orden ya está anulada'
        }, { status: 400 })
      }

      // Check permission
      if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
        const userPerm = await db.query(`
          SELECT can_void_orders FROM market_pos_users
          WHERE pos_terminal_id = $1 AND user_id = $2
        `, [order.terminal_id, userId])

        if (userPerm.rows.length === 0 || !userPerm.rows[0].can_void_orders) {
          return NextResponse.json({
            success: false,
            error: 'No tienes permiso para anular órdenes'
          }, { status: 403 })
        }
      }

      // Restore inventory
      const lines = await db.query(`
        SELECT product_id, quantity FROM market_pos_order_lines WHERE order_id = $1
      `, [orderId])

      for (const line of lines.rows) {
        if (line.product_id && order.warehouse_id) {
          const stockResult = await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
            WHERE product_id = $2 AND warehouse_id = $3
            RETURNING id
          `, [line.quantity, line.product_id, order.warehouse_id])

          if (stockResult.rows.length === 0) {
            await db.query(`
              UPDATE market_products
              SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
              WHERE id = $2
            `, [line.quantity, line.product_id])
          }
        } else if (line.product_id) {
          await db.query(`
            UPDATE market_products
            SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
            WHERE id = $2
          `, [line.quantity, line.product_id])
        }
      }

      await db.query(`
        UPDATE market_pos_orders
        SET status = 'voided', updated_at = NOW()
        WHERE id = $1
      `, [orderId])

      console.log('[POS Order] Voided:', orderId, 'Reason:', reason)

      return NextResponse.json({
        success: true,
        message: 'Orden anulada exitosamente'
      })
    }

    if (action === 'refund') {
      if (order.status !== 'paid') {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden reembolsar órdenes pagadas'
        }, { status: 400 })
      }

      // Check permission
      if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
        const userPerm = await db.query(`
          SELECT can_refund FROM market_pos_users
          WHERE pos_terminal_id = $1 AND user_id = $2
        `, [order.terminal_id, userId])

        if (userPerm.rows.length === 0 || !userPerm.rows[0].can_refund) {
          return NextResponse.json({
            success: false,
            error: 'No tienes permiso para hacer reembolsos'
          }, { status: 403 })
        }
      }

      // Restore inventory
      const refundLines = await db.query(`
        SELECT product_id, quantity FROM market_pos_order_lines WHERE order_id = $1
      `, [orderId])

      for (const line of refundLines.rows) {
        if (line.product_id && order.warehouse_id) {
          const stockResult = await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
            WHERE product_id = $2 AND warehouse_id = $3
            RETURNING id
          `, [line.quantity, line.product_id, order.warehouse_id])

          if (stockResult.rows.length === 0) {
            await db.query(`
              UPDATE market_products
              SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
              WHERE id = $2
            `, [line.quantity, line.product_id])
          }
        } else if (line.product_id) {
          await db.query(`
            UPDATE market_products
            SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
            WHERE id = $2
          `, [line.quantity, line.product_id])
        }
      }

      await db.query(`
        UPDATE market_pos_orders
        SET status = 'refunded', updated_at = NOW()
        WHERE id = $1
      `, [orderId])

      console.log('[POS Order] Refunded:', orderId, 'Reason:', reason)

      return NextResponse.json({
        success: true,
        message: 'Orden reembolsada exitosamente'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Acción no válida'
    }, { status: 400 })

  } catch (error) {
    console.error('[POS Order API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar orden'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/pos/orders/[id]
 * Delete draft order
 */
export async function DELETE(
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const orderId = parseInt(id)

    // Check order exists and is draft
    const orderResult = await db.query(`
      SELECT id, status, warehouse_id FROM market_pos_orders
      WHERE id = $1 AND company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    if (order.status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden eliminar órdenes en borrador'
      }, { status: 400 })
    }

    // Restore inventory before deleting
    const deleteLines = await db.query(`
      SELECT product_id, quantity FROM market_pos_order_lines WHERE order_id = $1
    `, [orderId])

    for (const line of deleteLines.rows) {
      if (line.product_id && order.warehouse_id) {
        const stockResult = await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
          WHERE product_id = $2 AND warehouse_id = $3
          RETURNING id
        `, [line.quantity, line.product_id, order.warehouse_id])

        if (stockResult.rows.length === 0) {
          await db.query(`
            UPDATE market_products
            SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
            WHERE id = $2
          `, [line.quantity, line.product_id])
        }
      } else if (line.product_id) {
        await db.query(`
          UPDATE market_products
          SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
          WHERE id = $2
        `, [line.quantity, line.product_id])
      }
    }

    // Delete order (cascade will delete lines and payments)
    await db.query(`DELETE FROM market_pos_orders WHERE id = $1`, [orderId])

    console.log('[POS Order] Deleted:', orderId)

    return NextResponse.json({
      success: true,
      message: 'Orden eliminada exitosamente'
    })

  } catch (error) {
    console.error('[POS Order API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar orden'
    }, { status: 500 })
  }
}
