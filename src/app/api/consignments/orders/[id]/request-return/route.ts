import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

interface RequestReturnLine {
  orderLineId: number
  quantity: number
}

/**
 * POST /api/consignments/orders/[id]/request-return
 * Create a pending supplier return request from consignment order
 * This creates a return in 'pending' status for warehouse staff to process
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const orderId = parseInt(id)
    const { reason, notes, lines } = await request.json() as {
      reason: 'not_sold' | 'damaged' | 'expired' | 'agreement' | 'other'
      notes?: string
      lines: RequestReturnLine[]
    }

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar al menos un producto'
      }, { status: 400 })
    }

    // Verify order exists and belongs to company
    const orderResult = await db.query(`
      SELECT
        o.*,
        s.company_id,
        s.id as supplier_id,
        s.name as supplier_name,
        s.supplier_code
      FROM consignment_orders o
      JOIN market_suppliers s ON s.id = o.supplier_id
      WHERE o.id = $1 AND o.company_id = $2
    `, [orderId, payload.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Check order status - must be received or selling
    if (!['received', 'selling', 'paid'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden solicitar devoluciones de órdenes recibidas o en venta'
      }, { status: 400 })
    }

    // Validate each line has stock available
    let totalUnits = 0
    let totalValue = 0
    const validatedLines: Array<{
      orderLineId: number
      productId: number
      variantId: number | null
      quantity: number
      unitCost: number
      lotInventoryId: number | null
    }> = []

    for (const line of lines) {
      if (line.quantity <= 0) continue

      // Get order line with available stock info
      const lineResult = await db.query(`
        SELECT
          ol.id,
          ol.product_id,
          ol.variant_id,
          ol.quantity_received,
          ol.quantity_sold,
          ol.quantity_returned,
          ol.unit_cost,
          (ol.quantity_received - ol.quantity_sold - ol.quantity_returned) as available
        FROM consignment_order_lines ol
        WHERE ol.id = $1 AND ol.order_id = $2
      `, [line.orderLineId, orderId])

      if (lineResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: `Línea de producto ${line.orderLineId} no encontrada`
        }, { status: 400 })
      }

      const orderLine = lineResult.rows[0]
      const available = parseInt(orderLine.available) || 0

      if (line.quantity > available) {
        return NextResponse.json({
          success: false,
          error: `Cantidad solicitada (${line.quantity}) excede disponible (${available}) para línea ${line.orderLineId}`
        }, { status: 400 })
      }

      // Find lot inventory if exists
      const lotResult = await db.query(`
        SELECT id FROM consignment_lot_inventory
        WHERE warehouse_id = $1 AND product_id = $2 AND order_line_id = $3
        LIMIT 1
      `, [order.warehouse_id, orderLine.product_id, line.orderLineId])

      validatedLines.push({
        orderLineId: line.orderLineId,
        productId: orderLine.product_id,
        variantId: orderLine.variant_id,
        quantity: line.quantity,
        unitCost: parseFloat(orderLine.unit_cost),
        lotInventoryId: lotResult.rows[0]?.id || null
      })

      totalUnits += line.quantity
      totalValue += line.quantity * parseFloat(orderLine.unit_cost)
    }

    if (validatedLines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay productos válidos para devolver'
      }, { status: 400 })
    }

    // Generate return number
    const year = new Date().getFullYear()
    const seqResult = await db.query(`
      SELECT COUNT(*) as count
      FROM consignment_returns
      WHERE EXTRACT(YEAR FROM created_at) = $1
    `, [year])
    const seq = (parseInt(seqResult.rows[0].count) + 1).toString().padStart(4, '0')
    const returnNumber = `DEV-SUPP-${year}-${seq}`

    // Create return with status 'pending'
    const insertResult = await db.query(`
      INSERT INTO consignment_returns (
        return_number, order_id, supplier_id, warehouse_id, status,
        total_items, total_units, total_value, reason, notes, created_by
      ) VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10)
      RETURNING id, return_number
    `, [
      returnNumber,
      orderId,
      order.supplier_id,
      order.warehouse_id,
      validatedLines.length,
      totalUnits,
      totalValue,
      reason || 'not_sold',
      notes || null,
      payload.userId
    ])

    const returnId = insertResult.rows[0].id

    // Create return lines
    for (const line of validatedLines) {
      await db.query(`
        INSERT INTO consignment_return_lines (
          return_id, order_line_id, lot_inventory_id, product_id, variant_id,
          quantity_to_return, unit_cost
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        returnId,
        line.orderLineId,
        line.lotInventoryId,
        line.productId,
        line.variantId,
        line.quantity,
        line.unitCost
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitud de devolución creada exitosamente',
      data: {
        returnId,
        returnNumber,
        status: 'pending',
        totalUnits,
        totalValue,
        supplierName: order.supplier_name
      }
    })

  } catch (error) {
    console.error('[Request Return] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear solicitud de devolución'
    }, { status: 500 })
  }
}
