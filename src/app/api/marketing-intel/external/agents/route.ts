import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * GET /api/marketing-intel/external/agents
 * List all registered agents for this company.
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    const result = await db.query(`
      SELECT agent_id, name, channel, status, total_sales, total_orders, avg_order_value, metadata, created_at, updated_at
      FROM mi_sales_agents
      WHERE company_id = $1
      ORDER BY total_sales DESC
    `, [auth.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map(a => ({
        agentId: a.agent_id,
        name: a.name,
        channel: a.channel,
        status: a.status,
        totalSales: parseFloat(a.total_sales) || 0,
        totalOrders: parseInt(a.total_orders) || 0,
        avgOrderValue: parseFloat(a.avg_order_value) || 0,
        metadata: a.metadata || {},
        createdAt: a.created_at,
        updatedAt: a.updated_at
      }))
    })
  } catch (error) {
    console.error('[MI External Agents GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener agentes' }, { status: 500 })
  }
}

/**
 * POST /api/marketing-intel/external/agents
 * Register or update AI agents (sales agents, research agents, campaign agents).
 * Body: {
 *   agents: [{
 *     agentId: string,        -- Unique identifier for this agent
 *     name: string,           -- Display name
 *     channel: string,        -- 'whatsapp', 'web', 'voice', 'research', 'campaign'
 *     role: string,           -- 'sales', 'research', 'campaign', 'analyst'
 *     capabilities: string[], -- ['sell', 'price_research', 'campaign_design', 'script_writing']
 *     description?: string,
 *     model?: string,         -- AI model used (e.g., 'gpt-4', 'claude-3')
 *     config?: object         -- Agent-specific configuration
 *   }]
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { agents } = body

    if (!Array.isArray(agents) || agents.length === 0) {
      return NextResponse.json({ success: false, error: 'agents array requerido' }, { status: 400 })
    }

    let created = 0
    let updated = 0

    for (const agent of agents) {
      if (!agent.agentId || !agent.name) continue

      const metadata = {
        role: agent.role || 'sales',
        capabilities: agent.capabilities || [],
        description: agent.description || null,
        model: agent.model || null,
        config: agent.config || {},
        registeredBy: auth.agentType || 'openclaw'
      }

      const existing = await db.query(
        'SELECT id FROM mi_sales_agents WHERE company_id = $1 AND agent_id = $2',
        [auth.companyId, agent.agentId]
      )

      if (existing.rows.length > 0) {
        await db.query(`
          UPDATE mi_sales_agents SET
            name = $1, channel = $2, metadata = $3, status = 'active', updated_at = NOW()
          WHERE company_id = $4 AND agent_id = $5
        `, [agent.name, agent.channel || 'whatsapp', JSON.stringify(metadata), auth.companyId, agent.agentId])
        updated++
      } else {
        await db.query(`
          INSERT INTO mi_sales_agents (company_id, agent_id, name, channel, metadata)
          VALUES ($1, $2, $3, $4, $5)
        `, [auth.companyId, agent.agentId, agent.name, agent.channel || 'whatsapp', JSON.stringify(metadata)])
        created++
      }
    }

    return NextResponse.json({
      success: true,
      data: { created, updated, total: agents.length },
      message: `${created} agentes creados, ${updated} actualizados`
    })
  } catch (error) {
    console.error('[MI External Agents POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al registrar agentes' }, { status: 500 })
  }
}
