import { NextRequest, NextResponse } from 'next/server'
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
 * GET /api/marketing-intel/agent-rankings
 * Sales agent leaderboard
 * Query: ?period=30d (7d, 30d, 90d, all)
 */
export async function GET(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'

    let interval = "30 days"
    if (period === '7d') interval = '7 days'
    else if (period === '90d') interval = '90 days'
    else if (period === 'all') interval = '3650 days'

    const result = await db.query(`
      SELECT
        a.agent_id, a.name, a.channel, a.status, a.metadata,
        COUNT(s.id) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(AVG(s.total_amount), 0) as avg_order_value,
        COALESCE(SUM(s.items_count), 0) as total_items_sold,
        MIN(s.sale_at) as first_sale,
        MAX(s.sale_at) as last_sale
      FROM mi_sales_agents a
      LEFT JOIN mi_agent_sales s ON a.company_id = s.company_id AND a.agent_id = s.agent_id
        AND s.sale_at >= NOW() - $2::interval AND s.status = 'completed'
      WHERE a.company_id = $1
      GROUP BY a.agent_id, a.name, a.channel, a.status, a.metadata
      ORDER BY total_revenue DESC
    `, [payload.companyId, interval])

    return NextResponse.json({
      success: true,
      data: result.rows.map((r, i) => ({
        rank: i + 1,
        agentId: r.agent_id,
        name: r.name,
        channel: r.channel,
        status: r.status,
        totalSales: parseInt(r.total_sales) || 0,
        totalRevenue: parseFloat(r.total_revenue) || 0,
        avgOrderValue: parseFloat(r.avg_order_value) || 0,
        totalItemsSold: parseInt(r.total_items_sold) || 0,
        firstSale: r.first_sale,
        lastSale: r.last_sale
      })),
      period
    })
  } catch (error) {
    console.error('[MI Agent Rankings] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener rankings' }, { status: 500 })
  }
}
