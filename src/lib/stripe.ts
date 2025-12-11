import Stripe from 'stripe'

// Lazy initialization of Stripe client to avoid build-time errors
let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    _stripe = new Stripe(apiKey, {
      apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion
    })
  }
  return _stripe
}

// Fee percentage for wallet recharges
export const STRIPE_FEE_PERCENTAGE = 3.5

interface CreatePaymentIntentParams {
  amount: number           // Amount in dollars
  walletNumber: string
  targetType: 'company' | 'user' | 'customer'
  targetId: number
  targetName: string
  description?: string
  receiptEmail?: string    // Email to send payment receipt
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

  const paymentIntent = await getStripe().paymentIntents.create({
    amount: totalCents,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    receipt_email: params.receiptEmail,
    description: description || walletNumber,
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
 * Retrieve a PaymentIntent by ID with full payment details
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return getStripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ['payment_method', 'latest_charge']
  })
}

/**
 * Check if a PaymentIntent has succeeded
 */
export async function confirmPaymentSucceeded(paymentIntentId: string): Promise<boolean> {
  const intent = await getStripe().paymentIntents.retrieve(paymentIntentId)
  return intent.status === 'succeeded'
}

/**
 * Extended payment details from a PaymentIntent
 */
export interface PaymentDetails {
  brand: string
  last4: string
  paymentMethodType: string
  fingerprint?: string
  country?: string
  expMonth?: number
  expYear?: number
  funding?: string
  network?: string
  wallet?: string
  receiptEmail?: string
  receiptUrl?: string
}

/**
 * Get card details from a PaymentIntent
 * Handles various payment method types: card, link, wallets (Apple Pay, Google Pay), etc.
 */
export function getCardDetails(paymentIntent: Stripe.PaymentIntent): {
  brand: string
  last4: string
} {
  const details = getFullPaymentDetails(paymentIntent)
  return {
    brand: details.brand,
    last4: details.last4
  }
}

/**
 * Get full payment details from a PaymentIntent
 * Extracts comprehensive information from payment_method and latest_charge
 */
export function getFullPaymentDetails(paymentIntent: Stripe.PaymentIntent): PaymentDetails {
  const paymentMethod = paymentIntent.payment_method as Stripe.PaymentMethod | null
  const latestCharge = paymentIntent.latest_charge as Stripe.Charge | null

  // Default values
  let details: PaymentDetails = {
    brand: 'CARD',
    last4: '****',
    paymentMethodType: 'unknown'
  }

  // Try to get details from payment_method first
  if (paymentMethod) {
    details.paymentMethodType = paymentMethod.type

    // Standard card payment
    if (paymentMethod.card) {
      const card = paymentMethod.card
      details = {
        ...details,
        brand: card.brand.toUpperCase(),
        last4: card.last4,
        fingerprint: card.fingerprint || undefined,
        country: card.country || undefined,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        funding: card.funding || undefined,
        network: card.networks?.preferred || undefined,
        wallet: card.wallet?.type || undefined
      }
    }

    // Link payment method (Stripe's accelerated checkout)
    if (paymentMethod.link) {
      details.brand = 'LINK'
      details.paymentMethodType = 'link'
    }

    // US Bank Account
    if (paymentMethod.us_bank_account) {
      const bank = paymentMethod.us_bank_account
      details.brand = (bank.bank_name || 'BANK').toUpperCase()
      details.last4 = bank.last4 || '****'
      details.paymentMethodType = 'us_bank_account'
    }
  }

  // Try to get additional details from latest_charge (has card details even for wallets)
  if (latestCharge) {
    details.receiptEmail = latestCharge.receipt_email || undefined
    details.receiptUrl = latestCharge.receipt_url || undefined

    // payment_method_details on charge has more info for wallet payments
    const chargeDetails = latestCharge.payment_method_details
    if (chargeDetails) {
      // Card details from charge (works for Apple Pay, Google Pay, etc.)
      if (chargeDetails.card) {
        const card = chargeDetails.card
        // Only override if we don't have card details yet
        if (details.last4 === '****') {
          details.brand = (card.brand || 'CARD').toUpperCase()
          details.last4 = card.last4 || '****'
        }
        // Get wallet info from charge
        if (card.wallet?.type) {
          details.wallet = card.wallet.type
          // For wallet payments, show the wallet type as brand
          if (card.wallet.type === 'apple_pay') {
            details.brand = 'APPLE PAY'
          } else if (card.wallet.type === 'google_pay') {
            details.brand = 'GOOGLE PAY'
          } else if (card.wallet.type === 'link') {
            details.brand = 'LINK'
          }
        }
        // Additional card info from charge
        details.fingerprint = card.fingerprint || details.fingerprint
        details.country = card.country || details.country
        details.expMonth = card.exp_month || details.expMonth
        details.expYear = card.exp_year || details.expYear
        details.funding = card.funding || details.funding
        details.network = card.network || details.network
      }

      // Card present (for terminal payments)
      if (chargeDetails.card_present) {
        const card = chargeDetails.card_present
        details.brand = (card.brand || 'CARD').toUpperCase()
        details.last4 = card.last4 || '****'
        details.paymentMethodType = 'card_present'
      }

      // Link payment details from charge
      if (chargeDetails.link) {
        details.brand = 'LINK'
        details.paymentMethodType = 'link'
      }
    }
  }

  return details
}

/**
 * Construct webhook event from request
 */
export function constructWebhookEvent(
  body: string,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(body, signature, webhookSecret)
}

/**
 * Create a Stripe Connect Account for a company
 */
export async function createConnectAccount(params: {
  email: string
  companyName: string
  country?: string
}): Promise<Stripe.Account> {
  return getStripe().accounts.create({
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
  return getStripe().accountLinks.create({
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
  return getStripe().accounts.retrieve(accountId)
}

/**
 * Create a payout to a connected account
 * In test mode, if insufficient funds, simulates the transfer
 */
export async function createPayout(params: {
  accountId: string
  amount: number // Amount in dollars
  description?: string
}): Promise<Stripe.Transfer> {
  const amountCents = Math.round(params.amount * 100)
  const isTestMode = (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test_')

  try {
    return await getStripe().transfers.create({
      amount: amountCents,
      currency: 'usd',
      destination: params.accountId,
      description: params.description || 'Payout from LogiRapid wallet'
    })
  } catch (error: any) {
    // In test mode, if insufficient funds error, simulate the transfer
    if (isTestMode && error.code === 'balance_insufficient') {
      console.log('[Stripe Test Mode] Insufficient platform balance - simulating transfer')

      // Return a mock transfer object for testing
      const mockTransferId = `tr_test_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`

      return {
        id: mockTransferId,
        object: 'transfer',
        amount: amountCents,
        amount_reversed: 0,
        balance_transaction: null,
        currency: 'usd',
        destination: params.accountId,
        description: params.description || 'Payout from LogiRapid wallet',
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        reversed: false,
        reversals: { object: 'list', data: [], has_more: false, url: '' },
        source_transaction: null,
        source_type: 'card',
        transfer_group: null,
        metadata: { test_mode_simulated: 'true' }
      } as unknown as Stripe.Transfer
    }

    // Re-throw the error if not test mode or different error
    throw error
  }
}

// Export the getStripe function for advanced usage
export { getStripe }
