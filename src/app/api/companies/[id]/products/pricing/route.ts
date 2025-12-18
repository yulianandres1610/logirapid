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
      // For branches: mi_costo is branch-specific price OR parent's precio_sucursales
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
          pc.currency,
          pc.mi_costo_fijo as catalog_mi_costo_fijo,
          pc.precio_mayorista_fijo as catalog_precio_mayorista_fijo,
          -- Catalog prices (provider level)
          pc.mi_costo as catalog_mi_costo,
          pc.precio_mayorista as catalog_precio_mayorista,
          pc.precio_publico as catalog_precio_publico,
          pc.is_active,
          pc.display_order,
          -- For branches: mi_costo is branch-specific price, or parent's precio_sucursales
          -- NEW: First check branch_product_pricing for branch-specific price
          COALESCE(
            bpp.precio_sucursal,           -- Branch-specific price (from branch_product_pricing)
            parent_pricing.precio_sucursales,  -- Default for all branches
            parent_pricing.precio_clientes,
            parent_pricing.mi_costo,
            pc.precio_mayorista
          ) as mi_costo,
          -- Flag to indicate if price is custom for this branch
          CASE WHEN bpp.precio_sucursal IS NOT NULL THEN true ELSE false END as has_custom_branch_price,
          bpp.precio_sucursal as custom_branch_price,
          -- Current company pricing
          cpp.id as pricing_id,
          cpp.mi_costo as current_mi_costo,
          cpp.precio_sucursales,
          cpp.precio_clientes,
          cpp.markup_type,
          cpp.markup_value,
          cpp.margen_clientes,
          cpp.margen_clientes_pct,
          cpp.price_source,
          cpp.is_active as pricing_active,
          -- Provider fields
          cpp.provider_cost,
          cpp.precio_a_logirapid,
          cpp.is_provider_pricing
        FROM product_catalog pc
        -- NEW: Join to branch_product_pricing for branch-specific prices
        LEFT JOIN branch_product_pricing bpp
          ON bpp.product_id = pc.id
          AND bpp.branch_company_id = $1      -- This branch
          AND bpp.matrix_company_id = $2      -- The parent matrix company
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
          pc.currency,
          pc.mi_costo_fijo as catalog_mi_costo_fijo,
          pc.precio_mayorista_fijo as catalog_precio_mayorista_fijo,
          -- Catalog prices (provider level)
          pc.mi_costo as catalog_mi_costo,
          pc.precio_mayorista as catalog_precio_mayorista,
          pc.precio_publico as catalog_precio_publico,
          pc.is_active,
          pc.display_order,
          -- For matrix: mi_costo es el precio especial de la empresa, o el precio global si no tiene
          COALESCE(cpp.mi_costo, pc.precio_mayorista) as mi_costo,
          -- Current company pricing
          cpp.id as pricing_id,
          cpp.mi_costo as current_mi_costo,
          cpp.precio_sucursales,
          cpp.precio_clientes,
          cpp.markup_type,
          cpp.markup_value,
          cpp.margen_clientes,
          cpp.margen_clientes_pct,
          cpp.price_source,
          cpp.is_active as pricing_active,
          -- Provider fields
          cpp.provider_cost,
          cpp.precio_a_logirapid,
          cpp.is_provider_pricing
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

    // Get services count for each product
    const servicesCountResult = await db.query(`
      SELECT product_id, COUNT(*) as services_count
      FROM company_product_services
      WHERE company_id = $1 AND is_active = true
      GROUP BY product_id
    `, [companyId])

    const servicesCountMap: Record<number, number> = {}
    servicesCountResult.rows.forEach((row: any) => {
      servicesCountMap[row.product_id] = parseInt(row.services_count) || 0
    })

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
      currency: row.currency || null,
      displayOrder: row.display_order,
      servicesCount: servicesCountMap[row.id] || 0,

      // Catalog level prices (for reference - provider level)
      catalogMiCosto: parseFloat(row.catalog_mi_costo || 0),
      catalogMiCostoFijo: parseFloat(row.catalog_mi_costo_fijo || 0),
      catalogPrecioMayorista: parseFloat(row.catalog_precio_mayorista || 0),
      catalogPrecioMayoristaFijo: parseFloat(row.catalog_precio_mayorista_fijo || 0),
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

      // Branch-specific pricing info (NEW - for branches only)
      hasCustomBranchPrice: row.has_custom_branch_price || false,
      customBranchPrice: row.custom_branch_price ? parseFloat(row.custom_branch_price) : null,

      // Provider info
      isProviderCategory: isProvider && providerCategories.includes(row.service_category),

      // Provider pricing (only for provider companies)
      providerCost: row.provider_cost ? parseFloat(row.provider_cost) : null,
      precioALogiRapid: row.precio_a_logirapid ? parseFloat(row.precio_a_logirapid) : null,
      isProviderPricing: row.is_provider_pricing || false
    }))

    // ============================================================
    // RECHARGE PRODUCTS - Fetch from external_recharge_products
    // Only products with MANUAL pricing configured by SuperAdmin
    // Logic:
    //   - LogiRapid cost = manual_cost_price
    //   - LogiRapid selling price to companies = manual_selling_price
    //   - Company's miCosto = LogiRapid's manual_selling_price
    //   - Company can set their own precioClientes in recharge_product_pricing
    // ============================================================
    const rechargeProductsResult = await db.query(`
      SELECT
        erp.id,
        erp.external_id,
        erp.name,
        erp.custom_name,
        erp.description,
        erp.custom_description,
        erp.base_cost,
        erp.country_code,
        erp.country_name,
        erp.is_active,
        erp.is_promotion,
        erp.valid_from,
        erp.valid_to,
        erp.manual_cost_price,
        erp.manual_selling_price,
        erp.provider_amount,
        -- Get company-specific pricing from recharge_product_pricing
        rpp.id as company_pricing_id,
        rpp.selling_price as company_selling_price,
        rpp.margin_type as company_margin_type,
        rpp.margin_value as company_margin_value,
        rpp.is_enabled as company_pricing_enabled
      FROM external_recharge_products erp
      LEFT JOIN recharge_product_pricing rpp
        ON rpp.external_product_id = erp.id
        AND rpp.company_id = $1
      WHERE erp.is_active = true
        -- Only include products with manual pricing configured by SuperAdmin
        AND erp.manual_cost_price IS NOT NULL
        AND erp.manual_selling_price IS NOT NULL
      ORDER BY erp.country_name ASC, erp.name ASC
    `, [companyId])

    // Transform recharge products to match the products format
    const rechargeProducts = rechargeProductsResult.rows.map((row: any) => {
      // For companies:
      // - miCosto = LogiRapid's selling price (manual_selling_price) - what LogiRapid charges the company
      // - precioClientes = company's configured price, or miCosto by default
      const miCosto = parseFloat(row.manual_selling_price)

      // Company-specific selling price from recharge_product_pricing, or default to miCosto
      const precioClientes = row.company_selling_price
        ? parseFloat(row.company_selling_price)
        : miCosto

      // LogiRapid's own cost (for reference)
      const logirapidCost = parseFloat(row.manual_cost_price)

      // Calculate margin
      const margenClientes = precioClientes - miCosto
      const margenClientesPct = miCosto > 0 ? ((precioClientes - miCosto) / miCosto) * 100 : 0

      return {
        productId: `recharge-${row.id}`,  // Prefix to distinguish from catalog products
        rechargeProductId: row.id,
        code: `REC-${row.id}`,
        name: row.custom_name || row.name,
        description: row.custom_description || row.description,
        serviceCategory: 'recarga',
        productType: 'recharge',
        dimensions: null,
        weightCapacity: null,
        unitType: 'unit',
        pricingModel: 'manual',
        currency: 'USD',
        displayOrder: 0,
        servicesCount: 0,

        // Catalog level prices (LogiRapid's prices)
        catalogMiCosto: logirapidCost,  // LogiRapid's cost
        catalogMiCostoFijo: 0,
        catalogPrecioMayorista: miCosto,  // What LogiRapid charges companies
        catalogPrecioMayoristaFijo: 0,
        catalogPrecioPublico: 0,

        // Company level pricing
        miCosto,  // Company's cost = LogiRapid's selling price
        precioSucursales: null,
        precioClientes,  // Company's selling price (from recharge_product_pricing or default)

        // Legacy field names
        costPrice: miCosto,
        b2bPrice: null,
        b2cPrice: precioClientes,

        markupType: row.company_margin_type || null,
        markupValue: row.company_margin_value ? parseFloat(row.company_margin_value) : null,

        // Margins
        margenClientes,
        margenClientesPct,

        // Metadata
        priceSource: row.company_pricing_id ? 'company' : 'platform',
        hasPricing: true,
        pricingId: row.company_pricing_id || row.id,
        hasCompanyPricing: row.company_pricing_id !== null,

        // Company type flags
        isBranch,
        canEditPrecioSucursales: false,
        hasCustomBranchPrice: false,
        customBranchPrice: null,
        isProviderCategory: false,
        providerCost: null,
        precioALogiRapid: null,
        isProviderPricing: false,

        // Recharge-specific fields
        isRechargeProduct: true,
        countryCode: row.country_code,
        countryName: row.country_name,
        isPromotion: row.is_promotion || false,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        hasManualPricing: true,
        providerAmount: row.provider_amount ? parseFloat(row.provider_amount) : null,

        // LogiRapid's cost for reference (SuperAdmin sees this)
        logirapidCost
      }
    })

    // Combine catalog products with recharge products
    const allProducts = [...products, ...rechargeProducts]

    // Group by category
    const byCategory: Record<string, typeof allProducts> = {}
    for (const product of allProducts) {
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
        products: allProducts,
        byCategory,
        total: allProducts.length,
        catalogProductsCount: products.length,
        rechargeProductsCount: rechargeProducts.length
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

    // Get company info including provider status
    const companyResult = await db.query(`
      SELECT id, legalname, parent_company_id, is_provider, provider_categories
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
    const isProvider = company.is_provider === true
    const providerCategories: string[] = company.provider_categories || []

    const results: { productId: number | string; success: boolean; error?: string }[] = []

    for (const product of products) {
      try {
        const {
          productId,
          // New field names
          precioSucursales,
          precioClientes,
          // Precio especial que LogiRapid asigna a esta empresa (sobrescribe precio global)
          miCostoEspecial,
          // Provider fields
          providerCost,
          precioALogiRapid,
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

        // ============================================================
        // HANDLE RECHARGE PRODUCTS (productId starts with "recharge-")
        // ============================================================
        const isRechargeProduct = typeof productId === 'string' && productId.startsWith('recharge-')

        console.log('[Company Pricing POST] Processing product:', {
          productId,
          productIdType: typeof productId,
          isRechargeProduct,
          precioClientes,
          b2cPrice
        })

        if (isRechargeProduct) {
          // Extract the actual recharge product ID
          const rechargeProductId = parseInt(productId.replace('recharge-', ''))

          if (isNaN(rechargeProductId)) {
            results.push({ productId, success: false, error: 'ID de producto de recarga invalido' })
            continue
          }

          // Get recharge product info
          const rechargeProductResult = await db.query(`
            SELECT id, manual_selling_price
            FROM external_recharge_products
            WHERE id = $1 AND is_active = true
          `, [rechargeProductId])

          if (rechargeProductResult.rows.length === 0) {
            results.push({ productId, success: false, error: 'Producto de recarga no encontrado' })
            continue
          }

          const rechargeProduct = rechargeProductResult.rows[0]
          const miCosto = parseFloat(rechargeProduct.manual_selling_price)

          // Use new names, fallback to legacy
          const finalPrecioClientes = precioClientes ?? b2cPrice

          // If no price is being set, skip this product
          if (finalPrecioClientes === undefined || finalPrecioClientes === null) {
            console.log('[Company Pricing POST] Skipping recharge product - no price set:', { productId, finalPrecioClientes })
            results.push({ productId, success: true })
            continue
          }

          // Validation: precio_clientes >= mi_costo (unless SUPER_ADMIN)
          if (user.role !== 'SUPER_ADMIN' && finalPrecioClientes < miCosto) {
            results.push({
              productId,
              success: false,
              error: `Precio Clientes ($${finalPrecioClientes}) no puede ser menor que Mi Costo ($${miCosto})`
            })
            continue
          }

          // Calculate margin (can't be null since we have a price)
          const marginValue = finalPrecioClientes - miCosto

          console.log('[Company Pricing POST] Saving recharge product pricing:', {
            rechargeProductId,
            companyId,
            miCosto,
            finalPrecioClientes,
            marginValue
          })

          // Upsert into recharge_product_pricing
          const upsertResult = await db.query(`
            INSERT INTO recharge_product_pricing (
              external_product_id, company_id,
              margin_type, margin_value, selling_price, is_enabled
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (external_product_id, company_id)
            DO UPDATE SET
              margin_type = $3,
              margin_value = $4,
              selling_price = $5,
              is_enabled = $6,
              updated_at = NOW()
            RETURNING *
          `, [
            rechargeProductId,
            companyId,
            'fixed',  // margin_type
            marginValue,  // margin_value (never null now)
            finalPrecioClientes,  // selling_price (never null now)
            true  // is_enabled
          ])

          console.log('[Company Pricing POST] Upsert result:', upsertResult.rows[0])

          results.push({ productId, success: true })
          continue
        }

        // ============================================================
        // HANDLE CATALOG PRODUCTS (regular numeric productId)
        // ============================================================

        // Get product info and determine mi_costo
        let costPriceQuery: string
        let costParams: any[]

        if (isBranch) {
          // For branches: mi_costo is branch-specific price OR parent's precio_sucursales
          costPriceQuery = `
            SELECT
              pc.id,
              pc.precio_mayorista as catalog_cost,
              pc.precio_publico as catalog_publico,
              pc.service_category,
              COALESCE(
                bpp.precio_sucursal,           -- Branch-specific price (NEW)
                parent.precio_sucursales,      -- Default for all branches
                parent.precio_clientes,
                parent.mi_costo,
                pc.precio_mayorista
              ) as mi_costo
            FROM product_catalog pc
            LEFT JOIN branch_product_pricing bpp
              ON bpp.product_id = pc.id
              AND bpp.branch_company_id = $3   -- This branch
              AND bpp.matrix_company_id = $2   -- The parent matrix
            LEFT JOIN company_product_pricing parent
              ON parent.product_id = pc.id
              AND parent.company_id = $2
            WHERE pc.id = $1
          `
          costParams = [productId, company.parent_company_id, companyId]
        } else {
          // For matrix: mi_costo is catalog's precio_mayorista
          costPriceQuery = `
            SELECT
              id,
              precio_mayorista as mi_costo,
              precio_publico as catalog_publico,
              service_category
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
        // Si LogiRapid asigna un precio especial a esta empresa, usar ese; si no, usar el precio global del catálogo
        const catalogMiCosto = parseFloat(productInfo.mi_costo || 0)
        const miCosto = miCostoEspecial !== undefined && miCostoEspecial !== null
          ? parseFloat(miCostoEspecial)
          : catalogMiCosto
        const catalogPrecioPublico = parseFloat(productInfo.catalog_publico || 0)
        const productCategory = productInfo.service_category || ''

        // Check if this company is a provider for this product's category
        const isProviderForProduct = isProvider && providerCategories.includes(productCategory)

        // Use new names, fallback to legacy
        let finalPrecioSucursales = precioSucursales ?? b2bPrice
        let finalPrecioClientes = precioClientes ?? b2cPrice

        // Provider-specific fields
        let finalProviderCost = providerCost
        let finalPrecioALogiRapid = precioALogiRapid

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
        // SUPER_ADMIN tiene control absoluto - sin restricciones de precio
        if (user.role !== 'SUPER_ADMIN' && !isBranch && finalPrecioSucursales !== undefined && finalPrecioSucursales !== null && finalPrecioSucursales < miCosto) {
          results.push({
            productId,
            success: false,
            error: `Precio Sucursales ($${finalPrecioSucursales}) no puede ser menor que Mi Costo ($${miCosto})`
          })
          continue
        }

        // Validation: precio_clientes >= mi_costo
        // SUPER_ADMIN tiene control absoluto - sin restricciones de precio
        if (user.role !== 'SUPER_ADMIN' && finalPrecioClientes !== undefined && finalPrecioClientes !== null && finalPrecioClientes < miCosto) {
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
            markup_type, markup_value,
            provider_cost, precio_a_logirapid, is_provider_pricing
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
            provider_cost = COALESCE($12, company_product_pricing.provider_cost),
            precio_a_logirapid = COALESCE($13, company_product_pricing.precio_a_logirapid),
            is_provider_pricing = $14,
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
          markupValue || 0,
          isProviderForProduct ? (finalProviderCost || null) : null,
          isProviderForProduct ? (finalPrecioALogiRapid || null) : null,
          isProviderForProduct
        ])

        // If provider updates precio_a_logirapid, update the product_catalog.mi_costo
        if (isProviderForProduct && finalPrecioALogiRapid !== undefined && finalPrecioALogiRapid !== null) {
          await db.query(`
            UPDATE product_catalog
            SET mi_costo = $1,
                updated_at = NOW()
            WHERE id = $2
          `, [finalPrecioALogiRapid, productId])
        }

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
