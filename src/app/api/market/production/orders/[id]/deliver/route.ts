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
 * Generate operation number for production out
 */
async function generateOperationNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `POU-${year}-`

  const result = await db.query(`
    SELECT operation_number FROM market_warehouse_operations
    WHERE company_id = $1 AND operation_number LIKE $2
    ORDER BY operation_number DESC
    LIMIT 1
  `, [companyId, `${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].operation_number
    const parts = lastNumber.split('-')
    nextNumber = parseInt(parts[2]) + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

/**
 * POST /api/market/production/orders/[id]/deliver
 * Deliver materials for production (like transfer)
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

    // Get order details
    const orderResult = await db.query(`
      SELECT
        po.*,
        sp.name as source_product_name,
        sp.unit_of_measure as source_unit
      FROM market_production_orders po
      LEFT JOIN market_products sp ON po.source_product_id = sp.id
      WHERE po.id = $1 AND po.company_id = $2
    `, [orderId, companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden de producción no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Validate order status
    if (order.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: `No se puede entregar materiales para una orden con estado "${order.status}"`
      }, { status: 400 })
    }

    const body = await request.json()
    const { sourceWarehouseId, materials, notes } = body

    // Get materials from the order
    const orderMaterialsResult = await db.query(`
      SELECT pm.*, p.name as product_name
      FROM market_production_materials pm
      LEFT JOIN market_products p ON pm.product_id = p.id
      WHERE pm.production_order_id = $1
    `, [orderId])

    const client = await db.getClient()

    try {
      await client.query('BEGIN')

      // 1. Create warehouse operation for source product (materia prima)
      const sourceOpNumber = await generateOperationNumber(companyId)

      const sourceOpResult = await client.query(`
        INSERT INTO market_warehouse_operations (
          company_id, operation_number, operation_type,
          source_warehouse_id, reference_type, reference_id,
          status, scheduled_date, started_at, completed_at,
          notes, created_by, created_at
        ) VALUES (
          $1, $2, 'production_out',
          $3, 'production_order', $4,
          'done', CURRENT_DATE, NOW(), NOW(),
          $5, $6, NOW()
        )
        RETURNING id
      `, [
        companyId,
        sourceOpNumber,
        sourceWarehouseId || order.source_warehouse_id,
        orderId,
        notes || `Entrega de materia prima para orden ${order.order_number}`,
        userId
      ])

      const sourceOpId = sourceOpResult.rows[0].id

      // Create operation line for source product
      await client.query(`
        INSERT INTO market_warehouse_operation_lines (
          operation_id, product_id, variant_id,
          quantity_planned, quantity_done, line_status,
          scanned_at, scanned_by, created_at
        ) VALUES ($1, $2, $3, $4, $4, 'done', NOW(), $5, NOW())
      `, [
        sourceOpId,
        order.source_product_id,
        order.source_variant_id,
        order.source_weight_kg,
        userId
      ])

      // Update warehouse stock for source product
      const warehouseId = sourceWarehouseId || order.source_warehouse_id

      // Get current stock
      const currentStockResult = await client.query(`
        SELECT quantity_on_hand FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2
          AND COALESCE(variant_id, 0) = COALESCE($3, 0)
      `, [warehouseId, order.source_product_id, order.source_variant_id])

      const currentStock = currentStockResult.rows.length > 0
        ? parseFloat(currentStockResult.rows[0].quantity_on_hand)
        : 0

      const newStock = currentStock - parseFloat(order.source_weight_kg)

      if (currentStockResult.rows.length > 0) {
        await client.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = $1, last_movement_at = NOW(), updated_at = NOW()
          WHERE warehouse_id = $2 AND product_id = $3
            AND COALESCE(variant_id, 0) = COALESCE($4, 0)
        `, [newStock, warehouseId, order.source_product_id, order.source_variant_id])
      } else {
        await client.query(`
          INSERT INTO market_warehouse_stock (
            warehouse_id, product_id, variant_id,
            quantity_on_hand, quantity_reserved, last_movement_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 0, NOW(), NOW(), NOW())
        `, [warehouseId, order.source_product_id, order.source_variant_id, newStock])
      }

      // Record stock movement for source product
      await client.query(`
        INSERT INTO market_stock_movements (
          company_id, product_id, variant_id, movement_type,
          from_warehouse_id, quantity, quantity_before, quantity_after,
          operation_id, reference_type, reference_id,
          notes, created_by, created_at
        ) VALUES ($1, $2, $3, 'out', $4, $5, $6, $7, $8, 'production_order', $9, $10, $11, NOW())
      `, [
        companyId,
        order.source_product_id,
        order.source_variant_id,
        warehouseId,
        order.source_weight_kg,
        currentStock,
        newStock,
        sourceOpId,
        orderId,
        `Materia prima para ${order.order_number}`,
        userId
      ])

      // 2. Process materials (bolsas, etiquetas, etc.)
      const deliveredMaterials = materials || orderMaterialsResult.rows

      for (const material of deliveredMaterials) {
        const materialWarehouseId = material.warehouseId || material.warehouse_id
        const materialProductId = material.productId || material.product_id
        const materialVariantId = material.variantId || material.variant_id
        const materialQuantity = material.quantity

        // Get current stock for material
        const matStockResult = await client.query(`
          SELECT quantity_on_hand FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
            AND COALESCE(variant_id, 0) = COALESCE($3, 0)
        `, [materialWarehouseId, materialProductId, materialVariantId])

        const matCurrentStock = matStockResult.rows.length > 0
          ? parseFloat(matStockResult.rows[0].quantity_on_hand)
          : 0

        const matNewStock = matCurrentStock - materialQuantity

        // Update or insert stock
        if (matStockResult.rows.length > 0) {
          await client.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = $1, last_movement_at = NOW(), updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3
              AND COALESCE(variant_id, 0) = COALESCE($4, 0)
          `, [matNewStock, materialWarehouseId, materialProductId, materialVariantId])
        } else {
          await client.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id, product_id, variant_id,
              quantity_on_hand, quantity_reserved, last_movement_at, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, 0, NOW(), NOW(), NOW())
          `, [materialWarehouseId, materialProductId, materialVariantId, matNewStock])
        }

        // Record stock movement
        await client.query(`
          INSERT INTO market_stock_movements (
            company_id, product_id, variant_id, movement_type,
            from_warehouse_id, quantity, quantity_before, quantity_after,
            operation_id, reference_type, reference_id,
            notes, created_by, created_at
          ) VALUES ($1, $2, $3, 'out', $4, $5, $6, $7, $8, 'production_order', $9, $10, $11, NOW())
        `, [
          companyId,
          materialProductId,
          materialVariantId,
          materialWarehouseId,
          materialQuantity,
          matCurrentStock,
          matNewStock,
          sourceOpId,
          orderId,
          `Material para ${order.order_number}`,
          userId
        ])
      }

      // 3. Update production order status to in_progress
      await client.query(`
        UPDATE market_production_orders
        SET status = 'in_progress', started_at = NOW()
        WHERE id = $1
      `, [orderId])

      // 4. Log the delivery
      await client.query(`
        INSERT INTO market_production_log (
          production_order_id, action, details, performed_by, performed_at
        ) VALUES ($1, 'materials_delivered', $2, $3, NOW())
      `, [
        orderId,
        JSON.stringify({
          operationNumber: sourceOpNumber,
          sourceProductWeight: order.source_weight_kg,
          materialsDelivered: deliveredMaterials.length
        }),
        userId
      ])

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: {
          operationNumber: sourceOpNumber,
          operationId: sourceOpId,
          newStatus: 'in_progress'
        },
        message: 'Materiales entregados exitosamente'
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('[Production Deliver API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al entregar materiales'
    }, { status: 500 })
  }
}
