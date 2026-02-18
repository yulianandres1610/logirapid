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
 * GET /api/market/door-security/logs/[id]
 * Get a specific visitor log with all details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const result = await db.query(`
      SELECT
        vl.id,
        vl.companyid,
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
        vl.validatedby,
        vl.status,
        vl.createdat,
        v.fullname as visitorname,
        v.idnumber as visitoridnumber,
        v.idtype as visitoridtype,
        v.address as visitoraddress,
        k.name as kioskname,
        k.location as kiosklocation,
        COALESCE(uh.firstname || ' ' || uh.lastname, uh.email) as hostname,
        COALESCE(uvb.firstname || ' ' || uvb.lastname, uvb.email) as validatedbyname
      FROM market_visitor_logs vl
      JOIN market_visitors v ON vl.visitorid = v.id
      LEFT JOIN market_door_kiosks k ON vl.kioskid = k.id
      LEFT JOIN market_employees e ON vl.hostemployeeid = e.id
      LEFT JOIN users uh ON e.user_id = uh.id
      LEFT JOIN market_employees vb ON vl.validatedby = vb.id
      LEFT JOIN users uvb ON vb.user_id = uvb.id
      WHERE vl.id = $1
    `, [id])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Registro no encontrado'
      }, { status: 404 })
    }

    const log = result.rows[0]

    // Check access
    if (payload.role !== 'SUPER_ADMIN' && log.companyid !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a este registro'
      }, { status: 403 })
    }

    // Get invoice validations for this log
    const validationsResult = await db.query(`
      SELECT
        iv.id,
        iv.documenttype,
        iv.documentid,
        iv.documentnumber,
        iv.totalamount,
        iv.currency,
        iv.validated,
        iv.validatedat,
        iv.notes,
        COALESCE(u.firstname || ' ' || u.lastname, u.email) as validatedbyname
      FROM market_visitor_invoice_validations iv
      LEFT JOIN market_employees e ON iv.validatedby = e.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE iv.visitorlogid = $1
      ORDER BY iv.createdat ASC
    `, [id])

    return NextResponse.json({
      success: true,
      data: {
        log: {
          id: log.id,
          visitorId: log.visitorid,
          visitorName: log.visitorname,
          visitorIdNumber: log.visitoridnumber,
          visitorIdType: log.visitoridtype,
          visitorAddress: log.visitoraddress,
          kioskId: log.kioskid,
          kioskName: log.kioskname,
          kioskLocation: log.kiosklocation,
          entryTime: log.entrytime,
          exitTime: log.exittime,
          visitPurpose: log.visitpurpose,
          visitNotes: log.visitnotes,
          hostEmployeeId: log.hostemployeeid,
          hostName: log.hostname,
          hasPendingInvoices: log.haspendinginvoices,
          invoicesValidated: log.invoicesvalidated,
          validatedAt: log.validatedat,
          validatedByName: log.validatedbyname,
          status: log.status,
          createdAt: log.createdat
        },
        invoiceValidations: validationsResult.rows.map(v => ({
          id: v.id,
          documentType: v.documenttype,
          documentId: v.documentid,
          documentNumber: v.documentnumber,
          totalAmount: parseFloat(v.totalamount || '0'),
          currency: v.currency,
          validated: v.validated,
          validatedAt: v.validatedat,
          validatedByName: v.validatedbyname,
          notes: v.notes
        }))
      }
    })

  } catch (error) {
    console.error('[Visitor Log GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener registro'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/market/door-security/logs/[id]
 * Update a visitor log (add notes, update purpose, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Check log exists and belongs to company
    const existingResult = await db.query(`
      SELECT id, companyid, status FROM market_visitor_logs WHERE id = $1
    `, [id])

    if (existingResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Registro no encontrado'
      }, { status: 404 })
    }

    const log = existingResult.rows[0]
    if (payload.role !== 'SUPER_ADMIN' && log.companyid !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a este registro'
      }, { status: 403 })
    }

    const body = await request.json()
    const { visitPurpose, visitNotes, hostEmployeeId, status } = body

    // Build update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (visitPurpose !== undefined) {
      updates.push(`visitpurpose = $${paramIndex}`)
      values.push(visitPurpose)
      paramIndex++
    }
    if (visitNotes !== undefined) {
      updates.push(`visitnotes = $${paramIndex}`)
      values.push(visitNotes)
      paramIndex++
    }
    if (hostEmployeeId !== undefined) {
      updates.push(`hostemployeeid = $${paramIndex}`)
      values.push(hostEmployeeId)
      paramIndex++
    }
    if (status !== undefined && ['active', 'completed', 'cancelled'].includes(status)) {
      updates.push(`status = $${paramIndex}`)
      values.push(status)
      paramIndex++

      if (status === 'completed' && log.status === 'active') {
        updates.push(`exittime = NOW()`)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay campos para actualizar'
      }, { status: 400 })
    }

    values.push(id)

    const result = await db.query(`
      UPDATE market_visitor_logs
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values)

    const updated = result.rows[0]

    console.log('[Visitor Log PATCH] Updated log:', id)

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        visitPurpose: updated.visitpurpose,
        visitNotes: updated.visitnotes,
        hostEmployeeId: updated.hostemployeeid,
        status: updated.status,
        exitTime: updated.exittime
      }
    })

  } catch (error) {
    console.error('[Visitor Log PATCH] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar registro'
    }, { status: 500 })
  }
}
