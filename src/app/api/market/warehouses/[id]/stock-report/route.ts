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
 * GET /api/market/warehouses/[id]/stock-report
 * Get stock report with valuation for a warehouse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id, name, code FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    const warehouse = warehouseCheck.rows[0]

    // Get query params
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const stockFilter = searchParams.get('stockFilter') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build the query
    let whereClause = 'WHERE p.company_id = $1 AND p.is_active = true'
    const queryParams: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    // Search filter
    if (search) {
      whereClause += ` AND (
        LOWER(p.name) LIKE $${paramIndex}
        OR LOWER(p.sku) LIKE $${paramIndex}
        OR LOWER(p.barcode) LIKE $${paramIndex}
        OR LOWER(v.variant_name) LIKE $${paramIndex}
        OR LOWER(v.sku) LIKE $${paramIndex}
        OR LOWER(v.barcode) LIKE $${paramIndex}
      )`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    // Category filter
    if (category) {
      whereClause += ` AND p.category = $${paramIndex}`
      queryParams.push(category)
      paramIndex++
    }

    // Stock filter - applied after join
    let stockFilterClause = ''
    if (stockFilter === 'in-stock') {
      stockFilterClause = 'HAVING COALESCE(SUM(ws.quantity_on_hand), 0) > COALESCE(MAX(p.minimum_stock), 0)'
    } else if (stockFilter === 'low-stock') {
      stockFilterClause = 'HAVING COALESCE(SUM(ws.quantity_on_hand), 0) > 0 AND COALESCE(SUM(ws.quantity_on_hand), 0) <= COALESCE(MAX(p.minimum_stock), 0)'
    } else if (stockFilter === 'out-of-stock') {
      stockFilterClause = 'HAVING COALESCE(SUM(ws.quantity_on_hand), 0) = 0'
    }

    // Get products with stock in this warehouse
    const productsQuery = `
      SELECT
        p.id as product_id,
        v.id as variant_id,
        COALESCE(v.variant_name, p.name) as name,
        COALESCE(v.sku, p.sku) as sku,
        COALESCE(v.barcode, p.barcode) as barcode,
        p.category,
        p.image_url,
        v.image_url as variant_image_url,
        COALESCE(SUM(ws.quantity_on_hand), 0) as quantity_on_hand,
        COALESCE(SUM(ws.quantity_reserved), 0) as quantity_reserved,
        COALESCE(SUM(ws.quantity_on_hand), 0) - COALESCE(SUM(ws.quantity_reserved), 0) as quantity_available,
        COALESCE(v.cost_price, p.cost_price, 0) as cost_price,
        COALESCE(v.selling_price, p.selling_price, 0) as selling_price,
        p.minimum_stock
      FROM market_products p
      LEFT JOIN market_product_variants v ON v.product_id = p.id
      LEFT JOIN market_warehouse_stock ws ON ws.product_id = p.id
        AND (ws.variant_id = v.id OR (ws.variant_id IS NULL AND v.id IS NULL))
        AND ws.warehouse_id = $${paramIndex}
      ${whereClause}
      GROUP BY p.id, v.id, p.name, p.sku, p.barcode, p.category, p.image_url, v.image_url,
               v.variant_name, v.sku, v.barcode, v.cost_price, v.selling_price, p.cost_price, p.selling_price, p.minimum_stock
      ${stockFilterClause}
      ORDER BY name ASC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `

    queryParams.push(warehouseId, limit, offset)

    const productsResult = await db.query(productsQuery, queryParams)

    // Get total count for pagination
    // Note: paramIndex points to where warehouseId was added
    const countQuery = `
      SELECT COUNT(DISTINCT COALESCE(v.id::text, p.id::text)) as total
      FROM market_products p
      LEFT JOIN market_product_variants v ON v.product_id = p.id
      LEFT JOIN market_warehouse_stock ws ON ws.product_id = p.id
        AND (ws.variant_id = v.id OR (ws.variant_id IS NULL AND v.id IS NULL))
        AND ws.warehouse_id = $${paramIndex}
      ${whereClause}
    `

    // Remove limit and offset for count (warehouseId is already at position paramIndex)
    const countParams = queryParams.slice(0, -2)
    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Get summary statistics
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT CASE WHEN COALESCE(ws.quantity_on_hand, 0) > 0 THEN COALESCE(v.id::text, p.id::text) END) as in_stock,
        COUNT(DISTINCT CASE WHEN COALESCE(ws.quantity_on_hand, 0) > 0 AND COALESCE(ws.quantity_on_hand, 0) <= p.minimum_stock THEN COALESCE(v.id::text, p.id::text) END) as low_stock,
        COUNT(DISTINCT CASE WHEN COALESCE(ws.quantity_on_hand, 0) = 0 THEN COALESCE(v.id::text, p.id::text) END) as out_of_stock,
        COALESCE(SUM(ws.quantity_on_hand), 0) as total_units,
        COALESCE(SUM(ws.quantity_on_hand * COALESCE(v.cost_price, p.cost_price, 0)), 0) as total_value,
        COALESCE(SUM(ws.quantity_on_hand * COALESCE(v.selling_price, p.selling_price, 0)), 0) as total_selling_value
      FROM market_products p
      LEFT JOIN market_product_variants v ON v.product_id = p.id
      LEFT JOIN market_warehouse_stock ws ON ws.product_id = p.id
        AND (ws.variant_id = v.id OR (ws.variant_id IS NULL AND v.id IS NULL))
        AND ws.warehouse_id = $1
      WHERE p.company_id = $2 AND p.is_active = true
    `

    const summaryResult = await db.query(summaryQuery, [warehouseId, payload.companyId])
    const summary = summaryResult.rows[0]

    // Get categories for filter
    const categoriesResult = await db.query(
      'SELECT DISTINCT category FROM market_products WHERE company_id = $1 AND category IS NOT NULL ORDER BY category',
      [payload.companyId]
    )

    // Format products response
    const products = productsResult.rows.map(row => ({
      productId: row.product_id,
      variantId: row.variant_id,
      name: row.name,
      sku: row.sku || '',
      barcode: row.barcode || '',
      category: row.category || 'Sin categoría',
      imageUrl: row.variant_image_url || row.image_url,
      quantityOnHand: parseFloat(row.quantity_on_hand) || 0,
      quantityReserved: parseFloat(row.quantity_reserved) || 0,
      quantityAvailable: parseFloat(row.quantity_available) || 0,
      costPrice: parseFloat(row.cost_price) || 0,
      sellingPrice: parseFloat(row.selling_price) || 0,
      totalCostValue: (parseFloat(row.quantity_on_hand) || 0) * (parseFloat(row.cost_price) || 0),
      totalSellingValue: (parseFloat(row.quantity_on_hand) || 0) * (parseFloat(row.selling_price) || 0),
      minimumStock: parseFloat(row.minimum_stock) || 0
    }))

    return NextResponse.json({
      success: true,
      data: {
        warehouse: {
          id: warehouse.id,
          name: warehouse.name,
          code: warehouse.code
        },
        summary: {
          totalProducts: total,
          totalUnits: parseFloat(summary.total_units) || 0,
          totalValue: parseFloat(summary.total_value) || 0,
          totalSellingValue: parseFloat(summary.total_selling_value) || 0,
          inStock: parseInt(summary.in_stock) || 0,
          lowStock: parseInt(summary.low_stock) || 0,
          outOfStock: parseInt(summary.out_of_stock) || 0
        },
        products,
        categories: categoriesResult.rows.map(r => r.category),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Stock Report API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener reporte de stock'
    }, { status: 500 })
  }
}
