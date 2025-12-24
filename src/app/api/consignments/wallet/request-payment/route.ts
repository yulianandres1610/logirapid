import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface RequestPaymentBody {
  walletId?: number
  receiverCompanyId?: string
  amount?: number
  notes?: string
}

/**
 * POST /api/consignments/wallet/request-payment
 * Provider requests payment from receiver
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const userIdCookie = cookieStore.get('user-id')
    const currentCompanyId = companyIdCookie?.value
    const currentUserId = userIdCookie?.value

    if (!currentCompanyId || !currentUserId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    const body: RequestPaymentBody = await request.json()
    const { walletId, receiverCompanyId, amount, notes } = body

    // Get wallet - either by ID or by receiver company
    let wallet
    if (walletId) {
      const walletResult = await db.query(`
        SELECT cw.*, r.name as receiver_name
        FROM consignment_wallets cw
        LEFT JOIN companies r ON r.id = cw.receiver_company_id
        WHERE cw.id = $1 AND cw.provider_company_id = $2
      `, [walletId, currentCompanyId])
      wallet = walletResult.rows[0]
    } else if (receiverCompanyId) {
      const walletResult = await db.query(`
        SELECT cw.*, r.name as receiver_name
        FROM consignment_wallets cw
        LEFT JOIN companies r ON r.id = cw.receiver_company_id
        WHERE cw.provider_company_id = $1 AND cw.receiver_company_id = $2
      `, [currentCompanyId, receiverCompanyId])
      wallet = walletResult.rows[0]
    }

    if (!wallet) {
      return NextResponse.json({
        success: false,
        error: 'Wallet no encontrado'
      }, { status: 404 })
    }

    const balance = parseFloat(wallet.balance) || 0
    if (balance <= 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay saldo pendiente de cobro'
      }, { status: 400 })
    }

    // Amount to request - default to full balance
    const requestAmount = amount && amount > 0 ? Math.min(amount, balance) : balance

    // Generate request number
    const now = new Date()
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const countResult = await db.query(`
      SELECT COUNT(*) as count
      FROM consignment_payment_requests
      WHERE request_number LIKE $1
    `, [`PAY-${yearMonth}-%`])
    const count = parseInt(countResult.rows[0]?.count || '0') + 1
    const requestNumber = `PAY-${yearMonth}-${String(count).padStart(4, '0')}`

    // Create payment request
    const insertResult = await db.query(`
      INSERT INTO consignment_payment_requests (
        request_number,
        wallet_id,
        provider_company_id,
        receiver_company_id,
        amount_requested,
        status,
        requested_by,
        notes
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
      RETURNING *
    `, [
      requestNumber,
      wallet.id,
      currentCompanyId,
      wallet.receiver_company_id,
      requestAmount,
      currentUserId,
      notes || null
    ])

    const paymentRequest = insertResult.rows[0]

    // Create wallet transaction
    await db.query(`
      INSERT INTO consignment_wallet_transactions (
        wallet_id,
        transaction_type,
        amount,
        balance_after,
        notes,
        created_by
      ) VALUES ($1, 'payment_request', $2, $3, $4, $5)
    `, [
      wallet.id,
      requestAmount,
      balance, // Balance doesn't change until payment is made
      `Solicitud de cobro ${requestNumber}`,
      currentUserId
    ])

    return NextResponse.json({
      success: true,
      message: `Solicitud de cobro ${requestNumber} creada`,
      data: {
        id: paymentRequest.id,
        requestNumber: paymentRequest.request_number,
        walletId: paymentRequest.wallet_id,
        receiverCompanyId: paymentRequest.receiver_company_id,
        receiverName: wallet.receiver_name,
        amountRequested: parseFloat(paymentRequest.amount_requested),
        currentBalance: balance,
        status: paymentRequest.status,
        requestedAt: paymentRequest.requested_at
      }
    })

  } catch (error) {
    console.error('[Request Payment] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al solicitar cobro'
    }, { status: 500 })
  }
}
