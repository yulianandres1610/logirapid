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
 * POST /api/market/warehouses/[id]/pos-returns/[returnId]/receive
 * Procesa la recepción de una devolución POS y marca productos como scrap
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
    const returnIdNum = parseInt(returnId)
    const body = await request.json()
    const { lines } = body

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Líneas de recepción requeridas'
      }, { status: 400 })
    }

    await client.query('BEGIN')

    // Verify return exists and is pending
    const returnResult = await client.query(`
      SELECT
        pr.id,
        pr.return_number,
        pr.status,
        pr.pos_id,
        COALESCE(pos.name, 'POS') as pos_name
      FROM pos_returns pr
      LEFT JOIN market_pos pos ON pos.id = pr.pos_id
      WHERE pr.id = $1 AND pr.warehouse_id = $2 AND pr.company_id = $3
    `, [returnIdNum, warehouseId, payload.companyId])

    if (returnResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({
        success: false,
        error: 'Devolución no encontrada'
      }, { status: 404 })
    }

    const posReturn = returnResult.rows[0]

    if (posReturn.status !== 'pending') {
      await client.query('ROLLBACK')
      return NextResponse.json({
        success: false,
        error: 'Esta devolución ya fue procesada'
      }, { status: 400 })
    }

    let totalUnits = 0
    let totalValue = 0

    // Process each line
    for (const line of lines) {
      const { lineId, productId, quantityReceived, condition } = line

      if (!lineId || !productId || !quantityReceived || !condition) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Datos de línea incompletos'
        }, { status: 400 })
      }

      // Get line details
      const lineResult = await client.query(`
        SELECT
          prl.id,
          prl.product_id,
          prl.quantity,
          prl.unit_price,
          prl.reason,
          mp.name as product_name
        FROM pos_return_lines prl
        JOIN market_products mp ON mp.id = prl.product_id
        WHERE prl.id = $1 AND prl.return_id = $2
      `, [lineId, returnIdNum])

      if (lineResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({
          success: false,
          error: 'Línea de devolución no encontrada'
        }, { status: 404 })
      }

      const returnLine = lineResult.rows[0]
      const lineValue = quantityReceived * parseFloat(returnLine.unit_price)

      // Create scrap record
      await client.query(`
        INSERT INTO market_pos_scrap (
          company_id, warehouse_id, pos_return_id, pos_return_line_id,
          product_id, quantity, unit_cost, total_value,
          condition, reason, scrapped_by, scrapped_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      `, [
        payload.companyId,
        warehouseId,
        returnIdNum,
        lineId,
        productId,
        quantityReceived,
        returnLine.unit_price,
        lineValue,
        condition,
        returnLine.reason,
        payload.userId
      ])

      // Update line as received
      await client.query(`
        UPDATE pos_return_lines
        SET
          quantity_received = $1,
          received_at = NOW(),
          condition = $2
        WHERE id = $3
      `, [quantityReceived, condition, lineId])

      // Create inventory movement (negative - scrap)
      await client.query(`
        INSERT INTO market_inventory_movements (
          company_id, product_id,
          movement_type, quantity, reference_type, reference_id,
          notes, created_by, created_at
        ) VALUES ($1, $2, 'scrap', $3, 'pos_return', $4, $5, $6, NOW())
      `, [
        payload.companyId,
        productId,
        -quantityReceived,
        returnIdNum,
        `Scrap de devolución POS ${posReturn.return_number} - ${condition} - Almacén ID: ${warehouseId}`,
        payload.userId
      ])

      totalUnits += quantityReceived
      totalValue += lineValue
    }

    // Update return status to completed
    await client.query(`
      UPDATE pos_returns
      SET
        status = 'completed',
        received_by = $1,
        received_at = NOW(),
        updated_at = NOW()
      WHERE id = $2
    `, [payload.userId, returnIdNum])

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      message: `Devolución ${posReturn.return_number} procesada como scrap`,
      data: {
        returnId: returnIdNum,
        returnNumber: posReturn.return_number,
        totalUnits,
        totalValue,
        status: 'completed'
      }
    })

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[POS Returns - Receive] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar recepción'
    }, { status: 500 })
  } finally {
    client.release()
  }
}
