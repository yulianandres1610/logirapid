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
 * GET /api/market/production-orders
 * List production orders
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
    const warehouseId = searchParams.get('warehouseId')
    const bomId = searchParams.get('bomId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        po.*,
        bom.bom_code,
        bom.bom_name,
        bom.output_unit,
        p.name as product_name,
        p.sku as product_sku,
        p.image_url as product_image,
        v.variant_name,
        w.name as warehouse_name,
        w.code as warehouse_code,
        creator.email as created_by_email,
        confirmer.email as confirmed_by_email,
        completer.email as completed_by_email,
        (
          SELECT COUNT(*) FROM market_production_order_lines WHERE production_order_id = po.id
        ) as lines_count
      FROM market_production_orders po
      LEFT JOIN market_bill_of_materials bom ON po.bom_id = bom.id
      LEFT JOIN market_products p ON bom.product_id = p.id
      LEFT JOIN market_product_variants v ON bom.variant_id = v.id
      LEFT JOIN market_warehouses w ON po.warehouse_id = w.id
      LEFT JOIN users creator ON po.created_by = creator.id
      LEFT JOIN users confirmer ON po.confirmed_by = confirmer.id
      LEFT JOIN users completer ON po.completed_by = completer.id
      WHERE po.company_id = $1
    `

    const queryParams: (string | number)[] = [companyId]
    let paramIndex = 2

    if (status && status !== 'all') {
      query += ` AND po.status = $${paramIndex}`
      queryParams.push(status)
      paramIndex++
    }

    if (warehouseId) {
      query += ` AND po.warehouse_id = $${paramIndex}`
      queryParams.push(parseInt(warehouseId))
      paramIndex++
    }

    if (bomId) {
      query += ` AND po.bom_id = $${paramIndex}`
      queryParams.push(parseInt(bomId))
      paramIndex++
    }

    if (dateFrom) {
      query += ` AND po.scheduled_date >= $${paramIndex}`
      queryParams.push(dateFrom)
      paramIndex++
    }

    if (dateTo) {
      query += ` AND po.scheduled_date <= $${paramIndex}`
      queryParams.push(dateTo)
      paramIndex++
    }

    if (search) {
      query += ` AND (LOWER(po.production_number) LIKE $${paramIndex} OR LOWER(bom.bom_name) LIKE $${paramIndex} OR LOWER(p.name) LIKE $${paramIndex})`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]+FROM market_production_orders/, 'SELECT COUNT(*) as total FROM market_production_orders')
    const countResult = await db.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add pagination
    query += ` ORDER BY po.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Get stats
    const statsResult = await db.query(`
      SELECT status, COUNT(*) as count
      FROM market_production_orders
      WHERE company_id = $1
      GROUP BY status
    `, [companyId])

    const stats: Record<string, number> = {
      draft: 0,
      confirmed: 0,
      materials_out: 0,
      in_production: 0,
      completed: 0,
      cancelled: 0
    }

    for (const row of statsResult.rows) {
      stats[row.status] = parseInt(row.count) || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        orders: result.rows.map(row => ({
          id: row.id,
          productionNumber: row.production_number,
          bomId: row.bom_id,
          bomCode: row.bom_code,
          bomName: row.bom_name,
          productName: row.product_name,
          productSku: row.product_sku,
          productImage: row.product_image,
          variantName: row.variant_name,
          outputUnit: row.output_unit,
          warehouse: row.warehouse_id ? {
            id: row.warehouse_id,
            name: row.warehouse_name,
            code: row.warehouse_code
          } : null,
          quantityToProduce: parseFloat(row.quantity_to_produce) || 0,
          quantityProduced: parseFloat(row.quantity_produced) || 0,
          totalMaterialCost: parseFloat(row.total_material_cost) || 0,
          unitCost: parseFloat(row.unit_cost) || 0,
          status: row.status,
          scheduledDate: row.scheduled_date,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          notes: row.notes,
          linesCount: parseInt(row.lines_count) || 0,
          createdBy: row.created_by_email,
          confirmedBy: row.confirmed_by_email,
          completedBy: row.completed_by_email,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Production Orders API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener órdenes de producción'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/production-orders
 * Create a new production order
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
      bomId,
      warehouseId,
      quantityToProduce,
      scheduledDate,
      notes
    } = body

    // Validate required fields
    if (!bomId) {
      return NextResponse.json({
        success: false,
        error: 'La receta es requerida'
      }, { status: 400 })
    }

    if (!warehouseId) {
      return NextResponse.json({
        success: false,
        error: 'El almacén es requerido'
      }, { status: 400 })
    }

    if (!quantityToProduce || quantityToProduce <= 0) {
      return NextResponse.json({
        success: false,
        error: 'La cantidad a producir debe ser mayor a 0'
      }, { status: 400 })
    }

    // Get BOM and verify it exists
    const bomResult = await db.query(`
      SELECT
        bom.*,
        p.name as product_name
      FROM market_bill_of_materials bom
      LEFT JOIN market_products p ON bom.product_id = p.id
      WHERE bom.id = $1 AND bom.company_id = $2 AND bom.is_active = true
    `, [bomId, companyId])

    if (bomResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Receta no encontrada o inactiva'
      }, { status: 404 })
    }

    const bom = bomResult.rows[0]
    const outputQuantity = parseFloat(bom.output_quantity) || 1

    // Calculate how many "batches" we need (how many times to run the BOM)
    const batchMultiplier = quantityToProduce / outputQuantity

    // Get BOM lines
    const linesResult = await db.query(`
      SELECT
        bl.*,
        mp.name as product_name,
        mp.cost_price as product_cost_price,
        pv.cost_price as variant_cost_price
      FROM market_bom_lines bl
      LEFT JOIN market_products mp ON bl.product_id = mp.id
      LEFT JOIN market_product_variants pv ON bl.variant_id = pv.id
      WHERE bl.bom_id = $1
    `, [bomId])

    // Calculate required materials and check stock
    const materialsRequired: Array<{
      productId: number
      variantId: number | null
      productName: string
      quantityRequired: number
      unitCost: number
      totalCost: number
      stockAvailable: number
      hasStock: boolean
    }> = []

    let totalMaterialCost = 0

    for (const line of linesResult.rows) {
      const quantityRequired = (parseFloat(line.quantity_required) || 0) * batchMultiplier
      const unitCost = parseFloat(line.variant_cost_price || line.product_cost_price) || 0
      const lineTotalCost = unitCost * quantityRequired
      totalMaterialCost += lineTotalCost

      // Check stock in warehouse
      const stockResult = await db.query(`
        SELECT COALESCE(quantity_on_hand, 0) - COALESCE(quantity_reserved, 0) as available
        FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2 AND COALESCE(variant_id, 0) = COALESCE($3, 0)
      `, [warehouseId, line.product_id, line.variant_id])

      const stockAvailable = parseFloat(stockResult.rows[0]?.available) || 0

      materialsRequired.push({
        productId: line.product_id,
        variantId: line.variant_id,
        productName: line.product_name,
        quantityRequired,
        unitCost,
        totalCost: lineTotalCost,
        stockAvailable,
        hasStock: stockAvailable >= quantityRequired
      })
    }

    // Check if we have enough stock
    const insufficientStock = materialsRequired.filter(m => !m.hasStock)
    if (insufficientStock.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Stock insuficiente para algunos materiales',
        data: {
          insufficientMaterials: insufficientStock.map(m => ({
            productName: m.productName,
            required: m.quantityRequired,
            available: m.stockAvailable,
            shortage: m.quantityRequired - m.stockAvailable
          }))
        }
      }, { status: 400 })
    }

    // Calculate unit cost
    const unitCost = totalMaterialCost / quantityToProduce

    // Generate production number
    const year = new Date().getFullYear()
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM market_production_orders WHERE company_id = $1 AND EXTRACT(YEAR FROM created_at) = $2`,
      [companyId, year]
    )
    const sequenceNumber = (parseInt(countResult.rows[0]?.count) || 0) + 1
    const productionNumber = `PRD-${year}-${sequenceNumber.toString().padStart(4, '0')}`

    // Create production order
    const result = await db.query(`
      INSERT INTO market_production_orders (
        company_id, production_number, bom_id, warehouse_id,
        quantity_to_produce, total_material_cost, unit_cost,
        status, scheduled_date, notes,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10, NOW(), NOW()
      ) RETURNING id
    `, [
      companyId, productionNumber, bomId, warehouseId,
      quantityToProduce, totalMaterialCost, unitCost,
      scheduledDate || null, notes || null, userId
    ])

    const orderId = result.rows[0].id

    // Create order lines
    for (const material of materialsRequired) {
      await db.query(`
        INSERT INTO market_production_order_lines (
          production_order_id, product_id, variant_id,
          quantity_planned, unit_cost, total_cost,
          line_status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
      `, [
        orderId,
        material.productId,
        material.variantId,
        material.quantityRequired,
        material.unitCost,
        material.totalCost
      ])
    }

    return NextResponse.json({
      success: true,
      data: {
        id: orderId,
        productionNumber,
        quantityToProduce,
        totalMaterialCost,
        unitCost,
        materials: materialsRequired
      },
      message: 'Orden de producción creada exitosamente'
    })

  } catch (error) {
    console.error('[Production Orders API] Error creating order:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear orden de producción'
    }, { status: 500 })
  }
}
