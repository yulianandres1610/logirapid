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
 * GET /api/wallet/dashboard
 * Returns wallet dashboard stats for SUPER_ADMIN
 *
 * Includes:
 * - Total balance across all wallets
 * - Recharges this month
 * - Transfers this month
 * - Active companies count
 * - Chart data: recharges by method, monthly trends
 * - Top 10 wallets by balance
 * - Pending requests count
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

    // Only SUPER_ADMIN can access full dashboard
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede acceder al dashboard'
      }, { status: 403 })
    }

    // Get current month range
    const now = new Date()
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // 1. Total balance and count from companies
    const companiesBalance = await db.query(`
      SELECT
        COALESCE(SUM(walletbalance), 0) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(*) as total_count,
        COUNT(CASE WHEN walletnumber IS NOT NULL THEN 1 END) as with_wallet
      FROM companies
    `)

    // 2. Total balance and count from users
    const usersBalance = await db.query(`
      SELECT
        COALESCE(SUM(wallet_balance), 0) as total,
        COUNT(*) as total_count,
        COUNT(CASE WHEN wallet_number IS NOT NULL THEN 1 END) as with_wallet
      FROM users
    `)

    // 3. Total balance and count from customers
    const customersBalance = await db.query(`
      SELECT
        COALESCE(SUM(wallet_balance), 0) as total,
        COUNT(*) as total_count,
        COUNT(CASE WHEN wallet_number IS NOT NULL THEN 1 END) as with_wallet
      FROM customers
    `)

    // Calculate totals
    const companiesBalanceTotal = parseFloat(companiesBalance.rows[0]?.total || '0')
    const usersBalanceTotal = parseFloat(usersBalance.rows[0]?.total || '0')
    const customersBalanceTotal = parseFloat(customersBalance.rows[0]?.total || '0')
    const totalBalance = companiesBalanceTotal + usersBalanceTotal + customersBalanceTotal

    const activeCompanies = parseInt(companiesBalance.rows[0]?.active_count || '0')
    const totalCompanies = parseInt(companiesBalance.rows[0]?.total_count || '0')
    const companiesWithWallet = parseInt(companiesBalance.rows[0]?.with_wallet || '0')
    const totalUsers = parseInt(usersBalance.rows[0]?.total_count || '0')
    const usersWithWallet = parseInt(usersBalance.rows[0]?.with_wallet || '0')
    const totalCustomers = parseInt(customersBalance.rows[0]?.total_count || '0')
    const customersWithWallet = parseInt(customersBalance.rows[0]?.with_wallet || '0')
    const totalWallets = companiesWithWallet + usersWithWallet + customersWithWallet

    // 3. Recharges this month
    const rechargesThisMonth = await db.query(`
      SELECT
        COALESCE(SUM(net_amount), 0) as total,
        COUNT(*) as count
      FROM wallet_transactions
      WHERE type = 'recharge'
        AND status = 'completed'
        AND created_at >= $1
        AND created_at <= $2
    `, [firstDayOfMonth, lastDayOfMonth])

    // 4. Recharges last month (for comparison)
    const rechargesLastMonth = await db.query(`
      SELECT COALESCE(SUM(net_amount), 0) as total
      FROM wallet_transactions
      WHERE type = 'recharge'
        AND status = 'completed'
        AND created_at >= $1
        AND created_at <= $2
    `, [firstDayLastMonth, lastDayLastMonth])

    // 5. Transfers this month
    const transfersThisMonth = await db.query(`
      SELECT
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as count
      FROM wallet_transactions
      WHERE type IN ('transfer_out', 'transfer_in')
        AND status = 'completed'
        AND created_at >= $1
        AND created_at <= $2
    `, [firstDayOfMonth, lastDayOfMonth])

    // 6. Transfers last month
    const transfersLastMonth = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM wallet_transactions
      WHERE type IN ('transfer_out', 'transfer_in')
        AND status = 'completed'
        AND created_at >= $1
        AND created_at <= $2
    `, [firstDayLastMonth, lastDayLastMonth])

    // 7. Recharges by payment method (for pie chart)
    const rechargesByMethod = await db.query(`
      SELECT
        payment_method,
        COALESCE(SUM(net_amount), 0) as total,
        COUNT(*) as count
      FROM wallet_transactions
      WHERE type = 'recharge'
        AND status = 'completed'
        AND created_at >= $1
      GROUP BY payment_method
      ORDER BY total DESC
    `, [firstDayOfMonth])

    // 8. Monthly trends (last 6 months) - including fees/commissions
    const monthlyTrends = await db.query(`
      SELECT
        DATE_TRUNC('month', created_at) as month,
        type,
        COALESCE(SUM(net_amount), 0) as total,
        COALESCE(SUM(fee), 0) as total_fees
      FROM wallet_transactions
      WHERE status = 'completed'
        AND created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
      GROUP BY DATE_TRUNC('month', created_at), type
      ORDER BY month ASC
    `)

    // Process monthly trends for chart
    const months: { [key: string]: { recharges: number, transfers: number, commissions: number } } = {}
    monthlyTrends.rows.forEach((row: any) => {
      const monthKey = new Date(row.month).toISOString().slice(0, 7)
      if (!months[monthKey]) {
        months[monthKey] = { recharges: 0, transfers: 0, commissions: 0 }
      }
      if (row.type === 'recharge') {
        months[monthKey].recharges += parseFloat(row.total)
        months[monthKey].commissions += parseFloat(row.total_fees || '0')
      } else if (row.type === 'transfer_out' || row.type === 'transfer_in') {
        months[monthKey].transfers += parseFloat(row.total) / 2 // Divide by 2 to avoid double counting
        months[monthKey].commissions += parseFloat(row.total_fees || '0') / 2
      }
    })

    const trendData = Object.entries(months).map(([month, data]) => ({
      month,
      recharges: data.recharges,
      transfers: data.transfers,
      commissions: data.commissions
    }))

    // 9. Top 10 wallets by balance (all types: companies, users, customers)
    const topWallets = await db.query(`
      (
        SELECT
          id,
          legalname as name,
          walletnumber as wallet_number,
          walletbalance as balance,
          status,
          dailylimit as daily_limit,
          monthlylimit as monthly_limit,
          'company' as type
        FROM companies
        WHERE walletbalance IS NOT NULL
          AND walletbalance > 0
          AND walletnumber IS NOT NULL
      )
      UNION ALL
      (
        SELECT
          id,
          CONCAT(firstname, ' ', lastname) as name,
          wallet_number,
          wallet_balance as balance,
          status,
          NULL as daily_limit,
          NULL as monthly_limit,
          'user' as type
        FROM users
        WHERE wallet_balance IS NOT NULL
          AND wallet_balance > 0
          AND wallet_number IS NOT NULL
      )
      UNION ALL
      (
        SELECT
          id,
          CONCAT(firstname, ' ', lastname) as name,
          wallet_number,
          wallet_balance as balance,
          'active' as status,
          NULL as daily_limit,
          NULL as monthly_limit,
          'customer' as type
        FROM customers
        WHERE wallet_balance IS NOT NULL
          AND wallet_balance > 0
          AND wallet_number IS NOT NULL
      )
      ORDER BY balance DESC
      LIMIT 10
    `)

    // 9b. Calculate daily and monthly usage for top wallets (money coming IN)
    const walletNumbers = topWallets.rows.map((r: any) => r.wallet_number).filter(Boolean)

    let walletUsageMap: { [key: string]: { dailyUsed: number, monthlyUsed: number } } = {}

    if (walletNumbers.length > 0) {
      // Get today's start
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      // Calculate daily usage (recharges + transfer_in for today)
      const dailyUsage = await db.query(`
        SELECT
          target_wallet_number,
          COALESCE(SUM(net_amount), 0) as daily_total
        FROM wallet_transactions
        WHERE target_wallet_number = ANY($1)
          AND type IN ('recharge', 'transfer_in')
          AND status = 'completed'
          AND created_at >= $2
        GROUP BY target_wallet_number
      `, [walletNumbers, todayStart])

      // Calculate monthly usage (recharges + transfer_in for this month)
      const monthlyUsage = await db.query(`
        SELECT
          target_wallet_number,
          COALESCE(SUM(net_amount), 0) as monthly_total
        FROM wallet_transactions
        WHERE target_wallet_number = ANY($1)
          AND type IN ('recharge', 'transfer_in')
          AND status = 'completed'
          AND created_at >= $2
          AND created_at <= $3
        GROUP BY target_wallet_number
      `, [walletNumbers, firstDayOfMonth, lastDayOfMonth])

      // Build usage map
      dailyUsage.rows.forEach((row: any) => {
        if (!walletUsageMap[row.target_wallet_number]) {
          walletUsageMap[row.target_wallet_number] = { dailyUsed: 0, monthlyUsed: 0 }
        }
        walletUsageMap[row.target_wallet_number].dailyUsed = parseFloat(row.daily_total)
      })

      monthlyUsage.rows.forEach((row: any) => {
        if (!walletUsageMap[row.target_wallet_number]) {
          walletUsageMap[row.target_wallet_number] = { dailyUsed: 0, monthlyUsed: 0 }
        }
        walletUsageMap[row.target_wallet_number].monthlyUsed = parseFloat(row.monthly_total)
      })
    }

    // 10. Pending recharge requests
    const pendingRequests = await db.query(`
      SELECT COUNT(*) as count
      FROM wallet_recharge_requests
      WHERE status = 'pending'
    `)

    // 11. Pending transactions (not just requests)
    const pendingTransactions = await db.query(`
      SELECT COUNT(*) as count
      FROM wallet_transactions
      WHERE status = 'pending'
    `)

    // Calculate percentage changes
    const rechargesCurrentTotal = parseFloat(rechargesThisMonth.rows[0]?.total || '0')
    const rechargesLastTotal = parseFloat(rechargesLastMonth.rows[0]?.total || '0')
    const rechargesChange = rechargesLastTotal > 0
      ? ((rechargesCurrentTotal - rechargesLastTotal) / rechargesLastTotal * 100).toFixed(1)
      : '0'

    const transfersCurrentTotal = parseFloat(transfersThisMonth.rows[0]?.total || '0')
    const transfersLastTotal = parseFloat(transfersLastMonth.rows[0]?.total || '0')
    const transfersChange = transfersLastTotal > 0
      ? ((transfersCurrentTotal - transfersLastTotal) / transfersLastTotal * 100).toFixed(1)
      : '0'

    // Map payment methods to Spanish labels
    const methodLabels: { [key: string]: string } = {
      'card_manual': 'Tarjeta Manual',
      'card_terminal': 'Terminal',
      'cash': 'Efectivo',
      'wire': 'Transferencia',
      'zelle': 'Zelle',
      'credit_charge': 'Cargo de Crédito'
    }

    const chartByMethod = rechargesByMethod.rows.map((row: any) => ({
      method: methodLabels[row.payment_method] || row.payment_method || 'Otro',
      total: parseFloat(row.total),
      count: parseInt(row.count)
    }))

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalBalance: {
            value: totalBalance,
            formatted: `$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          },
          rechargesThisMonth: {
            value: rechargesCurrentTotal,
            formatted: `$${rechargesCurrentTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: parseFloat(rechargesChange),
            count: parseInt(rechargesThisMonth.rows[0]?.count || '0')
          },
          transfersThisMonth: {
            value: transfersCurrentTotal / 2, // Divide by 2 since we count both in and out
            formatted: `$${(transfersCurrentTotal / 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: parseFloat(transfersChange),
            count: Math.floor(parseInt(transfersThisMonth.rows[0]?.count || '0') / 2)
          },
          activeCompanies: {
            value: activeCompanies
          },
          pendingRequests: {
            value: parseInt(pendingRequests.rows[0]?.count || '0')
          },
          pendingTransactions: {
            value: parseInt(pendingTransactions.rows[0]?.count || '0')
          },
          totalWallets: {
            value: totalWallets,
            companies: companiesWithWallet,
            users: usersWithWallet,
            customers: customersWithWallet
          },
          totalCompanies: {
            value: totalCompanies,
            balance: companiesBalanceTotal,
            balanceFormatted: `$${companiesBalanceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          },
          totalUsers: {
            value: totalUsers,
            balance: usersBalanceTotal,
            balanceFormatted: `$${usersBalanceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          },
          totalCustomers: {
            value: totalCustomers,
            balance: customersBalanceTotal,
            balanceFormatted: `$${customersBalanceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
        },
        charts: {
          rechargesByMethod: chartByMethod,
          monthlyTrends: trendData
        },
        topWallets: topWallets.rows.map((row: any) => {
          const usage = walletUsageMap[row.wallet_number] || { dailyUsed: 0, monthlyUsed: 0 }
          return {
            id: row.id,
            name: row.name,
            walletNumber: row.wallet_number,
            balance: parseFloat(row.balance),
            balanceFormatted: `$${parseFloat(row.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            status: row.status,
            type: row.type,
            dailyLimit: parseFloat(row.daily_limit || '5000'),
            monthlyLimit: parseFloat(row.monthly_limit || '50000'),
            dailyUsed: usage.dailyUsed,
            monthlyUsed: usage.monthlyUsed
          }
        })
      }
    })

  } catch (error) {
    console.error('Error fetching wallet dashboard:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener dashboard'
    }, { status: 500 })
  }
}
