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
 * GET /api/admin/marketplace/products
 * List all marketplace listings across all markets (SUPER_ADMIN only)
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
    const municipality = searchParams.get('municipality')
    const status = searchParams.get('status')
    const companyId = searchParams.get('companyId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query
    let whereClause = 'WHERE 1=1'
    const queryParams: (string | number)[] = []
    let paramIndex = 1

    if (province) {
      whereClause += ` AND c.market_province = $${paramIndex}`
      queryParams.push(province)
      paramIndex++
    }

    if (municipality) {
      whereClause += ` AND c.market_municipality = $${paramIndex}`
      queryParams.push(municipality)
      paramIndex++
    }

    if (status && status !== 'all') {
      whereClause += ` AND ml.status = $${paramIndex}`
      queryParams.push(status)
      paramIndex++
    }

    if (companyId) {
      whereClause += ` AND ml.company_id = $${paramIndex}`
      queryParams.push(parseInt(companyId))
      paramIndex++
    }

    if (search) {
      whereClause += ` AND (mp.name ILIKE $${paramIndex} OR mp.sku ILIKE $${paramIndex} OR ml.listing_code ILIKE $${paramIndex})`
      queryParams.push(`%${search}%`)
      paramIndex++
    }

    // Get listings with full details
    const result = await db.query(`
      SELECT
        ml.id,
        ml.listing_code,
        ml.price_marketplace,
        ml.original_product_price,
        ml.currency,
        ml.quantity_listed,
        ml.quantity_sold,
        ml.status,
        ml.is_featured,
        ml.submitted_at,
        ml.approved_at,
        ml.rejected_at,
        ml.rejection_reason,
        ml.rejection_category,
        ml.created_at,
        ml.updated_at,
        mp.id as product_id,
        mp.name as product_name,
        mp.sku as product_sku,
        mp.image_url as product_image,
        mp.category as product_category,
        mp.cost_price as product_cost,
        mp.selling_price as product_selling_price,
        mw.id as warehouse_id,
        mw.name as warehouse_name,
        c.id as company_id,
        c.legalname as company_name,
        c.market_province as province,
        c.market_municipality as municipality,
        COALESCE(u1.firstname || ' ' || u1.lastname, u1.email) as created_by_name,
        COALESCE(u2.firstname || ' ' || u2.lastname, u2.email) as approved_by_name
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      JOIN market_warehouses mw ON ml.warehouse_id = mw.id
      JOIN companies c ON ml.company_id = c.id
      LEFT JOIN users u1 ON ml.created_by = u1.id
      LEFT JOIN users u2 ON ml.approved_by = u2.id
      ${whereClause}
      ORDER BY ml.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset])

    // Count total
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      JOIN companies c ON ml.company_id = c.id
      ${whereClause}
    `, queryParams)

    const total = parseInt(countResult.rows[0]?.total) || 0

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ml.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE ml.status = 'approved') as approved,
        COUNT(*) FILTER (WHERE ml.status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE ml.status = 'inactive') as inactive,
        COUNT(*) FILTER (WHERE ml.status = 'suspended') as suspended,
        COUNT(DISTINCT ml.company_id) as total_markets,
        COALESCE(SUM(ml.quantity_listed * ml.price_marketplace) FILTER (WHERE ml.status = 'approved'), 0) as total_listed_value
      FROM marketplace_listings ml
    `)

    const stats = statsResult.rows[0]

    // Get available markets for filter
    const marketsResult = await db.query(`
      SELECT DISTINCT
        c.id,
        c.legalname as name,
        c.market_province as province
      FROM marketplace_listings ml
      JOIN companies c ON ml.company_id = c.id
      ORDER BY c.legalname
    `)

    // Get available provinces for filter
    const provincesResult = await db.query(`
      SELECT DISTINCT c.market_province as province
      FROM marketplace_listings ml
      JOIN companies c ON ml.company_id = c.id
      WHERE c.market_province IS NOT NULL
      ORDER BY c.market_province
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
          quantitySold: parseInt(row.quantity_sold) || 0,
          quantityAvailable: (parseInt(row.quantity_listed) || 0) - (parseInt(row.quantity_sold) || 0),
          status: row.status,
          isFeatured: row.is_featured,
          submittedAt: row.submitted_at,
          approvedAt: row.approved_at,
          rejectedAt: row.rejected_at,
          rejectionReason: row.rejection_reason,
          rejectionCategory: row.rejection_category,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          product: {
            id: row.product_id,
            name: row.product_name,
            sku: row.product_sku,
            imageUrl: row.product_image,
            category: row.product_category,
            costPrice: parseFloat(row.product_cost) || 0,
            sellingPrice: parseFloat(row.product_selling_price) || 0
          },
          warehouse: {
            id: row.warehouse_id,
            name: row.warehouse_name
          },
          company: {
            id: row.company_id,
            name: row.company_name,
            province: row.province,
            municipality: row.municipality
          },
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
          totalMarkets: parseInt(stats.total_markets) || 0,
          totalListedValue: parseFloat(stats.total_listed_value) || 0
        },
        filters: {
          markets: marketsResult.rows.map(row => ({
            id: row.id,
            name: row.name,
            province: row.province
          })),
          provinces: provincesResult.rows.map(row => row.province).filter(Boolean)
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
    console.error('[Admin Marketplace Products] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener productos'
    }, { status: 500 })
  }
}
