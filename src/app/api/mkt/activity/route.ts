import { NextResponse } from 'next/server'
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

    const companyId = payload.companyId

    const [agentsResult, activityResult] = await Promise.all([
      // Agents with current status
      db.query(`
        SELECT id, agent_id, name, type, status, is_online, last_heartbeat_at, channels
        FROM mkt_agents
        WHERE company_id = $1 AND status != 'deleted'
        ORDER BY is_online DESC, last_heartbeat_at DESC NULLS LAST
      `, [companyId]),

      // Activity events last 24h
      db.query(`
        SELECT a.id, a.agent_id, a.type, a.status, a.action, a.target,
               a.metadata, a.created_at,
               ag.name as agent_name, ag.type as agent_type
        FROM mkt_agent_activity a
        JOIN mkt_agents ag ON ag.agent_id = a.agent_id AND ag.company_id = $1
        WHERE a.company_id = $1 AND a.created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY a.created_at DESC
        LIMIT 100
      `, [companyId])
    ])

    return NextResponse.json({
      success: true,
      data: {
        agents: agentsResult.rows,
        events: activityResult.rows
      }
    })
  } catch (error) {
    console.error('[MKT Activity GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener actividad' }, { status: 500 })
  }
}
