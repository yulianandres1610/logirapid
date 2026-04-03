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
 * POST /api/consignments/returns/[id]/validate
 * Validar devolucion en almacen y descontar inventario
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await db.getClient()

  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const returnId = parseInt(id)
    const { lines } = await request.json() as { lines: ValidatedLine[] }

    await client.query('BEGIN')

    // Verify return exists and is pending (use market_suppliers - unified table)
    const returnResult = await client.query(`
      SELECT r.*, s.company_id
      FROM consignment_returns r
      JOIN market_suppliers s ON s.id = r.supplier_id
      WHERE r.id = $1 AND s.company_id = $2
    `, [returnId, payload.companyId])

    if (returnResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({
        success: false,
        error: 'Devolucion no encontrada'
      }, { status: 404 })
    }

    const returnData = returnResult.rows[0]

    if (returnData.status !== 'pending') {
      await client.query('ROLLBACK')
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden validar devoluciones pendientes'
      }, { status: 400 })
    }

    let totalValidated = 0
    let totalValueValidated = 0

    // Process each line
    for (const line of lines) {
      if (line.quantityValidated <= 0) continue

      // Get line details with variant info
      const lineResult = await client.query(`
        SELECT rl.*, ol.variant_id, cli.variant_id as lot_variant_id
        FROM consignment_return_lines rl
        LEFT JOIN consignment_order_lines ol ON ol.id = rl.order_line_id
        LEFT JOIN consignment_lot_inventory cli ON cli.id = rl.lot_inventory_id
        WHERE rl.id = $1 AND rl.return_id = $2
      `, [line.lineId, returnId])

      if (lineResult.rows.length === 0) continue

      const returnLine = lineResult.rows[0]
      const variantId = returnLine.lot_variant_id || returnLine.variant_id || null

      // Update return line
      await client.query(`
        UPDATE consignment_return_lines
        SET quantity_validated = $1
        WHERE id = $2
      `, [line.quantityValidated, line.lineId])

      // Decrease inventory from lot
      if (returnLine.lot_inventory_id) {
        await client.query(`
          UPDATE consignment_lot_inventory
          SET
            quantity_available = quantity_available - $1,
            quantity_returned = COALESCE(quantity_returned, 0) + $1
          WHERE id = $2
        `, [line.quantityValidated, returnLine.lot_inventory_id])
      }

      // Decrease warehouse stock (market_warehouse_stock - primary stock table)
      await client.query(`
        UPDATE market_warehouse_stock
        SET quantity_on_hand = quantity_on_hand - $1, last_movement_at = NOW(), updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3
          AND (variant_id = $4 OR ($4 IS NULL AND variant_id IS NULL))
      `, [line.quantityValidated, returnData.warehouse_id, returnLine.product_id, variantId])

      // Update variant stock if applicable
      if (variantId) {
        await client.query(`
          UPDATE market_product_variants
          SET quantity_on_hand = COALESCE(quantity_on_hand, 0) - $1, updated_at = NOW()
          WHERE id = $2
        `, [line.quantityValidated, variantId])
      }

      // Update order line
      if (returnLine.order_line_id) {
        await client.query(`
          UPDATE consignment_order_lines
          SET quantity_returned = COALESCE(quantity_returned, 0) + $1
          WHERE id = $2
        `, [line.quantityValidated, returnLine.order_line_id])
      }

      totalValidated += line.quantityValidated
      totalValueValidated += line.quantityValidated * parseFloat(returnLine.unit_cost)
    }

    // Update return status
    await client.query(`
      UPDATE consignment_returns
      SET
        status = 'completed',
        total_units = $1,
        total_value = $2,
        validated_by = $3,
        validated_at = NOW()
      WHERE id = $4
    `, [totalValidated, totalValueValidated, payload.userId, returnId])

    // Update order totals
    if (returnData.order_id) {
      await client.query(`
        UPDATE consignment_orders
        SET
          total_returned = COALESCE(total_returned, 0) + $1,
          updated_at = NOW()
        WHERE id = $2
      `, [totalValueValidated, returnData.order_id])
    }

    // Update supplier wallet - decrease available balance
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
        `Devolucion ${returnData.return_number}: ${totalValidated} unidades`,
        payload.userId
      ])
    }

    // Check if order should be liquidated
    if (returnData.order_id) {
      const orderCheckResult = await client.query(`
        SELECT
          SUM(quantity_received) as total_received,
          SUM(COALESCE(quantity_sold, 0)) as total_sold,
          SUM(COALESCE(quantity_returned, 0)) as total_returned
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

        // Zero out remaining lots to prevent phantom stock
        await client.query(`
          UPDATE consignment_lot_inventory SET quantity_available = 0
          WHERE order_line_id IN (SELECT id FROM consignment_order_lines WHERE order_id = $1)
            AND quantity_available > 0
        `, [returnData.order_id])
      }
    }

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      message: 'Devolucion validada exitosamente',
      data: {
        returnId,
        returnNumber: returnData.return_number,
        unitsValidated: totalValidated,
        valueReturned: totalValueValidated
      }
    })

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[Return Validate] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al validar devolucion'
    }, { status: 500 })
  } finally {
    client.release()
  }
}
