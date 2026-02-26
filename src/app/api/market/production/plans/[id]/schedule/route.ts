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
 * POST /api/market/production/plans/[id]/schedule
 * Schedule a draft plan (creates material pickup order for warehouse)
 * Transition: draft -> scheduled
 */
export async function POST(
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
    const userId = payload.userId

    // Get plan with current status
    const planResult = await db.query(`
      SELECT p.*, f.name as formula_name, w.name as warehouse_name
      FROM market_production_plans p
      LEFT JOIN market_production_formulas f ON p.formula_id = f.id
      LEFT JOIN market_warehouses w ON p.warehouse_id = w.id
      WHERE p.id = $1 AND p.company_id = $2
    `, [planId, companyId])

    if (planResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Plan no encontrado'
      }, { status: 404 })
    }

    const plan = planResult.rows[0]

    // Validate current status
    if (plan.status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: `No se puede programar un plan en estado "${plan.status}". Solo planes en borrador.`
      }, { status: 400 })
    }

    // Check material availability
    const materialsResult = await db.query(`
      SELECT
        pm.raw_material_id,
        pm.quantity_required,
        p.name as material_name,
        (SELECT COALESCE(SUM(ws.quantity_on_hand), 0)
         FROM market_warehouse_stock ws
         WHERE ws.product_id = pm.raw_material_id AND ws.warehouse_id = $2) as available_stock
      FROM market_production_plan_materials pm
      JOIN market_products p ON pm.raw_material_id = p.id
      WHERE pm.plan_id = $1
    `, [planId, plan.warehouse_id])

    const shortages: { material: string; required: number; available: number }[] = []
    for (const mat of materialsResult.rows) {
      const required = parseFloat(mat.quantity_required)
      const available = parseFloat(mat.available_stock)
      if (available < required) {
        shortages.push({
          material: mat.material_name,
          required,
          available
        })
      }
    }

    // Check if user wants to force schedule despite shortages
    const body = await request.json().catch(() => ({}))
    const forceSchedule = body.force === true

    if (shortages.length > 0 && !forceSchedule) {
      return NextResponse.json({
        success: false,
        error: 'No hay suficiente stock de materiales',
        shortages,
        canForce: true,
        message: 'Algunos materiales no tienen stock suficiente. Puede forzar la programación si desea continuar.'
      }, { status: 400 })
    }

    // Update plan status to scheduled
    await db.query(`
      UPDATE market_production_plans
      SET status = 'scheduled',
          scheduled_by = $1,
          updated_at = NOW()
      WHERE id = $2
    `, [userId, planId])

    console.log('[Schedule API] Scheduled plan:', plan.plan_number, '| Shortages:', shortages.length)

    return NextResponse.json({
      success: true,
      message: `Plan ${plan.plan_number} programado exitosamente`,
      data: {
        planNumber: plan.plan_number,
        formulaName: plan.formula_name,
        warehouseName: plan.warehouse_name,
        plannedDate: plan.planned_date,
        status: 'scheduled',
        shortages: shortages.length > 0 ? shortages : null,
        warning: shortages.length > 0 ? 'Programado con faltantes de stock' : null
      }
    })

  } catch (error) {
    console.error('[Schedule API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al programar plan'
    }, { status: 500 })
  }
}
