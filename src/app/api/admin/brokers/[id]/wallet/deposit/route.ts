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
 * POST /api/admin/brokers/[id]/wallet/deposit
 * Deposit funds to a broker's wallet (SUPER_ADMIN only)
 *
 * Uses the existing company wallet system:
 * - Updates companies.walletbalance
 * - Records in wallet_transactions table
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const brokerId = parseInt(id)

    if (isNaN(brokerId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de broker inválido'
      }, { status: 400 })
    }

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
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Only SUPER_ADMIN can access
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede acceder'
      }, { status: 403 })
    }

    const body = await request.json()
    const { amount, notes, paymentMethod = 'wire' } = body

    if (!amount) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere amount'
      }, { status: 400 })
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    // Verify broker exists and get current balance
    const brokerCheck = await db.query(`
      SELECT
        id,
        legalname,
        COALESCE("walletNumber", walletnumber) as wallet_number,
        COALESCE("walletBalance"::numeric, walletbalance, 0) as wallet_balance,
        currency
      FROM companies
      WHERE id = $1 AND companytype = 'broker'
    `, [brokerId])

    if (brokerCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Broker no encontrado'
      }, { status: 404 })
    }

    const broker = brokerCheck.rows[0]
    const brokerName = broker.legalname
    const walletNumber = broker.wallet_number
    const currentBalance = parseFloat(broker.wallet_balance) || 0
    const currency = broker.currency || 'USD'

    // Process deposit using transaction
    const result = await db.transaction(async (client) => {
      // Update company wallet balance
      await client.query(`
        UPDATE companies
        SET walletbalance = COALESCE(walletbalance, 0) + $1
        WHERE id = $2
      `, [numAmount, brokerId])

      // Create transaction record in wallet_transactions
      const txResult = await client.query(`
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
          created_by,
          created_by_name,
          completed_at
        ) VALUES (
          'recharge',
          'external',
          'company',
          $1,
          $2,
          $3,
          0,
          $3,
          $4,
          $5,
          'completed',
          false,
          $6,
          $7,
          $8,
          NOW()
        ) RETURNING id, transaction_number
      `, [
        brokerId,
        walletNumber,
        numAmount,
        currency,
        paymentMethod,
        notes || 'Depósito administrativo por SUPER_ADMIN',
        payload.userId,
        payload.email
      ])

      return {
        transactionId: txResult.rows[0].id,
        transactionNumber: txResult.rows[0].transaction_number
      }
    })

    const newBalance = currentBalance + numAmount

    return NextResponse.json({
      success: true,
      message: `Depósito de $${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} realizado a ${brokerName}`,
      data: {
        brokerId,
        brokerName,
        walletNumber,
        currency,
        previousBalance: currentBalance,
        previousBalanceFormatted: `$${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        depositAmount: numAmount,
        depositAmountFormatted: `$${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        newBalance,
        newBalanceFormatted: `$${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        transactionNumber: result.transactionNumber
      }
    })

  } catch (error) {
    console.error('[Admin Broker Deposit API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al depositar'
    }, { status: 500 })
  }
}
