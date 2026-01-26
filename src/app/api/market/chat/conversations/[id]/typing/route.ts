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

// In-memory store for typing status (per conversation)
// In production, this should use Redis or database
const typingStatus = new Map<number, Map<number, { name: string; timestamp: number }>>()

// Clean old typing status (older than 5 seconds)
function cleanOldTypingStatus() {
  const now = Date.now()
  typingStatus.forEach((users, conversationId) => {
    users.forEach((info, userId) => {
      if (now - info.timestamp > 5000) {
        users.delete(userId)
      }
    })
    if (users.size === 0) {
      typingStatus.delete(conversationId)
    }
  })
}

/**
 * GET /api/market/chat/conversations/[id]/typing
 * Get users currently typing in this conversation
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

    const { id } = await params
    const conversationId = parseInt(id)

    // Clean old entries
    cleanOldTypingStatus()

    // Get typing users for this conversation (excluding current user)
    const conversationTyping = typingStatus.get(conversationId) || new Map()
    const typingUsers = Array.from(conversationTyping.entries())
      .filter(([userId]) => userId !== payload.userId)
      .map(([userId, info]) => ({ id: userId, name: info.name }))

    return NextResponse.json({
      success: true,
      data: typingUsers
    })

  } catch (error) {
    console.error('[Chat Typing GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener estado de escritura'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/chat/conversations/[id]/typing
 * Update typing status for current user
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

    const { id } = await params
    const conversationId = parseInt(id)

    const body = await request.json()
    const { isTyping } = body

    // Clean old entries
    cleanOldTypingStatus()

    // Get or create conversation typing map
    if (!typingStatus.has(conversationId)) {
      typingStatus.set(conversationId, new Map())
    }

    const conversationTyping = typingStatus.get(conversationId)!

    if (isTyping) {
      // Get user name
      const userResult = await db.query(`
        SELECT COALESCE(NULLIF(TRIM(COALESCE(firstname, '') || ' ' || COALESCE(lastname, '')), ''), email) as name
        FROM users WHERE id = $1
      `, [payload.userId])

      const userName = userResult.rows[0]?.name || 'Usuario'

      conversationTyping.set(payload.userId, {
        name: userName,
        timestamp: Date.now()
      })
    } else {
      conversationTyping.delete(payload.userId)
    }

    return NextResponse.json({
      success: true
    })

  } catch (error) {
    console.error('[Chat Typing POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al actualizar estado de escritura'
    }, { status: 500 })
  }
}
