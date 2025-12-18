import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'

// API de productos de recarga - v2.0
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

    // Get products with pricing for the company (prefer company-specific over platform-wide)
    // Use a subquery to get the best matching pricing for each product
    const query = `
      SELECT
        erp.*,
        best_pricing.pricing_id,
        best_pricing.margin_type,
        best_pricing.margin_value,
        best_pricing.selling_price,
        best_pricing.is_enabled as pricing_enabled,
        best_pricing.company_id as pricing_company_id,
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
      LEFT JOIN LATERAL (
        SELECT
          rpp.id as pricing_id,
          rpp.margin_type,
          rpp.margin_value,
          rpp.selling_price,
          rpp.is_enabled,
          rpp.company_id
        FROM recharge_product_pricing rpp
        WHERE rpp.external_product_id = erp.id
          AND (rpp.company_id = $${paramIndex} OR rpp.company_id IS NULL)
        ORDER BY
          CASE WHEN rpp.company_id = $${paramIndex} THEN 0 ELSE 1 END,
          rpp.id DESC
        LIMIT 1
      ) best_pricing ON true
      ${whereClause}
      ORDER BY erp.country_name ASC, erp.name ASC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `

    // Parse companyId safely
    const parsedCompanyId = companyId ? parseInt(companyId) : null
    params.push(parsedCompanyId, limit, offset)

    console.log('[Recharge Products] Query params:', { companyId, parsedCompanyId, userRole, paramIndex })

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

    console.log('[Recharge Products] Total rows returned:', result.rows.length)

    // Transform response
    const products = result.rows.map((row: any) => {
      // Check if product has manual pricing (created via new form)
      const hasManualPricing = row.manual_cost_price !== null && row.manual_selling_price !== null

      // Debug logging for troubleshooting
      if (hasManualPricing || row.pricing_id) {
        console.log('[Recharge Products] Product:', row.id, row.name, {
          hasManualPricing,
          manualCost: row.manual_cost_price,
          manualSell: row.manual_selling_price,
          pricingId: row.pricing_id,
          isActive: row.is_active
        })
      }

      // Build pricing object - prioritize manual pricing over margin-based
      let pricing = null
      if (hasManualPricing) {
        pricing = {
          id: row.id, // Use product id as pricing id for manual pricing
          marginType: 'fixed' as const,
          marginValue: parseFloat(row.manual_selling_price) - parseFloat(row.manual_cost_price),
          sellingPrice: parseFloat(row.manual_selling_price),
          costPrice: parseFloat(row.manual_cost_price),
          isEnabled: true,
          isManualPricing: true,
        }
      } else if (row.pricing_id) {
        // For margin-based pricing, cost is base_cost (or provider_amount if available)
        const baseCostValue = row.provider_amount
          ? parseFloat(row.provider_amount)
          : row.base_cost
            ? parseFloat(row.base_cost)
            : 0

        pricing = {
          id: row.pricing_id,
          marginType: row.margin_type,
          marginValue: parseFloat(row.margin_value),
          sellingPrice: row.selling_price ? parseFloat(row.selling_price) : null,
          costPrice: baseCostValue, // Add costPrice for margin-based products too
          isEnabled: row.pricing_enabled,
          isManualPricing: false,
        }
      }

      return {
        id: row.id,
        externalId: row.external_id,
        name: row.custom_name || row.name,
        slug: row.slug,
        description: row.custom_description || row.description,
        baseCost: row.provider_amount ? parseFloat(row.provider_amount) : parseFloat(row.base_cost),
        countryCode: row.country_code,
        countryName: row.country_name,
        phonePattern: row.phone_pattern,
        minAmount: row.min_amount ? parseFloat(row.min_amount) : null,
        maxAmount: row.max_amount ? parseFloat(row.max_amount) : null,
        acceptsRange: row.accepts_range,
        isActive: row.is_active,
        lastSyncedAt: row.last_synced_at,
        isPromotion: row.is_promotion || false,
        providerAmount: row.provider_amount ? parseFloat(row.provider_amount) : null,
        univcellProductId: row.univcell_product_id,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        pricing,
        promotions: typeof row.promotions === 'string'
          ? JSON.parse(row.promotions)
          : row.promotions,
      }
    })

    // Log summary of products with pricing
    const productsWithPricing = products.filter((p: any) => p.pricing !== null)
    console.log('[Recharge Products] Summary:', {
      totalProducts: products.length,
      withPricing: productsWithPricing.length,
      withManualPricing: products.filter((p: any) => p.pricing?.isManualPricing).length,
      withMarginPricing: products.filter((p: any) => p.pricing && !p.pricing.isManualPricing).length,
      activeProducts: products.filter((p: any) => p.isActive).length
    })

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
