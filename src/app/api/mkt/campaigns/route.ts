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
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const status = searchParams.get('status') || ''
    const offset = (page - 1) * limit

    const conditions: string[] = ['company_id = $1']
    const values: any[] = [payload.companyId]
    let paramIndex = 2

    if (status) {
      conditions.push(`status = $${paramIndex}`)
      values.push(status)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    const [dataResult, countResult] = await Promise.all([
      db.query(`
        SELECT id, name, description, type, status, channel_id, agent_id,
               objective, budget, start_date, end_date,
               created_by, approved_by, approved_at,
               created_at, updated_at
        FROM mkt_campaigns
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...values, limit, offset]),

      db.query(`
        SELECT COUNT(*) as count
        FROM mkt_campaigns
        WHERE ${whereClause}
      `, values)
    ])

    const total = parseInt(countResult.rows[0].count) || 0

    return NextResponse.json({
      success: true,
      data: {
        campaigns: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('[MKT Campaigns GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener campañas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { name, description, type, channelId, agentId, objective, budget, startDate, endDate } = body

    if (!name || !type) {
      return NextResponse.json({ success: false, error: 'name y type son requeridos' }, { status: 400 })
    }

    const result = await db.query(`
      INSERT INTO mkt_campaigns (company_id, name, description, type, status, target_channels, discount_type, discount_value, start_date, end_date)
      VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9)
      RETURNING id, name, description, type, status, start_date, end_date, created_at
    `, [
      payload.companyId,
      name,
      description || null,
      type,
      JSON.stringify(body.targetChannels || []),
      body.discountType || null,
      body.discountValue || null,
      body.startDate || null,
      body.endDate || null
    ])

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error('[MKT Campaigns POST]', error)
    return NextResponse.json({ success: false, error: 'Error al crear campaña' }, { status: 500 })
  }
}
