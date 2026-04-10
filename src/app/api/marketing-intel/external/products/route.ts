import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * GET /api/marketing-intel/external/products
 * Returns product catalog for OpenClaw agents to match against.
 * Query: ?category=X&search=X&limit=100
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)

    let where = 'p.company_id = $1 AND p.is_active = true'
    const params: any[] = [auth.companyId]
    let idx = 2

    if (category) {
      where += ` AND p.category = $${idx}`
      params.push(category)
      idx++
    }
    if (search) {
      where += ` AND (p.name ILIKE $${idx} OR p.sku ILIKE $${idx} OR p.barcode ILIKE $${idx})`
      params.push(`%${search}%`)
      idx++
    }

    params.push(limit)

    const result = await db.query(`
      SELECT p.id, p.name, p.sku, p.barcode, p.category, p.selling_price, p.cost_price,
        p.currency, p.unit_of_measure, p.quantity_on_hand
      FROM market_products p
      WHERE ${where}
      ORDER BY p.name
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
  } catch (error) {
    console.error('[MI External Products] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener productos' }, { status: 500 })
  }
}
