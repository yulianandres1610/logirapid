import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload { userId: number; email: string; role: string; companyId: number }

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  try { return jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as JWTPayload } catch { return null }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    const conditions: string[] = ['company_id = $1', 'is_active = true']
    const params: any[] = [payload.companyId]
    let idx = 2

    if (search) {
      conditions.push(`(name ILIKE $${idx} OR sku ILIKE $${idx} OR barcode ILIKE $${idx})`)
      params.push(`%${search}%`)
      idx++
    }

    if (category) {
      conditions.push(`category = $${idx}`)
      params.push(category)
      idx++
    }

    params.push(limit)

    const result = await db.query(`
      SELECT id, name, sku, barcode, category, selling_price, cost_price, currency, unit_of_measure, quantity_on_hand
      FROM market_products
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
      LIMIT $${idx}
    `, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        category: p.category,
        sellingPrice: parseFloat(p.selling_price) || 0,
        currency: p.currency || 'USD',
        unit: p.unit_of_measure || 'unidad',
        stock: parseFloat(p.quantity_on_hand) || 0
      })),
      total: result.rows.length
    })
  } catch (error) {
    console.error('[MKT Products GET]', error)
    return NextResponse.json({ success: false, error: 'Error al obtener productos' }, { status: 500 })
  }
}
