import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/market/door-security/search-products
 * Search products by name/sku for label printing from kiosk
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const kioskId = searchParams.get('kioskId')
    const guardId = searchParams.get('guardId')

    if (!query || !kioskId || !guardId) {
      return NextResponse.json({
        success: false,
        error: 'query, kioskId y guardId son requeridos'
      }, { status: 400 })
    }

    // Authenticate via kiosk + guard
    const kioskResult = await db.query(
      'SELECT companyid FROM market_door_kiosks WHERE id = $1 AND isactive = true',
      [kioskId]
    )
    if (kioskResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Kiosk no encontrado' }, { status: 401 })
    }

    const guardResult = await db.query(
      'SELECT id FROM market_door_guards WHERE employeeid = $1 AND isactive = true',
      [guardId]
    )
    if (guardResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Guardia no autorizado' }, { status: 401 })
    }

    const companyId = kioskResult.rows[0].companyid
    const searchTerm = `%${query.trim()}%`

    const result = await db.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.image_url,
        p.selling_price,
        p.currency,
        p.unit_of_measure,
        c.name as category_name
      FROM market_products p
      LEFT JOIN market_categories c ON p.category_id = c.id
      WHERE p.company_id = $1
        AND p.is_active = true
        AND (
          LOWER(p.name) LIKE LOWER($2)
          OR LOWER(p.sku) LIKE LOWER($2)
          OR p.barcode LIKE $2
        )
      ORDER BY p.name ASC
      LIMIT 20
    `, [companyId, searchTerm])

    return NextResponse.json({
      success: true,
      data: {
        products: result.rows.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          imageUrl: p.image_url,
          sellingPrice: parseFloat(p.selling_price) || 0,
          currency: p.currency || 'USD',
          unitOfMeasure: p.unit_of_measure,
          categoryName: p.category_name,
        }))
      }
    })

  } catch (error) {
    console.error('[Search Products] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar productos'
    }, { status: 500 })
  }
}
