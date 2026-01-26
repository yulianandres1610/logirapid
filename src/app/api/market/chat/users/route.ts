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
 * GET /api/market/chat/users
 * Get all users in the company for creating conversations
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

    if (payload.companyType !== 'market') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const excludeCurrentUser = searchParams.get('excludeSelf') !== 'false'

    // Build query dynamically to handle optional parameters
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    let whereClause = `WHERE (u.status IS NULL OR u.status != 'inactive')`

    if (excludeCurrentUser) {
      whereClause += ` AND u.id != $${paramIndex}`
      params.push(payload.userId)
      paramIndex++
    }

    if (search) {
      whereClause += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`
      params.push(`%${search}%`)
    }

    // Get all users in the company
    const result = await db.query(`
      SELECT
        u.id,
        u.name,
        u.email,
        uc.role,
        COALESCE(p.status, 'offline') as presence_status,
        CASE
          WHEN p.last_seen_at > NOW() - INTERVAL '2 minutes' THEN 'online'
          WHEN p.last_seen_at > NOW() - INTERVAL '5 minutes' THEN 'away'
          ELSE 'offline'
        END as computed_status,
        p.last_seen_at
      FROM users u
      JOIN user_companies uc ON uc.user_id = u.id AND uc.company_id = $1
      LEFT JOIN chat_presence p ON p.user_id = u.id
      ${whereClause}
      ORDER BY
        CASE
          WHEN p.last_seen_at > NOW() - INTERVAL '2 minutes' THEN 0
          WHEN p.last_seen_at > NOW() - INTERVAL '5 minutes' THEN 1
          ELSE 2
        END,
        u.name ASC
    `, params)

    const users = result.rows.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      presence: {
        status: u.computed_status || 'offline',
        lastSeenAt: u.last_seen_at
      }
    }))

    return NextResponse.json({
      success: true,
      data: users
    })

  } catch (error) {
    console.error('[Chat Users GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener usuarios'
    }, { status: 500 })
  }
}
