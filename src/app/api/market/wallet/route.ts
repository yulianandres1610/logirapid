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
 * GET /api/market/wallet
 * Get market's wallet balance and transaction history
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
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
    const filterCurrency = searchParams.get('currency')

    // Get company info and verify it's a market
    const companyResult = await db.query(`
      SELECT
        id,
        companytype,
        legalname,
        COALESCE("walletNumber", walletnumber) as wallet_number,
        COALESCE("walletBalance"::numeric, walletbalance, 0) as wallet_balance,
        currency,
        market_province,
        market_municipality,
        COALESCE(market_is_active, status = 'active') as is_active
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

    if (company.companytype !== 'market') {
      return NextResponse.json({
        success: false,
        error: 'Esta empresa no es un mercado'
      }, { status: 403 })
    }

    const walletBalance = parseFloat(company.wallet_balance) || 0
    const currency = company.currency || 'USD'

    // Get multi-currency balances from market_wallet_balances
    let currencyBalances: any[] = []
    const supportedCurrencies = ['USD', 'CUP', 'EUR', 'MLC']

    try {
      // First, ensure market has entries for all supported currencies
      for (const curr of supportedCurrencies) {
        await db.query(`
          INSERT INTO market_wallet_balances (company_id, currency, available_balance, reserved_balance)
          VALUES ($1, $2, 0, 0)
          ON CONFLICT (company_id, currency) DO NOTHING
        `, [payload.companyId, curr])
      }

      const balancesResult = await db.query(`
        SELECT
          currency,
          COALESCE(available_balance, 0) as available_balance,
          COALESCE(reserved_balance, 0) as reserved_balance
        FROM market_wallet_balances
        WHERE company_id = $1
        ORDER BY
          CASE currency
            WHEN 'USD' THEN 1
            WHEN 'CUP' THEN 2
            WHEN 'EUR' THEN 3
            WHEN 'MLC' THEN 4
            ELSE 5
          END
      `, [payload.companyId])

      // Calculate totals from wallet_transactions per currency
      const depositsResult = await db.query(`
        SELECT
          COALESCE(currency, 'USD') as currency,
          COALESCE(SUM(amount), 0) as total
        FROM wallet_transactions
        WHERE target_company_id = $1
          AND type IN ('recharge', 'transfer_in', 'deposit', 'order_payment')
          AND status = 'completed'
        GROUP BY currency
      `, [payload.companyId])

      const withdrawalsResult = await db.query(`
        SELECT
          COALESCE(currency, 'USD') as currency,
          COALESCE(SUM(amount), 0) as total
        FROM wallet_transactions
        WHERE source_company_id = $1
          AND type IN ('transfer_out', 'withdrawal', 'debit')
          AND status = 'completed'
        GROUP BY currency
      `, [payload.companyId])

      const depositsMap = new Map(depositsResult.rows.map(r => [r.currency, parseFloat(r.total) || 0]))
      const withdrawalsMap = new Map(withdrawalsResult.rows.map(r => [r.currency, parseFloat(r.total) || 0]))

      currencyBalances = balancesResult.rows.map(row => ({
        currency: row.currency,
        available: parseFloat(row.available_balance) || 0,
        reserved: parseFloat(row.reserved_balance) || 0,
        totalDeposits: depositsMap.get(row.currency) || 0,
        totalWithdrawals: withdrawalsMap.get(row.currency) || 0
      }))
    } catch (e) {
      // Table might not exist yet - try broker_wallet_balances as fallback or create market_wallet_balances
      console.log('[Market Wallet] market_wallet_balances error, trying fallback:', e)

      try {
        // Try to create the table if it doesn't exist
        await db.query(`
          CREATE TABLE IF NOT EXISTS market_wallet_balances (
            id SERIAL PRIMARY KEY,
            company_id INTEGER NOT NULL REFERENCES companies(id),
            currency VARCHAR(10) NOT NULL,
            available_balance DECIMAL(15,2) DEFAULT 0,
            reserved_balance DECIMAL(15,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(company_id, currency)
          )
        `)

        // Initialize balances
        for (const curr of supportedCurrencies) {
          await db.query(`
            INSERT INTO market_wallet_balances (company_id, currency, available_balance, reserved_balance)
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (company_id, currency) DO NOTHING
          `, [payload.companyId, curr, curr === 'USD' ? walletBalance : 0])
        }

        currencyBalances = supportedCurrencies.map(curr => ({
          currency: curr,
          available: curr === 'USD' ? walletBalance : 0,
          reserved: 0,
          totalDeposits: 0,
          totalWithdrawals: 0
        }))
      } catch {
        // Ultimate fallback
        currencyBalances = [{
          currency: currency,
          available: walletBalance,
          reserved: 0,
          totalDeposits: 0,
          totalWithdrawals: 0
        }]
      }
    }

    // Get transaction stats
    const statsResult = await db.query(`
      SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions
         WHERE target_company_id = $1
         AND type IN ('recharge', 'transfer_in', 'deposit', 'order_payment')
         AND status = 'completed') as total_deposits,
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions
         WHERE source_company_id = $1
         AND type IN ('transfer_out', 'withdrawal', 'debit')
         AND status = 'completed') as total_withdrawals,
        (SELECT COUNT(*) FROM wallet_transactions
         WHERE (source_company_id = $1 OR target_company_id = $1)
         AND status = 'completed') as total_transactions
    `, [payload.companyId])

    const stats = statsResult.rows[0]

    // Get transaction history if requested
    let history: any[] = []
    if (includeHistory) {
      const historyParams: any[] = [payload.companyId, historyLimit]
      let currencyFilter = ''
      if (filterCurrency) {
        historyParams.push(filterCurrency)
        currencyFilter = ` AND wt.currency = $${historyParams.length}`
      }

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
          wt.notes,
          wt.created_by_name,
          wt.created_at,
          wt.completed_at,
          sc.legalname as source_company_name,
          tc.legalname as target_company_name
        FROM wallet_transactions wt
        LEFT JOIN companies sc ON wt.source_company_id = sc.id
        LEFT JOIN companies tc ON wt.target_company_id = tc.id
        WHERE (wt.source_company_id = $1 OR wt.target_company_id = $1)${currencyFilter}
        ORDER BY wt.created_at DESC
        LIMIT $2
      `, historyParams)

      const typeLabels: { [key: string]: string } = {
        'recharge': 'Recarga',
        'transfer_out': 'Transferencia (Salida)',
        'transfer_in': 'Transferencia (Entrada)',
        'debit': 'Debito',
        'deposit': 'Deposito',
        'withdrawal': 'Retiro',
        'refund': 'Reembolso',
        'order_payment': 'Pago de Orden'
      }

      history = historyResult.rows.map(row => {
        const isIncoming = row.target_company_id === payload.companyId
        const isOrderPayment = row.type === 'order_payment'

        let typeLabel = typeLabels[row.type] || row.type
        if (isOrderPayment) {
          typeLabel = 'Pago de Orden'
        }

        return {
          id: row.id,
          transactionNumber: row.transaction_number,
          type: row.type,
          typeLabel,
          direction: isIncoming ? 'in' : 'out',
          directionLabel: isIncoming ? 'Entrada' : 'Salida',
          amount: parseFloat(row.amount) || 0,
          amountFormatted: `${(parseFloat(row.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          fee: parseFloat(row.fee) || 0,
          netAmount: parseFloat(row.net_amount) || 0,
          currency: row.currency || 'USD',
          paymentMethod: row.payment_method,
          paymentReference: row.payment_reference,
          status: row.status,
          description: row.description,
          notes: row.notes,
          createdByName: row.created_by_name,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          counterparty: isIncoming ? row.source_company_name : row.target_company_name,
          isOrderPayment
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.legalname,
        tradeName: company.legalname,
        walletNumber: company.wallet_number,
        walletBalance,
        walletBalanceFormatted: `$${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        currency,
        province: company.market_province,
        municipality: company.market_municipality,
        isActive: company.is_active,
        currencyBalances,
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
    console.error('[Market Wallet API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener balance'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/wallet
 * Request deposit or withdrawal from market wallet
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
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
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

    // Get company info and verify it's a market
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

    if (company.companytype !== 'market') {
      return NextResponse.json({
        success: false,
        error: 'Esta empresa no es un mercado'
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
      const balanceChange = type === 'deposit' ? numAmount : -numAmount
      await client.query(`
        UPDATE companies
        SET walletbalance = COALESCE(walletbalance, 0) + $1
        WHERE id = $2
      `, [balanceChange, payload.companyId])

      const txType = type === 'deposit' ? 'recharge' : 'debit'
      const sourceType = type === 'deposit' ? 'external' : 'company'
      const targetType = type === 'deposit' ? 'company' : 'external'

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
        notes || `${type === 'deposit' ? 'Deposito' : 'Retiro'} de mercado`,
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
      message: type === 'deposit' ? 'Deposito realizado' : 'Retiro realizado',
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
    console.error('[Market Wallet API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar transaccion'
    }, { status: 500 })
  }
}
