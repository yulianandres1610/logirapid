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
 * GET /api/broker/orders
 * Get orders assigned to the broker's company
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

    // ALWAYS get companyId from cookie as primary source (more reliable)
    const companyIdCookie = cookieStore.get('user-company-id')?.value
    if (companyIdCookie) {
      payload.companyId = parseInt(companyIdCookie, 10)
      console.log(`[Broker Orders GET] Using companyId from cookie: ${payload.companyId}`)
    } else {
      console.log(`[Broker Orders GET] Using companyId from JWT: ${payload.companyId}`)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    console.log(`[Broker Orders GET] ====== DEBUG ======`)
    console.log(`[Broker Orders GET] User: ${payload.email}, companyId: ${payload.companyId}`)

    // Verify company is a broker
    const companyCheck = await db.query(`
      SELECT companytype, legalname, broker_province, broker_municipality
      FROM companies WHERE id = $1
    `, [payload.companyId])

    console.log(`[Broker Orders GET] Company check result:`, companyCheck.rows[0])

    if (companyCheck.rows.length === 0 || companyCheck.rows[0].companytype !== 'broker') {
      console.log(`[Broker Orders GET] ERROR: Company ${payload.companyId} is not a broker (type: ${companyCheck.rows[0]?.companytype})`)
      return NextResponse.json({
        success: false,
        error: 'Esta empresa no es un broker'
      }, { status: 403 })
    }

    const brokerProvince = companyCheck.rows[0].broker_province
    console.log(`[Broker Orders GET] Company ${companyCheck.rows[0].legalname} is a valid broker in province: ${brokerProvince}`)

    // Build query - include orders assigned to this broker OR in broker's province/municipality
    let whereClause = `WHERE (ro.broker_company_id = $1 OR (ro.broker_company_id IS NULL AND LOWER(ro.broker_province) = LOWER($2)))`
    const params: any[] = [payload.companyId, brokerProvince]

    if (status) {
      params.push(status)
      whereClause += ` AND ro.status = $${params.length}`
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
        br.amount as reserved_amount,
        br.status as reservation_status
      FROM remittance_orders ro
      LEFT JOIN companies sc ON ro.selling_company_id = sc.id
      LEFT JOIN broker_reservations br ON br.remittance_order_id = ro.id
      ${whereClause}
      ORDER BY
        CASE ro.status
          WHEN 'pending' THEN 1
          WHEN 'confirmed' THEN 2
          WHEN 'in_delivery' THEN 3
          ELSE 4
        END,
        ro.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    params.push(limit, offset)

    const result = await db.query(query, params)

    // Get stats - include orders assigned to this broker OR in broker's province/municipality
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
        COUNT(*) FILTER (WHERE status = 'in_delivery') as in_delivery_count,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        SUM(receive_amount) FILTER (WHERE status IN ('pending', 'confirmed', 'in_delivery')) as pending_amount,
        SUM(receive_amount) FILTER (WHERE status = 'delivered') as delivered_amount
      FROM remittance_orders
      WHERE broker_company_id = $1
        OR (broker_company_id IS NULL AND LOWER(broker_province) = LOWER($2))
    `, [payload.companyId, brokerProvince])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        orders: result.rows.map(row => ({
          id: row.id,
          orderNumber: row.order_number,
          status: row.status,
          // Recipient info
          recipientName: row.recipient_name,
          recipientPhone: row.recipient_phone,
          recipientAddress: row.recipient_address,
          recipientNeighborhood: row.recipient_neighborhood,
          recipientProvince: row.recipient_province,
          recipientMunicipality: row.recipient_municipality,
          recipientAddressReferences: row.recipient_address_references,
          recipientIdNumber: row.recipient_id_number,
          // Alternate contact
          hasAlternateContact: row.has_alternate_contact,
          alternateContactName: row.alternate_contact_name,
          alternateContactPhone: row.alternate_contact_phone,
          // Amounts
          receiveAmount: parseFloat(row.receive_amount),
          receiveCurrency: row.receive_currency,
          // Reservation
          reservedAmount: row.reserved_amount ? parseFloat(row.reserved_amount) : null,
          reservationStatus: row.reservation_status,
          // Times
          estimatedDelivery: row.estimated_delivery,
          createdAt: row.created_at,
          confirmedAt: row.confirmed_at,
          deliveredAt: row.delivered_at,
          // Selling company
          sellingCompanyName: row.selling_company_name
        })),
        stats: {
          // Names expected by dashboard
          pending: parseInt(stats.pending_count) || 0,
          confirmed: parseInt(stats.confirmed_count) || 0,
          inDelivery: parseInt(stats.in_delivery_count) || 0,
          delivered: parseInt(stats.delivered_count) || 0,
          cancelled: parseInt(stats.cancelled_count) || 0,
          rejected: parseInt(stats.rejected_count) || 0,
          total: parseInt(stats.total_count) || 0,
          // Additional useful stats
          pendingAmount: parseFloat(stats.pending_amount) || 0,
          deliveredAmount: parseFloat(stats.delivered_amount) || 0
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
    console.error('[Broker Orders API] GET error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener órdenes'
    }, { status: 500 })
  }
}

/**
 * POST /api/broker/orders
 * Update order status (accept, start delivery, complete, etc.)
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

    // ALWAYS get companyId from cookie as primary source (more reliable)
    const companyIdCookie = cookieStore.get('user-company-id')?.value
    if (companyIdCookie) {
      payload.companyId = parseInt(companyIdCookie, 10)
    }

    const body = await request.json()
    const { orderId, action, notes, deliveryProofPhoto, deliverySignature, rejectionReason } = body

    // Valid rejection reasons
    const REJECTION_REASONS = [
      'insufficient_funds',      // Sin fondos suficientes
      'out_of_coverage',         // Fuera de zona de cobertura
      'recipient_unreachable',   // No se puede contactar destinatario
      'invalid_information',     // Información incorrecta
      'schedule_conflict',       // Conflicto de horario
      'other'                    // Otro (con nota obligatoria)
    ]

    if (!orderId || !action) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere orderId y action'
      }, { status: 400 })
    }

    // Verify order belongs to this broker
    const orderCheck = await db.query(`
      SELECT * FROM remittance_orders
      WHERE id = $1 AND broker_company_id = $2
    `, [orderId, payload.companyId])

    if (orderCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderCheck.rows[0]

    // Handle different actions
    switch (action) {
      case 'accept': {
        if (order.status !== 'pending') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden aceptar órdenes pendientes'
          }, { status: 400 })
        }

        await db.query(`
          UPDATE remittance_orders
          SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [orderId])

        return NextResponse.json({
          success: true,
          message: 'Orden aceptada',
          data: { status: 'confirmed' }
        })
      }

      case 'start_delivery': {
        if (order.status !== 'confirmed') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden iniciar entregas de órdenes confirmadas'
          }, { status: 400 })
        }

        await db.query(`
          UPDATE remittance_orders
          SET status = 'in_delivery', in_delivery_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [orderId])

        return NextResponse.json({
          success: true,
          message: 'Entrega iniciada',
          data: { status: 'in_delivery' }
        })
      }

      case 'complete': {
        if (order.status !== 'in_delivery') {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden completar órdenes en entrega'
          }, { status: 400 })
        }

        // Use proper transaction with dedicated connection
        await db.transaction(async (client) => {
          // Update order
          await client.query(`
            UPDATE remittance_orders
            SET
              status = 'delivered',
              delivered_at = NOW(),
              delivered_by_user_id = $2,
              delivery_proof_photo = $3,
              delivery_signature = $4,
              delivery_notes = $5,
              updated_at = NOW()
            WHERE id = $1
          `, [orderId, payload.userId, deliveryProofPhoto, deliverySignature, notes])

          // Release broker funds (mark as used)
          await client.query(`
            SELECT release_broker_funds_delivered($1, $2)
          `, [orderId, payload.userId])
        })

        return NextResponse.json({
          success: true,
          message: 'Entrega completada',
          data: { status: 'delivered' }
        })
      }

      case 'reject': {
        // Brokers can reject pending or confirmed orders
        if (!['pending', 'confirmed'].includes(order.status)) {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden rechazar órdenes pendientes o confirmadas'
          }, { status: 400 })
        }

        // Validate rejection reason
        if (!rejectionReason || !REJECTION_REASONS.includes(rejectionReason)) {
          return NextResponse.json({
            success: false,
            error: `Se requiere un motivo de rechazo válido: ${REJECTION_REASONS.join(', ')}`
          }, { status: 400 })
        }

        // If reason is 'other', notes are required
        if (rejectionReason === 'other' && !notes) {
          return NextResponse.json({
            success: false,
            error: 'Se requiere una nota explicativa cuando el motivo es "otro"'
          }, { status: 400 })
        }

        // Use proper transaction with dedicated connection
        await db.transaction(async (client) => {
          // Update order - set to 'rejected' status so it can be reassigned
          await client.query(`
            UPDATE remittance_orders
            SET
              status = 'rejected',
              rejection_reason = $2,
              rejection_notes = $3,
              rejected_at = NOW(),
              rejected_by_user_id = $4,
              broker_company_id = NULL,
              updated_at = NOW()
            WHERE id = $1
          `, [orderId, rejectionReason, notes || null, payload.userId])

          // Return reserved funds to broker's available balance
          await client.query(`
            SELECT release_broker_funds_cancelled($1, $2, $3)
          `, [orderId, payload.userId, `Rechazado: ${rejectionReason}`])
        })

        return NextResponse.json({
          success: true,
          message: 'Orden rechazada. Los fondos han sido liberados.',
          data: {
            status: 'rejected',
            rejectionReason,
            fundsReleased: true
          }
        })
      }

      case 'cancel': {
        if (!['pending', 'confirmed'].includes(order.status)) {
          return NextResponse.json({
            success: false,
            error: 'Solo se pueden cancelar órdenes pendientes o confirmadas'
          }, { status: 400 })
        }

        // Use proper transaction with dedicated connection
        await db.transaction(async (client) => {
          // Update order
          await client.query(`
            UPDATE remittance_orders
            SET
              status = 'cancelled',
              cancelled_at = NOW(),
              cancelled_by_user_id = $2,
              cancellation_reason = $3,
              updated_at = NOW()
            WHERE id = $1
          `, [orderId, payload.userId, notes])

          // Return reserved funds to available
          await client.query(`
            SELECT release_broker_funds_cancelled($1, $2, $3)
          `, [orderId, payload.userId, notes])
        })

        return NextResponse.json({
          success: true,
          message: 'Orden cancelada',
          data: { status: 'cancelled' }
        })
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Acción desconocida: ${action}`
        }, { status: 400 })
    }

  } catch (error) {
    console.error('[Broker Orders API] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar acción'
    }, { status: 500 })
  }
}
