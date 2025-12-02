import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, sendOrderCreatedSMS } from '@/lib/sms-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/sms/send
 *
 * Envía un SMS usando Twilio
 *
 * Body:
 * - to: string (número de teléfono destino)
 * - message: string (mensaje a enviar)
 *
 * O para mensaje de orden creada:
 * - to: string
 * - type: 'order_created'
 * - companyName: string
 * - orderNumber: string
 * - scheduledDate: string
 * - timeSlot: string (opcional - 'morning', 'afternoon', 'evening', 'all_day')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar campos requeridos
    if (!body.to) {
      return NextResponse.json({
        success: false,
        error: 'Falta el número de teléfono destino (to)'
      }, { status: 400 })
    }

    let result

    // Si es un mensaje de orden creada, usar la función específica
    if (body.type === 'order_created') {
      if (!body.companyName || !body.orderNumber || !body.scheduledDate) {
        return NextResponse.json({
          success: false,
          error: 'Faltan campos requeridos para mensaje de orden creada (companyName, orderNumber, scheduledDate)'
        }, { status: 400 })
      }

      result = await sendOrderCreatedSMS(
        body.to,
        body.companyName,
        body.orderNumber,
        body.scheduledDate,
        body.timeSlot || null
      )
    } else {
      // Mensaje genérico
      if (!body.message) {
        return NextResponse.json({
          success: false,
          error: 'Falta el mensaje a enviar (message)'
        }, { status: 400 })
      }

      result = await sendSMS(body.to, body.message)
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          messageId: result.messageId,
          to: result.to
        },
        message: 'SMS enviado exitosamente'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Error al enviar SMS'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in SMS API:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al enviar SMS'
    }, { status: 500 })
  }
}
