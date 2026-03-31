import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production') as JWTPayload } catch { return null }
}

/**
 * POST /api/market/exchange-rate-config/preview
 * Calculate the impact of a new exchange rate on all product prices
 * Does NOT save anything — just previews the changes
 */
export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    const { newRate } = await request.json()

    if (!newRate || newRate <= 0) {
      return NextResponse.json({ success: false, error: 'Tasa inválida' }, { status: 400 })
    }

    // Get current rate
    const configResult = await db.query(
      'SELECT manual_rate FROM market_exchange_rate_config WHERE company_id = $1',
      [payload.companyId]
    )
    const currentRate = configResult.rows[0]?.manual_rate ? parseFloat(configResult.rows[0].manual_rate) : 0

    // Get all active products with selling_price > 0
    const productsResult = await db.query(`
      SELECT id, name, sku, selling_price, cost_price, category
      FROM market_products
      WHERE company_id = $1 AND is_active = true AND selling_price > 0
      ORDER BY name
    `, [payload.companyId])

    const changes = []
    let affectedCount = 0
    let unchangedCount = 0

    for (const product of productsResult.rows) {
      const currentUSD = parseFloat(product.selling_price) || 0
      if (currentUSD <= 0) continue

      // Current CUP (with old rate, may be ugly number)
      const currentCUP = currentRate > 0 ? Math.round(currentUSD * currentRate) : 0

      // New CUP with new rate (raw, possibly ugly)
      const rawNewCUP = currentUSD * newRate

      // Commercial CUP: round to nearest multiple of 5
      const commercialCUP = Math.round(rawNewCUP / 5) * 5

      // New USD = exact division, no rounding — keep full precision
      const newUSD = commercialCUP / newRate

      // Verify: newUSD * newRate should equal commercialCUP exactly
      const verifyCUP = Math.round(newUSD * newRate)

      const priceChanged = Math.abs(newUSD - currentUSD) > 0.0000001

      if (priceChanged) {
        affectedCount++
        changes.push({
          productId: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          currentUSD,
          currentCUP,
          newUSD,
          newCUP: commercialCUP,
          verifyCUP,
          diffUSD: Math.round((newUSD - currentUSD) * 1000) / 1000,
          diffCUP: commercialCUP - currentCUP
        })
      } else {
        unchangedCount++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        currentRate,
        newRate,
        totalProducts: productsResult.rows.length,
        affectedCount,
        unchangedCount,
        changes
      }
    })
  } catch (error) {
    console.error('[Exchange Rate Preview] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al calcular preview' }, { status: 500 })
  }
}
