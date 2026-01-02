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
 * GET /api/market/accounting/categories
 * List expense categories
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
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    // Lista completa de categorías predeterminadas
    const defaultCategories = [
      { name: 'Alquiler', code: 'RENT', type: 'opex', desc: 'Gastos de alquiler del local' },
      { name: 'Servicios', code: 'UTIL', type: 'opex', desc: 'Electricidad, agua, internet, telefono' },
      { name: 'Salarios', code: 'SAL', type: 'opex', desc: 'Pago de nominas y salarios' },
      { name: 'Inventario', code: 'INV', type: 'cogs', desc: 'Compra de mercancia para venta' },
      { name: 'Transporte', code: 'TRANS', type: 'opex', desc: 'Gastos de transporte y combustible' },
      { name: 'Marketing', code: 'MKT', type: 'opex', desc: 'Publicidad y promocion' },
      { name: 'Mantenimiento', code: 'MAINT', type: 'opex', desc: 'Reparaciones y mantenimiento' },
      { name: 'Impuestos', code: 'TAX', type: 'opex', desc: 'Pagos de impuestos' },
      { name: 'Equipamiento', code: 'EQUIP', type: 'capex', desc: 'Compra de equipos y mobiliario' },
      { name: 'Suministros', code: 'SUPPLY', type: 'opex', desc: 'Suministros de oficina, papeleria, articulos de escritorio' },
      { name: 'Alimentos', code: 'FOOD', type: 'opex', desc: 'Alimentos, bebidas, snacks para empleados' },
      { name: 'Otros', code: 'OTHER', type: 'opex', desc: 'Gastos varios no categorizados' }
    ]

    // Crear categorías faltantes (para empresas nuevas y existentes)
    const existingCategories = await db.query(
      'SELECT name FROM market_expense_categories WHERE company_id = $1',
      [companyId]
    )
    const existingNames = new Set(existingCategories.rows.map(r => r.name))

    const missingCategories = defaultCategories.filter(cat => !existingNames.has(cat.name))

    if (missingCategories.length > 0) {
      console.log('[Categories API] Adding missing categories for company:', companyId, missingCategories.map(c => c.name))

      for (const cat of missingCategories) {
        try {
          await db.query(`
            INSERT INTO market_expense_categories (company_id, name, code, accounting_type, description)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (company_id, name) DO NOTHING
          `, [companyId, cat.name, cat.code, cat.type, cat.desc])
        } catch (e) {
          console.error('[Categories API] Error creating category:', cat.name, e)
        }
      }
    }

    let query = `
      SELECT
        c.id,
        c.name,
        c.code,
        c.description,
        c.accounting_type,
        c.parent_id,
        c.is_active,
        c.created_at,
        p.name as parent_name,
        (SELECT COUNT(*) FROM market_expenses e WHERE e.category_id = c.id) as expense_count,
        (SELECT COALESCE(SUM(amount), 0) FROM market_expenses e WHERE e.category_id = c.id) as total_expenses
      FROM market_expense_categories c
      LEFT JOIN market_expense_categories p ON c.parent_id = p.id
      WHERE c.company_id = $1
    `
    const params: any[] = [companyId]

    if (activeOnly) {
      query += ` AND c.is_active = true`
    }

    query += ` ORDER BY c.name ASC`

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: {
        categories: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          code: row.code,
          description: row.description,
          accountingType: row.accounting_type,
          parentId: row.parent_id,
          parentName: row.parent_name,
          isActive: row.is_active,
          expenseCount: parseInt(row.expense_count) || 0,
          totalExpenses: parseFloat(row.total_expenses) || 0,
          createdAt: row.created_at
        }))
      }
    })

  } catch (error) {
    console.error('[Categories API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener categorías'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/accounting/categories
 * Create a new expense category
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
    const { name, code, description, accountingType, parentId } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre es requerido'
      }, { status: 400 })
    }

    // Check if name already exists
    const existing = await db.query(
      'SELECT id FROM market_expense_categories WHERE company_id = $1 AND name = $2',
      [companyId, name]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe una categoría con ese nombre'
      }, { status: 400 })
    }

    const result = await db.query(`
      INSERT INTO market_expense_categories (
        company_id, name, code, description, accounting_type, parent_id, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      RETURNING id
    `, [
      companyId,
      name,
      code || null,
      description || null,
      accountingType || 'opex',
      parentId || null
    ])

    console.log('[Categories API] Created category:', name)

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Categoría creada exitosamente'
    })

  } catch (error) {
    console.error('[Categories API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear categoría'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/accounting/categories
 * Update a category
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
    const { id, name, code, description, accountingType, parentId, isActive } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID de categoría requerido'
      }, { status: 400 })
    }

    // Check category exists and belongs to company
    const existing = await db.query(
      'SELECT id FROM market_expense_categories WHERE id = $1 AND company_id = $2',
      [id, companyId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Categoría no encontrada'
      }, { status: 404 })
    }

    // Check name uniqueness if changing
    if (name) {
      const nameCheck = await db.query(
        'SELECT id FROM market_expense_categories WHERE company_id = $1 AND name = $2 AND id != $3',
        [companyId, name, id]
      )
      if (nameCheck.rows.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Ya existe una categoría con ese nombre'
        }, { status: 400 })
      }
    }

    await db.query(`
      UPDATE market_expense_categories SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        description = COALESCE($3, description),
        accounting_type = COALESCE($4, accounting_type),
        parent_id = $5,
        is_active = COALESCE($6, is_active)
      WHERE id = $7 AND company_id = $8
    `, [
      name,
      code,
      description,
      accountingType,
      parentId,
      isActive,
      id,
      companyId
    ])

    return NextResponse.json({
      success: true,
      message: 'Categoría actualizada exitosamente'
    })

  } catch (error) {
    console.error('[Categories API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar categoría'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/accounting/categories
 * Delete a category (soft delete - deactivate)
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
        error: 'ID de categoría requerido'
      }, { status: 400 })
    }

    // Check if category has expenses
    const hasExpenses = await db.query(
      'SELECT COUNT(*) as count FROM market_expenses WHERE category_id = $1',
      [id]
    )

    if (parseInt(hasExpenses.rows[0].count) > 0) {
      // Soft delete
      await db.query(
        'UPDATE market_expense_categories SET is_active = false WHERE id = $1 AND company_id = $2',
        [id, companyId]
      )
    } else {
      // Hard delete if no expenses
      await db.query(
        'DELETE FROM market_expense_categories WHERE id = $1 AND company_id = $2',
        [id, companyId]
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Categoría eliminada exitosamente'
    })

  } catch (error) {
    console.error('[Categories API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar categoría'
    }, { status: 500 })
  }
}
