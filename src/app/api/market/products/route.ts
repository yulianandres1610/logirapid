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
 * GET /api/market/products
 * List all products for a market company
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    console.log('[Market Products] Fetching products for company:', companyId, 'User:', payload.email)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category')
    const stockFilter = searchParams.get('filter') // 'low-stock', 'out-of-stock', 'in-stock'
    const includeWarehouseStock = searchParams.get('includeWarehouseStock') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Fetch exchange rate if needed for CUP prices
    let exchangeRate = 340 // Default fallback
    if (includeWarehouseStock) {
      try {
        const ratesResponse = await fetch(`${request.nextUrl.origin}/api/market/pos/exchange-rates`)
        if (ratesResponse.ok) {
          const ratesData = await ratesResponse.json()
          if (ratesData.success && ratesData.rates?.CUP) {
            exchangeRate = ratesData.rates.CUP
          }
        }
      } catch (e) {
        console.warn('[Market Products] Could not fetch exchange rate, using default:', e)
      }
    }

    let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.image_url,
        p.category,
        p.cost_price,
        p.selling_price,
        p.currency,
        p.sku,
        p.barcode,
        p.supplier_name,
        p.supplier_contact,
        p.supplier_reference,
        COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) as quantity_on_hand,
        COALESCE(stock_totals.total_expected, p.quantity_expected, 0) as quantity_expected,
        p.minimum_stock,
        p.is_active,
        p.unit_of_measure,
        p.odoo_product_id,
        p.odoo_last_sync,
        p.created_at,
        p.updated_at
      FROM market_products p
      LEFT JOIN (
        SELECT
          product_id,
          SUM(quantity_on_hand) as total_on_hand,
          SUM(COALESCE(quantity_reserved, 0)) as total_expected
        FROM market_warehouse_stock
        GROUP BY product_id
      ) stock_totals ON p.id = stock_totals.product_id
      WHERE p.company_id = $1
    `

    const queryParams: (string | number)[] = [companyId]
    let paramIndex = 2

    // Search filter - includes variant barcodes/SKUs
    if (search) {
      query += ` AND (
        LOWER(p.name) LIKE $${paramIndex}
        OR LOWER(p.sku) LIKE $${paramIndex}
        OR LOWER(p.barcode) LIKE $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM market_product_variants v
          WHERE v.product_id = p.id
          AND (LOWER(v.barcode) LIKE $${paramIndex} OR LOWER(v.sku) LIKE $${paramIndex})
        )
      )`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    // Category filter
    if (category) {
      query += ` AND p.category = $${paramIndex}`
      queryParams.push(category)
      paramIndex++
    }

    // Stock filter - uses COALESCE to handle products with/without warehouse stock
    if (stockFilter === 'low-stock') {
      query += ` AND COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) <= p.minimum_stock AND COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) > 0`
    } else if (stockFilter === 'out-of-stock') {
      query += ` AND COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) = 0`
    } else if (stockFilter === 'in-stock') {
      query += ` AND COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) > p.minimum_stock`
    }

    // Only active products by default
    query += ` AND p.is_active = true`

    // Count total - build a separate count query to avoid regex issues with subqueries
    let countQuery = `
      SELECT COUNT(*) as total
      FROM market_products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity_on_hand) as total_on_hand
        FROM market_warehouse_stock
        GROUP BY product_id
      ) stock_totals ON p.id = stock_totals.product_id
      WHERE p.company_id = $1
    `

    // Rebuild count query with same filters (but different param indexes)
    const countParams: (string | number)[] = [companyId]
    let countParamIndex = 2

    if (search) {
      countQuery += ` AND (
        LOWER(p.name) LIKE $${countParamIndex}
        OR LOWER(p.sku) LIKE $${countParamIndex}
        OR LOWER(p.barcode) LIKE $${countParamIndex}
        OR EXISTS (
          SELECT 1 FROM market_product_variants v
          WHERE v.product_id = p.id
          AND (LOWER(v.barcode) LIKE $${countParamIndex} OR LOWER(v.sku) LIKE $${countParamIndex})
        )
      )`
      countParams.push(`%${search.toLowerCase()}%`)
      countParamIndex++
    }

    if (category) {
      countQuery += ` AND p.category = $${countParamIndex}`
      countParams.push(category)
      countParamIndex++
    }

    if (stockFilter === 'low-stock') {
      countQuery += ` AND COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) <= p.minimum_stock AND COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) > 0`
    } else if (stockFilter === 'out-of-stock') {
      countQuery += ` AND COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) = 0`
    } else if (stockFilter === 'in-stock') {
      countQuery += ` AND COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) > p.minimum_stock`
    }

    countQuery += ` AND p.is_active = true`

    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add pagination
    query += ` ORDER BY p.name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)
    console.log('[Market Products] Found', result.rows.length, 'products, total:', total)

    // Get categories for filters
    const categoriesResult = await db.query(`
      SELECT DISTINCT category
      FROM market_products
      WHERE company_id = $1 AND category IS NOT NULL AND category != ''
      ORDER BY category
    `, [companyId])

    // Get variants for all products
    const productIds = result.rows.map(p => p.id)
    let variantsByProduct: Record<number, Array<{
      id: number
      name: string
      sku: string
      barcode: string
      price: number
      costPrice: number
      stock: number
      imageUrl: string | null
    }>> = {}

    if (productIds.length > 0) {
      const variantsResult = await db.query(`
        SELECT
          id,
          product_id,
          variant_name as name,
          sku,
          barcode,
          selling_price as price,
          cost_price as "costPrice",
          quantity_on_hand as stock,
          image_url as "imageUrl",
          is_active
        FROM market_product_variants
        WHERE product_id = ANY($1) AND is_active = true
        ORDER BY product_id, variant_name ASC
      `, [productIds])

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
          costPrice: parseFloat(v.costPrice) || 0,
          stock: parseFloat(v.stock) || 0,
          imageUrl: v.imageUrl
        })
      }
    }

    // Get warehouse stock for products if requested
    let warehouseStockByProduct: Record<number, Array<{
      warehouseId: number
      warehouseName: string
      warehouseCode: string
      quantityOnHand: number
      quantityReserved: number
      quantityAvailable: number
    }>> = {}

    if (includeWarehouseStock && productIds.length > 0) {
      const warehouseStockResult = await db.query(`
        SELECT
          mws.product_id,
          mws.warehouse_id,
          mw.name as warehouse_name,
          mw.code as warehouse_code,
          COALESCE(SUM(mws.quantity_on_hand), 0) as quantity_on_hand,
          COALESCE(SUM(mws.quantity_reserved), 0) as quantity_reserved,
          COALESCE(SUM(mws.quantity_on_hand - mws.quantity_reserved), 0) as quantity_available
        FROM market_warehouse_stock mws
        JOIN market_warehouses mw ON mws.warehouse_id = mw.id
        WHERE mws.product_id = ANY($1) AND mw.company_id = $2 AND mw.is_active = true
        GROUP BY mws.product_id, mws.warehouse_id, mw.name, mw.code
        ORDER BY mw.name
      `, [productIds, companyId])

      for (const row of warehouseStockResult.rows) {
        if (!warehouseStockByProduct[row.product_id]) {
          warehouseStockByProduct[row.product_id] = []
        }
        warehouseStockByProduct[row.product_id].push({
          warehouseId: row.warehouse_id,
          warehouseName: row.warehouse_name,
          warehouseCode: row.warehouse_code,
          quantityOnHand: parseFloat(row.quantity_on_hand) || 0,
          quantityReserved: parseFloat(row.quantity_reserved) || 0,
          quantityAvailable: parseFloat(row.quantity_available) || 0
        })
      }
    }

    // Calculate stock stats using warehouse stock
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) > p.minimum_stock) as in_stock,
        COUNT(*) FILTER (WHERE COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) <= p.minimum_stock AND COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) > 0) as low_stock,
        COUNT(*) FILTER (WHERE COALESCE(stock_totals.total_on_hand, p.quantity_on_hand, 0) = 0) as out_of_stock
      FROM market_products p
      LEFT JOIN (
        SELECT product_id, SUM(quantity_on_hand) as total_on_hand
        FROM market_warehouse_stock
        GROUP BY product_id
      ) stock_totals ON p.id = stock_totals.product_id
      WHERE p.company_id = $1 AND p.is_active = true
    `, [companyId])

    // Check if search matched a variant (for UI feedback)
    const searchLower = search.toLowerCase()

    return NextResponse.json({
      success: true,
      data: {
        products: result.rows.map(row => {
          const variants = variantsByProduct[row.id] || []
          const hasVariants = variants.length > 0

          // Find if search matched a variant's barcode or SKU
          let matchedVariant: { id: number; name: string; barcode: string; sku: string } | undefined
          if (search && hasVariants) {
            matchedVariant = variants.find(v =>
              (v.barcode && v.barcode.toLowerCase().includes(searchLower)) ||
              (v.sku && v.sku.toLowerCase().includes(searchLower))
            )
          }

          const costPrice = parseFloat(row.cost_price) || 0
          const sellingPrice = parseFloat(row.selling_price) || 0

          // Calculate CUP price and profit margin when warehouse stock is included
          const costPriceCup = includeWarehouseStock ? costPrice * exchangeRate : undefined
          const profitMargin = includeWarehouseStock && costPrice > 0
            ? ((sellingPrice - costPrice) / costPrice) * 100
            : undefined

          // Get warehouse stock for this product
          const warehouseStock = includeWarehouseStock
            ? warehouseStockByProduct[row.id] || []
            : undefined

          // Calculate total stock from warehouses
          const totalWarehouseStock = warehouseStock
            ? warehouseStock.reduce((sum, ws) => sum + ws.quantityAvailable, 0)
            : 0

          return {
            id: row.id,
            name: row.name,
            description: row.description,
            imageUrl: row.image_url,
            category: row.category,
            costPrice,
            sellingPrice,
            currency: row.currency || 'USD',
            sku: row.sku,
            barcode: row.barcode,
            supplierName: row.supplier_name,
            supplierContact: row.supplier_contact,
            supplierReference: row.supplier_reference,
            quantityOnHand: hasVariants
              ? variants.reduce((sum, v) => sum + v.stock, 0)
              : parseFloat(row.quantity_on_hand) || 0,
            quantityExpected: parseFloat(row.quantity_expected) || 0,
            minimumStock: parseInt(row.minimum_stock) || 0,
            isActive: row.is_active,
            unitOfMeasure: row.unit_of_measure || 'unidad',
            odooProductId: row.odoo_product_id,
            odooLastSync: row.odoo_last_sync,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            hasVariants,
            variants: hasVariants ? variants : undefined,
            matchedVariant: matchedVariant ? {
              id: matchedVariant.id,
              name: matchedVariant.name,
              barcode: matchedVariant.barcode,
              sku: matchedVariant.sku
            } : undefined,
            // Multi-warehouse stock data (only included when includeWarehouseStock=true)
            ...(includeWarehouseStock ? {
              costPriceCup,
              profitMargin: profitMargin !== undefined ? Math.round(profitMargin * 100) / 100 : undefined,
              warehouseStock,
              totalStock: totalWarehouseStock
            } : {})
          }
        }),
        categories: categoriesResult.rows.map(r => r.category),
        stats: {
          total: parseInt(statsResult.rows[0]?.total) || 0,
          inStock: parseInt(statsResult.rows[0]?.in_stock) || 0,
          lowStock: parseInt(statsResult.rows[0]?.low_stock) || 0,
          outOfStock: parseInt(statsResult.rows[0]?.out_of_stock) || 0
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        // Exchange rate info (only when warehouse stock is included)
        ...(includeWarehouseStock ? {
          exchangeRate,
          currency: 'CUP'
        } : {})
      }
    })

  } catch (error) {
    console.error('[Market Products API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener productos'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const userId = payload.userId

    const body = await request.json()
    const {
      name,
      description,
      imageUrl,
      category,
      unitOfMeasure = 'unidad',
      costPrice,
      sellingPrice,
      currency = 'USD',
      sku,
      barcode,
      supplierName,
      supplierContact,
      supplierReference,
      minimumStock = 0,
      hasVariants = false,
      variants = []
    } = body

    // Validate required fields
    if (!name || costPrice === undefined || sellingPrice === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Nombre, precio de costo y precio de venta son requeridos'
      }, { status: 400 })
    }

    // Generate SKU if not provided
    const finalSku = sku || `SKU-${Date.now().toString(36).toUpperCase()}`

    // Check if this is a weight product based on unit of measure
    const isWeight = isWeightUnit(unitOfMeasure || 'unidad')
    let weightBarcodePrefix: string | null = null
    let finalBarcode: string

    if (isWeight && !barcode) {
      // Generate weight barcode prefix and weight-format barcode
      weightBarcodePrefix = await generateWeightBarcodePrefix(companyId)
      finalBarcode = generateWeightBarcode(weightBarcodePrefix)
    } else {
      // Generate regular barcode if not provided
      finalBarcode = barcode || generateBarcode()
    }

    // Ensure unit_of_measure column exists
    try {
      await db.query(`ALTER TABLE market_products ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(20) DEFAULT 'unidad'`)
    } catch {
      // Column may already exist
    }

    // Get user name for logging
    let userName = payload.email
    try {
      const userResult = await db.query(
        'SELECT COALESCE(firstname || \' \' || lastname, email) as fullname FROM users WHERE id = $1',
        [userId]
      )
      if (userResult.rows[0]?.fullname) {
        userName = userResult.rows[0].fullname
      }
    } catch {
      // Use email as fallback
    }

    const result = await db.query(`
      INSERT INTO market_products (
        company_id, name, description, image_url, category, unit_of_measure,
        cost_price, selling_price, currency, sku, barcode,
        supplier_name, supplier_contact, supplier_reference,
        quantity_on_hand, quantity_expected, minimum_stock,
        is_weight_product, weight_barcode_prefix,
        is_active, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14,
        0, 0, $15,
        $16, $17,
        true, $18, NOW(), NOW()
      ) RETURNING id
    `, [
      companyId, name, description || null, imageUrl || null, category || null, unitOfMeasure || 'unidad',
      costPrice, sellingPrice, currency, finalSku, finalBarcode,
      supplierName || null, supplierContact || null, supplierReference || null,
      parseInt(minimumStock) || 0,
      isWeight, weightBarcodePrefix,
      userId
    ])

    const productId = result.rows[0].id

    // Log the product creation
    try {
      // Ensure the change logs table exists
      await db.query(`
        CREATE TABLE IF NOT EXISTS market_product_change_logs (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          action VARCHAR(50) NOT NULL,
          field_name VARCHAR(100),
          old_value TEXT,
          new_value TEXT,
          user_id INTEGER,
          user_name VARCHAR(255),
          user_email VARCHAR(255),
          notes TEXT,
          ip_address VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `)

      // Insert creation log with product details
      const productDetails = JSON.stringify({
        name,
        category: category || null,
        costPrice,
        sellingPrice,
        currency,
        sku: finalSku,
        barcode: finalBarcode,
        unitOfMeasure: unitOfMeasure || 'unidad',
        isWeightProduct: isWeight,
        weightBarcodePrefix: weightBarcodePrefix,
        supplierName: supplierName || null,
        minimumStock
      })

      await db.query(`
        INSERT INTO market_product_change_logs (
          product_id, company_id, action, field_name, old_value, new_value,
          user_id, user_name, user_email, notes, created_at
        ) VALUES ($1, $2, 'created', NULL, NULL, $3, $4, $5, $6, $7, NOW())
      `, [
        productId,
        companyId,
        productDetails,
        userId,
        userName,
        payload.email,
        `Producto "${name}" creado con SKU: ${finalSku}`
      ])

      console.log('[Market Products] Product creation logged for product:', productId, 'by user:', userName)
    } catch (logError) {
      console.error('[Market Products] Error logging product creation:', logError)
      // Don't fail the product creation if logging fails
    }

    // Save variants if the product has variants
    const savedVariants: { id: number; name: string; barcode: string; sku: string }[] = []
    if (hasVariants && variants.length > 0) {
      try {
        console.log('[Market Products] Saving', variants.length, 'variants for product:', productId)

        for (let i = 0; i < variants.length; i++) {
          const v = variants[i]
          // Auto-generate barcode if empty
          const variantBarcode = v.barcode || generateBarcode()
          // Auto-generate SKU if empty
          const variantSku = v.sku || `${finalSku}-V${(i + 1).toString().padStart(2, '0')}`
          // Use variant image or fall back to product image
          const variantImageUrl = v.imageUrl || imageUrl || null

          // Validate barcode uniqueness for this variant
          if (variantBarcode && v.barcode) {
            // Check if barcode exists in other products
            const productBarcodeCheck = await db.query(
              'SELECT id, name FROM market_products WHERE company_id = $1 AND barcode = $2',
              [companyId, variantBarcode]
            )
            if (productBarcodeCheck.rows.length > 0) {
              return NextResponse.json({
                success: false,
                error: `El código de barras "${variantBarcode}" ya existe en el producto "${productBarcodeCheck.rows[0].name}"`
              }, { status: 400 })
            }

            // Check if barcode exists in other variants
            const variantBarcodeCheck = await db.query(`
              SELECT v.id, v.variant_name, p.name as product_name
              FROM market_product_variants v
              JOIN market_products p ON p.id = v.product_id
              WHERE p.company_id = $1 AND v.barcode = $2
            `, [companyId, variantBarcode])
            if (variantBarcodeCheck.rows.length > 0) {
              const existing = variantBarcodeCheck.rows[0]
              return NextResponse.json({
                success: false,
                error: `El código de barras "${variantBarcode}" ya existe en la variante "${existing.variant_name}" del producto "${existing.product_name}"`
              }, { status: 400 })
            }
          }

          const variantResult = await db.query(`
            INSERT INTO market_product_variants (
              product_id, variant_name, sku, barcode, cost_price, selling_price,
              quantity_on_hand, image_url, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, true, NOW(), NOW())
            RETURNING id
          `, [
            productId,
            v.name,
            variantSku,
            variantBarcode,
            parseFloat(v.costPrice) || costPrice,
            parseFloat(v.sellingPrice) || sellingPrice,
            variantImageUrl
          ])

          const variantId = variantResult.rows[0].id
          savedVariants.push({
            id: variantId,
            name: v.name,
            barcode: variantBarcode,
            sku: variantSku
          })

          // Save variant options
          if (v.options && v.options.length > 0) {
            for (const opt of v.options) {
              await db.query(`
                INSERT INTO market_variant_options (variant_id, option_type, option_value, created_at)
                VALUES ($1, $2, $3, NOW())
              `, [variantId, opt.type, opt.value])
            }
          }
        }

        console.log('[Market Products] Saved', savedVariants.length, 'variants successfully')
      } catch (variantError) {
        console.error('[Market Products] Error saving variants:', variantError)
        // Don't fail the product creation if variant saving fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: productId,
        sku: finalSku,
        barcode: finalBarcode,
        variants: savedVariants
      },
      message: hasVariants
        ? `Producto creado exitosamente con ${savedVariants.length} variantes`
        : 'Producto creado exitosamente'
    })

  } catch (error) {
    console.error('[Market Products API] Error creating product:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear producto'
    }, { status: 500 })
  }
}

/**
 * Weight units that indicate a product is sold by weight
 */
const WEIGHT_UNITS = ['kg', 'lb', 'g', 'oz', 'libra', 'kilogramo', 'gramo', 'onza']

/**
 * Check if unit of measure indicates a weight product
 */
function isWeightUnit(unit: string): boolean {
  return WEIGHT_UNITS.includes(unit.toLowerCase())
}

/**
 * Generate EAN-13 barcode
 */
function generateBarcode(): string {
  const prefix = '200' // Internal use prefix
  const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')
  const base = prefix + random

  // Calculate check digit
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const checkDigit = (10 - (sum % 10)) % 10

  return base + checkDigit
}

/**
 * Generate a unique 5-digit weight barcode prefix for a company
 */
async function generateWeightBarcodePrefix(companyId: number): Promise<string> {
  // Get all existing prefixes for this company
  const existingResult = await db.query(
    'SELECT weight_barcode_prefix FROM market_products WHERE company_id = $1 AND weight_barcode_prefix IS NOT NULL',
    [companyId]
  )
  const existingPrefixes = new Set(existingResult.rows.map(r => r.weight_barcode_prefix))

  // Generate a unique prefix (00001-99999)
  let prefix: string
  let attempts = 0
  do {
    // Start from a random number to spread distribution
    const num = Math.floor(Math.random() * 99999) + 1
    prefix = num.toString().padStart(5, '0')
    attempts++
    if (attempts > 1000) {
      throw new Error('No se pudo generar un prefijo único para el código de barras')
    }
  } while (existingPrefixes.has(prefix))

  return prefix
}

/**
 * Generate weight barcode in format 20PPPPPWWWWWC (EAN-13)
 * - 20: Prefix for in-store variable weight products (GS1 standard)
 * - PPPPP: 5-digit product code
 * - WWWWW: 5-digit weight placeholder (00000 for base barcode)
 * - C: EAN-13 check digit
 * Total: 12 digits + 1 check digit = 13 digits
 */
function generateWeightBarcode(weightBarcodePrefix: string): string {
  const prefix = weightBarcodePrefix.padStart(5, '0').substring(0, 5)
  const code12 = `20${prefix}00000` // 20 + 5-digit code + 5-digit weight (0)

  // Calculate EAN-13 check digit
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code12[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const checkDigit = (10 - (sum % 10)) % 10

  return code12 + checkDigit
}
