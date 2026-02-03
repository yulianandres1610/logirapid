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
 * Generate production order number: PRD-YYYY-XXXX
 */
async function generateOrderNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PRD-${year}-`

  const result = await db.query(`
    SELECT order_number FROM market_production_orders
    WHERE company_id = $1 AND order_number LIKE $2
    ORDER BY order_number DESC
    LIMIT 1
  `, [companyId, `${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].order_number
    const parts = lastNumber.split('-')
    nextNumber = parseInt(parts[2]) + 1
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

/**
 * GET /api/market/production/orders
 * List production orders with filters and pagination
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
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        po.id,
        po.order_number,
        po.status,
        po.source_weight_kg,
        po.target_quantity,
        po.target_portion_weight_kg,
        po.expected_total_weight_kg,
        po.waste_surplus_kg,
        po.waste_surplus_type,
        po.actual_quantity,
        po.actual_waste_surplus_kg,
        po.materials_cost,
        po.labor_cost,
        po.total_cost,
        po.cost_per_unit,
        po.created_at,
        po.started_at,
        po.completed_at,
        po.notes,
        sp.id as source_product_id,
        sp.name as source_product_name,
        sp.sku as source_product_sku,
        sp.image_url as source_product_image,
        tp.id as target_product_id,
        tp.name as target_product_name,
        tp.sku as target_product_sku,
        tp.image_url as target_product_image,
        sw.name as source_warehouse_name,
        tw.name as target_warehouse_name,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name
      FROM market_production_orders po
      LEFT JOIN market_products sp ON po.source_product_id = sp.id
      LEFT JOIN market_products tp ON po.target_product_id = tp.id
      LEFT JOIN market_warehouses sw ON po.source_warehouse_id = sw.id
      LEFT JOIN market_warehouses tw ON po.target_warehouse_id = tw.id
      LEFT JOIN users u ON po.created_by = u.id
      WHERE po.company_id = $1
    `
    const params: any[] = [companyId]
    let paramIndex = 2

    if (status) {
      query += ` AND po.status = $${paramIndex++}`
      params.push(status)
    }

    if (search) {
      query += ` AND (
        po.order_number ILIKE $${paramIndex} OR
        sp.name ILIKE $${paramIndex} OR
        tp.name ILIKE $${paramIndex}
      )`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (startDate) {
      query += ` AND po.created_at >= $${paramIndex++}`
      params.push(startDate)
    }

    if (endDate) {
      query += ` AND po.created_at <= $${paramIndex++}`
      params.push(endDate + ' 23:59:59')
    }

    query += ` ORDER BY po.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM market_production_orders po WHERE po.company_id = $1`
    const countParams: any[] = [companyId]
    let countParamIndex = 2

    if (status) {
      countQuery += ` AND po.status = $${countParamIndex++}`
      countParams.push(status)
    }
    if (search) {
      countQuery += ` AND po.order_number ILIKE $${countParamIndex++}`
      countParams.push(`%${search}%`)
    }
    if (startDate) {
      countQuery += ` AND po.created_at >= $${countParamIndex++}`
      countParams.push(startDate)
    }
    if (endDate) {
      countQuery += ` AND po.created_at <= $${countParamIndex++}`
      countParams.push(endDate + ' 23:59:59')
    }

    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0].count)

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COALESCE(SUM(total_cost), 0) as total_value,
        COALESCE(SUM(total_cost) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)), 0) as this_month_value,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as this_month_count
      FROM market_production_orders
      WHERE company_id = $1
    `, [companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        orders: result.rows.map(row => ({
          id: row.id,
          orderNumber: row.order_number,
          status: row.status,
          sourceProduct: {
            id: row.source_product_id,
            name: row.source_product_name,
            sku: row.source_product_sku,
            imageUrl: row.source_product_image
          },
          targetProduct: {
            id: row.target_product_id,
            name: row.target_product_name,
            sku: row.target_product_sku,
            imageUrl: row.target_product_image
          },
          sourceWarehouse: row.source_warehouse_name,
          targetWarehouse: row.target_warehouse_name,
          sourceWeight: parseFloat(row.source_weight_kg) || 0,
          targetQuantity: row.target_quantity,
          targetPortionWeight: parseFloat(row.target_portion_weight_kg) || 0,
          expectedTotalWeight: parseFloat(row.expected_total_weight_kg) || 0,
          wasteSurplus: {
            kg: parseFloat(row.waste_surplus_kg) || 0,
            type: row.waste_surplus_type
          },
          actualQuantity: row.actual_quantity,
          actualWasteSurplus: parseFloat(row.actual_waste_surplus_kg) || 0,
          materialsCost: parseFloat(row.materials_cost) || 0,
          laborCost: parseFloat(row.labor_cost) || 0,
          totalCost: parseFloat(row.total_cost) || 0,
          costPerUnit: parseFloat(row.cost_per_unit) || 0,
          createdAt: row.created_at,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          createdByName: row.created_by_name,
          notes: row.notes
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          total: {
            count: parseInt(stats.total_count) || 0,
            value: parseFloat(stats.total_value) || 0
          },
          thisMonth: {
            count: parseInt(stats.this_month_count) || 0,
            value: parseFloat(stats.this_month_value) || 0
          },
          pending: {
            count: parseInt(stats.pending_count) || 0
          },
          inProgress: {
            count: parseInt(stats.in_progress_count) || 0
          },
          completed: {
            count: parseInt(stats.completed_count) || 0
          }
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
 * POST /api/market/production/orders
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
      sourceProductId,
      sourceVariantId,
      sourceWarehouseId,
      sourceQuantity = 1,
      sourceUnitCost,
      sourceWeightKg,
      targetProductId,
      targetVariantId,
      targetWarehouseId,
      targetPortionWeightKg,
      targetQuantity,
      materials,
      laborCost,
      notes
    } = body

    // Validations
    if (!sourceProductId || !sourceWarehouseId || !sourceWeightKg) {
      return NextResponse.json({
        success: false,
        error: 'Datos del producto fuente requeridos'
      }, { status: 400 })
    }

    if (!targetProductId || !targetWarehouseId || !targetPortionWeightKg || !targetQuantity) {
      return NextResponse.json({
        success: false,
        error: 'Datos del producto final requeridos'
      }, { status: 400 })
    }

    // Get source product cost if not provided
    let finalSourceUnitCost = sourceUnitCost
    if (finalSourceUnitCost === undefined || finalSourceUnitCost === null) {
      const sourceProductResult = await db.query(`
        SELECT cost_price FROM market_products WHERE id = $1 AND company_id = $2
      `, [sourceProductId, companyId])

      if (sourceProductResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Producto fuente no encontrado'
        }, { status: 404 })
      }

      finalSourceUnitCost = parseFloat(sourceProductResult.rows[0].cost_price) || 0
    }

    // Calculate expected values
    const expectedTotalWeight = targetPortionWeightKg * targetQuantity
    const wasteSurplusKg = sourceWeightKg - expectedTotalWeight
    const wasteSurplusType = wasteSurplusKg > 0.001 ? 'surplus' :
                            wasteSurplusKg < -0.001 ? 'waste' : 'exact'

    // Calculate costs - basado en CANTIDAD (unidades), NO en peso
    const rawMaterialCost = sourceQuantity * finalSourceUnitCost
    let materialsCost = 0

    // Generate order number
    const orderNumber = await generateOrderNumber(companyId)

    // Start transaction
    const client = await db.getClient()

    try {
      await client.query('BEGIN')

      // Create production order
      const orderResult = await client.query(`
        INSERT INTO market_production_orders (
          company_id, order_number, status,
          source_product_id, source_variant_id, source_warehouse_id,
          source_quantity, source_unit_cost, source_weight_kg,
          target_product_id, target_variant_id, target_warehouse_id,
          target_portion_weight_kg, target_quantity,
          expected_total_weight_kg, waste_surplus_kg, waste_surplus_type,
          materials_cost, labor_cost, total_cost, cost_per_unit,
          created_by, created_at, notes
        ) VALUES (
          $1, $2, 'pending',
          $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11,
          $12, $13,
          $14, $15, $16,
          $17, $18, $19, $20,
          $21, NOW(), $22
        )
        RETURNING id
      `, [
        companyId, orderNumber,
        sourceProductId, sourceVariantId || null, sourceWarehouseId,
        sourceQuantity, finalSourceUnitCost, sourceWeightKg,
        targetProductId, targetVariantId || null, targetWarehouseId,
        targetPortionWeightKg, targetQuantity,
        expectedTotalWeight, wasteSurplusKg, wasteSurplusType,
        0, // materials_cost - will update after adding materials
        laborCost || 0,
        0, // total_cost - will update
        0, // cost_per_unit - will update
        userId, notes || null
      ])

      const orderId = orderResult.rows[0].id

      // Add materials if provided
      if (materials && Array.isArray(materials) && materials.length > 0) {
        for (const material of materials) {
          // Get material cost
          const materialResult = await client.query(`
            SELECT cost_price FROM market_products WHERE id = $1 AND company_id = $2
          `, [material.productId, companyId])

          const unitCost = materialResult.rows.length > 0
            ? parseFloat(materialResult.rows[0].cost_price) || 0
            : 0
          const totalMaterialCost = unitCost * material.quantity

          await client.query(`
            INSERT INTO market_production_materials (
              production_order_id, product_id, variant_id, warehouse_id,
              quantity, unit_cost, total_cost, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `, [
            orderId,
            material.productId,
            material.variantId || null,
            material.warehouseId,
            material.quantity,
            unitCost,
            totalMaterialCost
          ])

          materialsCost += totalMaterialCost
        }
      }

      // Calculate final costs
      const totalCost = rawMaterialCost + materialsCost + (laborCost || 0)
      const costPerUnit = targetQuantity > 0 ? totalCost / targetQuantity : 0

      // Update order with final costs
      await client.query(`
        UPDATE market_production_orders
        SET materials_cost = $1, total_cost = $2, cost_per_unit = $3
        WHERE id = $4
      `, [materialsCost, totalCost, costPerUnit, orderId])

      // Log creation
      await client.query(`
        INSERT INTO market_production_log (
          production_order_id, action, details, performed_by, performed_at
        ) VALUES ($1, 'created', $2, $3, NOW())
      `, [
        orderId,
        JSON.stringify({
          orderNumber,
          sourceQuantity,
          sourceUnitCost: finalSourceUnitCost,
          sourceWeightKg,
          targetQuantity,
          expectedTotalWeight,
          wasteSurplusKg,
          wasteSurplusType,
          rawMaterialCost,
          totalCost,
          costPerUnit
        }),
        userId
      ])

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: {
          orderId,
          orderNumber,
          wasteSurplus: {
            kg: wasteSurplusKg,
            type: wasteSurplusType,
            percentage: sourceWeightKg > 0 ? (wasteSurplusKg / sourceWeightKg * 100) : 0
          },
          totalCost,
          costPerUnit
        },
        message: 'Orden de producción creada exitosamente'
      })

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('[Production Orders API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear orden de producción'
    }, { status: 500 })
  }
}
