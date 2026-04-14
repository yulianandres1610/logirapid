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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { id, taskId } = await params
    const campaignId = parseInt(id)
    const taskIdInt = parseInt(taskId)

    // Verify campaign belongs to company
    const campaign = await db.query(
      'SELECT id FROM mkt_campaigns WHERE id = $1 AND company_id = $2',
      [campaignId, payload.companyId]
    )
    if (campaign.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Campaña no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const allowedFields = ['status', 'file_url', 'file_type', 'completed_by', 'completed_at', 'title', 'description', 'assigned_to', 'sort_order']
    const setClauses: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const field of allowedFields) {
      const camelKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      const value = body[field] !== undefined ? body[field] : body[camelKey]
      if (value !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    // Auto-set completion fields when status changes to completed
    if (body.status === 'completed' && !body.completed_by && !body.completedBy) {
      setClauses.push(`completed_by = $${paramIndex}`)
      values.push(payload.userId)
      paramIndex++
      setClauses.push(`completed_at = NOW()`)
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: 'No hay campos para actualizar' }, { status: 400 })
    }

    values.push(taskIdInt)
    values.push(campaignId)

    const result = await db.query(`
      UPDATE mkt_campaign_tasks
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND campaign_id = $${paramIndex + 1}
      RETURNING id, campaign_id, title, description, type, status, assigned_to, sort_order, file_url, file_type, completed_by, completed_at, created_at
    `, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Tarea no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('[MKT Campaign Task PATCH]', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar tarea' }, { status: 500 })
  }
}
