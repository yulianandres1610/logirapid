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
 * GET /api/market/pos/products
 * Get all products optimized for POS offline storage
 * Returns products, categories, promotions, and pricelist
 */
export async function GET(request: NextRequest) {
  try {
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId

    const { searchParams } = new URL(request.url)
    const terminalId = searchParams.get('terminalId')
    const warehouseId = searchParams.get('warehouseId')
    const pricelistId = searchParams.get('pricelistId')

    // Get terminal configuration if provided
    let terminalConfig = null
    if (terminalId) {
      const terminalResult = await db.query(`
        SELECT t.*, w.name as warehouse_name, p.name as pricelist_name
        FROM market_pos_terminals t
        LEFT JOIN market_warehouses w ON t.warehouse_id = w.id
        LEFT JOIN market_pricelists p ON t.pricelist_id = p.id
        WHERE t.id = $1 AND t.company_id = $2
      `, [parseInt(terminalId), companyId])

      if (terminalResult.rows.length > 0) {
        terminalConfig = terminalResult.rows[0]
      }
    }

    const effectiveWarehouseId = warehouseId ? parseInt(warehouseId) : terminalConfig?.warehouse_id
    const effectivePricelistId = pricelistId ? parseInt(pricelistId) : terminalConfig?.pricelist_id

    // Get products with inventory for the specified warehouse
    const params: (number | null)[] = [companyId]

    let productsQuery: string
    if (effectiveWarehouseId) {
      params.push(effectiveWarehouseId)
      productsQuery = `
        SELECT
          p.id,
          p.name,
          p.description,
          p.sku,
          p.barcode,
          p.category,
          p.unit_of_measure as unit,
          p.selling_price as sale_price,
          p.cost_price,
          0 as tax_rate,
          COALESCE(p.image_url, pi.image_url) as image_url,
          p.is_active,
          true as track_inventory,
          COALESCE(ws.quantity_on_hand, p.quantity_on_hand, 0) as stock
        FROM market_products p
        LEFT JOIN market_warehouse_stock ws ON p.id = ws.product_id AND ws.warehouse_id = $2 AND ws.variant_id IS NULL
        LEFT JOIN LATERAL (
          SELECT image_url FROM product_images
          WHERE barcode = p.barcode
          ORDER BY COALESCE(is_primary, false) DESC, COALESCE(image_index, 1) ASC LIMIT 1
        ) pi ON true
        WHERE p.company_id = $1 AND p.is_active = true
        ORDER BY p.name ASC
      `
    } else {
      productsQuery = `
        SELECT
          p.id,
          p.name,
          p.description,
          p.sku,
          p.barcode,
          p.category,
          p.unit_of_measure as unit,
          p.selling_price as sale_price,
          p.cost_price,
          0 as tax_rate,
          COALESCE(p.image_url, pi.image_url) as image_url,
          p.is_active,
          true as track_inventory,
          p.quantity_on_hand as stock
        FROM market_products p
        LEFT JOIN LATERAL (
          SELECT image_url FROM product_images
          WHERE barcode = p.barcode
          ORDER BY COALESCE(is_primary, false) DESC, COALESCE(image_index, 1) ASC LIMIT 1
        ) pi ON true
        WHERE p.company_id = $1 AND p.is_active = true
        ORDER BY p.name ASC
      `
    }

    const productsResult = await db.query(productsQuery, params)

    // Get categories from products (using distinct category values)
    const categoriesResult = await db.query(`
      SELECT DISTINCT category as name
      FROM market_products
      WHERE company_id = $1 AND category IS NOT NULL AND category != ''
      ORDER BY category ASC
    `, [companyId])

    // Create category name to ID mapping
    const categoryMap: Record<string, number> = {}
    categoriesResult.rows.forEach((c, index) => {
      categoryMap[c.name] = index + 1
    })

    // Get pricelist items if a pricelist is specified
    let pricelistItems: Record<number, { price?: number; discountPercent?: number }> = {}
    if (effectivePricelistId) {
      const pricelistResult = await db.query(`
        SELECT product_id, fixed_price, discount_percent
        FROM market_pricelist_items
        WHERE pricelist_id = $1
      `, [effectivePricelistId])

      for (const item of pricelistResult.rows) {
        pricelistItems[item.product_id] = {
          price: item.fixed_price ? parseFloat(item.fixed_price) : undefined,
          discountPercent: item.discount_percent ? parseFloat(item.discount_percent) : undefined
        }
      }
    }

    // Get active promotions
    const promotionsResult = await db.query(`
      SELECT
        id, name, code, type,
        discount_percent, discount_amount,
        min_quantity, min_amount,
        buy_quantity, get_quantity,
        applies_to, product_ids, category_ids,
        pos_terminal_ids,
        valid_from, valid_until,
        max_uses, current_uses, max_uses_per_customer
      FROM market_promotions
      WHERE company_id = $1
        AND is_active = true
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until >= NOW())
        AND (max_uses IS NULL OR current_uses < max_uses)
    `, [companyId])

    // Filter promotions by terminal if specified
    const promotions = promotionsResult.rows.filter(p => {
      if (!terminalId || !p.pos_terminal_ids || p.pos_terminal_ids.length === 0) {
        return true
      }
      return p.pos_terminal_ids.includes(parseInt(terminalId))
    })

    // Get variants for all products (join with products to filter by company)
    const variantsResult = await db.query(`
      SELECT
        v.id,
        v.product_id,
        v.variant_name as name,
        v.sku,
        v.barcode,
        v.selling_price as price,
        v.image_url,
        v.is_active,
        COALESCE(ws.quantity_on_hand, v.quantity_on_hand, 0) as stock
      FROM market_product_variants v
      JOIN market_products p ON v.product_id = p.id
      LEFT JOIN market_warehouse_stock ws ON v.product_id = ws.product_id AND v.id = ws.variant_id AND ws.warehouse_id = $1
      WHERE p.company_id = $2 AND v.is_active = true
      ORDER BY v.product_id, v.variant_name ASC
    `, [effectiveWarehouseId || null, companyId])

    // Group variants by product
    const variantsByProduct: Record<number, Array<{
      id: number
      name: string
      sku: string
      barcode: string
      price: number
      stock: number
      imageUrl: string | null
    }>> = {}

    for (const v of variantsResult.rows) {
      if (!variantsByProduct[v.product_id]) {
        variantsByProduct[v.product_id] = []
      }
      variantsByProduct[v.product_id].push({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price: parseFloat(v.price) || 0,
        stock: parseFloat(v.stock) || 0,
        imageUrl: v.image_url
      })
    }

    // Build products with calculated prices and variants
    const products = productsResult.rows.map(p => {
      const pricelistItem = pricelistItems[p.id]
      let finalPrice = parseFloat(p.sale_price) || 0

      if (pricelistItem) {
        if (pricelistItem.price !== undefined) {
          finalPrice = pricelistItem.price
        } else if (pricelistItem.discountPercent !== undefined) {
          finalPrice = finalPrice * (1 - pricelistItem.discountPercent / 100)
        }
      }

      const variants = variantsByProduct[p.id] || []
      const hasVariants = variants.length > 0

      // If product has variants, calculate total stock from variants
      const totalStock = hasVariants
        ? variants.reduce((sum, v) => sum + v.stock, 0)
        : parseFloat(p.stock) || 0

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        sku: p.sku,
        barcode: p.barcode,
        categoryId: p.category ? categoryMap[p.category] || null : null,
        categoryName: p.category || null,
        unit: p.unit,
        basePrice: parseFloat(p.sale_price) || 0,
        price: Math.round(finalPrice * 100) / 100,
        costPrice: parseFloat(p.cost_price) || 0,
        taxRate: parseFloat(p.tax_rate) || 0,
        imageUrl: p.image_url,
        stock: totalStock,
        trackInventory: p.track_inventory,
        hasVariants,
        variants: hasVariants ? variants : undefined
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        products,
        categories: categoriesResult.rows.map((c, index) => ({
          id: index + 1,
          name: c.name,
          parentId: null,
          icon: null,
          color: null
        })),
        promotions: promotions.map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
          type: p.type,
          discountPercent: p.discount_percent ? parseFloat(p.discount_percent) : null,
          discountAmount: p.discount_amount ? parseFloat(p.discount_amount) : null,
          minQuantity: p.min_quantity,
          minAmount: p.min_amount ? parseFloat(p.min_amount) : null,
          buyQuantity: p.buy_quantity,
          getQuantity: p.get_quantity,
          appliesTo: p.applies_to,
          productIds: p.product_ids || [],
          categoryIds: p.category_ids || [],
          validFrom: p.valid_from,
          validUntil: p.valid_until
        })),
        terminal: terminalConfig ? {
          id: terminalConfig.id,
          name: terminalConfig.name,
          warehouseId: terminalConfig.warehouse_id,
          warehouseName: terminalConfig.warehouse_name,
          pricelistId: terminalConfig.pricelist_id,
          pricelistName: terminalConfig.pricelist_name,
          allowPriceEdit: terminalConfig.allow_price_edit,
          allowDiscount: terminalConfig.allow_discount,
          maxDiscountPercent: parseFloat(terminalConfig.max_discount_percent) || 100,
          requireCustomer: terminalConfig.require_customer,
          defaultCurrency: terminalConfig.default_currency,
          acceptedCurrencies: terminalConfig.accepted_currencies || ['USD', 'CUP', 'MLC']
        } : null,
        lastSync: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('[POS Products API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener productos'
    }, { status: 500 })
  }
}
