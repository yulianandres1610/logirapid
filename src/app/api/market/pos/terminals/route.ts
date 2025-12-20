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
 * GET /api/market/pos/terminals
 * List all POS terminals for the company
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
    const userId = payload.userId

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'

    // Get terminals with warehouse and pricelist info
    let query = `
      SELECT
        t.id,
        t.code,
        t.name,
        t.warehouse_id,
        t.pricelist_id,
        t.allow_price_edit,
        t.allow_discount,
        t.max_discount_percent,
        t.require_customer,
        t.default_currency,
        t.accepted_currencies,
        t.is_active,
        t.created_at,
        t.updated_at,
        w.name as warehouse_name,
        w.code as warehouse_code,
        p.name as pricelist_name,
        (SELECT COUNT(*) FROM market_pos_users WHERE pos_terminal_id = t.id) as user_count,
        (SELECT COUNT(*) FROM market_pos_sessions WHERE pos_terminal_id = t.id AND status = 'open') as open_sessions
      FROM market_pos_terminals t
      LEFT JOIN market_warehouses w ON t.warehouse_id = w.id
      LEFT JOIN market_pricelists p ON t.pricelist_id = p.id
      WHERE t.company_id = $1
    `
    const params: (number | boolean)[] = [companyId]

    if (activeOnly) {
      query += ` AND t.is_active = true`
    }

    query += ` ORDER BY t.name ASC`

    const result = await db.query(query, params)

    // Check if current user has access to each terminal
    const userTerminals = await db.query(`
      SELECT pos_terminal_id FROM market_pos_users WHERE user_id = $1
    `, [userId])

    const userTerminalIds = new Set(userTerminals.rows.map(r => r.pos_terminal_id))

    const terminals = result.rows.map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      warehouseCode: row.warehouse_code,
      pricelistId: row.pricelist_id,
      pricelistName: row.pricelist_name,
      allowPriceEdit: row.allow_price_edit,
      allowDiscount: row.allow_discount,
      maxDiscountPercent: parseFloat(row.max_discount_percent) || 100,
      requireCustomer: row.require_customer,
      defaultCurrency: row.default_currency,
      acceptedCurrencies: row.accepted_currencies || ['USD', 'CUP', 'MLC'],
      isActive: row.is_active,
      userCount: parseInt(row.user_count) || 0,
      hasOpenSession: parseInt(row.open_sessions) > 0,
      userHasAccess: payload.role === 'SUPER_ADMIN' || payload.role === 'ADMIN' || userTerminalIds.has(row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        terminals,
        total: terminals.length
      }
    })

  } catch (error) {
    console.error('[POS Terminals API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener terminales'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/pos/terminals
 * Create a new POS terminal
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

    // Only ADMIN and SUPER_ADMIN can create terminals
    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para crear terminales POS'
      }, { status: 403 })
    }

    const companyId = payload.companyId
    const userId = payload.userId

    const body = await request.json()
    const {
      name,
      warehouseId,
      pricelistId,
      allowPriceEdit,
      allowDiscount,
      maxDiscountPercent,
      requireCustomer,
      defaultCurrency,
      acceptedCurrencies,
      userIds // Array of user IDs to assign
    } = body

    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'El nombre es requerido'
      }, { status: 400 })
    }

    if (!warehouseId) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar un almacén'
      }, { status: 400 })
    }

    // Generate unique code
    const year = new Date().getFullYear()
    const countResult = await db.query(`
      SELECT COUNT(*) as count FROM market_pos_terminals WHERE company_id = $1
    `, [companyId])
    const count = parseInt(countResult.rows[0].count) + 1
    const code = `POS-${year}-${String(count).padStart(4, '0')}`

    // Insert terminal
    const result = await db.query(`
      INSERT INTO market_pos_terminals (
        company_id, code, name, warehouse_id, pricelist_id,
        allow_price_edit, allow_discount, max_discount_percent,
        require_customer, default_currency, accepted_currencies,
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING id
    `, [
      companyId,
      code,
      name,
      warehouseId,
      pricelistId || null,
      allowPriceEdit ?? false,
      allowDiscount ?? true,
      maxDiscountPercent || 100,
      requireCustomer ?? false,
      defaultCurrency || 'USD',
      acceptedCurrencies || ['USD', 'CUP', 'MLC'],
      userId
    ])

    const terminalId = result.rows[0].id

    // Assign users if provided
    if (userIds && userIds.length > 0) {
      for (const uid of userIds) {
        await db.query(`
          INSERT INTO market_pos_users (pos_terminal_id, user_id, created_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (pos_terminal_id, user_id) DO NOTHING
        `, [terminalId, uid])
      }
    }

    console.log('[POS Terminals] Created terminal:', code, 'ID:', terminalId)

    return NextResponse.json({
      success: true,
      data: {
        id: terminalId,
        code
      },
      message: 'Terminal POS creado exitosamente'
    })

  } catch (error) {
    console.error('[POS Terminals API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear terminal'
    }, { status: 500 })
  }
}
