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

interface ValidatedLine {
  lineId: number
  quantityValidated: number
}

/**
 * POST /api/market/warehouses/[id]/pending-returns/[returnId]/complete
 * Complete a pending supplier return
 * Updates: inventory, order lines, supplier wallet, creates movements
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; returnId: string }> }
) {
  const client = await db.getClient()

  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id, returnId } = await params
    const warehouseId = parseInt(id)
    const returnIdInt = parseInt(returnId)

    const { lines, notes: validationNotes } = await request.json() as {
      lines: ValidatedLine[]
      notes?: string
    }

    // Start transaction
    await client.query('BEGIN')

    // Verify warehouse belongs to company
    const warehouseResult = await client.query(
      'SELECT id, name, code, company_id FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    // Verify return exists and is pending
    const returnResult = await client.query(`
      SELECT
        r.*,
        s.company_id,
        o.order_number
      FROM consignment_returns r
      JOIN market_suppliers s ON s.id = r.supplier_id
      LEFT JOIN consignment_orders o ON o.id = r.order_id
      WHERE r.id = $1 AND r.warehouse_id = $2 AND s.company_id = $3
    `, [returnIdInt, warehouseId, payload.companyId])

    if (returnResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({
        success: false,
        error: 'Devolución no encontrada'
      }, { status: 404 })
    }

    const returnData = returnResult.rows[0]

    if (returnData.status !== 'pending') {
      await client.query('ROLLBACK')
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden completar devoluciones pendientes'
      }, { status: 400 })
    }

    let totalValidated = 0
    let totalValueValidated = 0

    // Process each line
    for (const line of lines) {
      if (line.quantityValidated <= 0) continue

      // Get return line details (include variant info from lot inventory)
      const lineResult = await client.query(`
        SELECT
          rl.*,
          ol.lot_number,
          ol.variant_id,
          p.name as product_name,
          cli.variant_id as lot_variant_id
        FROM consignment_return_lines rl
        JOIN consignment_order_lines ol ON ol.id = rl.order_line_id
        JOIN market_products p ON p.id = rl.product_id
        LEFT JOIN consignment_lot_inventory cli ON cli.id = rl.lot_inventory_id
        WHERE rl.id = $1 AND rl.return_id = $2
      `, [line.lineId, returnIdInt])

      if (lineResult.rows.length === 0) continue

      const returnLine = lineResult.rows[0]
      const maxQty = parseInt(returnLine.quantity_to_return) || 0
      const requestedQty = parseInt(String(line.quantityValidated)) || 0
      const qtyValidated = Math.min(requestedQty, maxQty)
      const variantId = returnLine.lot_variant_id || returnLine.variant_id || null

      if (qtyValidated <= 0) continue

      // 1. Update return line with validated quantity
      await client.query(`
        UPDATE consignment_return_lines
        SET quantity_validated = $1
        WHERE id = $2
      `, [qtyValidated, line.lineId])

      // 2. Update lot inventory (if exists)
      if (returnLine.lot_inventory_id) {
        await client.query(`
          UPDATE consignment_lot_inventory
          SET
            quantity_available = quantity_available - $1,
            quantity_returned = COALESCE(quantity_returned, 0) + $1
          WHERE id = $2
        `, [qtyValidated, returnLine.lot_inventory_id])
      }

      // 3. Update warehouse stock (with variant awareness)
      await client.query(`
        UPDATE market_warehouse_stock
        SET
          quantity_on_hand = quantity_on_hand - $1,
          last_movement_at = NOW(),
          updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3
          AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
      `, [qtyValidated, warehouseId, returnLine.product_id, variantId])

      // 3b. Update variant stock if applicable
      if (variantId) {
        await client.query(`
          UPDATE market_product_variants
          SET quantity_on_hand = COALESCE(quantity_on_hand, 0) - $1, updated_at = NOW()
          WHERE id = $2
        `, [qtyValidated, variantId])
      }

      // 4. Create inventory movement
      const stockAfterResult = await client.query(`
        SELECT COALESCE(quantity_on_hand, 0) as stock
        FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2
          AND (variant_id = $3 OR ($3 IS NULL AND variant_id IS NULL))
      `, [warehouseId, returnLine.product_id, variantId])

      const stockAfterValue = parseInt(stockAfterResult.rows[0]?.stock) || 0
      const stockBeforeValue = stockAfterValue + qtyValidated // Before the update, stock was higher

      // Create inventory movement record
      try {
        await client.query(`
          INSERT INTO market_inventory_movements (
            company_id, product_id,
            movement_type, quantity, quantity_before, quantity_after,
            reference_type, reference_id,
            notes, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          Number(payload.companyId),
          Number(returnLine.product_id),
          'return',
          Number(-qtyValidated),
          Number(stockBeforeValue),
          Number(stockAfterValue),
          'consignment_return',
          Number(returnIdInt),
          `Devolución a proveedor: ${returnData.return_number} (Lote: ${returnLine.lot_number || 'N/A'})`,
          Number(payload.userId)
        ])
      } catch (movementError) {
        // Log but don't fail the transaction if movement insert fails
        console.error('[Complete Return] Inventory movement error:', movementError)
      }

      // 5. Update order line quantity_returned
      await client.query(`
        UPDATE consignment_order_lines
        SET quantity_returned = COALESCE(quantity_returned, 0) + $1
        WHERE id = $2
      `, [qtyValidated, returnLine.order_line_id])

      totalValidated += qtyValidated
      totalValueValidated += qtyValidated * parseFloat(returnLine.unit_cost)
    }

    // 6. Update return status to completed
    const notesValue = validationNotes ? String(validationNotes) : null
    await client.query(`
      UPDATE consignment_returns
      SET
        status = 'completed',
        total_units = $1,
        total_value = $2,
        validated_by = $3,
        validated_at = NOW(),
        notes = CASE WHEN $4::text IS NOT NULL THEN COALESCE(notes || E'\\n', '') || $4::text ELSE notes END
      WHERE id = $5
    `, [totalValidated, totalValueValidated, payload.userId, notesValue, returnIdInt])

    // 7. Update order totals (total_returned) - only if order exists
    if (returnData.order_id) {
      await client.query(`
        UPDATE consignment_orders
        SET
          total_returned = COALESCE(total_returned, 0) + $1,
          updated_at = NOW()
        WHERE id = $2
      `, [totalValueValidated, returnData.order_id])
    }

    // 8. Update supplier wallet - decrease available balance
    const walletResult = await client.query(
      'SELECT id, balance_available FROM consignment_supplier_wallets WHERE supplier_id = $1',
      [returnData.supplier_id]
    )

    if (walletResult.rows.length > 0) {
      const wallet = walletResult.rows[0]
      const newBalance = parseFloat(wallet.balance_available) - totalValueValidated

      await client.query(`
        UPDATE consignment_supplier_wallets
        SET
          balance_available = $1,
          total_returned = COALESCE(total_returned, 0) + $2,
          updated_at = NOW()
        WHERE supplier_id = $3
      `, [newBalance, totalValueValidated, returnData.supplier_id])

      // Create wallet transaction
      await client.query(`
        INSERT INTO consignment_wallet_transactions (
          wallet_id, order_id, transaction_type, amount, balance_after, notes, created_by
        ) VALUES ($1::int, $2::int, 'return', $3::numeric, $4::numeric, $5::text, $6::int)
      `, [
        wallet.id,
        returnData.order_id,
        -totalValueValidated,
        newBalance,
        `Devolución ${returnData.return_number}: ${totalValidated} unidades`,
        payload.userId
      ])
    }

    // 9. Check if order should be liquidated (all received = sold + returned) - only if order exists
    if (returnData.order_id) {
      const orderCheckResult = await client.query(`
        SELECT
          SUM(quantity_received) as total_received,
          SUM(quantity_sold) as total_sold,
          SUM(quantity_returned) as total_returned
        FROM consignment_order_lines
        WHERE order_id = $1
      `, [returnData.order_id])

      const orderTotals = orderCheckResult.rows[0]
      const totalReceived = parseInt(orderTotals.total_received) || 0
      const totalSold = parseInt(orderTotals.total_sold) || 0
      const totalReturned = parseInt(orderTotals.total_returned) || 0

      if (totalReceived > 0 && (totalSold + totalReturned) >= totalReceived) {
        await client.query(`
          UPDATE consignment_orders
          SET status = 'liquidated', completed_at = NOW()
          WHERE id = $1
        `, [returnData.order_id])
      }
    }

    // 10. Mark linked warehouse operation as done (if exists)
    try {
      await client.query(`
        UPDATE market_warehouse_operations
        SET status = 'done', completed_at = NOW(), confirmed_by = $1, updated_at = NOW()
        WHERE reference_type = 'consignment_return' AND reference_id = $2 AND status = 'pending'
      `, [payload.userId, returnIdInt])

      // Update operation lines with actual quantities
      const opResult = await client.query(`
        SELECT id FROM market_warehouse_operations
        WHERE reference_type = 'consignment_return' AND reference_id = $1
      `, [returnIdInt])

      if (opResult.rows.length > 0) {
        await client.query(`
          UPDATE market_warehouse_operation_lines
          SET quantity_done = quantity_planned, line_status = 'done'
          WHERE operation_id = $1
        `, [opResult.rows[0].id])
      }
    } catch { /* operation may not exist for legacy returns */ }

    // Commit transaction
    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      message: 'Devolución completada exitosamente',
      data: {
        returnId: returnIdInt,
        returnNumber: returnData.return_number,
        totalUnits: totalValidated,
        totalValue: totalValueValidated
      }
    })

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[Complete Return] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({
      success: false,
      error: `Error al completar devolución: ${errorMessage}`
    }, { status: 500 })
  } finally {
    client.release()
  }
}
