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
 * GET /api/broker/wallet
 * Get broker's wallet balance and transaction history
 *
 * Uses the existing company wallet system:
 * - companies.walletBalance for balance
 * - wallet_transactions for transaction history
 */
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const includeHistory = searchParams.get('history') === 'true'
    const historyLimit = parseInt(searchParams.get('historyLimit') || '20')

    // Get company info and verify it's a broker
    const companyResult = await db.query(`
      SELECT
        id,
        companytype,
        legalname,
        tradename,
        COALESCE("walletNumber", walletnumber) as wallet_number,
        COALESCE("walletBalance"::numeric, walletbalance, 0) as wallet_balance,
        currency,
        broker_province,
        broker_municipality,
        COALESCE(broker_is_active, status = 'active') as is_active
      FROM companies
      WHERE id = $1
    `, [payload.companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]

    if (company.companytype !== 'broker') {
      return NextResponse.json({
        success: false,
        error: 'Esta empresa no es un broker'
      }, { status: 403 })
    }

    const walletBalance = parseFloat(company.wallet_balance) || 0
    const currency = company.currency || 'USD'

    // Get transaction stats
    const statsResult = await db.query(`
      SELECT
        -- Total deposits (money in)
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions
         WHERE target_company_id = $1
         AND type IN ('recharge', 'transfer_in', 'deposit')
         AND status = 'completed') as total_deposits,
        -- Total withdrawals (money out)
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions
         WHERE source_company_id = $1
         AND type IN ('transfer_out', 'withdrawal', 'debit')
         AND status = 'completed') as total_withdrawals,
        -- Transaction count
        (SELECT COUNT(*) FROM wallet_transactions
         WHERE (source_company_id = $1 OR target_company_id = $1)
         AND status = 'completed') as total_transactions
    `, [payload.companyId])

    const stats = statsResult.rows[0]

    // Get transaction history if requested
    let history: any[] = []
    if (includeHistory) {
      const historyResult = await db.query(`
        SELECT
          wt.id,
          wt.transaction_number,
          wt.type,
          wt.source_type,
          wt.source_company_id,
          wt.source_wallet_number,
          wt.target_type,
          wt.target_company_id,
          wt.target_wallet_number,
          wt.amount,
          wt.fee,
          wt.net_amount,
          wt.currency,
          wt.payment_method,
          wt.payment_reference,
          wt.status,
          wt.description,
          wt.created_by_name,
          wt.created_at,
          wt.completed_at,
          sc.legalname as source_company_name,
          tc.legalname as target_company_name
        FROM wallet_transactions wt
        LEFT JOIN companies sc ON wt.source_company_id = sc.id
        LEFT JOIN companies tc ON wt.target_company_id = tc.id
        WHERE wt.source_company_id = $1 OR wt.target_company_id = $1
        ORDER BY wt.created_at DESC
        LIMIT $2
      `, [payload.companyId, historyLimit])

      const typeLabels: { [key: string]: string } = {
        'recharge': 'Recarga',
        'transfer_out': 'Transferencia (Salida)',
        'transfer_in': 'Transferencia (Entrada)',
        'debit': 'Débito',
        'deposit': 'Depósito',
        'withdrawal': 'Retiro',
        'refund': 'Reembolso'
      }

      history = historyResult.rows.map(row => {
        const isIncoming = row.target_company_id === payload.companyId
        return {
          id: row.id,
          transactionNumber: row.transaction_number,
          type: row.type,
          typeLabel: typeLabels[row.type] || row.type,
          direction: isIncoming ? 'in' : 'out',
          directionLabel: isIncoming ? 'Entrada' : 'Salida',
          amount: parseFloat(row.amount) || 0,
          amountFormatted: `$${(parseFloat(row.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          fee: parseFloat(row.fee) || 0,
          netAmount: parseFloat(row.net_amount) || 0,
          currency: row.currency || 'USD',
          paymentMethod: row.payment_method,
          paymentReference: row.payment_reference,
          status: row.status,
          description: row.description,
          createdByName: row.created_by_name,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          counterparty: isIncoming ? row.source_company_name : row.target_company_name
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.legalname,
        tradeName: company.tradename,
        walletNumber: company.wallet_number,
        walletBalance,
        walletBalanceFormatted: `$${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        currency,
        province: company.broker_province,
        municipality: company.broker_municipality,
        isActive: company.is_active,
        stats: {
          totalDeposits: parseFloat(stats.total_deposits) || 0,
          totalDepositsFormatted: `$${(parseFloat(stats.total_deposits) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          totalWithdrawals: parseFloat(stats.total_withdrawals) || 0,
          totalWithdrawalsFormatted: `$${(parseFloat(stats.total_withdrawals) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          totalTransactions: parseInt(stats.total_transactions) || 0
        },
        history: includeHistory ? history : undefined
      }
    })

  } catch (error) {
    console.error('[Broker Wallet API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener balance'
    }, { status: 500 })
  }
}

/**
 * POST /api/broker/wallet
 * Request deposit or withdrawal from broker wallet (self-service)
 * Note: For security, self-service deposits/withdrawals may require approval
 *
 * Uses the existing company wallet system:
 * - Updates companies.walletbalance
 * - Records in wallet_transactions table
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()
    const { amount, type, notes, paymentMethod = 'wire' } = body

    if (!amount || !type) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere amount y type'
      }, { status: 400 })
    }

    if (!['deposit', 'withdrawal'].includes(type)) {
      return NextResponse.json({
        success: false,
        error: 'type debe ser deposit o withdrawal'
      }, { status: 400 })
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({
        success: false,
        error: 'El monto debe ser mayor a 0'
      }, { status: 400 })
    }

    // Get company info and verify it's a broker
    const companyResult = await db.query(`
      SELECT
        id,
        companytype,
        legalname,
        COALESCE("walletNumber", walletnumber) as wallet_number,
        COALESCE("walletBalance"::numeric, walletbalance, 0) as wallet_balance,
        currency
      FROM companies
      WHERE id = $1
    `, [payload.companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]

    if (company.companytype !== 'broker') {
      return NextResponse.json({
        success: false,
        error: 'Esta empresa no es un broker'
      }, { status: 403 })
    }

    const currentBalance = parseFloat(company.wallet_balance) || 0
    const walletNumber = company.wallet_number
    const currency = company.currency || 'USD'

    // Validate withdrawal
    if (type === 'withdrawal' && numAmount > currentBalance) {
      return NextResponse.json({
        success: false,
        error: 'Fondos insuficientes para retiro'
      }, { status: 400 })
    }

    // Process transaction
    const result = await db.transaction(async (client) => {
      // Update company wallet balance
      const balanceChange = type === 'deposit' ? numAmount : -numAmount
      await client.query(`
        UPDATE companies
        SET walletbalance = COALESCE(walletbalance, 0) + $1
        WHERE id = $2
      `, [balanceChange, payload.companyId])

      // Determine transaction type for wallet_transactions
      const txType = type === 'deposit' ? 'recharge' : 'debit'
      const sourceType = type === 'deposit' ? 'external' : 'company'
      const targetType = type === 'deposit' ? 'company' : 'external'

      // Create transaction record
      const txResult = await client.query(`
        INSERT INTO wallet_transactions (
          type,
          source_type,
          source_company_id,
          source_wallet_number,
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
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          0,
          $8,
          $9,
          $10,
          'completed',
          false,
          $11,
          $12,
          $13,
          NOW()
        ) RETURNING id, transaction_number
      `, [
        txType,
        sourceType,
        type === 'withdrawal' ? payload.companyId : null,
        type === 'withdrawal' ? walletNumber : null,
        targetType,
        type === 'deposit' ? payload.companyId : null,
        type === 'deposit' ? walletNumber : null,
        numAmount,
        currency,
        paymentMethod,
        notes || `${type === 'deposit' ? 'Depósito' : 'Retiro'} de broker`,
        payload.userId,
        payload.email
      ])

      return {
        transactionId: txResult.rows[0].id,
        transactionNumber: txResult.rows[0].transaction_number
      }
    })

    const newBalance = type === 'deposit'
      ? currentBalance + numAmount
      : currentBalance - numAmount

    return NextResponse.json({
      success: true,
      message: type === 'deposit' ? 'Depósito realizado' : 'Retiro realizado',
      data: {
        transactionNumber: result.transactionNumber,
        currency,
        previousBalance: currentBalance,
        previousBalanceFormatted: `$${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        amount: numAmount,
        amountFormatted: `$${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        newBalance,
        newBalanceFormatted: `$${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        type
      }
    })

  } catch (error) {
    console.error('[Broker Wallet API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar transacción'
    }, { status: 500 })
  }
}
