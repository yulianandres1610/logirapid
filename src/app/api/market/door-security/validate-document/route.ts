import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import * as storageAdapter from '@/lib/storage-adapter'

// Run migrations once per process
let migrationRan = false
async function runMigrations() {
  if (migrationRan) return
  try {
    // Add photourl column if missing
    await db.query(`ALTER TABLE market_visitor_invoice_validations ADD COLUMN IF NOT EXISTS photourl TEXT`)

    // Add companyid column if missing
    await db.query(`ALTER TABLE market_visitor_invoice_validations ADD COLUMN IF NOT EXISTS companyid INTEGER`)

    // Add createdat column if missing
    await db.query(`ALTER TABLE market_visitor_invoice_validations ADD COLUMN IF NOT EXISTS createdat TIMESTAMP`)

    // Populate missing companyid from visitor_logs
    await db.query(`
      UPDATE market_visitor_invoice_validations v
      SET companyid = vl.companyid
      FROM market_visitor_logs vl
      WHERE v.visitorlogid = vl.id
        AND v.companyid IS NULL
    `)

    // Populate missing createdat from validatedat
    await db.query(`
      UPDATE market_visitor_invoice_validations
      SET createdat = validatedat
      WHERE createdat IS NULL AND validatedat IS NOT NULL
    `)

    migrationRan = true
  } catch (err) {
    console.warn('[Validate Document] Migration error (non-fatal):', err)
    migrationRan = true
  }
}

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

    const body = await request.json()
    const {
      visitorLogId,
      documentType, // 'pos_receipt', 'pos_order', or 'wholesale_invoice'
      documentId,
      documentNumber,
      totalAmount,
      currency,
      notes,
      guardEmployeeId,
      kioskId,
      guardId,
      photoBase64
    } = body

    let companyId: number | null = null
    let userId: number | null = null
    let userRole: string | null = null
    let isAuthenticated = false

    // Try JWT authentication first
    if (authToken) {
      try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const payload = jwt.verify(authToken, secret) as JWTPayload
        companyId = payload.companyId
        userId = payload.userId
        userRole = payload.role
        isAuthenticated = true
      } catch {
        // JWT invalid, will try kiosk auth
      }
    }

    // Try kiosk authentication if JWT failed
    if (!isAuthenticated && kioskId && guardId) {
      const kioskResult = await db.query(
        'SELECT companyid FROM market_door_kiosks WHERE id = $1 AND isactive = true',
        [kioskId]
      )
      if (kioskResult.rows.length > 0) {
        const guardResult = await db.query(
          'SELECT id FROM market_door_guards WHERE employeeid = $1 AND isactive = true',
          [guardId]
        )
        if (guardResult.rows.length > 0) {
          companyId = kioskResult.rows[0].companyid
          isAuthenticated = true
        }
      }
    }

    if (!isAuthenticated || !companyId) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    if (!visitorLogId || !documentType) {
      return NextResponse.json({
        success: false,
        error: 'visitorLogId y documentType son requeridos'
      }, { status: 400 })
    }

    if (!['pos_receipt', 'pos_order', 'wholesale_invoice'].includes(documentType)) {
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
    if (userRole !== 'SUPER_ADMIN' && log.companyid !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a este registro'
      }, { status: 403 })
    }

    // Check if already validated globally (not just within this visitor log)
    const existingValidation = await db.query(`
      SELECT id FROM market_visitor_invoice_validations
      WHERE documenttype = $1
        AND (documentid = $2 OR documentnumber = $3)
    `, [documentType, documentId, documentNumber])

    if (existingValidation.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Este documento ya fue validado'
      }, { status: 400 })
    }

    // Get guard employee ID if not provided
    let validatorId = guardEmployeeId || guardId
    if (!validatorId && userId) {
      // Try to find employee by user ID
      const employeeResult = await db.query(`
        SELECT id FROM market_employees
        WHERE user_id = $1 AND company_id = $2
        LIMIT 1
      `, [userId, companyId])

      if (employeeResult.rows.length > 0) {
        validatorId = employeeResult.rows[0].id
      }
    }

    // Upload receipt photo to S3 if provided (non-fatal)
    let photoPath: string | null = null
    if (photoBase64 && storageAdapter.isConfigured()) {
      try {
        const cleanBase64 = photoBase64.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(cleanBase64, 'base64')
        const timestamp = Date.now()
        const fileName = `visitor-documents/company-${log.companyid}/invoices/${visitorLogId}-${timestamp}.jpg`

        const uploadResult = await storageAdapter.upload(
          'company-private-documents',
          fileName,
          buffer,
          { contentType: 'image/jpeg', upsert: true }
        )

        if (uploadResult.success) {
          photoPath = fileName
          console.log('[Validate Document] Photo uploaded:', fileName)
        } else {
          console.warn('[Validate Document] Photo upload failed:', uploadResult.error)
        }
      } catch (err) {
        console.warn('[Validate Document] Photo upload error (non-fatal):', err)
      }
    }

    // Run migrations (adds columns and populates missing data)
    await runMigrations()

    // Create validation record (include companyid and createdat for stats queries)
    const result = await db.query(`
      INSERT INTO market_visitor_invoice_validations (
        companyid, visitorlogid, documenttype, documentid, documentnumber,
        totalamount, currency, validated, validatedat, validatedby, notes, photourl, createdat
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), $8, $9, $10, NOW())
      RETURNING *
    `, [
      log.companyid, // Use company from the visitor log
      visitorLogId,
      documentType,
      documentId || null,
      documentNumber || null,
      totalAmount || null,
      currency || 'CUP',
      validatorId || null,
      notes || null,
      photoPath
    ])

    const validation = result.rows[0]

    // Check if all pending documents are validated
    // Update log invoicesvalidated status
    let remainingPending = 0
    try {
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
      remainingPending = parseInt(pendingCount.rows[0]?.pending || '0')
    } catch (pendingErr: any) {
      // POS/wholesale tables may not exist - treat as no pending documents
      console.warn('[Validate Document] Pending check skipped (tables may not exist):', pendingErr.message)
      remainingPending = 0
    }

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
