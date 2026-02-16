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
 * GET /api/market/door-security/logs
 * List visitor logs with filtering
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
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') // 'active', 'completed', 'all'
    const kioskId = searchParams.get('kioskId')
    const visitorId = searchParams.get('visitorId')
    const date = searchParams.get('date') // YYYY-MM-DD
    const search = searchParams.get('search')
    const offset = (page - 1) * limit

    let whereClause = 'WHERE vl.companyid = $1'
    const params: any[] = [payload.companyId]
    let paramIndex = 2

    if (status && status !== 'all') {
      whereClause += ` AND vl.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (kioskId) {
      whereClause += ` AND vl.kioskid = $${paramIndex}`
      params.push(kioskId)
      paramIndex++
    }

    if (visitorId) {
      whereClause += ` AND vl.visitorid = $${paramIndex}`
      params.push(visitorId)
      paramIndex++
    }

    if (date) {
      whereClause += ` AND DATE(vl.entrytime) = $${paramIndex}`
      params.push(date)
      paramIndex++
    }

    if (search) {
      whereClause += ` AND (v.fullname ILIKE $${paramIndex} OR v.idnumber ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM market_visitor_logs vl
      JOIN market_visitors v ON vl.visitorid = v.id
      ${whereClause}
    `, params)

    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get logs with visitor and kiosk info
    const result = await db.query(`
      SELECT
        vl.id,
        vl.visitorid,
        vl.kioskid,
        vl.entrytime,
        vl.exittime,
        vl.visitpurpose,
        vl.visitnotes,
        vl.hostemployeeid,
        vl.haspendinginvoices,
        vl.invoicesvalidated,
        vl.validatedat,
        vl.status,
        vl.createdat,
        v.fullname as visitorname,
        v.idnumber as visitoridnumber,
        v.idtype as visitoridtype,
        k.name as kioskname,
        k.location as kiosklocation,
        e.firstname || ' ' || e.lastname as hostname
      FROM market_visitor_logs vl
      JOIN market_visitors v ON vl.visitorid = v.id
      LEFT JOIN market_door_kiosks k ON vl.kioskid = k.id
      LEFT JOIN market_employees e ON vl.hostemployeeid = e.id
      ${whereClause}
      ORDER BY vl.entrytime DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset])

    return NextResponse.json({
      success: true,
      data: {
        logs: result.rows.map(l => ({
          id: l.id,
          visitorId: l.visitorid,
          visitorName: l.visitorname,
          visitorIdNumber: l.visitoridnumber,
          visitorIdType: l.visitoridtype,
          kioskId: l.kioskid,
          kioskName: l.kioskname,
          kioskLocation: l.kiosklocation,
          entryTime: l.entrytime,
          exitTime: l.exittime,
          visitPurpose: l.visitpurpose,
          visitNotes: l.visitnotes,
          hostEmployeeId: l.hostemployeeid,
          hostName: l.hostname,
          hasPendingInvoices: l.haspendinginvoices,
          invoicesValidated: l.invoicesvalidated,
          validatedAt: l.validatedat,
          status: l.status,
          createdAt: l.createdat
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Visitor Logs GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener registros'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/door-security/logs
 * Create a new visitor log entry (entry or exit)
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
        error: 'Token inválido'
      }, { status: 401 })
    }

    const body = await request.json()
    const {
      action, // 'entry' or 'exit'
      visitorId,
      kioskId,
      visitPurpose,
      visitNotes,
      hostEmployeeId,
      logId // For exit action
    } = body

    if (!action || !['entry', 'exit'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: 'Acción inválida. Use "entry" o "exit"'
      }, { status: 400 })
    }

    if (action === 'entry') {
      // Create entry log
      if (!visitorId) {
        return NextResponse.json({
          success: false,
          error: 'ID del visitante requerido'
        }, { status: 400 })
      }

      // Check if visitor already has an active entry
      const activeEntry = await db.query(`
        SELECT id FROM market_visitor_logs
        WHERE visitorid = $1 AND companyid = $2 AND status = 'active'
      `, [visitorId, payload.companyId])

      if (activeEntry.rows.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'El visitante ya tiene una entrada activa. Debe registrar salida primero.'
        }, { status: 400 })
      }

      // Create entry
      const result = await db.query(`
        INSERT INTO market_visitor_logs (
          companyid, visitorid, kioskid, entrytime,
          visitpurpose, visitnotes, hostemployeeid, status
        ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, 'active')
        RETURNING *
      `, [
        payload.companyId,
        visitorId,
        kioskId || null,
        visitPurpose || null,
        visitNotes || null,
        hostEmployeeId || null
      ])

      const log = result.rows[0]

      // Update visitor's last visit
      await db.query(`
        UPDATE market_visitors SET lastvisit = NOW() WHERE id = $1
      `, [visitorId])

      console.log('[Visitor Logs POST] Entry created:', log.id, 'for visitor:', visitorId)

      return NextResponse.json({
        success: true,
        data: {
          action: 'entry',
          logId: log.id,
          entryTime: log.entrytime,
          status: log.status
        }
      })

    } else if (action === 'exit') {
      // Process exit
      let log

      if (logId) {
        // Exit by log ID
        const logResult = await db.query(`
          SELECT * FROM market_visitor_logs
          WHERE id = $1 AND companyid = $2 AND status = 'active'
        `, [logId, payload.companyId])

        if (logResult.rows.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Registro de entrada no encontrado o ya cerrado'
          }, { status: 404 })
        }
        log = logResult.rows[0]
      } else if (visitorId) {
        // Exit by visitor ID (find active entry)
        const logResult = await db.query(`
          SELECT * FROM market_visitor_logs
          WHERE visitorid = $1 AND companyid = $2 AND status = 'active'
          ORDER BY entrytime DESC
          LIMIT 1
        `, [visitorId, payload.companyId])

        if (logResult.rows.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No hay entrada activa para este visitante'
          }, { status: 404 })
        }
        log = logResult.rows[0]
      } else {
        return NextResponse.json({
          success: false,
          error: 'Se requiere logId o visitorId para registrar salida'
        }, { status: 400 })
      }

      // Check for pending invoices if required
      // This will be checked in a separate endpoint

      // Update log with exit time
      const updateResult = await db.query(`
        UPDATE market_visitor_logs
        SET
          exittime = NOW(),
          status = 'completed'
        WHERE id = $1
        RETURNING *
      `, [log.id])

      const updatedLog = updateResult.rows[0]

      console.log('[Visitor Logs POST] Exit recorded:', log.id)

      return NextResponse.json({
        success: true,
        data: {
          action: 'exit',
          logId: updatedLog.id,
          entryTime: updatedLog.entrytime,
          exitTime: updatedLog.exittime,
          status: updatedLog.status
        }
      })
    }

  } catch (error) {
    console.error('[Visitor Logs POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al registrar'
    }, { status: 500 })
  }
}
