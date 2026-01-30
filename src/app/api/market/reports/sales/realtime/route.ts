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
 * GET /api/market/reports/sales/realtime
 * Returns real-time sales data by terminal and payment method for today
 * Query params: date (optional, defaults to today)
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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Get sales by terminal with payment method breakdown
    const terminalSalesResult = await db.query(`
      SELECT
        t.id as terminal_id,
        t.name as terminal_name,
        t.code as terminal_code,
        pm.payment_method,
        pm.currency,
        COUNT(DISTINCT o.id) as orders,
        COALESCE(SUM(pm.amount), 0) as amount
      FROM market_pos_terminals t
      LEFT JOIN market_pos_orders o ON t.id = o.pos_terminal_id
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) = $2
      LEFT JOIN market_pos_payments pm ON o.id = pm.order_id
      WHERE t.company_id = $1 AND t.is_active = true
      GROUP BY t.id, t.name, t.code, pm.payment_method, pm.currency
      ORDER BY t.name, pm.payment_method
    `, [companyId, date])

    // Get totals by terminal
    const terminalTotalsResult = await db.query(`
      SELECT
        t.id as terminal_id,
        t.name as terminal_name,
        t.code as terminal_code,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_sales
      FROM market_pos_terminals t
      LEFT JOIN market_pos_orders o ON t.id = o.pos_terminal_id
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) = $2
      WHERE t.company_id = $1 AND t.is_active = true
      GROUP BY t.id, t.name, t.code
      ORDER BY total_sales DESC
    `, [companyId, date])

    // Get overall totals by payment method and currency
    const paymentTotalsResult = await db.query(`
      SELECT
        COALESCE(pm.payment_method, 'cash') as payment_method,
        COALESCE(pm.currency, 'USD') as currency,
        COUNT(DISTINCT o.id) as orders,
        COALESCE(SUM(pm.amount), 0) as amount
      FROM market_pos_orders o
      LEFT JOIN market_pos_payments pm ON o.id = pm.order_id
      WHERE o.company_id = $1
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) = $2
      GROUP BY pm.payment_method, pm.currency
      ORDER BY payment_method, currency
    `, [companyId, date])

    // Get grand total for the day
    const grandTotalResult = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_sales
      FROM market_pos_orders
      WHERE company_id = $1
        AND status IN ('paid', 'completed')
        AND DATE(created_at) = $2
    `, [companyId, date])

    // Process terminal data into structured format
    const terminalMap = new Map<number, {
      terminalId: number
      terminalName: string
      terminalCode: string
      totalOrders: number
      totalSales: number
      byPaymentMethod: Array<{
        method: string
        currency: string
        orders: number
        amount: number
      }>
    }>()

    // Initialize terminals from totals
    for (const row of terminalTotalsResult.rows) {
      terminalMap.set(row.terminal_id, {
        terminalId: row.terminal_id,
        terminalName: row.terminal_name,
        terminalCode: row.terminal_code,
        totalOrders: parseInt(row.total_orders) || 0,
        totalSales: parseFloat(row.total_sales) || 0,
        byPaymentMethod: []
      })
    }

    // Add payment method breakdowns
    for (const row of terminalSalesResult.rows) {
      const terminal = terminalMap.get(row.terminal_id)
      if (terminal && row.payment_method) {
        terminal.byPaymentMethod.push({
          method: row.payment_method,
          currency: row.currency || 'USD',
          orders: parseInt(row.orders) || 0,
          amount: parseFloat(row.amount) || 0
        })
      }
    }

    // Process payment totals
    const paymentTotals = paymentTotalsResult.rows.map(row => ({
      method: row.payment_method,
      currency: row.currency,
      orders: parseInt(row.orders) || 0,
      amount: parseFloat(row.amount) || 0
    }))

    // Separate USD and CUP totals
    const usdTotals = {
      cash: 0,
      card: 0,
      transfer: 0,
      credit: 0,
      total: 0
    }
    const cupTotals = {
      cash: 0,
      card: 0,
      transfer: 0,
      credit: 0,
      total: 0
    }

    for (const p of paymentTotals) {
      const target = p.currency === 'CUP' ? cupTotals : usdTotals
      if (p.method === 'cash' || p.method === 'efectivo') {
        target.cash += p.amount
      } else if (p.method === 'card' || p.method === 'tarjeta') {
        target.card += p.amount
      } else if (p.method === 'transfer' || p.method === 'transferencia') {
        target.transfer += p.amount
      } else if (p.method === 'credit' || p.method === 'credito') {
        target.credit += p.amount
      }
      target.total += p.amount
    }

    return NextResponse.json({
      success: true,
      data: {
        date,
        lastUpdated: new Date().toISOString(),
        grandTotal: {
          orders: parseInt(grandTotalResult.rows[0]?.total_orders) || 0,
          sales: parseFloat(grandTotalResult.rows[0]?.total_sales) || 0
        },
        currencyTotals: {
          USD: usdTotals,
          CUP: cupTotals
        },
        paymentTotals,
        terminals: Array.from(terminalMap.values())
      }
    })

  } catch (error) {
    console.error('[Realtime Sales API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener ventas en tiempo real'
    }, { status: 500 })
  }
}
