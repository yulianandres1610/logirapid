import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import {
  getTerminalCheckoutStatus,
  getPaymentDetails,
  getPlatformCredentials,
  centsToDollars,
  SquareCredentials
} from '@/lib/square'
import { sendWalletNotificationSMS } from '@/lib/sms-service'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/wallet/recharge/terminal/[checkoutId]/status
 * Get the status of a terminal checkout for polling
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     checkoutId: string,
 *     status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed',
 *     transactionId: number,
 *     transactionNumber: string,
 *     paymentId?: string,
 *     receiptUrl?: string,
 *     newBalance?: number
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ checkoutId: string }> }
) {
  try {
    const { checkoutId } = await params

    // Verify authentication
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Find transaction by checkout ID in metadata
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
        wt.payment_reference,
        wt.completed_at,
        pt.company_id as terminal_company_id,
        pt.device_id
      FROM wallet_transactions wt
      LEFT JOIN payment_terminals pt ON wt.terminal_id = pt.id
      WHERE wt.metadata->>'checkoutId' = $1
    `, [checkoutId])

    if (txResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Transaccion no encontrada para este checkout'
      }, { status: 404 })
    }

    const tx = txResult.rows[0]

    // If already completed or failed, just return DB status
    if (tx.status === 'completed' || tx.status === 'failed' || tx.status === 'cancelled') {
      const canRetry = tx.status === 'failed' || tx.status === 'cancelled'
      return NextResponse.json({
        success: true,
        data: {
          checkoutId,
          status: tx.status,
          transactionId: tx.id,
          transactionNumber: tx.transaction_number,
          paymentId: tx.payment_reference,
          newBalance: tx.status === 'completed' ? tx.metadata?.newBalance : undefined,
          canRetry,
          canCancel: false
        }
      })
    }

    // Get Square credentials
    let credentials: SquareCredentials | null = null

    if (tx.terminal_company_id === null) {
      credentials = getPlatformCredentials()
    } else {
      const settingsResult = await db.query(`
        SELECT
          square_access_token,
          square_location_id,
          square_environment
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

    if (!credentials) {
      return NextResponse.json({
        success: false,
        error: 'No se pudieron obtener credenciales de Square'
      }, { status: 400 })
    }

    // Get checkout status from Square
    const checkoutStatus = await getTerminalCheckoutStatus(credentials, checkoutId)

    if (!checkoutStatus.success || !checkoutStatus.status) {
      return NextResponse.json({
        success: false,
        error: checkoutStatus.error || 'Error al obtener estado del checkout'
      }, { status: 400 })
    }

    const squareStatus = checkoutStatus.status.status

    // Map Square status to our status
    let ourStatus: string = 'processing'
    if (squareStatus === 'COMPLETED') {
      ourStatus = 'completed'
    } else if (squareStatus === 'CANCELED') {
      ourStatus = 'cancelled'
    } else if (squareStatus === 'CANCEL_REQUESTED') {
      ourStatus = 'cancelling'
    } else if (squareStatus === 'IN_PROGRESS') {
      ourStatus = 'in_progress'
    } else if (squareStatus === 'PENDING') {
      ourStatus = 'pending'
    }

    // If checkout completed, process the payment
    if (squareStatus === 'COMPLETED' && checkoutStatus.status.paymentIds?.length) {
      const paymentId = checkoutStatus.status.paymentIds[0]

      // Get payment details
      const paymentDetails = await getPaymentDetails(credentials, paymentId)

      // Update wallet balance
      const amount = parseFloat(tx.amount)

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

        // Update transaction
        await client.query(`
          UPDATE wallet_transactions
          SET
            status = 'completed',
            payment_reference = $1,
            completed_at = NOW(),
            metadata = metadata || $2
          WHERE id = $3
        `, [
          paymentId,
          JSON.stringify({
            newBalance,
            receiptUrl: paymentDetails.payment?.receiptUrl,
            cardBrand: paymentDetails.payment?.cardDetails?.card.cardBrand,
            cardLast4: paymentDetails.payment?.cardDetails?.card.last4,
            squareStatus
          }),
          tx.id
        ])
      })

      // Get updated transaction
      const updatedTx = await db.query(`
        SELECT metadata FROM wallet_transactions WHERE id = $1
      `, [tx.id])

      const finalNewBalance = updatedTx.rows[0]?.metadata?.newBalance

      // Send SMS notification (async, don't block response)
      // Get target phone for notification
      let targetPhone: string | null = null
      let targetName: string = ''

      if (tx.target_type === 'company') {
        const phoneResult = await db.query('SELECT phone, legalname FROM companies WHERE id = $1', [tx.target_company_id])
        if (phoneResult.rows[0]) {
          targetPhone = phoneResult.rows[0].phone
          targetName = phoneResult.rows[0].legalname
        }
      } else if (tx.target_type === 'user') {
        const phoneResult = await db.query("SELECT phone, CONCAT(firstname, ' ', lastname) as name FROM users WHERE id = $1", [tx.target_user_id])
        if (phoneResult.rows[0]) {
          targetPhone = phoneResult.rows[0].phone
          targetName = phoneResult.rows[0].name
        }
      } else if (tx.target_type === 'customer') {
        const phoneResult = await db.query("SELECT phone, CONCAT(firstname, ' ', lastname) as name FROM customers WHERE id = $1", [tx.target_customer_id])
        if (phoneResult.rows[0]) {
          targetPhone = phoneResult.rows[0].phone
          targetName = phoneResult.rows[0].name
        }
      }

      if (targetPhone) {
        sendWalletNotificationSMS(
          targetPhone,
          'recharge',
          targetName,
          amount,
          finalNewBalance,
          { paymentMethod: 'terminal', transactionNumber: tx.transaction_number }
        ).then(result => {
          if (result.success) {
            console.log('[Terminal Status] SMS notification sent:', result.messageId)
          } else {
            console.log('[Terminal Status] SMS notification failed:', result.error)
          }
        }).catch(err => console.error('[Terminal Status] SMS notification error:', err))
      }

      return NextResponse.json({
        success: true,
        data: {
          checkoutId,
          status: 'completed',
          transactionId: tx.id,
          transactionNumber: tx.transaction_number,
          paymentId,
          receiptUrl: paymentDetails.payment?.receiptUrl,
          newBalance: finalNewBalance,
          cardBrand: paymentDetails.payment?.cardDetails?.card.cardBrand,
          cardLast4: paymentDetails.payment?.cardDetails?.card.last4,
          canRetry: false,
          canCancel: false
        }
      })
    }

    // If cancelled, update transaction
    if (squareStatus === 'CANCELED') {
      await db.query(`
        UPDATE wallet_transactions
        SET
          status = 'cancelled',
          metadata = metadata || $1
        WHERE id = $2
      `, [JSON.stringify({
        cancelReason: checkoutStatus.status.cancelReason,
        squareStatus
      }), tx.id])
    }

    // Determine if can cancel (pending, in_progress) or retry (cancelled)
    const canCancel = ['pending', 'in_progress', 'processing'].includes(ourStatus)
    const canRetry = ourStatus === 'cancelled'

    return NextResponse.json({
      success: true,
      data: {
        checkoutId,
        status: ourStatus,
        transactionId: tx.id,
        transactionNumber: tx.transaction_number,
        squareStatus,
        canRetry,
        canCancel
      }
    })

  } catch (error) {
    console.error('Error checking terminal checkout status:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al verificar estado'
    }, { status: 500 })
  }
}
