import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { sendOrderCreatedSMS, isValidPhoneNumber } from '@/lib/sms-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/package-orders/[id]/resend-sms
 *
 * Reenvía el SMS de confirmación para una orden existente
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
        po.customer_id,
        po.company_id,
        po.scheduleddate,
        po.timeslot
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

    // Obtener teléfono del cliente
    const customerQuery = await db.query(
      'SELECT phone FROM customers WHERE id = $1',
      [order.customer_id]
    )

    if (customerQuery.rows.length === 0 || !customerQuery.rows[0]?.phone) {
      return NextResponse.json({
        success: false,
        error: 'Cliente no tiene teléfono registrado'
      }, { status: 400 })
    }

    const customerPhone = customerQuery.rows[0].phone

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

    // Preparar datos para el SMS
    const scheduledDate = order.scheduleddate || new Date().toISOString()
    const timeSlot = order.timeslot || null

    console.log(`[SMS Resend] Reenviando SMS de confirmación a ${customerPhone} para orden ${order.ordernumber}`)

    // Enviar SMS usando exactamente la misma función que el envío automático
    const smsResult = await sendOrderCreatedSMS(
      customerPhone,
      companyName,
      order.ordernumber,
      scheduledDate,
      timeSlot,
      customerServicePhone
    )

    if (smsResult.success) {
      console.log(`[SMS Resend] SMS reenviado exitosamente. SID: ${smsResult.messageId}`)
      return NextResponse.json({
        success: true,
        data: {
          messageId: smsResult.messageId,
          to: smsResult.to
        },
        message: 'SMS reenviado exitosamente'
      })
    } else {
      console.error(`[SMS Resend] Error al reenviar SMS: ${smsResult.error}`)
      return NextResponse.json({
        success: false,
        error: smsResult.error || 'Error al enviar SMS'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[SMS Resend] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al reenviar SMS'
    }, { status: 500 })
  }
}
