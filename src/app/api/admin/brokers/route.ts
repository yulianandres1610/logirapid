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
 * GET /api/admin/brokers
 * List all broker companies with their wallet info (SUPER_ADMIN only)
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
    const province = searchParams.get('province')
    const active = searchParams.get('active')

    // Build query - filter companies by type 'broker'
    let whereClause = "WHERE c.companytype = 'broker'"
    const params: any[] = []

    if (province) {
      params.push(province)
      whereClause += ` AND c.broker_province = $${params.length}`
    }

    if (active !== null && active !== '') {
      params.push(active === 'true')
      whereClause += ` AND COALESCE(c.broker_is_active, c.status = 'active') = $${params.length}`
    }

    // Get brokers with wallet info from companies table
    const result = await db.query(`
      SELECT
        c.id,
        c.legalname,
        COALESCE("walletNumber", walletnumber) as wallet_number,
        COALESCE("walletBalance"::numeric, walletbalance, 0) as wallet_balance,
        c.currency,
        c.broker_province,
        c.broker_municipality,
        c.broker_delivery_hours,
        c.broker_contact_phone,
        COALESCE(c.broker_is_active, c.status = 'active') as is_active,
        c.broker_max_daily_amount,
        c.phone,
        c.email,
        c.logo,
        c.latitude,
        c.longitude,
        c.createdat as created_at,
        c.status,
        -- Get transaction stats
        (SELECT COUNT(*) FROM wallet_transactions wt
         WHERE (wt.source_company_id = c.id OR wt.target_company_id = c.id)
         AND wt.status = 'completed') as total_transactions,
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions wt
         WHERE wt.target_company_id = c.id
         AND wt.type IN ('recharge', 'transfer_in', 'deposit')
         AND wt.status = 'completed') as total_deposits,
        (SELECT COALESCE(SUM(amount), 0) FROM wallet_transactions wt
         WHERE wt.source_company_id = c.id
         AND wt.type IN ('transfer_out', 'withdrawal', 'debit')
         AND wt.status = 'completed') as total_withdrawals
      FROM companies c
      ${whereClause}
      ORDER BY c.legalname
    `, params)

    // Get overall stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_brokers,
        COUNT(*) FILTER (WHERE COALESCE(broker_is_active, status = 'active') = true) as active_brokers,
        COUNT(DISTINCT broker_province) FILTER (WHERE broker_province IS NOT NULL) as provinces_covered,
        COALESCE(SUM(COALESCE("walletBalance"::numeric, walletbalance, 0)), 0) as total_balance
      FROM companies
      WHERE companytype = 'broker'
    `)

    const stats = statsResult.rows[0]

    // Get provinces with broker count
    const provincesResult = await db.query(`
      SELECT
        broker_province as province,
        COUNT(*) as broker_count
      FROM companies
      WHERE companytype = 'broker' AND broker_province IS NOT NULL
      GROUP BY broker_province
      ORDER BY broker_province
    `)

    // Try to get remittance order stats (may not exist yet)
    let orderStats = {
      total: 0,
      pending: 0,
      confirmed: 0,
      inDelivery: 0,
      delivered: 0,
      cancelled: 0,
      totalAmount: 0
    }

    try {
      const orderStatsResult = await db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
          COUNT(*) FILTER (WHERE status = 'in_delivery') as in_delivery,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          COALESCE(SUM(total_charged), 0) as total_amount
        FROM remittance_orders
      `)
      if (orderStatsResult.rows.length > 0) {
        const os = orderStatsResult.rows[0]
        orderStats = {
          total: parseInt(os.total) || 0,
          pending: parseInt(os.pending) || 0,
          confirmed: parseInt(os.confirmed) || 0,
          inDelivery: parseInt(os.in_delivery) || 0,
          delivered: parseInt(os.delivered) || 0,
          cancelled: parseInt(os.cancelled) || 0,
          totalAmount: parseFloat(os.total_amount) || 0
        }
      }
    } catch {
      // Table may not exist yet, use defaults
    }

    return NextResponse.json({
      success: true,
      data: {
        brokers: result.rows.map(row => ({
          id: row.id,
          name: row.legalname,
          tradeName: row.legalname,
          walletNumber: row.wallet_number,
          walletBalance: parseFloat(row.wallet_balance) || 0,
          walletBalanceFormatted: `$${(parseFloat(row.wallet_balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          currency: row.currency || 'USD',
          province: row.broker_province,
          municipality: row.broker_municipality,
          deliveryHours: row.broker_delivery_hours,
          contactPhone: row.broker_contact_phone || row.phone,
          email: row.email,
          logo: row.logo,
          latitude: row.latitude ? parseFloat(row.latitude) : null,
          longitude: row.longitude ? parseFloat(row.longitude) : null,
          isActive: row.is_active,
          status: row.status,
          maxDailyAmount: row.broker_max_daily_amount ? parseFloat(row.broker_max_daily_amount) : null,
          createdAt: row.created_at,
          stats: {
            totalTransactions: parseInt(row.total_transactions) || 0,
            totalDeposits: parseFloat(row.total_deposits) || 0,
            totalWithdrawals: parseFloat(row.total_withdrawals) || 0
          }
        })),
        summary: {
          totalBrokers: parseInt(stats.total_brokers) || 0,
          activeBrokers: parseInt(stats.active_brokers) || 0,
          provincesCovered: parseInt(stats.provinces_covered) || 0,
          totalBalance: parseFloat(stats.total_balance) || 0,
          totalBalanceFormatted: `$${(parseFloat(stats.total_balance) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        },
        provinces: provincesResult.rows.map(row => ({
          name: row.province,
          brokerCount: parseInt(row.broker_count)
        })),
        orderStats
      }
    })

  } catch (error) {
    console.error('[Admin Brokers API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener brokers'
    }, { status: 500 })
  }
}
