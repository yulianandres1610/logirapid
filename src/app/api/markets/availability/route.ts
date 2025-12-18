import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/markets/availability
 * Check market availability for a specific location
 * Returns markets available for delivery in the zone
 *
 * Query params:
 * - province: Province in Cuba (required)
 * - municipality: Municipality (required)
 * - category: Product category filter (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify auth
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const province = searchParams.get('province')
    const municipality = searchParams.get('municipality')
    const category = searchParams.get('category')

    if (!province || !municipality) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere provincia y municipio'
      }, { status: 400 })
    }

    // Get markets in this location with their product counts
    let query = `
      SELECT
        c.id,
        c.legalname as name,
        c.market_delivery_hours as delivery_hours,
        c.market_contact_phone as contact_phone,
        c.market_address as address,
        c.market_categories as categories,
        c.market_is_active as is_active,
        c.latitude,
        c.longitude,
        COALESCE(mp.product_count, 0) as product_count,
        COALESCE(mp.in_stock_count, 0) as in_stock_count
      FROM companies c
      LEFT JOIN (
        SELECT
          company_id,
          COUNT(*) as product_count,
          COUNT(*) FILTER (WHERE quantity_on_hand > 0) as in_stock_count
        FROM market_products
        WHERE is_active = true
        GROUP BY company_id
      ) mp ON mp.company_id = c.id
      WHERE c.companytype = 'market'
        AND c.market_is_active = true
        AND LOWER(c.market_province) = LOWER($1)
        AND LOWER(c.market_municipality) = LOWER($2)
    `

    const queryParams: (string | null)[] = [province, municipality]

    // Filter by category if provided
    if (category) {
      query += ` AND c.market_categories::jsonb ? $3`
      queryParams.push(category)
    }

    query += ` ORDER BY COALESCE(mp.in_stock_count, 0) DESC, c.legalname ASC`

    const result = await db.query(query, queryParams)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasMarkets: false,
          message: 'No hay mercados disponibles en esta zona',
          markets: [],
          province,
          municipality,
          category
        }
      })
    }

    // Process markets
    const markets = result.rows.map(row => {
      let categories: string[] = []
      try {
        categories = typeof row.categories === 'string'
          ? JSON.parse(row.categories)
          : (row.categories || [])
      } catch {
        categories = []
      }

      return {
        id: row.id,
        name: row.name,
        deliveryHours: row.delivery_hours,
        contactPhone: row.contact_phone,
        address: row.address,
        categories,
        isActive: row.is_active,
        latitude: row.latitude ? parseFloat(row.latitude) : null,
        longitude: row.longitude ? parseFloat(row.longitude) : null,
        productCount: parseInt(row.product_count) || 0,
        inStockCount: parseInt(row.in_stock_count) || 0,
        hasProducts: parseInt(row.product_count) > 0
      }
    })

    // Find best market (most products in stock)
    const bestMarket = markets.find(m => m.inStockCount > 0) || markets[0]

    return NextResponse.json({
      success: true,
      data: {
        hasMarkets: true,
        totalMarkets: markets.length,
        markets,
        bestMarketId: bestMarket?.id,
        province,
        municipality,
        category
      }
    })

  } catch (error) {
    console.error('[Markets Availability API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar disponibilidad'
    }, { status: 500 })
  }
}
