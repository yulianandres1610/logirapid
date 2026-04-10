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
 * Returns real-time agent status + event feed for the dashboard.
 * Query: ?limit=50 (events limit)
 */
export async function GET(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const cid = payload.companyId
  const { searchParams } = new URL(request.url)
  const eventsLimit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

  try {
    // Ensure tables exist
    try {
      await db.query(`CREATE TABLE IF NOT EXISTS mi_agent_heartbeats (
        id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, agent_id VARCHAR(100) NOT NULL,
        name VARCHAR(255), role VARCHAR(50), status VARCHAR(30) DEFAULT 'idle',
        current_task TEXT, current_target TEXT, message TEXT,
        progress_pct INTEGER DEFAULT 0, items_processed INTEGER DEFAULT 0,
        items_found INTEGER DEFAULT 0, items_matched INTEGER DEFAULT 0, errors_count INTEGER DEFAULT 0,
        started_at TIMESTAMP, metadata JSONB DEFAULT '{}', updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, agent_id))`)
      await db.query(`CREATE TABLE IF NOT EXISTS mi_agent_events (
        id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, agent_id VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL, level VARCHAR(20) DEFAULT 'info', text TEXT NOT NULL,
        target VARCHAR(500), url TEXT, product_id INTEGER, product_name VARCHAR(255),
        metadata JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW())`)
    } catch { /* ignore */ }

    // Get all agent heartbeats (current state)
    const heartbeats = await db.query(`
      SELECT h.*, a.total_sales, a.total_orders
      FROM mi_agent_heartbeats h
      LEFT JOIN mi_sales_agents a ON a.company_id = h.company_id AND a.agent_id = h.agent_id
      WHERE h.company_id = $1
      ORDER BY h.updated_at DESC
    `, [cid])

    // Get recent events
    const events = await db.query(`
      SELECT e.*, h.name as agent_name, h.role as agent_role
      FROM mi_agent_events e
      LEFT JOIN mi_agent_heartbeats h ON h.company_id = e.company_id AND h.agent_id = e.agent_id
      WHERE e.company_id = $1
      ORDER BY e.created_at DESC
      LIMIT $2
    `, [cid, eventsLimit])

    // Also check mi_agent_activity (legacy)
    let legacyEvents: any[] = []
    try {
      const legacy = await db.query(`
        SELECT agent_id, status, action as text, details, progress as progress_pct, created_at,
          'info' as type, 'info' as level
        FROM mi_agent_activity
        WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC LIMIT 20
      `, [cid])
      legacyEvents = legacy.rows
    } catch { /* table may not exist */ }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

    const agents = heartbeats.rows.map(h => {
      const isOnline = h.updated_at && new Date(h.updated_at) > fiveMinAgo
      return {
        agentId: h.agent_id,
        name: h.name || h.agent_id,
        role: h.role || 'research',
        status: isOnline ? (h.status || 'idle') : 'offline',
        isOnline,
        currentTask: isOnline ? h.current_task : null,
        currentTarget: isOnline ? h.current_target : null,
        message: isOnline ? h.message : null,
        progressPct: isOnline ? (h.progress_pct || 0) : 0,
        itemsProcessed: h.items_processed || 0,
        itemsFound: h.items_found || 0,
        itemsMatched: h.items_matched || 0,
        errorsCount: h.errors_count || 0,
        startedAt: h.started_at,
        updatedAt: h.updated_at,
        totalSales: parseFloat(h.total_sales) || 0,
        totalOrders: parseInt(h.total_orders) || 0
      }
    })

    // Merge events from both tables
    const allEvents = [
      ...events.rows.map((e: any) => ({
        agentId: e.agent_id,
        agentName: e.agent_name || e.agent_id,
        agentRole: e.agent_role || null,
        type: e.type,
        level: e.level,
        text: e.text,
        target: e.target,
        url: e.url,
        productId: e.product_id,
        productName: e.product_name,
        createdAt: e.created_at
      })),
      ...legacyEvents.map((e: any) => ({
        agentId: e.agent_id,
        agentName: e.agent_id,
        agentRole: null,
        type: e.type || 'info',
        level: e.level || 'info',
        text: e.text,
        target: null,
        url: null,
        productId: null,
        productName: null,
        createdAt: e.created_at
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
     .slice(0, eventsLimit)

    const online = agents.filter(a => a.isOnline)

    return NextResponse.json({
      success: true,
      data: {
        agents,
        events: allEvents,
        summary: {
          totalAgents: agents.length,
          online: online.length,
          working: online.filter(a => !['idle', 'offline'].includes(a.status)).length,
          idle: online.filter(a => a.status === 'idle').length,
          offline: agents.filter(a => !a.isOnline).length,
          totalItemsProcessed: agents.reduce((s, a) => s + a.itemsProcessed, 0),
          totalItemsMatched: agents.reduce((s, a) => s + a.itemsMatched, 0),
          totalErrors: agents.reduce((s, a) => s + a.errorsCount, 0)
        }
      }
    })
  } catch (error) {
    console.error('[MI Agent Activity] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener actividad' }, { status: 500 })
  }
}
