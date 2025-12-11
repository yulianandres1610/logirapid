import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { verifyPassword } from '@/lib/auth'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/auth/verify-password
 *
 * Verifies the current user's password.
 * Used for security confirmation before sensitive operations (e.g., accessing wallet).
 *
 * Body: { password: string }
 * Returns: { success: boolean, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Decode JWT to get user info
    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const { userId } = payload

    // Get password from request body
    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Contrasena requerida'
      }, { status: 400 })
    }

    // Get user's password hash from database
    const userResult = await db.query(`
      SELECT password
      FROM users
      WHERE id = $1
    `, [userId])

    if (userResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado'
      }, { status: 404 })
    }

    const hashedPassword = userResult.rows[0].password

    if (!hashedPassword) {
      return NextResponse.json({
        success: false,
        error: 'Usuario sin contrasena configurada'
      }, { status: 400 })
    }

    // Verify password
    const isValid = await verifyPassword(password, hashedPassword)

    if (!isValid) {
      return NextResponse.json({
        success: false,
        error: 'Contrasena incorrecta'
      }, { status: 401 })
    }

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('Error verifying password:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar contrasena'
    }, { status: 500 })
  }
}
