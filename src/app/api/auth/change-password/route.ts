import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

/**
 * POST /api/auth/change-password
 * Change user password (requires current password verification)
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const userId = payload.userId

    // Get request body
    const body = await request.json()
    const { currentPassword, newPassword } = body

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return NextResponse.json({
        success: false,
        error: 'Contraseña actual y nueva son requeridas'
      }, { status: 400 })
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return NextResponse.json({
        success: false,
        error: 'La nueva contraseña debe tener al menos 6 caracteres'
      }, { status: 400 })
    }

    // Get current password hash from DB
    const userResult = await db.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    )

    if (userResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado'
      }, { status: 404 })
    }

    const currentPasswordHash = userResult.rows[0].password

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, currentPasswordHash)
    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: 'La contraseña actual es incorrecta'
      }, { status: 400 })
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // Update password in DB
    await db.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [newPasswordHash, userId]
    )

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    })

  } catch (error) {
    console.error('[Change Password] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al cambiar contraseña'
    }, { status: 500 })
  }
}
