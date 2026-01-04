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
 * GET /api/market/pos/terminals/[id]
 * Get terminal details with users and configuration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const terminalId = parseInt(id)

    // Get terminal
    const result = await db.query(`
      SELECT
        t.*,
        w.name as warehouse_name,
        w.code as warehouse_code,
        w.address as warehouse_address,
        p.name as pricelist_name
      FROM market_pos_terminals t
      LEFT JOIN market_warehouses w ON t.warehouse_id = w.id
      LEFT JOIN market_pricelists p ON t.pricelist_id = p.id
      WHERE t.id = $1 AND t.company_id = $2
    `, [terminalId, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado'
      }, { status: 404 })
    }

    const terminal = result.rows[0]

    // Parse accepted_currencies if it's a string
    let acceptedCurrencies = terminal.accepted_currencies
    if (typeof acceptedCurrencies === 'string') {
      try {
        acceptedCurrencies = JSON.parse(acceptedCurrencies)
      } catch {
        acceptedCurrencies = ['USD', 'CUP', 'MLC']
      }
    }
    if (!Array.isArray(acceptedCurrencies)) {
      acceptedCurrencies = ['USD', 'CUP', 'MLC']
    }

    // Get assigned users
    const usersResult = await db.query(`
      SELECT
        pu.user_id,
        pu.can_open_session,
        pu.can_close_session,
        pu.can_void_orders,
        pu.can_give_discount,
        pu.can_refund,
        u.firstname,
        u.lastname,
        u.email,
        u.role
      FROM market_pos_users pu
      JOIN users u ON pu.user_id = u.id
      WHERE pu.pos_terminal_id = $1
      ORDER BY u.firstname, u.lastname
    `, [terminalId])

    // Get session stats (handle case where table might not exist yet)
    let stats = { open_sessions: 0, closed_sessions: 0, total_sales: 0, total_orders: 0 }
    try {
      const sessionStats = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'open') as open_sessions,
          COUNT(*) FILTER (WHERE status = 'closed') as closed_sessions,
          SUM(total_sales) FILTER (WHERE status = 'closed') as total_sales,
          SUM(total_orders) FILTER (WHERE status = 'closed') as total_orders
        FROM market_pos_sessions
        WHERE pos_terminal_id = $1
      `, [terminalId])
      if (sessionStats.rows[0]) {
        stats = sessionStats.rows[0]
      }
    } catch {
      // Table might not exist yet, use default stats
      console.log('[POS Terminal API] Sessions table not ready, using default stats')
    }

    return NextResponse.json({
      success: true,
      data: {
        id: terminal.id,
        code: terminal.code,
        name: terminal.name,
        warehouseId: terminal.warehouse_id,
        warehouseName: terminal.warehouse_name,
        warehouseCode: terminal.warehouse_code,
        warehouseAddress: terminal.warehouse_address,
        pricelistId: terminal.pricelist_id,
        pricelistName: terminal.pricelist_name,
        allowPriceEdit: terminal.allow_price_edit,
        allowDiscount: terminal.allow_discount,
        maxDiscountPercent: parseFloat(terminal.max_discount_percent) || 100,
        requireCustomer: terminal.require_customer,
        defaultCurrency: terminal.default_currency,
        acceptedCurrencies: acceptedCurrencies,
        isActive: terminal.is_active,
        createdAt: terminal.created_at,
        updatedAt: terminal.updated_at,
        users: usersResult.rows.map(u => ({
          userId: u.user_id,
          name: [u.firstname, u.lastname].filter(Boolean).join(' ') || u.email,
          email: u.email,
          role: u.role,
          permissions: {
            canOpenSession: u.can_open_session,
            canCloseSession: u.can_close_session,
            canVoidOrders: u.can_void_orders,
            canGiveDiscount: u.can_give_discount,
            canRefund: u.can_refund
          }
        })),
        stats: {
          openSessions: Number(stats.open_sessions) || 0,
          closedSessions: Number(stats.closed_sessions) || 0,
          totalSales: Number(stats.total_sales) || 0,
          totalOrders: Number(stats.total_orders) || 0
        }
      }
    })

  } catch (error) {
    console.error('[POS Terminal API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener terminal'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/pos/terminals/[id]
 * Update terminal
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para editar terminales'
      }, { status: 403 })
    }

    const companyId = payload.companyId
    const terminalId = parseInt(id)

    // Check terminal exists
    const exists = await db.query(`
      SELECT id FROM market_pos_terminals WHERE id = $1 AND company_id = $2
    `, [terminalId, companyId])

    if (exists.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado'
      }, { status: 404 })
    }

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
      isActive,
      users // Array of { userId, permissions }
    } = body

    // Build update query
    const updates: string[] = []
    const values: (string | number | boolean | string[] | null)[] = []
    let paramIndex = 1

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (warehouseId !== undefined) {
      updates.push(`warehouse_id = $${paramIndex++}`)
      values.push(warehouseId)
    }
    if (pricelistId !== undefined) {
      updates.push(`pricelist_id = $${paramIndex++}`)
      values.push(pricelistId || null)
    }
    if (allowPriceEdit !== undefined) {
      updates.push(`allow_price_edit = $${paramIndex++}`)
      values.push(allowPriceEdit)
    }
    if (allowDiscount !== undefined) {
      updates.push(`allow_discount = $${paramIndex++}`)
      values.push(allowDiscount)
    }
    if (maxDiscountPercent !== undefined) {
      updates.push(`max_discount_percent = $${paramIndex++}`)
      values.push(maxDiscountPercent)
    }
    if (requireCustomer !== undefined) {
      updates.push(`require_customer = $${paramIndex++}`)
      values.push(requireCustomer)
    }
    if (defaultCurrency !== undefined) {
      updates.push(`default_currency = $${paramIndex++}`)
      values.push(defaultCurrency)
    }
    if (acceptedCurrencies !== undefined) {
      updates.push(`accepted_currencies = $${paramIndex++}`)
      values.push(acceptedCurrencies)
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(isActive)
    }

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`)
      values.push(terminalId)

      await db.query(`
        UPDATE market_pos_terminals
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
      `, values)
    }

    // Update users if provided
    if (users && Array.isArray(users)) {
      // Remove all existing users
      await db.query(`DELETE FROM market_pos_users WHERE pos_terminal_id = $1`, [terminalId])

      // Add new users
      for (const user of users) {
        await db.query(`
          INSERT INTO market_pos_users (
            pos_terminal_id, user_id,
            can_open_session, can_close_session,
            can_void_orders, can_give_discount, can_refund,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          terminalId,
          user.userId,
          user.permissions?.canOpenSession ?? true,
          user.permissions?.canCloseSession ?? true,
          user.permissions?.canVoidOrders ?? false,
          user.permissions?.canGiveDiscount ?? true,
          user.permissions?.canRefund ?? false
        ])
      }
    }

    console.log('[POS Terminal] Updated:', terminalId)

    return NextResponse.json({
      success: true,
      message: 'Terminal actualizado exitosamente'
    })

  } catch (error) {
    console.error('[POS Terminal API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar terminal'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/pos/terminals/[id]
 * Deactivate terminal (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No tienes permisos para eliminar terminales'
      }, { status: 403 })
    }

    const companyId = payload.companyId
    const terminalId = parseInt(id)

    // Check if has open sessions
    const openSessions = await db.query(`
      SELECT COUNT(*) as count FROM market_pos_sessions
      WHERE pos_terminal_id = $1 AND status = 'open'
    `, [terminalId])

    if (parseInt(openSessions.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede desactivar un terminal con sesiones abiertas'
      }, { status: 400 })
    }

    // Soft delete
    await db.query(`
      UPDATE market_pos_terminals
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND company_id = $2
    `, [terminalId, companyId])

    console.log('[POS Terminal] Deactivated:', terminalId)

    return NextResponse.json({
      success: true,
      message: 'Terminal desactivado exitosamente'
    })

  } catch (error) {
    console.error('[POS Terminal API] Error deleting:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al desactivar terminal'
    }, { status: 500 })
  }
}
