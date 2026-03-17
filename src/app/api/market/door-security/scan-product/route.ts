import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/market/door-security/scan-product
 * Search for a product by barcode (scanned via DataWedge)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { barcode, kioskId, guardId } = body

    if (!barcode) {
      return NextResponse.json({
        success: false,
        error: 'barcode es requerido'
      }, { status: 400 })
    }

    if (!kioskId || !guardId) {
      return NextResponse.json({
        success: false,
        error: 'kioskId y guardId son requeridos'
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
    const trimmedBarcode = barcode.trim()

    // Search product by barcode or SKU
    const productResult = await db.query(`
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
        AND (p.barcode = $2 OR LOWER(p.sku) = LOWER($2))
      LIMIT 1
    `, [companyId, trimmedBarcode])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: { found: false, barcode: trimmedBarcode }
      })
    }

    const p = productResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        found: true,
        product: {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          imageUrl: p.image_url,
          sellingPrice: parseFloat(p.selling_price) || 0,
          currency: p.currency || 'USD',
          unitOfMeasure: p.unit_of_measure,
          categoryName: p.category_name,
        }
      }
    })

  } catch (error) {
    console.error('[Scan Product] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar producto'
    }, { status: 500 })
  }
}
