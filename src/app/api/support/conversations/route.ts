import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/support/conversations
 * Get user's conversation history or specific conversation
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const activeOnly = searchParams.get('active') === 'true'

    if (conversationId) {
      // Get specific conversation
      const result = await db.query(`
        SELECT *
        FROM support_conversations
        WHERE conversation_id = $1 AND user_id = $2
      `, [conversationId, payload.userId])

      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Conversacion no encontrada'
        }, { status: 404 })
      }

      const conv = result.rows[0]
      return NextResponse.json({
        success: true,
        data: {
          id: conv.id,
          conversationId: conv.conversation_id,
          userId: conv.user_id,
          companyId: conv.company_id,
          messages: conv.messages || [],
          lastMessageAt: conv.last_message_at,
          isResolved: conv.is_resolved,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at
        }
      })
    }

    // Get recent conversations for the user
    let query = `
      SELECT *
      FROM support_conversations
      WHERE user_id = $1
    `
    const queryParams: (string | number | boolean)[] = [payload.userId]

    if (activeOnly) {
      query += ` AND is_resolved = false`
    }

    query += ` ORDER BY last_message_at DESC LIMIT 20`

    const result = await db.query(query, queryParams)

    return NextResponse.json({
      success: true,
      data: {
        conversations: result.rows.map(conv => ({
          id: conv.id,
          conversationId: conv.conversation_id,
          userId: conv.user_id,
          companyId: conv.company_id,
          messages: conv.messages || [],
          lastMessageAt: conv.last_message_at,
          isResolved: conv.is_resolved,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
          // Preview info
          messageCount: (conv.messages || []).length,
          lastMessage: (conv.messages || []).slice(-1)[0]?.content?.substring(0, 100) || ''
        }))
      }
    })

  } catch (error) {
    console.error('[Support Conversations API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener conversaciones'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/support/conversations?conversationId=xxx
 * Clear/delete a conversation
 */
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token invalido'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json({
        success: false,
        error: 'conversationId es requerido'
      }, { status: 400 })
    }

    // Delete conversation (only if it belongs to the user)
    const result = await db.query(`
      DELETE FROM support_conversations
      WHERE conversation_id = $1 AND user_id = $2
      RETURNING id
    `, [conversationId, payload.userId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Conversacion no encontrada'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Conversacion eliminada'
    })

  } catch (error) {
    console.error('[Support Conversations API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al eliminar conversacion'
    }, { status: 500 })
  }
}
