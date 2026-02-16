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
 * POST /api/market/door-security/validate-document
 * Validate a POS receipt or wholesale invoice for a visitor exit
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
      visitorLogId,
      documentType, // 'pos_receipt' or 'wholesale_invoice'
      documentId,
      documentNumber,
      totalAmount,
      currency,
      notes,
      guardEmployeeId
    } = body

    if (!visitorLogId || !documentType) {
      return NextResponse.json({
        success: false,
        error: 'visitorLogId y documentType son requeridos'
      }, { status: 400 })
    }

    if (!['pos_receipt', 'wholesale_invoice'].includes(documentType)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de documento inválido'
      }, { status: 400 })
    }

    // Check visitor log exists and belongs to company
    const logResult = await db.query(`
      SELECT id, companyid, status FROM market_visitor_logs WHERE id = $1
    `, [visitorLogId])

    if (logResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Registro de visita no encontrado'
      }, { status: 404 })
    }

    const log = logResult.rows[0]
    if (payload.role !== 'SUPER_ADMIN' && log.companyid !== payload.companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a este registro'
      }, { status: 403 })
    }

    // Check if already validated
    const existingValidation = await db.query(`
      SELECT id FROM market_visitor_invoice_validations
      WHERE visitorlogid = $1
        AND documenttype = $2
        AND (documentid = $3 OR documentnumber = $4)
    `, [visitorLogId, documentType, documentId, documentNumber])

    if (existingValidation.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Este documento ya fue validado'
      }, { status: 400 })
    }

    // Get guard employee ID if not provided
    let validatorId = guardEmployeeId
    if (!validatorId) {
      // Try to find employee by user ID
      const employeeResult = await db.query(`
        SELECT id FROM market_employees
        WHERE userid = $1 AND companyid = $2
        LIMIT 1
      `, [payload.userId, payload.companyId])

      if (employeeResult.rows.length > 0) {
        validatorId = employeeResult.rows[0].id
      }
    }

    // Create validation record
    const result = await db.query(`
      INSERT INTO market_visitor_invoice_validations (
        visitorlogid, documenttype, documentid, documentnumber,
        totalamount, currency, validated, validatedat, validatedby, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), $7, $8)
      RETURNING *
    `, [
      visitorLogId,
      documentType,
      documentId || null,
      documentNumber || null,
      totalAmount || null,
      currency || 'CUP',
      validatorId || null,
      notes || null
    ])

    const validation = result.rows[0]

    // Check if all pending documents are validated
    // Update log invoicesvalidated status
    const pendingCount = await db.query(`
      SELECT COUNT(*) as pending
      FROM (
        -- Check POS receipts today
        SELECT ps.id
        FROM market_pos_sales ps
        JOIN market_visitor_logs vl ON vl.id = $1
        JOIN market_visitors v ON vl.visitorid = v.id
        WHERE ps.companyid = $2
          AND DATE(ps.createdat) = DATE(vl.entrytime)
          AND ps.status = 'completed'
          AND (
            LOWER(ps.customername) ILIKE LOWER('%' || SPLIT_PART(v.fullname, ' ', 1) || '%')
            OR ps.customername ILIKE '%' || v.idnumber || '%'
          )
          AND NOT EXISTS (
            SELECT 1 FROM market_visitor_invoice_validations iv
            WHERE iv.visitorlogid = $1
              AND iv.documenttype = 'pos_receipt'
              AND iv.documentid = ps.id
          )

        UNION ALL

        -- Check wholesale invoices today
        SELECT wi.id
        FROM market_wholesale_invoices wi
        LEFT JOIN market_customers c ON wi.customerid = c.id
        JOIN market_visitor_logs vl ON vl.id = $1
        JOIN market_visitors v ON vl.visitorid = v.id
        WHERE wi.companyid = $2
          AND DATE(wi.createdat) = DATE(vl.entrytime)
          AND wi.status IN ('pending', 'completed', 'paid')
          AND (
            LOWER(c.businessname) ILIKE LOWER('%' || SPLIT_PART(v.fullname, ' ', 1) || '%')
            OR c.identificationnumber ILIKE '%' || v.idnumber || '%'
          )
          AND NOT EXISTS (
            SELECT 1 FROM market_visitor_invoice_validations iv
            WHERE iv.visitorlogid = $1
              AND iv.documenttype = 'wholesale_invoice'
              AND iv.documentid = wi.id
          )
      ) pending_docs
    `, [visitorLogId, log.companyid])

    const remainingPending = parseInt(pendingCount.rows[0]?.pending || '0')

    if (remainingPending === 0) {
      await db.query(`
        UPDATE market_visitor_logs
        SET invoicesvalidated = true, validatedat = NOW(), validatedby = $2
        WHERE id = $1
      `, [visitorLogId, validatorId])
    }

    console.log('[Validate Document] Validated:', documentType, documentId || documentNumber, 'for log:', visitorLogId)

    return NextResponse.json({
      success: true,
      data: {
        validationId: validation.id,
        documentType: validation.documenttype,
        documentNumber: validation.documentnumber,
        totalAmount: parseFloat(validation.totalamount || '0'),
        validated: validation.validated,
        validatedAt: validation.validatedat,
        allValidated: remainingPending === 0,
        remainingPending
      }
    })

  } catch (error) {
    console.error('[Validate Document] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al validar documento'
    }, { status: 500 })
  }
}
