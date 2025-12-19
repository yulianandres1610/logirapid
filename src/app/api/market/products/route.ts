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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        id,
        name,
        description,
        image_url,
        category,
        cost_price,
        selling_price,
        currency,
        sku,
        barcode,
        supplier_name,
        supplier_contact,
        supplier_reference,
        quantity_on_hand,
        quantity_expected,
        minimum_stock,
        is_active,
        unit_of_measure,
        odoo_product_id,
        odoo_last_sync,
        created_at,
        updated_at
      FROM market_products
      WHERE company_id = $1
    `

    const queryParams: (string | number)[] = [companyId]
    let paramIndex = 2

    // Search filter
    if (search) {
      query += ` AND (LOWER(name) LIKE $${paramIndex} OR LOWER(sku) LIKE $${paramIndex} OR LOWER(barcode) LIKE $${paramIndex})`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    // Category filter
    if (category) {
      query += ` AND category = $${paramIndex}`
      queryParams.push(category)
      paramIndex++
    }

    // Stock filter
    if (stockFilter === 'low-stock') {
      query += ` AND quantity_on_hand <= minimum_stock AND quantity_on_hand > 0`
    } else if (stockFilter === 'out-of-stock') {
      query += ` AND quantity_on_hand = 0`
    } else if (stockFilter === 'in-stock') {
      query += ` AND quantity_on_hand > minimum_stock`
    }

    // Only active products by default
    query += ` AND is_active = true`

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]+FROM/, 'SELECT COUNT(*) as total FROM')
    const countResult = await db.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add pagination
    query += ` ORDER BY name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
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

    // Calculate stock stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE quantity_on_hand > minimum_stock) as in_stock,
        COUNT(*) FILTER (WHERE quantity_on_hand <= minimum_stock AND quantity_on_hand > 0) as low_stock,
        COUNT(*) FILTER (WHERE quantity_on_hand = 0) as out_of_stock
      FROM market_products
      WHERE company_id = $1 AND is_active = true
    `, [companyId])

    return NextResponse.json({
      success: true,
      data: {
        products: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          imageUrl: row.image_url,
          category: row.category,
          costPrice: parseFloat(row.cost_price) || 0,
          sellingPrice: parseFloat(row.selling_price) || 0,
          currency: row.currency || 'USD',
          sku: row.sku,
          barcode: row.barcode,
          supplierName: row.supplier_name,
          supplierContact: row.supplier_contact,
          supplierReference: row.supplier_reference,
          quantityOnHand: parseInt(row.quantity_on_hand) || 0,
          quantityExpected: parseInt(row.quantity_expected) || 0,
          minimumStock: parseInt(row.minimum_stock) || 0,
          isActive: row.is_active,
          unitOfMeasure: row.unit_of_measure || 'unidad',
          odooProductId: row.odoo_product_id,
          odooLastSync: row.odoo_last_sync,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
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
        }
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
      minimumStock = 0
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

    // Generate barcode if not provided (EAN-13 format)
    const finalBarcode = barcode || generateBarcode()

    // Ensure unit_of_measure column exists
    try {
      await db.query(`ALTER TABLE market_products ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(20) DEFAULT 'unidad'`)
    } catch {
      // Column may already exist
    }

    // Get user name for logging
    let userName = payload.email
    try {
      const userResult = await db.query('SELECT name FROM users WHERE id = $1', [userId])
      if (userResult.rows[0]?.name) {
        userName = userResult.rows[0].name
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
        is_active, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14,
        0, 0, $15,
        true, $16, NOW(), NOW()
      ) RETURNING id
    `, [
      companyId, name, description || null, imageUrl || null, category || null, unitOfMeasure || 'unidad',
      costPrice, sellingPrice, currency, finalSku, finalBarcode,
      supplierName || null, supplierContact || null, supplierReference || null,
      minimumStock, userId
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

    return NextResponse.json({
      success: true,
      data: {
        id: productId,
        sku: finalSku,
        barcode: finalBarcode
      },
      message: 'Producto creado exitosamente'
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
