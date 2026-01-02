import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface EmployeeJWTPayload {
  type: string
  userId: number
  employeeId: number
  employeeCode: string
  email: string
  companyId: number
  companyName: string
  role: string
}

/**
 * GET /api/employee/requests
 * Get employee's payment requests
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('employee-auth-token')?.value

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: EmployeeJWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(token, secret) as EmployeeJWTPayload

      if (payload.type !== 'employee') {
        throw new Error('Invalid token type')
      }
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const employeeId = payload.employeeId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT
        id,
        request_type,
        amount,
        currency,
        status,
        requested_at,
        reviewed_at,
        review_notes,
        paid_at,
        notes
      FROM market_payment_requests
      WHERE employee_id = $1
    `
    const params: any[] = [employeeId]
    let paramIndex = 2

    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex++}`
      params.push(status)
    }

    query += ` ORDER BY requested_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get counts by status
    const countsResult = await db.query(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM market_payment_requests
      WHERE employee_id = $1
      GROUP BY status
    `, [employeeId])

    const statusCounts: Record<string, { count: number; total: number }> = {}
    for (const row of countsResult.rows) {
      statusCounts[row.status] = {
        count: parseInt(row.count),
        total: parseFloat(row.total)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        requests: result.rows.map(row => ({
          id: row.id,
          requestType: row.request_type,
          amount: parseFloat(row.amount) || 0,
          currency: row.currency,
          status: row.status,
          requestedAt: row.requested_at,
          reviewedAt: row.reviewed_at,
          reviewNotes: row.review_notes,
          paidAt: row.paid_at,
          notes: row.notes
        })),
        summary: {
          pending: statusCounts['pending'] || { count: 0, total: 0 },
          approved: statusCounts['approved'] || { count: 0, total: 0 },
          rejected: statusCounts['rejected'] || { count: 0, total: 0 },
          paid: statusCounts['paid'] || { count: 0, total: 0 }
        }
      }
    })

  } catch (error) {
    console.error('[Employee Requests] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener solicitudes'
    }, { status: 500 })
  }
}

/**
 * POST /api/employee/requests
 * Create a new payment request
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('employee-auth-token')?.value

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: EmployeeJWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(token, secret) as EmployeeJWTPayload

      if (payload.type !== 'employee') {
        throw new Error('Invalid token type')
      }
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const employeeId = payload.employeeId
    const companyId = payload.companyId

    const body = await request.json()
    const { requestType, amount, notes } = body

    if (!requestType || !amount) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de solicitud y monto requeridos'
      }, { status: 400 })
    }

    const validTypes = ['salary_advance', 'commission', 'bonus']
    if (!validTypes.includes(requestType)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de solicitud inválido'
      }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    // Get employee's currency
    const empResult = await db.query(
      'SELECT currency FROM market_employees WHERE id = $1',
      [employeeId]
    )
    const currency = empResult.rows[0]?.currency || 'USD'

    // Check for existing pending request of same type
    const existingResult = await db.query(`
      SELECT id FROM market_payment_requests
      WHERE employee_id = $1
        AND request_type = $2
        AND status = 'pending'
    `, [employeeId, requestType])

    if (existingResult.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya tienes una solicitud pendiente de este tipo'
      }, { status: 400 })
    }

    // Create request
    const result = await db.query(`
      INSERT INTO market_payment_requests (
        company_id, employee_id, request_type, amount, currency, status, notes, requested_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW(), NOW())
      RETURNING id
    `, [companyId, employeeId, requestType, amount, currency, notes || null])

    console.log('[Employee Requests] Created request:', result.rows[0].id)

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Solicitud creada exitosamente'
    })

  } catch (error) {
    console.error('[Employee Requests] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear solicitud'
    }, { status: 500 })
  }
}
