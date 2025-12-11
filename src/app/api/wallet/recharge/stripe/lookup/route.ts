import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/wallet/recharge/stripe/lookup?paymentIntentId=pi_xxx
 *
 * Look up a completed wallet recharge by Stripe PaymentIntentId.
 * Used when user returns from redirect-based payment (Klarna, Affirm, etc.)
 * to display the receipt after webhook has processed the payment.
 */
export async function GET(request: NextRequest) {
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    // Get paymentIntentId from query params
    const searchParams = request.nextUrl.searchParams
    const paymentIntentId = searchParams.get('paymentIntentId')

    if (!paymentIntentId) {
      return NextResponse.json({
        success: false,
        error: 'paymentIntentId es requerido'
      }, { status: 400 })
    }

    // Look up transaction by payment intent id
    const result = await db.query(`
      SELECT
        wt.transaction_number,
        wt.amount,
        wt.fee,
        wt.total_charged,
        wt.card_brand,
        wt.card_last4,
        wt.target_type,
        wt.target_company_id,
        wt.target_user_id,
        wt.target_customer_id,
        wt.target_wallet_number,
        wt.status,
        wt.metadata,
        wt.created_at,
        c.legalname as company_name,
        c.phone as company_phone,
        COALESCE(c."walletBalance"::numeric, c.walletbalance, 0) as company_balance,
        u.firstname as user_firstname,
        u.lastname as user_lastname,
        u.phone as user_phone,
        u.wallet_balance as user_balance,
        cu.firstname as customer_firstname,
        cu.lastname as customer_lastname,
        cu.phone as customer_phone,
        cu.wallet_balance as customer_balance
      FROM wallet_transactions wt
      LEFT JOIN companies c ON wt.target_company_id = c.id
      LEFT JOIN users u ON wt.target_user_id = u.id
      LEFT JOIN customers cu ON wt.target_customer_id = cu.id
      WHERE wt.stripe_payment_intent_id = $1
    `, [paymentIntentId])

    if (result.rows.length === 0) {
      // Transaction not found - might still be processing
      return NextResponse.json({
        success: false,
        error: 'Transaccion no encontrada',
        code: 'NOT_FOUND'
      }, { status: 404 })
    }

    const txn = result.rows[0]

    // Determine recipient info based on target type
    let recipientName: string
    let recipientPhone: string | null
    let newBalance: number

    if (txn.target_type === 'company') {
      recipientName = txn.company_name || 'Empresa'
      recipientPhone = txn.company_phone
      newBalance = parseFloat(txn.company_balance || 0)
    } else if (txn.target_type === 'user') {
      recipientName = `${txn.user_firstname || ''} ${txn.user_lastname || ''}`.trim() || 'Usuario'
      recipientPhone = txn.user_phone
      newBalance = parseFloat(txn.user_balance || 0)
    } else if (txn.target_type === 'customer') {
      recipientName = `${txn.customer_firstname || ''} ${txn.customer_lastname || ''}`.trim() || 'Cliente'
      recipientPhone = txn.customer_phone
      newBalance = parseFloat(txn.customer_balance || 0)
    } else {
      recipientName = 'Desconocido'
      recipientPhone = null
      newBalance = 0
    }

    // Parse metadata for receipt URL
    let metadata: Record<string, string> = {}
    try {
      if (txn.metadata) {
        metadata = typeof txn.metadata === 'string' ? JSON.parse(txn.metadata) : txn.metadata
      }
    } catch {
      // Ignore parse errors
    }

    return NextResponse.json({
      success: true,
      data: {
        transactionNumber: txn.transaction_number,
        amount: parseFloat(txn.amount || 0),
        fee: parseFloat(txn.fee || 0),
        totalCharged: parseFloat(txn.total_charged || 0),
        cardBrand: txn.card_brand || 'CARD',
        cardLast4: txn.card_last4 || '****',
        recipientName,
        recipientPhone,
        walletNumber: txn.target_wallet_number,
        newBalance,
        status: txn.status,
        paymentDate: txn.created_at,
        receiptUrl: metadata.receiptUrl || null
      }
    })

  } catch (error) {
    console.error('Error looking up transaction:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar transaccion'
    }, { status: 500 })
  }
}
