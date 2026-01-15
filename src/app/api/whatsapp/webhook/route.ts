import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage, sendResponse } from '@/lib/whatsapp-agent'

/**
 * Webhook para recibir mensajes de WhatsApp via Twilio
 *
 * Twilio envia un POST con form data conteniendo:
 * - From: whatsapp:+1234567890
 * - Body: contenido del mensaje
 * - MessageSid: ID unico del mensaje
 * - MediaUrl0, MediaUrl1, etc: URLs de archivos adjuntos
 *
 * Debe responder con TwiML (puede ser vacio si enviamos respuesta por API)
 */
export async function POST(request: NextRequest) {
  try {
    // Parsear form data de Twilio
    const formData = await request.formData()

    const from = formData.get('From') as string        // whatsapp:+1234567890
    const body = formData.get('Body') as string        // Mensaje del usuario
    const messageSid = formData.get('MessageSid') as string
    const numMedia = parseInt(formData.get('NumMedia') as string || '0')

    // Log para debugging
    console.log('[WhatsApp Webhook] Incoming message:', {
      from,
      body: body?.substring(0, 100),
      messageSid,
      numMedia
    })

    // Validar que tengamos los datos necesarios
    if (!from || !body) {
      console.error('[WhatsApp Webhook] Missing required fields')
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Procesar mensaje con el agente
    const response = await handleIncomingMessage(from, body, messageSid)

    // Log del resultado
    console.log('[WhatsApp Webhook] Agent response:', {
      messageLength: response.message?.length,
      orderCreated: response.orderCreated,
      orderId: response.orderId,
      orderNumber: response.orderNumber,
      hasPaymentLink: !!response.paymentLink
    })

    // Enviar respuesta por WhatsApp
    if (response.message) {
      const sent = await sendResponse(from, response.message)
      if (!sent) {
        console.error('[WhatsApp Webhook] Failed to send response to', from)
      }
    }

    // Responder a Twilio con TwiML vacio
    // (la respuesta ya se envio por API)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )

  } catch (error) {
    console.error('[WhatsApp Webhook] Error processing message:', error)

    // Siempre responder a Twilio, incluso en error
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }
}

/**
 * GET endpoint para verificar que el webhook esta activo
 * Util para health checks y configuracion inicial
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'WhatsApp Agent Webhook',
    timestamp: new Date().toISOString(),
    description: 'POST messages to this endpoint from Twilio'
  })
}
