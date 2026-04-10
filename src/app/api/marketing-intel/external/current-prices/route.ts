import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { validateApiKey } from '@/lib/marketing-intel-auth'

/**
 * GET /api/marketing-intel/external/current-prices
 * Returns current prices for specific products.
 * Query: ?productIds=1,2,3 or ?skus=SKU001,SKU002
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request)
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const productIds = searchParams.get('productIds')?.split(',').map(Number).filter(n => !isNaN(n))
    const skus = searchParams.get('skus')?.split(',').filter(Boolean)

    if (!productIds?.length && !skus?.length) {
      return NextResponse.json({ success: false, error: 'Requiere productIds o skus' }, { status: 400 })
    }

    let where = 'p.company_id = $1 AND p.is_active = true'
    const params: any[] = [auth.companyId]

    if (productIds?.length) {
      where += ` AND p.id = ANY($2)`
      params.push(productIds)
    } else if (skus?.length) {
      where += ` AND p.sku = ANY($2)`
      params.push(skus)
    }

    const result = await db.query(`
      SELECT p.id, p.name, p.sku, p.barcode, p.category, p.selling_price, p.cost_price, p.currency
      FROM market_products p
      WHERE ${where}
    `, params)

    return NextResponse.json({
      success: true,
      data: result.rows.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        sellingPrice: parseFloat(p.selling_price) || 0,
        costPrice: parseFloat(p.cost_price) || 0,
        currency: p.currency || 'USD'
      }))
    })
  } catch (error) {
    console.error('[MI External Prices] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener precios' }, { status: 500 })
  }
}
