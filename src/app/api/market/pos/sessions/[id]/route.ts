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
 * GET /api/market/pos/sessions/[id]
 * Get session details with totals
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
    const sessionId = parseInt(id)

    // Get session with terminal info
    const result = await db.query(`
      SELECT
        s.*,
        t.code as terminal_code,
        t.name as terminal_name,
        t.warehouse_id,
        w.name as warehouse_name,
        COALESCE(uo.firstname || ' ' || uo.lastname, uo.email) as opened_by_name,
        COALESCE(uc.firstname || ' ' || uc.lastname, uc.email) as closed_by_name
      FROM market_pos_sessions s
      JOIN market_pos_terminals t ON s.pos_terminal_id = t.id
      LEFT JOIN market_warehouses w ON t.warehouse_id = w.id
      LEFT JOIN users uo ON s.opened_by = uo.id
      LEFT JOIN users uc ON s.closed_by = uc.id
      WHERE s.id = $1 AND s.company_id = $2
    `, [sessionId, companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sesión no encontrada'
      }, { status: 404 })
    }

    const session = result.rows[0]

    // Get payment totals by method and currency
    const paymentsResult = await db.query(`
      SELECT
        p.payment_method,
        p.currency,
        SUM(p.amount) as total_amount,
        COUNT(*) as count
      FROM market_pos_payments p
      JOIN market_pos_orders o ON p.order_id = o.id
      WHERE o.pos_session_id = $1 AND o.status = 'paid'
      GROUP BY p.payment_method, p.currency
    `, [sessionId])

    // Get orders summary
    const ordersResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'paid') as paid_orders,
        COUNT(*) FILTER (WHERE status = 'voided') as voided_orders,
        COUNT(*) FILTER (WHERE status = 'refunded') as refunded_orders,
        SUM(total_amount) FILTER (WHERE status = 'paid') as total_sales,
        SUM(total_amount) FILTER (WHERE status = 'refunded') as total_refunds,
        SUM(discount_amount) FILTER (WHERE status = 'paid') as total_discounts
      FROM market_pos_orders
      WHERE pos_session_id = $1
    `, [sessionId])

    const ordersSummary = ordersResult.rows[0]

    // Calculate expected cash by currency
    const cashPayments: Record<string, number> = {}
    for (const p of paymentsResult.rows) {
      if (p.payment_method === 'cash') {
        cashPayments[p.currency] = (cashPayments[p.currency] || 0) + parseFloat(p.total_amount)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: session.id,
        sessionCode: session.session_code,
        terminalId: session.pos_terminal_id,
        terminalCode: session.terminal_code,
        terminalName: session.terminal_name,
        warehouseId: session.warehouse_id,
        warehouseName: session.warehouse_name,
        openedBy: session.opened_by,
        openedByName: session.opened_by_name,
        closedBy: session.closed_by,
        closedByName: session.closed_by_name,
        openedAt: session.opened_at,
        closedAt: session.closed_at,
        status: session.status,
        openingCash: {
          usd: parseFloat(session.opening_cash_usd) || 0,
          cup: parseFloat(session.opening_cash_cup) || 0,
          mlc: parseFloat(session.opening_cash_mlc) || 0
        },
        closingCash: session.closing_cash_usd !== null ? {
          usd: parseFloat(session.closing_cash_usd) || 0,
          cup: parseFloat(session.closing_cash_cup) || 0,
          mlc: parseFloat(session.closing_cash_mlc) || 0
        } : null,
        expectedCash: {
          usd: (parseFloat(session.opening_cash_usd) || 0) + (cashPayments['USD'] || 0),
          cup: (parseFloat(session.opening_cash_cup) || 0) + (cashPayments['CUP'] || 0),
          mlc: (parseFloat(session.opening_cash_mlc) || 0) + (cashPayments['MLC'] || 0)
        },
        cashDifference: session.cash_difference !== null ? parseFloat(session.cash_difference) : null,
        openingNotes: session.opening_notes,
        closingNotes: session.closing_notes,
        summary: {
          paidOrders: parseInt(ordersSummary.paid_orders) || 0,
          voidedOrders: parseInt(ordersSummary.voided_orders) || 0,
          refundedOrders: parseInt(ordersSummary.refunded_orders) || 0,
          totalSales: parseFloat(ordersSummary.total_sales) || 0,
          totalRefunds: parseFloat(ordersSummary.total_refunds) || 0,
          totalDiscounts: parseFloat(ordersSummary.total_discounts) || 0
        },
        paymentsByMethod: paymentsResult.rows.map(p => ({
          method: p.payment_method,
          currency: p.currency,
          amount: parseFloat(p.total_amount) || 0,
          count: parseInt(p.count) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[POS Session API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener sesión'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/pos/sessions/[id]
 * Close session
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

    const companyId = payload.companyId
    const userId = payload.userId
    const sessionId = parseInt(id)

    const body = await request.json()
    const { action } = body

    // Get session
    const sessionResult = await db.query(`
      SELECT s.*, t.id as terminal_id FROM market_pos_sessions s
      JOIN market_pos_terminals t ON s.pos_terminal_id = t.id
      WHERE s.id = $1 AND s.company_id = $2
    `, [sessionId, companyId])

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Sesión no encontrada'
      }, { status: 404 })
    }

    const session = sessionResult.rows[0]

    if (action === 'close') {
      if (session.status !== 'open') {
        return NextResponse.json({
          success: false,
          error: 'La sesión ya está cerrada'
        }, { status: 400 })
      }

      // Check user has permission
      if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
        const userPerm = await db.query(`
          SELECT can_close_session FROM market_pos_users
          WHERE pos_terminal_id = $1 AND user_id = $2
        `, [session.terminal_id, userId])

        if (userPerm.rows.length === 0 || !userPerm.rows[0].can_close_session) {
          return NextResponse.json({
            success: false,
            error: 'No tienes permiso para cerrar sesiones'
          }, { status: 403 })
        }
      }

      const {
        closingCashUsd,
        closingCashCup,
        closingCashMlc,
        closingNotes,
        closingDenominations
      } = body

      // Calculate totals from orders
      const totalsResult = await db.query(`
        SELECT
          SUM(total_amount) FILTER (WHERE status = 'paid') as total_sales,
          SUM(total_amount) FILTER (WHERE status = 'refunded') as total_refunds,
          COUNT(*) FILTER (WHERE status = 'paid') as total_orders
        FROM market_pos_orders
        WHERE pos_session_id = $1
      `, [sessionId])

      const totals = totalsResult.rows[0]

      // Get cash payments to calculate expected
      const cashPayments = await db.query(`
        SELECT
          p.currency,
          SUM(p.amount) as total
        FROM market_pos_payments p
        JOIN market_pos_orders o ON p.order_id = o.id
        WHERE o.pos_session_id = $1 AND o.status = 'paid' AND p.payment_method = 'cash'
        GROUP BY p.currency
      `, [sessionId])

      const cashByurrency: Record<string, number> = {}
      for (const p of cashPayments.rows) {
        cashByurrency[p.currency] = parseFloat(p.total) || 0
      }

      // Calculate difference (reported - expected)
      const expectedUsd = (parseFloat(session.opening_cash_usd) || 0) + (cashByurrency['USD'] || 0)
      const expectedCup = (parseFloat(session.opening_cash_cup) || 0) + (cashByurrency['CUP'] || 0)
      const expectedMlc = (parseFloat(session.opening_cash_mlc) || 0) + (cashByurrency['MLC'] || 0)

      const reportedUsd = closingCashUsd || 0
      const reportedCup = closingCashCup || 0
      const reportedMlc = closingCashMlc || 0

      // Convert all to USD for difference (simplified - should use real exchange rates)
      const differenceUsd = (reportedUsd - expectedUsd) +
        ((reportedCup - expectedCup) / 250) +
        ((reportedMlc - expectedMlc) * 1.1)

      // Close session
      await db.query(`
        UPDATE market_pos_sessions SET
          status = 'closed',
          closed_by = $1,
          closed_at = NOW(),
          closing_cash_usd = $2,
          closing_cash_cup = $3,
          closing_cash_mlc = $4,
          total_sales = $5,
          total_refunds = $6,
          total_orders = $7,
          cash_difference = $8,
          closing_notes = $9,
          closing_denominations = $10
        WHERE id = $11
      `, [
        userId,
        reportedUsd,
        reportedCup,
        reportedMlc,
        parseFloat(totals.total_sales) || 0,
        parseFloat(totals.total_refunds) || 0,
        parseInt(totals.total_orders) || 0,
        Math.round(differenceUsd * 100) / 100,
        closingNotes || null,
        closingDenominations ? JSON.stringify(closingDenominations) : null,
        sessionId
      ])

      console.log('[POS Sessions] Closed session:', session.session_code)

      return NextResponse.json({
        success: true,
        data: {
          cashDifference: Math.round(differenceUsd * 100) / 100,
          expected: { usd: expectedUsd, cup: expectedCup, mlc: expectedMlc },
          reported: { usd: reportedUsd, cup: reportedCup, mlc: reportedMlc }
        },
        message: 'Sesión cerrada exitosamente'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Acción no válida'
    }, { status: 400 })

  } catch (error) {
    console.error('[POS Session API] Error updating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar sesión'
    }, { status: 500 })
  }
}
