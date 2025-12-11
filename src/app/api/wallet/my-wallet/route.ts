import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/wallet/my-wallet
 *
 * Returns the authenticated user's personal wallet information including:
 * - User details and wallet balance
 * - Recent transactions
 * - Stripe Connect status for cashout
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookies
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Decode JWT to get user info
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

    const { userId } = payload
    const { searchParams } = new URL(request.url)
    const includeTransactions = searchParams.get('transactions') !== 'false'
    const transactionsLimit = parseInt(searchParams.get('transactionsLimit') || '10')

    // Get user info with wallet data
    const userResult = await db.query(`
      SELECT
        id,
        firstname,
        lastname,
        email,
        phone,
        role,
        wallet_balance,
        wallet_number,
        stripe_account_id,
        stripe_account_status,
        stripe_payouts_enabled,
        stripe_charges_enabled,
        stripe_details_submitted,
        stripe_connected_at
      FROM users
      WHERE id = $1
    `, [userId])

    if (userResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no encontrado'
      }, { status: 404 })
    }

    const user = userResult.rows[0]

    // Get user's company info
    const companyResult = await db.query(`
      SELECT c.id, c.legalname, c.walletnumber
      FROM companies c
      INNER JOIN user_companies uc ON c.id = uc.company_id
      WHERE uc.user_id = $1
      LIMIT 1
    `, [userId])

    const company = companyResult.rows[0] || null

    // Format wallet data
    const walletData = {
      id: user.id,
      name: `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email,
      firstName: user.firstname,
      lastName: user.lastname,
      email: user.email,
      phone: user.phone,
      role: user.role,
      walletNumber: user.wallet_number,
      balance: parseFloat(user.wallet_balance || '0'),
      balanceFormatted: `$${parseFloat(user.wallet_balance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      stripeAccountId: user.stripe_account_id,
      stripeStatus: user.stripe_account_status || 'not_connected',
      stripePayoutsEnabled: user.stripe_payouts_enabled || false,
      stripeChargesEnabled: user.stripe_charges_enabled || false,
      stripeDetailsSubmitted: user.stripe_details_submitted || false,
      stripeConnectedAt: user.stripe_connected_at,
      canCashout: user.stripe_payouts_enabled && parseFloat(user.wallet_balance || '0') > 0,
      company: company ? {
        id: company.id,
        name: company.legalname,
        walletNumber: company.walletnumber
      } : null
    }

    // Get recent transactions if requested
    let transactions: any[] = []
    if (includeTransactions) {
      const transactionsResult = await db.query(`
        SELECT
          wt.id,
          wt.transaction_number,
          wt.type,
          wt.source_type,
          wt.source_company_id,
          wt.source_user_id,
          wt.source_customer_id,
          wt.target_type,
          wt.target_company_id,
          wt.target_user_id,
          wt.target_customer_id,
          wt.target_wallet_number,
          wt.amount,
          wt.fee,
          wt.net_amount,
          wt.payment_method,
          wt.payment_reference,
          wt.status,
          wt.metadata,
          wt.created_at,
          wt.completed_at,
          -- Source names
          CASE
            WHEN wt.source_type = 'company' THEN sc.legalname
            WHEN wt.source_type = 'user' THEN COALESCE(su.firstname || ' ' || su.lastname, su.email)
            WHEN wt.source_type = 'customer' THEN scu.firstname || ' ' || scu.lastname
            WHEN wt.source_type = 'system' THEN 'Sistema'
            ELSE 'Desconocido'
          END as source_name,
          CASE
            WHEN wt.source_type = 'company' THEN sc.walletnumber
            WHEN wt.source_type = 'user' THEN su.wallet_number
            WHEN wt.source_type = 'customer' THEN scu.wallet_number
            ELSE NULL
          END as source_wallet_number,
          -- Target names
          CASE
            WHEN wt.target_type = 'company' THEN tc.legalname
            WHEN wt.target_type = 'user' THEN COALESCE(tu.firstname || ' ' || tu.lastname, tu.email)
            WHEN wt.target_type = 'customer' THEN tcu.firstname || ' ' || tcu.lastname
            WHEN wt.target_type = 'system' THEN 'Sistema'
            ELSE 'Desconocido'
          END as target_name
        FROM wallet_transactions wt
        LEFT JOIN companies sc ON wt.source_company_id = sc.id
        LEFT JOIN users su ON wt.source_user_id = su.id
        LEFT JOIN customers scu ON wt.source_customer_id = scu.id
        LEFT JOIN companies tc ON wt.target_company_id = tc.id
        LEFT JOIN users tu ON wt.target_user_id = tu.id
        LEFT JOIN customers tcu ON wt.target_customer_id = tcu.id
        WHERE (wt.source_type = 'user' AND wt.source_user_id = $1)
           OR (wt.target_type = 'user' AND wt.target_user_id = $1)
        ORDER BY wt.created_at DESC
        LIMIT $2
      `, [userId, transactionsLimit])

      const typeLabels: Record<string, string> = {
        'recharge': 'Recarga',
        'transfer': 'Transferencia',
        'cashout': 'Retiro',
        'payment': 'Pago',
        'refund': 'Reembolso',
        'commission': 'Comision'
      }

      const methodLabels: Record<string, string> = {
        'card_manual': 'Tarjeta',
        'card_terminal': 'Terminal',
        'cash': 'Efectivo',
        'wire': 'Wire',
        'zelle': 'Zelle',
        'credit': 'Credito',
        'wallet': 'Billetera',
        'stripe_connect': 'Stripe Connect'
      }

      transactions = transactionsResult.rows.map(t => {
        // Determine if this is incoming or outgoing for the user
        const isIncoming = t.target_type === 'user' && t.target_user_id === userId

        return {
          id: t.id,
          transactionNumber: t.transaction_number,
          type: t.type,
          typeLabel: typeLabels[t.type] || t.type,
          isIncoming,
          sourceName: t.source_name,
          sourceWalletNumber: t.source_wallet_number,
          targetName: t.target_name,
          targetWalletNumber: t.target_wallet_number,
          amount: parseFloat(t.amount),
          amountFormatted: `$${parseFloat(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          fee: t.fee ? parseFloat(t.fee) : null,
          netAmount: t.net_amount ? parseFloat(t.net_amount) : null,
          paymentMethod: t.payment_method,
          paymentMethodLabel: methodLabels[t.payment_method] || t.payment_method,
          paymentReference: t.payment_reference,
          status: t.status,
          metadata: t.metadata,
          createdAt: t.created_at,
          completedAt: t.completed_at
        }
      })
    }

    // Get transaction stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE type = 'recharge' AND target_user_id = $1 AND status = 'completed') as total_recharges,
        COALESCE(SUM(amount) FILTER (WHERE type = 'recharge' AND target_user_id = $1 AND status = 'completed'), 0) as recharges_amount,
        COUNT(*) FILTER (WHERE type = 'transfer' AND source_user_id = $1 AND status = 'completed') as transfers_sent,
        COALESCE(SUM(amount) FILTER (WHERE type = 'transfer' AND source_user_id = $1 AND status = 'completed'), 0) as transfers_sent_amount,
        COUNT(*) FILTER (WHERE type = 'transfer' AND target_user_id = $1 AND status = 'completed') as transfers_received,
        COALESCE(SUM(amount) FILTER (WHERE type = 'transfer' AND target_user_id = $1 AND status = 'completed'), 0) as transfers_received_amount,
        COUNT(*) FILTER (WHERE type = 'cashout' AND source_user_id = $1 AND status = 'completed') as total_cashouts,
        COALESCE(SUM(amount) FILTER (WHERE type = 'cashout' AND source_user_id = $1 AND status = 'completed'), 0) as cashouts_amount
      FROM wallet_transactions
      WHERE (source_user_id = $1 OR target_user_id = $1)
    `, [userId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        wallet: walletData,
        transactions,
        stats: {
          totalRecharges: parseInt(stats.total_recharges || '0'),
          rechargesAmount: parseFloat(stats.recharges_amount || '0'),
          transfersSent: parseInt(stats.transfers_sent || '0'),
          transfersSentAmount: parseFloat(stats.transfers_sent_amount || '0'),
          transfersReceived: parseInt(stats.transfers_received || '0'),
          transfersReceivedAmount: parseFloat(stats.transfers_received_amount || '0'),
          totalCashouts: parseInt(stats.total_cashouts || '0'),
          cashoutsAmount: parseFloat(stats.cashouts_amount || '0')
        }
      }
    })

  } catch (error) {
    console.error('Error fetching user wallet:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener billetera'
    }, { status: 500 })
  }
}
