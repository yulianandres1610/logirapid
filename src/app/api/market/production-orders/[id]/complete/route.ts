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
 * POST /api/market/production-orders/[id]/complete
 * Complete production - receive finished product into warehouse
 * Creates a production_in warehouse operation and adds stock
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
    const {
      quantityProduced,
      updateProductCost = false,
      notes
    } = body

    if (!quantityProduced || quantityProduced <= 0) {
      return NextResponse.json({
        success: false,
        error: 'La cantidad producida debe ser mayor a 0'
      }, { status: 400 })
    }

    // Get order with BOM info
    const orderResult = await db.query(`
      SELECT
        po.*,
        bom.product_id,
        bom.variant_id,
        bom.output_unit,
        p.name as product_name
      FROM market_production_orders po
      LEFT JOIN market_bill_of_materials bom ON po.bom_id = bom.id
      LEFT JOIN market_products p ON bom.product_id = p.id
      WHERE po.id = $1 AND po.company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    if (!['materials_out', 'in_production'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: `La orden está en estado "${order.status}" y no puede ser completada. Debe estar en "materials_out" o "in_production".`
      }, { status: 400 })
    }

    // Calculate final unit cost based on actual production
    const totalMaterialCost = parseFloat(order.total_material_cost) || 0
    const finalUnitCost = totalMaterialCost / quantityProduced

    // Generate operation number for production_in
    const year = new Date().getFullYear()
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM market_warehouse_operations WHERE company_id = $1 AND operation_type = 'production_in' AND EXTRACT(YEAR FROM created_at) = $2`,
      [companyId, year]
    )
    const sequenceNumber = (parseInt(countResult.rows[0]?.count) || 0) + 1
    const operationNumber = `PIN-${year}-${sequenceNumber.toString().padStart(4, '0')}`

    // Create warehouse operation (production_in)
    const operationResult = await db.query(`
      INSERT INTO market_warehouse_operations (
        company_id, operation_number, operation_type,
        destination_warehouse_id, reference_type, reference_id,
        status, notes, created_by, completed_by, completed_at, created_at, updated_at
      ) VALUES (
        $1, $2, 'production_in', $3, 'production_order', $4,
        'done', $5, $6, $6, NOW(), NOW(), NOW()
      ) RETURNING id
    `, [
      companyId, operationNumber, order.warehouse_id, orderId,
      notes || `Entrada de producto terminado de orden de producción ${order.production_number}`,
      userId
    ])

    const operationId = operationResult.rows[0].id

    // Get current stock of finished product
    const stockResult = await db.query(`
      SELECT id, quantity_on_hand
      FROM market_warehouse_stock
      WHERE warehouse_id = $1 AND product_id = $2 AND COALESCE(variant_id, 0) = COALESCE($3, 0)
    `, [order.warehouse_id, order.product_id, order.variant_id])

    const currentStock = stockResult.rows[0]
    const quantityBefore = parseFloat(currentStock?.quantity_on_hand) || 0
    const quantityAfter = quantityBefore + quantityProduced

    if (currentStock) {
      // Update existing stock
      await db.query(`
        UPDATE market_warehouse_stock
        SET
          quantity_on_hand = COALESCE(quantity_on_hand, 0) + $1,
          last_movement_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [quantityProduced, currentStock.id])
    } else {
      // Create stock record
      await db.query(`
        INSERT INTO market_warehouse_stock (
          warehouse_id, product_id, variant_id,
          quantity_on_hand, last_movement_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
      `, [order.warehouse_id, order.product_id, order.variant_id, quantityProduced])
    }

    // Create operation line
    await db.query(`
      INSERT INTO market_warehouse_operation_lines (
        operation_id, product_id, variant_id,
        quantity_planned, quantity_done, line_status, created_at
      ) VALUES ($1, $2, $3, $4, $4, 'done', NOW())
    `, [operationId, order.product_id, order.variant_id, quantityProduced])

    // Create stock movement
    await db.query(`
      INSERT INTO market_stock_movements (
        company_id, product_id, variant_id, movement_type,
        to_warehouse_id, quantity, quantity_before, quantity_after,
        operation_id, reference_type, reference_id, notes,
        created_by, created_at
      ) VALUES (
        $1, $2, $3, 'in', $4, $5, $6, $7, $8,
        'production_order', $9, $10, $11, NOW()
      )
    `, [
      companyId, order.product_id, order.variant_id,
      order.warehouse_id, quantityProduced, quantityBefore, quantityAfter,
      operationId, orderId,
      `Producto terminado de producción ${order.production_number}`,
      userId
    ])

    // Update production order
    await db.query(`
      UPDATE market_production_orders
      SET
        quantity_produced = $1,
        unit_cost = $2,
        product_in_operation_id = $3,
        status = 'completed',
        completed_at = NOW(),
        completed_by = $4,
        notes = COALESCE(notes, '') || CASE WHEN $5 IS NOT NULL THEN E'\n' || $5 ELSE '' END,
        updated_at = NOW()
      WHERE id = $6
    `, [quantityProduced, finalUnitCost, operationId, userId, notes, orderId])

    // Optionally update product cost price
    if (updateProductCost) {
      if (order.variant_id) {
        await db.query(`
          UPDATE market_product_variants
          SET cost_price = $1, updated_at = NOW()
          WHERE id = $2
        `, [finalUnitCost, order.variant_id])
      } else {
        await db.query(`
          UPDATE market_products
          SET cost_price = $1, updated_at = NOW()
          WHERE id = $2
        `, [finalUnitCost, order.product_id])
      }
    }

    // Calculate production stats
    const plannedQuantity = parseFloat(order.quantity_to_produce) || 0
    const actualWaste = plannedQuantity - quantityProduced
    const wastePercent = plannedQuantity > 0 ? (actualWaste / plannedQuantity) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        operationId,
        operationNumber,
        quantityProduced,
        quantityPlanned: plannedQuantity,
        totalMaterialCost,
        finalUnitCost,
        wasteQuantity: actualWaste,
        wastePercent: wastePercent.toFixed(2),
        productCostUpdated: updateProductCost
      },
      message: `Producción completada. Se produjeron ${quantityProduced} ${order.output_unit || 'unidades'} de ${order.product_name}.`
    })

  } catch (error) {
    console.error('[Production Orders API] Error completing production:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al completar producción'
    }, { status: 500 })
  }
}
