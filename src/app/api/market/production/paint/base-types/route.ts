import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number; companyName: string }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production') as JWTPayload
  } catch { return null }
}

export async function GET() {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    const result = await db.query(`
      SELECT bt.*, f.name as formula_name, f.code as formula_code,
             p.name as target_product_name
      FROM paint_base_types bt
      LEFT JOIN market_production_formulas f ON f.id = bt.formula_id
      LEFT JOIN market_products p ON p.id = f.target_product_id
      WHERE bt.company_id = $1
      ORDER BY bt.name
    `, [payload.companyId])

    return NextResponse.json({
      success: true,
      data: result.rows.map((r: any) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        formulaId: r.formula_id,
        formulaName: r.formula_name,
        formulaCode: r.formula_code,
        targetProductName: r.target_product_name,
        yieldKg: parseFloat(r.yield_kg) || 1,
        isActive: r.is_active,
        createdAt: r.created_at
      }))
    })
  } catch (error) {
    console.error('[Paint Base Types] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener tipos de base' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

  try {
    const { code, name, description, formulaId, yieldKg } = await request.json()

    if (!code || !name) {
      return NextResponse.json({ success: false, error: 'Código y nombre son requeridos' }, { status: 400 })
    }

    const result = await db.query(`
      INSERT INTO paint_base_types (company_id, code, name, description, formula_id, yield_kg)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [payload.companyId, code.toUpperCase(), name, description || null, formulaId || null, yieldKg || 1])

    return NextResponse.json({
      success: true,
      data: { id: result.rows[0].id },
      message: 'Tipo de base creado'
    })
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'Ya existe un tipo de base con ese código' }, { status: 400 })
    }
    console.error('[Paint Base Types] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al crear tipo de base' }, { status: 500 })
  }
}
