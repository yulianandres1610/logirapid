import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { sendSMS, sendWhatsApp } from '@/lib/sms-service'

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

// POST: Send receipt via WhatsApp, SMS, or Email
export async function POST(
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

    const body = await request.json()
    const { method, phone, email } = body

    if (!method || !['whatsapp', 'sms', 'email'].includes(method)) {
      return NextResponse.json({
        success: false,
        error: 'Metodo de envio invalido'
      }, { status: 400 })
    }

    // Get order details
    const orderResult = await db.query(`
      SELECT
        po.id,
        po.ordernumber,
        po.totalamount,
        po.payment_status,
        po.sender_name,
        po.sender_phone,
        po.recipient_name,
        po.createdat,
        c.legalname as company_name
      FROM package_orders po
      LEFT JOIN companies c ON po.company_id = c.id
      WHERE po.id = $1
    `, [orderId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]
    const recipientPhone = phone || order.sender_phone

    if (!recipientPhone && method !== 'email') {
      return NextResponse.json({
        success: false,
        error: 'Se requiere numero de telefono'
      }, { status: 400 })
    }

    // Get products for the order
    const productsResult = await db.query(`
      SELECT product_name, quantity, subtotal
      FROM order_products
      WHERE order_id = $1
    `, [orderId])

    // Build receipt message
    const productLines = productsResult.rows.map((p: any) =>
      `- ${p.quantity}x ${p.product_name}: $${parseFloat(p.subtotal).toFixed(2)}`
    ).join('\n')

    const receiptMessage = `
*Recibo de Compra*
${order.company_name || 'LogiRapid'}

Orden: ${order.ordernumber}
Fecha: ${new Date(order.createdat).toLocaleDateString('es')}

Cliente: ${order.sender_name}
Destino: ${order.recipient_name}

*Productos:*
${productLines || 'Sin productos'}

*Total: $${parseFloat(order.totalamount).toFixed(2)}*
Estado: ${order.payment_status === 'paid' ? 'PAGADO' : 'PENDIENTE'}

Gracias por su compra!
`.trim()

    let sendResult: { success: boolean; error?: string } = { success: false, error: 'Metodo no implementado' }

    try {
      if (method === 'whatsapp') {
        // Try to send via WhatsApp
        const result = await sendWhatsApp(recipientPhone, receiptMessage)
        sendResult = { success: result.success, error: result.error }
      } else if (method === 'sms') {
        // Send via SMS
        const result = await sendSMS(recipientPhone, receiptMessage)
        sendResult = { success: result.success, error: result.error }
      } else if (method === 'email') {
        // Email not implemented yet
        sendResult = { success: false, error: 'Email no implementado' }
      }
    } catch (sendError: any) {
      console.error(`Error sending ${method}:`, sendError)
      sendResult = { success: false, error: sendError.message || 'Error al enviar' }
    }

    // Log the send attempt
    try {
      await db.query(`
        INSERT INTO notification_logs (
          order_id, notification_type, recipient, status, error_message, sent_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        orderId,
        method,
        method === 'email' ? email : recipientPhone,
        sendResult.success ? 'sent' : 'failed',
        sendResult.success ? null : sendResult.error
      ])
    } catch (logError) {
      // Ignore logging errors
      console.error('Error logging notification:', logError)
    }

    if (!sendResult.success) {
      return NextResponse.json({
        success: false,
        error: sendResult.error || `Error al enviar por ${method}`
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Recibo enviado por ${method} exitosamente`,
      data: {
        orderId,
        method,
        recipient: method === 'email' ? email : recipientPhone
      }
    })

  } catch (error) {
    console.error('Error sending receipt:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al enviar recibo'
    }, { status: 500 })
  }
}
