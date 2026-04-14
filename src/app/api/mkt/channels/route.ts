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
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const result = await db.query(`
      SELECT c.id, c.platform, c.name, c.identifier, c.purpose, c.status,
             c.assigned_agent_id, c.created_at, c.updated_at,
             a.name as agent_name, a.agent_id as agent_code
      FROM mkt_channels c
      LEFT JOIN mkt_agents a ON a.id = c.assigned_agent_id AND a.company_id = c.company_id
      WHERE c.company_id = $1
      ORDER BY c.created_at DESC
    `, [payload.companyId])

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('[MKT Channels GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener canales' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { platform, name, identifier, purpose, assignedAgentId } = body

    if (!platform || !name || !identifier) {
      return NextResponse.json({ success: false, error: 'platform, name e identifier son requeridos' }, { status: 400 })
    }

    // Check duplicate identifier per platform per company
    const existing = await db.query(
      'SELECT id FROM mkt_channels WHERE company_id = $1 AND platform = $2 AND identifier = $3',
      [payload.companyId, platform, identifier]
    )
    if (existing.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Ya existe un canal con ese identificador en esa plataforma' }, { status: 409 })
    }

    const result = await db.query(`
      INSERT INTO mkt_channels (company_id, platform, name, identifier, purpose, assigned_agent_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      RETURNING id, platform, name, identifier, purpose, assigned_agent_id, status, created_at
    `, [
      payload.companyId,
      platform,
      name,
      identifier,
      purpose || 'research',
      assignedAgentId || null
    ])

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[MKT Channels POST]', error)
    return NextResponse.json({ success: false, error: 'Error al crear canal' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'id es requerido' }, { status: 400 })
    }

    const result = await db.query(`
      DELETE FROM mkt_channels
      WHERE id = $1 AND company_id = $2
      RETURNING id, name, platform
    `, [id, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Canal no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.rows[0] })
  } catch (error) {
    console.error('[MKT Channels DELETE]', error)
    return NextResponse.json({ success: false, error: 'Error al eliminar canal' }, { status: 500 })
  }
}
