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

interface CompleteReceptionRequest {
  discrepancyNotes?: string
  forceComplete?: boolean // Allow completing even without full validation
}

/**
 * POST /api/market/warehouses/[id]/operations/[operationId]/complete-reception
 * Complete the transfer reception, moving stock from source to destination
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; operationId: string }> }
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

    const { id, operationId } = await params
    const warehouseId = parseInt(id)
    const opId = parseInt(operationId)

    if (isNaN(warehouseId) || isNaN(opId)) {
      return NextResponse.json({
        success: false,
        error: 'IDs inválidos'
      }, { status: 400 })
    }

    const body: CompleteReceptionRequest = await request.json()
    const { discrepancyNotes, forceComplete } = body

    // Verify operation
    const operationResult = await db.query(`
      SELECT
        o.id, o.operation_number, o.status, o.validation_status,
        o.source_warehouse_id, o.destination_warehouse_id,
        sw.name as source_warehouse_name,
        sw.allow_negative_stock as source_allow_negative
      FROM market_warehouse_operations o
      LEFT JOIN market_warehouses sw ON sw.id = o.source_warehouse_id
      WHERE o.id = $1
        AND o.destination_warehouse_id = $2
        AND o.company_id = $3
        AND o.operation_type = 'internal'
    `, [opId, warehouseId, payload.companyId])

    if (operationResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Operación no encontrada'
      }, { status: 404 })
    }

    const operation = operationResult.rows[0]

    // Verify operation is pending validation
    if (operation.status !== 'pending' || operation.validation_status !== 'pending_validation') {
      return NextResponse.json({
        success: false,
        error: 'Esta operación ya fue procesada o no está pendiente de validación'
      }, { status: 400 })
    }

    // Get lines grouped by product+variant and check validation status
    const linesResult = await db.query(`
      SELECT
        MIN(l.id) as line_id,
        l.product_id,
        l.variant_id,
        p.name as product_name,
        p.sku,
        v.variant_name,
        SUM(l.quantity_planned) as quantity_expected,
        SUM(COALESCE(l.quantity_validated, 0)) as quantity_validated
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      LEFT JOIN market_product_variants v ON v.id = l.variant_id
      WHERE l.operation_id = $1
      GROUP BY l.product_id, l.variant_id, p.name, p.sku, v.variant_name
    `, [opId])

    const lines = linesResult.rows

    // Check if there are discrepancies (with tolerance for floating point)
    const TOLERANCE = 0.001
    let hasDiscrepancies = false
    for (const line of lines) {
      const expected = parseFloat(line.quantity_expected) || 0
      const validated = parseFloat(line.quantity_validated) || 0
      if (Math.abs(expected - validated) >= TOLERANCE) {
        hasDiscrepancies = true
        break
      }
    }

    // If there are discrepancies, require a note
    if (hasDiscrepancies && !discrepancyNotes) {
      return NextResponse.json({
        success: false,
        error: 'Hay diferencias en las cantidades. Debe proporcionar una nota explicando las discrepancias.',
        requiresNote: true
      }, { status: 400 })
    }

    // Check if at least some validation was done
    const totalValidated = lines.reduce((sum, l) => sum + (parseFloat(l.quantity_validated) || 0), 0)
    if (totalValidated === 0 && !forceComplete) {
      return NextResponse.json({
        success: false,
        error: 'No se ha validado ningún producto. Escanee los productos antes de confirmar.',
        requiresValidation: true
      }, { status: 400 })
    }

    // Begin transaction
    await db.query('BEGIN')

    try {
      const sourceWarehouseId = operation.source_warehouse_id
      const destinationWarehouseId = operation.destination_warehouse_id

      // Process each line (grouped by product+variant)
      for (const line of lines) {
        const productId = line.product_id
        const variantId = line.variant_id || null
        const expectedQuantity = parseFloat(line.quantity_expected) || 0
        const validatedQuantity = parseFloat(line.quantity_validated) || 0

        // Get current stock in source warehouse (including variant)
        const sourceStockResult = await db.query(`
          SELECT id, quantity_on_hand, quantity_reserved
          FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
            AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
        `, [sourceWarehouseId, productId, variantId])

        if (sourceStockResult.rows.length > 0) {
          const sourceStock = sourceStockResult.rows[0]
          const currentOnHand = parseFloat(sourceStock.quantity_on_hand) || 0
          const currentReserved = parseFloat(sourceStock.quantity_reserved) || 0

          // Release reservation and decrease stock by validated amount
          const newReserved = Math.max(0, currentReserved - expectedQuantity)
          const newOnHand = currentOnHand - validatedQuantity

          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = $1, quantity_reserved = $2, updated_at = NOW()
            WHERE id = $3
          `, [newOnHand, newReserved, sourceStock.id])

          // Record stock movement for source (out)
          await db.query(`
            INSERT INTO market_stock_movements (
              company_id, product_id, variant_id, movement_type,
              from_warehouse_id, to_warehouse_id,
              quantity, quantity_before, quantity_after,
              operation_id, reference_type, reference_id, notes, created_by, created_at
            ) VALUES ($1, $2, $3, 'transfer_out', $4, $5, $6, $7, $8, $9, 'warehouse_operation', $10, $11, $12, NOW())
          `, [
            payload.companyId,
            productId,
            variantId,
            sourceWarehouseId,
            destinationWarehouseId,
            -validatedQuantity,
            currentOnHand,
            newOnHand,
            opId,
            opId,
            hasDiscrepancies ? `Transferencia con discrepancia: esperado ${expectedQuantity}, validado ${validatedQuantity}` : null,
            payload.userId
          ])
        }

        // Add stock to destination warehouse (including variant)
        const destStockResult = await db.query(`
          SELECT id, quantity_on_hand
          FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
            AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
        `, [destinationWarehouseId, productId, variantId])

        let destCurrentStock = 0
        if (destStockResult.rows.length > 0) {
          destCurrentStock = parseFloat(destStockResult.rows[0].quantity_on_hand) || 0
          const newDestStock = destCurrentStock + validatedQuantity

          await db.query(`
            UPDATE market_warehouse_stock
            SET quantity_on_hand = $1, updated_at = NOW()
            WHERE id = $2
          `, [newDestStock, destStockResult.rows[0].id])
        } else {
          await db.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at
            ) VALUES ($1, $2, $3, $4, 0, NOW())
          `, [destinationWarehouseId, productId, variantId, validatedQuantity])
        }

        // Record stock movement for destination (in)
        await db.query(`
          INSERT INTO market_stock_movements (
            company_id, product_id, variant_id, movement_type,
            from_warehouse_id, to_warehouse_id,
            quantity, quantity_before, quantity_after,
            operation_id, reference_type, reference_id, notes, created_by, created_at
          ) VALUES ($1, $2, $3, 'transfer_in', $4, $5, $6, $7, $8, $9, 'warehouse_operation', $10, $11, $12, NOW())
        `, [
          payload.companyId,
          productId,
          variantId,
          sourceWarehouseId,
          destinationWarehouseId,
          validatedQuantity,
          destCurrentStock,
          destCurrentStock + validatedQuantity,
          opId,
          opId,
          hasDiscrepancies ? `Recepción con discrepancia: esperado ${expectedQuantity}, recibido ${validatedQuantity}` : null,
          payload.userId
        ])

        // ============================================================
        // SYNC VARIANT TOTAL: Actualizar market_product_variants.quantity_on_hand
        // ============================================================
        if (variantId) {
          const totalVariantStock = await db.query(`
            SELECT COALESCE(SUM(quantity_on_hand), 0) as total
            FROM market_warehouse_stock
            WHERE product_id = $1 AND variant_id = $2
          `, [productId, variantId])

          await db.query(`
            UPDATE market_product_variants
            SET quantity_on_hand = $1, updated_at = NOW()
            WHERE id = $2
          `, [parseFloat(totalVariantStock.rows[0].total) || 0, variantId])

          console.log(`[Transfer] Variant ${variantId} total stock synced: ${totalVariantStock.rows[0].total}`)
        }

        // ============================================================
        // MOVER LOTES FIFO: Transferir lotes del almacén origen al destino
        // ============================================================
        let remainingToTransfer = validatedQuantity

        // 1. Mover lotes de COMPRA (purchase_lot_inventory)
        if (remainingToTransfer > 0) {
          const purchaseLots = await db.query(`
            SELECT id, lot_number, quantity_available, unit_cost, supplier_id,
                   purchase_line_id, expiration_date, manufacturing_date
            FROM purchase_lot_inventory
            WHERE warehouse_id = $1 AND product_id = $2
              AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
              AND quantity_available > 0
            ORDER BY received_at ASC
            FOR UPDATE
          `, [sourceWarehouseId, productId, variantId])

          for (const lot of purchaseLots.rows) {
            if (remainingToTransfer <= 0) break

            const availableInLot = parseFloat(lot.quantity_available) || 0
            const toTransfer = Math.min(remainingToTransfer, availableInLot)

            // Reducir del lote origen
            await db.query(`
              UPDATE purchase_lot_inventory
              SET quantity_available = quantity_available - $1
              WHERE id = $2
            `, [toTransfer, lot.id])

            // Buscar o crear lote en destino con el mismo lot_number
            const destLot = await db.query(`
              SELECT id, quantity_available FROM purchase_lot_inventory
              WHERE warehouse_id = $1 AND product_id = $2 AND lot_number = $3
                AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
            `, [destinationWarehouseId, productId, lot.lot_number, variantId])

            if (destLot.rows.length > 0) {
              // Sumar al lote existente en destino
              await db.query(`
                UPDATE purchase_lot_inventory
                SET quantity_available = quantity_available + $1,
                    quantity_initial = quantity_initial + $1
                WHERE id = $2
              `, [toTransfer, destLot.rows[0].id])
            } else {
              // Crear nuevo lote en destino
              await db.query(`
                INSERT INTO purchase_lot_inventory (
                  company_id, warehouse_id, product_id, variant_id, purchase_line_id,
                  supplier_id, lot_number, expiration_date, manufacturing_date,
                  quantity_initial, quantity_available, quantity_sold, unit_cost, received_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, NOW())
              `, [
                payload.companyId, destinationWarehouseId, productId, variantId,
                lot.purchase_line_id, lot.supplier_id, lot.lot_number,
                lot.expiration_date, lot.manufacturing_date,
                toTransfer, toTransfer, lot.unit_cost
              ])
            }

            remainingToTransfer -= toTransfer
            console.log(`[Transfer] Movido lote compra ${lot.lot_number}: ${toTransfer} unidades`)
          }
        }

        // 2. Mover lotes de CONSIGNACIÓN (consignment_lot_inventory)
        if (remainingToTransfer > 0) {
          const consignmentLots = await db.query(`
            SELECT id, lot_number, quantity_available, unit_cost, supplier_id,
                   order_line_id, expiration_date
            FROM consignment_lot_inventory
            WHERE warehouse_id = $1 AND product_id = $2
              AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
              AND quantity_available > 0
            ORDER BY received_at ASC
            FOR UPDATE
          `, [sourceWarehouseId, productId, variantId])

          for (const lot of consignmentLots.rows) {
            if (remainingToTransfer <= 0) break

            const availableInLot = parseFloat(lot.quantity_available) || 0
            const toTransfer = Math.min(remainingToTransfer, availableInLot)

            // Reducir del lote origen
            await db.query(`
              UPDATE consignment_lot_inventory
              SET quantity_available = quantity_available - $1
              WHERE id = $2
            `, [toTransfer, lot.id])

            // Buscar o crear lote en destino con el mismo lot_number
            const destLot = await db.query(`
              SELECT id, quantity_available FROM consignment_lot_inventory
              WHERE warehouse_id = $1 AND product_id = $2 AND lot_number = $3
                AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
            `, [destinationWarehouseId, productId, lot.lot_number, variantId])

            if (destLot.rows.length > 0) {
              // Sumar al lote existente en destino
              await db.query(`
                UPDATE consignment_lot_inventory
                SET quantity_available = quantity_available + $1,
                    quantity_initial = quantity_initial + $1
                WHERE id = $2
              `, [toTransfer, destLot.rows[0].id])
            } else {
              // Crear nuevo lote en destino
              await db.query(`
                INSERT INTO consignment_lot_inventory (
                  company_id, warehouse_id, product_id, variant_id, order_line_id,
                  supplier_id, lot_number, expiration_date,
                  quantity_initial, quantity_available, quantity_sold, unit_cost, received_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, NOW())
              `, [
                payload.companyId, destinationWarehouseId, productId, variantId,
                lot.order_line_id, lot.supplier_id, lot.lot_number, lot.expiration_date,
                toTransfer, toTransfer, lot.unit_cost
              ])
            }

            remainingToTransfer -= toTransfer
            console.log(`[Transfer] Movido lote consignación ${lot.lot_number}: ${toTransfer} unidades`)
          }
        }

        if (remainingToTransfer > 0) {
          console.warn(`[Transfer] ADVERTENCIA: Quedan ${remainingToTransfer} unidades sin lote FIFO para producto ${productId}`)
        }
      }

      // Update operation status
      await db.query(`
        UPDATE market_warehouse_operations
        SET status = 'done',
            validation_status = 'validated',
            validated_by = $1,
            validated_at = NOW(),
            discrepancy_notes = $2,
            completed_at = NOW()
        WHERE id = $3
      `, [payload.userId, discrepancyNotes || null, opId])

      await db.query('COMMIT')

      // Calculate summary
      const totalExpected = lines.reduce((sum, l) => sum + (parseFloat(l.quantity_expected) || 0), 0)
      const totalReceived = lines.reduce((sum, l) => sum + (parseFloat(l.quantity_validated) || 0), 0)

      return NextResponse.json({
        success: true,
        message: hasDiscrepancies
          ? `Recepción completada con discrepancias: ${totalReceived} de ${totalExpected} unidades recibidas`
          : `Recepción completada exitosamente: ${totalReceived} unidades recibidas`,
        data: {
          operationId: opId,
          operationNumber: operation.operation_number,
          sourceWarehouseId,
          sourceWarehouseName: operation.source_warehouse_name,
          destinationWarehouseId,
          totalProducts: lines.length,
          totalExpected,
          totalReceived,
          hasDiscrepancies,
          discrepancyNotes: discrepancyNotes || null
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Complete Reception] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al completar recepción'
    }, { status: 500 })
  }
}
