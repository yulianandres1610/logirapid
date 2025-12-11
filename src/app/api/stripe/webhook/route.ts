import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent, getFullPaymentDetails, STRIPE_FEE_PERCENTAGE, getStripe } from '@/lib/stripe'
import { db } from '@/lib/database'
import Stripe from 'stripe'

/**
 * Generate a unique transaction number for webhook-processed payments
 */
function generateTransactionNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `WTX-${timestamp}${random}`
}

/**
 * POST /api/stripe/webhook
 *
 * Handle Stripe webhook events
 *
 * Events handled:
 * - account.updated: Update Connect account status
 * - transfer.created: Transfer to connected account created
 * - transfer.reversed: Transfer was reversed
 * - transfer.updated: Transfer status updated
 * - payout.paid: Payout to bank succeeded (Connect accounts)
 * - payout.failed: Payout to bank failed (Connect accounts)
 * - payment_intent.succeeded: Payment completed (for recharges)
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      console.error('Webhook: Missing stripe-signature header')
      return NextResponse.json({
        success: false,
        error: 'Missing signature'
      }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('Webhook: STRIPE_WEBHOOK_SECRET not configured')
      return NextResponse.json({
        success: false,
        error: 'Webhook secret not configured'
      }, { status: 500 })
    }

    // Verify and construct the event
    let event: Stripe.Event
    try {
      event = constructWebhookEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json({
        success: false,
        error: 'Invalid signature'
      }, { status: 400 })
    }

    console.log(`Webhook received: ${event.type}`)

    // Get event type as string for more flexible matching
    const eventType = event.type as string

    // Handle the event
    if (eventType === 'account.updated') {
      await handleAccountUpdated(event.data.object as Stripe.Account)
    } else if (eventType === 'transfer.created') {
      await handleTransferCreated(event.data.object as Stripe.Transfer)
    } else if (eventType === 'transfer.reversed') {
      await handleTransferReversed(event.data.object as Stripe.Transfer)
    } else if (eventType === 'transfer.updated') {
      await handleTransferUpdated(event.data.object as Stripe.Transfer)
    } else if (eventType === 'payout.paid') {
      await handlePayoutPaid(event.data.object as Stripe.Payout)
    } else if (eventType === 'payout.failed') {
      await handlePayoutFailed(event.data.object as Stripe.Payout)
    } else if (eventType === 'payment_intent.succeeded') {
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
    } else {
      console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing error'
    }, { status: 500 })
  }
}

/**
 * Handle account.updated event
 * Updates Connect account status in database
 */
async function handleAccountUpdated(account: Stripe.Account) {
  console.log(`Account updated: ${account.id}`)

  const payoutsEnabled = account.payouts_enabled || false
  const chargesEnabled = account.charges_enabled || false
  const detailsSubmitted = account.details_submitted || false

  // Determine status
  let status: 'pending' | 'active' | 'restricted' = 'pending'
  if (detailsSubmitted && payoutsEnabled) {
    status = 'active'
  } else if (account.requirements?.disabled_reason) {
    status = 'restricted'
  }

  // Update in companies table
  const companyResult = await db.query(`
    UPDATE companies
    SET
      stripe_account_status = $1,
      stripe_payouts_enabled = $2,
      stripe_charges_enabled = $3,
      stripe_details_submitted = $4,
      stripe_connected_at = CASE
        WHEN stripe_connected_at IS NULL AND $2 = true THEN CURRENT_TIMESTAMP
        ELSE stripe_connected_at
      END
    WHERE stripe_account_id = $5
    RETURNING id, legalname
  `, [status, payoutsEnabled, chargesEnabled, detailsSubmitted, account.id])

  if (companyResult.rows.length > 0) {
    console.log(`Updated company ${companyResult.rows[0].legalname} Connect status: ${status}`)
    return
  }

  // Update in users table
  const userResult = await db.query(`
    UPDATE users
    SET
      stripe_account_status = $1,
      stripe_payouts_enabled = $2,
      stripe_charges_enabled = $3,
      stripe_details_submitted = $4,
      stripe_connected_at = CASE
        WHEN stripe_connected_at IS NULL AND $2 = true THEN CURRENT_TIMESTAMP
        ELSE stripe_connected_at
      END
    WHERE stripe_account_id = $5
    RETURNING id, email
  `, [status, payoutsEnabled, chargesEnabled, detailsSubmitted, account.id])

  if (userResult.rows.length > 0) {
    console.log(`Updated user ${userResult.rows[0].email} Connect status: ${status}`)
  }
}

/**
 * Handle transfer.created event
 * Transfer to connected account was created
 */
async function handleTransferCreated(transfer: Stripe.Transfer) {
  console.log(`Transfer created: ${transfer.id}`)

  // Update payout status to processing
  await db.query(`
    UPDATE wallet_payouts
    SET
      status = 'processing',
      processed_at = CURRENT_TIMESTAMP
    WHERE stripe_transfer_id = $1
  `, [transfer.id])
}

/**
 * Handle transfer.reversed event
 * Transfer to connected account was reversed
 */
async function handleTransferReversed(transfer: Stripe.Transfer) {
  console.log(`Transfer reversed: ${transfer.id}`)

  // Update payout status to failed/reversed
  const result = await db.query(`
    UPDATE wallet_payouts
    SET
      status = 'failed',
      failure_code = 'reversed',
      failure_message = 'Transfer was reversed'
    WHERE stripe_transfer_id = $1
    RETURNING transaction_id, entity_type, company_id, user_id, amount
  `, [transfer.id])

  if (result.rows.length > 0) {
    const payout = result.rows[0]

    // Refund the wallet balance
    if (payout.entity_type === 'company' && payout.company_id) {
      await db.query(`
        UPDATE companies
        SET
          walletbalance = COALESCE(walletbalance, 0) + $1,
          "walletBalance" = (COALESCE("walletBalance"::numeric, walletbalance, 0) + $1)::varchar
        WHERE id = $2
      `, [payout.amount, payout.company_id])
    } else if (payout.entity_type === 'user' && payout.user_id) {
      await db.query(`
        UPDATE users
        SET wallet_balance = COALESCE(wallet_balance, 0) + $1
        WHERE id = $2
      `, [payout.amount, payout.user_id])
    }

    // Update the linked transaction to failed
    if (payout.transaction_id) {
      await db.query(`
        UPDATE wallet_transactions
        SET
          status = 'failed',
          notes = CONCAT(COALESCE(notes, ''), ' | Revertido')
        WHERE id = $1
      `, [payout.transaction_id])
    }

    console.log(`Refunded ${payout.amount} to ${payout.entity_type} ${payout.company_id || payout.user_id} (reversed)`)
  }
}

/**
 * Handle transfer.updated event
 * Transfer status was updated - mark as paid when successful
 */
async function handleTransferUpdated(transfer: Stripe.Transfer) {
  console.log(`Transfer updated: ${transfer.id}, reversed: ${transfer.reversed}`)

  // If transfer is not reversed, it means it's successful
  // Transfers to Express accounts are usually instant
  if (!transfer.reversed) {
    const result = await db.query(`
      UPDATE wallet_payouts
      SET
        status = 'paid',
        paid_at = CURRENT_TIMESTAMP
      WHERE stripe_transfer_id = $1 AND status != 'paid'
      RETURNING transaction_id
    `, [transfer.id])

    if (result.rows.length > 0 && result.rows[0].transaction_id) {
      await db.query(`
        UPDATE wallet_transactions
        SET
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [result.rows[0].transaction_id])
      console.log(`Transfer ${transfer.id} marked as paid`)
    }
  }
}

/**
 * Handle payout.paid event (from Connected Account)
 * Payout to bank account succeeded
 */
async function handlePayoutPaid(payout: Stripe.Payout) {
  console.log(`Payout paid: ${payout.id}, destination: ${payout.destination}`)

  // Find the wallet_payout by stripe_account_id (the account that received the payout)
  // Note: This event comes from the connected account's perspective
  const result = await db.query(`
    UPDATE wallet_payouts
    SET
      status = 'paid',
      paid_at = CURRENT_TIMESTAMP
    WHERE stripe_account_id = $1 AND status = 'processing'
    RETURNING transaction_id
  `, [payout.destination])

  if (result.rows.length > 0 && result.rows[0].transaction_id) {
    await db.query(`
      UPDATE wallet_transactions
      SET
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [result.rows[0].transaction_id])
    console.log(`Payout to bank completed for account`)
  }
}

/**
 * Handle payout.failed event (from Connected Account)
 * Payout to bank account failed
 */
async function handlePayoutFailed(payout: Stripe.Payout) {
  console.log(`Payout failed: ${payout.id}`)

  const failureCode = payout.failure_code || 'unknown'
  const failureMessage = payout.failure_message || 'Payout to bank failed'

  // Find and update the payout
  const result = await db.query(`
    UPDATE wallet_payouts
    SET
      status = 'failed',
      failure_code = $1,
      failure_message = $2
    WHERE stripe_account_id = $3 AND status = 'processing'
    RETURNING transaction_id, entity_type, company_id, user_id, amount
  `, [failureCode, failureMessage, payout.destination])

  if (result.rows.length > 0) {
    const payoutRecord = result.rows[0]

    // Refund the wallet balance
    if (payoutRecord.entity_type === 'company' && payoutRecord.company_id) {
      await db.query(`
        UPDATE companies
        SET
          walletbalance = COALESCE(walletbalance, 0) + $1,
          "walletBalance" = (COALESCE("walletBalance"::numeric, walletbalance, 0) + $1)::varchar
        WHERE id = $2
      `, [payoutRecord.amount, payoutRecord.company_id])
    } else if (payoutRecord.entity_type === 'user' && payoutRecord.user_id) {
      await db.query(`
        UPDATE users
        SET wallet_balance = COALESCE(wallet_balance, 0) + $1
        WHERE id = $2
      `, [payoutRecord.amount, payoutRecord.user_id])
    }

    // Update the linked transaction to failed
    if (payoutRecord.transaction_id) {
      await db.query(`
        UPDATE wallet_transactions
        SET
          status = 'failed',
          notes = CONCAT(COALESCE(notes, ''), ' | Fallido: ', $1)
        WHERE id = $2
      `, [failureMessage, payoutRecord.transaction_id])
    }

    console.log(`Refunded ${payoutRecord.amount} to ${payoutRecord.entity_type} (payout failed)`)
  }
}

/**
 * Handle payment_intent.succeeded event
 * Payment for wallet recharge succeeded
 *
 * This is critical for redirect-based payment methods like Klarna, Affirm, etc.
 * When the user is redirected away, the frontend loses state, so we process
 * the payment automatically here via webhook.
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`PaymentIntent succeeded: ${paymentIntent.id}`)

  const metadata = paymentIntent.metadata

  // Only process LogiRapid payments
  if (metadata.platform !== 'LogiRapid') {
    console.log(`PaymentIntent ${paymentIntent.id} is not a LogiRapid payment, ignoring`)
    return
  }

  // Check if already processed (idempotency)
  const existing = await db.query(`
    SELECT id FROM wallet_transactions
    WHERE stripe_payment_intent_id = $1
  `, [paymentIntent.id])

  if (existing.rows.length > 0) {
    console.log(`PaymentIntent ${paymentIntent.id} already processed`)
    return
  }

  // Extract metadata
  const targetType = metadata.targetType as 'company' | 'user' | 'customer'
  const targetId = parseInt(metadata.targetId || '0')
  const walletNumber = metadata.walletNumber
  const baseAmount = parseFloat(metadata.baseAmount || '0')
  const fee = parseFloat(metadata.fee || '0')
  const operatorId = parseInt(metadata.operatorId || '0')
  const companyId = parseInt(metadata.companyId || '0')

  // Validate required metadata
  if (!targetType || !targetId || !walletNumber || baseAmount <= 0) {
    console.error(`PaymentIntent ${paymentIntent.id} has invalid metadata:`, metadata)
    return
  }

  console.log(`Processing redirect payment: ${paymentIntent.id} for ${targetType} ${targetId}, amount: $${baseAmount}`)

  // Retrieve full payment intent with expanded details
  const fullPaymentIntent = await getStripe().paymentIntents.retrieve(paymentIntent.id, {
    expand: ['payment_method', 'latest_charge']
  })

  // Get payment details
  const paymentDetails = getFullPaymentDetails(fullPaymentIntent)

  // Generate transaction number
  const transactionNumber = generateTransactionNumber()

  // Calculate total charged (in dollars from cents)
  const totalCharged = paymentIntent.amount / 100

  // Start transaction
  await db.query('BEGIN')

  try {
    let newBalance: number = 0

    // Update wallet balance based on target type
    if (targetType === 'company') {
      const updateResult = await db.query(`
        UPDATE companies
        SET
          walletbalance = COALESCE(walletbalance, 0) + $1,
          "walletBalance" = (COALESCE("walletBalance"::numeric, walletbalance, 0) + $1)::varchar
        WHERE id = $2
        RETURNING COALESCE("walletBalance"::numeric, walletbalance, 0) as new_balance
      `, [baseAmount, targetId])

      if (updateResult.rows.length === 0) {
        throw new Error(`Company ${targetId} not found`)
      }
      newBalance = parseFloat(updateResult.rows[0].new_balance)

    } else if (targetType === 'user') {
      const updateResult = await db.query(`
        UPDATE users
        SET wallet_balance = COALESCE(wallet_balance, 0) + $1
        WHERE id = $2
        RETURNING wallet_balance as new_balance
      `, [baseAmount, targetId])

      if (updateResult.rows.length === 0) {
        throw new Error(`User ${targetId} not found`)
      }
      newBalance = parseFloat(updateResult.rows[0].new_balance)

    } else if (targetType === 'customer') {
      const updateResult = await db.query(`
        UPDATE customers
        SET wallet_balance = COALESCE(wallet_balance, 0) + $1
        WHERE id = $2
        RETURNING wallet_balance as new_balance
      `, [baseAmount, targetId])

      if (updateResult.rows.length === 0) {
        throw new Error(`Customer ${targetId} not found`)
      }
      newBalance = parseFloat(updateResult.rows[0].new_balance)
    }

    // Prepare transaction metadata
    const transactionMetadata = {
      paymentMethodType: paymentDetails.paymentMethodType,
      cardBrand: paymentDetails.brand,
      cardLast4: paymentDetails.last4,
      cardCountry: paymentDetails.country || null,
      cardFunding: paymentDetails.funding || null,
      cardNetwork: paymentDetails.network || null,
      wallet: paymentDetails.wallet || null,
      fingerprint: paymentDetails.fingerprint || null,
      receiptUrl: paymentDetails.receiptUrl || null,
      receiptEmail: paymentDetails.receiptEmail || null,
      processedVia: 'webhook'
    }

    // Insert transaction record
    await db.query(`
      INSERT INTO wallet_transactions (
        transaction_number,
        type,
        source_type,
        source_company_id,
        source_user_id,
        target_type,
        target_company_id,
        target_user_id,
        target_customer_id,
        target_wallet_number,
        amount,
        net_amount,
        fee,
        fee_percentage,
        total_charged,
        payment_method,
        status,
        card_brand,
        card_last4,
        stripe_payment_intent_id,
        notes,
        metadata,
        created_at,
        updated_at
      ) VALUES (
        $1, 'recharge', 'platform', $2, $3,
        $4,
        $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        'card_stripe', 'completed',
        $14, $15, $16,
        $17, $18,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      transactionNumber,
      companyId || null,
      operatorId || null,
      targetType,
      targetType === 'company' ? targetId : null,
      targetType === 'user' ? targetId : null,
      targetType === 'customer' ? targetId : null,
      walletNumber,
      baseAmount,
      baseAmount,
      fee,
      STRIPE_FEE_PERCENTAGE,
      totalCharged,
      paymentDetails.brand,
      paymentDetails.last4,
      paymentIntent.id,
      `Recarga via Stripe (webhook) - ${paymentDetails.brand} ****${paymentDetails.last4}`,
      JSON.stringify(transactionMetadata)
    ])

    await db.query('COMMIT')

    console.log(`Successfully processed redirect payment ${paymentIntent.id}: ${transactionNumber}, credited $${baseAmount} to ${targetType} ${targetId}, new balance: $${newBalance}`)

  } catch (error) {
    await db.query('ROLLBACK')
    console.error(`Error processing redirect payment ${paymentIntent.id}:`, error)
    throw error
  }
}

// Disable body parser for webhook (need raw body for signature verification)
export const config = {
  api: {
    bodyParser: false
  }
}
