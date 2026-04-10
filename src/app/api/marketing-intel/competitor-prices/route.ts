import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload } catch { return null }
}

/**
 * GET /api/marketing-intel/competitor-prices
 * Price intelligence with filters
 * Query: ?competitorId=X&productId=X&category=X&page=1&limit=50
 */
export async function GET(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const competitorId = searchParams.get('competitorId')
    const productId = searchParams.get('productId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = (page - 1) * limit

    let where = 'cp.company_id = $1'
    const params: any[] = [payload.companyId]
    let idx = 2

    if (competitorId) { where += ` AND cp.competitor_id = $${idx}`; params.push(parseInt(competitorId)); idx++ }
    if (productId) { where += ` AND cp.product_id = $${idx}`; params.push(parseInt(productId)); idx++ }

    const countRes = await db.query(`SELECT COUNT(*) as total FROM mi_competitor_prices cp WHERE ${where}`, params)
    const total = parseInt(countRes.rows[0]?.total) || 0

    params.push(limit, offset)
    const result = await db.query(`
      SELECT cp.*, c.name as competitor_name, p.name as matched_product_name, p.category
      FROM mi_competitor_prices cp
      LEFT JOIN mi_competitors c ON c.id = cp.competitor_id
      LEFT JOIN market_products p ON p.id = cp.product_id
      WHERE ${where}
      ORDER BY cp.captured_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id,
        competitorName: r.competitor_name || 'Desconocido',
        productName: r.product_name,
        matchedProductName: r.matched_product_name,
        productId: r.product_id,
        category: r.category,
        competitorPrice: parseFloat(r.competitor_price) || 0,
        ourPrice: r.our_price ? parseFloat(r.our_price) : null,
        priceDifference: r.price_difference ? parseFloat(r.price_difference) : null,
        priceDiffPercent: r.price_diff_percent ? parseFloat(r.price_diff_percent) : null,
        currency: r.currency,
        confidenceScore: r.confidence_score ? parseFloat(r.confidence_score) : null,
        capturedBy: r.captured_by,
        capturedAt: r.captured_at
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('[MI Competitor Prices] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener precios' }, { status: 500 })
  }
}
