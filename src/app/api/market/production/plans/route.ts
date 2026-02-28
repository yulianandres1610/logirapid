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
 * Generate plan number: PLAN-YYYY-XXXXX
 */
async function generatePlanNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `PLAN-${year}-`

  const result = await db.query(`
    SELECT plan_number FROM market_production_plans
    WHERE company_id = $1 AND plan_number LIKE $2
    ORDER BY plan_number DESC
    LIMIT 1
  `, [companyId, `${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].plan_number
    const parts = lastNumber.split('-')
    nextNumber = parseInt(parts[2]) + 1
  }

  return `${prefix}${nextNumber.toString().padStart(5, '0')}`
}

/**
 * GET /api/market/production/plans
 * List production plans with filters, pagination, and calendar data
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
    const status = searchParams.get('status')
    const formulaId = searchParams.get('formulaId')
    const warehouseId = searchParams.get('warehouseId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const month = searchParams.get('month') // Format: YYYY-MM for calendar view
    const offset = (page - 1) * limit

    let query = `
      SELECT
        p.id,
        p.plan_number,
        p.formula_id,
        p.warehouse_id,
        p.target_warehouse_id,
        p.planned_date,
        p.planned_quantity,
        p.batches,
        p.status,
        p.lot_number,
        p.barcode,
        p.actual_quantity,
        p.waste_quantity,
        p.materials_cost,
        p.labor_cost,
        p.total_cost,
        p.cost_per_unit,
        p.notes,
        p.created_at,
        p.materials_issued_at,
        p.started_at,
        p.completed_at,
        f.code as formula_code,
        f.name as formula_name,
        f.yield_quantity as formula_yield,
        f.yield_unit as formula_unit,
        tp.name as target_product_name,
        tp.image_url as target_product_image,
        w.name as warehouse_name,
        tw.name as target_warehouse_name,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name,
        (SELECT COUNT(*) FROM market_production_plan_materials WHERE plan_id = p.id) as material_count,
        (SELECT COUNT(*) FILTER (WHERE status = 'issued') FROM market_production_plan_materials WHERE plan_id = p.id) as materials_issued_count
      FROM market_production_plans p
      LEFT JOIN market_production_formulas f ON p.formula_id = f.id
      LEFT JOIN market_products tp ON f.target_product_id = tp.id
      LEFT JOIN market_warehouses w ON p.warehouse_id = w.id
      LEFT JOIN market_warehouses tw ON p.target_warehouse_id = tw.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.company_id = $1
    `
    const params: any[] = [companyId]
    let paramIndex = 2

    if (status) {
      query += ` AND p.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (formulaId) {
      query += ` AND p.formula_id = $${paramIndex}`
      params.push(parseInt(formulaId))
      paramIndex++
    }

    if (warehouseId) {
      query += ` AND p.warehouse_id = $${paramIndex}`
      params.push(parseInt(warehouseId))
      paramIndex++
    }

    if (startDate) {
      query += ` AND p.planned_date >= $${paramIndex}`
      params.push(startDate)
      paramIndex++
    }

    if (endDate) {
      query += ` AND p.planned_date <= $${paramIndex}`
      params.push(endDate)
      paramIndex++
    }

    if (month) {
      // Calendar view - get all plans for the month
      query += ` AND TO_CHAR(p.planned_date, 'YYYY-MM') = $${paramIndex}`
      params.push(month)
      paramIndex++
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total FROM market_production_plans p
      WHERE p.company_id = $1
      ${status ? `AND p.status = $${params.indexOf(status) + 1}` : ''}
      ${formulaId ? `AND p.formula_id = $${params.indexOf(parseInt(formulaId)) + 1}` : ''}
      ${warehouseId ? `AND p.warehouse_id = $${params.indexOf(parseInt(warehouseId)) + 1}` : ''}
      ${startDate ? `AND p.planned_date >= $${params.indexOf(startDate) + 1}` : ''}
      ${endDate ? `AND p.planned_date <= $${params.indexOf(endDate) + 1}` : ''}
      ${month ? `AND TO_CHAR(p.planned_date, 'YYYY-MM') = $${params.indexOf(month) + 1}` : ''}
    `

    const countResult = await db.query(countQuery, params.slice(0, paramIndex - 1))
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Add ordering and pagination
    query += ` ORDER BY p.planned_date DESC, p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE status = 'materials_issued') as materials_issued,
        COUNT(*) FILTER (WHERE status = 'in_production') as in_production,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE planned_date = CURRENT_DATE) as today,
        COUNT(*) FILTER (WHERE planned_date >= CURRENT_DATE AND planned_date < CURRENT_DATE + INTERVAL '7 days') as this_week
      FROM market_production_plans
      WHERE company_id = $1
    `, [companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        plans: result.rows.map(row => ({
          id: row.id,
          planNumber: row.plan_number,
          formulaId: row.formula_id,
          formulaCode: row.formula_code,
          formulaName: row.formula_name,
          formulaYield: parseFloat(row.formula_yield) || 1,
          formulaUnit: row.formula_unit,
          targetProductName: row.target_product_name,
          targetProductImage: row.target_product_image,
          warehouseId: row.warehouse_id,
          warehouseName: row.warehouse_name,
          targetWarehouseId: row.target_warehouse_id,
          targetWarehouseName: row.target_warehouse_name,
          plannedDate: row.planned_date,
          plannedQuantity: parseFloat(row.planned_quantity) || 0,
          batches: row.batches || 1,
          status: row.status,
          lotNumber: row.lot_number,
          barcode: row.barcode,
          actualQuantity: row.actual_quantity ? parseFloat(row.actual_quantity) : null,
          wasteQuantity: parseFloat(row.waste_quantity) || 0,
          materialsCost: parseFloat(row.materials_cost) || 0,
          laborCost: parseFloat(row.labor_cost) || 0,
          totalCost: parseFloat(row.total_cost) || 0,
          costPerUnit: row.cost_per_unit ? parseFloat(row.cost_per_unit) : null,
          notes: row.notes,
          createdAt: row.created_at,
          materialsIssuedAt: row.materials_issued_at,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          createdByName: row.created_by_name,
          materialCount: parseInt(row.material_count) || 0,
          materialsIssuedCount: parseInt(row.materials_issued_count) || 0
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          total: parseInt(stats.total) || 0,
          draft: parseInt(stats.draft) || 0,
          scheduled: parseInt(stats.scheduled) || 0,
          materialsIssued: parseInt(stats.materials_issued) || 0,
          inProduction: parseInt(stats.in_production) || 0,
          completed: parseInt(stats.completed) || 0,
          cancelled: parseInt(stats.cancelled) || 0,
          today: parseInt(stats.today) || 0,
          thisWeek: parseInt(stats.this_week) || 0
        }
      }
    })

  } catch (error) {
    console.error('[Production Plans API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener planes'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/production/plans
 * Create a new production plan with calculated materials
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
      formulaId,
      warehouseId,
      targetWarehouseId,
      plannedDate,
      plannedQuantity,
      batches,
      notes
    } = body

    // Validation
    if (!formulaId) {
      return NextResponse.json({
        success: false,
        error: 'La fórmula es requerida'
      }, { status: 400 })
    }

    if (!warehouseId) {
      return NextResponse.json({
        success: false,
        error: 'El almacén de materiales es requerido'
      }, { status: 400 })
    }

    if (!plannedDate) {
      return NextResponse.json({
        success: false,
        error: 'La fecha planificada es requerida'
      }, { status: 400 })
    }

    if (!plannedQuantity || plannedQuantity <= 0) {
      return NextResponse.json({
        success: false,
        error: 'La cantidad debe ser mayor a 0'
      }, { status: 400 })
    }

    // Verify formula exists and get its details
    const formulaResult = await db.query(`
      SELECT f.*, p.name as target_product_name
      FROM market_production_formulas f
      LEFT JOIN market_products p ON f.target_product_id = p.id
      WHERE f.id = $1 AND f.company_id = $2 AND f.is_active = true
    `, [formulaId, companyId])

    if (formulaResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Fórmula no encontrada o inactiva'
      }, { status: 400 })
    }

    const formula = formulaResult.rows[0]

    // Verify warehouse exists
    const warehouseCheck = await db.query(
      'SELECT id FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 400 })
    }

    // Get formula lines to calculate materials
    const formulaLinesResult = await db.query(`
      SELECT fl.*, p.name as material_name, p.cost_price, p.unit_of_measure
      FROM market_production_formula_lines fl
      JOIN market_products p ON fl.raw_material_id = p.id
      WHERE fl.formula_id = $1
    `, [formulaId])

    if (formulaLinesResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'La fórmula no tiene materias primas definidas'
      }, { status: 400 })
    }

    // Calculate materials needed based on quantity
    const yieldQuantity = parseFloat(formula.yield_quantity) || 1
    const multiplier = plannedQuantity / yieldQuantity

    // Start transaction
    await db.query('BEGIN')

    try {
      // Generate plan number
      const planNumber = await generatePlanNumber(companyId)

      // Calculate labor cost
      const laborCost = (parseFloat(formula.labor_cost_per_batch) || 0) * (batches || 1)

      // Create plan
      const planResult = await db.query(`
        INSERT INTO market_production_plans (
          company_id, plan_number, formula_id, warehouse_id, target_warehouse_id,
          planned_date, planned_quantity, batches, status,
          labor_cost, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10, $11)
        RETURNING id
      `, [
        companyId,
        planNumber,
        formulaId,
        warehouseId,
        targetWarehouseId || warehouseId,
        plannedDate,
        plannedQuantity,
        batches || 1,
        laborCost,
        notes || null,
        userId
      ])

      const planId = planResult.rows[0].id

      // Calculate and insert materials
      let totalMaterialsCost = 0
      for (const line of formulaLinesResult.rows) {
        const quantityRequired = parseFloat(line.quantity) * multiplier
        const unitCost = parseFloat(line.cost_price) || 0
        const lineCost = quantityRequired * unitCost
        totalMaterialsCost += lineCost

        await db.query(`
          INSERT INTO market_production_plan_materials (
            plan_id, raw_material_id, quantity_required, unit_cost, total_cost, status
          ) VALUES ($1, $2, $3, $4, $5, 'pending')
        `, [planId, line.raw_material_id, quantityRequired, unitCost, lineCost])
      }

      // Update plan with materials cost
      const totalCost = totalMaterialsCost + laborCost
      const costPerUnit = totalCost / plannedQuantity

      await db.query(`
        UPDATE market_production_plans
        SET materials_cost = $1, total_cost = $2, cost_per_unit = $3
        WHERE id = $4
      `, [totalMaterialsCost, totalCost, costPerUnit, planId])

      await db.query('COMMIT')

      console.log('[Production Plans API] Created plan:', planNumber)

      return NextResponse.json({
        success: true,
        data: {
          id: planId,
          planNumber,
          formulaName: formula.name,
          targetProductName: formula.target_product_name,
          plannedDate,
          plannedQuantity,
          materialsCost: totalMaterialsCost,
          laborCost,
          totalCost,
          costPerUnit,
          materialCount: formulaLinesResult.rows.length
        },
        message: `Plan ${planNumber} creado exitosamente`
      })

    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('[Production Plans API] POST Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear plan'
    }, { status: 500 })
  }
}
