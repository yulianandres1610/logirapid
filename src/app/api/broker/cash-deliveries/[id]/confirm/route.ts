import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import { OTP_MAX_ATTEMPTS } from '@/lib/sms-service'

// POST - Confirm reception with OTP
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value
    const userId = cookieStore.get('user-id')?.value
    const userEmail = cookieStore.get('user-email')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const orderId = parseInt(id)
    const brokerCompanyId = parseInt(companyId)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    const body = await request.json()
    const { otpCode } = body

    if (!otpCode || typeof otpCode !== 'string' || otpCode.length !== 6) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere un código OTP de 6 dígitos'
      }, { status: 400 })
    }

    // Get order
    const orderResult = await db.query(`
      SELECT * FROM cash_delivery_orders
      WHERE id = $1 AND broker_company_id = $2
    `, [orderId, brokerCompanyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Check status
    if (order.status !== 'validating') {
      return NextResponse.json({
        success: false,
        error: `No se puede confirmar una orden en estado: ${order.status}`
      }, { status: 400 })
    }

    // Check if blocked
    if (order.otp_attempts >= OTP_MAX_ATTEMPTS) {
      // Update to blocked status
      await db.query(`
        UPDATE cash_delivery_orders
        SET status = 'blocked', updated_at = NOW()
        WHERE id = $1
      `, [orderId])

      return NextResponse.json({
        success: false,
        error: 'Demasiados intentos fallidos. Orden bloqueada. Contacte al administrador.'
      }, { status: 400 })
    }

    // Check expiration
    if (order.otp_expires_at && new Date() > new Date(order.otp_expires_at)) {
      return NextResponse.json({
        success: false,
        error: 'Código OTP expirado. Por favor solicite uno nuevo.'
      }, { status: 400 })
    }

    // Verify OTP
    if (otpCode !== order.otp_code) {
      // Increment attempts
      const newAttempts = (order.otp_attempts || 0) + 1
      await db.query(`
        UPDATE cash_delivery_orders
        SET otp_attempts = $1, updated_at = NOW()
        WHERE id = $2
      `, [newAttempts, orderId])

      const remainingAttempts = OTP_MAX_ATTEMPTS - newAttempts

      if (remainingAttempts <= 0) {
        await db.query(`
          UPDATE cash_delivery_orders
          SET status = 'blocked', updated_at = NOW()
          WHERE id = $1
        `, [orderId])

        return NextResponse.json({
          success: false,
          error: 'Código incorrecto. Orden bloqueada por demasiados intentos.'
        }, { status: 400 })
      }

      return NextResponse.json({
        success: false,
        error: `Código OTP incorrecto. ${remainingAttempts} intento${remainingAttempts !== 1 ? 's' : ''} restante${remainingAttempts !== 1 ? 's' : ''}.`
      }, { status: 400 })
    }

    // OTP is correct - complete the delivery and credit wallet
    const amountToAdd = parseFloat(order.total_amount)
    const currency = order.currency || 'USD'

    // Use transaction to ensure atomicity
    const result = await db.transaction(async (client) => {
      // Get current broker info
      const brokerResult = await client.query(`
        SELECT
          id,
          legalname,
          COALESCE("walletNumber", walletnumber) as wallet_number
        FROM companies
        WHERE id = $1
        FOR UPDATE
      `, [brokerCompanyId])

      if (brokerResult.rows.length === 0) {
        throw new Error('Broker no encontrado')
      }

      const broker = brokerResult.rows[0]
      const walletNumber = broker.wallet_number

      // Get or create currency-specific balance in broker_wallet_balances
      let currencyBalanceResult = await client.query(`
        SELECT id, available_balance
        FROM broker_wallet_balances
        WHERE company_id = $1 AND currency = $2
        FOR UPDATE
      `, [brokerCompanyId, currency])

      let balanceBefore = 0
      let balanceAfter = 0

      if (currencyBalanceResult.rows.length === 0) {
        // Create new currency balance entry
        await client.query(`
          INSERT INTO broker_wallet_balances (company_id, currency, available_balance, reserved_balance)
          VALUES ($1, $2, $3, 0)
        `, [brokerCompanyId, currency, amountToAdd])
        balanceBefore = 0
        balanceAfter = amountToAdd
      } else {
        // Update existing balance
        balanceBefore = parseFloat(currencyBalanceResult.rows[0].available_balance) || 0
        balanceAfter = balanceBefore + amountToAdd

        await client.query(`
          UPDATE broker_wallet_balances
          SET available_balance = available_balance + $1
          WHERE company_id = $2 AND currency = $3
        `, [amountToAdd, brokerCompanyId, currency])
      }

      // Also update company wallet balance for backwards compatibility (total across all currencies)
      await client.query(`
        UPDATE companies
        SET
          walletbalance = COALESCE(walletbalance, 0) + $1,
          "walletBalance" = (COALESCE("walletBalance"::numeric, walletbalance, 0) + $1)::varchar
        WHERE id = $2
      `, [amountToAdd, brokerCompanyId])

      // Create transaction record in wallet_transactions
      const transactionResult = await client.query(`
        INSERT INTO wallet_transactions (
          type,
          source_type,
          target_type,
          target_company_id,
          target_wallet_number,
          amount,
          fee,
          net_amount,
          currency,
          payment_method,
          status,
          requires_approval,
          description,
          notes,
          created_by,
          created_by_name,
          completed_at
        ) VALUES (
          'deposit',
          'cash_delivery',
          'company',
          $1,
          $2,
          $3,
          0,
          $3,
          $4,
          'cash',
          'completed',
          false,
          $5,
          $6,
          $7,
          $8,
          NOW()
        ) RETURNING id, transaction_number
      `, [
        brokerCompanyId,
        walletNumber,
        amountToAdd,
        currency,
        `Depósito de efectivo (${currency}) - Orden ${order.order_number}`,
        `Entrega de efectivo recibida del repartidor`,
        userId ? parseInt(userId) : null,
        userEmail || 'Sistema'
      ])

      // Update order as completed
      await client.query(`
        UPDATE cash_delivery_orders
        SET
          status = 'completed',
          completed_at = NOW(),
          completed_by_user_id = $1,
          wallet_transaction_id = $2,
          otp_code = NULL,
          updated_at = NOW()
        WHERE id = $3
      `, [userId ? parseInt(userId) : null, transactionResult.rows[0].id, orderId])

      return {
        currency,
        balanceBefore,
        balanceAfter,
        transactionId: transactionResult.rows[0].id,
        transactionNumber: transactionResult.rows[0].transaction_number
      }
    })

    console.log(`[Confirm API] Cash delivery ${orderId} completed. Balance: ${result.balanceBefore} -> ${result.balanceAfter}`)

    return NextResponse.json({
      success: true,
      message: 'Efectivo recibido exitosamente. Wallet acreditado.',
      data: {
        status: 'completed',
        orderNumber: order.order_number,
        transactionNumber: result.transactionNumber,
        walletBalance: {
          currency,
          balanceBefore: result.balanceBefore,
          amountAdded: amountToAdd,
          newBalance: result.balanceAfter,
          newBalanceFormatted: `$${result.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        }
      }
    })

  } catch (error: any) {
    console.error('[Confirm API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error al confirmar la recepción'
    }, { status: 500 })
  }
}
