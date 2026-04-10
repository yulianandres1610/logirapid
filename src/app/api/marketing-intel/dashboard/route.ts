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

/**
 * GET /api/marketing-intel/dashboard
 * Aggregated stats for the marketing intelligence dashboard
 */
export async function GET() {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const cid = payload.companyId

  try {
    // Products tracked (with competitor prices)
    const trackedRes = await db.query(
      'SELECT COUNT(DISTINCT product_id) as count FROM mi_competitor_prices WHERE company_id = $1 AND product_id IS NOT NULL', [cid]
    )

    // Price positioning: cheaper vs same vs expensive
    const positionRes = await db.query(`
      WITH latest_prices AS (
        SELECT DISTINCT ON (product_id, competitor_id)
          product_id, price_diff_percent
        FROM mi_competitor_prices
        WHERE company_id = $1 AND product_id IS NOT NULL AND price_diff_percent IS NOT NULL
        ORDER BY product_id, competitor_id, captured_at DESC
      )
      SELECT
        COUNT(*) FILTER (WHERE price_diff_percent < -5) as cheaper,
        COUNT(*) FILTER (WHERE price_diff_percent BETWEEN -5 AND 5) as same,
        COUNT(*) FILTER (WHERE price_diff_percent > 5) as more_expensive,
        COUNT(*) as total
      FROM latest_prices
    `, [cid])

    // Active campaigns
    const campaignsRes = await db.query(
      "SELECT COUNT(*) as count FROM mi_campaigns WHERE company_id = $1 AND status = 'active'", [cid]
    )

    // Top agent (last 30 days)
    const topAgentRes = await db.query(`
      SELECT a.name, a.agent_id, a.channel, SUM(s.total_amount) as revenue, COUNT(s.id) as sales
      FROM mi_agent_sales s
      JOIN mi_sales_agents a ON a.company_id = s.company_id AND a.agent_id = s.agent_id
      WHERE s.company_id = $1 AND s.sale_at >= NOW() - INTERVAL '30 days'
      GROUP BY a.name, a.agent_id, a.channel
      ORDER BY revenue DESC LIMIT 1
    `, [cid])

    // Pending suggestions
    const suggestionsRes = await db.query(
      "SELECT COUNT(*) as count FROM mi_suggestions WHERE company_id = $1 AND status = 'pending'", [cid]
    )

    // Total agent revenue (last 30 days)
    const agentRevenueRes = await db.query(
      'SELECT COALESCE(SUM(total_amount), 0) as total FROM mi_agent_sales WHERE company_id = $1 AND sale_at >= NOW() - INTERVAL \'30 days\'', [cid]
    )

    // Competitors count
    const competitorsRes = await db.query(
      'SELECT COUNT(*) as count FROM mi_competitors WHERE company_id = $1 AND is_active = true', [cid]
    )

    // Recent price captures (last 7 days)
    const recentRes = await db.query(
      'SELECT COUNT(*) as count FROM mi_competitor_prices WHERE company_id = $1 AND captured_at >= NOW() - INTERVAL \'7 days\'', [cid]
    )

    const pos = positionRes.rows[0] || {}

    return NextResponse.json({
      success: true,
      data: {
        productsTracked: parseInt(trackedRes.rows[0]?.count) || 0,
        competitors: parseInt(competitorsRes.rows[0]?.count) || 0,
        recentCaptures: parseInt(recentRes.rows[0]?.count) || 0,
        pricePosition: {
          cheaper: parseInt(pos.cheaper) || 0,
          same: parseInt(pos.same) || 0,
          moreExpensive: parseInt(pos.more_expensive) || 0,
          total: parseInt(pos.total) || 0
        },
        activeCampaigns: parseInt(campaignsRes.rows[0]?.count) || 0,
        pendingSuggestions: parseInt(suggestionsRes.rows[0]?.count) || 0,
        agentRevenue30d: parseFloat(agentRevenueRes.rows[0]?.total) || 0,
        topAgent: topAgentRes.rows[0] ? {
          name: topAgentRes.rows[0].name,
          agentId: topAgentRes.rows[0].agent_id,
          channel: topAgentRes.rows[0].channel,
          revenue: parseFloat(topAgentRes.rows[0].revenue) || 0,
          sales: parseInt(topAgentRes.rows[0].sales) || 0
        } : null
      }
    })
  } catch (error) {
    console.error('[MI Dashboard] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al cargar dashboard' }, { status: 500 })
  }
}
