import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/public/catalog/[slug]
 * Public API — no auth required
 * Returns catalog info + products with stock
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '48'), 100)
    const offset = (page - 1) * limit

    // Ensure table exists
    try {
      await db.query(`CREATE TABLE IF NOT EXISTS market_catalogs (
        id SERIAL PRIMARY KEY, company_id INTEGER NOT NULL, slug VARCHAR(100) UNIQUE NOT NULL,
        store_name VARCHAR(255) NOT NULL, description TEXT, logo_url TEXT, banner_url TEXT,
        primary_color VARCHAR(20) DEFAULT '#f97316', phone VARCHAR(50), whatsapp VARCHAR(50),
        email VARCHAR(255), address TEXT, city VARCHAR(100), province VARCHAR(100),
        facebook_url TEXT, instagram_url TEXT, telegram_url TEXT,
        categories JSONB DEFAULT '[]', show_stock BOOLEAN DEFAULT true,
        show_usd_price BOOLEAN DEFAULT true, show_cup_price BOOLEAN DEFAULT true,
        custom_domain VARCHAR(255), subdomain VARCHAR(100),
        domain_verified BOOLEAN DEFAULT false, dns_instructions JSONB,
        is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`)
    } catch { /* already exists */ }

    // Get catalog config
    const catalogResult = await db.query(
      'SELECT * FROM market_catalogs WHERE slug = $1 AND is_active = true',
      [slug]
    )

    if (catalogResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Catálogo no encontrado' }, { status: 404 })
    }

    const catalog = catalogResult.rows[0]
    const companyId = catalog.company_id
    const selectedCategories: string[] = catalog.categories || []

    // Get exchange rate for CUP conversion
    let exchangeRate = 505
    try {
      const rateResult = await db.query(
        `SELECT manual_rate FROM market_exchange_rate_config WHERE company_id = $1`,
        [companyId]
      )
      if (rateResult.rows.length > 0 && rateResult.rows[0].manual_rate) {
        exchangeRate = parseFloat(rateResult.rows[0].manual_rate)
      }
    } catch { /* use default */ }

    // Build product query with filters
    let whereClause = `p.company_id = $1 AND p.is_active = true AND p.selling_price > 0`
    const queryParams: any[] = [companyId]
    let paramIndex = 2

    // Filter by selected categories (if catalog has specific categories)
    if (selectedCategories.length > 0) {
      whereClause += ` AND p.category = ANY($${paramIndex})`
      queryParams.push(selectedCategories)
      paramIndex++
    }

    // Search filter
    if (search) {
      whereClause += ` AND (LOWER(p.name) LIKE LOWER($${paramIndex}) OR LOWER(p.sku) LIKE LOWER($${paramIndex}))`
      queryParams.push(`%${search}%`)
      paramIndex++
    }

    // Category filter (user-selected from UI)
    if (category && category !== 'all') {
      whereClause += ` AND p.category = $${paramIndex}`
      queryParams.push(category)
      paramIndex++
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM market_products p WHERE ${whereClause}`,
      queryParams
    )
    const totalProducts = parseInt(countResult.rows[0].total)

    // Get products with stock
    const productsResult = await db.query(`
      SELECT
        p.id, p.name, p.description, p.sku, p.barcode, p.category,
        p.selling_price, p.cost_price, p.currency, p.image_url,
        p.unit_of_measure,
        COALESCE(SUM(ws.quantity_on_hand), 0) as total_stock
      FROM market_products p
      LEFT JOIN market_warehouse_stock ws ON ws.product_id = p.id
      WHERE ${whereClause}
      GROUP BY p.id
      HAVING COALESCE(SUM(ws.quantity_on_hand), 0) > 0
      ORDER BY p.category, p.name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...queryParams, limit, offset])

    // Get available categories for this catalog
    let catWhereClause = `p.company_id = $1 AND p.is_active = true AND p.selling_price > 0 AND p.category IS NOT NULL AND p.category != ''`
    const catParams: any[] = [companyId]
    if (selectedCategories.length > 0) {
      catWhereClause += ` AND p.category = ANY($2)`
      catParams.push(selectedCategories)
    }
    const categoriesResult = await db.query(
      `SELECT DISTINCT p.category, COUNT(*) as count FROM market_products p WHERE ${catWhereClause} GROUP BY p.category ORDER BY p.category`,
      catParams
    )

    // Get top selling products (last 90 days) - POS + wholesale combined
    let topSellingIds: number[] = []
    try {
      const topResult = await db.query(`
        WITH pos_sales AS (
          SELECT ol.product_id, SUM(ol.quantity) as qty
          FROM market_pos_order_lines ol
          JOIN market_pos_orders o ON ol.order_id = o.id
          WHERE o.company_id = $1 AND o.status IN ('paid', 'completed')
            AND o.created_at >= NOW() - INTERVAL '90 days'
          GROUP BY ol.product_id
        ),
        wholesale_sales AS (
          SELECT il.product_id, SUM(COALESCE(il.quantity_delivered, il.quantity)) as qty
          FROM market_invoice_lines il
          JOIN market_invoices i ON il.invoice_id = i.id
          WHERE i.company_id = $1 AND i.status IN ('delivered', 'paid', 'completed', 'confirmed', 'validated')
            AND COALESCE(i.delivered_at, i.created_at) >= NOW() - INTERVAL '90 days'
          GROUP BY il.product_id
        )
        SELECT COALESCE(p.product_id, w.product_id) as product_id,
               COALESCE(p.qty, 0) + COALESCE(w.qty, 0) as qty_sold
        FROM pos_sales p
        FULL OUTER JOIN wholesale_sales w ON p.product_id = w.product_id
        ORDER BY qty_sold DESC
        LIMIT 36
      `, [companyId])
      topSellingIds = topResult.rows.map((r: any) => parseInt(r.product_id))
    } catch (e) {
      console.log('[Catalog] Top sellers query failed:', e instanceof Error ? e.message : e)
    }

    // Fallback: if no sales data, pick products with most stock
    if (topSellingIds.length === 0) {
      try {
        const fallbackResult = await db.query(`
          SELECT id FROM market_products
          WHERE company_id = $1 AND is_active = true AND quantity_on_hand > 0
          ORDER BY quantity_on_hand DESC
          LIMIT 36
        `, [companyId])
        topSellingIds = fallbackResult.rows.map((r: any) => parseInt(r.id))
      } catch {}
    }

    const mapProduct = (p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      sku: p.sku,
      barcode: p.barcode || null,
      category: p.category,
      imageUrl: p.image_url,
      unit: p.unit_of_measure || 'unidad',
      priceUSD: catalog.show_usd_price ? parseFloat(p.selling_price) : null,
      priceCUP: catalog.show_cup_price ? Math.round(parseFloat(p.selling_price) * exchangeRate) : null,
      stock: catalog.show_stock ? parseFloat(p.total_stock) : null,
      isTopSeller: topSellingIds.includes(p.id)
    })

    const products = productsResult.rows.map(mapProduct)

    // Fetch full top seller products independently (not limited by pagination)
    let topSellerProducts: any[] = []
    if (topSellingIds.length > 0) {
      try {
        const topFullResult = await db.query(`
          SELECT p.id, p.name, p.description, p.sku, p.barcode, p.category,
            p.selling_price, p.cost_price, p.currency, p.image_url, p.unit_of_measure,
            COALESCE(SUM(ws.quantity_on_hand), 0) as total_stock
          FROM market_products p
          LEFT JOIN market_warehouse_stock ws ON ws.product_id = p.id
          WHERE p.id = ANY($1) AND p.is_active = true
          GROUP BY p.id
          HAVING COALESCE(SUM(ws.quantity_on_hand), 0) > 0
          ORDER BY array_position($1, p.id)
        `, [topSellingIds])
        topSellerProducts = topFullResult.rows.map((p: any) => ({ ...mapProduct(p), isTopSeller: true }))
      } catch {}
    }

    return NextResponse.json({
      success: true,
      data: {
        store: {
          name: catalog.store_name,
          description: catalog.description,
          logoUrl: catalog.logo_url,
          logoMobileUrl: catalog.logo_mobile_url || null,
          logoDesktopUrl: catalog.logo_desktop_url || null,
          primaryColor: catalog.primary_color || '#f97316',
          phone: catalog.phone,
          whatsapp: catalog.whatsapp,
          email: catalog.email,
          address: catalog.address,
          city: catalog.city,
          province: catalog.province,
          facebookUrl: catalog.facebook_url,
          instagramUrl: catalog.instagram_url,
          telegramUrl: catalog.telegram_url
        },
        exchangeRate,
        categories: categoriesResult.rows.map((c: any) => ({ name: c.category, count: parseInt(c.count) })),
        topSellers: topSellerProducts,
        products,
        pagination: {
          page,
          limit,
          total: totalProducts,
          totalPages: Math.ceil(totalProducts / limit)
        }
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30'
      }
    })
  } catch (error) {
    console.error('[Public Catalog]', error)
    return NextResponse.json({ success: false, error: 'Error al cargar catálogo' }, { status: 500 })
  }
}
