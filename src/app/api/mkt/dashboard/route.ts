import { NextResponse } from 'next/server'
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

export async function GET() {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const companyId = payload.companyId

    // Run all queries in parallel
    const [
      agentsResult,
      findingsResult,
      campaignsResult,
      salesResult,
      productsResult,
      positioningResult
    ] = await Promise.all([
      // Total agents (online/offline)
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'active') as total,
          COUNT(*) FILTER (WHERE status = 'active' AND is_online = true) as online,
          COUNT(*) FILTER (WHERE status = 'active' AND is_online = false) as offline
        FROM mkt_agents
        WHERE company_id = $1 AND status != 'deleted'
      `, [companyId]),

      // Price findings count (last 7 days)
      db.query(`
        SELECT COUNT(*) as count
        FROM mkt_price_findings
        WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
      `, [companyId]),

      // Active campaigns
      db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'completed') as completed
        FROM mkt_campaigns
        WHERE company_id = $1
      `, [companyId]),

      // Agent sales (last 30 days)
      db.query(`
        SELECT
          COALESCE(SUM(total_amount), 0) as total_amount,
          COUNT(*) as total_sales
        FROM mkt_agent_sales
        WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      `, [companyId]),

      // Products tracked (distinct product_id in findings)
      db.query(`
        SELECT COUNT(DISTINCT product_id) as count
        FROM mkt_price_findings
        WHERE company_id = $1
      `, [companyId]),

      // Price positioning (cheaper/same/expensive counts)
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE match_type = 'cheaper') as cheaper,
          COUNT(*) FILTER (WHERE match_type = 'same') as same,
          COUNT(*) FILTER (WHERE match_type = 'expensive') as expensive
        FROM mkt_price_findings
        WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
      `, [companyId])
    ])

    const agents = agentsResult.rows[0]
    const findings = findingsResult.rows[0]
    const campaigns = campaignsResult.rows[0]
    const sales = salesResult.rows[0]
    const products = productsResult.rows[0]
    const positioning = positioningResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        agents: {
          total: parseInt(agents.total) || 0,
          online: parseInt(agents.online) || 0,
          offline: parseInt(agents.offline) || 0
        },
        priceFindings: {
          last7Days: parseInt(findings.count) || 0,
          productsTracked: parseInt(products.count) || 0
        },
        campaigns: {
          total: parseInt(campaigns.total) || 0,
          active: parseInt(campaigns.active) || 0,
          pending: parseInt(campaigns.pending) || 0,
          completed: parseInt(campaigns.completed) || 0
        },
        sales: {
          totalAmount: parseFloat(sales.total_amount) || 0,
          totalSales: parseInt(sales.total_sales) || 0,
          period: '30d'
        },
        pricePositioning: {
          cheaper: parseInt(positioning.cheaper) || 0,
          same: parseInt(positioning.same) || 0,
          expensive: parseInt(positioning.expensive) || 0
        }
      }
    })
  } catch (error) {
    console.error('[MKT Dashboard GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener estadísticas' }, { status: 500 })
  }
}
