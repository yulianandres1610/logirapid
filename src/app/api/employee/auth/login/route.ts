import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

/**
 * POST /api/employee/auth/login
 * Employee login with email and password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email y contraseña requeridos'
      }, { status: 400 })
    }

    // Find user and employee record
    const result = await db.query(`
      SELECT
        u.id as user_id,
        u.email,
        u.password,
        u.firstname,
        u.lastname,
        u.role,
        e.id as employee_id,
        e.employee_code,
        e.company_id,
        e.status as employee_status,
        e.pay_type,
        e.pay_rate,
        e.currency,
        e.commission_rate,
        c.name as company_name
      FROM users u
      JOIN market_employees e ON u.id = e.user_id
      JOIN companies c ON e.company_id = c.id
      WHERE u.email = $1
    `, [email.toLowerCase()])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Credenciales inválidas'
      }, { status: 401 })
    }

    const user = result.rows[0]

    // Check if employee is active
    if (user.employee_status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'Tu cuenta de empleado está inactiva'
      }, { status: 403 })
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json({
        success: false,
        error: 'Credenciales inválidas'
      }, { status: 401 })
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
    const token = jwt.sign(
      {
        type: 'employee',
        userId: user.user_id,
        employeeId: user.employee_id,
        employeeCode: user.employee_code,
        email: user.email,
        companyId: user.company_id,
        companyName: user.company_name,
        role: user.role
      },
      secret,
      { expiresIn: '24h' }
    )

    console.log('[Employee Auth] Login successful:', user.employee_code)

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      data: {
        employeeId: user.employee_id,
        employeeCode: user.employee_code,
        email: user.email,
        firstName: user.firstname,
        lastName: user.lastname,
        fullName: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email,
        companyName: user.company_name,
        role: user.role,
        payType: user.pay_type,
        payRate: parseFloat(user.pay_rate),
        currency: user.currency,
        commissionRate: parseFloat(user.commission_rate) || 0
      },
      message: 'Inicio de sesión exitoso'
    })

    // Set cookie
    response.cookies.set('employee-auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400, // 24 hours
      path: '/'
    })

    return response

  } catch (error) {
    console.error('[Employee Auth] Login error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al iniciar sesión'
    }, { status: 500 })
  }
}
