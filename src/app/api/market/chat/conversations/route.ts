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
 * GET /api/market/chat/conversations
 * List all conversations for the current user
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    // Get conversations where user is a participant
    const result = await db.query(`
      SELECT
        c.id,
        c.type,
        c.name,
        c.description,
        c.avatar_url,
        c.created_at,
        c.updated_at,
        p.role as user_role,
        p.is_muted,
        p.last_read_at,
        (
          SELECT COUNT(*)
          FROM chat_messages m
          WHERE m.conversation_id = c.id
          AND m.created_at > COALESCE(p.last_read_at, '1970-01-01')
          AND m.sender_id != $1
          AND m.is_deleted = false
        ) as unread_count,
        (
          SELECT json_build_object(
            'id', m.id,
            'content', m.content,
            'message_type', m.message_type,
            'sender_id', m.sender_id,
            'created_at', m.created_at
          )
          FROM chat_messages m
          WHERE m.conversation_id = c.id AND m.is_deleted = false
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message,
        CASE
          WHEN c.type = 'private' THEN (
            SELECT json_build_object(
              'id', u.id,
              'name', COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.email),
              'email', u.email
            )
            FROM chat_participants op
            JOIN users u ON u.id = op.user_id
            WHERE op.conversation_id = c.id AND op.user_id != $1
            LIMIT 1
          )
          ELSE NULL
        END as other_participant,
        (
          SELECT COUNT(*) FROM chat_participants WHERE conversation_id = c.id
        ) as participant_count
      FROM chat_conversations c
      JOIN chat_participants p ON p.conversation_id = c.id
      WHERE p.user_id = $1
        AND c.company_id = $2
        AND (
          c.type != 'private'
          OR EXISTS (SELECT 1 FROM chat_messages WHERE conversation_id = c.id)
        )
        ${search ? `AND (c.name ILIKE $3 OR EXISTS (
          SELECT 1 FROM chat_participants cp
          JOIN users u ON u.id = cp.user_id
          WHERE cp.conversation_id = c.id AND COALESCE(u.firstname || ' ' || u.lastname, u.email) ILIKE $3
        ))` : ''}
      ORDER BY
        COALESCE((
          SELECT MAX(created_at) FROM chat_messages WHERE conversation_id = c.id
        ), c.created_at) DESC
    `, search
      ? [payload.userId, payload.companyId, `%${search}%`]
      : [payload.userId, payload.companyId]
    )

    const conversations = result.rows.map(conv => ({
      id: conv.id,
      type: conv.type,
      name: conv.type === 'private' ? conv.other_participant?.name : conv.name,
      description: conv.description,
      avatarUrl: conv.avatar_url,
      userRole: conv.user_role,
      isMuted: conv.is_muted,
      unreadCount: parseInt(conv.unread_count || '0'),
      lastMessage: conv.last_message,
      otherParticipant: conv.other_participant,
      participantCount: parseInt(conv.participant_count || '0'),
      lastReadAt: conv.last_read_at,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: conversations
    })

  } catch (error) {
    console.error('[Chat Conversations GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener conversaciones'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/chat/conversations
 * Create a new conversation (private, group, or channel)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { type, name, description, participantIds } = body

    if (!type || !['private', 'group', 'channel'].includes(type)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de conversacion invalido'
      }, { status: 400 })
    }

    if (type === 'private') {
      // Private chat requires exactly one other participant
      if (!participantIds || participantIds.length !== 1) {
        return NextResponse.json({
          success: false,
          error: 'Chat privado requiere exactamente un participante'
        }, { status: 400 })
      }

      const otherUserId = participantIds[0]

      // Check if private conversation already exists
      const existing = await db.query(`
        SELECT c.id
        FROM chat_conversations c
        WHERE c.type = 'private'
          AND c.company_id = $1
          AND EXISTS (SELECT 1 FROM chat_participants WHERE conversation_id = c.id AND user_id = $2)
          AND EXISTS (SELECT 1 FROM chat_participants WHERE conversation_id = c.id AND user_id = $3)
      `, [payload.companyId, payload.userId, otherUserId])

      if (existing.rows.length > 0) {
        // Return existing conversation
        return NextResponse.json({
          success: true,
          data: { id: existing.rows[0].id, existing: true }
        })
      }

      // Verify other user is in same company
      const userCheck = await db.query(`
        SELECT id FROM users
        WHERE id = $1
          AND EXISTS (
            SELECT 1 FROM user_companies
            WHERE userid = $1 AND companyid = $2
          )
      `, [otherUserId, payload.companyId])

      if (userCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Usuario no encontrado en esta empresa'
        }, { status: 404 })
      }
    }

    if ((type === 'group' || type === 'channel') && !name) {
      return NextResponse.json({
        success: false,
        error: 'Grupos y canales requieren un nombre'
      }, { status: 400 })
    }

    // Create conversation
    const convResult = await db.query(`
      INSERT INTO chat_conversations (company_id, type, name, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, type, name, description, created_at
    `, [payload.companyId, type, name || null, description || null, payload.userId])

    const conversationId = convResult.rows[0].id

    // Add creator as admin participant
    await db.query(`
      INSERT INTO chat_participants (conversation_id, user_id, role)
      VALUES ($1, $2, 'admin')
    `, [conversationId, payload.userId])

    // Add other participants
    if (participantIds && participantIds.length > 0) {
      for (const userId of participantIds) {
        if (userId !== payload.userId) {
          // Verify user is in same company
          const userCheck = await db.query(`
            SELECT id FROM users
            WHERE id = $1
              AND EXISTS (
                SELECT 1 FROM user_companies
                WHERE userid = $1 AND companyid = $2
              )
          `, [userId, payload.companyId])

          if (userCheck.rows.length > 0) {
            await db.query(`
              INSERT INTO chat_participants (conversation_id, user_id, role)
              VALUES ($1, $2, 'member')
              ON CONFLICT (conversation_id, user_id) DO NOTHING
            `, [conversationId, userId])
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: conversationId,
        type: convResult.rows[0].type,
        name: convResult.rows[0].name,
        description: convResult.rows[0].description,
        createdAt: convResult.rows[0].created_at
      }
    })

  } catch (error) {
    console.error('[Chat Conversations POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear conversacion'
    }, { status: 500 })
  }
}
