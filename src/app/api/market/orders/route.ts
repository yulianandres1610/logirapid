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
 * GET /api/market/orders
 * List all orders received by a market company
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
        error: 'Token invalido'
      }, { status: 401 })
    }

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT
        mo.id,
        mo.order_number,
        mo.customer_name,
        mo.customer_phone,
        mo.customer_email,
        mo.delivery_province,
        mo.delivery_municipality,
        mo.delivery_address,
        mo.subtotal,
        mo.delivery_fee,
        mo.service_fee,
        mo.total_amount,
        mo.currency,
        mo.status,
        mo.estimated_delivery,
        mo.created_at,
        mo.accepted_at,
        mo.preparing_at,
        mo.ready_at,
        mo.in_delivery_at,
        mo.delivered_at,
        c.legalname as agency_name,
        (SELECT COUNT(*) FROM market_order_lines WHERE order_id = mo.id) as line_count,
        (SELECT COALESCE(SUM(quantity), 0) FROM market_order_lines WHERE order_id = mo.id) as total_items
      FROM market_orders mo
      LEFT JOIN companies c ON mo.selling_company_id = c.id
      WHERE mo.market_company_id = $1
    `

    const queryParams: (string | number)[] = [companyId]
    let paramIndex = 2

    if (status && status !== 'all') {
      query += ` AND mo.status = $${paramIndex}`
      queryParams.push(status)
      paramIndex++
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total FROM market_orders
      WHERE market_company_id = $1
      ${status && status !== 'all' ? `AND status = '${status}'` : ''}
    `
    const countResult = await db.query(countQuery, [companyId])
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Add order and pagination
    query += ` ORDER BY mo.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Get stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count,
        COUNT(*) FILTER (WHERE status = 'preparing') as preparing_count,
        COUNT(*) FILTER (WHERE status = 'ready') as ready_count,
        COUNT(*) FILTER (WHERE status = 'in_delivery') as in_delivery_count,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
        COUNT(*) FILTER (WHERE status IN ('cancelled', 'rejected')) as cancelled_count,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered'), 0) as total_delivered_amount,
        COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('cancelled', 'rejected')), 0) as total_active_amount
      FROM market_orders
      WHERE market_company_id = $1
    `, [companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        orders: result.rows.map(row => ({
          id: row.id,
          orderNumber: row.order_number,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
          customerEmail: row.customer_email,
          deliveryProvince: row.delivery_province,
          deliveryMunicipality: row.delivery_municipality,
          deliveryAddress: row.delivery_address,
          subtotal: parseFloat(row.subtotal) || 0,
          deliveryFee: parseFloat(row.delivery_fee) || 0,
          serviceFee: parseFloat(row.service_fee) || 0,
          totalAmount: parseFloat(row.total_amount) || 0,
          currency: row.currency || 'USD',
          status: row.status,
          estimatedDelivery: row.estimated_delivery,
          createdAt: row.created_at,
          acceptedAt: row.accepted_at,
          preparingAt: row.preparing_at,
          readyAt: row.ready_at,
          inDeliveryAt: row.in_delivery_at,
          deliveredAt: row.delivered_at,
          agencyName: row.agency_name,
          lineCount: parseInt(row.line_count) || 0,
          totalItems: parseInt(row.total_items) || 0
        })),
        stats: {
          pending: parseInt(stats.pending_count) || 0,
          accepted: parseInt(stats.accepted_count) || 0,
          preparing: parseInt(stats.preparing_count) || 0,
          ready: parseInt(stats.ready_count) || 0,
          inDelivery: parseInt(stats.in_delivery_count) || 0,
          delivered: parseInt(stats.delivered_count) || 0,
          cancelled: parseInt(stats.cancelled_count) || 0,
          totalDeliveredAmount: parseFloat(stats.total_delivered_amount) || 0,
          totalActiveAmount: parseFloat(stats.total_active_amount) || 0
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Market Orders API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener ordenes'
    }, { status: 500 })
  }
}
