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

function periodToInterval(period: string): string {
  switch (period) {
    case '7d': return '7 days'
    case '30d': return '30 days'
    case '90d': return '90 days'
    case 'all': return '100 years'
    default: return '30 days'
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30d'
    const interval = periodToInterval(period)

    const [rankingResult, totalsResult] = await Promise.all([
      // Agent ranking
      db.query(`
        SELECT
          s.agent_id,
          a.name as agent_name,
          a.agent_id as agent_code,
          a.type as agent_type,
          COUNT(*) as total_sales,
          COALESCE(SUM(s.total_amount), 0) as total_amount,
          CASE WHEN COUNT(*) > 0
            THEN ROUND(COALESCE(SUM(s.total_amount), 0) / COUNT(*), 2)
            ELSE 0
          END as avg_order_value
        FROM mkt_agent_sales s
        JOIN mkt_agents a ON a.id = s.agent_id AND a.company_id = s.company_id
        WHERE s.company_id = $1 AND s.created_at >= NOW() - $2::INTERVAL
        GROUP BY s.agent_id, a.name, a.agent_id, a.type
        ORDER BY total_amount DESC
      `, [payload.companyId, interval]),

      // Overall totals
      db.query(`
        SELECT
          COUNT(*) as total_sales,
          COALESCE(SUM(total_amount), 0) as total_amount,
          CASE WHEN COUNT(*) > 0
            THEN ROUND(COALESCE(SUM(total_amount), 0) / COUNT(*), 2)
            ELSE 0
          END as avg_order_value
        FROM mkt_agent_sales
        WHERE company_id = $1 AND created_at >= NOW() - $2::INTERVAL
      `, [payload.companyId, interval])
    ])

    const ranking = rankingResult.rows.map((row, index) => ({
      rank: index + 1,
      agentId: row.agent_id,
      agentName: row.agent_name,
      agentCode: row.agent_code,
      agentType: row.agent_type,
      totalSales: parseInt(row.total_sales) || 0,
      totalAmount: parseFloat(row.total_amount) || 0,
      avgOrderValue: parseFloat(row.avg_order_value) || 0
    }))

    const totals = totalsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        period,
        totals: {
          totalSales: parseInt(totals.total_sales) || 0,
          totalAmount: parseFloat(totals.total_amount) || 0,
          avgOrderValue: parseFloat(totals.avg_order_value) || 0
        },
        ranking
      }
    })
  } catch (error) {
    console.error('[MKT Sales GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener ventas' }, { status: 500 })
  }
}
