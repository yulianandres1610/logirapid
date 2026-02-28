import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { sendEmail } from '@/lib/email'
import { generateQuoteProposalHtml } from '@/lib/email-templates/quote-proposal'

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
 * POST /api/market/wholesale/quotes/[id]/send
 * Send a quote to the customer (changes status from draft to sent)
 * Optionally sends an email with PDF attachment
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
    const quoteId = parseInt(id)

    // Parse optional body
    let body: {
      email?: string
      message?: string
      pdfBase64?: string
      signatureUrl?: string
    } = {}

    try {
      body = await request.json()
    } catch {
      // Body is optional
    }

    // Verify quote exists and get details
    const checkResult = await db.query(`
      SELECT q.id, q.status, q.quote_number, q.subtotal, q.discount_percent,
             q.discount_amount, q.total_amount, q.currency, q.valid_until, q.notes,
             c.email as customer_email, c.business_name,
             comp.name as company_name
      FROM market_quotes q
      JOIN market_wholesale_customers c ON c.id = q.customer_id
      JOIN companies comp ON comp.id = q.company_id
      WHERE q.id = $1 AND q.company_id = $2
    `, [quoteId, payload.companyId])

    // Try to get signature token separately (column may not exist yet)
    let signatureToken: string | null = null
    try {
      const sigResult = await db.query(
        'SELECT signature_token FROM market_quotes WHERE id = $1',
        [quoteId]
      )
      signatureToken = sigResult.rows[0]?.signature_token || null
    } catch {
      // Column doesn't exist yet - ignore
    }

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada'
      }, { status: 404 })
    }

    const quote = checkResult.rows[0]

    if (quote.status !== 'draft' && quote.status !== 'sent') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden enviar cotizaciones en estado borrador o enviada'
      }, { status: 400 })
    }

    // Get quote lines for email
    const linesResult = await db.query(`
      SELECT product_name, quantity, unit_price, subtotal
      FROM market_quote_lines
      WHERE quote_id = $1
      ORDER BY id
    `, [quoteId])

    // Update status to sent (only if draft)
    if (quote.status === 'draft') {
      await db.query(`
        UPDATE market_quotes SET
          status = 'sent',
          sent_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [quoteId])
    }

    // Try to send email (non-fatal if it fails)
    let emailSent = false
    const recipientEmail = body.email || quote.customer_email

    if (recipientEmail && process.env.RESEND_API_KEY) {
      try {
        // Build signature URL
        const signatureUrl = body.signatureUrl ||
          (signatureToken
            ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://mercado.logirapid.com'}/quote-sign/${signatureToken}`
            : undefined)

        const html = generateQuoteProposalHtml({
          quoteNumber: quote.quote_number,
          customerName: quote.business_name,
          totalAmount: parseFloat(quote.total_amount),
          currency: quote.currency,
          validUntil: quote.valid_until,
          lines: linesResult.rows.map(l => ({
            productName: l.product_name,
            quantity: parseFloat(l.quantity),
            unitPrice: parseFloat(l.unit_price),
            subtotal: parseFloat(l.subtotal)
          })),
          notes: quote.notes,
          companyName: quote.company_name || 'LogiRapid',
          customMessage: body.message,
          signatureUrl
        })

        // Build attachments
        const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = []
        if (body.pdfBase64) {
          attachments.push({
            filename: `${quote.quote_number}.pdf`,
            content: Buffer.from(body.pdfBase64, 'base64'),
            contentType: 'application/pdf'
          })
        }

        const emailResult = await sendEmail({
          to: recipientEmail,
          subject: `Cotización ${quote.quote_number} - ${quote.company_name || 'LogiRapid'}`,
          html,
          attachments: attachments.length > 0 ? attachments : undefined
        })

        emailSent = emailResult.success
        if (!emailResult.success) {
          console.error('[Quote Send] Email failed:', emailResult.error)
        }
      } catch (emailError) {
        console.error('[Quote Send] Email error:', emailError)
      }
    }

    return NextResponse.json({
      success: true,
      message: emailSent
        ? `Cotización ${quote.quote_number} enviada por email a ${recipientEmail}`
        : `Cotización ${quote.quote_number} marcada como enviada${recipientEmail ? ' (email no enviado - configurar RESEND_API_KEY)' : ''}`,
      data: {
        quoteNumber: quote.quote_number,
        customerEmail: recipientEmail,
        emailSent
      }
    })

  } catch (error) {
    console.error('[Wholesale Quote Send] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al enviar cotización'
    }, { status: 500 })
  }
}
