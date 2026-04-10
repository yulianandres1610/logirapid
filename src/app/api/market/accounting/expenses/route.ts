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

// Migración: Crear tabla de items + nuevos campos
async function ensureExpenseItemsTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS market_expense_items (
        id SERIAL PRIMARY KEY,
        expense_id INTEGER NOT NULL REFERENCES market_expenses(id) ON DELETE CASCADE,
        description VARCHAR(500) NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        suggested_category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_expense_items_expense_id ON market_expense_items(expense_id)`)
    // Add new columns
    await db.query(`ALTER TABLE market_expenses ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(100)`)
    await db.query(`ALTER TABLE market_expenses ADD COLUMN IF NOT EXISTS notes TEXT`)
  } catch {
    console.log('[Expenses API] Table check completed')
  }
}

ensureExpenseItemsTable()

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

    // Detectar si es creación en lote (array de expenses con sharedData)
    // Ensure declaracion jurada columns exist
    try {
      await db.query('ALTER TABLE market_expenses ADD COLUMN IF NOT EXISTS vendor_id VARCHAR(50)')
      await db.query('ALTER TABLE market_expenses ADD COLUMN IF NOT EXISTS license_number VARCHAR(50)')
      await db.query('ALTER TABLE market_expenses ADD COLUMN IF NOT EXISTS vendor_activity VARCHAR(500)')
      await db.query('ALTER TABLE market_expenses ADD COLUMN IF NOT EXISTS purchase_location VARCHAR(500)')
      await db.query('ALTER TABLE market_expense_items ADD COLUMN IF NOT EXISTS quantity DECIMAL(10,2)')
      await db.query('ALTER TABLE market_expense_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(12,2)')
    } catch { /* ignore */ }

    if (body.expenses && Array.isArray(body.expenses) && body.sharedData) {
      const { expenses, sharedData } = body

      if (expenses.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No hay gastos para registrar'
        }, { status: 400 })
      }

      console.log('[Expenses API] Batch creation:', expenses.length, 'expenses')

      const createdExpenses: { id: number; description: string }[] = []

      for (const expense of expenses) {
        if (!expense.description || !expense.amount) {
          console.warn('[Expenses API] Skipping invalid expense:', expense)
          continue
        }

        const result = await db.query(`
          INSERT INTO market_expenses (
            company_id, description, amount, currency, expense_date,
            category_id, vendor_name, vendor_id, license_number, vendor_activity, purchase_location,
            receipt_path, receipt_type,
            ai_category_suggestion, ai_confidence, ai_analysis,
            receipt_number, notes,
            created_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
          RETURNING id
        `, [
          companyId,
          expense.description,
          expense.amount,
          sharedData.currency || 'USD',
          sharedData.expenseDate,
          expense.categoryId || null,
          sharedData.vendorName || null,
          sharedData.vendorId || null,
          sharedData.licenseNumber || null,
          sharedData.vendorActivity || null,
          sharedData.purchaseLocation || null,
          sharedData.receiptPath || null,
          sharedData.receiptType || null,
          expense.aiSuggestion || expense.categoryName || null,
          expense.aiConfidence || null,
          null,
          sharedData.receiptNumber || null,
          expense.notes || sharedData.notes || null,
          userId
        ])

        const expenseId = result.rows[0].id

        // Guardar los items/productos del gasto si existen
        if (expense.items && Array.isArray(expense.items) && expense.items.length > 0) {
          for (const item of expense.items) {
            await db.query(`
              INSERT INTO market_expense_items (expense_id, description, amount, suggested_category)
              VALUES ($1, $2, $3, $4)
            `, [
              expenseId,
              item.description || 'Item sin descripción',
              item.amount || 0,
              item.suggestedCategory || null
            ])
          }
          console.log('[Expenses API] Saved', expense.items.length, 'items for expense', expenseId)
        }

        createdExpenses.push({
          id: expenseId,
          description: expense.description
        })
      }

      console.log('[Expenses API] Batch created:', createdExpenses.length, 'expenses')

      return NextResponse.json({
        success: true,
        data: {
          count: createdExpenses.length,
          ids: createdExpenses.map(e => e.id),
          expenses: createdExpenses
        },
        message: `${createdExpenses.length} gastos registrados exitosamente`
      })
    }

    // Creación individual (flujo original)
    const {
      description,
      amount,
      currency,
      expenseDate,
      categoryId,
      vendorName,
      vendorId,
      licenseNumber,
      vendorActivity,
      purchaseLocation,
      receiptPath,
      receiptType,
      aiSuggestion,
      aiConfidence,
      aiAnalysis,
      receiptNumber,
      notes
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
        category_id, vendor_name, vendor_id, license_number, vendor_activity, purchase_location,
        receipt_path, receipt_type,
        ai_category_suggestion, ai_confidence, ai_analysis,
        receipt_number, notes,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
      RETURNING id
    `, [
      companyId,
      description,
      amount,
      currency || 'USD',
      expenseDate,
      categoryId || null,
      vendorName || null,
      vendorId || null,
      licenseNumber || null,
      vendorActivity || null,
      purchaseLocation || null,
      receiptPath || null,
      receiptType || null,
      aiSuggestion || null,
      aiConfidence || null,
      aiAnalysis || null,
      receiptNumber || null,
      notes || null,
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
