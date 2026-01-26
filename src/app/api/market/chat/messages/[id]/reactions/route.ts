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
 * POST /api/market/chat/messages/[id]/reactions
 * Add a reaction to a message
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

    // Allow market companies (companyType might not be set)
    if (payload.companyType && payload.companyType !== 'market') {
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
      return NextResponse.json({ success: false, error: 'No puedes reaccionar a un mensaje eliminado' }, { status: 400 })
    }

    const body = await request.json()
    const { emoji } = body

    if (!emoji) {
      return NextResponse.json({ success: false, error: 'Emoji es requerido' }, { status: 400 })
    }

    // Insert reaction (or ignore if already exists)
    const result = await db.query(`
      INSERT INTO chat_reactions (message_id, user_id, emoji)
      VALUES ($1, $2, $3)
      ON CONFLICT (message_id, user_id, emoji) DO NOTHING
      RETURNING id
    `, [messageId, payload.userId, emoji])

    // Get all reactions for this message
    const reactions = await db.query(`
      SELECT r.emoji, r.user_id, COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.email) as user_name
      FROM chat_reactions r
      JOIN users u ON u.id = r.user_id
      WHERE r.message_id = $1
    `, [messageId])

    return NextResponse.json({
      success: true,
      data: {
        added: result.rows.length > 0,
        reactions: reactions.rows.map(r => ({
          emoji: r.emoji,
          userId: r.user_id,
          userName: r.user_name
        }))
      }
    })

  } catch (error) {
    console.error('[Chat Reactions POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al agregar reaccion'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/chat/messages/[id]/reactions
 * Remove a reaction from a message
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

    // Allow market companies (companyType might not be set)
    if (payload.companyType && payload.companyType !== 'market') {
      return NextResponse.json({ success: false, error: 'Acceso denegado' }, { status: 403 })
    }

    const { id } = await params
    const messageId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const emoji = searchParams.get('emoji')

    if (!emoji) {
      return NextResponse.json({ success: false, error: 'Emoji es requerido' }, { status: 400 })
    }

    // Delete reaction
    await db.query(`
      DELETE FROM chat_reactions
      WHERE message_id = $1 AND user_id = $2 AND emoji = $3
    `, [messageId, payload.userId, emoji])

    // Get remaining reactions
    const reactions = await db.query(`
      SELECT r.emoji, r.user_id, COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.email) as user_name
      FROM chat_reactions r
      JOIN users u ON u.id = r.user_id
      WHERE r.message_id = $1
    `, [messageId])

    return NextResponse.json({
      success: true,
      data: {
        reactions: reactions.rows.map(r => ({
          emoji: r.emoji,
          userId: r.user_id,
          userName: r.user_name
        }))
      }
    })

  } catch (error) {
    console.error('[Chat Reactions DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar reaccion'
    }, { status: 500 })
  }
}
