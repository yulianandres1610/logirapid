import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db } from '@/lib/database'
import { getSquareBaseUrl, getPlatformCredentials, calculateTerminalFee } from '@/lib/square'
import { sendWalletNotificationSMS } from '@/lib/sms-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * POST /api/wallet/recharge/card
 * Process wallet recharge with tokenized card from Square Web Payments SDK
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'your-secret-key'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    // 2. Validate body
    const body = await request.json()
    const { sourceId, amount, targetWalletNumber, targetType } = body

    console.log('[Card Payment] Request:', { sourceId: sourceId?.substring(0, 20), amount, targetWalletNumber, targetType })

    if (!sourceId || !amount || !targetWalletNumber || !targetType) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 })
    }

    if (amount <= 0) {
      return NextResponse.json({ success: false, error: 'Monto debe ser mayor a 0' }, { status: 400 })
    }

    // 3. Find target wallet and get current balance
    let targetId: number | null = null
    let currentBalance = 0
    let targetName = ''
    let targetPhone: string | null = null

    if (targetType === 'company') {
      const result = await db.query(
        `SELECT id, legalname, walletbalance, phone FROM companies WHERE walletnumber = $1`,
        [targetWalletNumber]
      )
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Wallet no encontrado' }, { status: 404 })
      }
      targetId = result.rows[0].id
      currentBalance = parseFloat(result.rows[0].walletbalance || '0')
      targetName = result.rows[0].legalname
      targetPhone = result.rows[0].phone
    } else if (targetType === 'user') {
      const result = await db.query(
        `SELECT id, firstname, lastname, wallet_balance, phone FROM users WHERE wallet_number = $1`,
        [targetWalletNumber]
      )
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Wallet no encontrado' }, { status: 404 })
      }
      targetId = result.rows[0].id
      currentBalance = parseFloat(result.rows[0].wallet_balance || '0')
      targetName = `${result.rows[0].firstname} ${result.rows[0].lastname}`
      targetPhone = result.rows[0].phone
    } else if (targetType === 'customer') {
      const result = await db.query(
        `SELECT id, firstname, lastname, wallet_balance, phone FROM customers WHERE wallet_number = $1`,
        [targetWalletNumber]
      )
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Wallet no encontrado' }, { status: 404 })
      }
      targetId = result.rows[0].id
      currentBalance = parseFloat(result.rows[0].wallet_balance || '0')
      targetName = `${result.rows[0].firstname} ${result.rows[0].lastname}`
      targetPhone = result.rows[0].phone
    }

    console.log('[Card Payment] Target:', { targetId, targetName, currentBalance, targetPhone })

    // 4. Calculate fee (3.5%)
    const feeCalc = calculateTerminalFee(amount)
    console.log('[Card Payment] Fee calculation:', { amount, fee: feeCalc.fee, total: feeCalc.total })

    // 5. Get Square credentials
    const credentials = getPlatformCredentials()
    if (!credentials) {
      console.error('[Card Payment] Square credentials not configured')
      return NextResponse.json({ success: false, error: 'Square no configurado' }, { status: 500 })
    }

    // 6. Generate transaction number
    const transactionNumber = `WTX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // 7. Create transaction with 'processing' status
    const txResult = await db.query(`
      INSERT INTO wallet_transactions (
        transaction_number, type, source_type,
        target_type, target_company_id, target_user_id, target_customer_id, target_wallet_number,
        amount, fee, net_amount, currency,
        payment_method, status, requires_approval,
        description, created_by, created_by_name, created_at,
        metadata
      ) VALUES (
        $1, 'recharge', 'external',
        $2, $3, $4, $5, $6,
        $7, $8, $7, 'USD',
        'card_manual', 'processing', false,
        $9, $10, $11, NOW(),
        $12
      ) RETURNING id
    `, [
      transactionNumber,
      targetType,
      targetType === 'company' ? targetId : null,
      targetType === 'user' ? targetId : null,
      targetType === 'customer' ? targetId : null,
      targetWalletNumber,
      amount,
      feeCalc.fee,
      `Recarga con tarjeta para ${targetName} (Fee: $${feeCalc.fee.toFixed(2)})`,
      payload.userId,
      payload.email,
      JSON.stringify({ previousBalance: currentBalance, targetName, fee: feeCalc.fee, totalCharged: feeCalc.total })
    ])

    const transactionId = txResult.rows[0].id
    console.log('[Card Payment] Transaction created:', { transactionId, transactionNumber })

    // 8. Call Square CreatePayment API
    const baseUrl = getSquareBaseUrl(credentials.environment)
    const idempotencyKey = crypto.randomUUID()

    // Charge the TOTAL amount (base amount + 3.5% fee)
    const paymentRequest = {
      source_id: sourceId,
      amount_money: {
        amount: feeCalc.totalCents, // Total amount in cents (includes 3.5% fee)
        currency: 'USD'
      },
      location_id: credentials.locationId,
      idempotency_key: idempotencyKey,
      autocomplete: true,
      reference_id: transactionNumber,
      note: `Wallet Recharge - ${transactionNumber} (Amount: $${amount.toFixed(2)} + Fee: $${feeCalc.fee.toFixed(2)})`
    }

    console.log('[Card Payment] Calling Square API:', {
      url: `${baseUrl}/v2/payments`,
      baseAmount: amount,
      fee: feeCalc.fee,
      totalAmount: feeCalc.total,
      totalCents: feeCalc.totalCents,
      locationId: credentials.locationId
    })

    const paymentResponse = await fetch(`${baseUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': '2025-01-16',
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentRequest)
    })

    const paymentData = await paymentResponse.json()

    if (!paymentResponse.ok) {
      // Payment failed - update transaction
      await db.query(`
        UPDATE wallet_transactions
        SET status = 'failed', metadata = metadata || $1, updated_at = NOW()
        WHERE id = $2
      `, [JSON.stringify({ squareError: paymentData.errors }), transactionId])

      console.error('[Card Payment] Square error:', paymentData.errors)
      return NextResponse.json({
        success: false,
        error: paymentData.errors?.[0]?.detail || 'Error al procesar pago'
      }, { status: 400 })
    }

    const payment = paymentData.payment
    console.log('[Card Payment] Square payment successful:', {
      paymentId: payment.id,
      status: payment.status,
      cardBrand: payment.card_details?.card?.card_brand,
      last4: payment.card_details?.card?.last_4
    })

    // 9. Update wallet balance (credit only the base amount, not the fee)
    const newBalance = currentBalance + amount

    if (targetType === 'company') {
      await db.query(`UPDATE companies SET walletbalance = walletbalance + $1 WHERE id = $2`, [amount, targetId])
    } else if (targetType === 'user') {
      await db.query(`UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`, [amount, targetId])
    } else if (targetType === 'customer') {
      await db.query(`UPDATE customers SET wallet_balance = wallet_balance + $1 WHERE id = $2`, [amount, targetId])
    }

    // 10. Update transaction as completed
    await db.query(`
      UPDATE wallet_transactions
      SET
        status = 'completed',
        payment_reference = $1,
        completed_at = NOW(),
        updated_at = NOW(),
        metadata = metadata || $2
      WHERE id = $3
    `, [
      payment.id,
      JSON.stringify({
        newBalance,
        squarePaymentId: payment.id,
        cardBrand: payment.card_details?.card?.card_brand,
        cardLast4: payment.card_details?.card?.last_4,
        receiptUrl: payment.receipt_url
      }),
      transactionId
    ])

    console.log('[Card Payment] Success:', { transactionId, newBalance })

    // 11. Send SMS notification (async, don't block response)
    if (targetPhone) {
      sendWalletNotificationSMS(
        targetPhone,
        'recharge',
        targetName,
        amount,
        newBalance,
        { paymentMethod: 'card_manual', transactionNumber }
      ).then(result => {
        if (result.success) {
          console.log('[Card Payment] SMS notification sent:', result.messageId)
        } else {
          console.log('[Card Payment] SMS notification failed:', result.error)
        }
      }).catch(err => {
        console.error('[Card Payment] SMS notification error:', err)
      })
    }

    // 12. Return success
    return NextResponse.json({
      success: true,
      message: 'Pago procesado exitosamente',
      data: {
        paymentId: payment.id,
        transactionId,
        transactionNumber,
        amount,
        fee: feeCalc.fee,
        totalCharged: feeCalc.total,
        cardBrand: payment.card_details?.card?.card_brand || 'CARD',
        cardLast4: payment.card_details?.card?.last_4 || '****',
        receiptUrl: payment.receipt_url,
        newBalance
      }
    })

  } catch (error) {
    console.error('[Card Payment] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar pago'
    }, { status: 500 })
  }
}
