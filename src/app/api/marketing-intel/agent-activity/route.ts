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

/**
 * GET /api/marketing-intel/agent-activity
 * Returns real-time agent activity for the dashboard.
 * Shows current status of each agent + recent activity log.
 */
export async function GET(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const cid = payload.companyId

  try {
    // Ensure table exists
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS mi_agent_activity (
          id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, agent_id VARCHAR(100) NOT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'working', action TEXT NOT NULL, details TEXT,
          progress INTEGER DEFAULT 0, metadata JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW()
        )
      `)
    } catch { /* ignore */ }

    // Get all agents with their latest activity
    const agentsResult = await db.query(`
      SELECT a.agent_id, a.name, a.channel, a.status as agent_status, a.metadata,
        a.total_sales, a.total_orders, a.updated_at,
        la.status as current_status, la.action as current_action, la.details as current_details,
        la.progress as current_progress, la.created_at as last_activity_at
      FROM mi_sales_agents a
      LEFT JOIN LATERAL (
        SELECT status, action, details, progress, created_at
        FROM mi_agent_activity
        WHERE company_id = $1 AND agent_id = a.agent_id
        ORDER BY created_at DESC LIMIT 1
      ) la ON true
      WHERE a.company_id = $1
      ORDER BY la.created_at DESC NULLS LAST
    `, [cid])

    // Get recent activity log (last 50 events across all agents)
    const activityResult = await db.query(`
      SELECT act.agent_id, act.status, act.action, act.details, act.progress, act.created_at,
        a.name as agent_name, a.channel
      FROM mi_agent_activity act
      LEFT JOIN mi_sales_agents a ON a.company_id = act.company_id AND a.agent_id = act.agent_id
      WHERE act.company_id = $1 AND act.created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY act.created_at DESC
      LIMIT 50
    `, [cid])

    // Determine if agent is "online" (activity in last 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const agents = agentsResult.rows.map(a => {
      const isOnline = a.last_activity_at && new Date(a.last_activity_at).toISOString() > fiveMinAgo
      const role = a.metadata?.role || 'sales'
      return {
        agentId: a.agent_id,
        name: a.name,
        channel: a.channel,
        role,
        isOnline,
        currentStatus: isOnline ? (a.current_status || 'idle') : 'offline',
        currentAction: isOnline ? (a.current_action || null) : null,
        currentDetails: isOnline ? (a.current_details || null) : null,
        currentProgress: isOnline ? (a.current_progress || 0) : 0,
        lastActivityAt: a.last_activity_at,
        totalSales: parseFloat(a.total_sales) || 0,
        totalOrders: parseInt(a.total_orders) || 0
      }
    })

    const activityLog = activityResult.rows.map(a => ({
      agentId: a.agent_id,
      agentName: a.agent_name || a.agent_id,
      channel: a.channel,
      status: a.status,
      action: a.action,
      details: a.details,
      progress: a.progress || 0,
      createdAt: a.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        agents,
        activityLog,
        summary: {
          totalAgents: agents.length,
          online: agents.filter(a => a.isOnline).length,
          working: agents.filter(a => a.currentStatus === 'working').length,
          idle: agents.filter(a => a.currentStatus === 'idle').length,
          offline: agents.filter(a => !a.isOnline).length
        }
      }
    })
  } catch (error) {
    console.error('[MI Agent Activity] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener actividad' }, { status: 500 })
  }
}
