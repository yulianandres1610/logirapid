import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import {
  getPaymentDetails,
  getPlatformCredentials,
  SquareCredentials
} from '@/lib/square'
import crypto from 'crypto'

/**
 * POST /api/webhooks/square
 * Handle Square webhook events
 *
 * Events handled:
 * - terminal.checkout.completed
 * - terminal.checkout.canceled
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-square-hmacsha256-signature')
    const notificationUrl = process.env.SQUARE_WEBHOOK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/square`

    console.log('[Square Webhook] Received event')

    // Verify signature if signature key is configured
    const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
    if (signatureKey && signature) {
      const isValid = verifySquareSignature(body, signature, signatureKey, notificationUrl)
      if (!isValid) {
        console.error('[Square Webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(body)

    console.log('[Square Webhook] Event type:', event.type)

    // Handle different event types
    switch (event.type) {
      case 'terminal.checkout.completed':
        await handleCheckoutCompleted(event)
        break

      case 'terminal.checkout.canceled':
        await handleCheckoutCanceled(event)
        break

      default:
        console.log('[Square Webhook] Unhandled event type:', event.type)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Square Webhook] Error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Webhook processing error'
    }, { status: 500 })
  }
}

/**
 * Verify Square webhook signature
 */
function verifySquareSignature(
  body: string,
  signature: string,
  signatureKey: string,
  notificationUrl: string
): boolean {
  try {
    const stringToSign = notificationUrl + body
    const hmac = crypto.createHmac('sha256', signatureKey)
    hmac.update(stringToSign)
    const expectedSignature = hmac.digest('base64')

    return signature === expectedSignature
  } catch (error) {
    console.error('[Square Webhook] Signature verification error:', error)
    return false
  }
}

/**
 * Handle terminal.checkout.completed event
 */
async function handleCheckoutCompleted(event: any) {
  const checkout = event.data?.object?.checkout
  if (!checkout) {
    console.error('[Square Webhook] No checkout data in event')
    return
  }

  const checkoutId = checkout.id
  const paymentIds = checkout.payment_ids || []

  console.log('[Square Webhook] Checkout completed:', checkoutId)

  // Find transaction by checkout ID
  const txResult = await db.query(`
    SELECT
      wt.id,
      wt.transaction_number,
      wt.target_type,
      wt.target_company_id,
      wt.target_user_id,
      wt.target_customer_id,
      wt.target_wallet_number,
      wt.amount,
      wt.fee,
      wt.status,
      wt.terminal_id,
      wt.metadata,
      pt.company_id as terminal_company_id
    FROM wallet_transactions wt
    LEFT JOIN payment_terminals pt ON wt.terminal_id = pt.id
    WHERE wt.metadata->>'checkoutId' = $1
  `, [checkoutId])

  if (txResult.rows.length === 0) {
    console.log('[Square Webhook] No transaction found for checkout:', checkoutId)
    return
  }

  const tx = txResult.rows[0]

  // Skip if already completed
  if (tx.status === 'completed') {
    console.log('[Square Webhook] Transaction already completed:', tx.transaction_number)
    return
  }

  // Get Square credentials to fetch payment details
  let credentials: SquareCredentials | null = null
  if (tx.terminal_company_id === null) {
    credentials = getPlatformCredentials()
  } else {
    const settingsResult = await db.query(`
      SELECT square_access_token, square_location_id, square_environment
      FROM company_payment_settings
      WHERE company_id = $1
    `, [tx.terminal_company_id])

    const settings = settingsResult.rows[0]
    if (settings) {
      credentials = {
        accessToken: settings.square_access_token,
        locationId: settings.square_location_id,
        environment: settings.square_environment || 'sandbox'
      }
    }
  }

  // Get payment details for signature if available
  let paymentDetails = null
  if (credentials && paymentIds.length > 0) {
    const paymentResult = await getPaymentDetails(credentials, paymentIds[0])
    if (paymentResult.success) {
      paymentDetails = paymentResult.payment
    }
  }

  const amount = parseFloat(tx.amount)

  // Update wallet balance and complete transaction
  await db.transaction(async (client) => {
    // Update wallet balance based on target type
    if (tx.target_type === 'company') {
      await client.query(`
        UPDATE companies
        SET walletbalance = walletbalance + $1
        WHERE id = $2
      `, [amount, tx.target_company_id])
    } else if (tx.target_type === 'user') {
      await client.query(`
        UPDATE users
        SET wallet_balance = wallet_balance + $1
        WHERE id = $2
      `, [amount, tx.target_user_id])
    } else if (tx.target_type === 'customer') {
      await client.query(`
        UPDATE customers
        SET wallet_balance = wallet_balance + $1
        WHERE id = $2
      `, [amount, tx.target_customer_id])
    }

    // Get new balance
    let newBalance = 0
    if (tx.target_type === 'company') {
      const balResult = await client.query(`
        SELECT walletbalance as balance FROM companies WHERE id = $1
      `, [tx.target_company_id])
      newBalance = parseFloat(balResult.rows[0]?.balance || '0')
    } else if (tx.target_type === 'user') {
      const balResult = await client.query(`
        SELECT wallet_balance as balance FROM users WHERE id = $1
      `, [tx.target_user_id])
      newBalance = parseFloat(balResult.rows[0]?.balance || '0')
    } else if (tx.target_type === 'customer') {
      const balResult = await client.query(`
        SELECT wallet_balance as balance FROM customers WHERE id = $1
      `, [tx.target_customer_id])
      newBalance = parseFloat(balResult.rows[0]?.balance || '0')
    }

    // Update transaction with payment details
    await client.query(`
      UPDATE wallet_transactions
      SET
        status = 'completed',
        payment_reference = $1,
        completed_at = NOW(),
        metadata = metadata || $2
      WHERE id = $3
    `, [
      paymentIds[0] || null,
      JSON.stringify({
        newBalance,
        webhookReceived: true,
        receiptUrl: paymentDetails?.receiptUrl,
        cardBrand: paymentDetails?.cardDetails?.card.cardBrand,
        cardLast4: paymentDetails?.cardDetails?.card.last4
      }),
      tx.id
    ])
  })

  console.log('[Square Webhook] Transaction completed:', tx.transaction_number, 'New balance:', tx.target_wallet_number)
}

/**
 * Handle terminal.checkout.canceled event
 */
async function handleCheckoutCanceled(event: any) {
  const checkout = event.data?.object?.checkout
  if (!checkout) {
    console.error('[Square Webhook] No checkout data in event')
    return
  }

  const checkoutId = checkout.id
  const cancelReason = checkout.cancel_reason

  console.log('[Square Webhook] Checkout canceled:', checkoutId, 'Reason:', cancelReason)

  // Find and update transaction
  const txResult = await db.query(`
    SELECT id, transaction_number, status
    FROM wallet_transactions
    WHERE metadata->>'checkoutId' = $1
  `, [checkoutId])

  if (txResult.rows.length === 0) {
    console.log('[Square Webhook] No transaction found for checkout:', checkoutId)
    return
  }

  const tx = txResult.rows[0]

  // Skip if already final state
  if (tx.status === 'completed' || tx.status === 'cancelled') {
    console.log('[Square Webhook] Transaction already in final state:', tx.transaction_number, tx.status)
    return
  }

  // Update transaction as cancelled
  await db.query(`
    UPDATE wallet_transactions
    SET
      status = 'cancelled',
      metadata = metadata || $1
    WHERE id = $2
  `, [JSON.stringify({
    cancelReason,
    webhookReceived: true,
    cancelledAt: new Date().toISOString()
  }), tx.id])

  console.log('[Square Webhook] Transaction cancelled:', tx.transaction_number)
}
