import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-session-opening
 * One-time fix for session SESS-2026-00006
 * Changes opening from 1840 USD to 1840 CUP
 */
export async function GET(request: NextRequest) {
  return fixSessionOpening(request)
}

/**
 * POST /api/migrations/fix-session-opening
 */
export async function POST(request: NextRequest) {
  return fixSessionOpening(request)
}

async function fixSessionOpening(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionCode = searchParams.get('code') || 'SESS-2026-00006'

    // Find the session
    const sessionResult = await db.query(`
      SELECT id, session_code, opening_cash_usd, opening_cash_cup, status
      FROM market_pos_sessions
      WHERE session_code = $1
    `, [sessionCode])

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Sesión ${sessionCode} no encontrada`
      }, { status: 404 })
    }

    const session = sessionResult.rows[0]

    // Update opening balance: 1840 USD -> 1840 CUP
    await db.query(`
      UPDATE market_pos_sessions
      SET opening_cash_usd = 0,
          opening_cash_cup = 1840,
          opening_notes = COALESCE(opening_notes, '') || ' [Corregido: se registró 1840 USD en vez de CUP]'
      WHERE id = $1
    `, [session.id])

    console.log('[Migration] Fixed session opening:', sessionCode)

    return NextResponse.json({
      success: true,
      message: `Sesión ${sessionCode} corregida`,
      data: {
        sessionId: session.id,
        before: {
          usd: parseFloat(session.opening_cash_usd) || 0,
          cup: parseFloat(session.opening_cash_cup) || 0
        },
        after: {
          usd: 0,
          cup: 1840
        }
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
