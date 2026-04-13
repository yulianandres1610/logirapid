import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function POST(request: NextRequest) {
  const auth = await validateAgentToken(request)
  if (!auth.valid) return NextResponse.json({ success: false, error: auth.error }, { status: 401 })

  try {
    const body = await request.json()
    const findings: Array<{
      searchTerm: string
      foundName: string
      foundPrice: number
      currency?: string
      sourcePlatform: string
      sourceName?: string
      sourceUrl?: string
      matchConfidence?: number
      matchType?: string
      productId?: number
    }> = Array.isArray(body.findings) ? body.findings : [body]

    if (findings.length === 0) {
      return NextResponse.json({ success: false, error: 'Al menos un finding es requerido' }, { status: 400 })
    }

    if (findings.length > 500) {
      return NextResponse.json({ success: false, error: 'Máximo 500 findings por solicitud' }, { status: 400 })
    }

    let inserted = 0
    let matched = 0

    for (const f of findings) {
      if (!f.searchTerm || !f.foundName || f.foundPrice === undefined || !f.sourcePlatform) continue

      let productId = f.productId || null
      let priceDiff: number | null = null
      let ourPrice: number | null = null

      // Auto-match if productId not provided
      if (!productId) {
        const matchResult = await db.query(`
          SELECT id, selling_price
          FROM market_products
          WHERE company_id = $1
            AND is_active = true
            AND (
              name ILIKE $2
              OR sku ILIKE $2
              OR barcode ILIKE $2
            )
          LIMIT 1
        `, [auth.companyId, `%${f.searchTerm}%`])

        if (matchResult.rows.length > 0) {
          productId = matchResult.rows[0].id
          ourPrice = parseFloat(matchResult.rows[0].selling_price)
          matched++
        }
      } else {
        // Fetch our price for the given productId
        const priceResult = await db.query(`
          SELECT selling_price FROM market_products WHERE id = $1 AND company_id = $2
        `, [productId, auth.companyId])
        if (priceResult.rows.length > 0) {
          ourPrice = parseFloat(priceResult.rows[0].selling_price)
        }
      }

      // Calculate price diff
      if (ourPrice !== null) {
        priceDiff = f.foundPrice - ourPrice
      }

      await db.query(`
        INSERT INTO mkt_price_findings (
          company_id, agent_id, product_id, search_term, found_name, found_price,
          currency, source_platform, source_name, source_url,
          match_confidence, match_type, price_diff, our_price, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      `, [
        auth.companyId,
        auth.agentId,
        productId,
        f.searchTerm,
        f.foundName,
        f.foundPrice,
        f.currency || 'USD',
        f.sourcePlatform,
        f.sourceName || null,
        f.sourceUrl || null,
        f.matchConfidence || null,
        f.matchType || null,
        priceDiff,
        ourPrice
      ])

      inserted++
    }

    return NextResponse.json({
      success: true,
      data: { inserted, matched }
    })
  } catch (error: any) {
    console.error('[MKT Ext] Price findings error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar price findings' }, { status: 500 })
  }
}
