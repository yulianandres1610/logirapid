import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/whatsapp/reset
 * Reset a WhatsApp conversation by phone number
 * Body: { phone: "3057974213" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone } = body

    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone number required' }, { status: 400 })
    }

    // Clean the phone number
    const cleanPhone = phone.replace(/\D/g, '')

    console.log('[WhatsApp Reset] Resetting conversation for phone:', cleanPhone)

    // Reset the conversation
    const result = await db.query(`
      UPDATE whatsapp_conversations
      SET
        collected_data = '{}',
        current_flow = 'idle',
        current_step = NULL,
        conversation_status = 'active',
        messages_history = '[]',
        updated_at = NOW()
      WHERE phone_number LIKE $1
      RETURNING id, phone_number
    `, [`%${cleanPhone}%`])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found for this phone number'
      }, { status: 404 })
    }

    console.log('[WhatsApp Reset] Conversation reset successfully:', result.rows[0])

    return NextResponse.json({
      success: true,
      message: `Conversation reset for ${result.rows[0].phone_number}`,
      conversationId: result.rows[0].id
    })

  } catch (error) {
    console.error('[WhatsApp Reset] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
