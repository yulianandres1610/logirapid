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

    // Return authenticated user
    return NextResponse.json({
      success: true,
      data: {
        user: userWithoutPassword
      }
    })

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
