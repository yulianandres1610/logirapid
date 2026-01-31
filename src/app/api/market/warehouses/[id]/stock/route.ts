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
 * GET /api/market/warehouses/[id]/stock
 * Get stock for a specific product (and optionally variant) in a warehouse
 * Query params: productId (required), variantId (optional)
 */
export async function GET(
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
    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
      }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const variantId = searchParams.get('variantId')

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'productId es requerido'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseResult = await db.query(`
      SELECT id FROM market_warehouses WHERE id = $1 AND company_id = $2
    `, [warehouseId, companyId])

    if (warehouseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    // Get stock
    const stockResult = await db.query(`
      SELECT
        ws.quantity_on_hand,
        ws.quantity_reserved,
        COALESCE(ws.quantity_on_hand, 0) - COALESCE(ws.quantity_reserved, 0) as quantity_available,
        ws.last_movement_at
      FROM market_warehouse_stock ws
      WHERE ws.warehouse_id = $1
        AND ws.product_id = $2
        AND COALESCE(ws.variant_id, 0) = COALESCE($3, 0)
    `, [warehouseId, parseInt(productId), variantId ? parseInt(variantId) : null])

    if (stockResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          warehouseId,
          productId: parseInt(productId),
          variantId: variantId ? parseInt(variantId) : null,
          quantityOnHand: 0,
          quantityReserved: 0,
          quantityAvailable: 0,
          lastMovementAt: null
        }
      })
    }

    const stock = stockResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        warehouseId,
        productId: parseInt(productId),
        variantId: variantId ? parseInt(variantId) : null,
        quantityOnHand: parseFloat(stock.quantity_on_hand) || 0,
        quantityReserved: parseFloat(stock.quantity_reserved) || 0,
        quantityAvailable: parseFloat(stock.quantity_available) || 0,
        lastMovementAt: stock.last_movement_at
      }
    })

  } catch (error) {
    console.error('[Warehouse Stock API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener stock'
    }, { status: 500 })
  }
}
