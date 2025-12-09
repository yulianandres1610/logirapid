import Stripe from 'stripe'

// Initialize Stripe with platform credentials
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion
})

// Fee percentage for wallet recharges
export const STRIPE_FEE_PERCENTAGE = 3.5

interface CreatePaymentIntentParams {
  amount: number           // Amount in dollars
  walletNumber: string
  targetType: 'company' | 'user' | 'customer'
  targetId: number
  targetName: string
  description?: string
  metadata?: Record<string, string>
}

interface PaymentIntentResult {
  clientSecret: string
  paymentIntentId: string
  amount: number
  fee: number
  totalCharged: number
}

/**
 * Create a PaymentIntent for wallet recharge
 * Amount is base amount, fee is calculated automatically
 */
export async function createRechargePaymentIntent(
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResult> {
  const { amount, walletNumber, targetType, targetId, targetName, description, metadata } = params

  // Calculate fee and total
  const fee = Math.round(amount * STRIPE_FEE_PERCENTAGE) / 100
  const totalCharged = amount + fee
  const totalCents = Math.round(totalCharged * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    description: description || `Recarga de wallet ${walletNumber}`,
    metadata: {
      ...metadata,
      walletNumber,
      targetType,
      targetId: targetId.toString(),
      targetName,
      baseAmount: amount.toString(),
      fee: fee.toString(),
      feePercentage: STRIPE_FEE_PERCENTAGE.toString(),
      platform: 'LogiRapid'
    }
  })

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
    amount,
    fee,
    totalCharged
  }
}

/**
 * Retrieve a PaymentIntent by ID
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['payment_method']
  })
}

/**
 * Check if a PaymentIntent has succeeded
 */
export async function confirmPaymentSucceeded(paymentIntentId: string): Promise<boolean> {
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
  return intent.status === 'succeeded'
}

/**
 * Get card details from a PaymentIntent
 */
export function getCardDetails(paymentIntent: Stripe.PaymentIntent): {
  brand: string
  last4: string
} {
  const paymentMethod = paymentIntent.payment_method as Stripe.PaymentMethod | null

  if (paymentMethod && paymentMethod.card) {
    return {
      brand: paymentMethod.card.brand.toUpperCase(),
      last4: paymentMethod.card.last4
    }
  }

  return {
    brand: 'CARD',
    last4: '****'
  }
}

/**
 * Construct webhook event from request
 */
export function constructWebhookEvent(
  body: string,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(body, signature, webhookSecret)
}

/**
 * Create a Stripe Connect Account for a company
 */
export async function createConnectAccount(params: {
  email: string
  companyName: string
  country?: string
}): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: 'express',
    country: params.country || 'US',
    email: params.email,
    business_type: 'company',
    company: {
      name: params.companyName
    },
    capabilities: {
      transfers: { requested: true }
    }
  })
}

/**
 * Create an Account Link for Stripe Connect onboarding
 */
export async function createAccountLink(params: {
  accountId: string
  refreshUrl: string
  returnUrl: string
}): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: 'account_onboarding'
  })
}

/**
 * Get a Stripe Connect Account status
 */
export async function getConnectAccount(accountId: string): Promise<Stripe.Account> {
  return stripe.accounts.retrieve(accountId)
}

/**
 * Create a payout to a connected account
 */
export async function createPayout(params: {
  accountId: string
  amount: number // Amount in dollars
  description?: string
}): Promise<Stripe.Transfer> {
  const amountCents = Math.round(params.amount * 100)

  return stripe.transfers.create({
    amount: amountCents,
    currency: 'usd',
    destination: params.accountId,
    description: params.description || 'Payout from LogiRapid wallet'
  })
}

// Export the Stripe instance for advanced usage
export { stripe }
