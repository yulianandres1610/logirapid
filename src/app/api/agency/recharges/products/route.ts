import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

// GET - Obtener productos de recarga para agencias
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token invalido' },
        { status: 401 }
      )
    }

    const companyId = payload.companyId

    // Get products with pricing for the company (prefer company-specific over platform-wide)
    const query = `
      SELECT
        erp.*,
        best_pricing.pricing_id,
        best_pricing.margin_type,
        best_pricing.margin_value,
        best_pricing.selling_price,
        best_pricing.is_enabled as pricing_enabled,
        best_pricing.company_id as pricing_company_id
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
          AND (rpp.company_id = $1 OR rpp.company_id IS NULL)
        ORDER BY
          CASE WHEN rpp.company_id = $1 THEN 0 ELSE 1 END,
          rpp.id DESC
        LIMIT 1
      ) best_pricing ON true
      WHERE erp.is_active = true
      ORDER BY erp.country_name ASC, erp.name ASC
    `

    const result = await db.query(query, [companyId])

    // Transform response to match agency-admin expected format
    const products = result.rows.map((row: any) => {
      // Check if product has manual pricing (created via new form)
      const hasManualPricing = row.manual_cost_price !== null && row.manual_selling_price !== null
      // Check if company has specific pricing configured
      const hasCompanyPricing = row.pricing_id !== null && row.pricing_company_id === companyId

      // Calculate miCosto (cost to the agency) and precioClientes (price to charge customers)
      let miCosto = 0
      let precioClientes: number | null = null
      let hasPricing = false

      // Priority: Company-specific pricing > Manual pricing > Platform pricing
      if (hasCompanyPricing) {
        // Agency has configured their own pricing for this product
        const baseCost = row.provider_amount
          ? parseFloat(row.provider_amount)
          : row.manual_cost_price
            ? parseFloat(row.manual_cost_price)
            : row.base_cost
              ? parseFloat(row.base_cost)
              : 0

        miCosto = baseCost

        if (row.selling_price) {
          precioClientes = parseFloat(row.selling_price)
        } else if (row.margin_type === 'percentage') {
          precioClientes = baseCost * (1 + parseFloat(row.margin_value) / 100)
        } else if (row.margin_type === 'fixed') {
          precioClientes = baseCost + parseFloat(row.margin_value)
        }

        hasPricing = row.pricing_enabled === true
      } else if (hasManualPricing) {
        // For manually created products without company-specific pricing
        miCosto = parseFloat(row.manual_cost_price)
        precioClientes = parseFloat(row.manual_selling_price)
        hasPricing = true
      } else if (row.pricing_id) {
        // For platform-wide pricing (company_id IS NULL)
        const baseCost = row.provider_amount
          ? parseFloat(row.provider_amount)
          : row.base_cost
            ? parseFloat(row.base_cost)
            : 0

        miCosto = baseCost

        if (row.selling_price) {
          precioClientes = parseFloat(row.selling_price)
        } else if (row.margin_type === 'percentage') {
          precioClientes = baseCost * (1 + parseFloat(row.margin_value) / 100)
        } else if (row.margin_type === 'fixed') {
          precioClientes = baseCost + parseFloat(row.margin_value)
        }

        hasPricing = row.pricing_enabled === true
      }

      return {
        productId: `${row.id}`, // String version of ID
        rechargeProductId: row.id, // Numeric ID - this is what gets sent to the API
        code: row.slug || `PROD-${row.id}`,
        name: row.custom_name || row.name,
        description: row.custom_description || row.description || '',
        countryCode: row.country_code,
        countryName: row.country_name,
        isPromotion: row.is_promotion || false,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        miCosto,
        precioClientes,
        hasPricing,
        slug: row.slug,
        // Include univcell info for debugging
        univcellProductId: row.univcell_product_id,
        externalId: row.external_id,
      }
    })

    console.log('[Agency Recharge Products] Loaded:', {
      total: products.length,
      withPricing: products.filter((p: any) => p.hasPricing).length,
      companyId
    })

    return NextResponse.json({
      success: true,
      data: products
    })
  } catch (error: any) {
    console.error('[Agency Recharge Products Error]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error obteniendo productos de recarga',
      },
      { status: 500 }
    )
  }
}
