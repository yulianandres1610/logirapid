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
 * POST /api/market/chat/messages/[id]/pin
 * Pin a message
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

    // Verify user is admin of the conversation
    const msgCheck = await db.query(`
      SELECT m.id, m.conversation_id, m.is_deleted, p.role
      FROM chat_messages m
      JOIN chat_conversations c ON c.id = m.conversation_id
      JOIN chat_participants p ON p.conversation_id = c.id AND p.user_id = $1
      WHERE m.id = $2 AND c.company_id = $3
    `, [payload.userId, messageId, payload.companyId])

    if (msgCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Mensaje no encontrado' }, { status: 404 })
    }

    if (msgCheck.rows[0].is_deleted) {
      return NextResponse.json({ success: false, error: 'No puedes fijar un mensaje eliminado' }, { status: 400 })
    }

    if (msgCheck.rows[0].role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Solo administradores pueden fijar mensajes' }, { status: 403 })
    }

    // Pin the message
    await db.query(`
      UPDATE chat_messages
      SET is_pinned = true, pinned_by = $1, pinned_at = NOW()
      WHERE id = $2
    `, [payload.userId, messageId])

    return NextResponse.json({
      success: true,
      message: 'Mensaje fijado'
    })

  } catch (error) {
    console.error('[Chat Pin POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al fijar mensaje'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/chat/messages/[id]/pin
 * Unpin a message
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

    // Verify user is admin of the conversation
    const msgCheck = await db.query(`
      SELECT m.id, p.role
      FROM chat_messages m
      JOIN chat_conversations c ON c.id = m.conversation_id
      JOIN chat_participants p ON p.conversation_id = c.id AND p.user_id = $1
      WHERE m.id = $2 AND c.company_id = $3
    `, [payload.userId, messageId, payload.companyId])

    if (msgCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Mensaje no encontrado' }, { status: 404 })
    }

    if (msgCheck.rows[0].role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Solo administradores pueden desfijar mensajes' }, { status: 403 })
    }

    // Unpin the message
    await db.query(`
      UPDATE chat_messages
      SET is_pinned = false, pinned_by = NULL, pinned_at = NULL
      WHERE id = $1
    `, [messageId])

    return NextResponse.json({
      success: true,
      message: 'Mensaje desfijado'
    })

  } catch (error) {
    console.error('[Chat Pin DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al desfijar mensaje'
    }, { status: 500 })
  }
}
