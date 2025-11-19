import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { verifyPassword } from '@/lib/auth'

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
    const body: LoginRequest = await request.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email y contraseña son requeridos'
        },
        { status: 400 }
      )
    }

    // Query user from database with company association
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

    // Check if user exists
    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Credenciales incorrectas'
        },
        { status: 401 }
      )
    }

    const user = result.rows[0]

    // Check if user is active
    if (!user.isActive || user.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: 'Usuario inactivo. Contacte al administrador.'
        },
        { status: 403 }
      )
    }

    // Verify password using bcrypt
    const isPasswordValid = await verifyPassword(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Credenciales incorrectas'
        },
        { status: 401 }
      )
    }

    // Update last login timestamp
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

    // Create response with cookies
    const response = NextResponse.json({
      success: true,
      user: userData
    })

    // Set authentication cookies
    const cookieOptions = {
      httpOnly: false, // Allow JavaScript access for client-side routing
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    }

    response.cookies.set('auth-token', 'authenticated', cookieOptions)
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

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al procesar la solicitud de inicio de sesión'
      },
      { status: 500 }
    )
  }
}
