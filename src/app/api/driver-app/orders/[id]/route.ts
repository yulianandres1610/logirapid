import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

async function getUserFromToken() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (!token) return null

    const secret = process.env.JWT_SECRET || 'secret-key-for-development'
    const decoded = jwt.verify(token, secret) as any

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      companyId: decoded.companyId
    }
  } catch (error) {
    return null
  }
}

// GET: Get order details with sender, recipient, products
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden invalido'
      }, { status: 400 })
    }

    const user = await getUserFromToken()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    // Get order details
    const orderResult = await db.query(`
      SELECT
        po.id,
        po.ordernumber as "orderNumber",
        po.status,
        po.payment_status as "paymentStatus",
        po.shipping_type as "shippingType",
        po.totalamount as "totalAmount",
        po.paid_amount as "paidAmount",
        po.createdat as "createdAt",
        po.notes,
        po.sender_id as "senderId",
        po.sender_name as "senderName",
        po.sender_phone as "senderPhone",
        po.sender_address as "senderAddress",
        po.sender_city as "senderCity",
        po.sender_state as "senderState",
        po.sender_zip as "senderZip",
        po.sender_latitude as "senderLatitude",
        po.sender_longitude as "senderLongitude",
        po.recipient_id as "recipientId",
        po.recipient_name as "recipientName",
        po.recipient_phone as "recipientPhone",
        po.recipient_address as "recipientAddress",
        po.recipient_city as "recipientCity",
        po.recipient_state as "recipientState"
      FROM package_orders po
      WHERE po.id = $1 AND po.company_id = $2
    `, [orderId, user.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get sender address details from customer_addresses if available
    let senderAddress = null
    if (order.senderId) {
      const senderAddrResult = await db.query(`
        SELECT
          street, number, apartment, city, state, zipcode as "zipCode", country,
          entry_pin as "entryPin", entry_instructions as "entryInstructions",
          latitude, longitude
        FROM customer_addresses
        WHERE customerid = $1 AND isprimary = true
        LIMIT 1
      `, [order.senderId])
      if (senderAddrResult.rows.length > 0) {
        senderAddress = senderAddrResult.rows[0]
      }
    }

    // Get recipient address details from customer_addresses if available
    let recipientAddress = null
    if (order.recipientId) {
      const recipientAddrResult = await db.query(`
        SELECT
          street, number, apartment, reparto, floor,
          province_name as "provinceName", municipality_name as "municipalityName",
          delivery_instructions as "deliveryInstructions"
        FROM customer_addresses
        WHERE customerid = $1 AND address_type = 'cuba'
        ORDER BY isprimary DESC, createdat DESC
        LIMIT 1
      `, [order.recipientId])
      if (recipientAddrResult.rows.length > 0) {
        recipientAddress = recipientAddrResult.rows[0]
      }
    }

    // Get products from order_products
    const productsResult = await db.query(`
      SELECT
        id,
        product_id as "productId",
        product_code as "productCode",
        product_name as "productName",
        quantity,
        weight_lbs as "weightLbs",
        unit_price as "unitPrice",
        subtotal,
        empaque_code as "empaqueCode"
      FROM order_products
      WHERE order_id = $1
      ORDER BY id
    `, [orderId])

    // Get services from order
    const servicesResult = await db.query(`
      SELECT services FROM package_orders WHERE id = $1
    `, [orderId])
    let services = []
    if (servicesResult.rows[0]?.services) {
      try {
        services = typeof servicesResult.rows[0].services === 'string'
          ? JSON.parse(servicesResult.rows[0].services)
          : servicesResult.rows[0].services
      } catch (e) {
        services = []
      }
    }

    // Parse sender name into first/last
    const senderNameParts = (order.senderName || '').split(' ')
    const senderFirstName = senderNameParts[0] || ''
    const senderLastName = senderNameParts.slice(1).join(' ') || ''

    // Parse recipient name into first/last
    const recipientNameParts = (order.recipientName || '').split(' ')
    const recipientFirstName = recipientNameParts[0] || ''
    const recipientLastName = recipientNameParts.slice(1).join(' ') || ''

    // Build response
    const response = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      shippingType: order.shippingType || 'air',
      totalAmount: parseFloat(order.totalAmount) || 0,
      paidAmount: parseFloat(order.paidAmount) || 0,
      createdAt: order.createdAt,
      notes: order.notes,
      sender: {
        id: order.senderId,
        firstName: senderFirstName,
        lastName: senderLastName,
        phone: order.senderPhone,
        address: senderAddress || {
          street: order.senderAddress,
          city: order.senderCity,
          state: order.senderState,
          zipCode: order.senderZip,
          country: 'US'
        },
        entryPin: senderAddress?.entryPin,
        entryInstructions: senderAddress?.entryInstructions
      },
      recipient: {
        id: order.recipientId,
        firstName: recipientFirstName,
        lastName: recipientLastName,
        phone: order.recipientPhone,
        address: recipientAddress || {
          street: order.recipientAddress,
          municipalityName: order.recipientCity,
          provinceName: order.recipientState
        },
        deliveryInstructions: recipientAddress?.deliveryInstructions
      },
      services,
      products: productsResult.rows
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('Error fetching order details:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener detalles de orden'
    }, { status: 500 })
  }
}
