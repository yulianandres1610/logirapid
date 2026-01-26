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
 * PUT /api/market/chat/messages/[id]
 * Edit a message
 */
export async function PUT(
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

    // Verify user is the sender and message is in their company
    const msgCheck = await db.query(`
      SELECT m.id, m.sender_id, m.message_type, m.is_deleted, c.company_id
      FROM chat_messages m
      JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE m.id = $1
    `, [messageId])

    if (msgCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Mensaje no encontrado' }, { status: 404 })
    }

    const msg = msgCheck.rows[0]

    if (msg.company_id !== payload.companyId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    if (msg.sender_id !== payload.userId) {
      return NextResponse.json({ success: false, error: 'Solo puedes editar tus propios mensajes' }, { status: 403 })
    }

    if (msg.is_deleted) {
      return NextResponse.json({ success: false, error: 'No puedes editar un mensaje eliminado' }, { status: 400 })
    }

    if (msg.message_type !== 'text') {
      return NextResponse.json({ success: false, error: 'Solo mensajes de texto pueden ser editados' }, { status: 400 })
    }

    const body = await request.json()
    const { content } = body

    if (!content || content.trim() === '') {
      return NextResponse.json({ success: false, error: 'El mensaje no puede estar vacio' }, { status: 400 })
    }

    const result = await db.query(`
      UPDATE chat_messages
      SET content = $1, edited_at = NOW()
      WHERE id = $2
      RETURNING id, content, edited_at
    `, [content, messageId])

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('[Chat Message PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al editar mensaje'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/chat/messages/[id]
 * Delete a message (soft delete)
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

    // Verify user is the sender or conversation admin
    const msgCheck = await db.query(`
      SELECT m.id, m.sender_id, m.conversation_id, c.company_id,
        (SELECT role FROM chat_participants WHERE conversation_id = m.conversation_id AND user_id = $1) as user_role
      FROM chat_messages m
      JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE m.id = $2
    `, [payload.userId, messageId])

    if (msgCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Mensaje no encontrado' }, { status: 404 })
    }

    const msg = msgCheck.rows[0]

    if (msg.company_id !== payload.companyId) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    // User can delete if they are the sender or conversation admin
    if (msg.sender_id !== payload.userId && msg.user_role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Solo puedes eliminar tus propios mensajes o ser administrador'
      }, { status: 403 })
    }

    // Soft delete
    await db.query(`
      UPDATE chat_messages
      SET is_deleted = true, content = NULL, file_url = NULL
      WHERE id = $1
    `, [messageId])

    return NextResponse.json({
      success: true,
      message: 'Mensaje eliminado'
    })

  } catch (error) {
    console.error('[Chat Message DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar mensaje'
    }, { status: 500 })
  }
}
