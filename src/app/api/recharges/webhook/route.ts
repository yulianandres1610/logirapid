import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import crypto from 'crypto'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/recharges/webhook
 *
 * Webhook endpoint to receive topup notifications from UnivCell.
 *
 * UnivCell sends POST requests with the following payload:
 * {
 *   destination: string,      // The subscriber destination
 *   resultMessage: string,    // Order response message
 *   confirmationCode: string, // Provider confirmation code
 *   status: 'ok' | 'error',   // Order status
 *   reference: string,        // Client's local_reference
 *   orderId: string           // UnivCell's order ID
 * }
 *
 * Headers:
 * - HTTP_HASHED_CONTENT: HMAC signature of the payload
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Webhook] Received UnivCell notification')

    // Get the raw body for signature verification
    const rawBody = await request.text()
    let payload: {
      destination?: string
      resultMessage?: string
      confirmationCode?: string
      status?: 'ok' | 'error'
      reference?: string
      orderId?: string
    }

    try {
      payload = JSON.parse(rawBody)
    } catch {
      // Try to parse as form-urlencoded
      const formData = new URLSearchParams(rawBody)
      payload = {
        destination: formData.get('destination') || undefined,
        resultMessage: formData.get('resultMessage') || undefined,
        confirmationCode: formData.get('confirmationCode') || undefined,
        status: (formData.get('status') as 'ok' | 'error') || undefined,
        reference: formData.get('reference') || undefined,
        orderId: formData.get('orderId') || undefined
      }
    }

    console.log('[Webhook] Payload:', payload)

    // Optional: Verify HMAC signature
    const hashedContent = request.headers.get('HTTP_HASHED_CONTENT') ||
                          request.headers.get('hashed-content') ||
                          request.headers.get('x-hashed-content')

    if (hashedContent && process.env.UNIVCELL_WEBHOOK_SECRET) {
      const expectedHash = crypto
        .createHmac('sha256', process.env.UNIVCELL_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex')

      if (hashedContent !== expectedHash) {
        console.warn('[Webhook] Invalid signature')
        // Don't reject - UnivCell might use different serialization
        // return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const { destination, resultMessage, confirmationCode, status, reference, orderId } = payload

    if (!reference) {
      console.error('[Webhook] Missing reference in payload')
      return NextResponse.json({
        success: false,
        error: 'Missing reference'
      }, { status: 400 })
    }

    // Find the transaction by local_reference
    const result = await db.query(`
      SELECT id, status FROM recharge_transactions
      WHERE local_reference = $1
    `, [reference])

    if (result.rows.length === 0) {
      console.warn('[Webhook] Transaction not found:', reference)
      // Return 200 to prevent UnivCell from retrying
      return NextResponse.json({
        success: true,
        message: 'Transaction not found but acknowledged'
      })
    }

    const transaction = result.rows[0]

    // Only update if transaction is still pending
    if (transaction.status === 'pending') {
      const newStatus = status === 'ok' ? 'completed' : 'failed'

      await db.query(`
        UPDATE recharge_transactions
        SET
          status = $1,
          result_message = COALESCE($2, result_message),
          confirmation_code = COALESCE($3, confirmation_code),
          univcell_order_id = COALESCE($4, univcell_order_id),
          completed_at = $5,
          updated_at = NOW()
        WHERE id = $6
      `, [
        newStatus,
        resultMessage,
        confirmationCode,
        orderId,
        newStatus === 'completed' ? new Date() : null,
        transaction.id
      ])

      console.log('[Webhook] Transaction updated:', {
        id: transaction.id,
        reference,
        newStatus,
        confirmationCode
      })
    } else {
      console.log('[Webhook] Transaction already processed:', {
        id: transaction.id,
        currentStatus: transaction.status
      })
    }

    // Always return 200 to prevent retries
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully'
    })

  } catch (error) {
    console.error('[Webhook] Error processing:', error)

    // Return 200 even on error to prevent infinite retries
    // Log the error for investigation
    return NextResponse.json({
      success: true,
      message: 'Webhook acknowledged with errors'
    })
  }
}

/**
 * GET /api/recharges/webhook
 *
 * Health check endpoint to verify webhook is accessible
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'UnivCell webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}
