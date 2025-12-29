import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import type { CreateTicketRequest } from '@/types/support'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/support/tickets
 * List tickets - for user: their tickets, for superadmin: all tickets
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
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build query based on role
    const isSuperAdmin = payload.role === 'superadmin'
    let whereClause = isSuperAdmin ? '' : 'WHERE st.user_id = $1'
    const queryParams: (string | number)[] = isSuperAdmin ? [] : [payload.userId]
    let paramIndex = isSuperAdmin ? 1 : 2

    if (status && status !== 'all') {
      whereClause += whereClause ? ' AND ' : 'WHERE '
      whereClause += `st.status = $${paramIndex}`
      queryParams.push(status)
      paramIndex++
    }

    if (priority && priority !== 'all') {
      whereClause += whereClause ? ' AND ' : 'WHERE '
      whereClause += `st.priority = $${paramIndex}`
      queryParams.push(priority)
      paramIndex++
    }

    // Get tickets with user and company info
    const query = `
      SELECT
        st.*,
        u.name as user_name,
        u.email as user_email,
        c.legalname as company_name,
        au.name as assigned_to_name
      FROM support_tickets st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN companies c ON st.company_id = c.id
      LEFT JOIN users au ON st.assigned_to = au.id
      ${whereClause}
      ORDER BY
        CASE st.priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        st.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    queryParams.push(limit, offset)

    const result = await db.query(query, queryParams)

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM support_tickets st
      ${whereClause}
    `
    const countParams = queryParams.slice(0, -2) // Remove limit and offset
    const countResult = await db.query(countQuery, countParams)
    const total = parseInt(countResult.rows[0]?.total) || 0

    // Get stats
    const statsQuery = isSuperAdmin
      ? `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE status = 'closed') as closed,
          COUNT(*) FILTER (WHERE priority = 'critical' AND status IN ('open', 'in_progress')) as critical_open
        FROM support_tickets
      `
      : `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'open') as open,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          COUNT(*) FILTER (WHERE status = 'closed') as closed
        FROM support_tickets
        WHERE user_id = $1
      `
    const statsResult = await db.query(statsQuery, isSuperAdmin ? [] : [payload.userId])

    return NextResponse.json({
      success: true,
      data: {
        tickets: result.rows.map(row => ({
          id: row.id,
          ticketCode: row.ticket_code,
          userId: row.user_id,
          companyId: row.company_id,
          conversationId: row.conversation_id,
          subject: row.subject,
          description: row.description,
          screenshots: row.screenshots || [],
          status: row.status,
          priority: row.priority,
          assignedTo: row.assigned_to,
          assignedAt: row.assigned_at,
          resolution: row.resolution,
          resolvedBy: row.resolved_by,
          resolvedAt: row.resolved_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          userName: row.user_name,
          userEmail: row.user_email,
          companyName: row.company_name,
          assignedToName: row.assigned_to_name
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        stats: {
          total: parseInt(statsResult.rows[0]?.total) || 0,
          open: parseInt(statsResult.rows[0]?.open) || 0,
          inProgress: parseInt(statsResult.rows[0]?.in_progress) || 0,
          resolved: parseInt(statsResult.rows[0]?.resolved) || 0,
          closed: parseInt(statsResult.rows[0]?.closed) || 0,
          criticalOpen: parseInt(statsResult.rows[0]?.critical_open) || 0
        }
      }
    })

  } catch (error) {
    console.error('[Support Tickets API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener tickets'
    }, { status: 500 })
  }
}

/**
 * POST /api/support/tickets
 * Create a new support ticket (escalate from chat)
 */
export async function POST(request: NextRequest) {
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

    const body: CreateTicketRequest = await request.json()
    const { subject, description, conversationId, screenshots, priority } = body

    if (!subject || subject.trim().length < 5) {
      return NextResponse.json({
        success: false,
        error: 'El asunto debe tener al menos 5 caracteres'
      }, { status: 400 })
    }

    if (!description || description.trim().length < 10) {
      return NextResponse.json({
        success: false,
        error: 'La descripcion debe tener al menos 10 caracteres'
      }, { status: 400 })
    }

    // Create ticket
    const result = await db.query(`
      INSERT INTO support_tickets (
        user_id, company_id, conversation_id,
        subject, description, screenshots, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, ticket_code
    `, [
      payload.userId,
      payload.companyId,
      conversationId || null,
      subject.trim(),
      description.trim(),
      screenshots || [],
      priority || 'medium'
    ])

    const ticketId = result.rows[0].id
    const ticketCode = result.rows[0].ticket_code

    // Create notification for superadmins
    try {
      // Get all superadmin users
      const superadmins = await db.query(`
        SELECT id FROM users WHERE role = 'superadmin' AND status = 'active'
      `)

      // Insert notifications for each superadmin
      for (const admin of superadmins.rows) {
        await db.query(`
          INSERT INTO notifications (user_id, type, title, message, data, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          admin.id,
          'support_ticket',
          `Nuevo ticket de soporte: ${ticketCode}`,
          `${payload.companyName} - ${subject}`,
          JSON.stringify({
            ticketId,
            ticketCode,
            priority,
            userId: payload.userId,
            companyId: payload.companyId
          })
        ])
      }
    } catch (notifError) {
      // Don't fail the ticket creation if notifications fail
      console.error('[Support Tickets] Error creating notifications:', notifError)
    }

    console.log('[Support Tickets] Created ticket:', ticketCode)

    return NextResponse.json({
      success: true,
      data: {
        ticketId,
        ticketCode
      },
      message: 'Ticket creado exitosamente. Nuestro equipo de soporte te contactara pronto.'
    })

  } catch (error) {
    console.error('[Support Tickets API] Error creating ticket:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear ticket'
    }, { status: 500 })
  }
}
