import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-session-payments?code=SESS-2026-00006
 * Fix payments that were stored with USD-equivalent amounts instead of original currency amounts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionCode = searchParams.get('code') || 'SESS-2026-00006'

    // Exchange rate used (CUP BCC rate)
    const CUP_RATE = 250  // Approximate rate used at time of conversion

    // Find the session
    const sessionResult = await db.query(`
      SELECT id, session_code
      FROM market_pos_sessions
      WHERE session_code = $1
    `, [sessionCode])

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Sesión ${sessionCode} no encontrada`
      }, { status: 404 })
    }

    const sessionId = sessionResult.rows[0].id

    // Get all payments for orders in this session that are in CUP or MLC
    const paymentsResult = await db.query(`
      SELECT p.id, p.amount, p.currency, p.order_id, o.order_number
      FROM market_pos_payments p
      JOIN market_pos_orders o ON o.id = p.order_id
      WHERE o.pos_session_id = $1
        AND p.currency IN ('CUP', 'MLC')
      ORDER BY p.id
    `, [sessionId])

    if (paymentsResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay pagos en CUP/MLC para corregir',
        data: { fixed: 0 }
      })
    }

    const fixes: Array<{
      paymentId: number
      orderNumber: string
      currency: string
      oldAmount: number
      newAmount: number
    }> = []

    // Fix each payment
    for (const payment of paymentsResult.rows) {
      const oldAmount = parseFloat(payment.amount) || 0
      let newAmount = oldAmount

      if (payment.currency === 'CUP') {
        // The amount was stored as USD equivalent, multiply by rate to get original CUP
        newAmount = Math.round(oldAmount * CUP_RATE)
      } else if (payment.currency === 'MLC') {
        // MLC rate is approximately 1:1 with USD, might need adjustment
        // For now, leave MLC as is since conversion is minimal
        newAmount = oldAmount
      }

      if (newAmount !== oldAmount) {
        await db.query(`
          UPDATE market_pos_payments
          SET amount = $1
          WHERE id = $2
        `, [newAmount, payment.id])

        fixes.push({
          paymentId: payment.id,
          orderNumber: payment.order_number,
          currency: payment.currency,
          oldAmount,
          newAmount
        })
      }
    }

    console.log('[Migration] Fixed session payments:', sessionCode, fixes.length, 'payments corrected')

    return NextResponse.json({
      success: true,
      message: `Sesión ${sessionCode}: ${fixes.length} pagos corregidos`,
      data: {
        sessionId,
        totalPayments: paymentsResult.rows.length,
        fixed: fixes.length,
        fixes
      }
    })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
