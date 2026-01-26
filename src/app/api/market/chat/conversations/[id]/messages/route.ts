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
 * GET /api/market/chat/conversations/[id]/messages
 * Get messages for a conversation with pagination
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
      SELECT 1 FROM chat_participants p
      JOIN chat_conversations c ON c.id = p.conversation_id
      WHERE p.conversation_id = $1
        AND p.user_id = $2
        AND c.company_id = $3
    `, [conversationId, payload.userId, payload.companyId])

    if (participantCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No eres parte de esta conversacion' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const beforeId = searchParams.get('before') // For pagination (load older messages)
    const afterId = searchParams.get('after') // For getting new messages

    let query = `
      SELECT
        m.id,
        m.content,
        m.message_type,
        m.file_url,
        m.file_name,
        m.file_size,
        m.file_type,
        m.reply_to_id,
        m.is_pinned,
        m.pinned_by,
        m.pinned_at,
        m.is_deleted,
        m.created_at,
        m.edited_at,
        m.sender_id,
        COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.email) as sender_name,
        u.email as sender_email,
        (
          SELECT json_agg(json_build_object(
            'emoji', r.emoji,
            'userId', r.user_id,
            'userName', COALESCE(NULLIF(TRIM(COALESCE(ru.firstname, '') || ' ' || COALESCE(ru.lastname, '')), ''), ru.email)
          ))
          FROM chat_reactions r
          JOIN users ru ON ru.id = r.user_id
          WHERE r.message_id = m.id
        ) as reactions,
        (
          SELECT json_build_object(
            'id', rm.id,
            'content', rm.content,
            'senderName', COALESCE(NULLIF(TRIM(COALESCE(rmu.firstname, '') || ' ' || COALESCE(rmu.lastname, '')), ''), rmu.email)
          )
          FROM chat_messages rm
          JOIN users rmu ON rmu.id = rm.sender_id
          WHERE rm.id = m.reply_to_id AND rm.is_deleted = false
        ) as reply_to_message
      FROM chat_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $1
    `

    const queryParams: (string | number)[] = [conversationId]

    if (beforeId) {
      queryParams.push(parseInt(beforeId))
      query += ` AND m.id < $${queryParams.length}`
    }

    if (afterId) {
      queryParams.push(parseInt(afterId))
      query += ` AND m.id > $${queryParams.length}`
    }

    query += ` ORDER BY m.created_at DESC LIMIT $${queryParams.length + 1}`
    queryParams.push(limit)

    const result = await db.query(query, queryParams)

    // Get all participants with their last_read_at for read status
    const participantsResult = await db.query(`
      SELECT p.user_id, p.last_read_at,
        COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.email) as name
      FROM chat_participants p
      JOIN users u ON u.id = p.user_id
      WHERE p.conversation_id = $1
    `, [conversationId])

    const otherParticipants = participantsResult.rows.filter(p => p.user_id !== payload.userId)

    // Reverse to get chronological order
    const messages = result.rows.reverse().map(msg => {
      // Calculate read status for this message
      // readBy contains the user ids who have read this message (their last_read_at >= message created_at)
      const readBy = otherParticipants
        .filter(p => p.last_read_at && new Date(p.last_read_at) >= new Date(msg.created_at))
        .map(p => ({ id: p.user_id, name: p.name }))

      return {
        id: msg.id,
        content: msg.is_deleted ? null : msg.content,
        messageType: msg.message_type,
        fileUrl: msg.is_deleted ? null : msg.file_url,
        fileName: msg.is_deleted ? null : msg.file_name,
        fileSize: msg.file_size,
        fileType: msg.file_type,
        replyToId: msg.reply_to_id,
        replyToMessage: msg.reply_to_message,
        isPinned: msg.is_pinned,
        pinnedBy: msg.pinned_by,
        pinnedAt: msg.pinned_at,
        isDeleted: msg.is_deleted,
        createdAt: msg.created_at,
        editedAt: msg.edited_at,
        sender: {
          id: msg.sender_id,
          name: msg.sender_name,
          email: msg.sender_email
        },
        reactions: msg.reactions || [],
        readBy,
        isReadByAll: readBy.length === otherParticipants.length
      }
    })

    // Update last_read_at for current user
    await db.query(`
      UPDATE chat_participants
      SET last_read_at = NOW()
      WHERE conversation_id = $1 AND user_id = $2
    `, [conversationId, payload.userId])

    return NextResponse.json({
      success: true,
      data: {
        messages,
        hasMore: result.rows.length === limit
      }
    })

  } catch (error) {
    console.error('[Chat Messages GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener mensajes'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/chat/conversations/[id]/messages
 * Send a new message
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
    const conversationId = parseInt(id)

    // Verify user is a participant and check conversation type
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

    // Only admins can post in channels
    if (type === 'channel' && role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: 'Solo administradores pueden publicar en canales'
      }, { status: 403 })
    }

    const body = await request.json()
    const { content, messageType = 'text', fileUrl, fileName, fileSize, fileType, replyToId } = body

    // Validate content
    if (messageType === 'text' && (!content || content.trim() === '')) {
      return NextResponse.json({
        success: false,
        error: 'El mensaje no puede estar vacio'
      }, { status: 400 })
    }

    if (['image', 'audio', 'file'].includes(messageType) && !fileUrl) {
      return NextResponse.json({
        success: false,
        error: 'URL del archivo es requerida'
      }, { status: 400 })
    }

    // Verify reply_to_id exists in same conversation if provided
    if (replyToId) {
      const replyCheck = await db.query(`
        SELECT id FROM chat_messages
        WHERE id = $1 AND conversation_id = $2 AND is_deleted = false
      `, [replyToId, conversationId])

      if (replyCheck.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Mensaje a responder no encontrado'
        }, { status: 404 })
      }
    }

    // Insert message
    const result = await db.query(`
      INSERT INTO chat_messages (
        conversation_id, sender_id, content, message_type,
        file_url, file_name, file_size, file_type, reply_to_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, content, message_type, file_url, file_name, file_size, file_type, reply_to_id, created_at
    `, [
      conversationId, payload.userId, content, messageType,
      fileUrl || null, fileName || null, fileSize || null, fileType || null, replyToId || null
    ])

    // Update conversation updated_at
    await db.query(`
      UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1
    `, [conversationId])

    // Get sender info
    const senderResult = await db.query(`
      SELECT COALESCE(NULLIF(TRIM(COALESCE(firstname, '') || ' ' || COALESCE(lastname, '')), ''), email) as name, email FROM users WHERE id = $1
    `, [payload.userId])

    // Get reply_to message if exists
    let replyToMessage = null
    if (replyToId) {
      const replyResult = await db.query(`
        SELECT m.id, m.content, COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.email) as sender_name
        FROM chat_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.id = $1
      `, [replyToId])
      if (replyResult.rows.length > 0) {
        replyToMessage = {
          id: replyResult.rows[0].id,
          content: replyResult.rows[0].content,
          senderName: replyResult.rows[0].sender_name
        }
      }
    }

    const message = result.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        id: message.id,
        content: message.content,
        messageType: message.message_type,
        fileUrl: message.file_url,
        fileName: message.file_name,
        fileSize: message.file_size,
        fileType: message.file_type,
        replyToId: message.reply_to_id,
        replyToMessage,
        createdAt: message.created_at,
        sender: {
          id: payload.userId,
          name: senderResult.rows[0]?.name,
          email: senderResult.rows[0]?.email
        },
        reactions: []
      }
    })

  } catch (error) {
    console.error('[Chat Messages POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al enviar mensaje'
    }, { status: 500 })
  }
}
