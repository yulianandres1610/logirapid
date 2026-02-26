import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * POST /api/migrations/cleanup-production-test
 * Elimina todos los planes de producción y fórmulas de prueba
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const results: string[] = []

    // 1. Eliminar materiales de planes
    const materialsResult = await db.query(`
      DELETE FROM market_production_plan_materials
      WHERE plan_id IN (SELECT id FROM market_production_plans WHERE company_id = $1)
    `, [payload.companyId])
    results.push(`Materiales de planes eliminados: ${materialsResult.rowCount}`)

    // 2. Eliminar planes de producción
    const plansResult = await db.query(`
      DELETE FROM market_production_plans WHERE company_id = $1
    `, [payload.companyId])
    results.push(`Planes de producción eliminados: ${plansResult.rowCount}`)

    // 3. Eliminar líneas de fórmulas
    const linesResult = await db.query(`
      DELETE FROM market_production_formula_lines
      WHERE formula_id IN (SELECT id FROM market_production_formulas WHERE company_id = $1)
    `, [payload.companyId])
    results.push(`Líneas de fórmulas eliminadas: ${linesResult.rowCount}`)

    // 4. Eliminar fórmulas
    const formulasResult = await db.query(`
      DELETE FROM market_production_formulas WHERE company_id = $1
    `, [payload.companyId])
    results.push(`Fórmulas eliminadas: ${formulasResult.rowCount}`)

    return NextResponse.json({
      success: true,
      message: 'Datos de producción de prueba eliminados',
      results
    })

  } catch (error) {
    console.error('[Cleanup Production] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al limpiar datos'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/cleanup-production-test
 * Muestra qué datos se eliminarían
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const plans = await db.query(`
      SELECT id, plan_number, status, planned_quantity FROM market_production_plans WHERE company_id = $1
    `, [payload.companyId])

    const formulas = await db.query(`
      SELECT id, code, name FROM market_production_formulas WHERE company_id = $1
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      preview: {
        plans: plans.rows,
        formulas: formulas.rows
      },
      message: 'Ejecute POST para eliminar estos datos'
    })

  } catch (error) {
    console.error('[Cleanup Production Preview] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener preview'
    }, { status: 500 })
  }
}
