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
 * POST /api/market/production/plans/[id]/issue-materials
 * Issue materials from warehouse for production
 * Transition: scheduled -> materials_issued
 * - Deducts stock from warehouse
 * - Records stock movements
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
      SELECT p.*, f.name as formula_name, f.target_product_id, w.name as warehouse_name
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
    if (plan.status !== 'scheduled') {
      return NextResponse.json({
        success: false,
        error: `No se pueden entregar materiales para un plan en estado "${plan.status}". El plan debe estar programado.`
      }, { status: 400 })
    }

    // Get materials to issue
    const materialsResult = await db.query(`
      SELECT
        pm.id,
        pm.raw_material_id,
        pm.quantity_required,
        pm.unit_cost,
        p.name as material_name
      FROM market_production_plan_materials pm
      JOIN market_products p ON pm.raw_material_id = p.id
      WHERE pm.plan_id = $1 AND pm.status = 'pending'
    `, [planId])

    if (materialsResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay materiales pendientes de entregar'
      }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const { materials: issuedMaterials } = body

    // Start transaction
    await db.query('BEGIN')

    try {
      let totalMaterialsCost = 0
      const issuedItems: { material: string; quantity: number; cost: number }[] = []

      for (const mat of materialsResult.rows) {
        const quantityToIssue = parseFloat(mat.quantity_required)

        // Check if specific quantity was provided
        let actualQuantity = quantityToIssue
        if (issuedMaterials && Array.isArray(issuedMaterials)) {
          const override = issuedMaterials.find((m: any) => m.id === mat.id)
          if (override && typeof override.quantity === 'number') {
            actualQuantity = override.quantity
          }
        }

        // Get current stock
        const stockResult = await db.query(`
          SELECT quantity_on_hand FROM market_warehouse_stock
          WHERE product_id = $1 AND warehouse_id = $2
        `, [mat.raw_material_id, plan.warehouse_id])

        const currentStock = parseFloat(stockResult.rows[0]?.quantity_on_hand || '0')

        // Check if enough stock
        if (currentStock < actualQuantity) {
          throw new Error(`Stock insuficiente para "${mat.material_name}". Disponible: ${currentStock}, Requerido: ${actualQuantity}`)
        }

        // Deduct from warehouse stock
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = quantity_on_hand - $1,
              last_movement_at = NOW(),
              updated_at = NOW()
          WHERE product_id = $2 AND warehouse_id = $3
        `, [actualQuantity, mat.raw_material_id, plan.warehouse_id])

        // Also update global product stock
        await db.query(`
          UPDATE market_products
          SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1),
              updated_at = NOW()
          WHERE id = $2
        `, [actualQuantity, mat.raw_material_id])

        // Record stock movement
        await db.query(`
          INSERT INTO market_stock_movements (
            company_id, product_id, movement_type,
            from_warehouse_id, quantity, quantity_before, quantity_after,
            reference_type, reference_id, notes, created_by
          ) VALUES ($1, $2, 'production_issue', $3, $4, $5, $6, 'production_plan', $7, $8, $9)
        `, [
          companyId,
          mat.raw_material_id,
          plan.warehouse_id,
          actualQuantity,
          currentStock,
          currentStock - actualQuantity,
          planId,
          `Entrega de materiales para ${plan.plan_number}`,
          userId
        ])

        // Update material line status
        const lineCost = actualQuantity * parseFloat(mat.unit_cost)
        await db.query(`
          UPDATE market_production_plan_materials
          SET quantity_issued = $1,
              total_cost = $2,
              status = 'issued',
              issued_at = NOW(),
              issued_by = $3
          WHERE id = $4
        `, [actualQuantity, lineCost, userId, mat.id])

        totalMaterialsCost += lineCost
        issuedItems.push({
          material: mat.material_name,
          quantity: actualQuantity,
          cost: lineCost
        })
      }

      // Update plan status and costs
      await db.query(`
        UPDATE market_production_plans
        SET status = 'materials_issued',
            materials_cost = $1,
            total_cost = $1 + labor_cost,
            cost_per_unit = ($1 + labor_cost) / planned_quantity,
            materials_issued_by = $2,
            materials_issued_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
      `, [totalMaterialsCost, userId, planId])

      await db.query('COMMIT')

      console.log('[Issue Materials API] Issued materials for plan:', plan.plan_number, '| Items:', issuedItems.length)

      return NextResponse.json({
        success: true,
        message: `Materiales entregados para ${plan.plan_number}`,
        data: {
          planNumber: plan.plan_number,
          formulaName: plan.formula_name,
          warehouseName: plan.warehouse_name,
          status: 'materials_issued',
          issuedItems,
          totalMaterialsCost
        }
      })

    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('[Issue Materials API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al entregar materiales'
    }, { status: 500 })
  }
}
