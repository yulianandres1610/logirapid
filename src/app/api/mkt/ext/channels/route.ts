import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function GET(request: NextRequest) {
  const auth = await validateAgentToken(request)
  if (!auth.valid) return NextResponse.json({ success: false, error: auth.error }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const purpose = searchParams.get('purpose')

    const conditions: string[] = ['company_id = $1', "status = 'active'"]
    const params: any[] = [auth.companyId]
    let idx = 2

    if (purpose) {
      // Accept aliases: research/investigation are the same, all/general are the same
      const purposeAliases: Record<string, string[]> = {
        research: ['research', 'investigation'],
        investigation: ['research', 'investigation'],
        all: ['all', 'general'],
        general: ['all', 'general']
      }
      const purposes = purposeAliases[purpose] || [purpose]
      conditions.push(`purpose = ANY($${idx}::text[])`)
      params.push(purposes)
      idx++
    }

    const result = await db.query(`
      SELECT id, platform, name, identifier, purpose, assigned_agent_id, member_count, status, last_activity_at, metadata, created_at
      FROM mkt_channels
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
    `, params)

    const channels = result.rows.map((ch: any) => ({
      id: ch.id,
      platform: ch.platform,
      name: ch.name,
      identifier: ch.identifier,
      purpose: ch.purpose,
      assignedAgentId: ch.assigned_agent_id,
      assignedToMe: ch.assigned_agent_id === auth.agentId || !ch.assigned_agent_id,
      memberCount: ch.member_count || 0,
      status: ch.status,
      lastActivityAt: ch.last_activity_at,
      createdAt: ch.created_at
    }))

    return NextResponse.json({
      success: true,
      data: { channels }
    })
  } catch (error: any) {
    console.error('[MKT Ext] Channels error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener canales' }, { status: 500 })
  }
}
