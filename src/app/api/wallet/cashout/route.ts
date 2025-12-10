import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { createPayout, getConnectAccount } from '@/lib/stripe'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * Generate a unique payout reference
 */
function generatePayoutNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `WPO-${timestamp}${random}`
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
 * POST /api/wallet/cashout
 *
 * Process a cashout (withdrawal) from wallet to bank account via Stripe Connect
 *
 * Body: {
 *   entityType: 'company' | 'user'
 *   entityId: number
 *   amount: number  // Amount to withdraw in USD
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

    // Parse request body
    const body = await request.json()
    const { entityType, entityId, amount } = body

    // Validate required fields
    if (!entityType || !entityId || !amount) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos: entityType, entityId, amount'
      }, { status: 400 })
    }

    if (!['company', 'user'].includes(entityType)) {
      return NextResponse.json({
        success: false,
        error: 'entityType debe ser "company" o "user"'
      }, { status: 400 })
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    // Minimum cashout amount
    const MIN_CASHOUT = 10
    if (amountNum < MIN_CASHOUT) {
      return NextResponse.json({
        success: false,
        error: `El monto mínimo de retiro es $${MIN_CASHOUT}`
      }, { status: 400 })
    }

    let stripeAccountId: string | null = null
    let walletBalance: number = 0
    let walletNumber: string = ''
    let entityName: string = ''
    let payoutsEnabled: boolean = false

    if (entityType === 'company') {
      // Verify permissions: SUPER_ADMIN or ADMIN of the company
      if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN') {
        return NextResponse.json({
          success: false,
          error: 'No autorizado. Solo ADMIN puede realizar retiros de la empresa.'
        }, { status: 403 })
      }

      // Non-SUPER_ADMIN can only cashout from their own company
      if (payload.role !== 'SUPER_ADMIN' && payload.companyId !== entityId) {
        return NextResponse.json({
          success: false,
          error: 'No autorizado para realizar retiros de esta empresa'
        }, { status: 403 })
      }

      // Get company details
      const companyResult = await db.query(`
        SELECT
          id,
          legalname,
          stripe_account_id,
          stripe_payouts_enabled,
          COALESCE("walletBalance"::numeric, walletbalance, 0) as wallet_balance,
          COALESCE("walletNumber", walletnumber) as wallet_number
        FROM companies
        WHERE id = $1
      `, [entityId])

      if (companyResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Empresa no encontrada'
        }, { status: 404 })
      }

      const company = companyResult.rows[0]
      stripeAccountId = company.stripe_account_id
      payoutsEnabled = company.stripe_payouts_enabled || false
      walletBalance = parseFloat(company.wallet_balance) || 0
      walletNumber = company.wallet_number
      entityName = company.legalname

    } else {
      // entityType === 'user' (for drivers)

      // Verify permissions: SUPER_ADMIN, or the user themselves
      if (payload.role !== 'SUPER_ADMIN' && payload.userId !== entityId) {
        return NextResponse.json({
          success: false,
          error: 'No autorizado. Solo puedes realizar retiros de tu propia billetera.'
        }, { status: 403 })
      }

      // Get user details
      const userResult = await db.query(`
        SELECT
          id,
          firstname,
          lastname,
          role,
          stripe_account_id,
          stripe_payouts_enabled,
          COALESCE(wallet_balance, 0) as wallet_balance,
          wallet_number
        FROM users
        WHERE id = $1
      `, [entityId])

      if (userResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Usuario no encontrado'
        }, { status: 404 })
      }

      const user = userResult.rows[0]

      // Verify user is a driver
      if (user.role !== 'DRIVER') {
        return NextResponse.json({
          success: false,
          error: 'Solo los drivers pueden realizar retiros'
        }, { status: 400 })
      }

      stripeAccountId = user.stripe_account_id
      payoutsEnabled = user.stripe_payouts_enabled || false
      walletBalance = parseFloat(user.wallet_balance) || 0
      walletNumber = user.wallet_number
      entityName = `${user.firstname} ${user.lastname}`.trim()
    }

    // Validate Stripe Connect account
    if (!stripeAccountId) {
      return NextResponse.json({
        success: false,
        error: 'No hay cuenta bancaria conectada. Por favor, conecta tu cuenta Stripe primero.'
      }, { status: 400 })
    }

    // Validate payouts are enabled
    if (!payoutsEnabled) {
      // Double-check with Stripe
      try {
        const account = await getConnectAccount(stripeAccountId)
        if (!account.payouts_enabled) {
          return NextResponse.json({
            success: false,
            error: 'Los pagos no están habilitados en tu cuenta Stripe. Por favor, completa la verificación de tu cuenta.'
          }, { status: 400 })
        }
        // Update local status if it's now enabled
        if (entityType === 'company') {
          await db.query(`UPDATE companies SET stripe_payouts_enabled = true WHERE id = $1`, [entityId])
        } else {
          await db.query(`UPDATE users SET stripe_payouts_enabled = true WHERE id = $1`, [entityId])
        }
      } catch (err) {
        return NextResponse.json({
          success: false,
          error: 'Error verificando cuenta Stripe. Por favor, intenta más tarde.'
        }, { status: 400 })
      }
    }

    // Validate sufficient balance
    if (walletBalance < amountNum) {
      return NextResponse.json({
        success: false,
        error: `Saldo insuficiente. Balance disponible: $${walletBalance.toFixed(2)}`
      }, { status: 400 })
    }

    // No fee for cashouts as per requirements
    const fee = 0
    const netAmount = amountNum

    // Generate reference numbers
    const payoutNumber = generatePayoutNumber()
    const transactionNumber = generateTransactionNumber()

    // Start database transaction
    await db.query('BEGIN')

    try {
      // 1. Deduct from wallet
      if (entityType === 'company') {
        await db.query(`
          UPDATE companies
          SET
            walletbalance = COALESCE(walletbalance, 0) - $1,
            "walletBalance" = (COALESCE("walletBalance"::numeric, walletbalance, 0) - $1)::varchar
          WHERE id = $2
        `, [amountNum, entityId])
      } else {
        await db.query(`
          UPDATE users
          SET wallet_balance = COALESCE(wallet_balance, 0) - $1
          WHERE id = $2
        `, [amountNum, entityId])
      }

      // 2. Create wallet transaction (type: cashout)
      const txResult = await db.query(`
        INSERT INTO wallet_transactions (
          transaction_number,
          type,
          source_type,
          source_company_id,
          source_user_id,
          source_wallet_number,
          target_type,
          amount,
          net_amount,
          fee,
          payment_method,
          status,
          description,
          created_by_name,
          created_at,
          updated_at
        ) VALUES (
          $1,
          'cashout',
          $2,
          $3,
          $4,
          $5,
          'external',
          $6,
          $7,
          $8,
          'stripe_connect',
          'pending',
          $9,
          $10,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        RETURNING id
      `, [
        transactionNumber,
        entityType,
        entityType === 'company' ? entityId : null,
        entityType === 'user' ? entityId : null,
        walletNumber,
        amountNum,
        netAmount,
        fee,
        `Retiro a cuenta bancaria - ${entityName}`,
        payload.email
      ])

      const transactionId = txResult.rows[0].id

      // 3. Create payout record
      await db.query(`
        INSERT INTO wallet_payouts (
          entity_type,
          company_id,
          user_id,
          wallet_number,
          amount,
          fee,
          net_amount,
          currency,
          stripe_account_id,
          status,
          requested_by,
          requested_by_name,
          transaction_id,
          created_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          'USD',
          $8,
          'processing',
          $9,
          $10,
          $11,
          CURRENT_TIMESTAMP
        )
        RETURNING id
      `, [
        entityType,
        entityType === 'company' ? entityId : null,
        entityType === 'user' ? entityId : null,
        walletNumber,
        amountNum,
        fee,
        netAmount,
        stripeAccountId,
        payload.userId,
        `${payload.companyName} - ${payload.email}`,
        transactionId
      ])

      // 4. Create Stripe Transfer to Connected Account
      let transfer
      try {
        transfer = await createPayout({
          accountId: stripeAccountId,
          amount: netAmount,
          description: `Retiro LogiRapid - ${payoutNumber}`
        })
      } catch (stripeError: any) {
        // Stripe error - rollback
        await db.query('ROLLBACK')
        console.error('Stripe transfer error:', stripeError)

        return NextResponse.json({
          success: false,
          error: stripeError.message || 'Error al procesar el retiro con Stripe'
        }, { status: 500 })
      }

      // 5. Update payout with Stripe transfer ID
      await db.query(`
        UPDATE wallet_payouts
        SET
          stripe_transfer_id = $1,
          status = 'paid',
          processed_at = CURRENT_TIMESTAMP,
          paid_at = CURRENT_TIMESTAMP
        WHERE transaction_id = $2
      `, [transfer.id, transactionId])

      // 6. Update transaction status to completed
      await db.query(`
        UPDATE wallet_transactions
        SET
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          stripe_payment_intent_id = $1
        WHERE id = $2
      `, [transfer.id, transactionId])

      // Commit transaction
      await db.query('COMMIT')

      // Get updated balance
      let newBalance = 0
      if (entityType === 'company') {
        const balanceResult = await db.query(`
          SELECT COALESCE("walletBalance"::numeric, walletbalance, 0) as balance
          FROM companies WHERE id = $1
        `, [entityId])
        newBalance = parseFloat(balanceResult.rows[0]?.balance) || 0
      } else {
        const balanceResult = await db.query(`
          SELECT COALESCE(wallet_balance, 0) as balance
          FROM users WHERE id = $1
        `, [entityId])
        newBalance = parseFloat(balanceResult.rows[0]?.balance) || 0
      }

      return NextResponse.json({
        success: true,
        data: {
          payoutNumber,
          transactionNumber,
          amount: amountNum,
          fee,
          netAmount,
          newBalance,
          entityName,
          walletNumber,
          stripeTransferId: transfer.id,
          status: 'paid',
          message: 'Retiro procesado exitosamente. Los fondos serán depositados en tu cuenta bancaria.'
        }
      })

    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('Error processing cashout:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar el retiro'
    }, { status: 500 })
  }
}
