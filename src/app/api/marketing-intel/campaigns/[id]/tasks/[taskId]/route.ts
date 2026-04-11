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
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { id, taskId } = await params
    const body = await request.json()
    const { status, completedBy } = body

    if (!status) {
      return NextResponse.json({ success: false, error: 'status requerido' }, { status: 400 })
    }

    const updates: string[] = [`status = $1`]
    const values: any[] = [status]
    let idx = 2

    if (status === 'completed') {
      updates.push(`completed_by = $${idx++}`)
      values.push(completedBy || payload.email)
      updates.push(`completed_at = NOW()`)
    } else {
      updates.push(`completed_by = NULL`)
      updates.push(`completed_at = NULL`)
    }

    const result = await db.query(`
      UPDATE mi_campaign_tasks SET ${updates.join(', ')}
      WHERE id = $${idx++} AND campaign_id = $${idx++} AND company_id = $${idx}
      RETURNING id
    `, [...values, taskId, id, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Tarea no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Tarea actualizada' })
  } catch (error) {
    console.error('[MI Campaign Task PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar tarea' }, { status: 500 })
  }
}
