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
 * GET /api/market/production/plans/[id]
 * Get a production plan with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const planId = parseInt(id)

    if (isNaN(planId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de plan inválido'
      }, { status: 400 })
    }

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

    // Get plan
    const planResult = await db.query(`
      SELECT
        p.*,
        f.code as formula_code,
        f.name as formula_name,
        f.yield_quantity as formula_yield,
        f.yield_unit as formula_unit,
        f.labor_cost_per_batch as formula_labor_cost,
        f.target_product_id,
        tp.name as target_product_name,
        tp.sku as target_product_sku,
        tp.image_url as target_product_image,
        tp.selling_price as target_product_price,
        tp.cost_price as target_product_current_cost,
        w.name as warehouse_name,
        w.code as warehouse_code,
        tw.name as target_warehouse_name,
        tw.code as target_warehouse_code,
        COALESCE(uc.firstname || ' ' || uc.lastname, uc.email) as created_by_name,
        COALESCE(us.firstname || ' ' || us.lastname, us.email) as scheduled_by_name,
        COALESCE(ui.firstname || ' ' || ui.lastname, ui.email) as materials_issued_by_name,
        COALESCE(ustart.firstname || ' ' || ustart.lastname, ustart.email) as started_by_name,
        COALESCE(ucomp.firstname || ' ' || ucomp.lastname, ucomp.email) as completed_by_name
      FROM market_production_plans p
      LEFT JOIN market_production_formulas f ON p.formula_id = f.id
      LEFT JOIN market_products tp ON f.target_product_id = tp.id
      LEFT JOIN market_warehouses w ON p.warehouse_id = w.id
      LEFT JOIN market_warehouses tw ON p.target_warehouse_id = tw.id
      LEFT JOIN users uc ON p.created_by = uc.id
      LEFT JOIN users us ON p.scheduled_by = us.id
      LEFT JOIN users ui ON p.materials_issued_by = ui.id
      LEFT JOIN users ustart ON p.started_by = ustart.id
      LEFT JOIN users ucomp ON p.completed_by = ucomp.id
      WHERE p.id = $1 AND p.company_id = $2
    `, [planId, companyId])

    if (planResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Plan no encontrado'
      }, { status: 404 })
    }

    const plan = planResult.rows[0]

    // Get materials with stock availability
    const materialsResult = await db.query(`
      SELECT
        pm.id,
        pm.raw_material_id,
        pm.quantity_required,
        pm.quantity_issued,
        pm.unit_cost,
        pm.total_cost,
        pm.status,
        pm.issued_at,
        p.name as material_name,
        p.sku as material_sku,
        p.image_url as material_image,
        p.unit_of_measure as material_unit,
        p.cost_price as current_cost,
        (SELECT COALESCE(SUM(ws.quantity_on_hand), 0)
         FROM market_warehouse_stock ws
         WHERE ws.product_id = pm.raw_material_id AND ws.warehouse_id = $2) as available_stock
      FROM market_production_plan_materials pm
      JOIN market_products p ON pm.raw_material_id = p.id
      WHERE pm.plan_id = $1
      ORDER BY pm.id ASC
    `, [planId, plan.warehouse_id])

    // Calculate availability status
    const materials = materialsResult.rows.map(row => ({
      id: row.id,
      rawMaterialId: row.raw_material_id,
      materialName: row.material_name,
      materialSku: row.material_sku,
      materialImage: row.material_image,
      materialUnit: row.material_unit,
      quantityRequired: parseFloat(row.quantity_required) || 0,
      quantityIssued: parseFloat(row.quantity_issued) || 0,
      unitCost: parseFloat(row.unit_cost) || 0,
      totalCost: parseFloat(row.total_cost) || 0,
      currentCost: parseFloat(row.current_cost) || 0,
      availableStock: parseFloat(row.available_stock) || 0,
      status: row.status,
      issuedAt: row.issued_at,
      isAvailable: parseFloat(row.available_stock) >= parseFloat(row.quantity_required),
      shortage: Math.max(0, parseFloat(row.quantity_required) - parseFloat(row.available_stock))
    }))

    const allMaterialsAvailable = materials.every(m => m.isAvailable)
    const totalShortage = materials.filter(m => !m.isAvailable).length

    return NextResponse.json({
      success: true,
      data: {
        id: plan.id,
        planNumber: plan.plan_number,
        formulaId: plan.formula_id,
        formulaCode: plan.formula_code,
        formulaName: plan.formula_name,
        formulaYield: parseFloat(plan.formula_yield) || 1,
        formulaUnit: plan.formula_unit,
        targetProductId: plan.target_product_id,
        targetProductName: plan.target_product_name,
        targetProductSku: plan.target_product_sku,
        targetProductImage: plan.target_product_image,
        targetProductPrice: parseFloat(plan.target_product_price) || 0,
        targetProductCurrentCost: parseFloat(plan.target_product_current_cost) || 0,
        warehouseId: plan.warehouse_id,
        warehouseName: plan.warehouse_name,
        warehouseCode: plan.warehouse_code,
        targetWarehouseId: plan.target_warehouse_id,
        targetWarehouseName: plan.target_warehouse_name,
        targetWarehouseCode: plan.target_warehouse_code,
        plannedDate: plan.planned_date,
        plannedQuantity: parseFloat(plan.planned_quantity) || 0,
        batches: plan.batches || 1,
        status: plan.status,
        lotNumber: plan.lot_number,
        barcode: plan.barcode,
        actualQuantity: plan.actual_quantity ? parseFloat(plan.actual_quantity) : null,
        wasteQuantity: parseFloat(plan.waste_quantity) || 0,
        materialsCost: parseFloat(plan.materials_cost) || 0,
        laborCost: parseFloat(plan.labor_cost) || 0,
        totalCost: parseFloat(plan.total_cost) || 0,
        costPerUnit: plan.cost_per_unit ? parseFloat(plan.cost_per_unit) : null,
        notes: plan.notes,
        cancellationReason: plan.cancellation_reason || null,
        cancelledAt: plan.cancelled_at || null,
        createdAt: plan.created_at,
        createdByName: plan.created_by_name,
        scheduledByName: plan.scheduled_by_name,
        materialsIssuedAt: plan.materials_issued_at,
        materialsIssuedByName: plan.materials_issued_by_name,
        startedAt: plan.started_at,
        startedByName: plan.started_by_name,
        completedAt: plan.completed_at,
        completedByName: plan.completed_by_name,
        materials,
        availability: {
          allAvailable: allMaterialsAvailable,
          shortageCount: totalShortage,
          canSchedule: allMaterialsAvailable
        }
      }
    })

  } catch (error) {
    console.error('[Production Plans API] GET Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener plan'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/market/production/plans/[id]
 * Update plan (notes, dates) or change status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const planId = parseInt(id)

    if (isNaN(planId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de plan inválido'
      }, { status: 400 })
    }

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

    // Check plan exists
    const existingPlan = await db.query(
      'SELECT id, status, plan_number FROM market_production_plans WHERE id = $1 AND company_id = $2',
      [planId, companyId]
    )

    if (existingPlan.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Plan no encontrado'
      }, { status: 404 })
    }

    const body = await request.json()
    const { plannedDate, notes, batches } = body

    // Only allow updates on draft plans
    if (existingPlan.rows[0].status !== 'draft') {
      if (plannedDate || batches) {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden modificar planes en estado borrador'
        }, { status: 400 })
      }
    }

    // Build update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (plannedDate !== undefined) {
      updates.push(`planned_date = $${paramIndex++}`)
      values.push(plannedDate)
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`)
      values.push(notes)
    }
    if (batches !== undefined) {
      updates.push(`batches = $${paramIndex++}`)
      values.push(batches)
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay cambios para actualizar'
      }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(planId)

    await db.query(`
      UPDATE market_production_plans
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
    `, values)

    console.log('[Production Plans API] Updated plan:', existingPlan.rows[0].plan_number)

    return NextResponse.json({
      success: true,
      message: 'Plan actualizado exitosamente'
    })

  } catch (error) {
    console.error('[Production Plans API] PATCH Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar plan'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/production/plans/[id]
 * Cancel a production plan (only if draft or scheduled)
 * Use ?force=true to permanently delete any plan (ADMIN only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const planId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    if (isNaN(planId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de plan inválido'
      }, { status: 400 })
    }

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

    // Check plan exists
    const existingPlan = await db.query(
      'SELECT id, status, plan_number FROM market_production_plans WHERE id = $1 AND company_id = $2',
      [planId, companyId]
    )

    if (existingPlan.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Plan no encontrado'
      }, { status: 404 })
    }

    const plan = existingPlan.rows[0]

    // Force delete - permanently removes the plan (ADMIN only)
    if (force) {
      if (payload.role !== 'ADMIN' && payload.role !== 'SUPER_ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'Solo administradores pueden eliminar permanentemente'
        }, { status: 403 })
      }

      // Delete materials first, then the plan
      await db.query('DELETE FROM market_production_plan_materials WHERE plan_id = $1', [planId])
      await db.query('DELETE FROM market_production_plans WHERE id = $1', [planId])

      console.log('[Production Plans API] Force deleted plan:', plan.plan_number)

      return NextResponse.json({
        success: true,
        message: `Plan ${plan.plan_number} eliminado permanentemente`
      })
    }

    // Normal cancellation - only allow draft or scheduled plans
    if (!['draft', 'scheduled'].includes(plan.status)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden cancelar planes en estado borrador o programado'
      }, { status: 400 })
    }

    // Read cancellation reason from body
    let cancellationReason: string | null = null
    try {
      const body = await request.json()
      cancellationReason = body.cancellationReason || null
    } catch { /* no body or invalid JSON */ }

    // Ensure cancellation columns exist
    try {
      await db.query(`ALTER TABLE market_production_plans ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`)
      await db.query(`ALTER TABLE market_production_plans ADD COLUMN IF NOT EXISTS cancelled_by INTEGER`)
      await db.query(`ALTER TABLE market_production_plans ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`)
    } catch { /* columns may already exist */ }

    // Update status to cancelled with reason
    await db.query(`
      UPDATE market_production_plans
      SET status = 'cancelled', cancellation_reason = $2, cancelled_by = $3, cancelled_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [planId, cancellationReason, payload.userId])

    console.log('[Production Plans API] Cancelled plan:', plan.plan_number, 'Reason:', cancellationReason)

    return NextResponse.json({
      success: true,
      message: `Plan ${plan.plan_number} cancelado exitosamente`
    })

  } catch (error) {
    console.error('[Production Plans API] DELETE Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al cancelar plan'
    }, { status: 500 })
  }
}
