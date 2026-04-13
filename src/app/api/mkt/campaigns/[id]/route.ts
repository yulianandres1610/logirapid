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

    const [campaignResult, tasksResult] = await Promise.all([
      db.query(`
        SELECT id, name, description, type, status, channel_id, agent_id,
               objective, budget, start_date, end_date,
               created_by, approved_by, approved_at,
               created_at, updated_at
        FROM mkt_campaigns
        WHERE id = $1 AND company_id = $2
      `, [parseInt(id), payload.companyId]),

      db.query(`
        SELECT id, title, description, type, status, assigned_to, file_url,
               completed_by, completed_at, due_date, created_at
        FROM mkt_campaign_tasks
        WHERE campaign_id = $1
        ORDER BY created_at ASC
      `, [parseInt(id)])
    ])

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Campaña no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...campaignResult.rows[0],
        tasks: tasksResult.rows
      }
    })
  } catch (error) {
    console.error('[MKT Campaign GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener campaña' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const body = await request.json()

    const allowedFields = ['status', 'name', 'description', 'type', 'objective', 'budget', 'start_date', 'end_date', 'channel_id', 'agent_id']
    const setClauses: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const field of allowedFields) {
      // Accept both snake_case and camelCase
      const camelKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      const value = body[field] !== undefined ? body[field] : body[camelKey]
      if (value !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    // Handle approval
    if (body.status === 'approved' || body.approve === true) {
      if (!setClauses.some(c => c.startsWith('status'))) {
        setClauses.push(`status = $${paramIndex}`)
        values.push('approved')
        paramIndex++
      }
      setClauses.push(`approved_by = $${paramIndex}`)
      values.push(payload.userId)
      paramIndex++
      setClauses.push(`approved_at = NOW()`)
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: 'No hay campos para actualizar' }, { status: 400 })
    }

    setClauses.push(`updated_at = NOW()`)
    values.push(parseInt(id))
    values.push(payload.companyId)

    const result = await db.query(`
      UPDATE mkt_campaigns
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}
      RETURNING id, name, description, type, status, channel_id, agent_id, objective, budget, start_date, end_date, approved_by, approved_at, updated_at
    `, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Campaña no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('[MKT Campaign PATCH]', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar campaña' }, { status: 500 })
  }
}
