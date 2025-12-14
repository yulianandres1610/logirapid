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

    // Get order with lock to prevent race conditions
    const orderResult = await db.query(`
      SELECT * FROM cash_delivery_orders
      WHERE id = $1 AND broker_company_id = $2
      FOR UPDATE
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
    // Get or create wallet balance for broker
    await db.query(`
      INSERT INTO broker_wallet_balances (company_id, currency, available_balance, reserved_balance)
      VALUES ($1, $2, 0, 0)
      ON CONFLICT (company_id, currency) DO NOTHING
    `, [brokerCompanyId, order.currency])

    // Get current balance
    const balanceResult = await db.query(`
      SELECT available_balance, reserved_balance
      FROM broker_wallet_balances
      WHERE company_id = $1 AND currency = $2
      FOR UPDATE
    `, [brokerCompanyId, order.currency])

    const balanceBefore = parseFloat(balanceResult.rows[0].available_balance) || 0
    const amountToAdd = parseFloat(order.total_amount)
    const balanceAfter = balanceBefore + amountToAdd

    // Update wallet balance
    await db.query(`
      UPDATE broker_wallet_balances
      SET
        available_balance = $1,
        last_updated = NOW()
      WHERE company_id = $2 AND currency = $3
    `, [balanceAfter, brokerCompanyId, order.currency])

    // Create transaction record
    const transactionResult = await db.query(`
      INSERT INTO broker_wallet_transactions (
        broker_company_id, currency, transaction_type, amount,
        balance_before, balance_after, reserved_before, reserved_after,
        reference_type, reference_id, notes, created_by
      ) VALUES ($1, $2, 'deposit', $3, $4, $5, $6, $6, 'cash_delivery', $7, $8, $9)
      RETURNING id
    `, [
      brokerCompanyId,
      order.currency,
      amountToAdd,
      balanceBefore,
      balanceAfter,
      parseFloat(balanceResult.rows[0].reserved_balance) || 0,
      orderId,
      `Depósito de efectivo - Orden ${order.order_number}`,
      userId ? parseInt(userId) : null
    ])

    // Update order as completed
    await db.query(`
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

    return NextResponse.json({
      success: true,
      message: 'Efectivo recibido exitosamente. Wallet acreditado.',
      data: {
        status: 'completed',
        orderNumber: order.order_number,
        walletBalance: {
          currency: order.currency,
          balanceBefore,
          amountAdded: amountToAdd,
          newBalance: balanceAfter
        }
      }
    })

  } catch (error: any) {
    console.error('[Confirm API] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al confirmar la recepción'
    }, { status: 500 })
  }
}
