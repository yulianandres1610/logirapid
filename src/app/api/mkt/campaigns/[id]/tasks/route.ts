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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const campaignId = parseInt(id)

    // Verify campaign belongs to company
    const campaign = await db.query(
      'SELECT id FROM mkt_campaigns WHERE id = $1 AND company_id = $2',
      [campaignId, payload.companyId]
    )
    if (campaign.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Campaña no encontrada' }, { status: 404 })
    }

    const result = await db.query(`
      SELECT id, campaign_id, title, description, type, status, assigned_to,
             file_url, completed_by, completed_at, due_date, created_at, updated_at
      FROM mkt_campaign_tasks
      WHERE campaign_id = $1
      ORDER BY created_at ASC
    `, [campaignId])

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('[MKT Campaign Tasks GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener tareas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const campaignId = parseInt(id)

    // Verify campaign belongs to company
    const campaign = await db.query(
      'SELECT id FROM mkt_campaigns WHERE id = $1 AND company_id = $2',
      [campaignId, payload.companyId]
    )
    if (campaign.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Campaña no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, type, assignedTo, dueDate } = body

    if (!title) {
      return NextResponse.json({ success: false, error: 'title es requerido' }, { status: 400 })
    }

    const result = await db.query(`
      INSERT INTO mkt_campaign_tasks (campaign_id, title, description, type, status, assigned_to, sort_order)
      VALUES ($1, $2, $3, $4, 'pending', $5, $6)
      RETURNING id, campaign_id, title, description, type, status, assigned_to, sort_order, created_at
    `, [
      campaignId,
      title,
      description || null,
      type || 'manual',
      assignedTo || 'team',
      body.sortOrder || 0
    ])

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[MKT Campaign Tasks POST]', error)
    return NextResponse.json({ success: false, error: 'Error al crear tarea' }, { status: 500 })
  }
}
