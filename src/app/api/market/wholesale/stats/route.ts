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

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * GET /api/market/wholesale/stats
 * Get wholesale module statistics for dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Get customers stats
    const customersResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active
      FROM market_wholesale_customers
      WHERE company_id = $1
    `, [payload.companyId])

    // Get quotes stats
    const quotesResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('draft', 'sent')) as pending,
        COALESCE(SUM(CASE WHEN status IN ('sent', 'accepted') THEN total_amount ELSE 0 END), 0) as pending_value
      FROM market_quotes
      WHERE company_id = $1
    `, [payload.companyId])

    // Get invoices stats for current month
    const invoicesResult = await db.query(`
      SELECT
        COUNT(*) as this_month,
        COALESCE(SUM(total_amount), 0) as this_month_value
      FROM market_invoices
      WHERE company_id = $1
        AND status != 'cancelled'
        AND created_at >= date_trunc('month', CURRENT_DATE)
    `, [payload.companyId])

    // Get accounts receivable (overdue)
    const receivableResult = await db.query(`
      SELECT
        COUNT(*) as overdue_count,
        COALESCE(SUM(amount_due), 0) as overdue_value
      FROM market_invoices
      WHERE company_id = $1
        AND payment_status IN ('pending', 'partial')
        AND due_date < CURRENT_DATE
        AND status != 'cancelled'
    `, [payload.companyId])

    // Get total pending (not overdue)
    const pendingResult = await db.query(`
      SELECT
        COALESCE(SUM(amount_due), 0) as total_pending
      FROM market_invoices
      WHERE company_id = $1
        AND payment_status IN ('pending', 'partial')
        AND status != 'cancelled'
    `, [payload.companyId])

    // Get recent invoices
    const recentInvoicesResult = await db.query(`
      SELECT
        i.id, i.invoice_number, i.status, i.payment_status, i.total_amount, i.created_at,
        c.business_name as customer_name
      FROM market_invoices i
      JOIN market_wholesale_customers c ON c.id = i.customer_id
      WHERE i.company_id = $1 AND i.status != 'cancelled'
      ORDER BY i.created_at DESC
      LIMIT 5
    `, [payload.companyId])

    // Get recent quotes
    const recentQuotesResult = await db.query(`
      SELECT
        q.id, q.quote_number, q.status, q.total_amount, q.created_at,
        c.business_name as customer_name
      FROM market_quotes q
      JOIN market_wholesale_customers c ON c.id = q.customer_id
      WHERE q.company_id = $1
      ORDER BY q.created_at DESC
      LIMIT 5
    `, [payload.companyId])

    const customers = customersResult.rows[0]
    const quotes = quotesResult.rows[0]
    const invoices = invoicesResult.rows[0]
    const receivable = receivableResult.rows[0]
    const pending = pendingResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        customers: {
          total: parseInt(customers.total) || 0,
          active: parseInt(customers.active) || 0
        },
        quotes: {
          pending: parseInt(quotes.pending) || 0,
          pendingValue: parseFloat(quotes.pending_value) || 0
        },
        invoices: {
          thisMonth: parseInt(invoices.this_month) || 0,
          thisMonthValue: parseFloat(invoices.this_month_value) || 0
        },
        receivable: {
          overdueCount: parseInt(receivable.overdue_count) || 0,
          overdueValue: parseFloat(receivable.overdue_value) || 0,
          totalPending: parseFloat(pending.total_pending) || 0
        },
        recentInvoices: recentInvoicesResult.rows.map(i => ({
          id: i.id,
          invoiceNumber: i.invoice_number,
          customerName: i.customer_name,
          status: i.status,
          paymentStatus: i.payment_status,
          totalAmount: parseFloat(i.total_amount) || 0,
          createdAt: i.created_at
        })),
        recentQuotes: recentQuotesResult.rows.map(q => ({
          id: q.id,
          quoteNumber: q.quote_number,
          customerName: q.customer_name,
          status: q.status,
          totalAmount: parseFloat(q.total_amount) || 0,
          createdAt: q.created_at
        }))
      }
    })

  } catch (error) {
    console.error('[Wholesale Stats GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener estadísticas'
    }, { status: 500 })
  }
}
