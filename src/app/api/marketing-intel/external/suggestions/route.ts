import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * POST /api/marketing-intel/external/suggestions
 * Submit AI-generated promotion/pricelist suggestions.
 * Body: { suggestions: [{ type, title, description, products?, marketData?, estimatedImpact? }] }
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { suggestions } = body

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return NextResponse.json({ success: false, error: 'suggestions array requerido' }, { status: 400 })
    }

    let created = 0
    for (const s of suggestions) {
      if (!s.type || !s.title) continue

      await db.query(`
        INSERT INTO mi_suggestions (
          company_id, suggested_by, type, title, description,
          products, market_data, estimated_impact
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        auth.companyId,
        auth.agentType || 'openclaw',
        s.type,
        s.title,
        s.description || null,
        JSON.stringify(s.products || []),
        JSON.stringify(s.marketData || {}),
        JSON.stringify(s.estimatedImpact || {})
      ])
      created++
    }

    return NextResponse.json({
      success: true,
      data: { created, total: suggestions.length }
    })
  } catch (error) {
    console.error('[MI External Suggestions] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear sugerencias' }, { status: 500 })
  }
}
