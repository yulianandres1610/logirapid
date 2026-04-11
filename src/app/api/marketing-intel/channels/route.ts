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

export async function GET() {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_channels (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        platform VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        identifier VARCHAR(500),
        description TEXT,
        member_count INTEGER DEFAULT 0,
        assigned_agent_id VARCHAR(100),
        channel_type VARCHAR(30) DEFAULT 'research',
        status VARCHAR(30) DEFAULT 'active',
        posts_count INTEGER DEFAULT 0,
        last_scraped_at TIMESTAMP,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)
    try {
      await db.query('CREATE INDEX IF NOT EXISTS idx_mi_channels_company ON mi_channels(company_id)')
      await db.query('CREATE INDEX IF NOT EXISTS idx_mi_channels_platform ON mi_channels(company_id, platform)')
    } catch { /* ignore */ }

    const result = await db.query(`
      SELECT c.*, sa.name as agent_name
      FROM mi_channels c
      LEFT JOIN mi_sales_agents sa ON sa.company_id = c.company_id AND sa.agent_id = c.assigned_agent_id
      WHERE c.company_id = $1 AND c.status != 'removed'
      ORDER BY c.platform ASC, c.name ASC
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map(ch => ({
        id: ch.id,
        platform: ch.platform,
        name: ch.name,
        identifier: ch.identifier,
        description: ch.description,
        memberCount: ch.member_count || 0,
        assignedAgentId: ch.assigned_agent_id,
        assignedAgentName: ch.agent_name || null,
        channelType: ch.channel_type,
        status: ch.status,
        postsCount: ch.posts_count || 0,
        lastScrapedAt: ch.last_scraped_at,
        createdAt: ch.created_at
      }))
    })
  } catch (error) {
    console.error('[MI Channels GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener canales' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const body = await request.json()
    const { platform, name, identifier, description, memberCount, assignedAgentId, channelType, status } = body

    if (!platform || !name) {
      return NextResponse.json({ success: false, error: 'platform y name requeridos' }, { status: 400 })
    }

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_channels (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        platform VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        identifier VARCHAR(500),
        description TEXT,
        member_count INTEGER DEFAULT 0,
        assigned_agent_id VARCHAR(100),
        channel_type VARCHAR(30) DEFAULT 'research',
        status VARCHAR(30) DEFAULT 'active',
        posts_count INTEGER DEFAULT 0,
        last_scraped_at TIMESTAMP,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    const result = await db.query(`
      INSERT INTO mi_channels (
        company_id, platform, name, identifier, description,
        member_count, assigned_agent_id, channel_type, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      payload.companyId, platform, name, identifier || null,
      description || null, memberCount || 0,
      assignedAgentId || null, channelType || 'research',
      status || 'active', payload.userId
    ])

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Canal creado'
    })
  } catch (error) {
    console.error('[MI Channels POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear canal' }, { status: 500 })
  }
}
