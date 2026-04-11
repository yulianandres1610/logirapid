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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await params

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_campaign_assets (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        file_url TEXT,
        file_size INTEGER DEFAULT 0,
        platform VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    const result = await db.query(`
      SELECT * FROM mi_campaign_assets
      WHERE campaign_id = $1 AND company_id = $2
      ORDER BY created_at DESC
    `, [id, payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        fileUrl: a.file_url,
        fileSize: a.file_size || 0,
        platform: a.platform,
        notes: a.notes,
        createdAt: a.created_at
      }))
    })
  } catch (error) {
    console.error('[MI Campaign Assets GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener materiales' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  try {
    const { id } = await params
    const body = await request.json()
    const { type, name, fileUrl, fileSize, platform, notes } = body

    if (!type || !name) {
      return NextResponse.json({ success: false, error: 'type y name requeridos' }, { status: 400 })
    }

    // Verify campaign belongs to company
    const campaign = await db.query(
      'SELECT id FROM mi_campaigns WHERE id = $1 AND company_id = $2',
      [id, payload.companyId]
    )
    if (campaign.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Campana no encontrada' }, { status: 404 })
    }

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS mi_campaign_assets (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        file_url TEXT,
        file_size INTEGER DEFAULT 0,
        platform VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    const result = await db.query(`
      INSERT INTO mi_campaign_assets (campaign_id, company_id, type, name, file_url, file_size, platform, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [id, payload.companyId, type, name, fileUrl || null, fileSize || 0, platform || null, notes || null])

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Material creado'
    })
  } catch (error) {
    console.error('[MI Campaign Assets POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear material' }, { status: 500 })
  }
}
