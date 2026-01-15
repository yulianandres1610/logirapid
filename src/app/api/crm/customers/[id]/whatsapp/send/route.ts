import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { sendWhatsApp } from '@/lib/sms-service'

/**
 * POST /api/crm/customers/[id]/whatsapp/send
 * Envía un mensaje de WhatsApp a un cliente desde el CRM
 */
export async function POST(
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

    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'El mensaje es requerido' },
        { status: 400 }
      )
    }

    // Obtener datos del cliente
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

    if (!customer.phone) {
      return NextResponse.json(
        { success: false, error: 'El cliente no tiene número de teléfono registrado' },
        { status: 400 }
      )
    }

    // Limpiar número de teléfono
    const cleanPhone = customer.phone.replace(/\D/g, '')

    // Buscar o crear conversación existente
    let conversationId: number

    const existingConv = await db.query(`
      SELECT id FROM whatsapp_conversations
      WHERE customer_id = $1
         OR phone_number LIKE '%' || $2 || '%'
      ORDER BY last_message_at DESC
      LIMIT 1
    `, [customerId, cleanPhone.slice(-10)])

    if (existingConv.rows.length > 0) {
      conversationId = existingConv.rows[0].id
    } else {
      // Crear nueva conversación
      const newConv = await db.query(`
        INSERT INTO whatsapp_conversations (
          phone_number,
          current_flow,
          collected_data,
          messages_history,
          customer_id,
          customer_name,
          conversation_status,
          last_message_at
        ) VALUES ($1, 'idle', '{}', '[]', $2, $3, 'active', NOW())
        RETURNING id
      `, [
        cleanPhone,
        customerId,
        `${customer.firstname || ''} ${customer.lastname || ''}`.trim()
      ])
      conversationId = newConv.rows[0].id
    }

    // Enviar mensaje por WhatsApp
    const sendResult = await sendWhatsApp(cleanPhone, message.trim())

    if (!sendResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Error enviando mensaje de WhatsApp',
          details: sendResult.error
        },
        { status: 500 }
      )
    }

    // Guardar mensaje en la base de datos
    await db.query(`
      INSERT INTO whatsapp_messages (
        conversation_id,
        direction,
        message_sid,
        content,
        delivery_status,
        created_at
      ) VALUES ($1, 'outbound', $2, $3, 'sent', NOW())
    `, [conversationId, sendResult.messageId, message.trim()])

    // Actualizar last_message_at de la conversación
    await db.query(`
      UPDATE whatsapp_conversations
      SET last_message_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [conversationId])

    return NextResponse.json({
      success: true,
      data: {
        messageId: sendResult.messageId,
        to: sendResult.to,
        conversationId
      }
    })
  } catch (error) {
    console.error('[CRM WhatsApp Send API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error enviando mensaje',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
