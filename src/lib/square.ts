import crypto from 'crypto'

// Square API Configuration
const SQUARE_VERSION = '2025-01-16'

export interface SquareCredentials {
  accessToken: string
  locationId: string
  environment: 'sandbox' | 'production'
}

export interface CreateOrderOptions {
  transactionNumber: string
  amount: number // in cents
  appFee: number // in cents (3% fee)
  description?: string
}

export interface CreateCheckoutOptions {
  orderId: string
  deviceId: string
  amount: number // in cents
  appFee: number // in cents
  collectSignature: boolean
  skipReceipt: boolean
  note?: string
}

export interface TerminalCheckoutStatus {
  id: string
  status: 'PENDING' | 'IN_PROGRESS' | 'CANCEL_REQUESTED' | 'CANCELED' | 'COMPLETED'
  paymentIds?: string[]
  cancelReason?: string
  createdAt: string
  updatedAt: string
}

export interface PaymentDetails {
  id: string
  status: string
  amountMoney: { amount: number; currency: string }
  receiptUrl?: string
  signatureData?: {
    signature: string // SVG or image data
  }
  cardDetails?: {
    card: {
      cardBrand: string
      last4: string
    }
  }
}

/**
 * Get Square API base URL based on environment
 */
export function getSquareBaseUrl(environment: 'sandbox' | 'production'): string {
  return environment === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

/**
 * Get platform Square credentials from environment variables
 */
export function getPlatformCredentials(): SquareCredentials | null {
  const accessToken = process.env.SQUARE_PLATFORM_ACCESS_TOKEN
  const locationId = process.env.SQUARE_PLATFORM_LOCATION_ID
  const environment = (process.env.SQUARE_PLATFORM_ENVIRONMENT || 'production') as 'sandbox' | 'production'

  if (!accessToken || !locationId) {
    return null
  }

  return { accessToken, locationId, environment }
}

/**
 * Create a Square Order for Terminal Checkout
 * The order contains the line item and app fee
 */
export async function createSquareOrder(
  credentials: SquareCredentials,
  options: CreateOrderOptions
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const baseUrl = getSquareBaseUrl(credentials.environment)
  const idempotencyKey = crypto.randomUUID()

  const orderRequest = {
    idempotency_key: idempotencyKey,
    order: {
      location_id: credentials.locationId,
      reference_id: options.transactionNumber,
      line_items: [
        {
          name: `Wallet Recharge - ${options.transactionNumber}`,
          quantity: '1',
          base_price_money: {
            amount: options.amount,
            currency: 'USD'
          }
        }
      ],
      // Optional: Add service charge for the fee display
      service_charges: options.appFee > 0 ? [
        {
          name: 'Processing Fee (3%)',
          amount_money: {
            amount: options.appFee,
            currency: 'USD'
          },
          calculation_phase: 'TOTAL_PHASE'
        }
      ] : []
    }
  }

  try {
    const response = await fetch(`${baseUrl}/v2/orders`, {
      method: 'POST',
      headers: {
        'Square-Version': SQUARE_VERSION,
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderRequest)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Square] Order creation failed:', data.errors)
      return {
        success: false,
        error: data.errors?.[0]?.detail || 'Error creating order'
      }
    }

    return {
      success: true,
      orderId: data.order.id
    }
  } catch (error) {
    console.error('[Square] Order creation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

/**
 * Create a Terminal Checkout
 * This sends the payment request to the physical terminal
 */
export async function createTerminalCheckout(
  credentials: SquareCredentials,
  options: CreateCheckoutOptions
): Promise<{ success: boolean; checkoutId?: string; error?: string }> {
  const baseUrl = getSquareBaseUrl(credentials.environment)
  const idempotencyKey = crypto.randomUUID()

  const totalAmount = options.amount + options.appFee

  const checkoutRequest = {
    idempotency_key: idempotencyKey,
    checkout: {
      amount_money: {
        amount: totalAmount,
        currency: 'USD'
      },
      order_id: options.orderId,
      device_options: {
        device_id: options.deviceId,
        collect_signature: options.collectSignature,
        skip_receipt_screen: options.skipReceipt,
        show_itemized_cart: true
      },
      payment_options: {
        autocomplete: true,
        accept_partial_authorization: false
      },
      // App fee - this is the 3% that goes to the platform
      app_fee_money: options.appFee > 0 ? {
        amount: options.appFee,
        currency: 'USD'
      } : undefined,
      note: options.note || `Wallet Recharge`
    }
  }

  try {
    console.log('[Square] Creating terminal checkout:', {
      deviceId: options.deviceId,
      amount: totalAmount,
      appFee: options.appFee,
      orderId: options.orderId
    })

    const response = await fetch(`${baseUrl}/v2/terminals/checkouts`, {
      method: 'POST',
      headers: {
        'Square-Version': SQUARE_VERSION,
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutRequest)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Square] Terminal checkout creation failed:', data.errors)
      return {
        success: false,
        error: data.errors?.[0]?.detail || 'Error creating terminal checkout'
      }
    }

    console.log('[Square] Terminal checkout created:', data.checkout.id)

    return {
      success: true,
      checkoutId: data.checkout.id
    }
  } catch (error) {
    console.error('[Square] Terminal checkout error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

/**
 * Get Terminal Checkout Status
 * Used for polling to check if payment is complete
 */
export async function getTerminalCheckoutStatus(
  credentials: SquareCredentials,
  checkoutId: string
): Promise<{ success: boolean; status?: TerminalCheckoutStatus; error?: string }> {
  const baseUrl = getSquareBaseUrl(credentials.environment)

  try {
    const response = await fetch(`${baseUrl}/v2/terminals/checkouts/${checkoutId}`, {
      method: 'GET',
      headers: {
        'Square-Version': SQUARE_VERSION,
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Square] Get checkout status failed:', data.errors)
      return {
        success: false,
        error: data.errors?.[0]?.detail || 'Error getting checkout status'
      }
    }

    const checkout = data.checkout

    return {
      success: true,
      status: {
        id: checkout.id,
        status: checkout.status,
        paymentIds: checkout.payment_ids,
        cancelReason: checkout.cancel_reason,
        createdAt: checkout.created_at,
        updatedAt: checkout.updated_at
      }
    }
  } catch (error) {
    console.error('[Square] Get checkout status error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

/**
 * Cancel a Terminal Checkout
 */
export async function cancelTerminalCheckout(
  credentials: SquareCredentials,
  checkoutId: string
): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getSquareBaseUrl(credentials.environment)

  try {
    const response = await fetch(`${baseUrl}/v2/terminals/checkouts/${checkoutId}/cancel`, {
      method: 'POST',
      headers: {
        'Square-Version': SQUARE_VERSION,
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Square] Cancel checkout failed:', data.errors)
      return {
        success: false,
        error: data.errors?.[0]?.detail || 'Error canceling checkout'
      }
    }

    return { success: true }
  } catch (error) {
    console.error('[Square] Cancel checkout error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

/**
 * Get Payment Details including signature
 */
export async function getPaymentDetails(
  credentials: SquareCredentials,
  paymentId: string
): Promise<{ success: boolean; payment?: PaymentDetails; error?: string }> {
  const baseUrl = getSquareBaseUrl(credentials.environment)

  try {
    const response = await fetch(`${baseUrl}/v2/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Square-Version': SQUARE_VERSION,
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[Square] Get payment failed:', data.errors)
      return {
        success: false,
        error: data.errors?.[0]?.detail || 'Error getting payment details'
      }
    }

    const payment = data.payment

    return {
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amountMoney: {
          amount: payment.amount_money.amount,
          currency: payment.amount_money.currency
        },
        receiptUrl: payment.receipt_url,
        signatureData: payment.device_details?.device_installation_id ? undefined : undefined, // Signature is in device_details or terminal_checkout
        cardDetails: payment.card_details ? {
          card: {
            cardBrand: payment.card_details.card.card_brand,
            last4: payment.card_details.card.last_4
          }
        } : undefined
      }
    }
  } catch (error) {
    console.error('[Square] Get payment error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

/**
 * Verify Square Webhook Signature
 * HMAC-SHA256 verification of webhook payload
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  signatureKey: string,
  notificationUrl: string
): boolean {
  try {
    // Square webhook signature format: timestamp.signature
    const signatureParts = signature.split('.')
    if (signatureParts.length !== 2) {
      console.error('[Square] Invalid signature format')
      return false
    }

    // Square uses HMAC-SHA1 for webhook signatures
    const stringToSign = notificationUrl + body
    const hmac = crypto.createHmac('sha256', signatureKey)
    hmac.update(stringToSign)
    const expectedSignature = hmac.digest('base64')

    // For Square, they actually use a different verification method
    // The signature is base64 encoded HMAC-SHA256
    const computedSignature = crypto
      .createHmac('sha256', signatureKey)
      .update(notificationUrl + body)
      .digest('base64')

    return signature === computedSignature
  } catch (error) {
    console.error('[Square] Webhook signature verification error:', error)
    return false
  }
}

/**
 * Calculate the 3% terminal fee
 * @param amount - Amount in dollars
 * @returns Object with fee in dollars and cents
 */
export function calculateTerminalFee(amount: number): { fee: number; feeCents: number; total: number; totalCents: number } {
  const fee = amount * 0.03 // 3%
  const total = amount + fee

  return {
    fee: Math.round(fee * 100) / 100,
    feeCents: Math.round(fee * 100),
    total: Math.round(total * 100) / 100,
    totalCents: Math.round(total * 100)
  }
}

/**
 * Convert dollars to cents
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100)
}

/**
 * Convert cents to dollars
 */
export function centsToDollars(cents: number): number {
  return cents / 100
}
