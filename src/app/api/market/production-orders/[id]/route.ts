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
 * GET /api/market/production-orders/[id]
 * Get a specific production order with its lines
 */
export async function GET(
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
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Get production order
    const orderResult = await db.query(`
      SELECT
        po.*,
        bom.bom_code,
        bom.bom_name,
        bom.output_quantity,
        bom.output_unit,
        bom.expected_waste_percent,
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.image_url as product_image,
        p.cost_price as product_cost_price,
        p.selling_price as product_selling_price,
        v.variant_name,
        v.sku as variant_sku,
        w.name as warehouse_name,
        w.code as warehouse_code,
        creator.email as created_by_email,
        confirmer.email as confirmed_by_email,
        completer.email as completed_by_email,
        mat_op.operation_number as material_out_operation_number,
        prod_op.operation_number as product_in_operation_number
      FROM market_production_orders po
      LEFT JOIN market_bill_of_materials bom ON po.bom_id = bom.id
      LEFT JOIN market_products p ON bom.product_id = p.id
      LEFT JOIN market_product_variants v ON bom.variant_id = v.id
      LEFT JOIN market_warehouses w ON po.warehouse_id = w.id
      LEFT JOIN users creator ON po.created_by = creator.id
      LEFT JOIN users confirmer ON po.confirmed_by = confirmer.id
      LEFT JOIN users completer ON po.completed_by = completer.id
      LEFT JOIN market_warehouse_operations mat_op ON po.material_out_operation_id = mat_op.id
      LEFT JOIN market_warehouse_operations prod_op ON po.product_in_operation_id = prod_op.id
      WHERE po.id = $1 AND po.company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get lines
    const linesResult = await db.query(`
      SELECT
        pol.*,
        mp.name as product_name,
        mp.sku as product_sku,
        mp.image_url as product_image,
        mp.unit_of_measure as product_unit,
        pv.variant_name,
        pv.sku as variant_sku,
        deliverer.email as delivered_by_email
      FROM market_production_order_lines pol
      LEFT JOIN market_products mp ON pol.product_id = mp.id
      LEFT JOIN market_product_variants pv ON pol.variant_id = pv.id
      LEFT JOIN users deliverer ON pol.delivered_by = deliverer.id
      WHERE pol.production_order_id = $1
      ORDER BY pol.id ASC
    `, [orderId])

    // Get current stock for each material
    const lines = await Promise.all(linesResult.rows.map(async (line) => {
      const stockResult = await db.query(`
        SELECT COALESCE(quantity_on_hand, 0) - COALESCE(quantity_reserved, 0) as available
        FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2 AND COALESCE(variant_id, 0) = COALESCE($3, 0)
      `, [order.warehouse_id, line.product_id, line.variant_id])

      const stockAvailable = parseFloat(stockResult.rows[0]?.available) || 0

      return {
        id: line.id,
        productId: line.product_id,
        productName: line.product_name,
        productSku: line.product_sku,
        productImage: line.product_image,
        productUnit: line.product_unit,
        variantId: line.variant_id,
        variantName: line.variant_name,
        variantSku: line.variant_sku,
        quantityPlanned: parseFloat(line.quantity_planned) || 0,
        quantityConsumed: parseFloat(line.quantity_consumed) || 0,
        unitCost: parseFloat(line.unit_cost) || 0,
        totalCost: parseFloat(line.total_cost) || 0,
        lineStatus: line.line_status,
        deliveredAt: line.delivered_at,
        deliveredBy: line.delivered_by_email,
        notes: line.notes,
        stockAvailable,
        hasEnoughStock: stockAvailable >= (parseFloat(line.quantity_planned) || 0) - (parseFloat(line.quantity_consumed) || 0)
      }
    }))

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        productionNumber: order.production_number,
        bomId: order.bom_id,
        bomCode: order.bom_code,
        bomName: order.bom_name,
        bomOutputQuantity: parseFloat(order.output_quantity) || 1,
        bomOutputUnit: order.output_unit,
        expectedWastePercent: parseFloat(order.expected_waste_percent) || 0,
        productId: order.product_id,
        productName: order.product_name,
        productSku: order.product_sku,
        productImage: order.product_image,
        productCostPrice: parseFloat(order.product_cost_price) || 0,
        productSellingPrice: parseFloat(order.product_selling_price) || 0,
        variantName: order.variant_name,
        variantSku: order.variant_sku,
        warehouse: {
          id: order.warehouse_id,
          name: order.warehouse_name,
          code: order.warehouse_code
        },
        quantityToProduce: parseFloat(order.quantity_to_produce) || 0,
        quantityProduced: parseFloat(order.quantity_produced) || 0,
        totalMaterialCost: parseFloat(order.total_material_cost) || 0,
        unitCost: parseFloat(order.unit_cost) || 0,
        status: order.status,
        materialOutOperationId: order.material_out_operation_id,
        materialOutOperationNumber: order.material_out_operation_number,
        productInOperationId: order.product_in_operation_id,
        productInOperationNumber: order.product_in_operation_number,
        scheduledDate: order.scheduled_date,
        startedAt: order.started_at,
        completedAt: order.completed_at,
        notes: order.notes,
        createdBy: order.created_by_email,
        confirmedBy: order.confirmed_by_email,
        completedBy: order.completed_by_email,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        lines
      }
    })

  } catch (error) {
    console.error('[Production Orders API] Error getting order:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener orden de producción'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/production-orders/[id]
 * Update a production order (only in draft status)
 */
export async function PUT(
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
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Verify order exists and is in draft
    const existsResult = await db.query(`
      SELECT id, status FROM market_production_orders WHERE id = $1 AND company_id = $2
    `, [orderId, companyId])

    if (existsResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    if (existsResult.rows[0].status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden editar órdenes en estado borrador'
      }, { status: 400 })
    }

    const body = await request.json()
    const {
      warehouseId,
      quantityToProduce,
      scheduledDate,
      notes
    } = body

    // Update order
    const updateFields: string[] = []
    const updateParams: (string | number | null)[] = []
    let paramIndex = 1

    if (warehouseId !== undefined) {
      updateFields.push(`warehouse_id = $${paramIndex++}`)
      updateParams.push(warehouseId)
    }
    if (quantityToProduce !== undefined) {
      updateFields.push(`quantity_to_produce = $${paramIndex++}`)
      updateParams.push(quantityToProduce)
    }
    if (scheduledDate !== undefined) {
      updateFields.push(`scheduled_date = $${paramIndex++}`)
      updateParams.push(scheduledDate || null)
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramIndex++}`)
      updateParams.push(notes || null)
    }

    updateFields.push(`updated_at = NOW()`)

    if (updateFields.length > 1) {
      updateParams.push(orderId)
      await db.query(`
        UPDATE market_production_orders
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `, updateParams)
    }

    // If quantity changed, recalculate lines
    if (quantityToProduce !== undefined) {
      // Get BOM info
      const orderResult = await db.query(`
        SELECT po.bom_id, bom.output_quantity
        FROM market_production_orders po
        JOIN market_bill_of_materials bom ON po.bom_id = bom.id
        WHERE po.id = $1
      `, [orderId])

      const bomId = orderResult.rows[0].bom_id
      const bomOutputQuantity = parseFloat(orderResult.rows[0].output_quantity) || 1
      const batchMultiplier = quantityToProduce / bomOutputQuantity

      // Get BOM lines
      const bomLinesResult = await db.query(`
        SELECT
          bl.*,
          mp.cost_price as product_cost_price,
          pv.cost_price as variant_cost_price
        FROM market_bom_lines bl
        LEFT JOIN market_products mp ON bl.product_id = mp.id
        LEFT JOIN market_product_variants pv ON bl.variant_id = pv.id
        WHERE bl.bom_id = $1
      `, [bomId])

      // Delete existing lines and recreate
      await db.query(`DELETE FROM market_production_order_lines WHERE production_order_id = $1`, [orderId])

      let totalMaterialCost = 0
      for (const line of bomLinesResult.rows) {
        const quantityRequired = (parseFloat(line.quantity_required) || 0) * batchMultiplier
        const unitCost = parseFloat(line.variant_cost_price || line.product_cost_price) || 0
        const lineTotalCost = unitCost * quantityRequired
        totalMaterialCost += lineTotalCost

        await db.query(`
          INSERT INTO market_production_order_lines (
            production_order_id, product_id, variant_id,
            quantity_planned, unit_cost, total_cost,
            line_status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
        `, [
          orderId,
          line.product_id,
          line.variant_id,
          quantityRequired,
          unitCost,
          lineTotalCost
        ])
      }

      // Update costs
      const unitCost = totalMaterialCost / quantityToProduce
      await db.query(`
        UPDATE market_production_orders
        SET total_material_cost = $1, unit_cost = $2, updated_at = NOW()
        WHERE id = $3
      `, [totalMaterialCost, unitCost, orderId])
    }

    return NextResponse.json({
      success: true,
      message: 'Orden de producción actualizada exitosamente'
    })

  } catch (error) {
    console.error('[Production Orders API] Error updating order:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar orden de producción'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/production-orders/[id]
 * Cancel a production order
 */
export async function DELETE(
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
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Verify order exists
    const existsResult = await db.query(`
      SELECT id, status FROM market_production_orders WHERE id = $1 AND company_id = $2
    `, [orderId, companyId])

    if (existsResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const currentStatus = existsResult.rows[0].status
    if (currentStatus === 'completed') {
      return NextResponse.json({
        success: false,
        error: 'No se pueden cancelar órdenes completadas'
      }, { status: 400 })
    }

    if (currentStatus === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: 'La orden ya está cancelada'
      }, { status: 400 })
    }

    // TODO: If materials were already delivered, we might need to return them to stock

    // Cancel order
    await db.query(`
      UPDATE market_production_orders
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
    `, [orderId])

    return NextResponse.json({
      success: true,
      message: 'Orden de producción cancelada exitosamente'
    })

  } catch (error) {
    console.error('[Production Orders API] Error cancelling order:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al cancelar orden de producción'
    }, { status: 500 })
  }
}
