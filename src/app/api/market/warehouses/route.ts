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
 * GET /api/market/warehouses
 * List all warehouses for a market company
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
    const userRole = payload.role
    const userId = payload.userId
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const productId = searchParams.get('productId')
    let warehouseId = searchParams.get('warehouseId') // Filtro para MARKET_ALMACENERO

    // Auto-filter by assigned warehouse for MARKET_MANAGER_TIENDA and MARKET_ALMACENERO
    if (userRole === 'MARKET_MANAGER_TIENDA' || userRole === 'MARKET_ALMACENERO') {
      const employeeResult = await db.query(`
        SELECT warehouse_id FROM market_employees
        WHERE user_id = $1 AND company_id = $2 AND status = 'active'
      `, [userId, companyId])

      if (employeeResult.rows.length > 0 && employeeResult.rows[0].warehouse_id) {
        warehouseId = employeeResult.rows[0].warehouse_id.toString()
      }
    }

    let query: string
    const queryParams: (string | number)[] = [companyId]
    let paramIndex = 2

    // If productId is provided, get stock for that specific product
    if (productId) {
      query = `
        SELECT
          mw.*,
          ps.name as print_service_name,
          ps.code as print_service_code,
          ps.url as print_service_url,
          COALESCE(mws.quantity_on_hand, 0) as stock_on_hand,
          COALESCE(mws.quantity_reserved, 0) as stock_reserved,
          COALESCE(mws.quantity_on_hand, 0) - COALESCE(mws.quantity_reserved, 0) as stock_available
        FROM market_warehouses mw
        LEFT JOIN print_services ps ON ps.id = mw.default_print_service_id
        LEFT JOIN market_warehouse_stock mws ON mws.warehouse_id = mw.id AND mws.product_id = $${paramIndex}
        WHERE mw.company_id = $1 AND mw.is_active = true
      `
      queryParams.push(parseInt(productId))
      paramIndex++
    } else {
      query = `
        SELECT
          mw.*,
          ps.name as print_service_name,
          ps.code as print_service_code,
          ps.url as print_service_url,
          (SELECT COUNT(*) FROM market_warehouse_stock mws WHERE mws.warehouse_id = mw.id) as products_count,
          (SELECT COALESCE(SUM(mws.quantity_on_hand), 0) FROM market_warehouse_stock mws WHERE mws.warehouse_id = mw.id) as total_stock
        FROM market_warehouses mw
        LEFT JOIN print_services ps ON ps.id = mw.default_print_service_id
        WHERE mw.company_id = $1
      `
    }

    if (search) {
      query += ` AND (LOWER(mw.name) LIKE $${paramIndex} OR LOWER(mw.code) LIKE $${paramIndex} OR LOWER(mw.city) LIKE $${paramIndex})`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    if (status && status !== 'all' && !productId) {
      const isActive = status === 'active'
      query += ` AND mw.is_active = ${isActive}`
    }

    // Filtro por warehouseId (para MARKET_ALMACENERO)
    if (warehouseId) {
      query += ` AND mw.id = $${paramIndex}`
      queryParams.push(parseInt(warehouseId))
      paramIndex++
    }

    query += ` ORDER BY mw.is_central DESC, mw.name ASC`

    const result = await db.query(query, queryParams)

    // Get stats (filtered by warehouse for restricted roles)
    let statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        COUNT(*) FILTER (WHERE is_central = true) as central
      FROM market_warehouses
      WHERE company_id = $1
    `
    const statsParams: (string | number)[] = [companyId]

    if (warehouseId) {
      statsQuery += ` AND id = $2`
      statsParams.push(parseInt(warehouseId))
    }

    const statsResult = await db.query(statsQuery, statsParams)

    return NextResponse.json({
      success: true,
      data: {
        warehouses: result.rows.map(row => ({
          id: row.id,
          code: row.code,
          name: row.name,
          isCentral: row.is_central,
          warehouseType: row.warehouse_type,
          address: row.address,
          city: row.city,
          state: row.state,
          municipality: row.municipality,
          country: row.country,
          latitude: row.latitude ? parseFloat(row.latitude) : null,
          longitude: row.longitude ? parseFloat(row.longitude) : null,
          managerName: row.manager_name,
          phone: row.phone,
          email: row.email,
          isActive: row.is_active,
          allowNegativeStock: row.allow_negative_stock,
          defaultPrintServiceId: row.default_print_service_id,
          printServiceName: row.print_service_name,
          printServiceCode: row.print_service_code,
          printServiceUrl: row.print_service_url,
          productsCount: parseInt(row.products_count) || 0,
          totalStock: parseFloat(row.total_stock) || 0,
          // Stock fields when productId is provided
          stockOnHand: row.stock_on_hand != null ? parseFloat(row.stock_on_hand) : 0,
          stockReserved: row.stock_reserved != null ? parseFloat(row.stock_reserved) : 0,
          stockAvailable: row.stock_available != null ? parseFloat(row.stock_available) : 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        stats: {
          total: parseInt(statsResult.rows[0]?.total) || 0,
          active: parseInt(statsResult.rows[0]?.active) || 0,
          inactive: parseInt(statsResult.rows[0]?.inactive) || 0,
          central: parseInt(statsResult.rows[0]?.central) || 0
        }
      }
    })

  } catch (error) {
    console.error('[Market Warehouses API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener almacenes'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/warehouses
 * Create a new warehouse
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
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const userId = payload.userId

    const body = await request.json()
    const {
      name,
      code,
      isCentral = false,
      warehouseType = 'storage',
      address,
      city,
      state,
      municipality,
      country = 'Cuba',
      latitude,
      longitude,
      managerName,
      phone,
      email,
      allowNegativeStock = false,
      defaultPrintServiceId
    } = body

    // Validate required fields
    if (!name || !code) {
      return NextResponse.json({
        success: false,
        error: 'Nombre y código son requeridos'
      }, { status: 400 })
    }

    // Check if code is unique within company
    const existingCode = await db.query(
      'SELECT id FROM market_warehouses WHERE company_id = $1 AND code = $2',
      [companyId, code]
    )

    if (existingCode.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Ya existe un almacén con ese código'
      }, { status: 400 })
    }

    // If setting as central, unset other central warehouses
    if (isCentral) {
      await db.query(
        'UPDATE market_warehouses SET is_central = false WHERE company_id = $1 AND is_central = true',
        [companyId]
      )
    }

    const result = await db.query(`
      INSERT INTO market_warehouses (
        company_id, code, name, is_central, warehouse_type,
        address, city, state, municipality, country,
        latitude, longitude, manager_name, phone, email,
        is_active, allow_negative_stock, default_print_service_id, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        true, $16, $17, $18, NOW(), NOW()
      ) RETURNING id
    `, [
      companyId, code, name, isCentral, warehouseType,
      address || null, city || null, state || null, municipality || null, country,
      latitude || null, longitude || null, managerName || null, phone || null, email || null,
      allowNegativeStock, defaultPrintServiceId || null, userId
    ])

    return NextResponse.json({
      success: true,
      data: {
        id: result.rows[0].id,
        code
      },
      message: 'Almacén creado exitosamente'
    })

  } catch (error) {
    console.error('[Market Warehouses API] Error creating warehouse:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear almacén'
    }, { status: 500 })
  }
}
