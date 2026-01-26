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
 * GET /api/market/chat/conversations/[id]
 * Get conversation details
 */
export async function GET(
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
    const conversationId = parseInt(id)

    // Verify user is a participant
    const participantCheck = await db.query(`
      SELECT p.role, p.is_muted, p.last_read_at
      FROM chat_participants p
      JOIN chat_conversations c ON c.id = p.conversation_id
      WHERE p.conversation_id = $1
        AND p.user_id = $2
        AND c.company_id = $3
    `, [conversationId, payload.userId, payload.companyId])

    if (participantCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No eres parte de esta conversacion' }, { status: 403 })
    }

    // Get conversation details with participants
    const result = await db.query(`
      SELECT
        c.id,
        c.type,
        c.name,
        c.description,
        c.avatar_url,
        c.created_by,
        c.created_at,
        c.updated_at,
        (
          SELECT json_agg(json_build_object(
            'id', u.id,
            'name', COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.email),
            'email', u.email,
            'role', cp.role,
            'joinedAt', cp.joined_at
          ))
          FROM chat_participants cp
          JOIN users u ON u.id = cp.user_id
          WHERE cp.conversation_id = c.id
        ) as participants,
        (
          SELECT json_agg(json_build_object(
            'id', m.id,
            'content', m.content,
            'messageType', m.message_type,
            'senderId', m.sender_id,
            'createdAt', m.created_at
          ) ORDER BY m.pinned_at DESC)
          FROM chat_messages m
          WHERE m.conversation_id = c.id
            AND m.is_pinned = true
            AND m.is_deleted = false
        ) as pinned_messages
      FROM chat_conversations c
      WHERE c.id = $1
    `, [conversationId])

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Conversacion no encontrada' }, { status: 404 })
    }

    const conv = result.rows[0]
    const userParticipation = participantCheck.rows[0]

    // Update last_read_at for current user
    await db.query(`
      UPDATE chat_participants
      SET last_read_at = NOW()
      WHERE conversation_id = $1 AND user_id = $2
    `, [conversationId, payload.userId])

    return NextResponse.json({
      success: true,
      data: {
        id: conv.id,
        type: conv.type,
        name: conv.name,
        description: conv.description,
        avatarUrl: conv.avatar_url,
        createdBy: conv.created_by,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        participants: conv.participants || [],
        pinnedMessages: conv.pinned_messages || [],
        userRole: userParticipation.role,
        isMuted: userParticipation.is_muted
      }
    })

  } catch (error) {
    console.error('[Chat Conversation GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener conversacion'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/chat/conversations/[id]
 * Update conversation (name, description, avatar)
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
    const conversationId = parseInt(id)

    // Check if user is admin of the conversation
    const adminCheck = await db.query(`
      SELECT p.role, c.type
      FROM chat_participants p
      JOIN chat_conversations c ON c.id = p.conversation_id
      WHERE p.conversation_id = $1
        AND p.user_id = $2
        AND c.company_id = $3
    `, [conversationId, payload.userId, payload.companyId])

    if (adminCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No eres parte de esta conversacion' }, { status: 403 })
    }

    if (adminCheck.rows[0].role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Solo administradores pueden editar la conversacion' }, { status: 403 })
    }

    if (adminCheck.rows[0].type === 'private') {
      return NextResponse.json({ success: false, error: 'No se pueden editar chats privados' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, avatarUrl } = body

    const result = await db.query(`
      UPDATE chat_conversations
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          avatar_url = COALESCE($3, avatar_url),
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, name, description, avatar_url, updated_at
    `, [name, description, avatarUrl, conversationId])

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('[Chat Conversation PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar conversacion'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/chat/conversations/[id]
 * Delete or leave conversation
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
    const conversationId = parseInt(id)

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'leave'

    const participantCheck = await db.query(`
      SELECT p.role, c.type
      FROM chat_participants p
      JOIN chat_conversations c ON c.id = p.conversation_id
      WHERE p.conversation_id = $1
        AND p.user_id = $2
        AND c.company_id = $3
    `, [conversationId, payload.userId, payload.companyId])

    if (participantCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No eres parte de esta conversacion' }, { status: 403 })
    }

    const { role, type } = participantCheck.rows[0]

    if (action === 'delete') {
      // Only admins can delete groups/channels
      if (role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Solo administradores pueden eliminar la conversacion' }, { status: 403 })
      }

      // Delete conversation (cascade deletes participants, messages, etc.)
      await db.query(`DELETE FROM chat_conversations WHERE id = $1`, [conversationId])

      return NextResponse.json({
        success: true,
        message: 'Conversacion eliminada'
      })
    } else {
      // Leave conversation
      if (type === 'private') {
        return NextResponse.json({ success: false, error: 'No puedes abandonar un chat privado' }, { status: 400 })
      }

      await db.query(`
        DELETE FROM chat_participants
        WHERE conversation_id = $1 AND user_id = $2
      `, [conversationId, payload.userId])

      return NextResponse.json({
        success: true,
        message: 'Has abandonado la conversacion'
      })
    }

  } catch (error) {
    console.error('[Chat Conversation DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar/abandonar conversacion'
    }, { status: 500 })
  }
}
