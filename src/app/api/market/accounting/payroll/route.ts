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
 * GET /api/market/accounting/payroll
 * List payroll records
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
    const employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT
        p.id,
        p.employee_id,
        p.period_start,
        p.period_end,
        p.pay_date,
        p.base_pay,
        p.hours_worked,
        p.days_worked,
        p.sales_total,
        p.commission_amount,
        p.bonus_amount,
        p.bonus_description,
        p.deductions,
        p.deduction_notes,
        p.gross_pay,
        p.net_pay,
        p.currency,
        p.status,
        p.notes,
        p.created_at,
        p.paid_at,
        e.employee_code,
        e.pay_type,
        e.pay_rate,
        u.email,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as employee_name,
        uc.email as created_by_email
      FROM market_payroll p
      JOIN market_employees e ON p.employee_id = e.id
      JOIN users u ON e.user_id = u.id
      LEFT JOIN users uc ON p.created_by = uc.id
      WHERE p.company_id = $1
    `
    const params: any[] = [companyId]
    let paramIndex = 2

    if (employeeId) {
      query += ` AND p.employee_id = $${paramIndex++}`
      params.push(parseInt(employeeId))
    }

    if (status && status !== 'all') {
      query += ` AND p.status = $${paramIndex++}`
      params.push(status)
    }

    if (startDate) {
      query += ` AND p.period_start >= $${paramIndex++}`
      params.push(startDate)
    }

    if (endDate) {
      query += ` AND p.period_end <= $${paramIndex++}`
      params.push(endDate)
    }

    query += ` ORDER BY p.period_end DESC, p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM market_payroll p WHERE p.company_id = $1`
    const countParams: any[] = [companyId]
    let countParamIndex = 2

    if (employeeId) {
      countQuery += ` AND p.employee_id = $${countParamIndex++}`
      countParams.push(parseInt(employeeId))
    }
    if (status && status !== 'all') {
      countQuery += ` AND p.status = $${countParamIndex++}`
      countParams.push(status)
    }

    const countResult = await db.query(countQuery, countParams)

    // Get summary stats
    const summaryResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COALESCE(SUM(net_pay) FILTER (WHERE status = 'pending'), 0) as pending_total,
        COALESCE(SUM(net_pay) FILTER (WHERE status = 'paid'), 0) as paid_total
      FROM market_payroll
      WHERE company_id = $1
    `, [companyId])

    return NextResponse.json({
      success: true,
      data: {
        payrolls: result.rows.map(row => ({
          id: row.id,
          employeeId: row.employee_id,
          employeeCode: row.employee_code,
          employeeName: row.employee_name,
          employeeEmail: row.email,
          payType: row.pay_type,
          payRate: parseFloat(row.pay_rate) || 0,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          payDate: row.pay_date,
          basePay: parseFloat(row.base_pay) || 0,
          hoursWorked: row.hours_worked ? parseFloat(row.hours_worked) : null,
          daysWorked: row.days_worked,
          salesTotal: parseFloat(row.sales_total) || 0,
          commissionAmount: parseFloat(row.commission_amount) || 0,
          bonusAmount: parseFloat(row.bonus_amount) || 0,
          bonusDescription: row.bonus_description,
          deductions: parseFloat(row.deductions) || 0,
          deductionNotes: row.deduction_notes,
          grossPay: parseFloat(row.gross_pay) || 0,
          netPay: parseFloat(row.net_pay) || 0,
          currency: row.currency,
          status: row.status,
          notes: row.notes,
          createdAt: row.created_at,
          paidAt: row.paid_at,
          createdByEmail: row.created_by_email
        })),
        total: parseInt(countResult.rows[0].count),
        summary: {
          pendingCount: parseInt(summaryResult.rows[0]?.pending_count) || 0,
          approvedCount: parseInt(summaryResult.rows[0]?.approved_count) || 0,
          paidCount: parseInt(summaryResult.rows[0]?.paid_count) || 0,
          pendingTotal: parseFloat(summaryResult.rows[0]?.pending_total) || 0,
          paidTotal: parseFloat(summaryResult.rows[0]?.paid_total) || 0
        }
      }
    })

  } catch (error) {
    console.error('[Payroll API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener nóminas'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/accounting/payroll
 * Create a new payroll record
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
    const userId = payload.userId

    const body = await request.json()
    const {
      employeeId,
      periodStart,
      periodEnd,
      payDate,
      basePay,
      hoursWorked,
      daysWorked,
      salesTotal,
      commissionAmount,
      bonusAmount,
      bonusDescription,
      deductions,
      deductionNotes,
      notes
    } = body

    if (!employeeId || !periodStart || !periodEnd) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    // Verify employee belongs to company
    const employee = await db.query(
      'SELECT id, pay_type, pay_rate, currency FROM market_employees WHERE id = $1 AND company_id = $2',
      [employeeId, companyId]
    )

    if (employee.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empleado no encontrado'
      }, { status: 404 })
    }

    const emp = employee.rows[0]
    const currency = emp.currency || 'USD'

    // Calculate pay based on type
    let calculatedBasePay = basePay
    if (!calculatedBasePay) {
      const payRate = parseFloat(emp.pay_rate)
      if (emp.pay_type === 'hourly' && hoursWorked) {
        calculatedBasePay = payRate * hoursWorked
      } else if (emp.pay_type === 'daily' && daysWorked) {
        calculatedBasePay = payRate * daysWorked
      } else if (emp.pay_type === 'monthly') {
        calculatedBasePay = payRate
      }
    }

    const grossPay = (calculatedBasePay || 0) + (commissionAmount || 0) + (bonusAmount || 0)
    const netPay = grossPay - (deductions || 0)

    const result = await db.query(`
      INSERT INTO market_payroll (
        company_id, employee_id, period_start, period_end, pay_date,
        base_pay, hours_worked, days_worked, sales_total, commission_amount,
        bonus_amount, bonus_description, deductions, deduction_notes,
        gross_pay, net_pay, currency, status, notes, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'pending', $18, $19, NOW(), NOW())
      RETURNING id
    `, [
      companyId,
      employeeId,
      periodStart,
      periodEnd,
      payDate || null,
      calculatedBasePay || 0,
      hoursWorked || null,
      daysWorked || null,
      salesTotal || 0,
      commissionAmount || 0,
      bonusAmount || 0,
      bonusDescription || null,
      deductions || 0,
      deductionNotes || null,
      grossPay,
      netPay,
      currency,
      notes || null,
      userId
    ])

    console.log('[Payroll API] Created payroll:', result.rows[0].id)

    return NextResponse.json({
      success: true,
      data: {
        id: result.rows[0].id,
        grossPay,
        netPay
      },
      message: 'Nómina creada exitosamente'
    })

  } catch (error) {
    console.error('[Payroll API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear nómina'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/accounting/payroll
 * Update payroll status (approve, pay, cancel)
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
    const { id, action, notes, payDate } = body

    if (!id || !action) {
      return NextResponse.json({
        success: false,
        error: 'ID y acción requeridos'
      }, { status: 400 })
    }

    // Verify payroll belongs to company
    const existing = await db.query(
      'SELECT id, status FROM market_payroll WHERE id = $1 AND company_id = $2',
      [id, companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nómina no encontrada'
      }, { status: 404 })
    }

    const currentStatus = existing.rows[0].status

    switch (action) {
      case 'approve':
        if (currentStatus !== 'pending') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden aprobar nóminas pendientes'
          }, { status: 400 })
        }
        await db.query(`
          UPDATE market_payroll SET
            status = 'approved',
            approved_by = $1,
            notes = COALESCE($2, notes),
            updated_at = NOW()
          WHERE id = $3
        `, [userId, notes, id])
        break

      case 'pay':
        if (currentStatus !== 'approved' && currentStatus !== 'pending') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden pagar nóminas aprobadas o pendientes'
          }, { status: 400 })
        }
        await db.query(`
          UPDATE market_payroll SET
            status = 'paid',
            paid_by = $1,
            paid_at = NOW(),
            pay_date = COALESCE($2, CURRENT_DATE),
            notes = COALESCE($3, notes),
            updated_at = NOW()
          WHERE id = $4
        `, [userId, payDate, notes, id])
        break

      case 'cancel':
        if (currentStatus === 'paid') {
          return NextResponse.json({
            success: false,
            error: 'No se pueden cancelar nóminas pagadas'
          }, { status: 400 })
        }
        await db.query(`
          UPDATE market_payroll SET
            status = 'cancelled',
            notes = COALESCE($1, notes),
            updated_at = NOW()
          WHERE id = $2
        `, [notes, id])
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Acción no válida'
        }, { status: 400 })
    }

    console.log('[Payroll API] Updated payroll:', id, 'action:', action)

    return NextResponse.json({
      success: true,
      message: `Nómina ${action === 'approve' ? 'aprobada' : action === 'pay' ? 'pagada' : 'cancelada'} exitosamente`
    })

  } catch (error) {
    console.error('[Payroll API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar nómina'
    }, { status: 500 })
  }
}
