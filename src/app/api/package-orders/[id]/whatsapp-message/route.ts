import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { generateWhatsAppOrderMessage } from '@/lib/sms-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/package-orders/[id]/whatsapp-message
 *
 * Genera el mensaje de WhatsApp para una orden existente
 * Retorna el mensaje formateado listo para copiar
 */
export async function GET(
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
        po.customername,
        po.firstname,
        po.lastname,
        po.customeraddress,
        po.street,
        po.city,
        po.state,
        po.zipcode,
        po.company_id,
        po.scheduleddate,
        po.timeslot,
        po.phone
      FROM package_orders po
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

    // Obtener datos de la compañía
    const companyQuery = await db.query(
      'SELECT legalname, customer_service_phone FROM companies WHERE id = $1',
      [order.company_id]
    )

    const companyName = companyQuery.rows[0]?.legalname || 'LogiRapid'
    const customerServicePhone = companyQuery.rows[0]?.customer_service_phone || null

    // Preparar datos
    const scheduledDate = order.scheduleddate || new Date().toISOString()
    const timeSlot = order.timeslot || null

    // Nombre del cliente
    const customerName = order.customername ||
      (order.firstname && order.lastname ? `${order.firstname} ${order.lastname}` : null)

    // Dirección
    let address = order.customeraddress
    if (!address && order.street) {
      address = `${order.street}, ${order.city}, ${order.state} ${order.zipcode}`
    }

    // Generar mensaje de WhatsApp
    const message = generateWhatsAppOrderMessage(
      companyName,
      order.ordernumber,
      scheduledDate,
      customerName,
      address,
      timeSlot,
      customerServicePhone
    )

    // Generar URL de WhatsApp si hay teléfono
    let whatsappUrl = null
    if (order.phone) {
      const cleanPhone = order.phone.replace(/\D/g, '')
      const encodedMessage = encodeURIComponent(message)
      whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`
    }

    return NextResponse.json({
      success: true,
      data: {
        message,
        whatsappUrl,
        phone: order.phone
      }
    })

  } catch (error) {
    console.error('[WhatsApp Message] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
