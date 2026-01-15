import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Webhook para recibir actualizaciones de estado de mensajes WhatsApp
 *
 * Twilio envia un POST cuando el estado de un mensaje cambia:
 * - queued: Mensaje en cola
 * - sent: Enviado al carrier
 * - delivered: Entregado al dispositivo
 * - read: Leido por el usuario
 * - failed: Fallo en el envio
 * - undelivered: No se pudo entregar
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const messageSid = formData.get('MessageSid') as string
    const messageStatus = formData.get('MessageStatus') as string
    const to = formData.get('To') as string
    const from = formData.get('From') as string
    const errorCode = formData.get('ErrorCode') as string | null
    const errorMessage = formData.get('ErrorMessage') as string | null

    console.log('[WhatsApp Status] Update received:', {
      messageSid,
      messageStatus,
      to,
      from,
      errorCode,
      errorMessage
    })

    // Actualizar estado del mensaje en la base de datos si existe
    if (messageSid) {
      try {
        await db.query(`
          UPDATE whatsapp_messages
          SET
            delivery_status = $1,
            error_code = $2,
            error_message = $3,
            status_updated_at = NOW()
          WHERE message_sid = $1
        `, [messageStatus, errorCode, errorMessage])

        // Si el mensaje fallo, logear para debugging
        if (messageStatus === 'failed' || messageStatus === 'undelivered') {
          console.error('[WhatsApp Status] Message failed:', {
            messageSid,
            to,
            errorCode,
            errorMessage
          })
        }
      } catch (dbError) {
        // Si falla la actualizacion, solo logear (la columna puede no existir aun)
        console.log('[WhatsApp Status] Could not update message status in DB:', dbError)
      }
    }

    // Responder a Twilio con 200 OK
    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('[WhatsApp Status] Error processing status update:', error)
    // Siempre responder 200 a Twilio para evitar reintentos
    return new Response('OK', { status: 200 })
  }
}

/**
 * GET endpoint para verificar que el webhook esta activo
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'WhatsApp Status Callback',
    timestamp: new Date().toISOString(),
    description: 'Receives message status updates from Twilio'
  })
}
