import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyType?: string
}

/**
 * GET /api/market/chat/presence
 * Get presence status of company users
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    // Allow market companies (companyType might not be set)
    if (payload.companyType && payload.companyType !== 'market') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    // Get presence for all company users
    const result = await db.query(`
      SELECT
        p.user_id,
        p.status,
        p.custom_status,
        p.last_seen_at,
        COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.email) as name,
        u.email,
        CASE
          WHEN p.last_seen_at > NOW() - INTERVAL '2 minutes' THEN 'online'
          WHEN p.last_seen_at > NOW() - INTERVAL '5 minutes' THEN 'away'
          ELSE 'offline'
        END as computed_status
      FROM chat_presence p
      JOIN users u ON u.id = p.user_id
      WHERE p.company_id = $1
      ORDER BY
        CASE
          WHEN p.last_seen_at > NOW() - INTERVAL '2 minutes' THEN 0
          WHEN p.last_seen_at > NOW() - INTERVAL '5 minutes' THEN 1
          ELSE 2
        END,
        COALESCE(u.firstname, u.email) ASC
    `, [payload.companyId])

    const users = result.rows.map(p => ({
      userId: p.user_id,
      name: p.name || p.email,
      email: p.email,
      status: p.computed_status,
      customStatus: p.custom_status,
      lastSeenAt: p.last_seen_at
    }))

    return NextResponse.json({
      success: true,
      data: users
    })

  } catch (error) {
    console.error('[Chat Presence GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener presencia'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/chat/presence
 * Update user presence (heartbeat)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    // Allow market companies (companyType might not be set)
    if (payload.companyType && payload.companyType !== 'market') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { status = 'online', customStatus } = body

    // Upsert presence
    await db.query(`
      INSERT INTO chat_presence (user_id, company_id, status, custom_status, last_seen_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        status = $3,
        custom_status = COALESCE($4, chat_presence.custom_status),
        last_seen_at = NOW()
    `, [payload.userId, payload.companyId, status, customStatus || null])

    return NextResponse.json({
      success: true,
      data: { status, lastSeenAt: new Date().toISOString() }
    })

  } catch (error) {
    console.error('[Chat Presence POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar presencia'
    }, { status: 500 })
  }
}
