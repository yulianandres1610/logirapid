import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function GET(request: NextRequest) {
  // Allow both JWT and agent token auth
  const agentAuth = await validateAgentToken(request)

  if (!agentAuth.valid) {
    return NextResponse.json({ success: false, error: agentAuth.error }, { status: 401 })
  }

  try {
    const companyId = agentAuth.companyId

    const [agentsResult, channelsResult, channelsAllResult] = await Promise.all([
      db.query(`
        SELECT id, agent_id, name, type, status, is_online, company_id
        FROM mkt_agents WHERE company_id = $1
      `, [companyId]),

      db.query(`
        SELECT id, name, platform, identifier, purpose, assigned_agent_id, status, company_id
        FROM mkt_channels WHERE company_id = $1
      `, [companyId]),

      // Also check ALL channels without company filter to see if they exist elsewhere
      db.query(`
        SELECT id, name, platform, company_id, status, assigned_agent_id
        FROM mkt_channels ORDER BY id DESC LIMIT 20
      `)
    ])

    return NextResponse.json({
      success: true,
      debug: {
        authenticatedAs: {
          agentId: agentAuth.agentId,
          companyId: agentAuth.companyId,
          agentType: agentAuth.agentType
        },
        agentsForCompany: agentsResult.rows,
        channelsForCompany: channelsResult.rows,
        allRecentChannels: channelsAllResult.rows
      }
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
