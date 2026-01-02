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
 * GET /api/market/accounting/expenses
 * List expenses with filters
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
    const categoryId = searchParams.get('categoryId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT
        e.id,
        e.description,
        e.amount,
        e.currency,
        e.expense_date,
        e.category_id,
        e.ai_category_suggestion,
        e.ai_confidence,
        e.vendor_name,
        e.receipt_path,
        e.receipt_type,
        e.created_at,
        c.name as category_name,
        c.code as category_code,
        c.accounting_type,
        u.email as created_by_email,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name
      FROM market_expenses e
      LEFT JOIN market_expense_categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.company_id = $1
    `
    const params: any[] = [companyId]
    let paramIndex = 2

    if (categoryId) {
      query += ` AND e.category_id = $${paramIndex++}`
      params.push(parseInt(categoryId))
    }

    if (startDate) {
      query += ` AND e.expense_date >= $${paramIndex++}`
      params.push(startDate)
    }

    if (endDate) {
      query += ` AND e.expense_date <= $${paramIndex++}`
      params.push(endDate)
    }

    if (search) {
      query += ` AND (
        e.description ILIKE $${paramIndex} OR
        e.vendor_name ILIKE $${paramIndex}
      )`
      params.push(`%${search}%`)
      paramIndex++
    }

    query += ` ORDER BY e.expense_date DESC, e.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM market_expenses e WHERE e.company_id = $1`
    const countParams: any[] = [companyId]
    let countParamIndex = 2

    if (categoryId) {
      countQuery += ` AND e.category_id = $${countParamIndex++}`
      countParams.push(parseInt(categoryId))
    }
    if (startDate) {
      countQuery += ` AND e.expense_date >= $${countParamIndex++}`
      countParams.push(startDate)
    }
    if (endDate) {
      countQuery += ` AND e.expense_date <= $${countParamIndex++}`
      countParams.push(endDate)
    }

    const countResult = await db.query(countQuery, countParams)

    // Get totals by category
    const totalsResult = await db.query(`
      SELECT
        c.name as category_name,
        c.accounting_type,
        COUNT(*) as count,
        COALESCE(SUM(e.amount), 0) as total
      FROM market_expenses e
      LEFT JOIN market_expense_categories c ON e.category_id = c.id
      WHERE e.company_id = $1
        ${startDate ? `AND e.expense_date >= '${startDate}'` : ''}
        ${endDate ? `AND e.expense_date <= '${endDate}'` : ''}
      GROUP BY c.id, c.name, c.accounting_type
      ORDER BY total DESC
    `, [companyId])

    return NextResponse.json({
      success: true,
      data: {
        expenses: result.rows.map(row => ({
          id: row.id,
          description: row.description,
          amount: parseFloat(row.amount) || 0,
          currency: row.currency,
          expenseDate: row.expense_date,
          categoryId: row.category_id,
          categoryName: row.category_name || 'Sin categoría',
          categoryCode: row.category_code,
          accountingType: row.accounting_type,
          aiSuggestion: row.ai_category_suggestion,
          aiConfidence: row.ai_confidence ? parseFloat(row.ai_confidence) : null,
          vendorName: row.vendor_name,
          receiptPath: row.receipt_path,
          receiptType: row.receipt_type,
          createdByEmail: row.created_by_email,
          createdByName: row.created_by_name,
          createdAt: row.created_at
        })),
        total: parseInt(countResult.rows[0].count),
        byCategory: totalsResult.rows.map(row => ({
          categoryName: row.category_name || 'Sin categoría',
          accountingType: row.accounting_type,
          count: parseInt(row.count),
          total: parseFloat(row.total) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Expenses API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener gastos'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/accounting/expenses
 * Create a new expense
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
      description,
      amount,
      currency,
      expenseDate,
      categoryId,
      vendorName,
      receiptPath,
      receiptType,
      aiSuggestion,
      aiConfidence,
      aiAnalysis
    } = body

    if (!description || !amount || !expenseDate) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    const result = await db.query(`
      INSERT INTO market_expenses (
        company_id, description, amount, currency, expense_date,
        category_id, vendor_name, receipt_path, receipt_type,
        ai_category_suggestion, ai_confidence, ai_analysis,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING id
    `, [
      companyId,
      description,
      amount,
      currency || 'USD',
      expenseDate,
      categoryId || null,
      vendorName || null,
      receiptPath || null,
      receiptType || null,
      aiSuggestion || null,
      aiConfidence || null,
      aiAnalysis || null,
      userId
    ])

    console.log('[Expenses API] Created expense:', result.rows[0].id, description)

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Gasto registrado exitosamente'
    })

  } catch (error) {
    console.error('[Expenses API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear gasto'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/accounting/expenses
 * Update an expense
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

    const body = await request.json()
    const {
      id,
      description,
      amount,
      currency,
      expenseDate,
      categoryId,
      vendorName
    } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID de gasto requerido'
      }, { status: 400 })
    }

    // Verify expense belongs to company
    const existing = await db.query(
      'SELECT id FROM market_expenses WHERE id = $1 AND company_id = $2',
      [id, companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Gasto no encontrado'
      }, { status: 404 })
    }

    await db.query(`
      UPDATE market_expenses SET
        description = COALESCE($1, description),
        amount = COALESCE($2, amount),
        currency = COALESCE($3, currency),
        expense_date = COALESCE($4, expense_date),
        category_id = $5,
        vendor_name = $6,
        updated_at = NOW()
      WHERE id = $7 AND company_id = $8
    `, [
      description,
      amount,
      currency,
      expenseDate,
      categoryId,
      vendorName,
      id,
      companyId
    ])

    return NextResponse.json({
      success: true,
      message: 'Gasto actualizado exitosamente'
    })

  } catch (error) {
    console.error('[Expenses API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar gasto'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/accounting/expenses
 * Delete an expense
 */
export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID de gasto requerido'
      }, { status: 400 })
    }

    await db.query(
      'DELETE FROM market_expenses WHERE id = $1 AND company_id = $2',
      [id, companyId]
    )

    return NextResponse.json({
      success: true,
      message: 'Gasto eliminado exitosamente'
    })

  } catch (error) {
    console.error('[Expenses API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar gasto'
    }, { status: 500 })
  }
}
