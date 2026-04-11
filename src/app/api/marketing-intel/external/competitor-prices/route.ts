import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * POST /api/marketing-intel/external/competitor-prices
 * Submit batch of competitor price data.
 * Body: { prices: [{ competitorId, productName, productSku?, competitorPrice, currency?, sourceUrl?, confidenceScore? }] }
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { prices } = body

    if (!Array.isArray(prices) || prices.length === 0) {
      return NextResponse.json({ success: false, error: 'prices array requerido' }, { status: 400 })
    }

    let inserted = 0
    let matched = 0
    const suggestions: string[] = []

    for (const price of prices) {
      if (!price.productName || !price.competitorPrice) continue

      // Try to match product with strict classification
      let productId: number | null = null
      let ourPrice: number | null = null
      let matchType: 'exact' | 'similar' | 'uncertain' = 'uncertain'

      // 1. Try exact match by barcode
      if (price.productSku) {
        const exactMatch = await db.query(
          `SELECT id, selling_price FROM market_products WHERE company_id = $1 AND is_active = true AND barcode = $2 LIMIT 1`,
          [auth.companyId, price.productSku]
        )
        if (exactMatch.rows.length > 0) {
          productId = exactMatch.rows[0].id
          ourPrice = parseFloat(exactMatch.rows[0].selling_price) || null
          matchType = 'exact'
          matched++
        }
      }

      // 2. Try SKU match
      if (!productId && price.productSku) {
        const skuMatch = await db.query(
          `SELECT id, selling_price FROM market_products WHERE company_id = $1 AND is_active = true AND sku ILIKE $2 LIMIT 1`,
          [auth.companyId, price.productSku]
        )
        if (skuMatch.rows.length > 0) {
          productId = skuMatch.rows[0].id
          ourPrice = parseFloat(skuMatch.rows[0].selling_price) || null
          matchType = 'exact'
          matched++
        }
      }

      // 3. Try name match (fuzzy)
      if (!productId) {
        const nameMatch = await db.query(
          `SELECT id, selling_price, name FROM market_products WHERE company_id = $1 AND is_active = true AND name ILIKE $2 LIMIT 1`,
          [auth.companyId, `%${price.productName}%`]
        )
        if (nameMatch.rows.length > 0) {
          productId = nameMatch.rows[0].id
          ourPrice = parseFloat(nameMatch.rows[0].selling_price) || null
          const confidence = price.confidenceScore || 0.5
          matchType = confidence >= 0.8 ? 'similar' : 'uncertain'
          matched++
        }
      }

      // Use match_type from caller if provided explicitly
      if (price.matchType) matchType = price.matchType

      // Calculate price difference
      const compPrice = parseFloat(price.competitorPrice)
      const priceDiff = ourPrice !== null ? ourPrice - compPrice : null
      const priceDiffPct = ourPrice !== null && ourPrice > 0
        ? ((ourPrice - compPrice) / ourPrice) * 100
        : null

      // Ensure match_type column exists
      try { await db.query("ALTER TABLE mi_competitor_prices ADD COLUMN IF NOT EXISTS match_type VARCHAR(20) DEFAULT 'exact'") } catch {}

      await db.query(`
        INSERT INTO mi_competitor_prices (
          company_id, competitor_id, product_id, product_name, product_sku,
          competitor_price, our_price, currency, price_difference, price_diff_percent,
          source_url, confidence_score, captured_by, match_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        auth.companyId,
        price.competitorId || null,
        productId,
        price.productName,
        price.productSku || null,
        compPrice,
        ourPrice,
        price.currency || 'USD',
        priceDiff,
        priceDiffPct ? Math.round(priceDiffPct * 100) / 100 : null,
        price.sourceUrl || null,
        price.confidenceScore || null,
        auth.agentType || 'research',
        matchType
      ])
      inserted++

      // Auto-suggest if we are significantly more expensive (>20%)
      if (priceDiffPct !== null && priceDiffPct > 20 && productId) {
        suggestions.push(price.productName)
        await db.query(`
          INSERT INTO mi_suggestions (
            company_id, suggested_by, type, title, description,
            products, market_data, estimated_impact
          ) VALUES ($1, $2, 'price_reduction', $3, $4, $5, $6, $7)
        `, [
          auth.companyId,
          'openclaw-research',
          `Reducir precio de ${price.productName}`,
          `Nuestro precio ($${ourPrice?.toFixed(2)}) es ${Math.abs(priceDiffPct).toFixed(0)}% más caro que la competencia ($${compPrice.toFixed(2)})`,
          JSON.stringify([{ productId, productName: price.productName, currentPrice: ourPrice, suggestedPrice: compPrice }]),
          JSON.stringify({ competitorPrice: compPrice, ourPrice, difference: priceDiff, percentDiff: priceDiffPct }),
          JSON.stringify({ potentialPriceReduction: priceDiff })
        ])
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        inserted,
        matched,
        total: prices.length,
        autoSuggestions: suggestions.length
      }
    })
  } catch (error) {
    console.error('[MI External Competitor Prices] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al procesar precios' }, { status: 500 })
  }
}
