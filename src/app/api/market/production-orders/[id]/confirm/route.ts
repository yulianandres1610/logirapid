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
 * POST /api/market/production-orders/[id]/confirm
 * Confirm a production order (changes status from draft to confirmed)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Get order with lines
    const orderResult = await db.query(`
      SELECT po.*, w.name as warehouse_name
      FROM market_production_orders po
      LEFT JOIN market_warehouses w ON po.warehouse_id = w.id
      WHERE po.id = $1 AND po.company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    if (order.status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: `La orden está en estado "${order.status}" y no puede ser confirmada`
      }, { status: 400 })
    }

    // Get lines and check stock
    const linesResult = await db.query(`
      SELECT
        pol.*,
        mp.name as product_name
      FROM market_production_order_lines pol
      LEFT JOIN market_products mp ON pol.product_id = mp.id
      WHERE pol.production_order_id = $1
    `, [orderId])

    const insufficientStock: Array<{
      productName: string
      required: number
      available: number
    }> = []

    for (const line of linesResult.rows) {
      const stockResult = await db.query(`
        SELECT COALESCE(quantity_on_hand, 0) - COALESCE(quantity_reserved, 0) as available
        FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2 AND COALESCE(variant_id, 0) = COALESCE($3, 0)
      `, [order.warehouse_id, line.product_id, line.variant_id])

      const available = parseFloat(stockResult.rows[0]?.available) || 0
      const required = parseFloat(line.quantity_planned) || 0

      if (available < required) {
        insufficientStock.push({
          productName: line.product_name,
          required,
          available
        })
      }
    }

    if (insufficientStock.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Stock insuficiente para confirmar la orden',
        data: { insufficientStock }
      }, { status: 400 })
    }

    // Reserve stock for each material
    for (const line of linesResult.rows) {
      const quantityToReserve = parseFloat(line.quantity_planned) || 0

      // Check if stock record exists
      const stockExists = await db.query(`
        SELECT id FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2 AND COALESCE(variant_id, 0) = COALESCE($3, 0)
      `, [order.warehouse_id, line.product_id, line.variant_id])

      if (stockExists.rows.length > 0) {
        // Update reserved quantity
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_reserved = COALESCE(quantity_reserved, 0) + $1, updated_at = NOW()
          WHERE warehouse_id = $2 AND product_id = $3 AND COALESCE(variant_id, 0) = COALESCE($4, 0)
        `, [quantityToReserve, order.warehouse_id, line.product_id, line.variant_id])
      }
    }

    // Update order status
    await db.query(`
      UPDATE market_production_orders
      SET status = 'confirmed', confirmed_by = $1, updated_at = NOW()
      WHERE id = $2
    `, [userId, orderId])

    return NextResponse.json({
      success: true,
      message: 'Orden de producción confirmada exitosamente. Los materiales han sido reservados.'
    })

  } catch (error) {
    console.error('[Production Orders API] Error confirming order:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al confirmar orden de producción'
    }, { status: 500 })
  }
}
