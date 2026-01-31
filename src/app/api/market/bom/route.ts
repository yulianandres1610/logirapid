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
 * GET /api/market/bom
 * List Bill of Materials (recipes)
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
    const search = searchParams.get('search') || ''
    const productId = searchParams.get('productId')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        bom.*,
        p.name as product_name,
        p.sku as product_sku,
        p.image_url as product_image,
        p.cost_price as product_cost_price,
        p.selling_price as product_selling_price,
        v.variant_name,
        v.sku as variant_sku,
        creator.email as created_by_email,
        (
          SELECT COUNT(*) FROM market_bom_lines WHERE bom_id = bom.id
        ) as lines_count,
        (
          SELECT COALESCE(SUM(
            CASE
              WHEN bl.variant_id IS NOT NULL THEN
                COALESCE(pv.cost_price, mp.cost_price) * bl.quantity_required
              ELSE
                mp.cost_price * bl.quantity_required
            END
          ), 0)
          FROM market_bom_lines bl
          LEFT JOIN market_products mp ON bl.product_id = mp.id
          LEFT JOIN market_product_variants pv ON bl.variant_id = pv.id
          WHERE bl.bom_id = bom.id
        ) as total_material_cost
      FROM market_bill_of_materials bom
      LEFT JOIN market_products p ON bom.product_id = p.id
      LEFT JOIN market_product_variants v ON bom.variant_id = v.id
      LEFT JOIN users creator ON bom.created_by = creator.id
      WHERE bom.company_id = $1
    `

    const queryParams: (string | number | boolean)[] = [companyId]
    let paramIndex = 2

    if (search) {
      query += ` AND (LOWER(bom.bom_name) LIKE $${paramIndex} OR LOWER(bom.bom_code) LIKE $${paramIndex} OR LOWER(p.name) LIKE $${paramIndex})`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    if (productId) {
      query += ` AND bom.product_id = $${paramIndex}`
      queryParams.push(parseInt(productId))
      paramIndex++
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      query += ` AND bom.is_active = $${paramIndex}`
      queryParams.push(isActive === 'true')
      paramIndex++
    }

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]+FROM market_bill_of_materials/, 'SELECT COUNT(*) as total FROM market_bill_of_materials')
    const countResult = await db.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add pagination
    query += ` ORDER BY bom.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // For each BOM, get its lines
    const bomsWithLines = await Promise.all(result.rows.map(async (bom) => {
      const linesResult = await db.query(`
        SELECT
          bl.*,
          mp.name as product_name,
          mp.sku as product_sku,
          mp.image_url as product_image,
          mp.cost_price as product_cost_price,
          mp.unit_of_measure as product_unit,
          pv.variant_name,
          pv.sku as variant_sku,
          pv.cost_price as variant_cost_price
        FROM market_bom_lines bl
        LEFT JOIN market_products mp ON bl.product_id = mp.id
        LEFT JOIN market_product_variants pv ON bl.variant_id = pv.id
        WHERE bl.bom_id = $1
        ORDER BY bl.is_primary DESC, bl.id ASC
      `, [bom.id])

      const lines = linesResult.rows.map(line => ({
        id: line.id,
        productId: line.product_id,
        productName: line.product_name,
        productSku: line.product_sku,
        productImage: line.product_image,
        productCostPrice: parseFloat(line.variant_cost_price || line.product_cost_price) || 0,
        productUnit: line.product_unit,
        variantId: line.variant_id,
        variantName: line.variant_name,
        variantSku: line.variant_sku,
        quantityRequired: parseFloat(line.quantity_required) || 0,
        unit: line.unit,
        isPrimary: line.is_primary,
        notes: line.notes,
        lineCost: (parseFloat(line.variant_cost_price || line.product_cost_price) || 0) * (parseFloat(line.quantity_required) || 0)
      }))

      const totalMaterialCost = parseFloat(bom.total_material_cost) || 0
      const outputQuantity = parseFloat(bom.output_quantity) || 1
      const unitCost = totalMaterialCost / outputQuantity

      return {
        id: bom.id,
        bomCode: bom.bom_code,
        bomName: bom.bom_name,
        productId: bom.product_id,
        productName: bom.product_name,
        productSku: bom.product_sku,
        productImage: bom.product_image,
        productCostPrice: parseFloat(bom.product_cost_price) || 0,
        productSellingPrice: parseFloat(bom.product_selling_price) || 0,
        variantId: bom.variant_id,
        variantName: bom.variant_name,
        variantSku: bom.variant_sku,
        outputQuantity,
        outputUnit: bom.output_unit,
        expectedWastePercent: parseFloat(bom.expected_waste_percent) || 0,
        isActive: bom.is_active,
        notes: bom.notes,
        linesCount: parseInt(bom.lines_count) || 0,
        totalMaterialCost,
        unitCost,
        createdBy: bom.created_by_email,
        createdAt: bom.created_at,
        updatedAt: bom.updated_at,
        lines
      }
    }))

    return NextResponse.json({
      success: true,
      data: {
        boms: bomsWithLines,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[BOM API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener recetas'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/bom
 * Create a new Bill of Materials (recipe)
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
      productId,
      variantId,
      bomName,
      outputQuantity,
      outputUnit = 'unidad',
      expectedWastePercent = 0,
      notes,
      lines = []
    } = body

    // Validate required fields
    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'El producto a fabricar es requerido'
      }, { status: 400 })
    }

    if (!bomName) {
      return NextResponse.json({
        success: false,
        error: 'El nombre de la receta es requerido'
      }, { status: 400 })
    }

    if (!outputQuantity || outputQuantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'La cantidad a producir debe ser mayor a 0'
      }, { status: 400 })
    }

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe agregar al menos una materia prima'
      }, { status: 400 })
    }

    // Verify product exists
    const productResult = await db.query(`
      SELECT id, name FROM market_products WHERE id = $1 AND company_id = $2
    `, [productId, companyId])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado'
      }, { status: 404 })
    }

    // Generate BOM code
    const year = new Date().getFullYear()
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM market_bill_of_materials WHERE company_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
      [companyId, year]
    )
    const sequenceNumber = (parseInt(countResult.rows[0]?.count) || 0) + 1
    const bomCode = `BOM-${year}-${sequenceNumber.toString().padStart(4, '0')}`

    // Create BOM
    const result = await db.query(`
      INSERT INTO market_bill_of_materials (
        company_id, product_id, variant_id, bom_code, bom_name,
        output_quantity, output_unit, expected_waste_percent,
        is_active, notes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, NOW(), NOW()
      ) RETURNING id
    `, [
      companyId, productId, variantId || null, bomCode, bomName,
      outputQuantity, outputUnit, expectedWastePercent,
      notes || null, userId
    ])

    const bomId = result.rows[0].id

    // Add lines
    for (const line of lines) {
      await db.query(`
        INSERT INTO market_bom_lines (
          bom_id, product_id, variant_id, quantity_required, unit, is_primary, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        bomId,
        line.productId,
        line.variantId || null,
        line.quantityRequired || 0,
        line.unit || 'unidad',
        line.isPrimary !== false,
        line.notes || null
      ])
    }

    return NextResponse.json({
      success: true,
      data: {
        id: bomId,
        bomCode
      },
      message: 'Receta creada exitosamente'
    })

  } catch (error) {
    console.error('[BOM API] Error creating BOM:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear receta'
    }, { status: 500 })
  }
}
