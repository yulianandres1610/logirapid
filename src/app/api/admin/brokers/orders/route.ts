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
 * GET /api/admin/brokers/orders
 * List all remittance orders across all brokers (SUPER_ADMIN only)
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const brokerId = searchParams.get('brokerId')
    const province = searchParams.get('province')
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const offset = (page - 1) * limit
    const params: any[] = []
    let whereClause = 'WHERE 1=1'

    if (status) {
      params.push(status)
      whereClause += ` AND ro.status = $${params.length}`
    }

    if (brokerId) {
      params.push(parseInt(brokerId))
      whereClause += ` AND ro.broker_company_id = $${params.length}`
    }

    if (province) {
      params.push(province)
      whereClause += ` AND ro.recipient_province = $${params.length}`
    }

    if (search) {
      params.push(`%${search}%`)
      const searchParam = params.length
      whereClause += ` AND (
        ro.order_number ILIKE $${searchParam}
        OR ro.recipient_name ILIKE $${searchParam}
        OR ro.sender_name ILIKE $${searchParam}
      )`
    }

    if (dateFrom) {
      params.push(dateFrom)
      whereClause += ` AND ro.created_at >= $${params.length}::date`
    }

    if (dateTo) {
      params.push(dateTo)
      whereClause += ` AND ro.created_at <= ($${params.length}::date + interval '1 day')`
    }

    // Count total
    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM remittance_orders ro ${whereClause}
    `, params)
    const total = parseInt(countResult.rows[0].total)

    // Get orders
    const query = `
      SELECT
        ro.*,
        sc.legalname as selling_company_name,
        bc.legalname as broker_company_name,
        COALESCE(su.firstname || ' ' || su.lastname, su.firstname, su.lastname, '') as sold_by_name,
        COALESCE(du.firstname || ' ' || du.lastname, du.firstname, du.lastname, '') as delivered_by_name
      FROM remittance_orders ro
      LEFT JOIN companies sc ON ro.selling_company_id = sc.id
      LEFT JOIN companies bc ON ro.broker_company_id = bc.id
      LEFT JOIN users su ON ro.sold_by_user_id = su.id
      LEFT JOIN users du ON ro.delivered_by_user_id = du.id
      ${whereClause}
      ORDER BY ro.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `

    params.push(limit, offset)
    const result = await db.query(query, params)

    // Get status counts
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'in_delivery') as in_delivery,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        SUM(total_charged) FILTER (WHERE status = 'delivered') as total_revenue,
        SUM(receive_amount) FILTER (WHERE status = 'delivered') as total_delivered
      FROM remittance_orders
    `)

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        orders: result.rows.map(row => ({
          id: row.id,
          orderNumber: row.order_number,
          status: row.status,
          paymentStatus: row.payment_status,
          // Amounts
          sendAmount: parseFloat(row.send_amount),
          sendCurrency: row.send_currency,
          receiveAmount: parseFloat(row.receive_amount),
          receiveCurrency: row.receive_currency,
          totalCharged: parseFloat(row.total_charged),
          serviceFee: parseFloat(row.service_fee) || 0,
          deliveryFee: parseFloat(row.delivery_fee) || 0,
          // Recipient
          recipientName: row.recipient_name,
          recipientPhone: row.recipient_phone,
          recipientProvince: row.recipient_province,
          recipientMunicipality: row.recipient_municipality,
          recipientAddress: row.recipient_address,
          // Sender
          senderName: row.sender_name,
          senderPhone: row.sender_phone,
          // Companies
          sellingCompanyId: row.selling_company_id,
          sellingCompanyName: row.selling_company_name,
          brokerCompanyId: row.broker_company_id,
          brokerCompanyName: row.broker_company_name,
          // Users
          soldByName: row.sold_by_name,
          deliveredByName: row.delivered_by_name,
          // Times
          estimatedDelivery: row.estimated_delivery,
          createdAt: row.created_at,
          confirmedAt: row.confirmed_at,
          deliveredAt: row.delivered_at,
          cancelledAt: row.cancelled_at,
          // Payment
          paymentMethod: row.payment_method,
          paymentReference: row.payment_reference
        })),
        stats: {
          total: parseInt(stats.total) || 0,
          pending: parseInt(stats.pending) || 0,
          confirmed: parseInt(stats.confirmed) || 0,
          inDelivery: parseInt(stats.in_delivery) || 0,
          delivered: parseInt(stats.delivered) || 0,
          cancelled: parseInt(stats.cancelled) || 0,
          totalRevenue: parseFloat(stats.total_revenue) || 0,
          totalDelivered: parseFloat(stats.total_delivered) || 0
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
    console.error('[Admin Brokers Orders API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener órdenes'
    }, { status: 500 })
  }
}

/**
 * POST /api/admin/brokers/orders
 * Reassign order to different broker (SUPER_ADMIN only)
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

    // Only SUPER_ADMIN can access
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({
        success: false,
        error: 'Solo SUPER_ADMIN puede acceder'
      }, { status: 403 })
    }

    const body = await request.json()
    const { orderId, newBrokerId, notes } = body

    if (!orderId || !newBrokerId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere orderId y newBrokerId'
      }, { status: 400 })
    }

    // Verify order exists and can be reassigned
    const orderCheck = await db.query(`
      SELECT * FROM remittance_orders WHERE id = $1
    `, [orderId])

    if (orderCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderCheck.rows[0]

    if (!['pending', 'confirmed'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden reasignar órdenes pendientes o confirmadas'
      }, { status: 400 })
    }

    // Verify new broker exists
    const brokerCheck = await db.query(`
      SELECT id, legalname FROM companies WHERE id = $1 AND companytype = 'broker'
    `, [newBrokerId])

    if (brokerCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Broker no encontrado'
      }, { status: 404 })
    }

    await db.query('BEGIN')

    try {
      // If there was a previous reservation, cancel it
      if (order.broker_company_id) {
        await db.query(`
          SELECT release_broker_funds_cancelled($1, $2, $3)
        `, [orderId, payload.userId, `Reasignado a broker ${brokerCheck.rows[0].legalname}`])
      }

      // Update order with new broker
      await db.query(`
        UPDATE remittance_orders
        SET
          broker_company_id = $2,
          status = 'pending',
          confirmed_at = NULL,
          updated_at = NOW()
        WHERE id = $1
      `, [orderId, newBrokerId])

      // Try to reserve funds in new broker
      const reserveResult = await db.query(`
        SELECT reserve_broker_funds($1, $2, $3, $4, $5) as success
      `, [newBrokerId, order.receive_currency, order.receive_amount, orderId, payload.userId])

      if (reserveResult.rows[0]?.success) {
        await db.query(`
          UPDATE remittance_orders SET estimated_delivery = '1-24 horas' WHERE id = $1
        `, [orderId])
      } else {
        await db.query(`
          UPDATE remittance_orders SET estimated_delivery = '1-3 días' WHERE id = $1
        `, [orderId])
      }

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Orden reasignada a ${brokerCheck.rows[0].legalname}`,
        data: {
          orderId,
          newBrokerId,
          newBrokerName: brokerCheck.rows[0].legalname
        }
      })

    } catch (err) {
      await db.query('ROLLBACK')
      throw err
    }

  } catch (error) {
    console.error('[Admin Brokers Orders API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al reasignar orden'
    }, { status: 500 })
  }
}
