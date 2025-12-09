import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { getPaymentIntent, getCardDetails, STRIPE_FEE_PERCENTAGE } from '@/lib/stripe'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * Generate a unique transaction number
 */
function generateTransactionNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `WTX-${timestamp}${random}`
}

/**
 * POST /api/wallet/recharge/stripe/confirm
 *
 * Confirm a successful Stripe payment and credit the wallet
 *
 * Body: {
 *   paymentIntentId: string
 *   targetType: 'company' | 'user' | 'customer'
 *   targetId: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Verify JWT
    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Check permissions
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER']
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado para confirmar recargas'
      }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { paymentIntentId, targetType, targetId } = body

    // Validate required fields
    if (!paymentIntentId || !targetType || !targetId) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos: paymentIntentId, targetType, targetId'
      }, { status: 400 })
    }

    // Retrieve PaymentIntent from Stripe
    const paymentIntent = await getPaymentIntent(paymentIntentId)

    // Verify payment succeeded
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({
        success: false,
        error: `El pago no se completó. Estado: ${paymentIntent.status}`
      }, { status: 400 })
    }

    // Extract metadata
    const metadata = paymentIntent.metadata
    const baseAmount = parseFloat(metadata.baseAmount || '0')
    const fee = parseFloat(metadata.fee || '0')
    const walletNumber = metadata.walletNumber

    // Verify metadata matches request
    if (metadata.targetType !== targetType || metadata.targetId !== targetId.toString()) {
      return NextResponse.json({
        success: false,
        error: 'Los datos del pago no coinciden con la solicitud'
      }, { status: 400 })
    }

    // Check if this payment was already processed (idempotency)
    const existingTx = await db.query(`
      SELECT id FROM wallet_transactions
      WHERE stripe_payment_intent_id = $1
    `, [paymentIntentId])

    if (existingTx.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Este pago ya fue procesado'
      }, { status: 400 })
    }

    // Get card details
    const cardDetails = getCardDetails(paymentIntent)

    // Generate transaction number
    const transactionNumber = generateTransactionNumber()

    // Calculate total charged (in dollars from cents)
    const totalCharged = paymentIntent.amount / 100

    // Start transaction
    await db.query('BEGIN')

    try {
      let newBalance: number = 0
      let targetName: string = ''
      let targetPhone: string = ''

      // Update wallet balance based on target type
      if (targetType === 'company') {
        // Update company wallet
        const updateResult = await db.query(`
          UPDATE companies
          SET
            walletbalance = COALESCE(walletbalance, 0) + $1,
            "walletBalance" = (COALESCE("walletBalance"::numeric, walletbalance, 0) + $1)::varchar
          WHERE id = $2
          RETURNING
            COALESCE("walletBalance"::numeric, walletbalance, 0) as new_balance,
            legalname as name,
            phone
        `, [baseAmount, targetId])

        if (updateResult.rows.length === 0) {
          throw new Error('Empresa no encontrada')
        }

        newBalance = parseFloat(updateResult.rows[0].new_balance)
        targetName = updateResult.rows[0].name
        targetPhone = updateResult.rows[0].phone || ''

      } else if (targetType === 'user') {
        // Update user wallet
        const updateResult = await db.query(`
          UPDATE users
          SET wallet_balance = COALESCE(wallet_balance, 0) + $1
          WHERE id = $2
          RETURNING
            wallet_balance as new_balance,
            CONCAT(firstname, ' ', lastname) as name,
            phone
        `, [baseAmount, targetId])

        if (updateResult.rows.length === 0) {
          throw new Error('Usuario no encontrado')
        }

        newBalance = parseFloat(updateResult.rows[0].new_balance)
        targetName = updateResult.rows[0].name
        targetPhone = updateResult.rows[0].phone || ''

      } else if (targetType === 'customer') {
        // Update customer wallet
        const updateResult = await db.query(`
          UPDATE customers
          SET wallet_balance = COALESCE(wallet_balance, 0) + $1
          WHERE id = $2
          RETURNING
            wallet_balance as new_balance,
            CONCAT(firstname, ' ', lastname) as name,
            phone
        `, [baseAmount, targetId])

        if (updateResult.rows.length === 0) {
          throw new Error('Cliente no encontrado')
        }

        newBalance = parseFloat(updateResult.rows[0].new_balance)
        targetName = updateResult.rows[0].name
        targetPhone = updateResult.rows[0].phone || ''
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
          created_at,
          updated_at
        ) VALUES (
          $1, 'recharge', 'platform', $2, $3,
          $4,
          $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          'card_stripe', 'completed',
          $14, $15, $16,
          $17,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, [
        transactionNumber,
        payload.companyId,
        payload.userId,
        targetType,
        targetType === 'company' ? targetId : null,
        targetType === 'user' ? targetId : null,
        targetType === 'customer' ? targetId : null,
        walletNumber,
        baseAmount,
        baseAmount, // net_amount = same as amount (what goes to wallet)
        fee,
        STRIPE_FEE_PERCENTAGE,
        totalCharged,
        cardDetails.brand,
        cardDetails.last4,
        paymentIntentId,
        `Recarga via Stripe - ${cardDetails.brand} ****${cardDetails.last4}`
      ])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        data: {
          transactionNumber,
          amount: baseAmount,
          fee,
          feePercentage: STRIPE_FEE_PERCENTAGE,
          totalCharged,
          newBalance,
          cardBrand: cardDetails.brand,
          cardLast4: cardDetails.last4,
          targetName,
          targetPhone,
          walletNumber,
          paymentIntentId
        }
      })

    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Error confirming Stripe payment:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al confirmar el pago'
    }, { status: 500 })
  }
}
