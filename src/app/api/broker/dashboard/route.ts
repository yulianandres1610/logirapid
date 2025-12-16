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
 * GET /api/broker/dashboard
 * Get broker dashboard stats including daily deliveries for the last 7 days
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

    // Verify company is a broker and get its province/municipality
    const companyCheck = await db.query(`
      SELECT companytype, broker_province, broker_municipality
      FROM companies WHERE id = $1
    `, [payload.companyId])

    if (companyCheck.rows.length === 0 || companyCheck.rows[0].companytype !== 'broker') {
      return NextResponse.json({
        success: false,
        error: 'Esta empresa no es un broker'
      }, { status: 403 })
    }

    const brokerProvince = companyCheck.rows[0].broker_province
    const brokerMunicipality = companyCheck.rows[0].broker_municipality

    // Get overall order stats - include orders assigned to this broker OR in broker's province/municipality
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
        COUNT(*) FILTER (WHERE status = 'in_delivery') as in_delivery_count,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COALESCE(SUM(receive_amount) FILTER (WHERE status IN ('pending', 'confirmed', 'in_delivery')), 0) as pending_amount,
        COALESCE(SUM(receive_amount) FILTER (WHERE status = 'delivered'), 0) as delivered_amount
      FROM remittance_orders
      WHERE broker_company_id = $1
        OR (broker_company_id IS NULL AND LOWER(broker_province) = LOWER($2))
    `, [payload.companyId, brokerProvince])

    const stats = statsResult.rows[0]

    // Get daily delivery stats for the last 7 days
    // Include orders assigned to this broker OR in broker's province/municipality
    const dailyStatsResult = await db.query(`
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date as delivery_date
      )
      SELECT
        ds.delivery_date,
        COALESCE(COUNT(ro.id), 0) as delivery_count,
        COALESCE(SUM(ro.receive_amount), 0) as delivery_amount
      FROM date_series ds
      LEFT JOIN remittance_orders ro ON
        DATE(ro.delivered_at) = ds.delivery_date
        AND ro.status = 'delivered'
        AND (
          ro.broker_company_id = $1
          OR (ro.broker_company_id IS NULL AND LOWER(ro.broker_province) = LOWER($2))
        )
      GROUP BY ds.delivery_date
      ORDER BY ds.delivery_date ASC
    `, [payload.companyId, brokerProvince])

    // Format daily stats with day names
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const dailyDeliveries = dailyStatsResult.rows.map(row => {
      const date = new Date(row.delivery_date)
      return {
        date: dayNames[date.getDay()],
        fullDate: row.delivery_date,
        count: parseInt(row.delivery_count) || 0,
        amount: parseFloat(row.delivery_amount) || 0
      }
    })

    // Get recent cash deliveries stats
    let cashDeliveryStats = {
      pending: 0,
      completed: 0,
      totalPending: 0,
      totalCompleted: 0
    }

    try {
      const cashResult = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
          COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending'), 0) as pending_amount,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'completed'), 0) as completed_amount
        FROM cash_delivery_orders
        WHERE broker_company_id = $1
      `, [payload.companyId])

      if (cashResult.rows.length > 0) {
        const cashStats = cashResult.rows[0]
        cashDeliveryStats = {
          pending: parseInt(cashStats.pending_count) || 0,
          completed: parseInt(cashStats.completed_count) || 0,
          totalPending: parseFloat(cashStats.pending_amount) || 0,
          totalCompleted: parseFloat(cashStats.completed_amount) || 0
        }
      }
    } catch (e) {
      // Table might not exist, ignore
      console.log('[Broker Dashboard] Cash delivery stats error:', e)
    }

    // Get recent movements/transactions
    let recentMovements: any[] = []
    try {
      const movementsResult = await db.query(`
        SELECT
          wt.id,
          wt.type,
          wt.amount,
          wt.currency,
          wt.status,
          wt.description,
          wt.created_at
        FROM wallet_transactions wt
        WHERE wt.source_company_id = $1 OR wt.target_company_id = $1
        ORDER BY wt.created_at DESC
        LIMIT 5
      `, [payload.companyId])

      recentMovements = movementsResult.rows.map(row => ({
        id: row.id,
        type: row.type,
        amount: parseFloat(row.amount) || 0,
        currency: row.currency || 'USD',
        status: row.status,
        description: row.description,
        createdAt: row.created_at
      }))
    } catch (e) {
      console.log('[Broker Dashboard] Recent movements error:', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        orderStats: {
          pending: parseInt(stats.pending_count) || 0,
          confirmed: parseInt(stats.confirmed_count) || 0,
          inDelivery: parseInt(stats.in_delivery_count) || 0,
          delivered: parseInt(stats.delivered_count) || 0,
          cancelled: parseInt(stats.cancelled_count) || 0,
          rejected: parseInt(stats.rejected_count) || 0,
          total: parseInt(stats.total_count) || 0,
          pendingAmount: parseFloat(stats.pending_amount) || 0,
          deliveredAmount: parseFloat(stats.delivered_amount) || 0
        },
        dailyDeliveries,
        cashDeliveryStats,
        recentMovements
      }
    })

  } catch (error) {
    console.error('[Broker Dashboard API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener dashboard'
    }, { status: 500 })
  }
}
