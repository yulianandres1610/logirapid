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
 * GET /api/companies/[id]/products
 *
 * Get products from catalog with company-specific pricing
 *
 * Query params:
 * - category: Filter by service_category (paqueteria, remesa, recarga, mercado)
 * - productType: Filter by product_type
 * - active: Filter by active status (default: true)
 *
 * Returns products with prices from:
 * 1. company_product_pricing (if exists)
 * 2. product_catalog (fallback)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa invalido'
      }, { status: 400 })
    }

    // Authorization: SUPER_ADMIN can see any company, others only their own
    if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para ver productos de esta empresa'
      }, { status: 403 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const categoryFilter = searchParams.get('category')
    const productTypeFilter = searchParams.get('productType')
    const activeFilter = searchParams.get('active') !== 'false' // Default true

    // Get company info
    const companyResult = await db.query(`
      SELECT id, legalname FROM companies WHERE id = $1
    `, [companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]

    // Build query for products with company pricing
    let query = `
      SELECT
        pc.id,
        pc.code,
        pc.name,
        pc.description,
        pc.service_category,
        pc.product_type,
        pc.pricing_model,
        pc.mi_costo,
        pc.precio_mayorista,
        pc.precio_publico,
        pc.platform_price,
        pc.is_active,
        -- Company-specific pricing (if exists)
        cpp.id as pricing_id,
        cpp.cost_price as company_cost_price,
        cpp.sell_price as company_sell_price,
        cpp.markup_type,
        cpp.markup_value,
        cpp.is_active as pricing_active,
        -- Final prices (company pricing takes priority)
        COALESCE(cpp.sell_price, pc.precio_publico, pc.platform_price) as final_sell_price,
        COALESCE(cpp.cost_price, pc.mi_costo) as final_cost_price
      FROM product_catalog pc
      LEFT JOIN company_product_pricing cpp
        ON cpp.product_id = pc.id AND cpp.company_id = $1
      WHERE 1=1
    `
    const queryParams: any[] = [companyId]
    let paramIndex = 2

    if (activeFilter) {
      query += ` AND pc.is_active = true`
    }

    if (categoryFilter) {
      query += ` AND pc.service_category = $${paramIndex}`
      queryParams.push(categoryFilter)
      paramIndex++
    }

    if (productTypeFilter) {
      query += ` AND pc.product_type = $${paramIndex}`
      queryParams.push(productTypeFilter)
      paramIndex++
    }

    query += ` ORDER BY pc.service_category, pc.name`

    const productsResult = await db.query(query, queryParams)

    // Format response
    const products = productsResult.rows.map(p => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      serviceCategory: p.service_category,
      productType: p.product_type,
      pricingModel: p.pricing_model,
      isActive: p.is_active,
      // Platform prices (reference)
      platformPrices: {
        cost: parseFloat(p.mi_costo || 0),
        wholesale: parseFloat(p.precio_mayorista || 0),
        retail: parseFloat(p.precio_publico || 0),
        platform: parseFloat(p.platform_price || 0)
      },
      // Company-specific pricing (if configured)
      companyPricing: p.pricing_id ? {
        id: p.pricing_id,
        costPrice: parseFloat(p.company_cost_price || 0),
        sellPrice: parseFloat(p.company_sell_price || 0),
        markupType: p.markup_type,
        markupValue: p.markup_value ? parseFloat(p.markup_value) : null,
        isActive: p.pricing_active
      } : null,
      // Final prices to use (company pricing takes priority)
      sellPrice: parseFloat(p.final_sell_price || 0),
      costPrice: parseFloat(p.final_cost_price || 0),
      // Calculated margin
      margin: p.final_sell_price && p.final_cost_price
        ? parseFloat(p.final_sell_price) - parseFloat(p.final_cost_price)
        : 0
    }))

    // Group products by category for easier UI rendering
    const productsByCategory: Record<string, any[]> = {}
    products.forEach(p => {
      const cat = p.serviceCategory || 'otros'
      if (!productsByCategory[cat]) {
        productsByCategory[cat] = []
      }
      productsByCategory[cat].push(p)
    })

    // Get categories summary
    const categorySummary = Object.keys(productsByCategory).map(cat => ({
      category: cat,
      count: productsByCategory[cat].length,
      withCompanyPricing: productsByCategory[cat].filter(p => p.companyPricing).length
    }))

    return NextResponse.json({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.legalname,
        products,
        productsByCategory,
        summary: {
          totalProducts: products.length,
          withCompanyPricing: products.filter(p => p.companyPricing).length,
          withoutCompanyPricing: products.filter(p => !p.companyPricing).length,
          byCategory: categorySummary
        }
      }
    })

  } catch (error) {
    console.error('Error in GET /api/companies/[id]/products:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  }
}
