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
 * POST /api/market/door-security/scan-document
 * Search for a POS order or wholesale invoice by scanned barcode/QR code
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    const body = await request.json()
    const { scannedCode, visitorLogId, kioskId, guardId } = body

    if (!scannedCode) {
      return NextResponse.json({
        success: false,
        error: 'scannedCode es requerido'
      }, { status: 400 })
    }

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

    const code = scannedCode.trim()

    // Determine where to search based on prefix
    const isPOS = code.toUpperCase().startsWith('POS-')
    const isInvoice = code.toUpperCase().startsWith('INV-') || code.toUpperCase().startsWith('FAC-')

    let document: {
      found: boolean
      documentType: string
      documentId: number
      documentNumber: string
      customerName: string | null
      totalAmount: number
      currency: string
      createdAt: string
      alreadyValidated: boolean
      validatedAt?: string
    } | null = null

    // Search POS orders
    if (isPOS || !isInvoice) {
      try {
        const posResult = await db.query(`
          SELECT
            o.id,
            o.order_number,
            o.customer_name,
            o.total_amount,
            o.currency,
            o.created_at,
            o.status
          FROM market_pos_orders o
          WHERE o.company_id = $1
            AND o.order_number = $2
            AND o.status IN ('paid', 'draft', 'completed')
          LIMIT 1
        `, [companyId, code])

        if (posResult.rows.length > 0) {
          const row = posResult.rows[0]
          document = {
            found: true,
            documentType: 'pos_order',
            documentId: row.id,
            documentNumber: row.order_number,
            customerName: row.customer_name,
            totalAmount: parseFloat(row.total_amount || '0'),
            currency: row.currency || 'USD',
            createdAt: row.created_at,
            alreadyValidated: false
          }
        }
      } catch (e) {
        console.log('[Scan Document] POS orders table not available:', e)
      }
    }

    // Search wholesale invoices if not found yet
    if (!document && (isInvoice || !isPOS)) {
      try {
        const invoiceResult = await db.query(`
          SELECT
            wi.id,
            wi.invoicenumber,
            wi.total,
            wi.currency,
            wi.createdat,
            wi.status,
            c.businessname as customername
          FROM market_wholesale_invoices wi
          LEFT JOIN market_customers c ON wi.customerid = c.id
          WHERE wi.companyid = $1
            AND wi.invoicenumber = $2
            AND wi.status IN ('pending', 'completed', 'paid')
          LIMIT 1
        `, [companyId, code])

        if (invoiceResult.rows.length > 0) {
          const row = invoiceResult.rows[0]
          document = {
            found: true,
            documentType: 'wholesale_invoice',
            documentId: row.id,
            documentNumber: row.invoicenumber,
            customerName: row.customername,
            totalAmount: parseFloat(row.total || '0'),
            currency: row.currency || 'CUP',
            createdAt: row.createdat,
            alreadyValidated: false
          }
        }
      } catch (e) {
        console.log('[Scan Document] Wholesale invoices table not available:', e)
      }
    }

    // Also try POS sales table (legacy) if still not found
    if (!document && (isPOS || !isInvoice)) {
      try {
        const salesResult = await db.query(`
          SELECT
            ps.id,
            ps.receiptnumber,
            ps.customername,
            ps.total,
            ps.createdat,
            ps.status
          FROM market_pos_sales ps
          WHERE ps.companyid = $1
            AND ps.receiptnumber = $2
            AND ps.status = 'completed'
          LIMIT 1
        `, [companyId, code])

        if (salesResult.rows.length > 0) {
          const row = salesResult.rows[0]
          document = {
            found: true,
            documentType: 'pos_receipt',
            documentId: row.id,
            documentNumber: row.receiptnumber,
            customerName: row.customername,
            totalAmount: parseFloat(row.total || '0'),
            currency: 'CUP',
            createdAt: row.createdat,
            alreadyValidated: false
          }
        }
      } catch (e) {
        console.log('[Scan Document] POS sales table not available:', e)
      }
    }

    if (!document) {
      return NextResponse.json({
        success: true,
        data: {
          found: false,
          scannedCode: code
        }
      })
    }

    // Check if already validated globally (any visitor log)
    try {
      const validationResult = await db.query(`
        SELECT id, validatedat
        FROM market_visitor_invoice_validations
        WHERE documenttype = $1
          AND (documentid = $2 OR documentnumber = $3)
          AND validated = true
        LIMIT 1
      `, [document.documentType, document.documentId, document.documentNumber])

      if (validationResult.rows.length > 0) {
        document.alreadyValidated = true
        document.validatedAt = validationResult.rows[0].validatedat
      }
    } catch (e) {
      console.log('[Scan Document] Validation table not available:', e)
    }

    console.log('[Scan Document] Found:', document.documentType, document.documentNumber, 'validated:', document.alreadyValidated)

    return NextResponse.json({
      success: true,
      data: document
    })

  } catch (error) {
    console.error('[Scan Document] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al buscar documento'
    }, { status: 500 })
  }
}
