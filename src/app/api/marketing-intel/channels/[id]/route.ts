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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await params

    const result = await db.query(`
      UPDATE mi_channels SET status = 'removed', updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND status != 'removed'
      RETURNING id
    `, [id, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Canal no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Canal eliminado' })
  } catch (error) {
    console.error('[MI Channels DELETE] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al eliminar canal' }, { status: 500 })
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
    const { assignedAgentId, status, memberCount } = body

    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    if (assignedAgentId !== undefined) {
      updates.push(`assigned_agent_id = $${idx++}`)
      values.push(assignedAgentId || null)
    }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`)
      values.push(status)
    }
    if (memberCount !== undefined) {
      updates.push(`member_count = $${idx++}`)
      values.push(memberCount)
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)

    const result = await db.query(`
      UPDATE mi_channels SET ${updates.join(', ')}
      WHERE id = $${idx++} AND company_id = $${idx}
      RETURNING id
    `, [...values, id, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Canal no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Canal actualizado' })
  } catch (error) {
    console.error('[MI Channels PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar canal' }, { status: 500 })
  }
}
