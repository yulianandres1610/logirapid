import { NextRequest, NextResponse } from 'next/server'
import { handleIncomingMessage, getOrCreateConversation, resetConversation } from '@/lib/whatsapp-agent'

/**
 * POST /api/whatsapp/test
 * Endpoint de prueba para simular mensajes de WhatsApp sin enviar realmente
 *
 * Body: { phone: string, message: string, reset?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, message, reset } = body

    if (!phone || !message) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere phone y message'
      }, { status: 400 })
    }

    // Resetear conversacion si se solicita
    if (reset) {
      const conv = await getOrCreateConversation(phone)
      await resetConversation(conv.id)
      console.log('[WhatsApp Test] Conversacion reseteada para:', phone)
    }

    console.log('[WhatsApp Test] ========== SIMULANDO MENSAJE ==========')
    console.log('[WhatsApp Test] De:', phone)
    console.log('[WhatsApp Test] Mensaje:', message)

    // Procesar mensaje (sin enviar respuesta real)
    const response = await handleIncomingMessage(phone, message, 'test-' + Date.now())

    // Obtener estado actual de la conversacion
    const conversation = await getOrCreateConversation(phone)

    console.log('[WhatsApp Test] ========== RESULTADO ==========')
    console.log('[WhatsApp Test] Respuesta:', response.message?.substring(0, 200))
    console.log('[WhatsApp Test] Orden creada:', response.orderCreated)
    console.log('[WhatsApp Test] Datos guardados:', JSON.stringify(conversation.collected_data, null, 2))

    return NextResponse.json({
      success: true,
      data: {
        agentResponse: response.message,
        orderCreated: response.orderCreated,
        orderId: response.orderId,
        orderNumber: response.orderNumber,
        paymentLink: response.paymentLink,
        conversationState: {
          flow: conversation.current_flow,
          step: conversation.current_step,
          collectedData: conversation.collected_data,
          customerId: conversation.customer_id,
          customerName: conversation.customer_name
        }
      }
    })

  } catch (error) {
    console.error('[WhatsApp Test] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

/**
 * GET /api/whatsapp/test?phone=xxx
 * Ver estado actual de una conversacion
 */
export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere parametro phone'
      }, { status: 400 })
    }

    const conversation = await getOrCreateConversation(phone)

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id,
        phone: conversation.phone_number,
        flow: conversation.current_flow,
        step: conversation.current_step,
        collectedData: conversation.collected_data,
        customerId: conversation.customer_id,
        customerName: conversation.customer_name,
        lastMessageAt: conversation.last_message_at,
        messagesCount: conversation.messages_history.length
      }
    })

  } catch (error) {
    console.error('[WhatsApp Test] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
