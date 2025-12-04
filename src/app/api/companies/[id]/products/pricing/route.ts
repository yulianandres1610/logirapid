import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Helper to get user from token
async function getUserFromToken() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: number
      email: string
      role: string
      companyId: number
    }
  } catch {
    return null
  }
}

/**
 * GET /api/companies/[id]/products/pricing
 *
 * Get all products with B2B/B2C pricing for a company
 *
 * For matrix companies (no parent):
 *   - cost_price = platform_price (what LogiRapid charges them)
 *   - min_b2b_price = platform_price (floor for B2B they can assign)
 *   - b2b_price = price they give to their branches
 *   - b2c_price = price to end customers
 *
 * For branches (has parent):
 *   - cost_price = parent's b2b_price (what parent charges them)
 *   - min_b2b_price = parent's b2b_price (floor for their B2B)
 *   - b2b_price = price they could give to sub-branches (if applicable)
 *   - b2c_price = price to end customers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
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

    // Get company info including parent
    const companyResult = await db.query(`
      SELECT
        c.id,
        c.legalname,
        c.parent_company_id,
        c.is_provider,
        c.provider_categories,
        parent.legalname as parent_name
      FROM companies c
      LEFT JOIN companies parent ON c.parent_company_id = parent.id
      WHERE c.id = $1
    `, [companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]
    const isBranch = company.parent_company_id !== null
    const isProvider = company.is_provider
    const providerCategories = company.provider_categories || []

    // Build the query based on company type
    let costSourceQuery: string
    let costParams: any[]

    if (isBranch) {
      // For branches: cost is parent's b2b_price, min_b2b is also parent's b2b_price
      costSourceQuery = `
        SELECT
          pc.id,
          pc.code,
          pc.name,
          pc.description,
          pc.service_category,
          pc.product_type,
          pc.dimensions,
          pc.weight_capacity,
          pc.unit_type,
          pc.pricing_model,
          pc.provider_cost,
          pc.provider_b2b_price,
          pc.platform_price,
          pc.platform_min_b2c,
          pc.min_price,
          pc.is_active,
          pc.display_order,
          -- For branches: cost is parent's B2B price or platform_price
          COALESCE(parent_pricing.b2b_price, parent_pricing.sell_price, pc.platform_price) as cost_price,
          COALESCE(parent_pricing.b2b_price, parent_pricing.sell_price, pc.platform_price) as min_b2b_price_inherited,
          -- Current company pricing
          cpp.id as pricing_id,
          cpp.cost_price as current_cost,
          cpp.b2b_price,
          cpp.b2c_price,
          cpp.sell_price,
          cpp.min_b2b_price,
          cpp.markup_type,
          cpp.markup_value,
          cpp.margin,
          cpp.margin_percentage,
          cpp.margin_b2b,
          cpp.margin_b2b_percentage,
          cpp.price_source,
          cpp.is_active as pricing_active
        FROM product_catalog pc
        LEFT JOIN company_product_pricing parent_pricing
          ON parent_pricing.product_id = pc.id
          AND parent_pricing.company_id = $2
        LEFT JOIN company_product_pricing cpp
          ON cpp.product_id = pc.id
          AND cpp.company_id = $1
        WHERE pc.is_active = true
        ORDER BY pc.service_category, pc.display_order, pc.name
      `
      costParams = [companyId, company.parent_company_id]
    } else {
      // Matrix company - cost is platform_price
      costSourceQuery = `
        SELECT
          pc.id,
          pc.code,
          pc.name,
          pc.description,
          pc.service_category,
          pc.product_type,
          pc.dimensions,
          pc.weight_capacity,
          pc.unit_type,
          pc.pricing_model,
          pc.provider_cost,
          pc.provider_b2b_price,
          pc.platform_price,
          pc.platform_min_b2c,
          pc.min_price,
          pc.is_active,
          pc.display_order,
          -- For matrix: cost is platform_price
          pc.platform_price as cost_price,
          pc.platform_price as min_b2b_price_inherited,
          -- Current company pricing
          cpp.id as pricing_id,
          cpp.cost_price as current_cost,
          cpp.b2b_price,
          cpp.b2c_price,
          cpp.sell_price,
          cpp.min_b2b_price,
          cpp.markup_type,
          cpp.markup_value,
          cpp.margin,
          cpp.margin_percentage,
          cpp.margin_b2b,
          cpp.margin_b2b_percentage,
          cpp.price_source,
          cpp.is_active as pricing_active
        FROM product_catalog pc
        LEFT JOIN company_product_pricing cpp
          ON cpp.product_id = pc.id
          AND cpp.company_id = $1
        WHERE pc.is_active = true
        ORDER BY pc.service_category, pc.display_order, pc.name
      `
      costParams = [companyId]
    }

    const result = await db.query(costSourceQuery, costParams)

    // Format response with B2B/B2C fields
    const products = result.rows.map(row => ({
      productId: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      serviceCategory: row.service_category,
      productType: row.product_type,
      dimensions: row.dimensions,
      weightCapacity: row.weight_capacity,
      unitType: row.unit_type,
      pricingModel: row.pricing_model,
      displayOrder: row.display_order,

      // Platform level prices (for reference)
      providerCost: parseFloat(row.provider_cost || 0),
      providerB2BPrice: parseFloat(row.provider_b2b_price || 0),
      platformPrice: parseFloat(row.platform_price || 0),
      platformMinB2C: parseFloat(row.platform_min_b2c || 0),
      minPrice: parseFloat(row.min_price || 0),

      // Company level pricing
      costPrice: parseFloat(row.cost_price || 0),
      minB2BPriceInherited: parseFloat(row.min_b2b_price_inherited || 0),

      // Current pricing configuration
      b2bPrice: row.b2b_price ? parseFloat(row.b2b_price) : null,
      b2cPrice: row.b2c_price ? parseFloat(row.b2c_price) : null,
      sellPrice: row.sell_price ? parseFloat(row.sell_price) : null, // Legacy
      minB2BPrice: row.min_b2b_price ? parseFloat(row.min_b2b_price) : null,

      markupType: row.markup_type,
      markupValue: row.markup_value ? parseFloat(row.markup_value) : null,

      // Margins
      marginB2C: row.margin ? parseFloat(row.margin) : null,
      marginB2CPercentage: row.margin_percentage ? parseFloat(row.margin_percentage) : null,
      marginB2B: row.margin_b2b ? parseFloat(row.margin_b2b) : null,
      marginB2BPercentage: row.margin_b2b_percentage ? parseFloat(row.margin_b2b_percentage) : null,

      // Metadata
      priceSource: row.price_source,
      hasPricing: row.pricing_id !== null,
      pricingId: row.pricing_id,

      // Provider info
      isProviderCategory: isProvider && providerCategories.includes(row.service_category)
    }))

    // Group by category
    const byCategory: Record<string, typeof products> = {}
    for (const product of products) {
      const cat = product.serviceCategory
      if (!byCategory[cat]) {
        byCategory[cat] = []
      }
      byCategory[cat].push(product)
    }

    return NextResponse.json({
      success: true,
      data: {
        companyId,
        companyName: company.legalname,
        isBranch,
        parentCompanyId: company.parent_company_id,
        parentCompanyName: company.parent_name,
        isProvider,
        providerCategories,
        products,
        byCategory,
        total: products.length
      }
    })

  } catch (error: any) {
    console.error('[Company Products Pricing API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al obtener precios'
    }, { status: 500 })
  }
}

/**
 * POST /api/companies/[id]/products/pricing
 *
 * Set or update B2B/B2C pricing for products
 *
 * Body: {
 *   products: [{
 *     productId: number,
 *     b2bPrice?: number,  // Price for branches/children
 *     b2cPrice?: number,  // Price for end customers
 *     markupType?: 'percentage' | 'fixed',
 *     markupValue?: number
 *   }],
 *   notes?: string
 * }
 *
 * Validation rules:
 * - b2b_price >= min_b2b_price (cannot sell B2B cheaper than what you received)
 * - b2c_price >= cost_price (cannot lose money on B2C sales)
 * - b2b_price >= cost_price (cannot lose money on B2B sales)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromToken()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Only SUPER_ADMIN, ADMIN can set pricing
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tiene permisos para configurar precios'
      }, { status: 403 })
    }

    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de empresa invalido'
      }, { status: 400 })
    }

    const body = await request.json()
    const { products, notes } = body

    if (!products || !Array.isArray(products)) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere un array de productos'
      }, { status: 400 })
    }

    // Get company info
    const companyResult = await db.query(`
      SELECT id, legalname, parent_company_id
      FROM companies
      WHERE id = $1
    `, [companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]
    const isBranch = company.parent_company_id !== null

    const results: { productId: number; success: boolean; error?: string }[] = []

    for (const product of products) {
      try {
        const { productId, b2bPrice, b2cPrice, markupType, markupValue } = product

        if (!productId) {
          results.push({ productId: 0, success: false, error: 'productId requerido' })
          continue
        }

        // Get product info and determine cost_price and min_b2b_price
        let costPriceQuery: string
        let costParams: any[]

        if (isBranch) {
          // For branches: cost and min_b2b is parent's b2b_price
          costPriceQuery = `
            SELECT
              pc.id,
              pc.platform_price,
              pc.platform_min_b2c,
              pc.min_price,
              COALESCE(parent.b2b_price, parent.sell_price, pc.platform_price) as cost_price,
              COALESCE(parent.b2b_price, parent.sell_price, pc.platform_price) as min_b2b_price
            FROM product_catalog pc
            LEFT JOIN company_product_pricing parent
              ON parent.product_id = pc.id
              AND parent.company_id = $2
            WHERE pc.id = $1
          `
          costParams = [productId, company.parent_company_id]
        } else {
          // For matrix: cost is platform_price, min_b2b is also platform_price
          costPriceQuery = `
            SELECT
              id,
              platform_price as cost_price,
              platform_price as min_b2b_price,
              platform_min_b2c,
              min_price
            FROM product_catalog
            WHERE id = $1
          `
          costParams = [productId]
        }

        const productResult = await db.query(costPriceQuery, costParams)

        if (productResult.rows.length === 0) {
          results.push({ productId, success: false, error: 'Producto no encontrado' })
          continue
        }

        const productInfo = productResult.rows[0]
        const costPrice = parseFloat(productInfo.cost_price)
        const minB2BPrice = parseFloat(productInfo.min_b2b_price)
        const platformMinB2C = parseFloat(productInfo.platform_min_b2c || 0)

        // Calculate final prices
        let finalB2BPrice = b2bPrice
        let finalB2CPrice = b2cPrice

        // If markup is provided for branches, calculate prices from markup
        if (isBranch && markupType && markupValue !== undefined) {
          if (markupType === 'percentage') {
            finalB2CPrice = costPrice * (1 + markupValue / 100)
            // B2B could be slightly less than B2C if provided
            if (!finalB2BPrice) {
              finalB2BPrice = finalB2CPrice
            }
          } else if (markupType === 'fixed') {
            finalB2CPrice = costPrice + markupValue
            if (!finalB2BPrice) {
              finalB2BPrice = finalB2CPrice
            }
          }
        }

        // CRITICAL VALIDATION: b2b_price >= min_b2b_price
        if (finalB2BPrice !== undefined && finalB2BPrice !== null && finalB2BPrice < minB2BPrice) {
          results.push({
            productId,
            success: false,
            error: `Precio B2B ($${finalB2BPrice}) no puede ser menor que el precio B2B mínimo ($${minB2BPrice})`
          })
          continue
        }

        // Validation: b2b_price >= cost_price
        if (finalB2BPrice !== undefined && finalB2BPrice !== null && finalB2BPrice < costPrice) {
          results.push({
            productId,
            success: false,
            error: `Precio B2B ($${finalB2BPrice}) no puede ser menor que el costo ($${costPrice})`
          })
          continue
        }

        // Validation: b2c_price >= cost_price
        if (finalB2CPrice !== undefined && finalB2CPrice !== null && finalB2CPrice < costPrice) {
          results.push({
            productId,
            success: false,
            error: `Precio B2C ($${finalB2CPrice}) no puede ser menor que el costo ($${costPrice})`
          })
          continue
        }

        // Validation: b2c_price >= platform_min_b2c (if set)
        if (finalB2CPrice !== undefined && finalB2CPrice !== null && platformMinB2C > 0 && finalB2CPrice < platformMinB2C) {
          results.push({
            productId,
            success: false,
            error: `Precio B2C ($${finalB2CPrice}) no puede ser menor que el precio B2C mínimo de plataforma ($${platformMinB2C})`
          })
          continue
        }

        // Determine price_source
        const priceSource = isBranch ? 'parent_company' : 'platform'

        // Upsert pricing with B2B/B2C fields
        await db.query(`
          INSERT INTO company_product_pricing (
            company_id, product_id, cost_price, b2b_price, b2c_price, sell_price,
            min_b2b_price, price_source, parent_company_id,
            markup_type, markup_value
          ) VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (company_id, product_id)
          DO UPDATE SET
            cost_price = $3,
            b2b_price = COALESCE($4, company_product_pricing.b2b_price),
            b2c_price = COALESCE($5, company_product_pricing.b2c_price),
            sell_price = COALESCE($5, company_product_pricing.sell_price),
            min_b2b_price = $6,
            price_source = $7,
            parent_company_id = $8,
            markup_type = COALESCE($9, company_product_pricing.markup_type),
            markup_value = COALESCE($10, company_product_pricing.markup_value),
            updated_at = NOW()
        `, [
          companyId,
          productId,
          costPrice,
          finalB2BPrice || null,
          finalB2CPrice || null,
          minB2BPrice,
          priceSource,
          isBranch ? company.parent_company_id : null,
          markupType || null,
          markupValue || 0
        ])

        results.push({ productId, success: true })

      } catch (err: any) {
        console.error(`Error updating product ${product.productId}:`, err)
        results.push({
          productId: product.productId || 0,
          success: false,
          error: err.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        successCount: results.filter(r => r.success).length,
        errorCount: results.filter(r => !r.success).length
      }
    })

  } catch (error: any) {
    console.error('[Company Products Pricing API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al configurar precios'
    }, { status: 500 })
  }
}
