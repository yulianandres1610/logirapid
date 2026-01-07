import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId?: number
  companyName?: string
  companyType?: string
}

/**
 * GET /api/auth/me
 * Returns the current authenticated user's information
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No hay sesión activa'
      }, { status: 401 })
    }

    // Verify JWT
    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      console.error('[AUTH ME] JWT inválido:', error)
      return NextResponse.json({
        success: false,
        error: 'Token inválido o expirado'
      }, { status: 401 })
    }

    // Get user from database (with 30s cache)
    const cacheKey = `user_me_${payload.userId}`
    const result = await db.queryCached(cacheKey, `
      SELECT
        u.id,
        u.firstname as "firstName",
        u.lastname as "lastName",
        u.email,
        u.phone,
        u.role,
        u.status,
        u.isactive as "isActive",
        u.createdat as "createdAt",
        u.lastlogin as "lastLogin",
        uc.companyid as "companyId",
        c.legalname as "companyName",
        c.companytype as "companyType"
      FROM users u
      LEFT JOIN user_companies uc ON u.id = uc.userid
      LEFT JOIN companies c ON uc.companyid = c.id
      WHERE u.id = $1
      ORDER BY uc.createdat ASC
      LIMIT 1
    `, [payload.userId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado'
      }, { status: 404 })
    }

    const user = result.rows[0]

    // Check if user is active
    const isInactive = user.isActive === false
    const hasInactiveStatus = user.status !== null && user.status !== undefined && user.status !== 'active'

    if (isInactive || hasInactiveStatus) {
      return NextResponse.json({
        success: false,
        error: 'Usuario desactivado'
      }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        phone: user.phone,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName,
        companyType: user.companyType,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    })

  } catch (error) {
    console.error('[AUTH ME] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener información del usuario'
    }, { status: 500 })
  }
}
