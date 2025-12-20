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
 * GET /api/market/pos/sessions
 * List sessions (active, by terminal, history)
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

    const { searchParams } = new URL(request.url)
    const terminalId = searchParams.get('terminalId')
    const status = searchParams.get('status') // open, closed, all
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = `
      SELECT
        s.id,
        s.session_code,
        s.pos_terminal_id,
        s.opened_by,
        s.closed_by,
        s.opened_at,
        s.closed_at,
        s.opening_cash_usd,
        s.opening_cash_cup,
        s.opening_cash_mlc,
        s.closing_cash_usd,
        s.closing_cash_cup,
        s.closing_cash_mlc,
        s.total_sales,
        s.total_refunds,
        s.total_orders,
        s.cash_difference,
        s.status,
        s.opening_notes,
        s.closing_notes,
        t.code as terminal_code,
        t.name as terminal_name,
        COALESCE(uo.firstname || ' ' || uo.lastname, uo.email) as opened_by_name,
        COALESCE(uc.firstname || ' ' || uc.lastname, uc.email) as closed_by_name
      FROM market_pos_sessions s
      JOIN market_pos_terminals t ON s.pos_terminal_id = t.id
      LEFT JOIN users uo ON s.opened_by = uo.id
      LEFT JOIN users uc ON s.closed_by = uc.id
      WHERE s.company_id = $1
    `
    const params: (number | string)[] = [companyId]
    let paramIndex = 2

    if (terminalId) {
      query += ` AND s.pos_terminal_id = $${paramIndex++}`
      params.push(parseInt(terminalId))
    }

    if (status && status !== 'all') {
      query += ` AND s.status = $${paramIndex++}`
      params.push(status)
    }

    query += ` ORDER BY s.opened_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as count FROM market_pos_sessions s
      WHERE s.company_id = $1
    `
    const countParams: (number | string)[] = [companyId]
    let countParamIndex = 2

    if (terminalId) {
      countQuery += ` AND s.pos_terminal_id = $${countParamIndex++}`
      countParams.push(parseInt(terminalId))
    }
    if (status && status !== 'all') {
      countQuery += ` AND s.status = $${countParamIndex++}`
      countParams.push(status)
    }

    const countResult = await db.query(countQuery, countParams)

    return NextResponse.json({
      success: true,
      data: {
        sessions: result.rows.map(row => ({
          id: row.id,
          sessionCode: row.session_code,
          terminalId: row.pos_terminal_id,
          terminalCode: row.terminal_code,
          terminalName: row.terminal_name,
          openedBy: row.opened_by,
          openedByName: row.opened_by_name,
          closedBy: row.closed_by,
          closedByName: row.closed_by_name,
          openedAt: row.opened_at,
          closedAt: row.closed_at,
          openingCash: {
            usd: parseFloat(row.opening_cash_usd) || 0,
            cup: parseFloat(row.opening_cash_cup) || 0,
            mlc: parseFloat(row.opening_cash_mlc) || 0
          },
          closingCash: row.closing_cash_usd !== null ? {
            usd: parseFloat(row.closing_cash_usd) || 0,
            cup: parseFloat(row.closing_cash_cup) || 0,
            mlc: parseFloat(row.closing_cash_mlc) || 0
          } : null,
          totalSales: parseFloat(row.total_sales) || 0,
          totalRefunds: parseFloat(row.total_refunds) || 0,
          totalOrders: parseInt(row.total_orders) || 0,
          cashDifference: row.cash_difference !== null ? parseFloat(row.cash_difference) : null,
          status: row.status,
          openingNotes: row.opening_notes,
          closingNotes: row.closing_notes
        })),
        total: parseInt(countResult.rows[0].count)
      }
    })

  } catch (error) {
    console.error('[POS Sessions API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener sesiones'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/pos/sessions
 * Open a new session
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
      terminalId,
      openingCashUsd,
      openingCashCup,
      openingCashMlc,
      openingNotes,
      openingDenominations
    } = body

    if (!terminalId) {
      return NextResponse.json({
        success: false,
        error: 'Terminal ID es requerido'
      }, { status: 400 })
    }

    // Check terminal exists and is active
    const terminal = await db.query(`
      SELECT id, name, is_active FROM market_pos_terminals
      WHERE id = $1 AND company_id = $2
    `, [terminalId, companyId])

    if (terminal.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Terminal no encontrado'
      }, { status: 404 })
    }

    if (!terminal.rows[0].is_active) {
      return NextResponse.json({
        success: false,
        error: 'El terminal está desactivado'
      }, { status: 400 })
    }

    // Check if terminal already has an open session
    const openSession = await db.query(`
      SELECT id FROM market_pos_sessions
      WHERE pos_terminal_id = $1 AND status = 'open'
    `, [terminalId])

    if (openSession.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Este terminal ya tiene una sesión abierta'
      }, { status: 400 })
    }

    // Check user has permission to open session
    if (!['ADMIN', 'SUPER_ADMIN'].includes(payload.role)) {
      const userPerm = await db.query(`
        SELECT can_open_session FROM market_pos_users
        WHERE pos_terminal_id = $1 AND user_id = $2
      `, [terminalId, userId])

      if (userPerm.rows.length === 0 || !userPerm.rows[0].can_open_session) {
        return NextResponse.json({
          success: false,
          error: 'No tienes permiso para abrir sesiones en este terminal'
        }, { status: 403 })
      }
    }

    // Generate session code
    const year = new Date().getFullYear()
    const countResult = await db.query(`
      SELECT COUNT(*) as count FROM market_pos_sessions WHERE company_id = $1
    `, [companyId])
    const count = parseInt(countResult.rows[0].count) + 1
    const sessionCode = `SESS-${year}-${String(count).padStart(5, '0')}`

    // Ensure denominations columns exist
    try {
      await db.query(`ALTER TABLE market_pos_sessions ADD COLUMN IF NOT EXISTS opening_denominations JSONB`)
      await db.query(`ALTER TABLE market_pos_sessions ADD COLUMN IF NOT EXISTS closing_denominations JSONB`)
    } catch {
      // Columns may already exist
    }

    // Create session
    const result = await db.query(`
      INSERT INTO market_pos_sessions (
        company_id, pos_terminal_id, session_code,
        opened_by, opened_at,
        opening_cash_usd, opening_cash_cup, opening_cash_mlc,
        opening_notes, opening_denominations, status, created_at
      ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, 'open', NOW())
      RETURNING id
    `, [
      companyId,
      terminalId,
      sessionCode,
      userId,
      openingCashUsd || 0,
      openingCashCup || 0,
      openingCashMlc || 0,
      openingNotes || null,
      openingDenominations ? JSON.stringify(openingDenominations) : null
    ])

    console.log('[POS Sessions] Opened session:', sessionCode, 'Terminal:', terminalId)

    return NextResponse.json({
      success: true,
      data: {
        id: result.rows[0].id,
        sessionCode,
        terminalName: terminal.rows[0].name
      },
      message: 'Sesión abierta exitosamente'
    })

  } catch (error) {
    console.error('[POS Sessions API] Error creating:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al abrir sesión'
    }, { status: 500 })
  }
}
