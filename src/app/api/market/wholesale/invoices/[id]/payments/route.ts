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
 * GET /api/market/wholesale/invoices/[id]/payments
 * Get all payments for an invoice
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const invoiceId = parseInt(id)

    // Verify invoice exists
    const invoiceResult = await db.query(
      'SELECT id FROM market_invoices WHERE id = $1 AND company_id = $2',
      [invoiceId, payload.companyId]
    )

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    // Get payments
    const paymentsResult = await db.query(`
      SELECT
        p.*,
        u.email as created_by_email
      FROM market_invoice_payments p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.invoice_id = $1
      ORDER BY p.payment_date DESC, p.created_at DESC
    `, [invoiceId])

    const payments = paymentsResult.rows.map(p => ({
      id: p.id,
      paymentNumber: p.payment_number,
      amount: parseFloat(p.amount) || 0,
      currency: p.currency,
      paymentMethod: p.payment_method,
      reference: p.reference,
      paymentDate: p.payment_date,
      notes: p.notes,
      createdBy: p.created_by_email,
      createdAt: p.created_at
    }))

    return NextResponse.json({
      success: true,
      data: payments
    })

  } catch (error) {
    console.error('[Wholesale Invoice Payments GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener pagos'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/wholesale/invoices/[id]/payments
 * Register a new payment for an invoice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const invoiceId = parseInt(id)
    const body = await request.json()

    // Support batch payments (array) or single payment
    const payments: Array<{ amount: number; paymentMethod: string; currency?: string; originalAmount?: number; reference?: string; notes?: string }> = []

    if (Array.isArray(body.payments) && body.payments.length > 0) {
      // Batch mode: { payments: [...], paymentDate }
      for (const p of body.payments) {
        if (p.amount > 0 && p.paymentMethod) {
          payments.push(p)
        }
      }
    } else if (body.amount && body.paymentMethod) {
      // Single mode (legacy)
      payments.push(body)
    }

    if (payments.length === 0) {
      return NextResponse.json({ success: false, error: 'Al menos un pago válido es requerido' }, { status: 400 })
    }

    const paymentDate = body.paymentDate || new Date().toISOString().split('T')[0]

    // Verify invoice exists and get current amounts
    const invoiceResult = await db.query(`
      SELECT i.id, i.status, i.payment_status, i.total_amount, i.amount_paid, i.amount_due, i.customer_id
      FROM market_invoices i
      WHERE i.id = $1 AND i.company_id = $2
    `, [invoiceId, payload.companyId])

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    const invoice = invoiceResult.rows[0]

    if (invoice.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: 'No se pueden registrar pagos en facturas canceladas'
      }, { status: 400 })
    }

    if (invoice.payment_status === 'paid') {
      return NextResponse.json({
        success: false,
        error: 'Esta factura ya está completamente pagada'
      }, { status: 400 })
    }

    // Ensure columns exist
    try {
      await db.query(`ALTER TABLE market_invoice_payments ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT CURRENT_DATE`)
      await db.query(`ALTER TABLE market_invoice_payments ADD COLUMN IF NOT EXISTS notes TEXT`)
      await db.query(`ALTER TABLE market_invoice_payments ADD COLUMN IF NOT EXISTS created_by INTEGER`)
    } catch { /* ignore */ }

    // Calculate total of all payments in USD
    const totalPaymentUSD = payments.reduce((s, p) => s + (parseFloat(String(p.amount)) || 0), 0)
    const amountDue = parseFloat(invoice.amount_due) || 0
    const tolerance = amountDue * 0.10 // 10% tolerance for multi-currency rounding

    if (totalPaymentUSD > amountDue + tolerance) {
      return NextResponse.json({
        success: false,
        error: `El total de pagos ($${totalPaymentUSD.toFixed(2)}) excede el saldo pendiente ($${amountDue.toFixed(2)})`
      }, { status: 400 })
    }

    // Get next payment number
    const year = new Date().getFullYear()
    const numberResult = await db.query(
      `SELECT payment_number FROM market_invoice_payments WHERE payment_number LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`PAG-${year}-%`]
    )
    let nextNumber = 1
    if (numberResult.rows.length > 0) {
      const match = numberResult.rows[0].payment_number.match(/PAG-\d{4}-(\d+)/)
      if (match) nextNumber = parseInt(match[1]) + 1
    }

    // Process all payments sequentially
    let totalRegistered = 0
    const registeredPayments: string[] = []
    let runningPaid = parseFloat(invoice.amount_paid) || 0
    const totalAmount = parseFloat(invoice.total_amount) || 0

    for (const p of payments) {
      const pAmount = parseFloat(String(p.amount)) || 0
      if (pAmount <= 0) continue

      const effectiveAmount = Math.min(pAmount, Math.max(0, totalAmount - runningPaid))
      if (effectiveAmount <= 0) continue

      const paymentNumber = `PAG-${year}-${String(nextNumber).padStart(4, '0')}`
      nextNumber++

      // Build notes with original currency
      const payNotes = [
        p.notes,
        p.currency && p.currency !== 'USD' && p.originalAmount ? `Original: ${p.originalAmount} ${p.currency}` : null
      ].filter(Boolean).join(' | ') || null

      await db.query(`
        INSERT INTO market_invoice_payments (invoice_id, payment_number, amount, payment_method, reference, payment_date, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [invoiceId, paymentNumber, effectiveAmount, p.paymentMethod, p.reference || null, paymentDate, payNotes, payload.userId])

      runningPaid += effectiveAmount
      totalRegistered += effectiveAmount
      registeredPayments.push(paymentNumber)
    }

    // Update invoice once with final totals
    const finalAmountDue = Math.max(0, Math.round((totalAmount - runningPaid) * 10000) / 10000)
    const isPaid = finalAmountDue <= 0.01

    if (isPaid) {
      await db.query(`UPDATE market_invoices SET amount_paid = $1, amount_due = $2, payment_status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = $3`,
        [runningPaid, finalAmountDue, invoiceId])
    } else {
      await db.query(`UPDATE market_invoices SET amount_paid = $1, amount_due = $2, payment_status = 'partial', updated_at = NOW() WHERE id = $3`,
        [runningPaid, finalAmountDue, invoiceId])
    }

    // Update customer balance once
    try {
      await db.query(`UPDATE market_wholesale_customers SET current_balance = COALESCE(current_balance, 0) - $1, updated_at = NOW() WHERE id = $2`,
        [totalRegistered, invoice.customer_id])
    } catch { /* ignore */ }

    console.log('[Payment] Registered:', { invoiceId, payments: registeredPayments.length, totalRegistered, isPaid, finalAmountDue })

    return NextResponse.json({
      success: true,
      message: `${registeredPayments.length} pago(s) registrado(s)`,
      data: {
        paymentNumbers: registeredPayments,
        totalRegistered,
        isPaid,
        newAmountDue: finalAmountDue
      }
    })

  } catch (error) {
    console.error('[Wholesale Invoice Payments POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al registrar pago'
    }, { status: 500 })
  }
}
