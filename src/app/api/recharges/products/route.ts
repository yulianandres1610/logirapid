import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userRole = cookieStore.get('user-role')?.value
    const companyId = cookieStore.get('user-company-id')?.value

    if (!userRole) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let whereConditions = ['erp.is_active = true']
    const params: any[] = []
    let paramIndex = 1

    if (country) {
      whereConditions.push(`erp.country_code = $${paramIndex}`)
      params.push(country)
      paramIndex++
    }

    if (search) {
      whereConditions.push(`(erp.name ILIKE $${paramIndex} OR erp.description ILIKE $${paramIndex})`)
      params.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : ''

    // Get products with pricing for the company (or platform-wide pricing)
    const query = `
      SELECT
        erp.*,
        rpp.id as pricing_id,
        rpp.margin_type,
        rpp.margin_value,
        rpp.selling_price,
        rpp.is_enabled as pricing_enabled,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', rpr.id,
            'summary', rpr.summary,
            'description', rpr.description,
            'min_amount', rpr.min_amount,
            'valid_from', rpr.valid_from,
            'valid_to', rpr.valid_to
          ))
          FROM recharge_promotions rpr
          WHERE rpr.external_product_id = erp.id
            AND rpr.is_active = true
            AND (rpr.valid_to IS NULL OR rpr.valid_to > NOW())
          ), '[]'
        ) as promotions
      FROM external_recharge_products erp
      LEFT JOIN recharge_product_pricing rpp ON rpp.external_product_id = erp.id
        AND (rpp.company_id IS NULL OR rpp.company_id = $${paramIndex})
      ${whereClause}
      ORDER BY erp.country_name ASC, erp.name ASC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `

    params.push(companyId ? parseInt(companyId) : null, limit, offset)

    const result = await db.query(query, params)

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM external_recharge_products erp
      ${whereClause}
    `
    const countResult = await db.query(countQuery, params.slice(0, -3))
    const total = parseInt(countResult.rows[0].total)

    // Get available countries
    const countriesResult = await db.query(`
      SELECT DISTINCT country_code, country_name
      FROM external_recharge_products
      WHERE is_active = true AND country_code IS NOT NULL
      ORDER BY country_name ASC
    `)

    // Transform response
    const products = result.rows.map((row: any) => ({
      id: row.id,
      externalId: row.external_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      baseCost: parseFloat(row.base_cost),
      countryCode: row.country_code,
      countryName: row.country_name,
      phonePattern: row.phone_pattern,
      minAmount: row.min_amount ? parseFloat(row.min_amount) : null,
      maxAmount: row.max_amount ? parseFloat(row.max_amount) : null,
      acceptsRange: row.accepts_range,
      isActive: row.is_active,
      lastSyncedAt: row.last_synced_at,
      pricing: row.pricing_id
        ? {
            id: row.pricing_id,
            marginType: row.margin_type,
            marginValue: parseFloat(row.margin_value),
            sellingPrice: row.selling_price ? parseFloat(row.selling_price) : null,
            isEnabled: row.pricing_enabled,
          }
        : null,
      promotions: typeof row.promotions === 'string'
        ? JSON.parse(row.promotions)
        : row.promotions,
    }))

    return NextResponse.json({
      success: true,
      data: {
        products,
        countries: countriesResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error: any) {
    console.error('[Recharge Products Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error obteniendo productos de recarga',
      },
      { status: 500 }
    )
  }
}
