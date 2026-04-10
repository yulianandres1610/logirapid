import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * POST /api/marketing-intel/external/competitors
 * Register or update a competitor.
 * Body: { name, location?, websiteUrl?, metadata? }
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, location, websiteUrl, metadata } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'name es requerido' }, { status: 400 })
    }

    // Upsert: if competitor with same name exists, update it
    const existing = await db.query(
      'SELECT id FROM mi_competitors WHERE company_id = $1 AND LOWER(name) = LOWER($2)',
      [auth.companyId, name]
    )

    let competitorId: number
    if (existing.rows.length > 0) {
      competitorId = existing.rows[0].id
      await db.query(`
        UPDATE mi_competitors SET
          location = COALESCE($1, location),
          website_url = COALESCE($2, website_url),
          metadata = COALESCE($3, metadata),
          source = 'openclaw',
          updated_at = NOW()
        WHERE id = $4
      `, [location || null, websiteUrl || null, metadata ? JSON.stringify(metadata) : null, competitorId])
    } else {
      const result = await db.query(`
        INSERT INTO mi_competitors (company_id, name, location, website_url, source, metadata)
        VALUES ($1, $2, $3, $4, 'openclaw', $5)
        RETURNING id
      `, [auth.companyId, name, location || null, websiteUrl || null, JSON.stringify(metadata || {})])
      competitorId = result.rows[0].id
    }

    return NextResponse.json({
      success: true,
      data: { id: competitorId, name }
    })
  } catch (error) {
    console.error('[MI External Competitors] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar competidor' }, { status: 500 })
  }
}
