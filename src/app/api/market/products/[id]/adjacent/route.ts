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
 * GET /api/market/products/[id]/adjacent
 * Get previous and next product IDs for navigation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Get all product IDs for this company, ordered by name (same as inventory list)
    const productsResult = await db.query(`
      SELECT id FROM market_products
      WHERE company_id = $1
      ORDER BY name ASC, id ASC
    `, [payload.companyId])

    const productIds = productsResult.rows.map(r => r.id)
    const currentIndex = productIds.indexOf(productId)

    if (currentIndex === -1) {
      return NextResponse.json({
        success: true,
        data: { prevId: null, nextId: null, total: productIds.length }
      })
    }

    const prevId = currentIndex > 0 ? productIds[currentIndex - 1] : null
    const nextId = currentIndex < productIds.length - 1 ? productIds[currentIndex + 1] : null

    return NextResponse.json({
      success: true,
      data: {
        prevId,
        nextId,
        currentIndex: currentIndex + 1,
        total: productIds.length
      }
    })

  } catch (error) {
    console.error('[Adjacent Products API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener productos adyacentes'
    }, { status: 500 })
  }
}
