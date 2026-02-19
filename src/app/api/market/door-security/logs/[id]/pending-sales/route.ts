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
 * GET /api/market/door-security/logs/[id]/pending-sales
 * Get pending sales (POS receipts and wholesale invoices) for a visitor log
 * These are sales made today by customers matching the visitor
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    // Get query params for kiosk authentication
    const { searchParams } = new URL(request.url)
    const kioskId = searchParams.get('kioskId')
    const guardId = searchParams.get('guardId')

    let companyId: number | null = null
    let isAuthenticated = false

    // Try JWT authentication first
    if (authToken) {
      try {
        const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
        const payload = jwt.verify(authToken, secret) as JWTPayload
        companyId = payload.companyId
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
          'SELECT id FROM market_door_guards WHERE id = $1 AND isactive = true',
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

    // Get the visitor log
    const logResult = await db.query(`
      SELECT
        vl.id,
        vl.companyid,
        vl.visitorid,
        vl.entrytime,
        v.idnumber,
        v.fullname
      FROM market_visitor_logs vl
      JOIN market_visitors v ON vl.visitorid = v.id
      WHERE vl.id = $1
    `, [id])

    if (logResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Registro no encontrado'
      }, { status: 404 })
    }

    const log = logResult.rows[0]

    // Check access
    if (log.companyid !== companyId) {
      return NextResponse.json({
        success: false,
        error: 'No tiene acceso a este registro'
      }, { status: 403 })
    }

    // Get already validated documents for this log
    const validatedResult = await db.query(`
      SELECT documenttype, documentid, documentnumber
      FROM market_visitor_invoice_validations
      WHERE visitorlogid = $1
    `, [id])

    const validatedDocs = new Set(
      validatedResult.rows.map(r => `${r.documenttype}-${r.documentid || r.documentnumber}`)
    )

    // Find POS receipts for today matching visitor
    // Look for receipts where customer name or ID matches
    const posResult = await db.query(`
      SELECT
        ps.id,
        ps.sessionid,
        ps.receiptnumber,
        ps.items,
        ps.subtotal,
        ps.tax,
        ps.total,
        ps.paymentmethod,
        ps.customername,
        ps.createdat,
        pss.terminalid
      FROM market_pos_sales ps
      JOIN market_pos_sessions pss ON ps.sessionid = pss.id
      WHERE ps.companyid = $1
        AND DATE(ps.createdat) = DATE($2)
        AND ps.status = 'completed'
        AND (
          LOWER(ps.customername) ILIKE LOWER($3)
          OR ps.customername ILIKE $4
        )
      ORDER BY ps.createdat DESC
    `, [
      log.companyid,
      log.entrytime,
      `%${log.fullname.split(' ')[0]}%`, // Match first name
      `%${log.idnumber}%`
    ])

    // Find wholesale invoices for today matching visitor
    const wholesaleResult = await db.query(`
      SELECT
        wi.id,
        wi.invoicenumber,
        wi.customerid,
        wi.items,
        wi.subtotal,
        wi.tax,
        wi.total,
        wi.currency,
        wi.paymentmethod,
        wi.status,
        wi.createdat,
        c.businessname as customername,
        c.identificationnumber as customeridnumber
      FROM market_wholesale_invoices wi
      LEFT JOIN market_customers c ON wi.customerid = c.id
      WHERE wi.companyid = $1
        AND DATE(wi.createdat) = DATE($2)
        AND wi.status IN ('pending', 'completed', 'paid')
        AND (
          LOWER(c.businessname) ILIKE LOWER($3)
          OR c.identificationnumber ILIKE $4
        )
      ORDER BY wi.createdat DESC
    `, [
      log.companyid,
      log.entrytime,
      `%${log.fullname.split(' ')[0]}%`,
      `%${log.idnumber}%`
    ])

    // Format POS receipts
    const posReceipts = posResult.rows.map(r => {
      const docKey = `pos_receipt-${r.id}`
      return {
        type: 'pos_receipt',
        id: r.id,
        documentNumber: r.receiptnumber,
        customerName: r.customername,
        items: r.items,
        subtotal: parseFloat(r.subtotal || '0'),
        tax: parseFloat(r.tax || '0'),
        total: parseFloat(r.total || '0'),
        currency: 'CUP',
        paymentMethod: r.paymentmethod,
        terminalId: r.terminalid,
        createdAt: r.createdat,
        alreadyValidated: validatedDocs.has(docKey)
      }
    })

    // Format wholesale invoices
    const wholesaleInvoices = wholesaleResult.rows.map(r => {
      const docKey = `wholesale_invoice-${r.id}`
      return {
        type: 'wholesale_invoice',
        id: r.id,
        documentNumber: r.invoicenumber,
        customerName: r.customername,
        customerIdNumber: r.customeridnumber,
        items: r.items,
        subtotal: parseFloat(r.subtotal || '0'),
        tax: parseFloat(r.tax || '0'),
        total: parseFloat(r.total || '0'),
        currency: r.currency || 'CUP',
        paymentMethod: r.paymentmethod,
        status: r.status,
        createdAt: r.createdat,
        alreadyValidated: validatedDocs.has(docKey)
      }
    })

    // Filter out already validated
    const pendingPos = posReceipts.filter(r => !r.alreadyValidated)
    const pendingWholesale = wholesaleInvoices.filter(r => !r.alreadyValidated)

    const hasPending = pendingPos.length > 0 || pendingWholesale.length > 0

    // Update log if has pending invoices
    if (hasPending) {
      await db.query(`
        UPDATE market_visitor_logs
        SET haspendinginvoices = true
        WHERE id = $1
      `, [id])
    }

    return NextResponse.json({
      success: true,
      data: {
        visitorName: log.fullname,
        visitorIdNumber: log.idnumber,
        hasPendingSales: hasPending,
        pendingSales: {
          posReceipts: pendingPos,
          wholesaleInvoices: pendingWholesale
        },
        validatedSales: {
          posReceipts: posReceipts.filter(r => r.alreadyValidated),
          wholesaleInvoices: wholesaleInvoices.filter(r => r.alreadyValidated)
        },
        summary: {
          totalPendingReceipts: pendingPos.length,
          totalPendingInvoices: pendingWholesale.length,
          totalPendingAmount: [
            ...pendingPos.map(r => r.total),
            ...pendingWholesale.map(r => r.total)
          ].reduce((a, b) => a + b, 0)
        }
      }
    })

  } catch (error) {
    console.error('[Pending Sales GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener ventas pendientes'
    }, { status: 500 })
  }
}
