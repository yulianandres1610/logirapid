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
 * List all brokers with stats (SUPER_ADMIN only)
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

    // Build query
    let whereClause = "WHERE c.companytype = 'broker'"
    const params: any[] = []

    if (province) {
      params.push(province)
      whereClause += ` AND c.broker_province = $${params.length}`
    }

    if (active !== null) {
      params.push(active === 'true')
      whereClause += ` AND c.broker_is_active = $${params.length}`
    }

    // Get brokers with stats
    const result = await db.query(`
      SELECT
        c.id,
        c.legalname,
        c.broker_province,
        c.broker_municipality,
        c.broker_delivery_hours,
        c.broker_contact_phone,
        c.broker_is_active,
        c.broker_max_daily_amount,
        c.created_at,
        -- Wallet balances as JSON
        COALESCE(
          (SELECT json_agg(json_build_object(
            'currency', bwb.currency,
            'available', bwb.available_balance,
            'reserved', bwb.reserved_balance,
            'total', bwb.total_balance
          ))
          FROM broker_wallet_balances bwb
          WHERE bwb.company_id = c.id
          ), '[]'
        ) as wallet_balances,
        -- Order stats
        (SELECT COUNT(*) FROM remittance_orders ro WHERE ro.broker_company_id = c.id AND ro.status = 'pending') as pending_orders,
        (SELECT COUNT(*) FROM remittance_orders ro WHERE ro.broker_company_id = c.id AND ro.status IN ('confirmed', 'in_delivery')) as active_orders,
        (SELECT COUNT(*) FROM remittance_orders ro WHERE ro.broker_company_id = c.id AND ro.status = 'delivered') as delivered_orders,
        (SELECT SUM(receive_amount) FROM remittance_orders ro WHERE ro.broker_company_id = c.id AND ro.status = 'delivered') as total_delivered_amount
      FROM companies c
      ${whereClause}
      ORDER BY c.broker_province, c.legalname
    `, params)

    // Get overall stats
    const statsResult = await db.query(`
      SELECT
        COUNT(DISTINCT c.id) as total_brokers,
        COUNT(DISTINCT c.id) FILTER (WHERE c.broker_is_active = true) as active_brokers,
        COUNT(DISTINCT c.broker_province) as provinces_covered,
        (SELECT COUNT(*) FROM remittance_orders WHERE status = 'pending') as total_pending_orders,
        (SELECT SUM(available_balance) FROM broker_wallet_balances WHERE currency = 'USD') as total_usd_available,
        (SELECT SUM(reserved_balance) FROM broker_wallet_balances WHERE currency = 'USD') as total_usd_reserved
      FROM companies c
      WHERE c.companytype = 'broker'
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

    return NextResponse.json({
      success: true,
      data: {
        brokers: result.rows.map(row => ({
          id: row.id,
          name: row.legalname,
          province: row.broker_province,
          municipality: row.broker_municipality,
          deliveryHours: row.broker_delivery_hours,
          contactPhone: row.broker_contact_phone,
          isActive: row.broker_is_active,
          maxDailyAmount: row.broker_max_daily_amount ? parseFloat(row.broker_max_daily_amount) : null,
          createdAt: row.created_at,
          walletBalances: row.wallet_balances || [],
          stats: {
            pendingOrders: parseInt(row.pending_orders) || 0,
            activeOrders: parseInt(row.active_orders) || 0,
            deliveredOrders: parseInt(row.delivered_orders) || 0,
            totalDeliveredAmount: parseFloat(row.total_delivered_amount) || 0
          }
        })),
        summary: {
          totalBrokers: parseInt(stats.total_brokers) || 0,
          activeBrokers: parseInt(stats.active_brokers) || 0,
          provincesCovered: parseInt(stats.provinces_covered) || 0,
          totalPendingOrders: parseInt(stats.total_pending_orders) || 0,
          totalUsdAvailable: parseFloat(stats.total_usd_available) || 0,
          totalUsdReserved: parseFloat(stats.total_usd_reserved) || 0
        },
        provinces: provincesResult.rows.map(row => ({
          name: row.province,
          brokerCount: parseInt(row.broker_count)
        }))
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
