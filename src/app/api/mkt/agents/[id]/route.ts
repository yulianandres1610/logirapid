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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const allowedFields = ['status', 'name', 'description', 'channels', 'capabilities', 'config']

    const setClauses: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const value = (field === 'channels' || field === 'capabilities' || field === 'config')
          ? JSON.stringify(body[field])
          : body[field]
        setClauses.push(`${field} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: 'No hay campos para actualizar' }, { status: 400 })
    }

    setClauses.push(`updated_at = NOW()`)

    values.push(parseInt(id))
    values.push(payload.companyId)

    const result = await db.query(`
      UPDATE mkt_agents
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1} AND status != 'deleted'
      RETURNING id, agent_id, name, type, description, channels, capabilities, status, is_online, updated_at
    `, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Agente no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('[MKT Agent PATCH]', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar agente' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { id } = await params

    const result = await db.query(`
      UPDATE mkt_agents
      SET status = 'disabled', is_online = false, updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND status != 'deleted'
      RETURNING id, agent_id, name, status
    `, [parseInt(id), payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Agente no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('[MKT Agent DELETE]', error)
    return NextResponse.json({ success: false, error: 'Error al desactivar agente' }, { status: 500 })
  }
}
