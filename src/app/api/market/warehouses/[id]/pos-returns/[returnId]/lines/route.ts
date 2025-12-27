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
 * GET /api/market/warehouses/[id]/pos-returns/[returnId]/lines
 * Obtiene las líneas de una devolución POS
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; returnId: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id, returnId } = await params
    const warehouseId = parseInt(id)
    const returnIdNum = parseInt(returnId)

    // Verify return exists and belongs to this warehouse
    const returnResult = await db.query(`
      SELECT id, return_number, status
      FROM pos_returns
      WHERE id = $1 AND warehouse_id = $2 AND company_id = $3
    `, [returnIdNum, warehouseId, payload.companyId])

    if (returnResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Devolución no encontrada'
      }, { status: 404 })
    }

    // Get lines
    const linesResult = await db.query(`
      SELECT
        prl.id,
        prl.product_id,
        prl.quantity,
        prl.unit_price,
        prl.reason,
        mp.name as product_name,
        mp.sku,
        mp.barcode
      FROM pos_return_lines prl
      JOIN market_products mp ON mp.id = prl.product_id
      WHERE prl.return_id = $1
      ORDER BY prl.id
    `, [returnIdNum])

    const lines = linesResult.rows.map(row => ({
      id: parseInt(row.id),
      productId: parseInt(row.product_id),
      productName: row.product_name,
      sku: row.sku,
      barcode: row.barcode,
      quantity: parseInt(row.quantity),
      unitPrice: parseFloat(row.unit_price),
      reason: row.reason
    }))

    return NextResponse.json({
      success: true,
      data: {
        returnNumber: returnResult.rows[0].return_number,
        status: returnResult.rows[0].status,
        lines
      }
    })

  } catch (error) {
    console.error('[POS Returns - Lines] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener líneas'
    }, { status: 500 })
  }
}
