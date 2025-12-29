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
 * GET /api/market/marketplace
 * List all marketplace listings for the current market
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let query = `
      SELECT
        ml.id,
        ml.listing_code,
        ml.product_id,
        ml.warehouse_id,
        ml.price_marketplace,
        ml.original_product_price,
        ml.currency,
        ml.quantity_listed,
        ml.quantity_sold,
        ml.status,
        ml.is_featured,
        ml.marketplace_title,
        ml.submitted_at,
        ml.approved_at,
        ml.rejected_at,
        ml.rejection_reason,
        ml.rejection_category,
        ml.created_at,
        ml.updated_at,
        mp.name as product_name,
        mp.sku as product_sku,
        mp.barcode as product_barcode,
        mp.image_url as product_image,
        mp.category as product_category,
        mp.cost_price as product_cost,
        mp.selling_price as product_selling_price,
        mw.name as warehouse_name,
        mw.code as warehouse_code,
        COALESCE(mws.quantity_on_hand, 0) as warehouse_stock,
        COALESCE(mws.quantity_reserved, 0) as warehouse_reserved,
        COALESCE(u1.firstname || ' ' || u1.lastname, u1.email) as created_by_name,
        COALESCE(u2.firstname || ' ' || u2.lastname, u2.email) as approved_by_name
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      JOIN market_warehouses mw ON ml.warehouse_id = mw.id
      LEFT JOIN market_warehouse_stock mws ON mws.warehouse_id = ml.warehouse_id AND mws.product_id = ml.product_id
      LEFT JOIN users u1 ON ml.created_by = u1.id
      LEFT JOIN users u2 ON ml.approved_by = u2.id
      WHERE ml.company_id = $1
    `

    const queryParams: (string | number)[] = [companyId]
    let paramIndex = 2

    // Filter by status
    if (status && status !== 'all') {
      query += ` AND ml.status = $${paramIndex}`
      queryParams.push(status)
      paramIndex++
    }

    // Search by product name or SKU
    if (search) {
      query += ` AND (mp.name ILIKE $${paramIndex} OR mp.sku ILIKE $${paramIndex} OR ml.listing_code ILIKE $${paramIndex})`
      queryParams.push(`%${search}%`)
      paramIndex++
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      WHERE ml.company_id = $1
      ${status && status !== 'all' ? 'AND ml.status = $2' : ''}
      ${search ? `AND (mp.name ILIKE $${status && status !== 'all' ? '3' : '2'} OR mp.sku ILIKE $${status && status !== 'all' ? '3' : '2'})` : ''}
    `
    const countParams: (string | number)[] = [companyId]
    if (status && status !== 'all') countParams.push(status)
    if (search) countParams.push(`%${search}%`)

    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add pagination
    query += ` ORDER BY ml.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended,
        COUNT(*) FILTER (WHERE status = 'sold_out') as sold_out,
        COALESCE(SUM(quantity_listed * price_marketplace) FILTER (WHERE status = 'approved'), 0) as total_listed_value,
        COALESCE(SUM(quantity_sold * price_marketplace), 0) as total_sold_value
      FROM marketplace_listings
      WHERE company_id = $1
    `, [companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        listings: result.rows.map(row => ({
          id: row.id,
          listingCode: row.listing_code,
          product: {
            id: row.product_id,
            name: row.product_name,
            sku: row.product_sku,
            barcode: row.product_barcode,
            imageUrl: row.product_image,
            category: row.product_category,
            costPrice: parseFloat(row.product_cost) || 0,
            sellingPrice: parseFloat(row.product_selling_price) || 0
          },
          warehouse: {
            id: row.warehouse_id,
            name: row.warehouse_name,
            code: row.warehouse_code,
            stockAvailable: parseInt(row.warehouse_stock) - parseInt(row.warehouse_reserved) || 0,
            stockOnHand: parseInt(row.warehouse_stock) || 0,
            stockReserved: parseInt(row.warehouse_reserved) || 0
          },
          priceMarketplace: parseFloat(row.price_marketplace) || 0,
          originalProductPrice: parseFloat(row.original_product_price) || 0,
          currency: row.currency || 'USD',
          quantityListed: parseInt(row.quantity_listed) || 0,
          quantitySold: parseInt(row.quantity_sold) || 0,
          quantityAvailable: (parseInt(row.quantity_listed) || 0) - (parseInt(row.quantity_sold) || 0),
          status: row.status,
          isFeatured: row.is_featured,
          marketplaceTitle: row.marketplace_title,
          submittedAt: row.submitted_at,
          approvedAt: row.approved_at,
          rejectedAt: row.rejected_at,
          rejectionReason: row.rejection_reason,
          rejectionCategory: row.rejection_category,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          createdByName: row.created_by_name,
          approvedByName: row.approved_by_name
        })),
        stats: {
          total: parseInt(stats.total) || 0,
          pending: parseInt(stats.pending) || 0,
          approved: parseInt(stats.approved) || 0,
          rejected: parseInt(stats.rejected) || 0,
          inactive: parseInt(stats.inactive) || 0,
          suspended: parseInt(stats.suspended) || 0,
          soldOut: parseInt(stats.sold_out) || 0,
          totalListedValue: parseFloat(stats.total_listed_value) || 0,
          totalSoldValue: parseFloat(stats.total_sold_value) || 0
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
    console.error('[Marketplace API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener publicaciones'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/marketplace
 * Create a new marketplace listing
 */
export async function POST(request: NextRequest) {
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const userId = payload.userId

    const body = await request.json()
    const {
      productId,
      warehouseId,
      priceMarketplace,
      quantityListed,
      marketplaceTitle,
      marketplaceDescription
    } = body

    // Validate required fields
    if (!productId || !warehouseId || !priceMarketplace || !quantityListed) {
      return NextResponse.json({
        success: false,
        error: 'Producto, almacen, precio y cantidad son requeridos'
      }, { status: 400 })
    }

    // Validate product belongs to company
    const productResult = await db.query(`
      SELECT id, name, cost_price, selling_price
      FROM market_products
      WHERE id = $1 AND company_id = $2 AND is_active = true
    `, [productId, companyId])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Producto no encontrado o no activo'
      }, { status: 404 })
    }

    const product = productResult.rows[0]

    // Validate warehouse belongs to company
    const warehouseResult = await db.query(`
      SELECT id, name FROM market_warehouses
      WHERE id = $1 AND company_id = $2 AND is_active = true
    `, [warehouseId, companyId])

    if (warehouseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacen no encontrado o no activo'
      }, { status: 404 })
    }

    // Check if product already has an active listing
    const existingListing = await db.query(`
      SELECT id, status FROM marketplace_listings
      WHERE company_id = $1 AND product_id = $2 AND status NOT IN ('rejected', 'inactive')
    `, [companyId, productId])

    if (existingListing.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Este producto ya tiene una publicacion activa en el marketplace'
      }, { status: 400 })
    }

    // Check stock availability
    const stockResult = await db.query(`
      SELECT
        COALESCE(quantity_on_hand, 0) as on_hand,
        COALESCE(quantity_reserved, 0) as reserved
      FROM market_warehouse_stock
      WHERE warehouse_id = $1 AND product_id = $2
    `, [warehouseId, productId])

    let availableStock = 0
    if (stockResult.rows.length > 0) {
      availableStock = stockResult.rows[0].on_hand - stockResult.rows[0].reserved
    }

    if (quantityListed > availableStock) {
      return NextResponse.json({
        success: false,
        error: `Stock insuficiente. Disponible: ${availableStock} unidades`
      }, { status: 400 })
    }

    // Calculate price alert
    const costPrice = parseFloat(product.cost_price)
    const sellingPrice = parseFloat(product.selling_price)
    let priceAlertTriggered = false
    let priceAlertReason = null
    let priceDifferencePercent = 0

    if (priceMarketplace < costPrice) {
      priceAlertTriggered = true
      priceAlertReason = `Precio (${priceMarketplace}) menor al costo (${costPrice})`
      priceDifferencePercent = ((priceMarketplace - costPrice) / costPrice) * 100
    } else if (sellingPrice > 0) {
      priceDifferencePercent = ((priceMarketplace - sellingPrice) / sellingPrice) * 100
      if (Math.abs(priceDifferencePercent) > 30) {
        priceAlertTriggered = true
        if (priceDifferencePercent > 0) {
          priceAlertReason = `Precio ${priceDifferencePercent.toFixed(1)}% mayor al precio base de venta`
        } else {
          priceAlertReason = `Precio ${Math.abs(priceDifferencePercent).toFixed(1)}% menor al precio base de venta`
        }
      }
    }

    // Create listing
    const result = await db.query(`
      INSERT INTO marketplace_listings (
        company_id,
        product_id,
        warehouse_id,
        price_marketplace,
        original_product_price,
        quantity_listed,
        marketplace_title,
        marketplace_description,
        status,
        submitted_at,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), $9)
      RETURNING id, listing_code
    `, [
      companyId,
      productId,
      warehouseId,
      priceMarketplace,
      sellingPrice,
      quantityListed,
      marketplaceTitle || null,
      marketplaceDescription || null,
      userId
    ])

    const listing = result.rows[0]

    // Reserve stock in warehouse
    await db.query(`
      UPDATE market_warehouse_stock
      SET quantity_reserved = COALESCE(quantity_reserved, 0) + $1,
          updated_at = NOW()
      WHERE warehouse_id = $2 AND product_id = $3
    `, [quantityListed, warehouseId, productId])

    // If stock entry doesn't exist, create it
    await db.query(`
      INSERT INTO market_warehouse_stock (warehouse_id, product_id, quantity_on_hand, quantity_reserved)
      VALUES ($1, $2, 0, $3)
      ON CONFLICT (warehouse_id, product_id) DO UPDATE
      SET quantity_reserved = COALESCE(market_warehouse_stock.quantity_reserved, 0) + $3
    `, [warehouseId, productId, quantityListed])

    // Create price alert if needed
    if (priceAlertTriggered) {
      await db.query(`
        INSERT INTO marketplace_price_alerts (
          listing_id, product_id, company_id,
          alert_type, severity,
          current_price, reference_price,
          price_difference_percent,
          alert_message,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      `, [
        listing.id,
        productId,
        companyId,
        priceMarketplace < costPrice ? 'price_below_cost' : 'price_above_threshold',
        priceMarketplace < costPrice ? 'critical' : 'medium',
        priceMarketplace,
        priceMarketplace < costPrice ? costPrice : sellingPrice,
        priceDifferencePercent,
        priceAlertReason
      ])
    }

    console.log('[Marketplace] Created listing:', listing.listing_code, 'for product:', product.name)

    return NextResponse.json({
      success: true,
      data: {
        id: listing.id,
        listingCode: listing.listing_code,
        status: 'pending',
        priceAlertTriggered,
        priceAlertReason
      },
      message: 'Publicacion creada exitosamente. Pendiente de aprobacion.'
    })

  } catch (error) {
    console.error('[Marketplace API] Error creating listing:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear publicacion'
    }, { status: 500 })
  }
}
