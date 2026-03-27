import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

async function getPayload() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-change-in-production') as any } catch { return null }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  try {
    const result = await db.query(`
      SELECT bt.*, f.name as formula_name, f.code as formula_code
      FROM paint_base_types bt
      LEFT JOIN market_production_formulas f ON f.id = bt.formula_id
      WHERE bt.id = $1 AND bt.company_id = $2
    `, [parseInt(id), payload.companyId])
    if (result.rows.length === 0) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 })
    const r = result.rows[0]
    return NextResponse.json({
      success: true,
      data: { id: r.id, code: r.code, name: r.name, description: r.description, formulaId: r.formula_id, formulaName: r.formula_name, formulaCode: r.formula_code, yieldKg: parseFloat(r.yield_kg) || 1, isActive: r.is_active }
    })
  } catch { return NextResponse.json({ success: false, error: 'Error' }, { status: 500 }) }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  try {
    const { name, description, formulaId, yieldKg } = await request.json()
    await db.query(`
      UPDATE paint_base_types SET name = $1, description = $2, formula_id = $3, yield_kg = $4, updated_at = NOW()
      WHERE id = $5 AND company_id = $6
    `, [name, description || null, formulaId || null, yieldKg || 1, parseInt(id), payload.companyId])
    return NextResponse.json({ success: true, message: 'Tipo de base actualizado' })
  } catch { return NextResponse.json({ success: false, error: 'Error al actualizar' }, { status: 500 }) }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getPayload()
  if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  try {
    await db.query('DELETE FROM paint_base_types WHERE id = $1 AND company_id = $2', [parseInt(id), payload.companyId])
    return NextResponse.json({ success: true, message: 'Tipo de base eliminado' })
  } catch (e: any) {
    if (e.code === '23503') return NextResponse.json({ success: false, error: 'No se puede eliminar: está en uso' }, { status: 400 })
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 })
  }
}
