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
 * GET /api/auth/verify-session
 * Verifica que el usuario del token JWT todavía existe en la base de datos
 * Esta es una medida de seguridad para invalidar sesiones de usuarios eliminados
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        valid: false,
        error: 'No hay sesión activa'
      }, { status: 401 })
    }

    // Verificar JWT
    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      console.error('[VERIFY SESSION] JWT inválido:', error)
      return NextResponse.json({
        valid: false,
        error: 'Token inválido o expirado'
      }, { status: 401 })
    }

    // Verificar que el usuario existe en la base de datos (con caché de 30s)
    const cacheKey = `user_session_${payload.userId}`
    const result = await db.queryCached(
      cacheKey,
      'SELECT id, email, status, isactive FROM users WHERE id = $1',
      [payload.userId]
    )

    if (result.rows.length === 0) {
      console.error('[VERIFY SESSION] Usuario no existe en BD:', payload.userId, payload.email)
      return NextResponse.json({
        valid: false,
        error: 'Usuario no encontrado',
        action: 'logout'
      }, { status: 401 })
    }

    const user = result.rows[0]

    // Verificar que el usuario está activo
    // Nota: isactive puede ser NULL o no existir, solo bloquear si explícitamente es false
    // status debe ser 'active' (si existe) o no estar definido/null
    const isInactive = user.isactive === false
    // Solo considerar inactivo si status existe Y es diferente de 'active'
    const hasInactiveStatus = user.status !== null && user.status !== undefined && user.status !== 'active'

    console.log('[VERIFY SESSION] User status check:', {
      userId: payload.userId,
      email: payload.email,
      isactive: user.isactive,
      status: user.status,
      isInactive,
      hasInactiveStatus
    })

    if (isInactive || hasInactiveStatus) {
      console.error('[VERIFY SESSION] Usuario inactivo:', payload.userId, payload.email, { isactive: user.isactive, status: user.status })
      return NextResponse.json({
        valid: false,
        error: 'Usuario desactivado',
        action: 'logout'
      }, { status: 401 })
    }

    // Sesión válida
    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email
      }
    })

  } catch (error) {
    console.error('[VERIFY SESSION] Error:', error)
    return NextResponse.json({
      valid: false,
      error: 'Error al verificar sesión'
    }, { status: 500 })
  }
}
