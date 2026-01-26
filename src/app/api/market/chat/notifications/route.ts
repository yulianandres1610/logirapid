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
 * GET /api/market/chat/notifications
 * Get new messages since a specific time for notification purposes
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

    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since') || new Date(Date.now() - 30000).toISOString() // Default: last 30 seconds

    // Get new messages from conversations the user is part of
    const result = await db.query(`
      SELECT
        m.id,
        m.content,
        m.conversation_id,
        m.created_at,
        m.sender_id,
        COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.email) as sender_name,
        CASE
          WHEN c.type = 'private' THEN (
            SELECT COALESCE(NULLIF(TRIM(COALESCE(ou.firstname, '') || ' ' || COALESCE(ou.lastname, '')), ''), ou.email)
            FROM chat_participants op
            JOIN users ou ON ou.id = op.user_id
            WHERE op.conversation_id = c.id AND op.user_id != $1
            LIMIT 1
          )
          ELSE c.name
        END as conversation_name
      FROM chat_messages m
      JOIN users u ON u.id = m.sender_id
      JOIN chat_conversations c ON c.id = m.conversation_id
      JOIN chat_participants p ON p.conversation_id = c.id AND p.user_id = $1
      WHERE c.company_id = $2
        AND m.created_at > $3
        AND m.sender_id != $1
        AND m.is_deleted = false
      ORDER BY m.created_at ASC
      LIMIT 20
    `, [payload.userId, payload.companyId, since])

    const messages = result.rows.map(row => ({
      id: row.id,
      content: row.content,
      conversationId: row.conversation_id,
      conversationName: row.conversation_name || 'Conversación',
      sender: {
        id: row.sender_id,
        name: row.sender_name
      },
      createdAt: row.created_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        messages,
        count: messages.length
      }
    })

  } catch (error) {
    console.error('[Chat Notifications GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener notificaciones'
    }, { status: 500 })
  }
}
