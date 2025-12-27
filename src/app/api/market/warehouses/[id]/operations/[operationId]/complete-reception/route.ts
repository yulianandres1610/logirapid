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

    // Get lines and check validation status
    const linesResult = await db.query(`
      SELECT
        l.id as line_id,
        l.product_id,
        p.name as product_name,
        p.sku,
        l.quantity_planned as quantity_expected,
        COALESCE(l.quantity_validated, 0) as quantity_validated
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      WHERE l.operation_id = $1
    `, [opId])

    const lines = linesResult.rows

    // Check if there are discrepancies
    let hasDiscrepancies = false
    for (const line of lines) {
      const expected = parseFloat(line.quantity_expected) || 0
      const validated = parseFloat(line.quantity_validated) || 0
      if (expected !== validated) {
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

      // Process each line
      for (const line of lines) {
        const productId = line.product_id
        const expectedQuantity = parseFloat(line.quantity_expected) || 0
        const validatedQuantity = parseFloat(line.quantity_validated) || 0

        // Get current stock in source warehouse
        const sourceStockResult = await db.query(`
          SELECT id, quantity_on_hand, quantity_reserved
          FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
        `, [sourceWarehouseId, productId])

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
              company_id, product_id, movement_type,
              from_warehouse_id, to_warehouse_id,
              quantity, quantity_before, quantity_after,
              operation_id, reference_type, reference_id, notes, created_by, created_at
            ) VALUES ($1, $2, 'transfer_out', $3, $4, $5, $6, $7, $8, 'warehouse_operation', $9, $10, $11, NOW())
          `, [
            payload.companyId,
            productId,
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

        // Add stock to destination warehouse
        const destStockResult = await db.query(`
          SELECT id, quantity_on_hand
          FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
        `, [destinationWarehouseId, productId])

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
              warehouse_id, product_id, quantity_on_hand, quantity_reserved, created_at
            ) VALUES ($1, $2, $3, 0, NOW())
          `, [destinationWarehouseId, productId, validatedQuantity])
        }

        // Record stock movement for destination (in)
        await db.query(`
          INSERT INTO market_stock_movements (
            company_id, product_id, movement_type,
            from_warehouse_id, to_warehouse_id,
            quantity, quantity_before, quantity_after,
            operation_id, reference_type, reference_id, notes, created_by, created_at
          ) VALUES ($1, $2, 'transfer_in', $3, $4, $5, $6, $7, $8, 'warehouse_operation', $9, $10, $11, NOW())
        `, [
          payload.companyId,
          productId,
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
