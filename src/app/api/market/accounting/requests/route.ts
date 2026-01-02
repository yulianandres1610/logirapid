import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/accounting/requests
 * List payment requests
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
    const status = searchParams.get('status')
    const employeeId = searchParams.get('employeeId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT
        r.id,
        r.employee_id,
        r.request_type,
        r.amount,
        r.currency,
        r.status,
        r.requested_at,
        r.reviewed_at,
        r.review_notes,
        r.paid_at,
        r.notes,
        e.employee_code,
        u.email as employee_email,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as employee_name,
        ur.email as reviewed_by_email
      FROM market_payment_requests r
      JOIN market_employees e ON r.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN users ur ON r.reviewed_by = ur.id
      WHERE r.company_id = $1
    `
    const params: any[] = [companyId]
    let paramIndex = 2

    if (status && status !== 'all') {
      query += ` AND r.status = $${paramIndex++}`
      params.push(status)
    }

    if (employeeId) {
      query += ` AND r.employee_id = $${paramIndex++}`
      params.push(parseInt(employeeId))
    }

    query += ` ORDER BY r.requested_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get counts by status
    const countsResult = await db.query(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM market_payment_requests
      WHERE company_id = $1
      GROUP BY status
    `, [companyId])

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
          employeeId: row.employee_id,
          employeeCode: row.employee_code,
          employeeName: row.employee_name,
          employeeEmail: row.employee_email,
          requestType: row.request_type,
          amount: parseFloat(row.amount) || 0,
          currency: row.currency,
          status: row.status,
          requestedAt: row.requested_at,
          reviewedAt: row.reviewed_at,
          reviewNotes: row.review_notes,
          reviewedByEmail: row.reviewed_by_email,
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
    console.error('[Requests API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener solicitudes'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/accounting/requests
 * Create a new payment request (usually from employee portal)
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value || cookieStore.get('employee-auth-token')?.value

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
    const userId = payload.userId

    const body = await request.json()
    const { employeeId, requestType, amount, currency, notes } = body

    // If employeeId not provided, find by userId
    let actualEmployeeId = employeeId
    if (!actualEmployeeId) {
      const empResult = await db.query(
        'SELECT id FROM market_employees WHERE user_id = $1 AND company_id = $2',
        [userId, companyId]
      )
      if (empResult.rows.length > 0) {
        actualEmployeeId = empResult.rows[0].id
      }
    }

    if (!actualEmployeeId) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

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

    // Verify employee belongs to company
    const employee = await db.query(
      'SELECT id, currency FROM market_employees WHERE id = $1 AND company_id = $2',
      [actualEmployeeId, companyId]
    )

    if (employee.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

    const result = await db.query(`
      INSERT INTO market_payment_requests (
        company_id, employee_id, request_type, amount, currency, status, notes, requested_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, NOW(), NOW())
      RETURNING id
    `, [
      companyId,
      actualEmployeeId,
      requestType,
      amount,
      currency || employee.rows[0].currency || 'USD',
      notes || null
    ])

    console.log('[Requests API] Created request:', result.rows[0].id)

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Solicitud creada exitosamente'
    })

  } catch (error) {
    console.error('[Requests API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear solicitud'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/accounting/requests
 * Process a request (approve, reject, pay)
 */
export async function PUT(request: NextRequest) {
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
    const userId = payload.userId

    const body = await request.json()
    const { id, action, reviewNotes } = body

    if (!id || !action) {
      return NextResponse.json({
        success: false,
        error: 'ID y acción requeridos'
      }, { status: 400 })
    }

    // Verify request belongs to company
    const existing = await db.query(
      'SELECT id, status FROM market_payment_requests WHERE id = $1 AND company_id = $2',
      [id, companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Solicitud no encontrada'
      }, { status: 404 })
    }

    const currentStatus = existing.rows[0].status

    switch (action) {
      case 'approve':
        if (currentStatus !== 'pending') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden aprobar solicitudes pendientes'
          }, { status: 400 })
        }
        await db.query(`
          UPDATE market_payment_requests SET
            status = 'approved',
            reviewed_by = $1,
            reviewed_at = NOW(),
            review_notes = $2
          WHERE id = $3
        `, [userId, reviewNotes || null, id])
        break

      case 'reject':
        if (currentStatus !== 'pending') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden rechazar solicitudes pendientes'
          }, { status: 400 })
        }
        await db.query(`
          UPDATE market_payment_requests SET
            status = 'rejected',
            reviewed_by = $1,
            reviewed_at = NOW(),
            review_notes = $2
          WHERE id = $3
        `, [userId, reviewNotes || null, id])
        break

      case 'pay':
        if (currentStatus !== 'approved') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden pagar solicitudes aprobadas'
          }, { status: 400 })
        }
        await db.query(`
          UPDATE market_payment_requests SET
            status = 'paid',
            paid_at = NOW()
          WHERE id = $1
        `, [id])
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no válida'
        }, { status: 400 })
    }

    console.log('[Requests API] Updated request:', id, 'action:', action)

    return NextResponse.json({
      success: true,
      message: `Solicitud ${action === 'approve' ? 'aprobada' : action === 'reject' ? 'rechazada' : 'pagada'} exitosamente`
    })

  } catch (error) {
    console.error('[Requests API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar solicitud'
    }, { status: 500 })
  }
}
