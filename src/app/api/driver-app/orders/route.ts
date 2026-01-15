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

// GET: List orders assigned to driver or for today
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const status = searchParams.get('status')

    // Build query
    let query = `
      SELECT
        po.id,
        po.ordernumber as "orderNumber",
        po.status,
        po.payment_status as "paymentStatus",
        po.totalamount as "totalAmount",
        po.createdat as "createdAt",
        po.sender_name as "senderName",
        po.sender_phone as "senderPhone",
        po.sender_city as "senderCity",
        po.recipient_name as "recipientName",
        po.recipient_city as "recipientCity"
      FROM package_orders po
      WHERE po.company_id = $1
    `
    const params: any[] = [user.companyId]

    // Filter by date
    if (date) {
      params.push(date)
      query += ` AND DATE(po.createdat) = $${params.length}`
    }

    // Filter by status
    if (status === 'pending') {
      query += ` AND po.status IN ('pending', 'pendiente', 'en_reparto', 'en_proceso')`
    } else if (status === 'completed') {
      query += ` AND po.status IN ('completada', 'completed', 'entregada', 'pagada')`
    }

    query += ` ORDER BY po.createdat DESC LIMIT 50`

    const result = await db.query(query, params)

    return NextResponse.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('Error fetching driver orders:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener ordenes'
    }, { status: 500 })
  }
}

// POST: Create new order from driver app
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken()

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    const body = await request.json()
    const {
      sender,
      recipient,
      shippingType,
      products,
      empaqueCode,
      totalAmount,
      payment
    } = body

    // Validate required fields
    if (!sender || !recipient || !products || products.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Faltan campos requeridos'
      }, { status: 400 })
    }

    // Generate order number
    const year = new Date().getFullYear()
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM package_orders WHERE EXTRACT(YEAR FROM createdat) = $1`,
      [year]
    )
    const orderCount = parseInt(countResult.rows[0].count) + 1
    const orderNumber = `ORD-${year}-${String(orderCount).padStart(4, '0')}`

    // Create order in transaction
    const result = await db.transaction(async (client) => {
      // 1. Create or get sender customer
      let senderId = sender.id
      if (!senderId && sender.firstName && sender.phone) {
        const senderResult = await client.query(`
          INSERT INTO customers (firstname, lastname, phone, email, company_id, createdat)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (phone, company_id) DO UPDATE SET firstname = $1, lastname = $2
          RETURNING id
        `, [sender.firstName, sender.lastName || '', sender.phone, sender.email || null, user.companyId])
        senderId = senderResult.rows[0].id
      }

      // 2. Create or get recipient customer
      let recipientId = recipient.id
      if (!recipientId && recipient.firstName && recipient.phone) {
        const recipientResult = await client.query(`
          INSERT INTO customers (firstname, lastname, phone, email, company_id, createdat)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (phone, company_id) DO UPDATE SET firstname = $1, lastname = $2
          RETURNING id
        `, [recipient.firstName, recipient.lastName || '', recipient.phone, recipient.email || null, user.companyId])
        recipientId = recipientResult.rows[0].id
      }

      // 3. Create order
      const orderResult = await client.query(`
        INSERT INTO package_orders (
          ordernumber,
          company_id,
          sender_id,
          sender_name,
          sender_phone,
          sender_address,
          sender_city,
          sender_state,
          sender_zip,
          sender_latitude,
          sender_longitude,
          recipient_id,
          recipient_name,
          recipient_phone,
          recipient_address,
          recipient_city,
          recipient_state,
          shipping_type,
          totalamount,
          payment_status,
          paymentmethod,
          status,
          source,
          created_by,
          createdat
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, NOW()
        )
        RETURNING id, ordernumber
      `, [
        orderNumber,
        user.companyId,
        senderId,
        `${sender.firstName} ${sender.lastName || ''}`.trim(),
        sender.phone,
        sender.street || sender.address || '',
        sender.city || '',
        sender.state || '',
        sender.zipCode || '',
        sender.latitude || null,
        sender.longitude || null,
        recipientId,
        `${recipient.firstName} ${recipient.lastName || ''}`.trim(),
        recipient.phone,
        recipient.street || '',
        recipient.municipalityName || '',
        recipient.provinceName || '',
        shippingType || 'air',
        totalAmount || 0,
        payment ? 'paid' : 'pending_payment',
        payment?.method || 'cod',
        'pending',
        'driver_app',
        user.userId
      ])

      const orderId = orderResult.rows[0].id

      // 4. Insert products
      for (const product of products) {
        await client.query(`
          INSERT INTO order_products (
            order_id, product_id, product_code, product_name,
            quantity, weight_lbs, unit_price, subtotal, empaque_code
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          orderId,
          product.productId,
          product.productCode,
          product.productName,
          product.quantity,
          product.weightLbs || 0,
          product.unitPrice,
          product.subtotal,
          empaqueCode || null
        ])
      }

      // 5. If payment provided, record it
      if (payment && payment.amount > 0) {
        await client.query(`
          INSERT INTO order_payments (
            order_id, payment_method, amount, reference,
            cash_received, change_amount,
            registered_by, registered_by_name, source, company_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          orderId,
          payment.method,
          payment.amount,
          payment.reference || `DRV-${orderId}-${Date.now()}`,
          payment.amountReceived || null,
          payment.changeGiven || null,
          user.userId,
          user.email,
          'driver_app',
          user.companyId
        ])
      }

      return { orderId, orderNumber }
    })

    return NextResponse.json({
      success: true,
      data: {
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        empaqueCode,
        totalAmount,
        paymentConfirmed: !!payment
      }
    })

  } catch (error) {
    console.error('Error creating order from driver:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear orden'
    }, { status: 500 })
  }
}
