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
 * POST /api/market/wholesale/quotes/[id]/send
 * Send a quote to the customer (changes status from draft to sent)
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

    // Verify quote exists and is in draft status
    const checkResult = await db.query(`
      SELECT q.id, q.status, q.quote_number, c.email as customer_email, c.business_name
      FROM market_quotes q
      JOIN market_wholesale_customers c ON c.id = q.customer_id
      WHERE q.id = $1 AND q.company_id = $2
    `, [quoteId, payload.companyId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada'
      }, { status: 404 })
    }

    const quote = checkResult.rows[0]

    if (quote.status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden enviar cotizaciones en estado borrador'
      }, { status: 400 })
    }

    // Update status to sent
    await db.query(`
      UPDATE market_quotes SET
        status = 'sent',
        sent_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [quoteId])

    // TODO: Send email notification to customer
    // This would integrate with an email service

    return NextResponse.json({
      success: true,
      message: `Cotización ${quote.quote_number} enviada a ${quote.business_name}`,
      data: {
        quoteNumber: quote.quote_number,
        customerEmail: quote.customer_email
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
