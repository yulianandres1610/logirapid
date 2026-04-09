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

    const {
      amount,
      paymentMethod,
      currency,
      originalAmount,
      reference,
      paymentDate,
      notes
    } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto del pago debe ser mayor a cero'
      }, { status: 400 })
    }

    if (!paymentMethod) {
      return NextResponse.json({
        success: false,
        error: 'El método de pago es requerido'
      }, { status: 400 })
    }

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

    // Ensure all columns exist
    try {
      await db.query(`ALTER TABLE market_invoice_payments ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD'`)
      await db.query(`ALTER TABLE market_invoice_payments ADD COLUMN IF NOT EXISTS payment_date DATE DEFAULT CURRENT_DATE`)
      await db.query(`ALTER TABLE market_invoice_payments ADD COLUMN IF NOT EXISTS notes TEXT`)
      await db.query(`ALTER TABLE market_invoice_payments ADD COLUMN IF NOT EXISTS created_by INTEGER`)
    } catch { /* ignore */ }

    const amountDue = parseFloat(invoice.amount_due) || 0
    const safeAmount = parseFloat(String(amount)) || 0
    // Allow 5% tolerance for exchange rate rounding
    const tolerance = amountDue * 0.05
    const effectiveAmount = Math.min(safeAmount, amountDue)
    if (safeAmount > amountDue + tolerance) {
      return NextResponse.json({
        success: false,
        error: `El monto del pago ($${safeAmount.toFixed(2)}) excede el saldo pendiente ($${amountDue.toFixed(2)})`
      }, { status: 400 })
    }

    // Generate payment number: PAG-2025-0001
    const year = new Date().getFullYear()
    const numberResult = await db.query(`
      SELECT payment_number FROM market_invoice_payments
      WHERE payment_number LIKE $1
      ORDER BY id DESC
      LIMIT 1
    `, [`PAG-${year}-%`])

    let nextNumber = 1
    if (numberResult.rows.length > 0) {
      const lastNumber = numberResult.rows[0].payment_number
      const match = lastNumber.match(/PAG-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const paymentNumber = `PAG-${year}-${String(nextNumber).padStart(4, '0')}`

    await db.transaction(async (client) => {
      // Build notes with original currency info
      const paymentNotes = [
        notes,
        currency && currency !== 'USD' && originalAmount ? `Original: ${originalAmount} ${currency}` : null
      ].filter(Boolean).join(' | ') || null

      await client.query(`
        INSERT INTO market_invoice_payments (
          invoice_id, payment_number, amount, payment_method,
          reference, payment_date, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        invoiceId,
        paymentNumber,
        Number(effectiveAmount.toFixed(4)),
        paymentMethod,
        reference || null,
        paymentDate || new Date().toISOString().split('T')[0],
        paymentNotes,
        payload.userId
      ])

      // Update invoice amounts
      const currentPaid = parseFloat(invoice.amount_paid) || 0
      const totalAmount = parseFloat(invoice.total_amount) || 0
      const newAmountPaid = Number((currentPaid + effectiveAmount).toFixed(4))
      const newAmountDue = Number(Math.max(0, totalAmount - newAmountPaid).toFixed(4))
      const newPaymentStatus = newAmountDue <= 0.01 ? 'paid' : 'partial'

      console.log('[Payment] Updating invoice:', { invoiceId, currentPaid, effectiveAmount, newAmountPaid, newAmountDue, newPaymentStatus })

      await client.query(`
        UPDATE market_invoices SET
          amount_paid = $1,
          amount_due = $2,
          payment_status = $3,
          paid_at = CASE WHEN $3::text = 'paid' THEN NOW() ELSE paid_at END,
          updated_at = NOW()
        WHERE id = $4
      `, [newAmountPaid, newAmountDue, newPaymentStatus, invoiceId])

      // Update customer balance (ignore if column doesn't exist)
      try {
        await client.query(`
          UPDATE market_wholesale_customers SET
            current_balance = COALESCE(current_balance, 0) - $1,
            updated_at = NOW()
          WHERE id = $2
        `, [effectiveAmount, invoice.customer_id])
      } catch (balErr) {
        console.log('[Payment] Customer balance update skipped:', balErr instanceof Error ? balErr.message : balErr)
      }
    })

    return NextResponse.json({
      success: true,
      message: `Pago ${paymentNumber} registrado exitosamente`,
      data: {
        paymentNumber,
        amount: effectiveAmount,
        currency: currency || 'USD',
        newAmountDue: Math.max(0, amountDue - effectiveAmount)
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
