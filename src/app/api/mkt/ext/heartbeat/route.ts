import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function POST(request: NextRequest) {
  const auth = await validateAgentToken(request)
  if (!auth.valid) return NextResponse.json({ success: false, error: auth.error }, { status: 401 })

  try {
    const body = await request.json()
    const { status, action, target, progress, itemsProcessed, itemsFound, metadata } = body

    if (!status) {
      return NextResponse.json({ success: false, error: 'status es requerido' }, { status: 400 })
    }

    // Upsert into mkt_agent_activity
    await db.query(`
      INSERT INTO mkt_agent_activity (company_id, agent_id, type, status, action, target, metadata, created_at)
      VALUES ($1, $2, 'heartbeat', $3, $4, $5, $6, NOW())
    `, [
      auth.companyId,
      auth.agentId,
      status,
      action || null,
      target || null,
      JSON.stringify({
        ...(metadata || {}),
        progress: progress || null,
        itemsProcessed: itemsProcessed || 0,
        itemsFound: itemsFound || 0,
      })
    ])

    // Update agent online status + stats
    const statsUpdate: Record<string, any> = {}
    if (typeof itemsProcessed === 'number') statsUpdate.lastItemsProcessed = itemsProcessed
    if (typeof itemsFound === 'number') statsUpdate.lastItemsFound = itemsFound
    if (progress !== undefined) statsUpdate.lastProgress = progress

    await db.query(`
      UPDATE mkt_agents
      SET is_online = true,
          last_heartbeat_at = NOW(),
          current_status = $2,
          current_action = $3,
          stats = COALESCE(stats, '{}'::jsonb) || $4::jsonb,
          updated_at = NOW()
      WHERE agent_id = $1 AND company_id = $5
    `, [
      auth.agentId,
      status,
      action || null,
      JSON.stringify(statsUpdate),
      auth.companyId
    ])

    return NextResponse.json({ success: true, data: { received: true } })
  } catch (error: any) {
    console.error('[MKT Ext] Heartbeat error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar heartbeat' }, { status: 500 })
  }
}
