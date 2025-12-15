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
 * GET /api/remittance-orders/[id]
 * Get a single remittance order by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Build query based on role
    let whereClause = 'WHERE ro.id = $1'
    const queryParams: any[] = [orderId]

    // Non-SUPER_ADMIN can only see their company's orders
    if (payload.role !== 'SUPER_ADMIN') {
      whereClause += ' AND (ro.selling_company_id = $2 OR ro.broker_company_id = $2)'
      queryParams.push(payload.companyId)
    }

    const query = `
      SELECT
        ro.*,
        sc.legalname as selling_company_name,
        bc.legalname as broker_company_name,
        bc.broker_contact_phone as broker_phone,
        bc.broker_province as broker_province,
        bc.broker_municipality as broker_municipality,
        COALESCE(su.firstname || ' ' || su.lastname, su.firstname, su.lastname, '') as sold_by_name,
        COALESCE(du.firstname || ' ' || du.lastname, du.firstname, du.lastname, '') as delivered_by_name,
        su.email as sold_by_email,
        du.email as delivered_by_email
      FROM remittance_orders ro
      LEFT JOIN companies sc ON ro.selling_company_id = sc.id
      LEFT JOIN companies bc ON ro.broker_company_id = bc.id
      LEFT JOIN users su ON ro.sold_by_user_id = su.id
      LEFT JOIN users du ON ro.delivered_by_user_id = du.id
      ${whereClause}
    `

    const result = await db.query(query, queryParams)

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const row = result.rows[0]

    // Format the order data
    const order = {
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      paymentStatus: row.payment_status,

      // Amounts
      sendAmount: parseFloat(row.send_amount),
      sendCurrency: row.send_currency,
      receiveAmount: parseFloat(row.receive_amount),
      receiveCurrency: row.receive_currency,
      exchangeRate: parseFloat(row.exchange_rate) || 1,
      totalCharged: parseFloat(row.total_charged),
      serviceFee: parseFloat(row.service_fee) || 0,
      serviceFeePercentage: parseFloat(row.service_fee_percentage) || 0,
      deliveryFee: parseFloat(row.delivery_fee) || 0,

      // Recipient
      recipientName: row.recipient_name,
      recipientPhone: row.recipient_phone,
      recipientIdNumber: row.recipient_id_number,
      recipientAddress: row.recipient_address,
      recipientNeighborhood: row.recipient_neighborhood,
      recipientProvince: row.recipient_province,
      recipientMunicipality: row.recipient_municipality,
      recipientAddressReferences: row.recipient_address_references,
      recipientLatitude: row.recipient_latitude ? parseFloat(row.recipient_latitude) : null,
      recipientLongitude: row.recipient_longitude ? parseFloat(row.recipient_longitude) : null,

      // Alternate contact
      hasAlternateContact: row.has_alternate_contact,
      alternateContactName: row.alternate_contact_name,
      alternateContactPhone: row.alternate_contact_phone,

      // Sender
      senderName: row.sender_name,
      senderPhone: row.sender_phone,
      senderEmail: row.sender_email,
      senderIdType: row.sender_id_type,
      senderIdNumber: row.sender_id_number,

      // Companies
      sellingCompanyId: row.selling_company_id,
      sellingCompanyName: row.selling_company_name,
      brokerCompanyId: row.broker_company_id,
      brokerCompanyName: row.broker_company_name,
      brokerPhone: row.broker_phone,
      brokerProvince: row.broker_province,
      brokerMunicipality: row.broker_municipality,

      // Users
      soldByUserId: row.sold_by_user_id,
      soldByName: row.sold_by_name,
      soldByEmail: row.sold_by_email,
      deliveredByUserId: row.delivered_by_user_id,
      deliveredByName: row.delivered_by_name,
      deliveredByEmail: row.delivered_by_email,

      // Product/Service
      productId: row.product_id,
      productName: row.product_name,
      serviceType: row.service_type,

      // Delivery
      estimatedDelivery: row.estimated_delivery,

      // Payment
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      cashReceived: row.cash_received ? parseFloat(row.cash_received) : null,
      cashChange: row.cash_change ? parseFloat(row.cash_change) : null,

      // Delivery proof
      deliveryProofId: row.delivery_proof_id,
      deliveredAt: row.delivered_at,
      deliveryProofPhoto: row.delivery_proof_photo,
      deliverySignature: row.delivery_signature,
      deliveryNotes: row.delivery_notes,

      // Rejection
      rejectionReason: row.rejection_reason,
      rejectionNotes: row.rejection_notes,
      rejectedAt: row.rejected_at,
      rejectedByUserId: row.rejected_by_user_id,

      // Cancellation
      cancelledAt: row.cancelled_at,
      cancelledByUserId: row.cancelled_by_user_id,
      cancellationReason: row.cancellation_reason,

      // Timestamps
      confirmedAt: row.confirmed_at,
      inDeliveryAt: row.in_delivery_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }

    // Get status history if needed
    const historyQuery = `
      SELECT * FROM remittance_order_status_history
      WHERE remittance_order_id = $1
      ORDER BY created_at DESC
    `
    let statusHistory: any[] = []
    try {
      const historyResult = await db.query(historyQuery, [orderId])
      statusHistory = historyResult.rows.map(h => ({
        id: h.id,
        status: h.status,
        notes: h.notes,
        createdBy: h.created_by,
        createdAt: h.created_at
      }))
    } catch {
      // Table might not exist, ignore
    }

    return NextResponse.json({
      success: true,
      data: {
        order,
        statusHistory
      }
    })

  } catch (error) {
    console.error('[Remittance Order API] GET by ID error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener la orden'
    }, { status: 500 })
  }
}
