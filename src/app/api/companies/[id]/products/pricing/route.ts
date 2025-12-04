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
 * Get all products with simplified pricing for a company
 *
 * New nomenclature (migration 40):
 *   - mi_costo = Costo heredado (NO EDITABLE)
 *   - precio_sucursales = Precio de venta a sucursales (solo matrices)
 *   - precio_clientes = Precio de venta al cliente final
 *
 * For matrix companies (no parent):
 *   - mi_costo = precio_mayorista (what LogiRapid charges them)
 *   - precio_sucursales = price they give to their branches
 *   - precio_clientes = price to end customers
 *
 * For branches (has parent):
 *   - mi_costo = parent's precio_sucursales (what parent charges them)
 *   - precio_clientes = price to end customers (no precio_sucursales for branches)
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
      // For branches: mi_costo is parent's precio_sucursales
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
          -- Catalog prices (provider level)
          COALESCE(pc.mi_costo, pc.provider_cost) as catalog_mi_costo,
          COALESCE(pc.precio_mayorista, pc.provider_b2b_price) as catalog_precio_mayorista,
          COALESCE(pc.precio_publico, pc.platform_min_b2c) as catalog_precio_publico,
          pc.is_active,
          pc.display_order,
          -- For branches: mi_costo is parent's precio_sucursales or precio_clientes
          COALESCE(
            parent_pricing.precio_sucursales,
            parent_pricing.b2b_price,
            parent_pricing.precio_clientes,
            parent_pricing.b2c_price,
            parent_pricing.mi_costo,
            pc.precio_mayorista,
            pc.provider_b2b_price
          ) as mi_costo,
          -- Current company pricing
          cpp.id as pricing_id,
          cpp.mi_costo as current_mi_costo,
          COALESCE(cpp.precio_sucursales, cpp.b2b_price) as precio_sucursales,
          COALESCE(cpp.precio_clientes, cpp.b2c_price) as precio_clientes,
          cpp.markup_type,
          cpp.markup_value,
          COALESCE(cpp.margen_clientes, cpp.margin) as margen_clientes,
          COALESCE(cpp.margen_clientes_pct, cpp.margin_percentage) as margen_clientes_pct,
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
      // Matrix company - mi_costo is catalog's precio_mayorista
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
          -- Catalog prices (provider level)
          COALESCE(pc.mi_costo, pc.provider_cost) as catalog_mi_costo,
          COALESCE(pc.precio_mayorista, pc.provider_b2b_price) as catalog_precio_mayorista,
          COALESCE(pc.precio_publico, pc.platform_min_b2c) as catalog_precio_publico,
          pc.is_active,
          pc.display_order,
          -- For matrix: mi_costo is catalog's precio_mayorista
          COALESCE(pc.precio_mayorista, pc.provider_b2b_price, pc.platform_price) as mi_costo,
          -- Current company pricing
          cpp.id as pricing_id,
          cpp.mi_costo as current_mi_costo,
          COALESCE(cpp.precio_sucursales, cpp.b2b_price) as precio_sucursales,
          COALESCE(cpp.precio_clientes, cpp.b2c_price) as precio_clientes,
          cpp.markup_type,
          cpp.markup_value,
          COALESCE(cpp.margen_clientes, cpp.margin) as margen_clientes,
          COALESCE(cpp.margen_clientes_pct, cpp.margin_percentage) as margen_clientes_pct,
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

    // Format response with new field names
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

      // Catalog level prices (for reference - provider level)
      catalogMiCosto: parseFloat(row.catalog_mi_costo || 0),
      catalogPrecioMayorista: parseFloat(row.catalog_precio_mayorista || 0),
      catalogPrecioPublico: parseFloat(row.catalog_precio_publico || 0),

      // Company level pricing - NEW SIMPLIFIED NAMES
      miCosto: parseFloat(row.mi_costo || 0),  // Inherited cost - NOT EDITABLE
      precioSucursales: row.precio_sucursales ? parseFloat(row.precio_sucursales) : null, // For branches (only matrices)
      precioClientes: row.precio_clientes ? parseFloat(row.precio_clientes) : null, // For end customers

      // Legacy field names (for backwards compatibility)
      costPrice: parseFloat(row.mi_costo || 0),
      b2bPrice: row.precio_sucursales ? parseFloat(row.precio_sucursales) : null,
      b2cPrice: row.precio_clientes ? parseFloat(row.precio_clientes) : null,

      markupType: row.markup_type,
      markupValue: row.markup_value ? parseFloat(row.markup_value) : null,

      // Margins
      margenClientes: row.margen_clientes ? parseFloat(row.margen_clientes) : null,
      margenClientesPct: row.margen_clientes_pct ? parseFloat(row.margen_clientes_pct) : null,

      // Metadata
      priceSource: row.price_source,
      hasPricing: row.pricing_id !== null,
      pricingId: row.pricing_id,

      // Company type flags
      isBranch,
      canEditPrecioSucursales: !isBranch, // Only matrices can set precio_sucursales

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
 * Set or update pricing for products - NEW SIMPLIFIED MODEL
 *
 * Body: {
 *   products: [{
 *     productId: number,
 *     precioSucursales?: number,  // Price for branches (only matrices)
 *     precioClientes?: number,    // Price for end customers
 *     markupType?: 'percentage' | 'fixed',
 *     markupValue?: number
 *   }],
 *   notes?: string
 * }
 *
 * Validation rules:
 * - precio_sucursales >= mi_costo (cannot sell to branches cheaper than cost)
 * - precio_clientes >= mi_costo (cannot lose money on sales)
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
        const {
          productId,
          // New field names
          precioSucursales,
          precioClientes,
          // Legacy support
          b2bPrice,
          b2cPrice,
          markupType,
          markupValue
        } = product

        if (!productId) {
          results.push({ productId: 0, success: false, error: 'productId requerido' })
          continue
        }

        // Get product info and determine mi_costo
        let costPriceQuery: string
        let costParams: any[]

        if (isBranch) {
          // For branches: mi_costo is parent's precio_sucursales
          costPriceQuery = `
            SELECT
              pc.id,
              COALESCE(pc.precio_mayorista, pc.provider_b2b_price, pc.platform_price) as catalog_cost,
              COALESCE(pc.precio_publico, pc.platform_min_b2c) as catalog_publico,
              COALESCE(
                parent.precio_sucursales,
                parent.b2b_price,
                parent.precio_clientes,
                parent.b2c_price,
                parent.mi_costo,
                pc.precio_mayorista,
                pc.provider_b2b_price
              ) as mi_costo
            FROM product_catalog pc
            LEFT JOIN company_product_pricing parent
              ON parent.product_id = pc.id
              AND parent.company_id = $2
            WHERE pc.id = $1
          `
          costParams = [productId, company.parent_company_id]
        } else {
          // For matrix: mi_costo is catalog's precio_mayorista
          costPriceQuery = `
            SELECT
              id,
              COALESCE(precio_mayorista, provider_b2b_price, platform_price) as mi_costo,
              COALESCE(precio_publico, platform_min_b2c) as catalog_publico
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
        const miCosto = parseFloat(productInfo.mi_costo || 0)
        const catalogPrecioPublico = parseFloat(productInfo.catalog_publico || 0)

        // Use new names, fallback to legacy
        let finalPrecioSucursales = precioSucursales ?? b2bPrice
        let finalPrecioClientes = precioClientes ?? b2cPrice

        // If markup is provided for branches, calculate prices from markup
        if (isBranch && markupType && markupValue !== undefined) {
          if (markupType === 'percentage') {
            finalPrecioClientes = miCosto * (1 + markupValue / 100)
          } else if (markupType === 'fixed') {
            finalPrecioClientes = miCosto + markupValue
          }
        }

        // Branches cannot set precio_sucursales (they don't have branches)
        if (isBranch && finalPrecioSucursales !== undefined && finalPrecioSucursales !== null) {
          // Silently ignore - branches cannot have precio_sucursales
          finalPrecioSucursales = null
        }

        // Validation: precio_sucursales >= mi_costo (for matrices)
        if (!isBranch && finalPrecioSucursales !== undefined && finalPrecioSucursales !== null && finalPrecioSucursales < miCosto) {
          results.push({
            productId,
            success: false,
            error: `Precio Sucursales ($${finalPrecioSucursales}) no puede ser menor que Mi Costo ($${miCosto})`
          })
          continue
        }

        // Validation: precio_clientes >= mi_costo
        if (finalPrecioClientes !== undefined && finalPrecioClientes !== null && finalPrecioClientes < miCosto) {
          results.push({
            productId,
            success: false,
            error: `Precio Clientes ($${finalPrecioClientes}) no puede ser menor que Mi Costo ($${miCosto})`
          })
          continue
        }

        // Calculate margin
        let margenClientes = null
        let margenClientesPct = null
        if (finalPrecioClientes !== undefined && finalPrecioClientes !== null && miCosto > 0) {
          margenClientes = finalPrecioClientes - miCosto
          margenClientesPct = ((finalPrecioClientes - miCosto) / miCosto) * 100
        }

        // Determine price_source
        const priceSource = isBranch ? 'parent_company' : 'platform'

        // Upsert pricing with new field names
        await db.query(`
          INSERT INTO company_product_pricing (
            company_id, product_id, mi_costo,
            precio_sucursales, precio_clientes,
            margen_clientes, margen_clientes_pct,
            price_source, parent_company_id,
            markup_type, markup_value
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (company_id, product_id)
          DO UPDATE SET
            mi_costo = $3,
            precio_sucursales = COALESCE($4, company_product_pricing.precio_sucursales),
            precio_clientes = COALESCE($5, company_product_pricing.precio_clientes),
            margen_clientes = COALESCE($6, company_product_pricing.margen_clientes),
            margen_clientes_pct = COALESCE($7, company_product_pricing.margen_clientes_pct),
            price_source = $8,
            parent_company_id = $9,
            markup_type = COALESCE($10, company_product_pricing.markup_type),
            markup_value = COALESCE($11, company_product_pricing.markup_value),
            updated_at = NOW()
        `, [
          companyId,
          productId,
          miCosto,
          finalPrecioSucursales || null,
          finalPrecioClientes || null,
          margenClientes,
          margenClientesPct,
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
