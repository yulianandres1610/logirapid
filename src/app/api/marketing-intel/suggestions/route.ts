import { NextResponse } from 'next/server'
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
 * GET /api/marketing-intel/suggestions
 * List all suggestions with optional status filter
 */
export async function GET() {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const result = await db.query(`
      SELECT s.*, u.email as reviewer_email
      FROM mi_suggestions s
      LEFT JOIN users u ON u.id = s.reviewed_by
      WHERE s.company_id = $1
      ORDER BY
        CASE WHEN s.status = 'pending' THEN 0 ELSE 1 END,
        s.created_at DESC
      LIMIT 100
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map(s => ({
        id: s.id,
        suggestedBy: s.suggested_by,
        type: s.type,
        title: s.title,
        description: s.description,
        products: s.products || [],
        marketData: s.market_data || {},
        estimatedImpact: s.estimated_impact || {},
        status: s.status,
        reviewedBy: s.reviewer_email || null,
        reviewedAt: s.reviewed_at,
        createdAt: s.created_at
      }))
    })
  } catch (error) {
    console.error('[MI Suggestions] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener sugerencias' }, { status: 500 })
  }
}
