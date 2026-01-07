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

/**
 * GET /api/warehouse/products-labels
 * Search products for label printing - returns only non-sensitive data
 *
 * Query params:
 * - search: string (name, barcode, sku)
 * - page: number (default 1)
 * - limit: number (default 20)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = (page - 1) * limit

    // Build search query - NO sensitive data (no cost_price, supplier info)
    let query = `
      SELECT
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.image_url,
        p.selling_price,
        p.currency,
        p.unit_of_measure,
        c.name as category_name,
        -- Get nearest expiration date from lots
        (
          SELECT MIN(lot.expiration_date)
          FROM consignment_lot_inventory lot
          WHERE lot.product_id = p.id
            AND lot.quantity_on_hand > 0
            AND lot.expiration_date IS NOT NULL
            AND lot.expiration_date > CURRENT_DATE
        ) as nearest_expiration
      FROM market_products p
      LEFT JOIN market_categories c ON p.category_id = c.id
      WHERE p.company_id = $1
        AND p.is_active = true
    `

    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (search.trim()) {
      query += `
        AND (
          LOWER(p.name) LIKE LOWER($${paramIndex})
          OR LOWER(p.sku) LIKE LOWER($${paramIndex})
          OR p.barcode LIKE $${paramIndex}
        )
      `
      params.push(`%${search.trim()}%`)
      paramIndex++
    }

    // Count total
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/,
      'SELECT COUNT(*) as total FROM'
    ).replace(/-- Get nearest[\s\S]*?\) as nearest_expiration,?/, '')

    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Add ordering and pagination
    query += `
      ORDER BY p.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const result = await db.query(query, params)

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
          expirationDate: p.nearest_expiration
          // NO costPrice, supplierName, etc.
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Warehouse Products Labels API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar productos'
    }, { status: 500 })
  }
}
