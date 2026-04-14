import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateAgentToken } from '@/lib/mkt-auth'

export async function GET(request: NextRequest) {
  const auth = await validateAgentToken(request)
  if (!auth.valid) return NextResponse.json({ success: false, error: auth.error }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 1000)

    const conditions: string[] = ['company_id = $1', 'is_active = true', 'quantity_on_hand > 0']
    const params: any[] = [auth.companyId]
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
      SELECT
        id, name, sku, barcode, category,
        selling_price, cost_price, currency,
        unit_of_measure, quantity_on_hand
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
        costPrice: parseFloat(p.cost_price) || 0,
        currency: p.currency || 'USD',
        unit: p.unit_of_measure || 'unidad',
        stockOnHand: parseFloat(p.quantity_on_hand) || 0
      })),
      total: result.rows.length
    })
  } catch (error: any) {
    console.error('[MKT Ext] Products error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener productos' }, { status: 500 })
  }
}
