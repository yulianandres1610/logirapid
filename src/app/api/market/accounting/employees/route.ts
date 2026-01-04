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
  companyName: string
}

/**
 * GET /api/market/accounting/employees
 * List all employees for the company
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

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

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const terminalId = searchParams.get('terminalId')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT
        e.id,
        e.user_id,
        e.employee_code,
        e.hire_date,
        e.termination_date,
        e.status,
        e.pay_type,
        e.pay_rate,
        e.currency,
        e.pos_badge_code,
        e.commission_rate,
        e.created_at,
        u.email,
        u.firstname,
        u.lastname,
        u.phone,
        u.role,
        CASE WHEN e.pos_pin IS NOT NULL THEN true ELSE false END as has_pin,
        (
          SELECT json_agg(json_build_object(
            'terminalId', et.terminal_id,
            'terminalName', t.name,
            'canOpenSession', et.can_open_session,
            'canCloseSession', et.can_close_session,
            'canVoidOrders', et.can_void_orders,
            'canGiveDiscount', et.can_give_discount,
            'canRefund', et.can_refund,
            'maxDiscountPercent', et.max_discount_percent
          ))
          FROM market_employee_terminals et
          JOIN market_pos_terminals t ON et.terminal_id = t.id
          WHERE et.employee_id = e.id
        ) as terminals
      FROM market_employees e
      JOIN users u ON e.user_id = u.id
      WHERE e.company_id = $1
    `
    const params: any[] = [companyId]
    let paramIndex = 2

    if (status && status !== 'all') {
      query += ` AND e.status = $${paramIndex++}`
      params.push(status)
    }

    if (terminalId) {
      query += ` AND EXISTS (
        SELECT 1 FROM market_employee_terminals et
        WHERE et.employee_id = e.id AND et.terminal_id = $${paramIndex++}
      )`
      params.push(parseInt(terminalId))
    }

    if (search) {
      query += ` AND (
        e.employee_code ILIKE $${paramIndex} OR
        u.email ILIKE $${paramIndex} OR
        u.firstname ILIKE $${paramIndex} OR
        u.lastname ILIKE $${paramIndex}
      )`
      params.push(`%${search}%`)
      paramIndex++
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM market_employees e WHERE e.company_id = $1`
    const countParams: any[] = [companyId]
    let countParamIndex = 2

    if (status && status !== 'all') {
      countQuery += ` AND e.status = $${countParamIndex++}`
      countParams.push(status)
    }

    const countResult = await db.query(countQuery, countParams)

    return NextResponse.json({
      success: true,
      data: {
        employees: result.rows.map(row => ({
          id: row.id,
          userId: row.user_id,
          employeeCode: row.employee_code,
          email: row.email,
          firstName: row.firstname,
          lastName: row.lastname,
          fullName: `${row.firstname || ''} ${row.lastname || ''}`.trim() || row.email,
          phone: row.phone,
          role: row.role,
          hireDate: row.hire_date,
          terminationDate: row.termination_date,
          status: row.status,
          payType: row.pay_type,
          payRate: parseFloat(row.pay_rate) || 0,
          currency: row.currency,
          hasPIN: row.has_pin,
          badgeCode: row.pos_badge_code,
          commissionRate: parseFloat(row.commission_rate) || 0,
          terminals: row.terminals || [],
          createdAt: row.created_at
        })),
        total: parseInt(countResult.rows[0].count)
      }
    })

  } catch (error) {
    console.error('[Employees API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener empleados'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/accounting/employees
 * Create a new employee
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

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

    const companyId = payload.companyId

    const body = await request.json()
    const {
      // User data
      email,
      password,
      firstName,
      lastName,
      phone,
      role, // MARKET_MANAGER, MARKET_COMERCIAL, MARKET_ALMACENERO, MARKET_VENDEDOR

      // Employee data
      hireDate,
      payType, // hourly, daily, monthly
      payRate,
      currency,
      commissionRate,
      posPin,
      badgeCode,

      // Terminals
      terminals // Array of { terminalId, permissions }
    } = body

    // Validate required fields
    if (!email || !password || !role || !payType || !payRate || !hireDate) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    // Validate role
    const validRoles = ['MARKET_MANAGER', 'MARKET_COMERCIAL', 'MARKET_ALMACENERO', 'MARKET_VENDEDOR']
    if (!validRoles.includes(role)) {
      return NextResponse.json({
        success: false,
        error: 'Rol inválido'
      }, { status: 400 })
    }

    // Check if email already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    if (existingUser.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'El email ya está registrado'
      }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate employee code
    const year = new Date().getFullYear()
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM market_employees WHERE company_id = $1',
      [companyId]
    )
    const count = parseInt(countResult.rows[0].count) + 1
    const employeeCode = `EMP-${year}-${String(count).padStart(4, '0')}`

    // Hash PIN if provided
    let hashedPin = null
    if (posPin) {
      if (posPin.length < 4 || posPin.length > 6) {
        return NextResponse.json({
          success: false,
          error: 'El PIN debe tener entre 4 y 6 dígitos'
        }, { status: 400 })
      }
      hashedPin = await bcrypt.hash(posPin, 10)
    }

    // Start transaction
    await db.query('BEGIN')

    try {
      // Create user
      const userResult = await db.query(`
        INSERT INTO users (
          email, password, firstname, lastname, phone,
          role, createdat
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `, [
        email.toLowerCase(),
        hashedPassword,
        firstName || null,
        lastName || null,
        phone || null,
        role
      ])

      const userId = userResult.rows[0].id

      // Associate user with company
      await db.query(`
        INSERT INTO user_companies (user_id, company_id, role, is_primary, created_at)
        VALUES ($1, $2, $3, true, NOW())
        ON CONFLICT (user_id, company_id) DO NOTHING
      `, [userId, companyId, role])

      // Create employee
      const employeeResult = await db.query(`
        INSERT INTO market_employees (
          user_id, company_id, employee_code, hire_date,
          pay_type, pay_rate, currency, commission_rate,
          pos_pin, pos_badge_code, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', NOW(), NOW())
        RETURNING id
      `, [
        userId,
        companyId,
        employeeCode,
        hireDate,
        payType,
        payRate,
        currency || 'USD',
        commissionRate || 0,
        hashedPin,
        badgeCode || null
      ])

      const employeeId = employeeResult.rows[0].id

      // Associate with terminals
      if (terminals && terminals.length > 0) {
        for (const t of terminals) {
          await db.query(`
            INSERT INTO market_employee_terminals (
              employee_id, terminal_id,
              can_open_session, can_close_session, can_void_orders,
              can_give_discount, can_refund, max_discount_percent,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `, [
            employeeId,
            t.terminalId,
            t.canOpenSession || false,
            t.canCloseSession || false,
            t.canVoidOrders || false,
            t.canGiveDiscount || false,
            t.canRefund || false,
            t.maxDiscountPercent || 0
          ])
        }
      }

      await db.query('COMMIT')

      console.log('[Employees API] Created employee:', employeeCode, 'User:', email)

      return NextResponse.json({
        success: true,
        data: {
          id: employeeId,
          userId,
          employeeCode,
          email: email.toLowerCase(),
          fullName: `${firstName || ''} ${lastName || ''}`.trim()
        },
        message: 'Empleado creado exitosamente'
      })

    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('[Employees API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear empleado'
    }, { status: 500 })
  }
}
