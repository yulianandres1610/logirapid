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

type OperationType = 'reception' | 'transfer' | 'scrap' | 'adjustment' | 'wholesale_delivery' | 'production_out' | 'production_in'
type ReferenceType = 'purchase_order' | 'consignment' | 'none'

interface OperationLine {
  productId: number
  variantId?: number | null
  quantity: number
  realStock?: number
  scrapReason?: string
  adjustmentReason?: string
  notes?: string
}

interface ConfirmOperationRequest {
  operationType: OperationType
  destinationWarehouseId?: number
  referenceType?: ReferenceType
  referenceId?: number
  scrapReason?: string
  adjustmentReason?: string
  notes?: string
  lines: OperationLine[]
}

/**
 * POST /api/market/warehouses/[id]/operations/confirm
 * Confirm a warehouse operation (reception, transfer, scrap, adjustment)
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

    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id, name, allow_negative_stock FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    const warehouse = warehouseCheck.rows[0]
    const body: ConfirmOperationRequest = await request.json()

    const {
      operationType,
      destinationWarehouseId,
      referenceType,
      referenceId,
      scrapReason,
      adjustmentReason,
      notes,
      lines
    } = body

    // Validate operation type
    if (!['reception', 'transfer', 'scrap', 'adjustment'].includes(operationType)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de operación inválido'
      }, { status: 400 })
    }

    // Validate lines
    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe incluir al menos un producto'
      }, { status: 400 })
    }

    // Validate transfer destination
    if (operationType === 'transfer') {
      if (!destinationWarehouseId) {
        return NextResponse.json({
          success: false,
          error: 'Debe seleccionar almacén de destino para transferencias'
        }, { status: 400 })
      }

      if (destinationWarehouseId === warehouseId) {
        return NextResponse.json({
          success: false,
          error: 'El almacén de destino debe ser diferente al origen'
        }, { status: 400 })
      }

      // Verify destination warehouse exists
      const destCheck = await db.query(
        'SELECT id, name FROM market_warehouses WHERE id = $1 AND company_id = $2 AND is_active = true',
        [destinationWarehouseId, payload.companyId]
      )

      if (destCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Almacén de destino no encontrado'
        }, { status: 404 })
      }
    }

    // Validate scrap reason
    if (operationType === 'scrap' && !scrapReason) {
      return NextResponse.json({
        success: false,
        error: 'Debe especificar el motivo del scrap'
      }, { status: 400 })
    }

    // Validate adjustment reason
    if (operationType === 'adjustment' && !adjustmentReason) {
      return NextResponse.json({
        success: false,
        error: 'Debe especificar el motivo del ajuste'
      }, { status: 400 })
    }

    await db.query('BEGIN')

    try {
      // Generate operation number based on MAX existing number (not COUNT)
      const currentYear = new Date().getFullYear()
      const opMaxResult = await db.query(`
        SELECT MAX(
          CAST(
            SUBSTRING(operation_number FROM 'OP-${currentYear}-(\\d+)')
            AS INTEGER
          )
        ) as max_num
        FROM market_warehouse_operations
        WHERE company_id = $1
          AND operation_number LIKE 'OP-${currentYear}-%'
      `, [payload.companyId])
      const maxNum = parseInt(opMaxResult.rows[0].max_num) || 0
      const nextNum = maxNum + 1
      const operationNumber = `OP-${currentYear}-${String(nextNum).padStart(6, '0')}`

      // Map operation type to database format
      const dbOperationType = operationType === 'reception' ? 'in' :
                              operationType === 'transfer' ? 'internal' :
                              operationType === 'scrap' ? 'out' : 'adjustment'

      // For transfers, status is 'pending' until destination validates
      // For other operations, status is 'done' immediately
      const initialStatus = operationType === 'transfer' ? 'pending' : 'done'
      const validationStatus = operationType === 'transfer' ? 'pending_validation' : null
      const completedAt = operationType === 'transfer' ? null : 'NOW()'

      // Create operation record
      const operationResult = await db.query(`
        INSERT INTO market_warehouse_operations (
          company_id,
          source_warehouse_id,
          operation_number,
          operation_type,
          destination_warehouse_id,
          reference_type,
          reference_id,
          status,
          validation_status,
          notes,
          created_by,
          created_at,
          completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), ${operationType === 'transfer' ? 'NULL' : 'NOW()'})
        RETURNING id
      `, [
        payload.companyId,
        warehouseId,
        operationNumber,
        dbOperationType,
        destinationWarehouseId || null,
        referenceType || null,
        referenceId || null,
        initialStatus,
        validationStatus,
        notes || null,
        payload.userId
      ])

      const operationId = operationResult.rows[0].id
      let totalQuantity = 0
      let processedLines = 0

      // Process each line
      for (const line of lines) {
        // Validate product exists and belongs to company
        const productCheck = await db.query(
          'SELECT id, name, sku FROM market_products WHERE id = $1 AND company_id = $2',
          [line.productId, payload.companyId]
        )

        if (productCheck.rows.length === 0) {
          throw new Error(`Producto ID ${line.productId} no encontrado`)
        }

        const product = productCheck.rows[0]

        // Get current stock (considering variant if provided)
        const stockResult = await db.query(`
          SELECT id, quantity_on_hand, quantity_reserved
          FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
            AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
        `, [warehouseId, line.productId, line.variantId || null])

        const currentStock = stockResult.rows.length > 0
          ? parseFloat(stockResult.rows[0].quantity_on_hand) || 0
          : 0

        let quantityChange = 0
        let lineNotes = line.notes || ''

        switch (operationType) {
          case 'reception':
            quantityChange = line.quantity
            break

          case 'transfer':
            // Validate sufficient stock for transfer (considering already reserved)
            const currentReserved = stockResult.rows.length > 0
              ? parseFloat(stockResult.rows[0].quantity_reserved) || 0
              : 0
            const availableStock = currentStock - currentReserved
            if (line.quantity > availableStock && !warehouse.allow_negative_stock) {
              throw new Error(`Stock insuficiente para ${product.name} (SKU: ${product.sku}). Disponible: ${availableStock}, Solicitado: ${line.quantity}`)
            }
            // For transfers: quantity_on_hand stays the same, we only reserve
            // quantityChange remains 0 - stock will be moved when destination validates
            quantityChange = 0
            break

          case 'scrap':
            // Validate sufficient stock for scrap
            if (line.quantity > currentStock && !warehouse.allow_negative_stock) {
              throw new Error(`Stock insuficiente para ${product.name} (SKU: ${product.sku}). Disponible: ${currentStock}, Solicitado: ${line.quantity}`)
            }
            quantityChange = -line.quantity
            lineNotes = `${scrapReason}${line.scrapReason ? ': ' + line.scrapReason : ''}${lineNotes ? ' - ' + lineNotes : ''}`
            break

          case 'adjustment':
            const realStock = line.realStock ?? 0
            quantityChange = realStock - currentStock
            lineNotes = `Ajuste: ${currentStock} → ${realStock}. ${adjustmentReason}${lineNotes ? ' - ' + lineNotes : ''}`
            break

          case 'wholesale_delivery':
            // Deduct stock for wholesale delivery
            if (line.quantity > currentStock && !warehouse.allow_negative_stock) {
              throw new Error(`Stock insuficiente para ${product.name} (SKU: ${product.sku}). Disponible: ${currentStock}, Solicitado: ${line.quantity}`)
            }
            quantityChange = -line.quantity
            lineNotes = `Entrega mayorista${lineNotes ? ' - ' + lineNotes : ''}`
            break

          case 'production_out':
            quantityChange = -line.quantity
            break

          case 'production_in':
            quantityChange = line.quantity
            break
        }

        const newStock = currentStock + quantityChange

        // For transfers, quantity is the planned quantity (stock doesn't move yet)
        // For other operations, quantity is the actual change
        const lineQuantity = operationType === 'transfer' ? line.quantity : Math.abs(quantityChange)

        // Create operation line (including variant_id)
        await db.query(`
          INSERT INTO market_warehouse_operation_lines (
            operation_id,
            product_id,
            variant_id,
            quantity_planned,
            quantity_done,
            scrap_reason,
            line_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          operationId,
          line.productId,
          line.variantId || null,
          lineQuantity,
          operationType === 'transfer' ? 0 : lineQuantity, // For transfers, quantity_done starts at 0
          operationType === 'scrap' ? (line.scrapReason || scrapReason) : null,
          operationType === 'transfer' ? 'pending' : 'done'
        ])

        // Update stock in source warehouse
        if (operationType === 'transfer') {
          // For transfers: RESERVE stock instead of moving it
          // Stock will be actually moved when destination validates reception
          if (stockResult.rows.length > 0) {
            const newReserved = (parseFloat(stockResult.rows[0].quantity_reserved) || 0) + line.quantity
            await db.query(`
              UPDATE market_warehouse_stock
              SET quantity_reserved = $1, updated_at = NOW()
              WHERE id = $2
            `, [newReserved, stockResult.rows[0].id])
          } else {
            // Create stock record with reserved quantity
            await db.query(`
              INSERT INTO market_warehouse_stock (
                warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at
              ) VALUES ($1, $2, $3, 0, $4, NOW())
            `, [warehouseId, line.productId, line.variantId || null, line.quantity])
          }
          // NOTE: Stock is NOT added to destination warehouse here
          // That happens when destination validates the reception
        } else {
          // For other operations: directly update quantity_on_hand
          if (stockResult.rows.length > 0) {
            await db.query(`
              UPDATE market_warehouse_stock
              SET quantity_on_hand = $1, updated_at = NOW()
              WHERE id = $2
            `, [newStock, stockResult.rows[0].id])
          } else {
            await db.query(`
              INSERT INTO market_warehouse_stock (
                warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at
              ) VALUES ($1, $2, $3, $4, 0, NOW())
            `, [warehouseId, line.productId, line.variantId || null, newStock])
          }
        }

        // Record stock movement (except for transfers - they record movement when validated)
        if (operationType !== 'transfer') {
          const movementType = operationType === 'reception' ? 'in' :
                               operationType === 'scrap' ? 'scrap' : 'adjustment'

          await db.query(`
            INSERT INTO market_stock_movements (
              company_id,
              product_id,
              variant_id,
              movement_type,
              from_warehouse_id,
              to_warehouse_id,
              quantity,
              quantity_before,
              quantity_after,
              operation_id,
              reference_type,
              reference_id,
              notes,
              created_by,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
          `, [
            payload.companyId,
            line.productId,
            line.variantId || null,
            movementType,
            movementType === 'in' ? null : warehouseId,  // from_warehouse_id (null for reception)
            movementType === 'in' ? warehouseId : null,  // to_warehouse_id (set for reception)
            quantityChange,
            currentStock,
            newStock,
            operationId,
            'warehouse_operation',
            operationId,
            lineNotes || null,
            payload.userId
          ])
        }
        // For transfers: stock movements will be recorded when destination validates

        totalQuantity += Math.abs(line.quantity)
        processedLines++
      }

      // If this is a consignment reception, update consignment status
      if (operationType === 'reception' && referenceType === 'consignment' && referenceId) {
        try {
          // Update consignment order items with received quantities
          for (const line of lines) {
            await db.query(`
              UPDATE consignment_order_items
              SET quantity_received = COALESCE(quantity_received, 0) + $1
              WHERE consignment_order_id = $2 AND product_id = $3
            `, [line.quantity, referenceId, line.productId])
          }

          // Update consignment order status to received
          await db.query(`
            UPDATE consignment_orders
            SET status = 'received',
                receiver_warehouse_id = $1,
                received_by = $2,
                received_at = NOW(),
                actual_delivery_date = CURRENT_DATE,
                updated_at = NOW()
            WHERE id = $3
          `, [warehouseId, payload.userId, referenceId])
        } catch (consError) {
          console.log('[Confirm Operation] Could not update consignment:', consError)
        }
      }

      // If wholesale_delivery: update invoice delivery status + consignment lots + quantity_delivered
      if (operationType === 'wholesale_delivery' && referenceId) {
        try {
          // Update delivery status to dispatched
          await db.query(`
            UPDATE market_invoice_deliveries SET status = 'dispatched', dispatched_at = NOW(), dispatched_by = $1
            WHERE operation_id = $2
          `, [payload.userId, operationId])

          // Update invoice lines quantity_delivered and invoice status
          const deliveryLines = await db.query(
            'SELECT invoice_line_id, quantity_to_deliver, product_id, variant_id FROM market_invoice_delivery_lines WHERE delivery_id IN (SELECT id FROM market_invoice_deliveries WHERE operation_id = $1)',
            [operationId]
          )
          for (const dl of deliveryLines.rows) {
            await db.query(
              'UPDATE market_invoice_lines SET quantity_delivered = COALESCE(quantity_delivered, 0) + $1 WHERE id = $2',
              [dl.quantity_to_deliver, dl.invoice_line_id]
            )
            await db.query(
              'UPDATE market_invoice_delivery_lines SET quantity_delivered = quantity_to_deliver WHERE invoice_line_id = $1 AND delivery_id IN (SELECT id FROM market_invoice_deliveries WHERE operation_id = $2)',
              [dl.invoice_line_id, operationId]
            )

            // Deduct consignment lots (FIFO)
            try {
              const qty = parseFloat(dl.quantity_to_deliver) || 0
              let remaining = qty
              const lots = await db.query(`
                SELECT id, quantity_available, unit_cost, order_line_id, supplier_id
                FROM consignment_lot_inventory
                WHERE warehouse_id = $1 AND product_id = $2 AND quantity_available > 0
                ORDER BY received_at ASC
              `, [warehouseId, dl.product_id])

              for (const lot of lots.rows) {
                if (remaining <= 0) break
                const available = parseFloat(lot.quantity_available) || 0
                const toDeduct = Math.min(remaining, available)
                const unitCost = parseFloat(lot.unit_cost) || 0

                await db.query('UPDATE consignment_lot_inventory SET quantity_available = quantity_available - $1, quantity_sold = COALESCE(quantity_sold, 0) + $1 WHERE id = $2', [toDeduct, lot.id])

                if (lot.order_line_id) {
                  await db.query('UPDATE consignment_order_lines SET quantity_sold = COALESCE(quantity_sold, 0) + $1 WHERE id = $2', [toDeduct, lot.order_line_id])
                  const orderRes = await db.query('SELECT order_id FROM consignment_order_lines WHERE id = $1', [lot.order_line_id])
                  if (orderRes.rows.length > 0) {
                    await db.query('UPDATE consignment_orders SET total_sold = COALESCE(total_sold, 0) + $1, updated_at = NOW() WHERE id = $2', [toDeduct * unitCost, orderRes.rows[0].order_id])
                  }
                }

                if (lot.supplier_id) {
                  await db.query('UPDATE consignment_supplier_wallets SET balance_available = COALESCE(balance_available, 0) + $1, total_earned = COALESCE(total_earned, 0) + $1 WHERE supplier_id = $2', [toDeduct * unitCost, lot.supplier_id])
                }

                remaining -= toDeduct
              }
            } catch (consErr) {
              console.log('[Confirm] Consignment lot deduction skipped:', consErr instanceof Error ? consErr.message : consErr)
            }
          }

          // Update invoice status to delivered
          await db.query(`
            UPDATE market_invoices SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
            WHERE id = $1
          `, [referenceId])

          console.log('[Confirm] Wholesale delivery completed for invoice', referenceId)
        } catch (wdErr) {
          console.log('[Confirm] Wholesale delivery update error:', wdErr instanceof Error ? wdErr.message : wdErr)
        }
      }

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: getOperationMessage(operationType, processedLines, totalQuantity),
        data: {
          operationId,
          operationNumber,
          operationType,
          status: initialStatus,
          validationStatus,
          warehouseId,
          warehouseName: warehouse.name,
          destinationWarehouseId,
          linesProcessed: processedLines,
          totalQuantity
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Confirm Operation] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al confirmar operación'
    }, { status: 500 })
  }
}

function getOperationMessage(type: OperationType, lines: number, quantity: number): string {
  const plural = lines > 1 ? 's' : ''
  switch (type) {
    case 'reception':
      return `Recepción completada: ${lines} producto${plural}, ${quantity} unidades ingresadas`
    case 'transfer':
      return `Transferencia creada: ${lines} producto${plural}, ${quantity} unidades. Pendiente de validación en almacén destino.`
    case 'scrap':
      return `Scrap registrado: ${lines} producto${plural}, ${quantity} unidades dadas de baja`
    case 'adjustment':
      return `Ajuste completado: ${lines} producto${plural} ajustado${plural}`
    default:
      return 'Operación completada'
  }
}
