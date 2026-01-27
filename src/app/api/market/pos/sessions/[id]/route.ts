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

    // ==============================================================
    // STEP 1: Auto-fix draft orders FIRST (before calculating totals)
    // ==============================================================
    // Find ALL draft orders to check if they should be marked as paid
    const allDraftOrders = await db.query(`
      SELECT o.id, o.order_number, o.total_amount,
             COALESCE(SUM(p.amount), 0) as total_paid,
             COUNT(p.id) as payment_count
      FROM market_pos_orders o
      LEFT JOIN market_pos_payments p ON p.order_id = o.id
      WHERE o.pos_session_id = $1 AND o.status = 'draft'
      GROUP BY o.id, o.order_number, o.total_amount
    `, [sessionId])

    if (allDraftOrders.rows.length > 0) {
      console.log('[POS Session API] Found', allDraftOrders.rows.length, 'draft orders to check')

      let fixedCount = 0
      for (const order of allDraftOrders.rows) {
        const totalAmount = parseFloat(order.total_amount) || 0
        const totalPaid = parseFloat(order.total_paid) || 0
        const paymentCount = parseInt(order.payment_count) || 0

        // Fix if has sufficient payment (with small tolerance for floating point)
        if (totalPaid >= totalAmount - 0.01) {
          await db.query(`
            UPDATE market_pos_orders SET status = 'paid', updated_at = NOW()
            WHERE id = $1
          `, [order.id])
          console.log('[POS Session API] Auto-fixed draft order (paid):', order.order_number,
            'Amount:', totalAmount, 'Paid:', totalPaid)
          fixedCount++
        }
        // Also fix zero-amount orders with payments (promotional orders, etc)
        else if (totalAmount === 0 && paymentCount > 0) {
          await db.query(`
            UPDATE market_pos_orders SET status = 'paid', updated_at = NOW()
            WHERE id = $1
          `, [order.id])
          console.log('[POS Session API] Auto-fixed zero-amount order:', order.order_number)
          fixedCount++
        }
      }

      if (fixedCount > 0) {
        console.log('[POS Session API] Fixed', fixedCount, 'draft orders')
      }
    }

    // ==============================================================
    // STEP 2: Now get payment totals (AFTER auto-fix)
    // ==============================================================
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

    // ==============================================================
    // STEP 3: Get orders summary (AFTER auto-fix)
    // ==============================================================
    const ordersResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'paid') as paid_orders,
        COUNT(*) FILTER (WHERE status = 'voided') as voided_orders,
        COUNT(*) FILTER (WHERE status = 'refunded') as refunded_orders,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_orders,
        SUM(total_amount) FILTER (WHERE status = 'paid') as total_sales,
        SUM(total_amount) FILTER (WHERE status = 'refunded') as total_refunds,
        SUM(discount_amount) FILTER (WHERE status = 'paid') as total_discounts,
        SUM(total_amount) FILTER (WHERE status = 'draft') as draft_total
      FROM market_pos_orders
      WHERE pos_session_id = $1
    `, [sessionId])

    const ordersSummary = ordersResult.rows[0]

    // Log the summary for debugging
    console.log('[POS Session API] Session summary:', {
      sessionId,
      paidOrders: ordersSummary.paid_orders,
      draftOrders: ordersSummary.draft_orders,
      totalSales: ordersSummary.total_sales,
      paymentsCount: paymentsResult.rows.length
    })

    // Calculate expected cash by currency
    const cashPayments: Record<string, number> = {}
    for (const p of paymentsResult.rows) {
      if (p.payment_method === 'cash') {
        cashPayments[p.currency] = (cashPayments[p.currency] || 0) + parseFloat(p.total_amount)
      }
    }

    // Get inventory shortage value for this session
    const inventoryShortageValue = parseFloat(session.inventory_shortage_value) || 0

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
        inventoryShortageValue,
        cashDifference: session.cash_difference !== null ? parseFloat(session.cash_difference) : null,
        openingNotes: session.opening_notes,
        closingNotes: session.closing_notes,
        summary: {
          paidOrders: parseInt(ordersSummary.paid_orders) || 0,
          voidedOrders: parseInt(ordersSummary.voided_orders) || 0,
          refundedOrders: parseInt(ordersSummary.refunded_orders) || 0,
          draftOrders: parseInt(ordersSummary.draft_orders) || 0,
          totalSales: parseFloat(ordersSummary.total_sales) || 0,
          totalRefunds: parseFloat(ordersSummary.total_refunds) || 0,
          totalDiscounts: parseFloat(ordersSummary.total_discounts) || 0,
          draftTotal: parseFloat(ordersSummary.draft_total) || 0
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
        closingNotes
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

      // Get inventory shortage value (faltante de inventario)
      const inventoryShortage = parseFloat(session.inventory_shortage_value) || 0

      // Calculate difference (reported - expected)
      // El faltante de inventario se suma al expected USD (el cajero debe reponer)
      const expectedUsd = (parseFloat(session.opening_cash_usd) || 0) + (cashByurrency['USD'] || 0) + inventoryShortage
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
          closing_notes = $9
        WHERE id = $10
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

    // Force close without inventory count (Admin only)
    if (action === 'force-close') {
      // Check admin permission
      const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MARKET_MANAGER'].includes(payload.role)
      if (!isAdmin) {
        return NextResponse.json({
          success: false,
          error: 'Solo administradores pueden forzar el cierre'
        }, { status: 403 })
      }

      if (session.status !== 'open') {
        return NextResponse.json({
          success: false,
          error: 'La sesión ya está cerrada'
        }, { status: 400 })
      }

      const { closingNotes } = body

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

      // Force close session without cash count
      await db.query(`
        UPDATE market_pos_sessions SET
          status = 'closed',
          closed_by = $1,
          closed_at = NOW(),
          closing_cash_usd = NULL,
          closing_cash_cup = NULL,
          closing_cash_mlc = NULL,
          total_sales = $2,
          total_refunds = $3,
          total_orders = $4,
          cash_difference = NULL,
          closing_notes = $5
        WHERE id = $6
      `, [
        userId,
        parseFloat(totals.total_sales) || 0,
        parseFloat(totals.total_refunds) || 0,
        parseInt(totals.total_orders) || 0,
        closingNotes || 'Cerrado forzado por administrador sin conteo',
        sessionId
      ])

      console.log('[POS Sessions] Force closed session by admin:', session.session_code)

      return NextResponse.json({
        success: true,
        message: 'Sesión cerrada por administrador'
      })
    }

    // Fix opening balance (Admin only)
    if (action === 'fix-opening') {
      // Check admin permission
      const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'MARKET_MANAGER'].includes(payload.role)
      if (!isAdmin) {
        return NextResponse.json({
          success: false,
          error: 'Solo administradores pueden corregir la apertura'
        }, { status: 403 })
      }

      if (session.status !== 'open') {
        return NextResponse.json({
          success: false,
          error: 'Solo se puede corregir la apertura de sesiones abiertas'
        }, { status: 400 })
      }

      const {
        openingCashUsd,
        openingCashCup,
        openingCashMlc,
        openingNotes
      } = body

      // Update opening balance
      await db.query(`
        UPDATE market_pos_sessions SET
          opening_cash_usd = $1,
          opening_cash_cup = $2,
          opening_cash_mlc = $3,
          opening_notes = COALESCE($4, opening_notes)
        WHERE id = $5
      `, [
        openingCashUsd ?? session.opening_cash_usd,
        openingCashCup ?? session.opening_cash_cup,
        openingCashMlc ?? session.opening_cash_mlc,
        openingNotes,
        sessionId
      ])

      console.log('[POS Sessions] Fixed opening balance for session:', session.session_code, {
        usd: openingCashUsd,
        cup: openingCashCup,
        mlc: openingCashMlc
      })

      return NextResponse.json({
        success: true,
        message: 'Apertura de caja corregida exitosamente',
        data: {
          openingCash: {
            usd: openingCashUsd ?? parseFloat(session.opening_cash_usd) || 0,
            cup: openingCashCup ?? parseFloat(session.opening_cash_cup) || 0,
            mlc: openingCashMlc ?? parseFloat(session.opening_cash_mlc) || 0
          }
        }
      })
    }

    // Fix draft orders that should be paid
    if (action === 'fix-drafts') {
      // Find all draft orders for this session that have sufficient payments
      const draftOrdersResult = await db.query(`
        SELECT o.id, o.order_number, o.total_amount,
               COALESCE(SUM(p.amount), 0) as total_paid
        FROM market_pos_orders o
        LEFT JOIN market_pos_payments p ON p.order_id = o.id
        WHERE o.pos_session_id = $1 AND o.status = 'draft'
        GROUP BY o.id, o.order_number, o.total_amount
      `, [sessionId])

      let fixedCount = 0
      const fixedOrders: string[] = []

      for (const order of draftOrdersResult.rows) {
        const totalAmount = parseFloat(order.total_amount) || 0
        const totalPaid = parseFloat(order.total_paid) || 0

        console.log('[POS Sessions] Checking draft order:', {
          orderId: order.id,
          orderNumber: order.order_number,
          totalAmount,
          totalPaid,
          willFix: totalPaid >= (totalAmount - 0.01)
        })

        // If fully paid (with small tolerance), mark as paid
        if (totalPaid >= (totalAmount - 0.01)) {
          await db.query(`
            UPDATE market_pos_orders SET status = 'paid', updated_at = NOW()
            WHERE id = $1
          `, [order.id])
          fixedCount++
          fixedOrders.push(order.order_number)
          console.log('[POS Sessions] Fixed draft order:', order.order_number)
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          checkedOrders: draftOrdersResult.rows.length,
          fixedCount,
          fixedOrders
        },
        message: fixedCount > 0
          ? `Se corrigieron ${fixedCount} órdenes`
          : 'No hay órdenes para corregir'
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
