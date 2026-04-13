import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { generateAgentToken } from '@/lib/mkt-auth'

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
      SELECT id, agent_id, name, type, description, channels, capabilities,
             status, is_online, last_heartbeat_at, token_prefix,
             created_at, updated_at
      FROM mkt_agents
      WHERE company_id = $1 AND status != 'deleted'
      ORDER BY created_at DESC
    `, [payload.companyId])

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('[MKT Agents GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener agentes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { agentId, name, type, description, channels, capabilities } = body

    if (!agentId || !name || !type) {
      return NextResponse.json({ success: false, error: 'agentId, name y type son requeridos' }, { status: 400 })
    }

    // Check for duplicate agent_id within company
    const existing = await db.query(
      'SELECT id FROM mkt_agents WHERE company_id = $1 AND agent_id = $2 AND status != $3',
      [payload.companyId, agentId, 'deleted']
    )
    if (existing.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Ya existe un agente con ese ID' }, { status: 409 })
    }

    const { rawToken, tokenHash, tokenPrefix } = generateAgentToken()

    const result = await db.query(`
      INSERT INTO mkt_agents (company_id, agent_id, name, type, description, channels, capabilities, token_hash, token_prefix, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
      RETURNING id, agent_id, name, type, description, channels, capabilities, status, token_prefix, created_at
    `, [
      payload.companyId,
      agentId,
      name,
      type,
      description || null,
      channels ? JSON.stringify(channels) : null,
      capabilities ? JSON.stringify(capabilities) : null,
      tokenHash,
      tokenPrefix,
      payload.userId
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...result.rows[0],
        token: rawToken
      }
    }, { status: 201 })
  } catch (error) {
    console.error('[MKT Agents POST]', error)
    return NextResponse.json({ success: false, error: 'Error al crear agente' }, { status: 500 })
  }
}
