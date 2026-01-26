import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

/**
 * POST /api/market/pos/fix-drafts
 * Fix all draft orders that have sufficient payments
 * This is a global fix for all sessions in the company
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    // Only admins can run this fix
    if (!['SUPER_ADMIN', 'ADMIN', 'MARKET_MANAGER'].includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'Solo administradores pueden ejecutar esta corrección'
      }, { status: 403 })
    }

    const companyId = payload.companyId

    console.log('[Fix Drafts API] Starting fix for company:', companyId)

    // Find all draft orders with their payments
    const draftOrdersResult = await db.query(`
      SELECT
        o.id,
        o.order_number,
        o.total_amount,
        o.pos_session_id,
        s.session_code,
        COALESCE(SUM(p.amount), 0) as total_paid,
        COUNT(p.id) as payment_count
      FROM market_pos_orders o
      LEFT JOIN market_pos_sessions s ON o.pos_session_id = s.id
      LEFT JOIN market_pos_payments p ON p.order_id = o.id
      WHERE o.company_id = $1 AND o.status = 'draft'
      GROUP BY o.id, o.order_number, o.total_amount, o.pos_session_id, s.session_code
      ORDER BY o.created_at DESC
    `, [companyId])

    console.log('[Fix Drafts API] Found', draftOrdersResult.rows.length, 'draft orders')

    const results = {
      totalDraft: draftOrdersResult.rows.length,
      fixedToPaid: 0,
      remaining: 0,
      fixed: [] as Array<{ orderNumber: string; sessionCode: string; totalAmount: number; totalPaid: number }>,
      notFixed: [] as Array<{ orderNumber: string; sessionCode: string; totalAmount: number; totalPaid: number; reason: string }>
    }

    for (const order of draftOrdersResult.rows) {
      const totalAmount = parseFloat(order.total_amount) || 0
      const totalPaid = parseFloat(order.total_paid) || 0
      const paymentCount = parseInt(order.payment_count) || 0

      const orderInfo = {
        orderNumber: order.order_number,
        sessionCode: order.session_code || 'N/A',
        totalAmount,
        totalPaid
      }

      // Fix if has sufficient payment
      if (totalPaid >= totalAmount - 0.01) {
        await db.query(`
          UPDATE market_pos_orders SET status = 'paid', updated_at = NOW()
          WHERE id = $1
        `, [order.id])
        results.fixedToPaid++
        results.fixed.push(orderInfo)
        console.log('[Fix Drafts API] Fixed order:', order.order_number, 'Total:', totalAmount, 'Paid:', totalPaid)
      }
      // Fix zero-amount orders that have at least one payment
      else if (totalAmount === 0 && paymentCount > 0) {
        await db.query(`
          UPDATE market_pos_orders SET status = 'paid', updated_at = NOW()
          WHERE id = $1
        `, [order.id])
        results.fixedToPaid++
        results.fixed.push(orderInfo)
        console.log('[Fix Drafts API] Fixed zero-amount order:', order.order_number)
      }
      else {
        results.remaining++
        results.notFixed.push({
          ...orderInfo,
          reason: paymentCount === 0 ? 'Sin pagos registrados' : `Pago insuficiente (${totalPaid}/${totalAmount})`
        })
      }
    }

    console.log('[Fix Drafts API] Results:', {
      total: results.totalDraft,
      fixed: results.fixedToPaid,
      remaining: results.remaining
    })

    return NextResponse.json({
      success: true,
      data: results,
      message: results.fixedToPaid > 0
        ? `Se corrigieron ${results.fixedToPaid} órdenes de ${results.totalDraft} en draft`
        : 'No hay órdenes para corregir'
    })

  } catch (error) {
    console.error('[Fix Drafts API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al corregir órdenes'
    }, { status: 500 })
  }
}

/**
 * GET /api/market/pos/fix-drafts
 * Get status of draft orders without fixing them
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const companyId = payload.companyId

    // Get summary of draft orders
    const summaryResult = await db.query(`
      SELECT
        COUNT(*) as total_drafts,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COUNT(*) FILTER (
          WHERE (SELECT COALESCE(SUM(amount), 0) FROM market_pos_payments WHERE order_id = o.id) >= total_amount - 0.01
        ) as fixable_drafts
      FROM market_pos_orders o
      WHERE o.company_id = $1 AND o.status = 'draft'
    `, [companyId])

    // Get recent draft orders
    const recentDrafts = await db.query(`
      SELECT
        o.id,
        o.order_number,
        o.total_amount,
        o.created_at,
        s.session_code,
        t.name as terminal_name,
        COALESCE(SUM(p.amount), 0) as total_paid
      FROM market_pos_orders o
      LEFT JOIN market_pos_sessions s ON o.pos_session_id = s.id
      LEFT JOIN market_pos_terminals t ON o.pos_terminal_id = t.id
      LEFT JOIN market_pos_payments p ON p.order_id = o.id
      WHERE o.company_id = $1 AND o.status = 'draft'
      GROUP BY o.id, o.order_number, o.total_amount, o.created_at, s.session_code, t.name
      ORDER BY o.created_at DESC
      LIMIT 20
    `, [companyId])

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalDrafts: parseInt(summaryResult.rows[0]?.total_drafts) || 0,
          totalAmount: parseFloat(summaryResult.rows[0]?.total_amount) || 0,
          fixableDrafts: parseInt(summaryResult.rows[0]?.fixable_drafts) || 0
        },
        recentDrafts: recentDrafts.rows.map(o => ({
          id: o.id,
          orderNumber: o.order_number,
          totalAmount: parseFloat(o.total_amount) || 0,
          totalPaid: parseFloat(o.total_paid) || 0,
          createdAt: o.created_at,
          sessionCode: o.session_code,
          terminalName: o.terminal_name,
          canFix: parseFloat(o.total_paid) >= parseFloat(o.total_amount) - 0.01
        }))
      }
    })

  } catch (error) {
    console.error('[Fix Drafts API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener estado'
    }, { status: 500 })
  }
}
