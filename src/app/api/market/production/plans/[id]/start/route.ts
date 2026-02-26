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
 * POST /api/market/production/plans/[id]/start
 * Start production
 * Transition: materials_issued -> in_production
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
      SELECT p.*, f.name as formula_name
      FROM market_production_plans p
      LEFT JOIN market_production_formulas f ON p.formula_id = f.id
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
    if (plan.status !== 'materials_issued') {
      return NextResponse.json({
        success: false,
        error: `No se puede iniciar producción en estado "${plan.status}". Los materiales deben estar entregados.`
      }, { status: 400 })
    }

    // Update plan status to in_production
    await db.query(`
      UPDATE market_production_plans
      SET status = 'in_production',
          started_by = $1,
          started_at = NOW(),
          updated_at = NOW()
      WHERE id = $2
    `, [userId, planId])

    console.log('[Start API] Started production for plan:', plan.plan_number)

    return NextResponse.json({
      success: true,
      message: `Producción iniciada para ${plan.plan_number}`,
      data: {
        planNumber: plan.plan_number,
        formulaName: plan.formula_name,
        status: 'in_production',
        startedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('[Start API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al iniciar producción'
    }, { status: 500 })
  }
}
