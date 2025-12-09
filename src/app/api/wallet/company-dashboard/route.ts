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
 * GET /api/wallet/company-dashboard
 * Dashboard de wallet para ADMIN/MANAGER de una empresa
 *
 * Returns:
 * - companyWallet: información del wallet de la empresa
 * - users: lista de usuarios de la empresa con sus wallets
 * - customers: lista de clientes con wallets
 * - recentTransactions: últimas transacciones
 * - stats: estadísticas (recargas del mes, transferencias, etc.)
 * - pendingRequests: número de solicitudes pendientes
 */
export async function GET(request: NextRequest) {
  try {
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

    // Only ADMIN and MANAGER can access this endpoint
    const allowedRoles = ['ADMIN', 'MANAGER']
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({
        success: false,
        error: 'Acceso no autorizado. Solo ADMIN y MANAGER pueden acceder.'
      }, { status: 403 })
    }

    const companyId = payload.companyId

    // 1. Get company wallet information
    // Note: Using COALESCE to handle both camelCase and lowercase column names
    // walletBalance/dailyLimit/monthlyLimit are varchar in camelCase, numeric in lowercase
    const companyResult = await db.query(`
      SELECT
        id,
        legalname,
        COALESCE("walletNumber", walletnumber) as walletnumber,
        COALESCE("walletBalance"::numeric, walletbalance, 0) as walletbalance,
        COALESCE("dailyLimit"::numeric, dailylimit, 5000) as dailylimit,
        COALESCE("monthlyLimit"::numeric, monthlylimit, 50000) as monthlylimit,
        credit_limit,
        credit_enabled,
        negative_since,
        late_fee_charged_at,
        last_interest_charge_at,
        phone,
        email,
        logo,
        currency,
        status
      FROM companies
      WHERE id = $1
    `, [companyId])

    if (companyResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Empresa no encontrada'
      }, { status: 404 })
    }

    const company = companyResult.rows[0]
    const balance = parseFloat(company.walletbalance || '0')
    const creditLimit = parseFloat(company.credit_limit || '-200')
    const creditEnabled = company.credit_enabled !== false
    const creditLimitAbs = Math.abs(creditLimit)
    const isNegative = balance < 0
    const creditUsed = isNegative ? Math.abs(balance) : 0
    const availableCredit = creditLimitAbs - creditUsed

    // Calculate days in negative
    let daysInNegative = 0
    if (company.negative_since) {
      const negativeSince = new Date(company.negative_since)
      const now = new Date()
      daysInNegative = Math.floor((now.getTime() - negativeSince.getTime()) / (1000 * 60 * 60 * 24))
    }

    const companyWallet = {
      id: company.id,
      name: company.legalname,
      walletNumber: company.walletnumber,
      balance,
      balanceFormatted: `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      dailyLimit: parseFloat(company.dailylimit || '5000'),
      monthlyLimit: parseFloat(company.monthlylimit || '50000'),
      creditLimit,
      creditLimitFormatted: `$${creditLimitAbs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      creditEnabled,
      availableCredit,
      availableCreditFormatted: `$${availableCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      isNegative,
      daysInNegative,
      negativeSince: company.negative_since,
      phone: company.phone,
      email: company.email,
      logo: company.logo,
      currency: company.currency || 'USD',
      status: company.status,
      type: 'company' as const
    }

    // 2. Get users of the company with wallets
    const usersResult = await db.query(`
      SELECT
        u.id,
        u.firstname,
        u.lastname,
        u.wallet_number,
        u.wallet_balance,
        u.phone,
        u.email,
        u.status,
        u.role
      FROM users u
      JOIN user_companies uc ON u.id = uc.userid
      WHERE uc.companyid = $1 AND u.wallet_number IS NOT NULL
      ORDER BY u.firstname, u.lastname
    `, [companyId])

    const users = usersResult.rows.map(user => ({
      id: user.id,
      name: `${user.firstname} ${user.lastname}`.trim(),
      walletNumber: user.wallet_number,
      balance: parseFloat(user.wallet_balance || '0'),
      balanceFormatted: `$${parseFloat(user.wallet_balance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      phone: user.phone,
      email: user.email,
      status: user.status,
      role: user.role,
      type: 'user' as const
    }))

    // 3. Get customers with wallets
    const customersResult = await db.query(`
      SELECT
        id,
        firstname,
        lastname,
        wallet_number,
        wallet_balance,
        phone,
        email
      FROM customers
      WHERE company_id = $1 AND wallet_number IS NOT NULL
      ORDER BY firstname, lastname
      LIMIT 100
    `, [companyId])

    const customers = customersResult.rows.map(customer => ({
      id: customer.id,
      name: `${customer.firstname} ${customer.lastname}`.trim(),
      walletNumber: customer.wallet_number,
      balance: parseFloat(customer.wallet_balance || '0'),
      balanceFormatted: `$${parseFloat(customer.wallet_balance || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      phone: customer.phone,
      email: customer.email,
      type: 'customer' as const
    }))

    // 4. Get recent transactions (where company is source or target)
    const transactionsResult = await db.query(`
      SELECT
        t.id,
        t.transaction_number,
        t.type,
        t.source_type,
        t.source_wallet_number,
        t.target_type,
        t.target_wallet_number,
        t.target_company_id,
        t.target_user_id,
        t.target_customer_id,
        t.source_company_id,
        t.source_user_id,
        t.amount,
        t.fee,
        t.net_amount,
        t.currency,
        t.payment_method,
        t.payment_reference,
        t.status,
        t.description,
        t.created_at,
        t.completed_at,
        sc.legalname as source_company_name,
        tc.legalname as target_company_name,
        CONCAT(su.firstname, ' ', su.lastname) as source_user_name,
        CONCAT(tu.firstname, ' ', tu.lastname) as target_user_name,
        CONCAT(tcust.firstname, ' ', tcust.lastname) as target_customer_name
      FROM wallet_transactions t
      LEFT JOIN companies sc ON t.source_company_id = sc.id
      LEFT JOIN companies tc ON t.target_company_id = tc.id
      LEFT JOIN users su ON t.source_user_id = su.id
      LEFT JOIN users tu ON t.target_user_id = tu.id
      LEFT JOIN customers tcust ON t.target_customer_id = tcust.id
      WHERE t.source_company_id = $1 OR t.target_company_id = $1
      ORDER BY t.created_at DESC
      LIMIT 50
    `, [companyId])

    const methodLabels: Record<string, string> = {
      'card_manual': 'Tarjeta Manual',
      'card_stripe': 'Tarjeta',
      'card_terminal': 'Terminal',
      'cash': 'Efectivo',
      'wire': 'Transferencia',
      'zelle': 'Zelle',
      'credit_charge': 'Cargo de Crédito'
    }

    const typeLabels: Record<string, string> = {
      'recharge': 'Recarga',
      'transfer_out': 'Transferencia Enviada',
      'transfer_in': 'Transferencia Recibida',
      'debit': 'Débito',
      'refund': 'Reembolso',
      'credit_charge': 'Cargo de Crédito'
    }

    const transactions = transactionsResult.rows.map(t => {
      // Determine if this is incoming or outgoing for the company
      const isOutgoing = t.source_company_id === companyId
      const isIncoming = t.target_company_id === companyId && t.source_company_id !== companyId

      // Build description
      let displayDescription = t.description || ''
      if (t.type === 'transfer_out') {
        displayDescription = `Transferencia a ${t.target_company_name || t.target_user_name || t.target_customer_name || 'Desconocido'}`
      } else if (t.type === 'transfer_in') {
        displayDescription = `Transferencia de ${t.source_company_name || t.source_user_name || 'Desconocido'}`
      } else if (t.type === 'recharge') {
        const targetName = t.target_company_name || t.target_user_name || t.target_customer_name || ''
        displayDescription = targetName ? `Recarga a ${targetName}` : 'Recarga'
      }

      return {
        id: t.id,
        transactionNumber: t.transaction_number,
        type: t.type,
        typeLabel: typeLabels[t.type] || t.type,
        sourceType: t.source_type,
        targetType: t.target_type,
        amount: parseFloat(t.amount),
        amountFormatted: `$${parseFloat(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        fee: parseFloat(t.fee || '0'),
        netAmount: parseFloat(t.net_amount),
        currency: t.currency,
        paymentMethod: t.payment_method,
        paymentMethodLabel: methodLabels[t.payment_method] || t.payment_method,
        paymentReference: t.payment_reference,
        status: t.status,
        description: displayDescription,
        createdAt: t.created_at,
        completedAt: t.completed_at,
        isOutgoing,
        isIncoming,
        // For display: positive if incoming, negative if outgoing
        displayAmount: isOutgoing && t.type !== 'recharge'
          ? -parseFloat(t.amount)
          : (t.type === 'recharge' && t.target_company_id !== companyId ? -parseFloat(t.amount) : parseFloat(t.amount)),
        targetName: t.target_company_name || t.target_user_name || t.target_customer_name,
        sourceName: t.source_company_name || t.source_user_name
      }
    })

    // 5. Calculate stats for the current month
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const statsResult = await db.query(`
      SELECT
        -- Recargas recibidas (donde la empresa es target)
        COALESCE(SUM(CASE WHEN type = 'recharge' AND target_company_id = $1 AND status = 'completed' THEN amount ELSE 0 END), 0) as recharges_received,
        COUNT(CASE WHEN type = 'recharge' AND target_company_id = $1 AND status = 'completed' THEN 1 END) as recharges_received_count,
        -- Recargas realizadas a otros (donde la empresa paga)
        COALESCE(SUM(CASE WHEN type = 'recharge' AND source_company_id = $1 AND target_company_id != $1 AND status = 'completed' THEN amount ELSE 0 END), 0) as recharges_made,
        COUNT(CASE WHEN type = 'recharge' AND source_company_id = $1 AND target_company_id != $1 AND status = 'completed' THEN 1 END) as recharges_made_count,
        -- Transferencias enviadas
        COALESCE(SUM(CASE WHEN type = 'transfer_out' AND source_company_id = $1 AND status = 'completed' THEN amount ELSE 0 END), 0) as transfers_out,
        COUNT(CASE WHEN type = 'transfer_out' AND source_company_id = $1 AND status = 'completed' THEN 1 END) as transfers_out_count,
        -- Transferencias recibidas
        COALESCE(SUM(CASE WHEN type = 'transfer_in' AND target_company_id = $1 AND status = 'completed' THEN amount ELSE 0 END), 0) as transfers_in,
        COUNT(CASE WHEN type = 'transfer_in' AND target_company_id = $1 AND status = 'completed' THEN 1 END) as transfers_in_count
      FROM wallet_transactions
      WHERE (source_company_id = $1 OR target_company_id = $1)
        AND created_at >= $2
    `, [companyId, startOfMonth.toISOString()])

    const stats = {
      rechargesReceived: {
        value: parseFloat(statsResult.rows[0].recharges_received || '0'),
        formatted: `$${parseFloat(statsResult.rows[0].recharges_received || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        count: parseInt(statsResult.rows[0].recharges_received_count || '0')
      },
      rechargesMade: {
        value: parseFloat(statsResult.rows[0].recharges_made || '0'),
        formatted: `$${parseFloat(statsResult.rows[0].recharges_made || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        count: parseInt(statsResult.rows[0].recharges_made_count || '0')
      },
      transfersOut: {
        value: parseFloat(statsResult.rows[0].transfers_out || '0'),
        formatted: `$${parseFloat(statsResult.rows[0].transfers_out || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        count: parseInt(statsResult.rows[0].transfers_out_count || '0')
      },
      transfersIn: {
        value: parseFloat(statsResult.rows[0].transfers_in || '0'),
        formatted: `$${parseFloat(statsResult.rows[0].transfers_in || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        count: parseInt(statsResult.rows[0].transfers_in_count || '0')
      }
    }

    // 6. Get pending recharge requests count
    const pendingResult = await db.query(`
      SELECT COUNT(*) as count
      FROM wallet_recharge_requests
      WHERE company_id = $1 AND status = 'pending'
    `, [companyId])

    const pendingRequests = parseInt(pendingResult.rows[0].count || '0')

    // 7. Calculate daily and monthly usage
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const usageResult = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= $2 THEN amount ELSE 0 END), 0) as daily_used,
        COALESCE(SUM(CASE WHEN created_at >= $3 THEN amount ELSE 0 END), 0) as monthly_used
      FROM wallet_transactions
      WHERE source_company_id = $1
        AND type IN ('transfer_out', 'recharge')
        AND status = 'completed'
    `, [companyId, today.toISOString(), startOfMonth.toISOString()])

    const dailyUsed = parseFloat(usageResult.rows[0].daily_used || '0')
    const monthlyUsed = parseFloat(usageResult.rows[0].monthly_used || '0')

    return NextResponse.json({
      success: true,
      data: {
        companyWallet: {
          ...companyWallet,
          dailyUsed,
          dailyUsedFormatted: `$${dailyUsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          monthlyUsed,
          monthlyUsedFormatted: `$${monthlyUsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        users,
        customers,
        transactions,
        stats,
        pendingRequests
      }
    })

  } catch (error) {
    console.error('Error fetching company dashboard:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener dashboard de empresa'
    }, { status: 500 })
  }
}
