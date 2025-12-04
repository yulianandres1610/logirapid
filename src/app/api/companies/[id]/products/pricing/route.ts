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

// GET /api/companies/[id]/products/pricing
// Get all products with pricing for a company
// For matrix companies: shows platform_price as cost, their sell_price
// For branches: shows parent's sell_price as cost, their sell_price with markup
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

    // Get company info
    const companyResult = await db.query(`
      SELECT id, legalname, parentcompanyid
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
    const isBranch = company.parentcompanyid !== null

    // Determine the cost source
    // For matrix companies: platform_price
    // For branches: parent company's sell_price
    let costSourceQuery: string
    let costParams: any[]

    if (isBranch) {
      // Get prices from parent company
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
          pc.min_price,
          pc.is_active,
          pc.display_order,
          -- For branches, cost is parent's sell_price
          COALESCE(parent_pricing.sell_price, pc.platform_price) as cost_price,
          -- Current company pricing
          cpp.id as pricing_id,
          cpp.sell_price,
          cpp.markup_type,
          cpp.markup_value,
          cpp.margin,
          cpp.margin_percentage,
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
      costParams = [companyId, company.parentcompanyid]
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
          pc.min_price,
          pc.is_active,
          pc.display_order,
          -- For matrix, cost is platform_price
          pc.platform_price as cost_price,
          -- Current company pricing
          cpp.id as pricing_id,
          cpp.sell_price,
          cpp.markup_type,
          cpp.markup_value,
          cpp.margin,
          cpp.margin_percentage,
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

    // Format response
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
      minPrice: parseFloat(row.min_price || 0),
      displayOrder: row.display_order,
      // Pricing
      costPrice: parseFloat(row.cost_price || 0),
      sellPrice: row.sell_price ? parseFloat(row.sell_price) : null,
      markupType: row.markup_type,
      markupValue: row.markup_value ? parseFloat(row.markup_value) : null,
      margin: row.margin ? parseFloat(row.margin) : null,
      marginPercentage: row.margin_percentage ? parseFloat(row.margin_percentage) : null,
      hasPricing: row.pricing_id !== null,
      pricingId: row.pricing_id
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
        parentCompanyId: company.parentcompanyid,
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

// POST /api/companies/[id]/products/pricing
// Set or update pricing for products
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
      SELECT id, legalname, parentcompanyid
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
    const isBranch = company.parentcompanyid !== null

    const results: { productId: number; success: boolean; error?: string }[] = []

    for (const product of products) {
      try {
        const { productId, sellPrice, markupType, markupValue } = product

        if (!productId) {
          results.push({ productId: 0, success: false, error: 'productId requerido' })
          continue
        }

        // Get product info and determine cost_price
        let costPriceQuery: string
        let costParams: any[]

        if (isBranch) {
          // For branches, cost is parent's sell_price or platform_price
          costPriceQuery = `
            SELECT
              pc.id,
              pc.platform_price,
              pc.min_price,
              COALESCE(parent.sell_price, pc.platform_price) as cost_price
            FROM product_catalog pc
            LEFT JOIN company_product_pricing parent
              ON parent.product_id = pc.id
              AND parent.company_id = $2
            WHERE pc.id = $1
          `
          costParams = [productId, company.parentcompanyid]
        } else {
          // For matrix, cost is platform_price
          costPriceQuery = `
            SELECT id, platform_price as cost_price, min_price
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
        const minPrice = parseFloat(productInfo.min_price || 0)

        // Calculate final sell_price
        let finalSellPrice = sellPrice

        // For branches, if markup is provided, calculate from markup
        if (isBranch && markupType && markupValue !== undefined) {
          if (markupType === 'percentage') {
            finalSellPrice = costPrice * (1 + markupValue / 100)
          } else if (markupType === 'fixed') {
            finalSellPrice = costPrice + markupValue
          }
        }

        // Validate sell_price >= cost_price
        if (finalSellPrice < costPrice) {
          results.push({
            productId,
            success: false,
            error: `Precio de venta ($${finalSellPrice}) no puede ser menor que costo ($${costPrice})`
          })
          continue
        }

        // Validate sell_price >= min_price
        if (finalSellPrice < minPrice) {
          results.push({
            productId,
            success: false,
            error: `Precio de venta ($${finalSellPrice}) no puede ser menor que precio minimo ($${minPrice})`
          })
          continue
        }

        // Upsert pricing
        await db.query(`
          INSERT INTO company_product_pricing (
            company_id, product_id, cost_price, sell_price, markup_type, markup_value
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (company_id, product_id)
          DO UPDATE SET
            cost_price = $3,
            sell_price = $4,
            markup_type = $5,
            markup_value = $6,
            updated_at = NOW()
        `, [
          companyId,
          productId,
          costPrice,
          finalSellPrice,
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
