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
 * GET /api/wallet/credit-settings
 * Get credit settings for a company
 *
 * Query params:
 * - companyId: number (required)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Only SUPER_ADMIN can view credit settings
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede ver configuraciones de crédito'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'companyId es requerido'
      }, { status: 400 })
    }

    const result = await db.query(`
      SELECT
        id,
        legalname,
        walletnumber,
        walletbalance,
        credit_limit,
        credit_enabled,
        dailylimit,
        monthlylimit,
        negative_since,
        late_fee_charged_at,
        last_interest_charge_at
      FROM companies
      WHERE id = $1
    `, [companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = result.rows[0]
    const balance = parseFloat(company.walletbalance || '0')
    const creditLimit = parseFloat(company.credit_limit || '-200')

    // Calculate days in negative
    let daysInNegative = 0
    if (company.negative_since) {
      const negativeSince = new Date(company.negative_since)
      const now = new Date()
      daysInNegative = Math.floor((now.getTime() - negativeSince.getTime()) / (1000 * 60 * 60 * 24))
    }

    // Calculate available credit
    const availableCredit = balance >= 0 ? Math.abs(creditLimit) : Math.abs(creditLimit) - Math.abs(balance)

    return NextResponse.json({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.legalname,
        walletNumber: company.walletnumber,
        balance,
        balanceFormatted: `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        creditLimit,
        creditLimitFormatted: `$${Math.abs(creditLimit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        creditEnabled: company.credit_enabled !== false,
        dailyLimit: parseFloat(company.dailylimit || '5000'),
        monthlyLimit: parseFloat(company.monthlylimit || '50000'),
        availableCredit,
        availableCreditFormatted: `$${availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        negativeSince: company.negative_since,
        daysInNegative,
        lateFeeChargedAt: company.late_fee_charged_at,
        lastInterestChargeAt: company.last_interest_charge_at,
        // Status indicators
        isNegative: balance < 0,
        isOverdueForLateFee: daysInNegative >= 35 && !company.late_fee_charged_at,
        isOverdueForInterest: daysInNegative >= 65 // 35 + 30 days for first interest
      }
    })

  } catch (error) {
    console.error('Error fetching credit settings:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener configuraciones de crédito'
    }, { status: 500 })
  }
}

/**
 * PUT /api/wallet/credit-settings
 * Update credit settings for a company
 *
 * Body:
 * {
 *   companyId: number,
 *   creditLimit?: number (negative value, e.g., -200),
 *   creditEnabled?: boolean,
 *   dailyLimit?: number,
 *   monthlyLimit?: number
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Only SUPER_ADMIN can update credit settings
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede modificar configuraciones de crédito'
      }, { status: 403 })
    }

    const body = await request.json()
    const { companyId, creditLimit, creditEnabled, dailyLimit, monthlyLimit } = body

    if (!companyId) {
      return NextResponse.json({
        success: false,
        error: 'companyId es requerido'
      }, { status: 400 })
    }

    // Verify company exists
    const companyResult = await db.query(`
      SELECT id, legalname, credit_limit, credit_enabled, dailylimit, monthlylimit
      FROM companies
      WHERE id = $1
    `, [companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (creditLimit !== undefined) {
      // Ensure credit limit is negative
      const limitValue = creditLimit > 0 ? -creditLimit : creditLimit
      updates.push(`credit_limit = $${paramIndex}`)
      values.push(limitValue)
      paramIndex++
    }

    if (creditEnabled !== undefined) {
      updates.push(`credit_enabled = $${paramIndex}`)
      values.push(creditEnabled)
      paramIndex++
    }

    if (dailyLimit !== undefined) {
      updates.push(`dailylimit = $${paramIndex}`)
      values.push(dailyLimit)
      paramIndex++
    }

    if (monthlyLimit !== undefined) {
      updates.push(`monthlylimit = $${paramIndex}`)
      values.push(monthlyLimit)
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    // Add companyId to values
    values.push(companyId)

    const updateQuery = `
      UPDATE companies
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING credit_limit, credit_enabled, dailylimit, monthlylimit
    `

    const updateResult = await db.query(updateQuery, values)
    const updated = updateResult.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Configuraciones de crédito actualizadas',
      data: {
        companyId,
        companyName: company.legalname,
        creditLimit: parseFloat(updated.credit_limit || '-200'),
        creditLimitFormatted: `$${Math.abs(parseFloat(updated.credit_limit || '-200')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        creditEnabled: updated.credit_enabled !== false,
        dailyLimit: parseFloat(updated.dailylimit || '5000'),
        monthlyLimit: parseFloat(updated.monthlylimit || '50000')
      }
    })

  } catch (error) {
    console.error('Error updating credit settings:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar configuraciones de crédito'
    }, { status: 500 })
  }
}
