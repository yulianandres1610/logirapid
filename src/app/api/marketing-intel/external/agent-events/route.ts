import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * POST /api/marketing-intel/external/agent-events
 * Log granular agent events for activity trace.
 * Body: {
 *   events: [{
 *     agentId: string,
 *     type: 'scrape_start' | 'scrape_end' | 'product_found' | 'product_matched' | 'price_compared' |
 *            'suggestion_created' | 'sale_started' | 'sale_completed' | 'campaign_created' |
 *            'error' | 'warning' | 'info' | 'batch_start' | 'batch_end',
 *     level: 'info' | 'warning' | 'error' | 'success',
 *     text: string,              -- "Encontrado: Arroz Guyanes 2Kg a $2.30 en ISASUR"
 *     target?: string,           -- "isasur.com" or "Categoría Alimentos"
 *     url?: string,              -- Source URL if applicable
 *     productId?: number,        -- Our product ID if matched
 *     productName?: string,      -- Product name
 *     timestamp?: string,        -- ISO timestamp (defaults to NOW)
 *     metadata?: object
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    // Ensure events table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_agent_events (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        agent_id VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        level VARCHAR(20) DEFAULT 'info',
        text TEXT NOT NULL,
        target VARCHAR(500),
        url TEXT,
        product_id INTEGER,
        product_name VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    try {
      await db.query('CREATE INDEX IF NOT EXISTS idx_mi_events_company ON mi_agent_events(company_id, created_at DESC)')
      await db.query('CREATE INDEX IF NOT EXISTS idx_mi_events_agent ON mi_agent_events(company_id, agent_id, created_at DESC)')
    } catch { /* ignore */ }

    const body = await request.json()
    const { events } = body

    if (!Array.isArray(events) || events.length === 0) {
      // Single event shorthand
      if (body.agentId && body.text) {
        await db.query(`
          INSERT INTO mi_agent_events (company_id, agent_id, type, level, text, target, url, product_id, product_name, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamp, NOW()))
        `, [
          auth.companyId, body.agentId, body.type || 'info', body.level || 'info',
          body.text, body.target || null, body.url || null,
          body.productId || null, body.productName || null,
          JSON.stringify(body.metadata || {}), body.timestamp || null
        ])
        return NextResponse.json({ success: true, data: { inserted: 1 } })
      }
      return NextResponse.json({ success: false, error: 'events array o evento individual requerido' }, { status: 400 })
    }

    let inserted = 0
    for (const evt of events) {
      if (!evt.agentId || !evt.text) continue
      await db.query(`
        INSERT INTO mi_agent_events (company_id, agent_id, type, level, text, target, url, product_id, product_name, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamp, NOW()))
      `, [
        auth.companyId, evt.agentId, evt.type || 'info', evt.level || 'info',
        evt.text, evt.target || null, evt.url || null,
        evt.productId || null, evt.productName || null,
        JSON.stringify(evt.metadata || {}), evt.timestamp || null
      ])
      inserted++
    }

    // Cleanup: keep only last 7 days of events
    try {
      await db.query("DELETE FROM mi_agent_events WHERE company_id = $1 AND created_at < NOW() - INTERVAL '7 days'", [auth.companyId])
    } catch { /* ignore */ }

    return NextResponse.json({ success: true, data: { inserted, total: events.length } })
  } catch (error) {
    console.error('[MI Agent Events] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar eventos' }, { status: 500 })
  }
}
