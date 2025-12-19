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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')

    let query = `
      SELECT
        mw.*,
        (SELECT COUNT(*) FROM market_warehouse_stock mws WHERE mws.warehouse_id = mw.id) as products_count,
        (SELECT COALESCE(SUM(mws.quantity_on_hand), 0) FROM market_warehouse_stock mws WHERE mws.warehouse_id = mw.id) as total_stock
      FROM market_warehouses mw
      WHERE mw.company_id = $1
    `

    const queryParams: (string | number)[] = [companyId]
    let paramIndex = 2

    if (search) {
      query += ` AND (LOWER(mw.name) LIKE $${paramIndex} OR LOWER(mw.code) LIKE $${paramIndex} OR LOWER(mw.city) LIKE $${paramIndex})`
      queryParams.push(`%${search.toLowerCase()}%`)
      paramIndex++
    }

    if (status && status !== 'all') {
      const isActive = status === 'active'
      query += ` AND mw.is_active = ${isActive}`
    }

    query += ` ORDER BY mw.is_central DESC, mw.name ASC`

    const result = await db.query(query, queryParams)

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        COUNT(*) FILTER (WHERE is_central = true) as central
      FROM market_warehouses
      WHERE company_id = $1
    `, [companyId])

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
          productsCount: parseInt(row.products_count) || 0,
          totalStock: parseInt(row.total_stock) || 0,
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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
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
      allowNegativeStock = false
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
        is_active, allow_negative_stock, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        true, $16, $17, NOW(), NOW()
      ) RETURNING id
    `, [
      companyId, code, name, isCentral, warehouseType,
      address || null, city || null, state || null, municipality || null, country,
      latitude || null, longitude || null, managerName || null, phone || null, email || null,
      allowNegativeStock, userId
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
