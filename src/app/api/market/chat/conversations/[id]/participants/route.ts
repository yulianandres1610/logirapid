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
 * GET /api/market/chat/conversations/[id]/participants
 * Get participants of a conversation
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
    const check = await db.query(`
      SELECT 1 FROM chat_participants p
      JOIN chat_conversations c ON c.id = p.conversation_id
      WHERE p.conversation_id = $1
        AND p.user_id = $2
        AND c.company_id = $3
    `, [conversationId, payload.userId, payload.companyId])

    if (check.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No eres parte de esta conversacion' }, { status: 403 })
    }

    const result = await db.query(`
      SELECT
        p.id,
        p.user_id,
        p.role,
        p.joined_at,
        p.is_muted,
        COALESCE(NULLIF(TRIM(COALESCE(u.firstname, '') || ' ' || COALESCE(u.lastname, '')), ''), u.email) as name,
        u.email,
        COALESCE(pr.status, 'offline') as presence_status,
        pr.last_seen_at
      FROM chat_participants p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN chat_presence pr ON pr.user_id = p.user_id
      WHERE p.conversation_id = $1
      ORDER BY p.role DESC, COALESCE(u.firstname, u.email) ASC
    `, [conversationId])

    const participants = result.rows.map(p => ({
      id: p.id,
      userId: p.user_id,
      name: p.name || p.email,
      email: p.email,
      role: p.role,
      joinedAt: p.joined_at,
      isMuted: p.is_muted,
      presence: {
        status: p.presence_status,
        lastSeenAt: p.last_seen_at
      }
    }))

    return NextResponse.json({
      success: true,
      data: participants
    })

  } catch (error) {
    console.error('[Chat Participants GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener participantes'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/chat/conversations/[id]/participants
 * Add participants to a group/channel
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

    // Verify user is admin of the conversation
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
      return NextResponse.json({ success: false, error: 'Solo administradores pueden agregar participantes' }, { status: 403 })
    }

    if (adminCheck.rows[0].type === 'private') {
      return NextResponse.json({ success: false, error: 'No se pueden agregar participantes a chats privados' }, { status: 400 })
    }

    const body = await request.json()
    const { userIds } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Lista de usuarios es requerida' }, { status: 400 })
    }

    const added: number[] = []

    for (const userId of userIds) {
      // Verify user is in same company
      const userCheck = await db.query(`
        SELECT id FROM users
        WHERE id = $1
          AND EXISTS (
            SELECT 1 FROM user_companies
            WHERE user_id = $1 AND company_id = $2
          )
      `, [userId, payload.companyId])

      if (userCheck.rows.length > 0) {
        const result = await db.query(`
          INSERT INTO chat_participants (conversation_id, user_id, role)
          VALUES ($1, $2, 'member')
          ON CONFLICT (conversation_id, user_id) DO NOTHING
          RETURNING id
        `, [conversationId, userId])

        if (result.rows.length > 0) {
          added.push(userId)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        added,
        message: `${added.length} participante(s) agregado(s)`
      }
    })

  } catch (error) {
    console.error('[Chat Participants POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al agregar participantes'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/chat/conversations/[id]/participants
 * Remove a participant from a group/channel
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
    const conversationId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const userId = parseInt(searchParams.get('userId') || '0')

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId es requerido' }, { status: 400 })
    }

    // Verify user is admin of the conversation
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
      return NextResponse.json({ success: false, error: 'Solo administradores pueden remover participantes' }, { status: 403 })
    }

    if (adminCheck.rows[0].type === 'private') {
      return NextResponse.json({ success: false, error: 'No se pueden remover participantes de chats privados' }, { status: 400 })
    }

    // Don't allow removing yourself as admin
    if (userId === payload.userId) {
      return NextResponse.json({ success: false, error: 'No puedes removerte a ti mismo' }, { status: 400 })
    }

    await db.query(`
      DELETE FROM chat_participants
      WHERE conversation_id = $1 AND user_id = $2
    `, [conversationId, userId])

    return NextResponse.json({
      success: true,
      message: 'Participante removido'
    })

  } catch (error) {
    console.error('[Chat Participants DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al remover participante'
    }, { status: 500 })
  }
}
