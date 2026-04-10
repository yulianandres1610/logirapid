import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * POST /api/marketing-intel/external/agent-heartbeat
 * Report agent status in real-time. Called every 30-60 seconds while agent is active.
 * Body: {
 *   agentId: string,
 *   name: string,
 *   role: 'research' | 'sales' | 'campaign' | 'analyst',
 *   status: 'idle' | 'running' | 'scraping' | 'analyzing' | 'posting' | 'error',
 *   currentTask: string,         -- "Scraping precios en ISASUR Market"
 *   currentTarget: string,       -- "isasur.com" or "Categoría: Alimentos"
 *   message: string,             -- Human-readable status message
 *   progressPct: number,         -- 0-100
 *   itemsProcessed: number,      -- Total items processed so far
 *   itemsFound: number,          -- Items discovered in current task
 *   itemsMatched: number,        -- Items matched to our catalog
 *   errorsCount: number,         -- Errors encountered
 *   startedAt: string,           -- ISO timestamp when current task started
 *   metadata?: object
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    // Ensure heartbeat table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_agent_heartbeats (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        agent_id VARCHAR(100) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50),
        status VARCHAR(30) NOT NULL DEFAULT 'idle',
        current_task TEXT,
        current_target TEXT,
        message TEXT,
        progress_pct INTEGER DEFAULT 0,
        items_processed INTEGER DEFAULT 0,
        items_found INTEGER DEFAULT 0,
        items_matched INTEGER DEFAULT 0,
        errors_count INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, agent_id)
      )
    `)

    const body = await request.json()
    const {
      agentId, name, role, status, currentTask, currentTarget, message,
      progressPct, itemsProcessed, itemsFound, itemsMatched, errorsCount,
      startedAt, metadata
    } = body

    if (!agentId) {
      return NextResponse.json({ success: false, error: 'agentId requerido' }, { status: 400 })
    }

    // Upsert heartbeat
    await db.query(`
      INSERT INTO mi_agent_heartbeats (
        company_id, agent_id, name, role, status, current_task, current_target,
        message, progress_pct, items_processed, items_found, items_matched,
        errors_count, started_at, metadata, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      ON CONFLICT (company_id, agent_id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, mi_agent_heartbeats.name),
        role = COALESCE(EXCLUDED.role, mi_agent_heartbeats.role),
        status = EXCLUDED.status,
        current_task = EXCLUDED.current_task,
        current_target = EXCLUDED.current_target,
        message = EXCLUDED.message,
        progress_pct = EXCLUDED.progress_pct,
        items_processed = EXCLUDED.items_processed,
        items_found = EXCLUDED.items_found,
        items_matched = EXCLUDED.items_matched,
        errors_count = EXCLUDED.errors_count,
        started_at = COALESCE(EXCLUDED.started_at, mi_agent_heartbeats.started_at),
        metadata = COALESCE(EXCLUDED.metadata, mi_agent_heartbeats.metadata),
        updated_at = NOW()
    `, [
      auth.companyId, agentId, name || null, role || null,
      status || 'idle', currentTask || null, currentTarget || null,
      message || null, progressPct || 0,
      itemsProcessed || 0, itemsFound || 0, itemsMatched || 0, errorsCount || 0,
      startedAt || null, JSON.stringify(metadata || {})
    ])

    // Also ensure agent exists in mi_sales_agents
    await db.query(`
      INSERT INTO mi_sales_agents (company_id, agent_id, name, channel, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (company_id, agent_id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, mi_sales_agents.name),
        updated_at = NOW()
    `, [auth.companyId, agentId, name || agentId, role || 'research', JSON.stringify({ role: role || 'research' })])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[MI Heartbeat] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar heartbeat' }, { status: 500 })
  }
}
