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
 * GET /api/market/production/orders/[id]
 * Get production order details
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
    const resolvedParams = await params
    const orderId = parseInt(resolvedParams.id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Get order details
    const orderResult = await db.query(`
      SELECT
        po.*,
        sp.name as source_product_name,
        sp.sku as source_product_sku,
        sp.image_url as source_product_image,
        sp.unit_of_measure as source_product_unit,
        sv.variant_name as source_variant_name,
        tp.name as target_product_name,
        tp.sku as target_product_sku,
        tp.image_url as target_product_image,
        tp.unit_of_measure as target_product_unit,
        tv.variant_name as target_variant_name,
        sw.name as source_warehouse_name,
        sw.code as source_warehouse_code,
        tw.name as target_warehouse_name,
        tw.code as target_warehouse_code,
        COALESCE(uc.firstname || ' ' || uc.lastname, uc.email) as created_by_name,
        COALESCE(ucomp.firstname || ' ' || ucomp.lastname, ucomp.email) as completed_by_name
      FROM market_production_orders po
      LEFT JOIN market_products sp ON po.source_product_id = sp.id
      LEFT JOIN market_product_variants sv ON po.source_variant_id = sv.id
      LEFT JOIN market_products tp ON po.target_product_id = tp.id
      LEFT JOIN market_product_variants tv ON po.target_variant_id = tv.id
      LEFT JOIN market_warehouses sw ON po.source_warehouse_id = sw.id
      LEFT JOIN market_warehouses tw ON po.target_warehouse_id = tw.id
      LEFT JOIN users uc ON po.created_by = uc.id
      LEFT JOIN users ucomp ON po.completed_by = ucomp.id
      WHERE po.id = $1 AND po.company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get materials
    const materialsResult = await db.query(`
      SELECT
        pm.*,
        p.name as product_name,
        p.sku as product_sku,
        p.image_url as product_image,
        v.variant_name,
        w.name as warehouse_name
      FROM market_production_materials pm
      LEFT JOIN market_products p ON pm.product_id = p.id
      LEFT JOIN market_product_variants v ON pm.variant_id = v.id
      LEFT JOIN market_warehouses w ON pm.warehouse_id = w.id
      WHERE pm.production_order_id = $1
      ORDER BY pm.id
    `, [orderId])

    // Get activity log
    const logResult = await db.query(`
      SELECT
        pl.*,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as performed_by_name
      FROM market_production_log pl
      LEFT JOIN users u ON pl.performed_by = u.id
      WHERE pl.production_order_id = $1
      ORDER BY pl.performed_at DESC
    `, [orderId])

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        sourceProduct: {
          id: order.source_product_id,
          name: order.source_product_name,
          sku: order.source_product_sku,
          imageUrl: order.source_product_image,
          unit: order.source_product_unit,
          variantId: order.source_variant_id,
          variantName: order.source_variant_name
        },
        targetProduct: {
          id: order.target_product_id,
          name: order.target_product_name,
          sku: order.target_product_sku,
          imageUrl: order.target_product_image,
          unit: order.target_product_unit,
          variantId: order.target_variant_id,
          variantName: order.target_variant_name
        },
        sourceWarehouse: {
          id: order.source_warehouse_id,
          name: order.source_warehouse_name,
          code: order.source_warehouse_code
        },
        targetWarehouse: {
          id: order.target_warehouse_id,
          name: order.target_warehouse_name,
          code: order.target_warehouse_code
        },
        sourceQuantity: parseFloat(order.source_quantity) || 1,
        sourceUnitCost: parseFloat(order.source_unit_cost) || parseFloat(order.source_cost_per_kg) || 0,
        sourceWeightKg: parseFloat(order.source_weight_kg) || 0,
        targetPortionWeightKg: parseFloat(order.target_portion_weight_kg) || 0,
        targetQuantity: order.target_quantity,
        expectedTotalWeightKg: parseFloat(order.expected_total_weight_kg) || 0,
        wasteSurplus: {
          kg: parseFloat(order.waste_surplus_kg) || 0,
          type: order.waste_surplus_type
        },
        actualQuantity: order.actual_quantity,
        actualWasteSurplusKg: parseFloat(order.actual_waste_surplus_kg) || 0,
        costs: {
          // Costo basado en CANTIDAD (unidades), no en peso
          rawMaterial: (parseFloat(order.source_quantity) || 1) * (parseFloat(order.source_unit_cost) || parseFloat(order.source_cost_per_kg) || 0),
          materials: parseFloat(order.materials_cost) || 0,
          labor: parseFloat(order.labor_cost) || 0,
          total: parseFloat(order.total_cost) || 0,
          perUnit: parseFloat(order.cost_per_unit) || 0
        },
        documents: {
          productionDocPrinted: order.production_doc_printed,
          receptionDocPrinted: order.reception_doc_printed
        },
        materials: materialsResult.rows.map(m => ({
          id: m.id,
          productId: m.product_id,
          productName: m.product_name,
          productSku: m.product_sku,
          productImage: m.product_image,
          variantId: m.variant_id,
          variantName: m.variant_name,
          warehouseId: m.warehouse_id,
          warehouseName: m.warehouse_name,
          quantity: parseFloat(m.quantity) || 0,
          unitCost: parseFloat(m.unit_cost) || 0,
          totalCost: parseFloat(m.total_cost) || 0
        })),
        activityLog: logResult.rows.map(l => ({
          id: l.id,
          action: l.action,
          details: l.details,
          performedBy: l.performed_by_name,
          performedAt: l.performed_at
        })),
        lotNumber: order.lot_number,
        expirationDate: order.expiration_date,
        createdBy: order.created_by_name,
        completedBy: order.completed_by_name,
        createdAt: order.created_at,
        startedAt: order.started_at,
        completedAt: order.completed_at,
        notes: order.notes
      }
    })

  } catch (error) {
    console.error('[Production Order API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener orden de producción'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/market/production/orders/[id]
 * Update production order
 */
export async function PATCH(
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
    const resolvedParams = await params
    const orderId = parseInt(resolvedParams.id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Check order exists and belongs to company
    const existingOrder = await db.query(`
      SELECT id, status, order_number FROM market_production_orders
      WHERE id = $1 AND company_id = $2
    `, [orderId, companyId])

    if (existingOrder.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const currentStatus = existingOrder.rows[0].status
    const body = await request.json()
    const { status, laborCost, notes } = body

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      'pending': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    }

    if (status && !validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json({
        success: false,
        error: `No se puede cambiar el estado de "${currentStatus}" a "${status}"`
      }, { status: 400 })
    }

    // Build update query
    const updates: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (status) {
      updates.push(`status = $${paramIndex++}`)
      queryParams.push(status)

      if (status === 'in_progress') {
        updates.push(`started_at = NOW()`)
      } else if (status === 'completed') {
        updates.push(`completed_at = NOW()`)
        updates.push(`completed_by = $${paramIndex++}`)
        queryParams.push(userId)
      }
    }

    if (laborCost !== undefined) {
      updates.push(`labor_cost = $${paramIndex++}`)
      queryParams.push(laborCost)

      // Recalculate total_cost and cost_per_unit using QUANTITY-based costs
      const orderData = await db.query(`
        SELECT source_quantity, source_unit_cost, source_cost_per_kg, materials_cost, target_quantity
        FROM market_production_orders WHERE id = $1
      `, [orderId])

      const od = orderData.rows[0]
      // Use source_quantity × source_unit_cost (fall back to source_cost_per_kg for legacy data)
      const sourceQty = parseFloat(od.source_quantity) || 1
      const unitCost = parseFloat(od.source_unit_cost) || parseFloat(od.source_cost_per_kg) || 0
      const rawMaterialCost = sourceQty * unitCost
      const totalCost = rawMaterialCost + parseFloat(od.materials_cost) + laborCost
      const costPerUnit = od.target_quantity > 0 ? totalCost / od.target_quantity : 0

      updates.push(`total_cost = $${paramIndex++}`)
      queryParams.push(totalCost)
      updates.push(`cost_per_unit = $${paramIndex++}`)
      queryParams.push(costPerUnit)
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`)
      queryParams.push(notes)
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay cambios para actualizar'
      }, { status: 400 })
    }

    queryParams.push(orderId, companyId)

    await db.query(`
      UPDATE market_production_orders
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND company_id = $${paramIndex++}
    `, queryParams)

    // Log the update
    await db.query(`
      INSERT INTO market_production_log (
        production_order_id, action, details, performed_by, performed_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [
      orderId,
      status ? `status_changed_to_${status}` : 'updated',
      JSON.stringify(body),
      userId
    ])

    return NextResponse.json({
      success: true,
      message: 'Orden de producción actualizada exitosamente'
    })

  } catch (error) {
    console.error('[Production Order API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar orden de producción'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/production/orders/[id]
 * Cancel/delete production order
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
    const userId = payload.userId
    const resolvedParams = await params
    const orderId = parseInt(resolvedParams.id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Check order exists
    const existingOrder = await db.query(`
      SELECT id, status, order_number FROM market_production_orders
      WHERE id = $1 AND company_id = $2
    `, [orderId, companyId])

    if (existingOrder.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const currentStatus = existingOrder.rows[0].status

    // Only allow cancellation of pending or in_progress orders
    if (!['pending', 'in_progress'].includes(currentStatus)) {
      return NextResponse.json({
        success: false,
        error: `No se puede cancelar una orden con estado "${currentStatus}"`
      }, { status: 400 })
    }

    // Update status to cancelled
    await db.query(`
      UPDATE market_production_orders
      SET status = 'cancelled'
      WHERE id = $1 AND company_id = $2
    `, [orderId, companyId])

    // Log cancellation
    await db.query(`
      INSERT INTO market_production_log (
        production_order_id, action, details, performed_by, performed_at
      ) VALUES ($1, 'cancelled', $2, $3, NOW())
    `, [
      orderId,
      JSON.stringify({ previousStatus: currentStatus }),
      userId
    ])

    return NextResponse.json({
      success: true,
      message: 'Orden de producción cancelada exitosamente'
    })

  } catch (error) {
    console.error('[Production Order API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al cancelar orden de producción'
    }, { status: 500 })
  }
}
