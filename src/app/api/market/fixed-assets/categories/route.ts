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
 * GET /api/market/fixed-assets/categories
 * List all fixed asset categories for a company
 *
 * Query params:
 * - includeInactive: boolean (default false)
 * - flat: boolean (default false) - if true, returns flat list; if false, returns tree
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

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const flat = searchParams.get('flat') === 'true'

    // Build query
    const conditions: string[] = ['company_id = $1']
    const params: (number | boolean)[] = [payload.companyId]

    if (!includeInactive) {
      conditions.push('is_active = true')
    }

    const whereClause = conditions.join(' AND ')

    // Get categories with asset count
    const result = await db.query(`
      SELECT
        c.*,
        p.name as parent_name,
        COUNT(a.id) as asset_count
      FROM market_fixed_asset_categories c
      LEFT JOIN market_fixed_asset_categories p ON c.parent_id = p.id
      LEFT JOIN market_fixed_assets a ON a.category_id = c.id AND a.status != 'disposed'
      WHERE c.${whereClause.replace('company_id', 'company_id')}
      GROUP BY c.id, p.name
      ORDER BY c.name
    `, params)

    const categories = result.rows.map(row => ({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      code: row.code,
      parentId: row.parent_id,
      parentName: row.parent_name,
      depreciationYears: row.depreciation_years,
      isActive: row.is_active,
      assetCount: parseInt(row.asset_count) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    if (flat) {
      return NextResponse.json({
        success: true,
        data: categories
      })
    }

    // Build tree structure
    const categoryMap = new Map()
    const rootCategories: typeof categories = []

    // First pass: create map
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] })
    })

    // Second pass: build tree
    categories.forEach(cat => {
      const node = categoryMap.get(cat.id)
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(node)
      } else {
        rootCategories.push(node)
      }
    })

    return NextResponse.json({
      success: true,
      data: rootCategories
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Categories GET] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al obtener categorías'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/fixed-assets/categories
 * Create a new fixed asset category
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

    const body = await request.json()
    const {
      name,
      code,
      parentId,
      depreciationYears,
      isActive = true
    } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre de la categoría es requerido'
      }, { status: 400 })
    }

    // Validate parent exists and belongs to same company
    if (parentId) {
      const parentResult = await db.query(`
        SELECT id FROM market_fixed_asset_categories
        WHERE id = $1 AND company_id = $2
      `, [parentId, payload.companyId])

      if (parentResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Categoría padre no encontrada'
        }, { status: 404 })
      }
    }

    // Insert category
    const result = await db.query(`
      INSERT INTO market_fixed_asset_categories (
        company_id, name, code, parent_id, depreciation_years, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      payload.companyId,
      name,
      code || null,
      parentId || null,
      depreciationYears || null,
      isActive
    ])

    const category = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Categoría creada exitosamente',
      data: {
        id: category.id,
        companyId: category.company_id,
        name: category.name,
        code: category.code,
        parentId: category.parent_id,
        depreciationYears: category.depreciation_years,
        isActive: category.is_active,
        createdAt: category.created_at
      }
    }, { status: 201 })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Categories POST] Error:', err)

    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe una categoría con ese código'
      }, { status: 409 })
    }

    return NextResponse.json({
      success: false,
      error: err.message || 'Error al crear categoría'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/fixed-assets/categories
 * Update a category (requires id in body)
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

    const body = await request.json()
    const {
      id,
      name,
      code,
      parentId,
      depreciationYears,
      isActive
    } = body

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID de categoría es requerido'
      }, { status: 400 })
    }

    // Check category exists and belongs to company
    const existing = await db.query(`
      SELECT * FROM market_fixed_asset_categories
      WHERE id = $1 AND company_id = $2
    `, [id, payload.companyId])

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Categoría no encontrada'
      }, { status: 404 })
    }

    // Prevent circular reference
    if (parentId === id) {
      return NextResponse.json({
        success: false,
        error: 'Una categoría no puede ser su propia categoría padre'
      }, { status: 400 })
    }

    // Update category
    const result = await db.query(`
      UPDATE market_fixed_asset_categories SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        parent_id = $3,
        depreciation_years = COALESCE($4, depreciation_years),
        is_active = COALESCE($5, is_active),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [
      name,
      code,
      parentId !== undefined ? parentId : existing.rows[0].parent_id,
      depreciationYears,
      isActive,
      id
    ])

    const category = result.rows[0]

    return NextResponse.json({
      success: true,
      message: 'Categoría actualizada exitosamente',
      data: {
        id: category.id,
        companyId: category.company_id,
        name: category.name,
        code: category.code,
        parentId: category.parent_id,
        depreciationYears: category.depreciation_years,
        isActive: category.is_active,
        updatedAt: category.updated_at
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Categories PUT] Error:', err)

    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe una categoría con ese código'
      }, { status: 409 })
    }

    return NextResponse.json({
      success: false,
      error: err.message || 'Error al actualizar categoría'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/fixed-assets/categories
 * Delete a category (soft delete by setting is_active = false)
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'ID de categoría es requerido'
      }, { status: 400 })
    }

    // Check category exists
    const existing = await db.query(`
      SELECT * FROM market_fixed_asset_categories
      WHERE id = $1 AND company_id = $2
    `, [parseInt(id), payload.companyId])

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Categoría no encontrada'
      }, { status: 404 })
    }

    // Check if category has assets
    const assetsCount = await db.query(`
      SELECT COUNT(*) as count FROM market_fixed_assets
      WHERE category_id = $1 AND status != 'disposed'
    `, [parseInt(id)])

    if (parseInt(assetsCount.rows[0].count) > 0) {
      // Soft delete
      await db.query(`
        UPDATE market_fixed_asset_categories
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `, [parseInt(id)])

      return NextResponse.json({
        success: true,
        message: 'Categoría desactivada (tiene activos asociados)'
      })
    }

    // Check if category has children
    const childrenCount = await db.query(`
      SELECT COUNT(*) as count FROM market_fixed_asset_categories
      WHERE parent_id = $1
    `, [parseInt(id)])

    if (parseInt(childrenCount.rows[0].count) > 0) {
      // Soft delete
      await db.query(`
        UPDATE market_fixed_asset_categories
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `, [parseInt(id)])

      return NextResponse.json({
        success: true,
        message: 'Categoría desactivada (tiene subcategorías)'
      })
    }

    // Hard delete if no dependencies
    await db.query(`
      DELETE FROM market_fixed_asset_categories WHERE id = $1
    `, [parseInt(id)])

    return NextResponse.json({
      success: true,
      message: 'Categoría eliminada exitosamente'
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[Fixed Asset Categories DELETE] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message || 'Error al eliminar categoría'
    }, { status: 500 })
  }
}
