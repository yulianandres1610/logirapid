import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

interface PayBody {
  paymentRequestId?: number
  walletId?: number
  providerCompanyId?: string
  amount: number
  paymentMethod?: string
  paymentReference?: string
  notes?: string
}

/**
 * POST /api/consignments/wallet/pay
 * Receiver registers a payment to provider
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

    const body: PayBody = await request.json()
    const { paymentRequestId, walletId, providerCompanyId, amount, paymentMethod, paymentReference, notes } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'Monto inválido'
      }, { status: 400 })
    }

    // Get wallet
    let wallet
    if (paymentRequestId) {
      // Get wallet via payment request
      const requestResult = await db.query(`
        SELECT pr.*, cw.balance, cw.total_paid, p.name as provider_name
        FROM consignment_payment_requests pr
        JOIN consignment_wallets cw ON cw.id = pr.wallet_id
        LEFT JOIN companies p ON p.id = cw.provider_company_id
        WHERE pr.id = $1 AND pr.receiver_company_id = $2
      `, [paymentRequestId, currentCompanyId])

      if (requestResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Solicitud de pago no encontrada'
        }, { status: 404 })
      }

      wallet = requestResult.rows[0]
      wallet.id = wallet.wallet_id
    } else if (walletId) {
      const walletResult = await db.query(`
        SELECT cw.*, p.name as provider_name
        FROM consignment_wallets cw
        LEFT JOIN companies p ON p.id = cw.provider_company_id
        WHERE cw.id = $1 AND cw.receiver_company_id = $2
      `, [walletId, currentCompanyId])
      wallet = walletResult.rows[0]
    } else if (providerCompanyId) {
      const walletResult = await db.query(`
        SELECT cw.*, p.name as provider_name
        FROM consignment_wallets cw
        LEFT JOIN companies p ON p.id = cw.provider_company_id
        WHERE cw.provider_company_id = $1 AND cw.receiver_company_id = $2
      `, [providerCompanyId, currentCompanyId])
      wallet = walletResult.rows[0]
    }

    if (!wallet) {
      return NextResponse.json({
        success: false,
        error: 'Wallet no encontrado'
      }, { status: 404 })
    }

    const currentBalance = parseFloat(wallet.balance) || 0
    const paymentAmount = Math.min(amount, currentBalance)

    if (paymentAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay saldo pendiente'
      }, { status: 400 })
    }

    const newBalance = currentBalance - paymentAmount
    const totalPaid = (parseFloat(wallet.total_paid) || 0) + paymentAmount

    // Update wallet balance
    await db.query(`
      UPDATE consignment_wallets
      SET balance = $1,
          total_paid = $2,
          last_payment_at = NOW()
      WHERE id = $3
    `, [newBalance, totalPaid, wallet.id])

    // Create wallet transaction
    await db.query(`
      INSERT INTO consignment_wallet_transactions (
        wallet_id,
        transaction_type,
        amount,
        balance_after,
        notes,
        created_by
      ) VALUES ($1, 'payment_completed', $2, $3, $4, $5)
    `, [
      wallet.id,
      -paymentAmount, // Negative because it reduces balance
      newBalance,
      notes || `Pago ${paymentMethod ? `por ${paymentMethod}` : ''} ${paymentReference ? `- Ref: ${paymentReference}` : ''}`.trim(),
      currentUserId
    ])

    // Update payment request if exists
    if (paymentRequestId) {
      const currentAmountPaid = parseFloat(wallet.amount_paid) || 0
      const amountRequested = parseFloat(wallet.amount_requested) || 0
      const newAmountPaid = currentAmountPaid + paymentAmount
      const newStatus = newAmountPaid >= amountRequested ? 'completed' : 'partial'

      await db.query(`
        UPDATE consignment_payment_requests
        SET amount_paid = $1,
            status = $2,
            payment_method = $3,
            payment_reference = $4,
            paid_by = $5,
            paid_at = NOW(),
            notes = COALESCE(notes || ' | ', '') || $6
        WHERE id = $7
      `, [
        newAmountPaid,
        newStatus,
        paymentMethod || null,
        paymentReference || null,
        currentUserId,
        notes || '',
        paymentRequestId
      ])
    }

    return NextResponse.json({
      success: true,
      message: `Pago de $${paymentAmount.toFixed(2)} registrado`,
      data: {
        walletId: wallet.id,
        providerName: wallet.provider_name,
        amountPaid: paymentAmount,
        previousBalance: currentBalance,
        newBalance,
        totalPaid,
        paymentMethod,
        paymentReference
      }
    })

  } catch (error) {
    console.error('[Register Payment] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al registrar pago'
    }, { status: 500 })
  }
}
