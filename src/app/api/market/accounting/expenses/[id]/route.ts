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
 * GET /api/market/accounting/expenses/[id]
 * Get expense details by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params
    const expenseId = parseInt(resolvedParams.id)

    if (isNaN(expenseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de gasto inválido'
      }, { status: 400 })
    }

    const result = await db.query(`
      SELECT
        e.id,
        e.description,
        e.amount,
        e.currency,
        e.expense_date,
        e.category_id,
        c.name as category_name,
        c.code as category_code,
        c.accounting_type,
        e.ai_category_suggestion,
        e.ai_confidence,
        e.ai_analysis,
        e.vendor_name,
        e.receipt_path,
        e.receipt_type,
        e.receipt_number,
        e.notes,
        e.created_by,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name,
        u.email as created_by_email,
        e.created_at,
        e.updated_at
      FROM market_expenses e
      LEFT JOIN market_expense_categories c ON e.category_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = $1 AND e.company_id = $2
    `, [expenseId, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Gasto no encontrado'
      }, { status: 404 })
    }

    const row = result.rows[0]

    // Obtener los items/productos del gasto
    const itemsResult = await db.query(`
      SELECT id, description, amount, suggested_category, created_at
      FROM market_expense_items
      WHERE expense_id = $1
      ORDER BY id
    `, [expenseId])

    const items = itemsResult.rows.map(item => ({
      id: item.id,
      description: item.description,
      amount: parseFloat(item.amount),
      suggestedCategory: item.suggested_category,
      createdAt: item.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        description: row.description,
        amount: parseFloat(row.amount),
        currency: row.currency,
        expenseDate: row.expense_date,
        categoryId: row.category_id,
        categoryName: row.category_name,
        categoryCode: row.category_code,
        accountingType: row.accounting_type,
        aiSuggestion: row.ai_category_suggestion,
        aiConfidence: row.ai_confidence ? parseFloat(row.ai_confidence) : null,
        aiAnalysis: row.ai_analysis,
        vendorName: row.vendor_name,
        vendorId: row.vendor_id || null,
        licenseNumber: row.license_number || null,
        vendorActivity: row.vendor_activity || null,
        purchaseLocation: row.purchase_location || null,
        receiptPath: row.receipt_path,
        receiptType: row.receipt_type,
        receiptNumber: row.receipt_number,
        notes: row.notes,
        createdById: row.created_by,
        createdByName: row.created_by_name || 'Usuario',
        createdByEmail: row.created_by_email,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        // Items/productos del recibo
        items,
        hasItems: items.length > 0
      }
    })

  } catch (error) {
    console.error('[Expense Detail API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener gasto'
    }, { status: 500 })
  }
}
