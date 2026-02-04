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
 * Generate operation number for production in
 */
async function generateOperationNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PIN-${year}-`

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
 * Generate lot number for production
 * Format: PRD-YYMMDD-XXXX (e.g., PRD-250203-0001)
 */
async function generateProductionLotNumber(companyId: number): Promise<string> {
  const now = new Date()
  const yy = now.getFullYear().toString().slice(-2)
  const mm = (now.getMonth() + 1).toString().padStart(2, '0')
  const dd = now.getDate().toString().padStart(2, '0')
  const prefix = `PRD-${yy}${mm}${dd}-`

  const result = await db.query(`
    SELECT lot_number FROM production_lot_inventory
    WHERE company_id = $1 AND lot_number LIKE $2
    ORDER BY lot_number DESC
    LIMIT 1
  `, [companyId, `${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].lot_number
    const parts = lastNumber.split('-')
    nextNumber = parseInt(parts[2]) + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

/**
 * POST /api/market/production/orders/[id]/receive
 * Receive finished products from production (like purchase reception)
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
        tp.name as target_product_name,
        tp.cost_price as target_cost_price
      FROM market_production_orders po
      LEFT JOIN market_products tp ON po.target_product_id = tp.id
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
    if (order.status !== 'in_progress') {
      return NextResponse.json({
        success: false,
        error: `No se puede recibir productos para una orden con estado "${order.status}". Debe estar "in_progress".`
      }, { status: 400 })
    }

    // Check if production lot already exists (to prevent double processing)
    const existingLot = await db.query(`
      SELECT id, lot_number FROM production_lot_inventory
      WHERE production_order_id = $1 AND company_id = $2
      LIMIT 1
    `, [orderId, companyId])

    if (existingLot.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Esta orden de producción ya tiene un lote registrado (${existingLot.rows[0].lot_number}). No se puede procesar nuevamente.`
      }, { status: 400 })
    }

    const body = await request.json()
    const {
      targetWarehouseId,
      quantityReceived,
      expirationDate,
      notes,
      observations
    } = body

    // IMPORTANT: Use provided quantity or fall back to target_quantity (NOT source_quantity or source_weight)
    // target_quantity = number of portions to produce
    // source_quantity = number of source units used (e.g., 1 saco)
    // source_weight_kg = total weight of source material (e.g., 45kg)
    const actualQuantity = quantityReceived !== undefined && quantityReceived !== null
      ? parseFloat(String(quantityReceived))
      : parseFloat(String(order.target_quantity))
    const warehouseId = targetWarehouseId || order.target_warehouse_id

    // Log the values for debugging
    console.log('[Production Receive] Processing order:', {
      orderId,
      orderNumber: order.order_number,
      quantityReceivedFromBody: quantityReceived,
      targetQuantity: order.target_quantity,
      sourceQuantity: order.source_quantity,
      sourceWeightKg: order.source_weight_kg,
      calculatedActualQuantity: actualQuantity
    })

    // Validate the quantity makes sense (should be close to target_quantity, not source_weight)
    if (actualQuantity > order.target_quantity * 2) {
      console.warn('[Production Receive] WARNING: actualQuantity seems too high compared to target_quantity', {
        actualQuantity,
        targetQuantity: order.target_quantity,
        sourceWeightKg: order.source_weight_kg
      })
    }

    // Calculate actual waste/surplus
    const expectedTotalWeight = parseFloat(order.target_portion_weight_kg) * order.target_quantity
    const actualTotalWeight = parseFloat(order.target_portion_weight_kg) * actualQuantity
    const actualWasteSurplus = parseFloat(order.source_weight_kg) - actualTotalWeight
    const actualWasteSurplusType = actualWasteSurplus > 0.001 ? 'surplus' :
                                   actualWasteSurplus < -0.001 ? 'waste' : 'exact'

    // Recalculate cost per unit based on actual quantity
    const totalCost = parseFloat(order.total_cost)
    const actualCostPerUnit = actualQuantity > 0 ? totalCost / actualQuantity : 0

    const client = await db.getClient()

    try {
      await client.query('BEGIN')

      // 0. Generate lot number for FIFO tracking
      const lotNumber = await generateProductionLotNumber(companyId)

      // 1. Create warehouse operation for product reception
      const opNumber = await generateOperationNumber(companyId)

      const opResult = await client.query(`
        INSERT INTO market_warehouse_operations (
          company_id, operation_number, operation_type,
          destination_warehouse_id, reference_type, reference_id,
          status, scheduled_date, started_at, completed_at,
          notes, created_by, created_at
        ) VALUES (
          $1, $2, 'production_in',
          $3, 'production_order', $4,
          'done', CURRENT_DATE, NOW(), NOW(),
          $5, $6, NOW()
        )
        RETURNING id
      `, [
        companyId,
        opNumber,
        warehouseId,
        orderId,
        notes || observations || `Recepción de producción para orden ${order.order_number}`,
        userId
      ])

      const opId = opResult.rows[0].id

      // Create operation line
      await client.query(`
        INSERT INTO market_warehouse_operation_lines (
          operation_id, product_id, variant_id,
          quantity_planned, quantity_done, line_status,
          scanned_at, scanned_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, 'done', NOW(), $6, NOW())
      `, [
        opId,
        order.target_product_id,
        order.target_variant_id,
        order.target_quantity,
        actualQuantity,
        userId
      ])

      // 2. Update warehouse stock for target product
      const currentStockResult = await client.query(`
        SELECT quantity_on_hand FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2
          AND COALESCE(variant_id, 0) = COALESCE($3, 0)
      `, [warehouseId, order.target_product_id, order.target_variant_id])

      const currentStock = currentStockResult.rows.length > 0
        ? parseFloat(currentStockResult.rows[0].quantity_on_hand)
        : 0

      const newStock = currentStock + actualQuantity

      if (currentStockResult.rows.length > 0) {
        await client.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = $1, last_movement_at = NOW(), updated_at = NOW()
          WHERE warehouse_id = $2 AND product_id = $3
            AND COALESCE(variant_id, 0) = COALESCE($4, 0)
        `, [newStock, warehouseId, order.target_product_id, order.target_variant_id])
      } else {
        await client.query(`
          INSERT INTO market_warehouse_stock (
            warehouse_id, product_id, variant_id,
            quantity_on_hand, quantity_reserved, last_movement_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 0, NOW(), NOW(), NOW())
        `, [warehouseId, order.target_product_id, order.target_variant_id, newStock])
      }

      // 3. Record stock movement
      await client.query(`
        INSERT INTO market_stock_movements (
          company_id, product_id, variant_id, movement_type,
          to_warehouse_id, quantity, quantity_before, quantity_after,
          operation_id, reference_type, reference_id,
          notes, created_by, created_at
        ) VALUES ($1, $2, $3, 'in', $4, $5, $6, $7, $8, 'production_order', $9, $10, $11, NOW())
      `, [
        companyId,
        order.target_product_id,
        order.target_variant_id,
        warehouseId,
        actualQuantity,
        currentStock,
        newStock,
        opId,
        orderId,
        `Producción ${order.order_number}`,
        userId
      ])

      // 4. Create record in production_lot_inventory for FIFO tracking
      // Log the exact values being inserted
      console.log('[Production Receive] Creating lot with:', {
        lotNumber,
        orderId,
        productId: order.target_product_id,
        quantityInitial: actualQuantity,
        quantityAvailable: actualQuantity,
        targetQuantityFromOrder: order.target_quantity,
        sourceWeightKgFromOrder: order.source_weight_kg
      })

      await client.query(`
        INSERT INTO production_lot_inventory (
          company_id, warehouse_id, product_id, variant_id, production_order_id,
          lot_number, expiration_date, manufacturing_date,
          quantity_initial, quantity_available, quantity_sold,
          unit_cost, received_at, created_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, CURRENT_DATE,
          $8, $8, 0,
          $9, NOW(), NOW()
        )
      `, [
        companyId,
        warehouseId,
        order.target_product_id,
        order.target_variant_id,
        orderId,
        lotNumber,
        expirationDate || null,
        actualQuantity,
        actualCostPerUnit
      ])

      // 5. Update production order to completed with lot info
      await client.query(`
        UPDATE market_production_orders
        SET
          status = 'completed',
          completed_at = NOW(),
          completed_by = $1,
          actual_quantity = $2,
          actual_waste_surplus_kg = $3,
          waste_surplus_type = $4,
          cost_per_unit = $5,
          lot_number = $6,
          expiration_date = $7,
          notes = CASE WHEN $8 IS NOT NULL THEN COALESCE(notes || E'\n', '') || $8 ELSE notes END
        WHERE id = $9
      `, [
        userId,
        actualQuantity,
        actualWasteSurplus,
        actualWasteSurplusType,
        actualCostPerUnit,
        lotNumber,
        expirationDate || null,
        observations,
        orderId
      ])

      // 6. Update target product cost price (optional - average cost)
      // This updates the product's cost price based on production cost
      await client.query(`
        UPDATE market_products
        SET cost_price = $1, updated_at = NOW()
        WHERE id = $2 AND company_id = $3
      `, [actualCostPerUnit, order.target_product_id, companyId])

      // 7. Log the reception
      await client.query(`
        INSERT INTO market_production_log (
          production_order_id, action, details, performed_by, performed_at
        ) VALUES ($1, 'production_received', $2, $3, NOW())
      `, [
        orderId,
        JSON.stringify({
          operationNumber: opNumber,
          lotNumber,
          expirationDate: expirationDate || null,
          expectedQuantity: order.target_quantity,
          actualQuantity,
          expectedWasteSurplus: parseFloat(order.waste_surplus_kg),
          actualWasteSurplus,
          wasteSurplusType: actualWasteSurplusType,
          costPerUnit: actualCostPerUnit,
          warehouseId,
          observations
        }),
        userId
      ])

      await client.query('COMMIT')

      // Calculate discrepancy
      const quantityDiscrepancy = actualQuantity - order.target_quantity
      const hasDiscrepancy = quantityDiscrepancy !== 0

      return NextResponse.json({
        success: true,
        data: {
          operationNumber: opNumber,
          operationId: opId,
          lotNumber,
          expirationDate: expirationDate || null,
          newStatus: 'completed',
          actualQuantity,
          expectedQuantity: order.target_quantity,
          discrepancy: quantityDiscrepancy,
          hasDiscrepancy,
          wasteSurplus: {
            expected: {
              kg: parseFloat(order.waste_surplus_kg),
              type: order.waste_surplus_type
            },
            actual: {
              kg: actualWasteSurplus,
              type: actualWasteSurplusType
            }
          },
          costPerUnit: actualCostPerUnit,
          newStockLevel: newStock
        },
        message: hasDiscrepancy
          ? `Producción completada con discrepancia de ${quantityDiscrepancy > 0 ? '+' : ''}${quantityDiscrepancy} unidades. Lote: ${lotNumber}`
          : `Producción completada exitosamente. Lote: ${lotNumber}`
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('[Production Receive API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al recibir productos'
    }, { status: 500 })
  }
}
