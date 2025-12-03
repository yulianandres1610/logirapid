import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { sendWhatsAppOrderConfirmation, isValidPhoneNumber } from '@/lib/sms-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/package-orders/[id]/resend-whatsapp
 *
 * Reenvía el WhatsApp de confirmación para una orden existente
 * Usa exactamente la misma lógica que el envío automático al crear la orden
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orderId = parseInt(id, 10)

    if (isNaN(orderId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de orden inválido'
      }, { status: 400 })
    }

    // Obtener la orden con los datos necesarios
    const orderQuery = await db.query(
      `SELECT
        po.id,
        po.ordernumber,
        po.customerid,
        po.company_id,
        po.scheduleddate,
        po.timeslot,
        po.phone,
        po.customeraddress,
        po.customername,
        c.phone as customer_phone,
        c.firstname as customer_firstname,
        c.lastname as customer_lastname
      FROM package_orders po
      LEFT JOIN customers c ON po.customerid = c.id
      WHERE po.id = $1`,
      [orderId]
    )

    if (orderQuery.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderQuery.rows[0]

    // Buscar teléfono: primero en la orden, luego en el cliente
    const customerPhone = order.phone || order.customer_phone

    if (!customerPhone) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró teléfono en la orden ni en el cliente'
      }, { status: 400 })
    }

    // Validar teléfono
    if (!isValidPhoneNumber(customerPhone)) {
      return NextResponse.json({
        success: false,
        error: `Número de teléfono inválido: ${customerPhone}`
      }, { status: 400 })
    }

    // Obtener datos de la compañía
    const companyQuery = await db.query(
      'SELECT legalname, customer_service_phone FROM companies WHERE id = $1',
      [order.company_id]
    )

    const companyName = companyQuery.rows[0]?.legalname || 'LogiRapid'
    const customerServicePhone = companyQuery.rows[0]?.customer_service_phone || null

    // Preparar datos para el WhatsApp
    const scheduledDate = order.scheduleddate || new Date().toISOString()
    const timeSlot = order.timeslot || null
    const customerAddress = order.customeraddress || 'Dirección no disponible'
    const customerName = order.customername ||
      `${order.customer_firstname || ''} ${order.customer_lastname || ''}`.trim() ||
      'Cliente'

    console.log(`[WhatsApp Resend] Reenviando WhatsApp de confirmación a ${customerPhone} para orden ${order.ordernumber}`)

    // Enviar WhatsApp usando exactamente la misma función que el envío automático
    const whatsappResult = await sendWhatsAppOrderConfirmation(
      customerPhone,
      customerName,
      companyName,
      order.ordernumber,
      scheduledDate,
      timeSlot,
      customerAddress,
      customerServicePhone
    )

    if (whatsappResult.success) {
      console.log(`[WhatsApp Resend] WhatsApp reenviado exitosamente. SID: ${whatsappResult.messageId}`)
      return NextResponse.json({
        success: true,
        data: {
          messageId: whatsappResult.messageId,
          to: whatsappResult.to
        },
        message: 'WhatsApp reenviado exitosamente'
      })
    } else {
      console.error(`[WhatsApp Resend] Error al reenviar WhatsApp: ${whatsappResult.error}`)
      return NextResponse.json({
        success: false,
        error: whatsappResult.error || 'Error al enviar WhatsApp'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[WhatsApp Resend] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al reenviar WhatsApp'
    }, { status: 500 })
  }
}
