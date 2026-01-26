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
 * GET /api/market/reports/sales/orders
 * Returns orders for a specific date/period
 * Query params: date, period, terminalId
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
      const secret = process.env.JWT_SECRET || 'fallback-secret'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)

    const date = searchParams.get('date')
    const period = searchParams.get('period') || 'day'
    const terminalId = searchParams.get('terminalId')

    if (!date) {
      return NextResponse.json({
        success: false,
        error: 'Fecha requerida'
      }, { status: 400 })
    }

    console.log('[Sales Orders API] Params:', { date, period, terminalId, companyId })

    // Build date range based on period
    let startDate = date
    let endDate = date

    if (period === 'week') {
      // Get start of week (Monday)
      const d = new Date(date)
      const dayOfWeek = d.getDay()
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      d.setDate(diff)
      startDate = d.toISOString().split('T')[0]
      d.setDate(d.getDate() + 6)
      endDate = d.toISOString().split('T')[0]
    } else if (period === 'month') {
      // Get start and end of month
      const d = new Date(date)
      startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      d.setMonth(d.getMonth() + 1)
      d.setDate(0) // Last day of previous month
      endDate = d.toISOString().split('T')[0]
    } else if (period === 'year') {
      // Get start and end of year
      const d = new Date(date)
      startDate = `${d.getFullYear()}-01-01`
      endDate = `${d.getFullYear()}-12-31`
    }

    // Build terminal filter
    const terminalFilter = terminalId ? 'AND o.pos_terminal_id = $4' : ''
    const params = terminalId
      ? [companyId, startDate, endDate, parseInt(terminalId)]
      : [companyId, startDate, endDate]

    // Get orders
    const ordersResult = await db.query(`
      SELECT
        o.id,
        o.order_number,
        o.total_amount,
        o.status,
        o.created_at,
        t.name as terminal_name
      FROM market_pos_orders o
      LEFT JOIN market_pos_terminals t ON o.pos_terminal_id = t.id
      WHERE o.company_id = $1
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
        ${terminalFilter}
      ORDER BY o.created_at DESC
      LIMIT 100
    `, params)

    // Get payments and lines for each order
    const orders = await Promise.all(
      ordersResult.rows.map(async (order) => {
        // Get payments
        const paymentsResult = await db.query(`
          SELECT payment_method, currency, amount
          FROM market_pos_payments
          WHERE order_id = $1
        `, [order.id])

        // Get lines
        const linesResult = await db.query(`
          SELECT product_name, quantity, unit_price, total
          FROM market_pos_order_lines
          WHERE order_id = $1
          ORDER BY id
        `, [order.id])

        return {
          id: order.id,
          orderNumber: order.order_number,
          totalAmount: parseFloat(order.total_amount) || 0,
          status: order.status,
          createdAt: order.created_at,
          terminalName: order.terminal_name || 'Terminal',
          payments: paymentsResult.rows.map(p => ({
            method: p.payment_method,
            currency: p.currency,
            amount: parseFloat(p.amount) || 0
          })),
          lines: linesResult.rows.map(l => ({
            productName: l.product_name,
            quantity: parseFloat(l.quantity) || 1,
            unitPrice: parseFloat(l.unit_price) || 0,
            total: parseFloat(l.total) || 0
          }))
        }
      })
    )

    console.log('[Sales Orders API] Found orders:', orders.length)

    return NextResponse.json({
      success: true,
      data: {
        date,
        period,
        dateRange: { startDate, endDate },
        orders
      }
    })

  } catch (error) {
    console.error('[Sales Orders API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener órdenes'
    }, { status: 500 })
  }
}
