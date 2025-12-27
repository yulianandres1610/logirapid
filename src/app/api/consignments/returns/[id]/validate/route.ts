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
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const returnId = parseInt(id)
    const { lines } = await request.json() as { lines: ValidatedLine[] }

    // Verify return exists and is pending
    const returnResult = await db.query(`
      SELECT r.*, s.company_id
      FROM consignment_returns r
      JOIN consignment_suppliers s ON s.id = r.supplier_id
      WHERE r.id = $1 AND s.company_id = $2
    `, [returnId, payload.companyId])

    if (returnResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Devolucion no encontrada'
      }, { status: 404 })
    }

    const returnData = returnResult.rows[0]

    if (returnData.status !== 'pending') {
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

      // Get line details
      const lineResult = await db.query(`
        SELECT * FROM consignment_return_lines WHERE id = $1 AND return_id = $2
      `, [line.lineId, returnId])

      if (lineResult.rows.length === 0) continue

      const returnLine = lineResult.rows[0]

      // Update return line
      await db.query(`
        UPDATE consignment_return_lines
        SET quantity_validated = $1
        WHERE id = $2
      `, [line.quantityValidated, line.lineId])

      // Decrease inventory from lot
      if (returnLine.lot_inventory_id) {
        await db.query(`
          UPDATE consignment_lot_inventory
          SET
            quantity_available = quantity_available - $1,
            quantity_returned = quantity_returned + $1
          WHERE id = $2
        `, [line.quantityValidated, returnLine.lot_inventory_id])
      }

      // Decrease main inventory
      await db.query(`
        UPDATE market_product_inventory
        SET quantity_on_hand = quantity_on_hand - $1
        WHERE warehouse_id = $2 AND product_id = $3
      `, [line.quantityValidated, returnData.warehouse_id, returnLine.product_id])

      // Update order line
      await db.query(`
        UPDATE consignment_order_lines
        SET quantity_returned = quantity_returned + $1
        WHERE id = $2
      `, [line.quantityValidated, returnLine.order_line_id])

      totalValidated += line.quantityValidated
      totalValueValidated += line.quantityValidated * parseFloat(returnLine.unit_cost)
    }

    // Update return status
    await db.query(`
      UPDATE consignment_returns
      SET
        status = 'completed',
        validated_by = $1,
        validated_at = NOW()
      WHERE id = $2
    `, [payload.userId, returnId])

    // Update order totals
    await db.query(`
      UPDATE consignment_orders
      SET
        total_returned = total_returned + $1,
        updated_at = NOW()
      WHERE id = $2
    `, [totalValueValidated, returnData.order_id])

    // Update supplier wallet - decrease available balance
    const walletResult = await db.query(
      'SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1',
      [returnData.supplier_id]
    )

    if (walletResult.rows.length > 0) {
      await db.query(`
        UPDATE consignment_supplier_wallets
        SET
          balance_available = balance_available - $1,
          total_returned = total_returned + $1,
          updated_at = NOW()
        WHERE supplier_id = $2
      `, [totalValueValidated, returnData.supplier_id])

      // Create wallet transaction
      await db.query(`
        INSERT INTO consignment_wallet_transactions (
          wallet_id, order_id, transaction_type, amount, notes, created_by
        ) VALUES ($1, $2, 'return', $3, $4, $5)
      `, [
        walletResult.rows[0].id,
        returnData.order_id,
        -totalValueValidated,
        `Devolucion ${returnData.return_number}: ${totalValidated} unidades`,
        payload.userId
      ])
    }

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
    console.error('[Return Validate] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al validar devolucion'
    }, { status: 500 })
  }
}
