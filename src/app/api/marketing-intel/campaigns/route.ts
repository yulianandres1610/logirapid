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

export async function GET() {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const result = await db.query(`
      SELECT c.*, u.email as created_by_email
      FROM mi_campaigns c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.company_id = $1
      ORDER BY c.created_at DESC
      LIMIT 100
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type,
        status: c.status,
        startDate: c.start_date,
        endDate: c.end_date,
        targetProducts: c.target_products || [],
        targetCategories: c.target_categories || [],
        discountType: c.discount_type,
        discountValue: c.discount_value ? parseFloat(c.discount_value) : null,
        budget: c.budget ? parseFloat(c.budget) : null,
        spent: parseFloat(c.spent) || 0,
        suggestedBy: c.suggested_by,
        suggestionReason: c.suggestion_reason,
        metrics: c.metrics || {},
        createdBy: c.created_by_email,
        createdAt: c.created_at
      }))
    })
  } catch (error) {
    console.error('[MI Campaigns GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener campañas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { name, description, type, startDate, endDate, targetProducts, targetCategories, discountType, discountValue, budget } = body

    if (!name || !type) {
      return NextResponse.json({ success: false, error: 'name y type requeridos' }, { status: 400 })
    }

    const result = await db.query(`
      INSERT INTO mi_campaigns (
        company_id, name, description, type, start_date, end_date,
        target_products, target_categories, discount_type, discount_value,
        budget, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      payload.companyId, name, description || null, type,
      startDate || null, endDate || null,
      JSON.stringify(targetProducts || []), JSON.stringify(targetCategories || []),
      discountType || null, discountValue || null,
      budget || null, payload.userId
    ])

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Campaña creada'
    })
  } catch (error) {
    console.error('[MI Campaigns POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear campaña' }, { status: 500 })
  }
}
