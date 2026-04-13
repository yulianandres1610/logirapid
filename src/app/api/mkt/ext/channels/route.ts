import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function GET(request: NextRequest) {
  const auth = await validateAgentToken(request)
  if (!auth.valid) return NextResponse.json({ success: false, error: auth.error }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const purpose = searchParams.get('purpose')

    const conditions: string[] = [
      'company_id = $1',
      '(assigned_agent_id = $2 OR assigned_agent_id IS NULL)'
    ]
    const params: any[] = [auth.companyId, auth.agentId]
    let idx = 3

    if (purpose) {
      conditions.push(`purpose = $${idx}`)
      params.push(purpose)
      idx++
    }

    const result = await db.query(`
      SELECT
        id,
        name,
        platform,
        channel_type AS "channelType",
        purpose,
        config,
        assigned_agent_id AS "assignedAgentId",
        is_active AS "isActive",
        created_at AS "createdAt"
      FROM mkt_channels
      WHERE ${conditions.join(' AND ')}
        AND is_active = true
      ORDER BY name ASC
    `, params)

    // Parse config JSON
    const channels = result.rows.map((ch: any) => {
      if (typeof ch.config === 'string') {
        try { ch.config = JSON.parse(ch.config) } catch { /* keep as string */ }
      }
      return ch
    })

    return NextResponse.json({
      success: true,
      data: { channels }
    })
  } catch (error: any) {
    console.error('[MKT Ext] Channels error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener canales' }, { status: 500 })
  }
}
