import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { verifyPassword } from '@/lib/auth'
import jwt from 'jsonwebtoken'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

interface LoginRequest {
  email: string
  password: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('[LOGIN] Iniciando proceso de login...')

    const body: LoginRequest = await request.json()
    const { email, password } = body

    console.log('[LOGIN] Email recibido:', email)

    // Validate required fields
    if (!email || !password) {
      console.log('[LOGIN] Error: Campos requeridos faltantes')
      return NextResponse.json(
        {
          success: false,
          error: 'Email y contraseña son requeridos'
        },
        { status: 400 }
      )
    }

    // Query user from database with company association
    console.log('[LOGIN] Consultando base de datos...')
    const query = `
      SELECT
        u.id,
        u.firstname as "firstName",
        u.lastname as "lastName",
        u.email,
        u.phone,
        u.address,
        u.city,
        u.state,
        u.country,
        u.zipcode as "zipCode",
        u.apartment,
        u.role,
        u.password,
        u.status,
        u.isactive as "isActive",
        u.createdat as "createdAt",
        u.lastlogin as "lastLogin",
        uc.companyid as "companyId",
        c.legalname as "companyName"
      FROM users u
      LEFT JOIN user_companies uc ON u.id = uc.userid
      LEFT JOIN companies c ON uc.companyid = c.id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1
    `

    const result = await db.query(query, [email])
    console.log('[LOGIN] Usuarios encontrados:', result.rows.length)

    // Check if user exists
    if (result.rows.length === 0) {
      console.log('[LOGIN] Error: Usuario no encontrado')
      return NextResponse.json(
        {
          success: false,
          error: 'Credenciales incorrectas'
        },
        { status: 401 }
      )
    }

    const user = result.rows[0]
    console.log('[LOGIN] Usuario encontrado:', user.email, 'Role:', user.role)

    // Check if user is active
    if (!user.isActive || user.status !== 'active') {
      console.log('[LOGIN] Error: Usuario inactivo')
      return NextResponse.json(
        {
          success: false,
          error: 'Usuario inactivo. Contacte al administrador.'
        },
        { status: 403 }
      )
    }

    // Verify password using bcrypt
    console.log('[LOGIN] Verificando contraseña...')
    const isPasswordValid = await verifyPassword(password, user.password)
    console.log('[LOGIN] Contraseña válida:', isPasswordValid)

    if (!isPasswordValid) {
      console.log('[LOGIN] Error: Contraseña incorrecta')
      return NextResponse.json(
        {
          success: false,
          error: 'Credenciales incorrectas'
        },
        { status: 401 }
      )
    }

    // Update last login timestamp
    console.log('[LOGIN] Actualizando última conexión...')
    await db.query(
      'UPDATE users SET lastlogin = NOW() WHERE id = $1',
      [user.id]
    )

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    // Prepare user data for response
    const userData = {
      id: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      createdAt: user.createdAt,
      updatedAt: user.createdAt, // Use createdAt as fallback
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyName: user.companyName,
      },
      jwtSecret,
      { expiresIn: '7d' }
    )

    // Create response with cookies
    const response = NextResponse.json({
      success: true,
      user: userData,
      token // Include token in response for localStorage
    })

    // Set authentication cookies with domain for cross-subdomain support
    const cookieDomain = process.env.COOKIE_DOMAIN || (
      process.env.NODE_ENV === 'production' ? '.logirapid.com' : undefined
    )

    const cookieOptions = {
      httpOnly: false, // Allow JavaScript access for client-side routing
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      domain: cookieDomain,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    }

    response.cookies.set('auth-token', token, cookieOptions)
    response.cookies.set('user-id', user.id.toString(), cookieOptions)
    response.cookies.set('user-name', encodeURIComponent(userData.name), cookieOptions)
    response.cookies.set('user-email', encodeURIComponent(user.email), cookieOptions)
    response.cookies.set('user-role', user.role, cookieOptions)

    if (user.companyId) {
      response.cookies.set('user-company-id', user.companyId.toString(), cookieOptions)
    }

    if (user.companyName) {
      response.cookies.set('user-company-name', encodeURIComponent(user.companyName), cookieOptions)
    }

    console.log('[LOGIN] Login exitoso para:', user.email)
    return response

  } catch (error) {
    console.error('[LOGIN] Error crítico:', error)
    console.error('[LOGIN] Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[LOGIN] Error message:', error instanceof Error ? error.message : String(error))

    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar la solicitud de inicio de sesión',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
