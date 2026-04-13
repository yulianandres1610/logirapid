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

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const search = searchParams.get('search') || ''
    const platform = searchParams.get('platform') || ''
    const matchType = searchParams.get('matchType') || ''
    const offset = (page - 1) * limit

    const conditions: string[] = ['f.company_id = $1']
    const values: any[] = [payload.companyId]
    let paramIndex = 2

    if (search) {
      conditions.push(`(f.product_name ILIKE $${paramIndex} OR f.competitor_name ILIKE $${paramIndex})`)
      values.push(`%${search}%`)
      paramIndex++
    }

    if (platform) {
      conditions.push(`f.platform = $${paramIndex}`)
      values.push(platform)
      paramIndex++
    }

    if (matchType) {
      conditions.push(`f.match_type = $${paramIndex}`)
      values.push(matchType)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT f.id, f.product_id, f.product_name, f.our_price, f.competitor_price,
               f.competitor_name, f.platform, f.match_type, f.match_confidence,
               f.product_url, f.price_difference, f.price_difference_pct,
               f.agent_id, f.created_at,
               p.name as market_product_name, p.price as current_our_price
        FROM mkt_price_findings f
        LEFT JOIN mkt_market_products p ON p.id = f.product_id AND p.company_id = f.company_id
        WHERE ${whereClause}
        ORDER BY f.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...values, limit, offset]),

      db.query(`
        SELECT COUNT(*) as count
        FROM mkt_price_findings f
        WHERE ${whereClause}
      `, values)
    ])

    const total = parseInt(countResult.rows[0].count) || 0

    return NextResponse.json({
      success: true,
      data: {
        findings: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('[MKT Price Findings GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener hallazgos de precios' }, { status: 500 })
  }
}
