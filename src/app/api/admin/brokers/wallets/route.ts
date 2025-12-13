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
 * GET /api/admin/brokers/wallets
 * Get all broker wallets with balances (SUPER_ADMIN only)
 *
 * Uses the existing company wallet system:
 * - companies.walletBalance for balance
 * - companies.walletNumber for wallet identifier
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

    // Only SUPER_ADMIN can access
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede acceder'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const brokerId = searchParams.get('brokerId')

    // Build query - filter companies by type 'broker'
    let whereClause = "WHERE c.companytype = 'broker'"
    const params: any[] = []

    if (brokerId) {
      params.push(parseInt(brokerId))
      whereClause += ` AND c.id = $${params.length}`
    }

    // Get brokers with wallet info from companies table
    const result = await db.query(`
      SELECT
        c.id as broker_id,
        c.legalname as broker_name,
        c.tradename,
        COALESCE("walletNumber", walletnumber) as wallet_number,
        COALESCE("walletBalance"::numeric, walletbalance, 0) as wallet_balance,
        c.currency,
        c.broker_province,
        c.broker_municipality,
        COALESCE(c.broker_is_active, c.status = 'active') as is_active,
        c.email,
        c.phone,
        c.logo,
        c.created_at,
        -- Get transaction counts
        (SELECT COUNT(*) FROM wallet_transactions wt
         WHERE (wt.source_company_id = c.id OR wt.target_company_id = c.id)
         AND wt.status = 'completed') as total_transactions,
        -- Total deposits (money in)
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions wt
         WHERE wt.target_company_id = c.id
         AND wt.type IN ('recharge', 'transfer_in', 'deposit')
         AND wt.status = 'completed') as total_deposits,
        -- Total withdrawals (money out)
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions wt
         WHERE wt.source_company_id = c.id
         AND wt.type IN ('transfer_out', 'withdrawal', 'debit')
         AND wt.status = 'completed') as total_withdrawals,
        -- Last transaction date
        (SELECT MAX(created_at) FROM wallet_transactions wt
         WHERE wt.source_company_id = c.id OR wt.target_company_id = c.id) as last_transaction_date
      FROM companies c
      ${whereClause}
      ORDER BY c.legalname
    `, params)

    // Format brokers with their wallet info
    const brokers = result.rows.map(row => ({
      id: row.broker_id,
      name: row.broker_name,
      tradeName: row.tradename,
      walletNumber: row.wallet_number,
      walletBalance: parseFloat(row.wallet_balance) || 0,
      walletBalanceFormatted: `$${(parseFloat(row.wallet_balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      currency: row.currency || 'USD',
      province: row.broker_province,
      municipality: row.broker_municipality,
      isActive: row.is_active,
      email: row.email,
      phone: row.phone,
      logo: row.logo,
      createdAt: row.created_at,
      stats: {
        totalTransactions: parseInt(row.total_transactions) || 0,
        totalDeposits: parseFloat(row.total_deposits) || 0,
        totalDepositsFormatted: `$${(parseFloat(row.total_deposits) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalWithdrawals: parseFloat(row.total_withdrawals) || 0,
        totalWithdrawalsFormatted: `$${(parseFloat(row.total_withdrawals) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      },
      lastTransactionDate: row.last_transaction_date
    }))

    // Calculate totals
    const totalsResult = await db.query(`
      SELECT
        COUNT(*) as total_brokers,
        COUNT(*) FILTER (WHERE COALESCE(broker_is_active, status = 'active') = true) as active_brokers,
        COALESCE(SUM(COALESCE("walletBalance"::numeric, walletbalance, 0)), 0) as total_balance
      FROM companies
      WHERE companytype = 'broker'
    `)

    const totals = totalsResult.rows[0]

    // Get recent transactions for all brokers
    // Get IDs of broker companies
    const brokerIdsResult = await db.query(`
      SELECT id FROM companies WHERE companytype = 'broker'
    `)
    const brokerIds = brokerIdsResult.rows.map(r => r.id)

    let recentTransactions: any[] = []
    if (brokerIds.length > 0) {
      const transactionsResult = await db.query(`
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
        WHERE wt.source_company_id = ANY($1)
           OR wt.target_company_id = ANY($1)
        ORDER BY wt.created_at DESC
        LIMIT 50
      `, [brokerIds])

      const typeLabels: { [key: string]: string } = {
        'recharge': 'Recarga',
        'transfer_out': 'Transferencia (Salida)',
        'transfer_in': 'Transferencia (Entrada)',
        'debit': 'Débito',
        'deposit': 'Depósito',
        'withdrawal': 'Retiro',
        'refund': 'Reembolso'
      }

      const methodLabels: { [key: string]: string } = {
        'card_manual': 'Tarjeta Manual',
        'card_stripe': 'Tarjeta',
        'card_terminal': 'Terminal',
        'cash': 'Efectivo',
        'wire': 'Transferencia Bancaria',
        'zelle': 'Zelle',
        'credit_charge': 'Cargo de Crédito'
      }

      recentTransactions = transactionsResult.rows.map(row => {
        // Determine if it's an incoming or outgoing transaction for the broker
        const isIncoming = brokerIds.includes(row.target_company_id)
        const isOutgoing = brokerIds.includes(row.source_company_id)

        // Get the broker involved
        let brokerId = null
        let brokerName = null
        if (isIncoming) {
          brokerId = row.target_company_id
          brokerName = row.target_company_name
        } else if (isOutgoing) {
          brokerId = row.source_company_id
          brokerName = row.source_company_name
        }

        return {
          id: row.id,
          transactionNumber: row.transaction_number,
          type: row.type,
          typeLabel: typeLabels[row.type] || row.type,
          direction: isIncoming ? 'in' : 'out',
          directionLabel: isIncoming ? 'Entrada' : 'Salida',
          brokerId,
          brokerName,
          sourceCompanyId: row.source_company_id,
          sourceCompanyName: row.source_company_name,
          sourceWalletNumber: row.source_wallet_number,
          targetCompanyId: row.target_company_id,
          targetCompanyName: row.target_company_name,
          targetWalletNumber: row.target_wallet_number,
          amount: parseFloat(row.amount) || 0,
          amountFormatted: `$${(parseFloat(row.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          fee: parseFloat(row.fee) || 0,
          netAmount: parseFloat(row.net_amount) || 0,
          currency: row.currency || 'USD',
          paymentMethod: row.payment_method,
          paymentMethodLabel: methodLabels[row.payment_method] || row.payment_method,
          paymentReference: row.payment_reference,
          status: row.status,
          description: row.description,
          createdByName: row.created_by_name,
          createdAt: row.created_at,
          completedAt: row.completed_at
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        brokers,
        summary: {
          totalBrokers: parseInt(totals.total_brokers) || 0,
          activeBrokers: parseInt(totals.active_brokers) || 0,
          totalBalance: parseFloat(totals.total_balance) || 0,
          totalBalanceFormatted: `$${(parseFloat(totals.total_balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        recentTransactions
      }
    })

  } catch (error) {
    console.error('[Admin Brokers Wallets API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener wallets'
    }, { status: 500 })
  }
}
