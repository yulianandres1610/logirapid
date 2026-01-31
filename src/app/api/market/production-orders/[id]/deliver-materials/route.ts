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
 * POST /api/market/production-orders/[id]/deliver-materials
 * Deliver materials from warehouse to production
 * Creates a production_out warehouse operation and deducts stock
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

    const body = await request.json()
    const { lines: deliveryLines } = body

    // Get order
    const orderResult = await db.query(`
      SELECT * FROM market_production_orders
      WHERE id = $1 AND company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    if (!['confirmed', 'materials_out'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: `La orden está en estado "${order.status}" y no se pueden entregar materiales`
      }, { status: 400 })
    }

    // Get order lines
    const linesResult = await db.query(`
      SELECT
        pol.*,
        mp.name as product_name
      FROM market_production_order_lines pol
      LEFT JOIN market_products mp ON pol.product_id = mp.id
      WHERE pol.production_order_id = $1
    `, [orderId])

    // If deliveryLines is provided, use those quantities; otherwise deliver all
    const linesToDeliver = deliveryLines || linesResult.rows.map(l => ({
      lineId: l.id,
      quantityDelivered: parseFloat(l.quantity_planned) - parseFloat(l.quantity_consumed || 0)
    }))

    // Validate delivery quantities
    for (const delivery of linesToDeliver) {
      const line = linesResult.rows.find(l => l.id === delivery.lineId)
      if (!line) {
        return NextResponse.json({
          success: false,
          error: `Línea ${delivery.lineId} no encontrada`
        }, { status: 400 })
      }

      const remaining = (parseFloat(line.quantity_planned) || 0) - (parseFloat(line.quantity_consumed) || 0)
      if (delivery.quantityDelivered > remaining) {
        return NextResponse.json({
          success: false,
          error: `La cantidad a entregar (${delivery.quantityDelivered}) excede lo pendiente (${remaining}) para ${line.product_name}`
        }, { status: 400 })
      }
    }

    // Generate operation number for production_out
    const year = new Date().getFullYear()
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM market_warehouse_operations WHERE company_id = $1 AND operation_type = 'production_out' AND EXTRACT(YEAR FROM created_at) = $2`,
      [companyId, year]
    )
    const sequenceNumber = (parseInt(countResult.rows[0]?.count) || 0) + 1
    const operationNumber = `POU-${year}-${sequenceNumber.toString().padStart(4, '0')}`

    // Create warehouse operation (production_out)
    const operationResult = await db.query(`
      INSERT INTO market_warehouse_operations (
        company_id, operation_number, operation_type,
        source_warehouse_id, reference_type, reference_id,
        status, notes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, 'production_out', $3, 'production_order', $4,
        'done', $5, $6, NOW(), NOW()
      ) RETURNING id
    `, [
      companyId, operationNumber, order.warehouse_id, orderId,
      `Salida de materiales para orden de producción ${order.production_number}`,
      userId
    ])

    const operationId = operationResult.rows[0].id
    let totalMaterialCost = 0

    // Process each line
    for (const delivery of linesToDeliver) {
      const line = linesResult.rows.find(l => l.id === delivery.lineId)
      if (!line || delivery.quantityDelivered <= 0) continue

      const quantityToDeduct = delivery.quantityDelivered
      const unitCost = parseFloat(line.unit_cost) || 0
      const lineCost = unitCost * quantityToDeduct
      totalMaterialCost += lineCost

      // Get current stock
      const stockResult = await db.query(`
        SELECT id, quantity_on_hand, quantity_reserved
        FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2 AND COALESCE(variant_id, 0) = COALESCE($3, 0)
      `, [order.warehouse_id, line.product_id, line.variant_id])

      const currentStock = stockResult.rows[0]
      const quantityBefore = parseFloat(currentStock?.quantity_on_hand) || 0
      const quantityAfter = quantityBefore - quantityToDeduct

      // Deduct from stock and reserved
      await db.query(`
        UPDATE market_warehouse_stock
        SET
          quantity_on_hand = GREATEST(0, COALESCE(quantity_on_hand, 0) - $1),
          quantity_reserved = GREATEST(0, COALESCE(quantity_reserved, 0) - $1),
          last_movement_at = NOW(),
          updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3 AND COALESCE(variant_id, 0) = COALESCE($4, 0)
      `, [quantityToDeduct, order.warehouse_id, line.product_id, line.variant_id])

      // Create operation line
      await db.query(`
        INSERT INTO market_warehouse_operation_lines (
          operation_id, product_id, variant_id,
          quantity_planned, quantity_done, line_status, created_at
        ) VALUES ($1, $2, $3, $4, $4, 'done', NOW())
      `, [operationId, line.product_id, line.variant_id, quantityToDeduct])

      // Create stock movement
      await db.query(`
        INSERT INTO market_stock_movements (
          company_id, product_id, variant_id, movement_type,
          from_warehouse_id, quantity, quantity_before, quantity_after,
          operation_id, reference_type, reference_id, notes,
          created_by, created_at
        ) VALUES (
          $1, $2, $3, 'out', $4, $5, $6, $7, $8,
          'production_order', $9, $10, $11, NOW()
        )
      `, [
        companyId, line.product_id, line.variant_id,
        order.warehouse_id, quantityToDeduct, quantityBefore, quantityAfter,
        operationId, orderId,
        `Material entregado para producción ${order.production_number}`,
        userId
      ])

      // Update production order line
      await db.query(`
        UPDATE market_production_order_lines
        SET
          quantity_consumed = COALESCE(quantity_consumed, 0) + $1,
          total_cost = COALESCE(total_cost, 0) + $2,
          line_status = CASE
            WHEN COALESCE(quantity_consumed, 0) + $1 >= quantity_planned THEN 'consumed'
            ELSE 'delivered'
          END,
          delivered_at = NOW(),
          delivered_by = $3
        WHERE id = $4
      `, [quantityToDeduct, lineCost, userId, line.id])
    }

    // Check if all materials have been delivered
    const pendingLines = await db.query(`
      SELECT COUNT(*) as count
      FROM market_production_order_lines
      WHERE production_order_id = $1 AND (line_status = 'pending' OR quantity_consumed < quantity_planned)
    `, [orderId])

    const allDelivered = parseInt(pendingLines.rows[0]?.count) === 0

    // Update production order
    await db.query(`
      UPDATE market_production_orders
      SET
        material_out_operation_id = $1,
        total_material_cost = $2,
        unit_cost = $2 / quantity_to_produce,
        status = $3,
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW()
      WHERE id = $4
    `, [
      operationId,
      totalMaterialCost,
      allDelivered ? 'in_production' : 'materials_out',
      orderId
    ])

    return NextResponse.json({
      success: true,
      data: {
        operationId,
        operationNumber,
        totalMaterialCost,
        allMaterialsDelivered: allDelivered,
        newStatus: allDelivered ? 'in_production' : 'materials_out'
      },
      message: allDelivered
        ? 'Todos los materiales han sido entregados. La orden está en producción.'
        : 'Materiales entregados parcialmente.'
    })

  } catch (error) {
    console.error('[Production Orders API] Error delivering materials:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al entregar materiales'
    }, { status: 500 })
  }
}
