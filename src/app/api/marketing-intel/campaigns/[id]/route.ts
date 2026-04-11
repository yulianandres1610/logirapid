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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await params

    // Ensure supporting tables exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_campaign_tasks (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        assigned_to VARCHAR(100),
        sort_order INTEGER DEFAULT 0,
        status VARCHAR(30) DEFAULT 'pending',
        completed_by VARCHAR(100),
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_campaign_assets (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        file_url TEXT,
        file_size INTEGER DEFAULT 0,
        platform VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    try {
      await db.query('CREATE INDEX IF NOT EXISTS idx_mi_tasks_campaign ON mi_campaign_tasks(campaign_id)')
      await db.query('CREATE INDEX IF NOT EXISTS idx_mi_assets_campaign ON mi_campaign_assets(campaign_id)')
    } catch { /* ignore */ }

    // Get campaign
    const campaignResult = await db.query(`
      SELECT c.*, u.email as created_by_email
      FROM mi_campaigns c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.id = $1 AND c.company_id = $2
    `, [id, payload.companyId])

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Campana no encontrada' }, { status: 404 })
    }

    const c = campaignResult.rows[0]

    // Get tasks
    const tasksResult = await db.query(`
      SELECT * FROM mi_campaign_tasks
      WHERE campaign_id = $1 AND company_id = $2
      ORDER BY sort_order ASC, id ASC
    `, [id, payload.companyId])

    // Get assets
    const assetsResult = await db.query(`
      SELECT * FROM mi_campaign_assets
      WHERE campaign_id = $1 AND company_id = $2
      ORDER BY created_at DESC
    `, [id, payload.companyId])

    // Parse sales scripts from metrics if present
    let salesScripts = null
    const metrics = c.metrics || {}
    if (metrics.salesScripts) {
      salesScripts = metrics.salesScripts
    }

    return NextResponse.json({
      success: true,
      data: {
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
        metrics: metrics,
        salesScripts: salesScripts,
        createdBy: c.created_by_email,
        createdAt: c.created_at,
        tasks: tasksResult.rows.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          assignedTo: t.assigned_to,
          sortOrder: t.sort_order,
          status: t.status,
          completedBy: t.completed_by,
          completedAt: t.completed_at,
          createdAt: t.created_at
        })),
        assets: assetsResult.rows.map(a => ({
          id: a.id,
          type: a.type,
          name: a.name,
          fileUrl: a.file_url,
          fileSize: a.file_size || 0,
          platform: a.platform,
          notes: a.notes,
          createdAt: a.created_at
        }))
      }
    })
  } catch (error) {
    console.error('[MI Campaign Detail GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener campana' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ success: false, error: 'status requerido' }, { status: 400 })
    }

    const validStatuses = ['draft', 'active', 'paused', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: 'Status invalido' }, { status: 400 })
    }

    const result = await db.query(`
      UPDATE mi_campaigns SET status = $1, updated_at = NOW()
      WHERE id = $2 AND company_id = $3
      RETURNING id
    `, [status, id, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Campana no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Campana actualizada' })
  } catch (error) {
    console.error('[MI Campaign Detail PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar campana' }, { status: 500 })
  }
}
