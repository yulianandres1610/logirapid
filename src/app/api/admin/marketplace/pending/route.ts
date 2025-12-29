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
 * GET /api/admin/marketplace/pending
 * List all pending marketplace listings for approval (SUPER_ADMIN only)
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

    // Only SUPER_ADMIN can access
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede acceder'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const province = searchParams.get('province')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let whereClause = `WHERE ml.status = 'pending'`
    const queryParams: (string | number)[] = []
    let paramIndex = 1

    if (province) {
      whereClause += ` AND c.market_province = $${paramIndex}`
      queryParams.push(province)
      paramIndex++
    }

    // Get pending listings with full details
    const result = await db.query(`
      SELECT
        ml.id,
        ml.listing_code,
        ml.price_marketplace,
        ml.original_product_price,
        ml.currency,
        ml.quantity_listed,
        ml.submitted_at,
        ml.created_at,
        mp.id as product_id,
        mp.name as product_name,
        mp.sku as product_sku,
        mp.barcode as product_barcode,
        mp.image_url as product_image,
        mp.category as product_category,
        mp.description as product_description,
        mp.cost_price as product_cost,
        mp.selling_price as product_selling_price,
        mw.id as warehouse_id,
        mw.name as warehouse_name,
        mw.code as warehouse_code,
        c.id as company_id,
        c.legalname as company_name,
        c.market_province as province,
        c.market_municipality as municipality,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as created_by_name,
        -- Price alerts for this listing
        (
          SELECT json_agg(json_build_object(
            'id', pa.id,
            'alertType', pa.alert_type,
            'severity', pa.severity,
            'message', pa.alert_message,
            'priceDifference', pa.price_difference_percent
          ))
          FROM marketplace_price_alerts pa
          WHERE pa.listing_id = ml.id AND pa.status = 'active'
        ) as alerts,
        -- Average price in marketplace for this category
        (
          SELECT AVG(ml2.price_marketplace)
          FROM marketplace_listings ml2
          JOIN market_products mp2 ON ml2.product_id = mp2.id
          WHERE ml2.status = 'approved'
            AND ml2.company_id != ml.company_id
            AND (mp2.category = mp.category OR mp2.sku = mp.sku)
        ) as market_average_price,
        -- Count of similar products in marketplace
        (
          SELECT COUNT(*)
          FROM marketplace_listings ml2
          JOIN market_products mp2 ON ml2.product_id = mp2.id
          WHERE ml2.status = 'approved'
            AND ml2.company_id != ml.company_id
            AND (mp2.category = mp.category OR mp2.sku = mp.sku)
        ) as competitor_count
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      JOIN market_warehouses mw ON ml.warehouse_id = mw.id
      JOIN companies c ON ml.company_id = c.id
      LEFT JOIN users u ON ml.created_by = u.id
      ${whereClause}
      ORDER BY ml.submitted_at ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset])

    // Count total pending
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM marketplace_listings ml
      JOIN companies c ON ml.company_id = c.id
      ${whereClause}
    `, queryParams)

    const total = parseInt(countResult.rows[0]?.total) || 0

    // Get stats by province
    const statsResult = await db.query(`
      SELECT
        c.market_province as province,
        COUNT(*) as count
      FROM marketplace_listings ml
      JOIN companies c ON ml.company_id = c.id
      WHERE ml.status = 'pending'
      GROUP BY c.market_province
      ORDER BY count DESC
    `)

    return NextResponse.json({
      success: true,
      data: {
        listings: result.rows.map(row => ({
          id: row.id,
          listingCode: row.listing_code,
          priceMarketplace: parseFloat(row.price_marketplace) || 0,
          originalProductPrice: parseFloat(row.original_product_price) || 0,
          currency: row.currency || 'USD',
          quantityListed: parseInt(row.quantity_listed) || 0,
          submittedAt: row.submitted_at,
          createdAt: row.created_at,
          product: {
            id: row.product_id,
            name: row.product_name,
            sku: row.product_sku,
            barcode: row.product_barcode,
            imageUrl: row.product_image,
            category: row.product_category,
            description: row.product_description,
            costPrice: parseFloat(row.product_cost) || 0,
            sellingPrice: parseFloat(row.product_selling_price) || 0
          },
          warehouse: {
            id: row.warehouse_id,
            name: row.warehouse_name,
            code: row.warehouse_code
          },
          company: {
            id: row.company_id,
            name: row.company_name,
            province: row.province,
            municipality: row.municipality
          },
          createdByName: row.created_by_name,
          alerts: row.alerts || [],
          marketComparison: {
            averagePrice: row.market_average_price ? parseFloat(row.market_average_price) : null,
            competitorCount: parseInt(row.competitor_count) || 0
          }
        })),
        stats: {
          total,
          byProvince: statsResult.rows.map(row => ({
            province: row.province,
            count: parseInt(row.count) || 0
          }))
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
    console.error('[Admin Marketplace] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener solicitudes pendientes'
    }, { status: 500 })
  }
}
