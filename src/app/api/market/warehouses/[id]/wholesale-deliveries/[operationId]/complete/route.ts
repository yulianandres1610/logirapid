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

/**
 * POST /api/market/warehouses/[id]/wholesale-deliveries/[operationId]/complete
 * Complete wholesale delivery - deduct stock and update statuses
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; operationId: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id, operationId } = await params
    const warehouseId = parseInt(id)
    const opId = parseInt(operationId)

    const body = await request.json().catch(() => ({}))
    const { discrepancyNotes } = body as any

    // Resolve delivery ID → operation ID
    let realOpId = opId
    const delCheck = await db.query('SELECT operation_id FROM market_invoice_deliveries WHERE id = $1', [opId])
    if (delCheck.rows.length > 0 && delCheck.rows[0].operation_id) {
      realOpId = delCheck.rows[0].operation_id
    }

    // Get operation details
    const operationResult = await db.query(`
      SELECT
        o.id, o.operation_number, o.status, o.validation_status,
        o.source_warehouse_id, sw.name as warehouse_name,
        o.reference_id as invoice_id, i.invoice_number,
        i.customer_id,
        c.business_name as customer_name
      FROM market_warehouse_operations o
      LEFT JOIN market_warehouses sw ON sw.id = o.source_warehouse_id
      LEFT JOIN market_invoices i ON i.id = o.reference_id
      LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
      WHERE o.id = $1 AND o.company_id = $2 AND o.operation_type = 'wholesale_delivery'
    `, [realOpId, payload.companyId])

    if (operationResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Operación no encontrada'
      }, { status: 404 })
    }

    const operation = operationResult.rows[0]

    if (operation.status === 'done') {
      return NextResponse.json({
        success: false,
        error: 'Esta operación ya fue completada'
      }, { status: 400 })
    }

    // Get operation lines with validation data
    const linesResult = await db.query(`
      SELECT
        l.id, l.product_id, l.variant_id,
        p.name as product_name,
        COALESCE(pv.sku, p.sku) as sku,
        l.quantity_planned as quantity_expected,
        COALESCE(l.quantity_validated, 0) as quantity_validated
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      LEFT JOIN market_product_variants pv ON pv.id = l.variant_id
      WHERE l.operation_id = $1
    `, [realOpId])

    // Auto-validate lines that haven't been validated yet (assume full delivery)
    // This allows completing delivery without explicit validation step
    for (const line of linesResult.rows) {
      const quantityValidated = parseFloat(line.quantity_validated) || 0
      const quantityExpected = parseFloat(line.quantity_expected) || 0

      // If not validated yet (0), set to expected quantity (full delivery)
      if (quantityValidated === 0 && quantityExpected > 0) {
        await db.query(`
          UPDATE market_warehouse_operation_lines
          SET quantity_validated = quantity_planned
          WHERE id = $1
        `, [line.id])

        // Update local reference for subsequent processing
        line.quantity_validated = line.quantity_expected
      }
    }

    // Calculate total validated (after auto-validation)
    const totalValidated = linesResult.rows.reduce((sum, l) =>
      sum + (parseFloat(l.quantity_validated) || 0), 0)

    // Check for discrepancies (only if user explicitly validated with different quantities)
    const hasDiscrepancies = linesResult.rows.some(l => {
      const validated = parseFloat(l.quantity_validated) || 0
      const expected = parseFloat(l.quantity_expected) || 0
      // Only consider it a discrepancy if validated > 0 and different from expected
      return validated > 0 && Math.abs(validated - expected) > 0.001
    })

    if (hasDiscrepancies && !discrepancyNotes) {
      return NextResponse.json({
        success: false,
        error: 'Hay discrepancias. Por favor agregue una nota explicativa.',
        requiresNote: true,
        discrepancies: linesResult.rows
          .filter(l => {
            const validated = parseFloat(l.quantity_validated) || 0
            const expected = parseFloat(l.quantity_expected) || 0
            return validated > 0 && Math.abs(validated - expected) > 0.001
          })
          .map(l => ({
            product: l.product_name,
            expected: parseFloat(l.quantity_expected),
            validated: parseFloat(l.quantity_validated),
            difference: parseFloat(l.quantity_validated) - parseFloat(l.quantity_expected)
          }))
      }, { status: 400 })
    }

    // Start transaction
    await db.query('BEGIN')

    try {
      // 1. Update stock for each line - release reservation and deduct
      for (const line of linesResult.rows) {
        const quantityExpected = parseFloat(line.quantity_expected)
        const quantityValidated = parseFloat(line.quantity_validated)

        // Get current stock
        const stockResult = await db.query(`
          SELECT id, quantity_on_hand, quantity_reserved
          FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
          ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
        `, line.variant_id
          ? [warehouseId, line.product_id, line.variant_id]
          : [warehouseId, line.product_id]
        )

        if (stockResult.rows.length > 0) {
          const stock = stockResult.rows[0]
          const previousOnHand = parseFloat(stock.quantity_on_hand) || 0

          // Deduct validated quantity from on-hand stock
          const newOnHand = previousOnHand - quantityValidated

          await db.query(`
            UPDATE market_warehouse_stock SET
              quantity_on_hand = $1,
              updated_at = NOW()
            WHERE id = $2
          `, [newOnHand, stock.id])

          // Create stock movement record
          await db.query(`
            INSERT INTO market_stock_movements (
              company_id, from_warehouse_id, product_id, variant_id,
              movement_type, quantity, quantity_before, quantity_after,
              reference_type, reference_id,
              notes, created_by, created_at
            ) VALUES (
              $1, $2, $3, $4,
              'wholesale_out', $5, $6, $7,
              'wholesale_delivery', $8,
              $9, $10, NOW()
            )
          `, [
            payload.companyId,
            warehouseId,
            line.product_id,
            line.variant_id,
            quantityValidated,
            previousOnHand,
            newOnHand,
            opId,
            `Entrega mayorista ${operation.invoice_number} a ${operation.customer_name}`,
            payload.userId
          ])

          // Register inventory movement for product traceability
          await db.query(`
            INSERT INTO market_inventory_movements (
              product_id, company_id, movement_type, quantity,
              quantity_before, quantity_after, reference_type, reference_id, notes, created_at
            )
            SELECT $1, company_id, 'wholesale_out', $2, $3, $4, 'wholesale_invoice', $5, $6, NOW()
            FROM market_products WHERE id = $1
          `, [
            line.product_id,
            -quantityValidated,
            previousOnHand,
            newOnHand,
            operation.invoice_id,
            `Venta Mayorista: ${operation.invoice_number} - ${operation.customer_name}`
          ])

          // Update variant quantity if applicable
          if (line.variant_id) {
            // Sum total across all warehouses
            const totalResult = await db.query(`
              SELECT COALESCE(SUM(quantity_on_hand), 0) as total
              FROM market_warehouse_stock
              WHERE product_id = $1 AND variant_id = $2
            `, [line.product_id, line.variant_id])

            await db.query(`
              UPDATE market_product_variants
              SET quantity_on_hand = $1, updated_at = NOW()
              WHERE id = $2
            `, [totalResult.rows[0].total, line.variant_id])
          }

          // Update main product quantity (sum ALL warehouse stocks including variants)
          await db.query(`
            UPDATE market_products
            SET quantity_on_hand = (
              SELECT COALESCE(SUM(quantity_on_hand), 0)
              FROM market_warehouse_stock
              WHERE product_id = $1
            ), updated_at = NOW()
            WHERE id = $1
          `, [line.product_id])
        }

        // Process FIFO from ALL lot types (consignment, production, purchase)
        let remainingQty = quantityValidated

        // ============ 1. CONSIGNMENT LOTS (FIFO) ============
        try {
          const consignmentLots = await db.query(`
            SELECT
              cli.id as lot_id,
              cli.lot_number,
              cli.quantity_available,
              cli.unit_cost,
              cli.supplier_id,
              cli.order_line_id
            FROM consignment_lot_inventory cli
            WHERE cli.warehouse_id = $1
              AND cli.product_id = $2
              AND cli.company_id = $3
              AND cli.quantity_available > 0
              ${line.variant_id ? 'AND (cli.variant_id = $4 OR cli.variant_id IS NULL)' : 'AND cli.variant_id IS NULL'}
            ORDER BY cli.received_at ASC
            FOR UPDATE
          `, line.variant_id
            ? [warehouseId, line.product_id, payload.companyId, line.variant_id]
            : [warehouseId, line.product_id, payload.companyId])

          for (const lot of consignmentLots.rows) {
            if (remainingQty <= 0) break

            const availableQty = parseFloat(lot.quantity_available) || 0
            const toDeduct = Math.min(remainingQty, availableQty)
            const unitCost = parseFloat(lot.unit_cost)

            await db.query(`
              UPDATE consignment_lot_inventory
              SET quantity_available = quantity_available - $1,
                  quantity_sold = COALESCE(quantity_sold, 0) + $1
              WHERE id = $2
            `, [toDeduct, lot.lot_id])

            if (lot.order_line_id) {
              const orderLineResult = await db.query(`
                SELECT order_id, unit_price FROM consignment_order_lines WHERE id = $1
              `, [lot.order_line_id])

              await db.query(`
                UPDATE consignment_order_lines
                SET quantity_sold = COALESCE(quantity_sold, 0) + $1
                WHERE id = $2
              `, [toDeduct, lot.order_line_id])

              if (orderLineResult.rows.length > 0) {
                const orderId = orderLineResult.rows[0].order_id
                const saleAmount = toDeduct * unitCost

                await db.query(`
                  UPDATE consignment_orders
                  SET total_sold = COALESCE(total_sold, 0) + $1, updated_at = NOW()
                  WHERE id = $2
                `, [saleAmount, orderId])
              }
            }

            const walletResult = await db.query(
              'SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1',
              [lot.supplier_id]
            )

            if (walletResult.rows.length > 0) {
              const walletId = walletResult.rows[0].id
              const earnings = toDeduct * unitCost

              await db.query(`
                UPDATE consignment_supplier_wallets
                SET balance_available = balance_available + $1,
                    total_earned = COALESCE(total_earned, 0) + $1,
                    updated_at = NOW()
                WHERE id = $2
              `, [earnings, walletId])

              await db.query(`
                INSERT INTO consignment_wallet_transactions (
                  wallet_id, transaction_type, amount,
                  product_id, quantity, unit_price,
                  notes, created_by, created_at
                ) VALUES ($1, 'sale', $2, $3, $4, $5, $6, $7, NOW())
              `, [walletId, earnings, line.product_id, toDeduct, unitCost,
                `Venta Mayorista: ${operation.invoice_number} - ${line.product_name}`, payload.userId])
            }

            remainingQty -= toDeduct
            console.log(`[Wholesale FIFO] Consignment lot ${lot.lot_number}: deducted ${toDeduct}, remaining ${remainingQty}`)
          }

          // Empty consignment lots stay in DB to preserve FK references from return_lines
        } catch (err) {
          console.log('[Wholesale FIFO] consignment_lot_inventory not available:', err)
        }

        // ============ 2. PRODUCTION LOTS (FIFO) ============
        if (remainingQty > 0) {
          try {
            const productionLots = await db.query(`
              SELECT
                pli.id as lot_id,
                pli.lot_number,
                pli.quantity_available,
                pli.unit_cost
              FROM production_lot_inventory pli
              WHERE pli.warehouse_id = $1
                AND pli.product_id = $2
                AND pli.company_id = $3
                AND pli.quantity_available > 0
                ${line.variant_id ? 'AND (pli.variant_id = $4 OR pli.variant_id IS NULL)' : 'AND pli.variant_id IS NULL'}
              ORDER BY pli.received_at ASC
              FOR UPDATE
            `, line.variant_id
              ? [warehouseId, line.product_id, payload.companyId, line.variant_id]
              : [warehouseId, line.product_id, payload.companyId])

            for (const lot of productionLots.rows) {
              if (remainingQty <= 0) break

              const availableQty = parseFloat(lot.quantity_available) || 0
              const toDeduct = Math.min(remainingQty, availableQty)

              await db.query(`
                UPDATE production_lot_inventory
                SET quantity_available = quantity_available - $1,
                    quantity_sold = COALESCE(quantity_sold, 0) + $1
                WHERE id = $2
              `, [toDeduct, lot.lot_id])

              remainingQty -= toDeduct
              console.log(`[Wholesale FIFO] Production lot ${lot.lot_number}: deducted ${toDeduct}, remaining ${remainingQty}`)
            }

            await db.query(`
              DELETE FROM production_lot_inventory
              WHERE warehouse_id = $1 AND product_id = $2 AND company_id = $3 AND quantity_available <= 0
            `, [warehouseId, line.product_id, payload.companyId])
          } catch (err) {
            console.log('[Wholesale FIFO] production_lot_inventory not available:', err)
          }
        }

        // ============ 3. PURCHASE LOTS (FIFO) ============
        if (remainingQty > 0) {
          try {
            const purchaseLots = await db.query(`
              SELECT
                pli.id as lot_id,
                pli.lot_number,
                pli.quantity_available,
                pli.unit_cost
              FROM purchase_lot_inventory pli
              WHERE pli.warehouse_id = $1
                AND pli.product_id = $2
                AND pli.company_id = $3
                AND pli.quantity_available > 0
                ${line.variant_id ? 'AND (pli.variant_id = $4 OR pli.variant_id IS NULL)' : 'AND pli.variant_id IS NULL'}
              ORDER BY pli.created_at ASC
              FOR UPDATE
            `, line.variant_id
              ? [warehouseId, line.product_id, payload.companyId, line.variant_id]
              : [warehouseId, line.product_id, payload.companyId])

            for (const lot of purchaseLots.rows) {
              if (remainingQty <= 0) break

              const availableQty = parseFloat(lot.quantity_available) || 0
              const toDeduct = Math.min(remainingQty, availableQty)

              await db.query(`
                UPDATE purchase_lot_inventory
                SET quantity_available = quantity_available - $1,
                    quantity_sold = COALESCE(quantity_sold, 0) + $1
                WHERE id = $2
              `, [toDeduct, lot.lot_id])

              remainingQty -= toDeduct
              console.log(`[Wholesale FIFO] Purchase lot ${lot.lot_number}: deducted ${toDeduct}, remaining ${remainingQty}`)
            }

            await db.query(`
              DELETE FROM purchase_lot_inventory
              WHERE warehouse_id = $1 AND product_id = $2 AND company_id = $3 AND quantity_available <= 0
            `, [warehouseId, line.product_id, payload.companyId])
          } catch (err) {
            console.log('[Wholesale FIFO] purchase_lot_inventory not available:', err)
          }
        }

        // ============ 4. MANUAL LOTS (FIFO) ============
        if (remainingQty > 0) {
          try {
            const manualLots = await db.query(`
              SELECT
                mpl.id as lot_id,
                mpl.lot_number,
                mpl.quantity_available
              FROM market_product_lots mpl
              WHERE mpl.product_id = $1
                AND mpl.company_id = $2
                AND mpl.quantity_available > 0
                AND mpl.is_active = true
              ORDER BY mpl.expiration_date ASC NULLS LAST, mpl.created_at ASC
              FOR UPDATE
            `, [line.product_id, payload.companyId])

            for (const lot of manualLots.rows) {
              if (remainingQty <= 0) break

              const availableQty = parseFloat(lot.quantity_available) || 0
              const toDeduct = Math.min(remainingQty, availableQty)

              await db.query(`
                UPDATE market_product_lots
                SET quantity_available = quantity_available - $1
                WHERE id = $2
              `, [toDeduct, lot.lot_id])

              remainingQty -= toDeduct
              console.log(`[Wholesale FIFO] Manual lot ${lot.lot_number}: deducted ${toDeduct}, remaining ${remainingQty}`)
            }

            await db.query(`
              UPDATE market_product_lots
              SET is_active = false
              WHERE product_id = $1 AND company_id = $2 AND quantity_available <= 0
            `, [line.product_id, payload.companyId])
          } catch (err) {
            console.log('[Wholesale FIFO] market_product_lots not available:', err)
          }
        }

        if (remainingQty > 0) {
          console.log(`[Wholesale FIFO] Warning: ${remainingQty} units of ${line.product_name} could not be deducted from any lot`)
        }
      }

      // 2. Update operation status
      await db.query(`
        UPDATE market_warehouse_operations SET
          status = 'done',
          validation_status = 'validated',
          discrepancy_notes = $1,
          completed_at = NOW(),
          completed_by = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [discrepancyNotes || null, payload.userId, realOpId])

      // 2.5. Update delivery status and timestamp
      // First ensure the columns exist
      await db.query(`ALTER TABLE market_invoice_deliveries ADD COLUMN IF NOT EXISTS dispatched_by INTEGER REFERENCES users(id)`)
      await db.query(`ALTER TABLE market_invoice_deliveries ADD COLUMN IF NOT EXISTS delivered_by INTEGER REFERENCES users(id)`)

      // Get the delivery linked to this operation
      const deliveryResult = await db.query(`
        SELECT id FROM market_invoice_deliveries WHERE operation_id = $1 OR id = $2
      `, [realOpId, opId])

      if (deliveryResult.rows.length > 0) {
        const deliveryId = deliveryResult.rows[0].id

        // Update delivery status and timestamps
        await db.query(`
          UPDATE market_invoice_deliveries SET
            status = 'delivered',
            dispatched_at = COALESCE(dispatched_at, NOW()),
            dispatched_by = COALESCE(dispatched_by, $1),
            delivered_at = NOW(),
            delivered_by = $1
          WHERE id = $2
        `, [payload.userId, deliveryId])

        // Update delivery lines with validated quantities
        for (const line of linesResult.rows) {
          await db.query(`
            UPDATE market_invoice_delivery_lines SET
              quantity_delivered = $1
            WHERE delivery_id = $2 AND product_id = $3
            ${line.variant_id ? 'AND variant_id = $4' : 'AND variant_id IS NULL'}
          `, line.variant_id
            ? [line.quantity_validated, deliveryId, line.product_id, line.variant_id]
            : [line.quantity_validated, deliveryId, line.product_id]
          )
        }
      }

      // 3. Update invoice status
      const totalExpected = linesResult.rows.reduce((sum, l) =>
        sum + (parseFloat(l.quantity_expected) || 0), 0)

      // Check if this fully delivers the invoice
      await db.query(`
        UPDATE market_invoices SET
          status = 'delivered',
          delivered_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [operation.invoice_id])

      // Update invoice lines with delivered quantities
      for (const line of linesResult.rows) {
        await db.query(`
          UPDATE market_invoice_lines SET
            quantity_delivered = COALESCE(quantity_delivered, 0) + $1
          WHERE invoice_id = $2 AND product_id = $3
          ${line.variant_id ? 'AND variant_id = $4' : 'AND variant_id IS NULL'}
        `, line.variant_id
          ? [line.quantity_validated, operation.invoice_id, line.product_id, line.variant_id]
          : [line.quantity_validated, operation.invoice_id, line.product_id]
        )
      }

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Entrega completada exitosamente',
        data: {
          operationId: opId,
          operationNumber: operation.operation_number,
          invoiceNumber: operation.invoice_number,
          warehouseName: operation.warehouse_name,
          customerName: operation.customer_name,
          totalProducts: linesResult.rows.length,
          totalExpected: totalExpected,
          totalDelivered: totalValidated,
          hasDiscrepancies,
          discrepancyNotes: discrepancyNotes || null
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Wholesale Delivery Complete] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al completar entrega'
    }, { status: 500 })
  }
}
