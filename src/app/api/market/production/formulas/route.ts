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

interface FormulaLine {
  rawMaterialId: number
  quantity: number
  isCritical?: boolean
  notes?: string
}

/**
 * Generate formula code: FORM-XXXX
 */
async function generateFormulaCode(companyId: number): Promise<string> {
  const prefix = 'FORM-'

  const result = await db.query(`
    SELECT code FROM market_production_formulas
    WHERE company_id = $1 AND code LIKE $2
    ORDER BY code DESC
    LIMIT 1
  `, [companyId, `${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const lastCode = result.rows[0].code
    const parts = lastCode.split('-')
    nextNumber = parseInt(parts[1]) + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

/**
 * GET /api/market/production/formulas
 * List formulas with filters and pagination
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        f.id,
        f.code,
        f.name,
        f.target_product_id,
        f.yield_quantity,
        f.yield_unit,
        f.labor_cost_per_batch,
        f.estimated_time_minutes,
        f.notes,
        f.is_active,
        f.created_at,
        f.updated_at,
        p.name as target_product_name,
        p.sku as target_product_sku,
        p.image_url as target_product_image,
        p.unit_of_measure as target_product_unit,
        p.cost_price as target_product_cost,
        (SELECT COUNT(*) FROM market_production_formula_lines WHERE formula_id = f.id) as material_count,
        (SELECT COALESCE(SUM(fl.quantity * mp.cost_price), 0)
         FROM market_production_formula_lines fl
         JOIN market_products mp ON fl.raw_material_id = mp.id
         WHERE fl.formula_id = f.id) as estimated_materials_cost
      FROM market_production_formulas f
      LEFT JOIN market_products p ON f.target_product_id = p.id
      WHERE f.company_id = $1
    `
    const params: any[] = [companyId]
    let paramIndex = 2

    if (search) {
      query += ` AND (f.name ILIKE $${paramIndex} OR f.code ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query += ` AND f.is_active = $${paramIndex}`
      params.push(isActive === 'true')
      paramIndex++
    }

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM market_production_formulas/,
      'SELECT COUNT(*) as total FROM market_production_formulas'
    ).replace(/LEFT JOIN market_products[\s\S]*?WHERE/, 'WHERE')

    const countResult = await db.query(countQuery.split('WHERE')[0] + ' WHERE' + countQuery.split('WHERE').slice(1).join('WHERE'), params)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Add ordering and pagination
    query += ` ORDER BY f.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive
      FROM market_production_formulas
      WHERE company_id = $1
    `, [companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        formulas: result.rows.map(row => ({
          id: row.id,
          code: row.code,
          name: row.name,
          targetProductId: row.target_product_id,
          targetProductName: row.target_product_name,
          targetProductSku: row.target_product_sku,
          targetProductImage: row.target_product_image,
          targetProductUnit: row.target_product_unit,
          targetProductCost: parseFloat(row.target_product_cost) || 0,
          yieldQuantity: parseFloat(row.yield_quantity) || 1,
          yieldUnit: row.yield_unit,
          laborCostPerBatch: parseFloat(row.labor_cost_per_batch) || 0,
          estimatedTimeMinutes: row.estimated_time_minutes,
          notes: row.notes,
          isActive: row.is_active,
          materialCount: parseInt(row.material_count) || 0,
          estimatedMaterialsCost: parseFloat(row.estimated_materials_cost) || 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          total: parseInt(stats.total) || 0,
          active: parseInt(stats.active) || 0,
          inactive: parseInt(stats.inactive) || 0
        }
      }
    })

  } catch (error) {
    console.error('[Formulas API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener fórmulas'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/production/formulas
 * Create a new formula with its lines
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
      name,
      targetProductId,
      yieldQuantity,
      yieldUnit,
      laborCostPerBatch,
      estimatedTimeMinutes,
      notes,
      lines
    } = body

    // Validation
    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre es requerido'
      }, { status: 400 })
    }

    if (!targetProductId) {
      return NextResponse.json({
        success: false,
        error: 'El producto final es requerido'
      }, { status: 400 })
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe agregar al menos una materia prima'
      }, { status: 400 })
    }

    // Verify target product exists
    const productCheck = await db.query(
      'SELECT id, name FROM market_products WHERE id = $1 AND company_id = $2',
      [targetProductId, companyId]
    )

    if (productCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'El producto final no existe'
      }, { status: 400 })
    }

    // Generate code
    const code = await generateFormulaCode(companyId)

    // Start transaction
    await db.query('BEGIN')

    try {
      // Create formula
      const formulaResult = await db.query(`
        INSERT INTO market_production_formulas (
          company_id, code, name, target_product_id,
          yield_quantity, yield_unit, labor_cost_per_batch,
          estimated_time_minutes, notes, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10)
        RETURNING id
      `, [
        companyId,
        code,
        name,
        targetProductId,
        yieldQuantity || 1,
        yieldUnit || 'unidad',
        laborCostPerBatch || 0,
        estimatedTimeMinutes || null,
        notes || null,
        userId
      ])

      const formulaId = formulaResult.rows[0].id

      // Insert formula lines
      for (const line of lines as FormulaLine[]) {
        // Verify raw material exists
        const materialCheck = await db.query(
          'SELECT id, name, unit_of_measure FROM market_products WHERE id = $1 AND company_id = $2',
          [line.rawMaterialId, companyId]
        )

        if (materialCheck.rows.length === 0) {
          throw new Error(`La materia prima con ID ${line.rawMaterialId} no existe`)
        }

        await db.query(`
          INSERT INTO market_production_formula_lines (
            formula_id, raw_material_id, quantity, is_critical, notes
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          formulaId,
          line.rawMaterialId,
          line.quantity,
          line.isCritical !== false,
          line.notes || null
        ])
      }

      await db.query('COMMIT')

      // Fetch the created formula with details
      const createdFormula = await db.query(`
        SELECT
          f.id,
          f.code,
          f.name,
          f.target_product_id,
          f.yield_quantity,
          f.yield_unit,
          f.labor_cost_per_batch,
          f.estimated_time_minutes,
          f.notes,
          f.is_active,
          f.created_at,
          p.name as target_product_name
        FROM market_production_formulas f
        LEFT JOIN market_products p ON f.target_product_id = p.id
        WHERE f.id = $1
      `, [formulaId])

      console.log('[Formulas API] Created formula:', code, name)

      return NextResponse.json({
        success: true,
        data: {
          id: createdFormula.rows[0].id,
          code: createdFormula.rows[0].code,
          name: createdFormula.rows[0].name,
          targetProductId: createdFormula.rows[0].target_product_id,
          targetProductName: createdFormula.rows[0].target_product_name,
          yieldQuantity: parseFloat(createdFormula.rows[0].yield_quantity),
          yieldUnit: createdFormula.rows[0].yield_unit,
          laborCostPerBatch: parseFloat(createdFormula.rows[0].labor_cost_per_batch),
          estimatedTimeMinutes: createdFormula.rows[0].estimated_time_minutes,
          notes: createdFormula.rows[0].notes,
          isActive: createdFormula.rows[0].is_active,
          materialCount: lines.length,
          createdAt: createdFormula.rows[0].created_at
        },
        message: `Fórmula ${code} creada exitosamente`
      })

    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('[Formulas API] POST Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear fórmula'
    }, { status: 500 })
  }
}
