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
 * GET /api/marketplace/products
 * Browse approved marketplace products for agencies
 * Filters by province and municipality
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

    const { searchParams } = new URL(request.url)
    const province = searchParams.get('province')
    const municipality = searchParams.get('municipality')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const marketId = searchParams.get('marketId')
    const sortBy = searchParams.get('sortBy') || 'price' // price, name, newest
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query - only approved listings with available stock
    let whereClause = `WHERE ml.status = 'approved' AND (ml.quantity_listed - ml.quantity_sold) > 0`
    const queryParams: (string | number)[] = []
    let paramIndex = 1

    // Filter by province
    if (province) {
      whereClause += ` AND c.market_province = $${paramIndex}`
      queryParams.push(province)
      paramIndex++
    }

    // Filter by municipality
    if (municipality) {
      whereClause += ` AND c.market_municipality = $${paramIndex}`
      queryParams.push(municipality)
      paramIndex++
    }

    // Filter by specific market
    if (marketId) {
      whereClause += ` AND ml.company_id = $${paramIndex}`
      queryParams.push(parseInt(marketId))
      paramIndex++
    }

    // Filter by category
    if (category) {
      whereClause += ` AND mp.category = $${paramIndex}`
      queryParams.push(category)
      paramIndex++
    }

    // Search by name or SKU
    if (search) {
      whereClause += ` AND (mp.name ILIKE $${paramIndex} OR mp.sku ILIKE $${paramIndex} OR mp.barcode ILIKE $${paramIndex})`
      queryParams.push(`%${search}%`)
      paramIndex++
    }

    // Build order clause
    let orderClause = 'ORDER BY '
    switch (sortBy) {
      case 'price':
        orderClause += `ml.price_marketplace ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`
        break
      case 'name':
        orderClause += `mp.name ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`
        break
      case 'newest':
        orderClause += `ml.approved_at DESC`
        break
      default:
        orderClause += `ml.price_marketplace ASC`
    }

    // Get products
    const result = await db.query(`
      SELECT
        ml.id as listing_id,
        ml.listing_code,
        ml.price_marketplace,
        ml.currency,
        ml.quantity_listed - ml.quantity_sold as quantity_available,
        ml.is_featured,
        ml.marketplace_title,
        ml.marketplace_description,
        ml.approved_at,
        mp.id as product_id,
        mp.name as product_name,
        mp.sku as product_sku,
        mp.barcode as product_barcode,
        mp.image_url as product_image,
        mp.category as product_category,
        mp.description as product_description,
        mp.unit,
        c.id as market_id,
        c.legalname as market_name,
        c.market_province as province,
        c.market_municipality as municipality,
        c.market_address as address,
        c.market_phone as phone,
        c.market_logo as logo,
        -- Get average rating (placeholder for future)
        4.5 as rating,
        0 as review_count
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      JOIN companies c ON ml.company_id = c.id
      ${whereClause}
      ${orderClause}
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

    // Get available categories for filter
    const categoriesResult = await db.query(`
      SELECT DISTINCT mp.category
      FROM marketplace_listings ml
      JOIN market_products mp ON ml.product_id = mp.id
      JOIN companies c ON ml.company_id = c.id
      WHERE ml.status = 'approved' AND (ml.quantity_listed - ml.quantity_sold) > 0
      ${province ? 'AND c.market_province = $1' : ''}
      ${municipality ? `AND c.market_municipality = $${province ? 2 : 1}` : ''}
      ORDER BY mp.category
    `, province ? (municipality ? [province, municipality] : [province]) : [])

    // Get available markets in the area
    const marketsResult = await db.query(`
      SELECT DISTINCT
        c.id,
        c.legalname as name,
        c.market_logo as logo,
        c.market_province as province,
        c.market_municipality as municipality,
        COUNT(ml.id) as product_count
      FROM marketplace_listings ml
      JOIN companies c ON ml.company_id = c.id
      WHERE ml.status = 'approved' AND (ml.quantity_listed - ml.quantity_sold) > 0
      ${province ? 'AND c.market_province = $1' : ''}
      ${municipality ? `AND c.market_municipality = $${province ? 2 : 1}` : ''}
      GROUP BY c.id, c.legalname, c.market_logo, c.market_province, c.market_municipality
      ORDER BY product_count DESC
    `, province ? (municipality ? [province, municipality] : [province]) : [])

    // Get available provinces
    const provincesResult = await db.query(`
      SELECT DISTINCT c.market_province as province, COUNT(ml.id) as product_count
      FROM marketplace_listings ml
      JOIN companies c ON ml.company_id = c.id
      WHERE ml.status = 'approved' AND (ml.quantity_listed - ml.quantity_sold) > 0
        AND c.market_province IS NOT NULL
      GROUP BY c.market_province
      ORDER BY product_count DESC
    `)

    // Get municipalities in selected province
    let municipalitiesResult = { rows: [] as Array<{ municipality: string; product_count: string }> }
    if (province) {
      municipalitiesResult = await db.query(`
        SELECT DISTINCT c.market_municipality as municipality, COUNT(ml.id) as product_count
        FROM marketplace_listings ml
        JOIN companies c ON ml.company_id = c.id
        WHERE ml.status = 'approved' AND (ml.quantity_listed - ml.quantity_sold) > 0
          AND c.market_province = $1
          AND c.market_municipality IS NOT NULL
        GROUP BY c.market_municipality
        ORDER BY product_count DESC
      `, [province])
    }

    return NextResponse.json({
      success: true,
      data: {
        products: result.rows.map(row => ({
          listingId: row.listing_id,
          listingCode: row.listing_code,
          price: parseFloat(row.price_marketplace) || 0,
          currency: row.currency || 'USD',
          quantityAvailable: parseInt(row.quantity_available) || 0,
          isFeatured: row.is_featured,
          title: row.marketplace_title || row.product_name,
          description: row.marketplace_description || row.product_description,
          approvedAt: row.approved_at,
          product: {
            id: row.product_id,
            name: row.product_name,
            sku: row.product_sku,
            barcode: row.product_barcode,
            imageUrl: row.product_image,
            category: row.product_category,
            unit: row.unit || 'unidad'
          },
          market: {
            id: row.market_id,
            name: row.market_name,
            province: row.province,
            municipality: row.municipality,
            address: row.address,
            phone: row.phone,
            logo: row.logo,
            rating: row.rating,
            reviewCount: row.review_count
          }
        })),
        filters: {
          categories: categoriesResult.rows.map(r => r.category).filter(Boolean),
          markets: marketsResult.rows.map(r => ({
            id: r.id,
            name: r.name,
            logo: r.logo,
            province: r.province,
            municipality: r.municipality,
            productCount: parseInt(r.product_count) || 0
          })),
          provinces: provincesResult.rows.map(r => ({
            name: r.province,
            productCount: parseInt(r.product_count) || 0
          })),
          municipalities: municipalitiesResult.rows.map(r => ({
            name: r.municipality,
            productCount: parseInt(r.product_count) || 0
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
    console.error('[Marketplace Products API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener productos'
    }, { status: 500 })
  }
}
