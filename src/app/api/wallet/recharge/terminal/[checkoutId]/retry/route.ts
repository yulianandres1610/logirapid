import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import {
  createSquareOrder,
  createTerminalCheckout,
  getPlatformCredentials,
  calculateTerminalFee,
  dollarsToCents,
  SquareCredentials
} from '@/lib/square'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/wallet/recharge/terminal/[checkoutId]/retry
 * Retry a failed or cancelled terminal checkout
 * Creates a new checkout with the same transaction data
 */
export async function POST(
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

    // Find the original transaction
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
        wt.description,
        wt.metadata,
        pt.company_id as terminal_company_id,
        pt.device_id,
        pt.name as terminal_name,
        pt.location_name,
        pt.status as terminal_status
      FROM wallet_transactions wt
      LEFT JOIN payment_terminals pt ON wt.terminal_id = pt.id
      WHERE wt.metadata->>'checkoutId' = $1
    `, [checkoutId])

    if (txResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Transaccion no encontrada'
      }, { status: 404 })
    }

    const tx = txResult.rows[0]

    // Check if transaction can be retried
    if (tx.status === 'completed') {
      return NextResponse.json({
        success: false,
        error: 'Esta transaccion ya fue completada'
      }, { status: 400 })
    }

    if (tx.status === 'processing') {
      return NextResponse.json({
        success: false,
        error: 'Esta transaccion aun esta en proceso. Espere o cancele primero.'
      }, { status: 400 })
    }

    // Check terminal is still available
    if (tx.terminal_status !== 'paired') {
      return NextResponse.json({
        success: false,
        error: 'El terminal no esta disponible'
      }, { status: 400 })
    }

    if (!tx.device_id) {
      return NextResponse.json({
        success: false,
        error: 'El terminal no tiene device_id configurado'
      }, { status: 400 })
    }

    // Get Square credentials
    let credentials: SquareCredentials | null = null

    if (tx.terminal_company_id === null) {
      credentials = getPlatformCredentials()
      if (!credentials) {
        return NextResponse.json({
          success: false,
          error: 'Square de plataforma no esta configurado'
        }, { status: 400 })
      }
    } else {
      const settingsResult = await db.query(`
        SELECT square_access_token, square_location_id, square_environment, square_configured
        FROM company_payment_settings
        WHERE company_id = $1
      `, [tx.terminal_company_id])

      const settings = settingsResult.rows[0]
      if (!settings || !settings.square_configured) {
        return NextResponse.json({
          success: false,
          error: 'Square no esta configurado para la empresa del terminal'
        }, { status: 400 })
      }

      credentials = {
        accessToken: settings.square_access_token,
        locationId: settings.square_location_id,
        environment: settings.square_environment || 'sandbox'
      }
    }

    const amount = parseFloat(tx.amount)
    const feeCalc = calculateTerminalFee(amount)
    const isPlatformTerminal = tx.terminal_company_id === null

    // Generate new transaction number for retry
    const retryNumber = `${tx.transaction_number}-R${Date.now().toString(36).toUpperCase()}`

    console.log('[Terminal Retry] Retrying transaction:', tx.transaction_number, '-> new:', retryNumber)

    // Create new Square Order
    const orderResult = await createSquareOrder(credentials, {
      transactionNumber: retryNumber,
      amount: dollarsToCents(amount),
      appFee: dollarsToCents(feeCalc.fee),
      description: `Wallet Recharge Retry - ${retryNumber}`,
      isPlatformTerminal
    })

    if (!orderResult.success || !orderResult.orderId) {
      return NextResponse.json({
        success: false,
        error: orderResult.error || 'Error al crear orden en Square'
      }, { status: 400 })
    }

    console.log('[Terminal Retry] Created Square order:', orderResult.orderId)

    // Create Terminal Checkout
    const checkoutResult = await createTerminalCheckout(credentials, {
      orderId: orderResult.orderId,
      deviceId: tx.device_id,
      amount: dollarsToCents(amount),
      appFee: dollarsToCents(feeCalc.fee),
      collectSignature: true,
      skipReceipt: false,
      note: `Recarga Wallet (Reintento) - ${retryNumber}`,
      isPlatformTerminal
    })

    if (!checkoutResult.success || !checkoutResult.checkoutId) {
      return NextResponse.json({
        success: false,
        error: checkoutResult.error || 'Error al crear checkout en terminal'
      }, { status: 400 })
    }

    console.log('[Terminal Retry] Created terminal checkout:', checkoutResult.checkoutId)

    // Update the original transaction with new checkout info
    await db.query(`
      UPDATE wallet_transactions
      SET
        status = 'processing',
        metadata = metadata || $1
      WHERE id = $2
    `, [JSON.stringify({
      retryCheckoutId: checkoutResult.checkoutId,
      retryOrderId: orderResult.orderId,
      retryNumber,
      retriedAt: new Date().toISOString(),
      retriedBy: payload.email,
      previousCheckoutId: checkoutId
    }), tx.id])

    // Also update the checkoutId reference so status polling works
    await db.query(`
      UPDATE wallet_transactions
      SET metadata = jsonb_set(metadata, '{checkoutId}', $1::jsonb)
      WHERE id = $2
    `, [JSON.stringify(checkoutResult.checkoutId), tx.id])

    return NextResponse.json({
      success: true,
      message: 'Pago reenviado al terminal. Esperando pago...',
      data: {
        checkoutId: checkoutResult.checkoutId,
        transactionId: tx.id,
        transactionNumber: tx.transaction_number,
        retryNumber,
        amount,
        fee: feeCalc.fee,
        totalAmount: feeCalc.total,
        status: 'processing',
        deviceId: tx.device_id,
        terminalName: tx.terminal_name
      }
    })

  } catch (error) {
    console.error('Error retrying terminal checkout:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al reintentar pago'
    }, { status: 500 })
  }
}
