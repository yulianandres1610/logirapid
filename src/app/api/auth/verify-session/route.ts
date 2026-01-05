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

    // Verificar que el usuario existe en la base de datos
    const result = await db.query(
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
    if (!user.isactive || user.status !== 'active') {
      console.error('[VERIFY SESSION] Usuario inactivo:', payload.userId, payload.email)
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
