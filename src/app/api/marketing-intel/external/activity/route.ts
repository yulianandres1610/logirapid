import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * POST /api/marketing-intel/external/activity
 * Report real-time agent activity/status.
 * OpenClaw calls this to update what each agent is doing.
 * Body: {
 *   agentId: string,
 *   status: 'working' | 'idle' | 'error' | 'offline',
 *   action: string,           -- "Investigando precios de Arroz en competidor X"
 *   details?: string,         -- Additional context
 *   progress?: number,        -- 0-100 percentage
 *   metadata?: object
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_agent_activity (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        agent_id VARCHAR(100) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'working',
        action TEXT NOT NULL,
        details TEXT,
        progress INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    try {
      await db.query('CREATE INDEX IF NOT EXISTS idx_mi_activity_company_agent ON mi_agent_activity(company_id, agent_id)')
      await db.query('CREATE INDEX IF NOT EXISTS idx_mi_activity_created ON mi_agent_activity(created_at)')
    } catch { /* ignore */ }

    const body = await request.json()
    const { agentId, status, action, details, progress, metadata } = body

    if (!agentId || !action) {
      return NextResponse.json({ success: false, error: 'agentId y action requeridos' }, { status: 400 })
    }

    await db.query(`
      INSERT INTO mi_agent_activity (company_id, agent_id, status, action, details, progress, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      auth.companyId, agentId, status || 'working', action,
      details || null, progress || 0, JSON.stringify(metadata || {})
    ])

    // Update agent last activity in mi_sales_agents
    try {
      await db.query(`
        UPDATE mi_sales_agents SET
          metadata = jsonb_set(COALESCE(metadata, '{}'), '{lastAction}', $1::jsonb),
          updated_at = NOW()
        WHERE company_id = $2 AND agent_id = $3
      `, [JSON.stringify({ action, status, progress, timestamp: new Date().toISOString() }), auth.companyId, agentId])
    } catch { /* agent may not exist yet */ }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[MI External Activity] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar actividad' }, { status: 500 })
  }
}
