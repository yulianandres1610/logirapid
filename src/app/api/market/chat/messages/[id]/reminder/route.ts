import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyType?: string
}

/**
 * POST /api/market/chat/messages/[id]/reminder
 * Create a reminder for a message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    if (payload.companyType !== 'market') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = await params
    const messageId = parseInt(id)

    // Verify user is a participant in the conversation
    const msgCheck = await db.query(`
      SELECT m.id, m.conversation_id, m.is_deleted
      FROM chat_messages m
      JOIN chat_conversations c ON c.id = m.conversation_id
      JOIN chat_participants p ON p.conversation_id = c.id AND p.user_id = $1
      WHERE m.id = $2 AND c.company_id = $3
    `, [payload.userId, messageId, payload.companyId])

    if (msgCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Mensaje no encontrado' }, { status: 404 })
    }

    if (msgCheck.rows[0].is_deleted) {
      return NextResponse.json({ success: false, error: 'No puedes recordar un mensaje eliminado' }, { status: 400 })
    }

    const body = await request.json()
    const { remindAt, note } = body

    if (!remindAt) {
      return NextResponse.json({ success: false, error: 'Fecha de recordatorio es requerida' }, { status: 400 })
    }

    const remindDate = new Date(remindAt)
    if (remindDate <= new Date()) {
      return NextResponse.json({ success: false, error: 'La fecha debe ser en el futuro' }, { status: 400 })
    }

    // Create reminder
    const result = await db.query(`
      INSERT INTO chat_reminders (message_id, user_id, remind_at, note)
      VALUES ($1, $2, $3, $4)
      RETURNING id, remind_at, note, created_at
    `, [messageId, payload.userId, remindDate.toISOString(), note || null])

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('[Chat Reminder POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear recordatorio'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/chat/messages/[id]/reminder
 * Delete a reminder
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalido' }, { status: 401 })
    }

    if (payload.companyType !== 'market') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = await params
    const messageId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const reminderId = searchParams.get('reminderId')

    // Delete reminder (only user's own reminders)
    if (reminderId) {
      await db.query(`
        DELETE FROM chat_reminders
        WHERE id = $1 AND user_id = $2
      `, [parseInt(reminderId), payload.userId])
    } else {
      // Delete all reminders for this message for this user
      await db.query(`
        DELETE FROM chat_reminders
        WHERE message_id = $1 AND user_id = $2
      `, [messageId, payload.userId])
    }

    return NextResponse.json({
      success: true,
      message: 'Recordatorio eliminado'
    })

  } catch (error) {
    console.error('[Chat Reminder DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar recordatorio'
    }, { status: 500 })
  }
}
