import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/crm/customers/[id]/whatsapp
 * Obtiene el historial de conversaciones de WhatsApp de un cliente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const customerId = parseInt(id)

    if (isNaN(customerId)) {
      return NextResponse.json(
        { success: false, error: 'ID de cliente inválido' },
        { status: 400 }
      )
    }

    // Obtener datos del cliente (incluyendo teléfono)
    const customerResult = await db.query(`
      SELECT id, firstname, lastname, phone
      FROM customers
      WHERE id = $1
    `, [customerId])

    if (customerResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado' },
        { status: 404 }
      )
    }

    const customer = customerResult.rows[0]
    const customerPhone = customer.phone?.replace(/\D/g, '').slice(-10) || ''

    // Buscar conversación por customer_id O por teléfono
    const conversationResult = await db.query(`
      SELECT
        id,
        phone_number,
        current_flow,
        current_step,
        collected_data,
        messages_history,
        customer_id,
        customer_name,
        conversation_status,
        completed_order_id,
        completed_order_type,
        completed_at,
        last_message_at,
        created_at,
        updated_at
      FROM whatsapp_conversations
      WHERE customer_id = $1
         OR ($2 != '' AND phone_number LIKE '%' || $2 || '%')
      ORDER BY last_message_at DESC
      LIMIT 1
    `, [customerId, customerPhone])

    let conversation = null
    let messages: Array<{
      id: number
      direction: string
      content: string
      detected_intent: string | null
      delivery_status: string | null
      error_message: string | null
      created_at: string
      sent_by: string | null
    }> = []

    if (conversationResult.rows.length > 0) {
      const conv = conversationResult.rows[0]
      conversation = {
        id: conv.id,
        phone_number: conv.phone_number,
        current_flow: conv.current_flow,
        current_step: conv.current_step,
        collected_data: conv.collected_data || {},
        conversation_status: conv.conversation_status || 'active',
        completed_order_id: conv.completed_order_id,
        completed_order_type: conv.completed_order_type,
        completed_at: conv.completed_at,
        last_message_at: conv.last_message_at,
        created_at: conv.created_at
      }

      // Obtener mensajes de esta conversación
      const messagesResult = await db.query(`
        SELECT
          id,
          direction,
          content,
          detected_intent,
          delivery_status,
          error_message,
          created_at,
          sent_by
        FROM whatsapp_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        LIMIT 100
      `, [conv.id])

      messages = messagesResult.rows
    }

    // Determinar estado de la conversación para UI
    let statusLabel = 'Sin conversación'
    let statusColor = 'gray'

    if (conversation) {
      const status = conversation.conversation_status
      if (status === 'completed') {
        statusLabel = 'Completada'
        statusColor = 'green'
      } else if (status === 'abandoned') {
        statusLabel = 'Abandonada'
        statusColor = 'red'
      } else {
        // Verificar si está activa o abandonada (sin actividad 24h)
        const lastMsg = new Date(conversation.last_message_at)
        const hoursSinceLastMsg = (Date.now() - lastMsg.getTime()) / (1000 * 60 * 60)

        if (hoursSinceLastMsg > 24 && status !== 'completed') {
          statusLabel = 'Abandonada'
          statusColor = 'red'
        } else {
          statusLabel = 'Activa'
          statusColor = 'yellow'
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: `${customer.firstname || ''} ${customer.lastname || ''}`.trim(),
          phone: customer.phone
        },
        conversation,
        messages,
        status: {
          label: statusLabel,
          color: statusColor
        }
      }
    })
  } catch (error) {
    console.error('[CRM WhatsApp API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error obteniendo historial de WhatsApp',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
