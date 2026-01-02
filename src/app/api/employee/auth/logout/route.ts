import { NextResponse } from 'next/server'

/**
 * POST /api/employee/auth/logout
 * Employee logout
 */
export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Sesión cerrada exitosamente'
  })

  // Clear the cookie
  response.cookies.set('employee-auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })

  return response
}
