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

    // Ensure table exists
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

    const result = await db.query(`
      SELECT * FROM mi_campaign_tasks
      WHERE campaign_id = $1 AND company_id = $2
      ORDER BY sort_order ASC, id ASC
    `, [id, payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        assignedTo: t.assigned_to,
        sortOrder: t.sort_order,
        status: t.status,
        completedBy: t.completed_by,
        completedAt: t.completed_at,
        createdAt: t.created_at
      }))
    })
  } catch (error) {
    console.error('[MI Campaign Tasks GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener tareas' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, assignedTo, sortOrder } = body

    if (!title) {
      return NextResponse.json({ success: false, error: 'title requerido' }, { status: 400 })
    }

    // Verify campaign belongs to company
    const campaign = await db.query(
      'SELECT id FROM mi_campaigns WHERE id = $1 AND company_id = $2',
      [id, payload.companyId]
    )
    if (campaign.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Campana no encontrada' }, { status: 404 })
    }

    // Ensure table exists
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

    const result = await db.query(`
      INSERT INTO mi_campaign_tasks (campaign_id, company_id, title, description, assigned_to, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [id, payload.companyId, title, description || null, assignedTo || null, sortOrder || 0])

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Tarea creada'
    })
  } catch (error) {
    console.error('[MI Campaign Tasks POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear tarea' }, { status: 500 })
  }
}
