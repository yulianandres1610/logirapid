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
 * GET /api/market/door-security/audit/invoices?date=2026-02-20
 * Audit report: invoices created vs validated at door exit
 * JWT auth required (admin/dashboard only)
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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const companyId = payload.companyId

    // 1. Total POS orders created that day
    let posCreated = 0
    let posValidated = 0
    let posUnvalidated: Array<{ id: number; orderNumber: string; customerName: string | null; total: number; currency: string; createdAt: string }> = []

    try {
      const posResult = await db.query(`
        SELECT
          o.id,
          o.order_number,
          o.customer_name,
          o.total_amount,
          o.currency,
          o.created_at
        FROM market_pos_orders o
        WHERE o.company_id = $1
          AND DATE(o.created_at) = $2
          AND o.status IN ('paid', 'draft', 'completed')
        ORDER BY o.created_at DESC
      `, [companyId, date])

      posCreated = posResult.rows.length

      // Check which ones are validated
      for (const order of posResult.rows) {
        const valResult = await db.query(`
          SELECT id FROM market_visitor_invoice_validations
          WHERE (documenttype = 'pos_order' OR documenttype = 'pos_receipt')
            AND (documentid = $1 OR documentnumber = $2)
            AND validated = true
          LIMIT 1
        `, [order.id, order.order_number])

        if (valResult.rows.length > 0) {
          posValidated++
        } else {
          posUnvalidated.push({
            id: order.id,
            orderNumber: order.order_number,
            customerName: order.customer_name,
            total: parseFloat(order.total_amount || '0'),
            currency: order.currency || 'USD',
            createdAt: order.created_at
          })
        }
      }
    } catch (e) {
      console.log('[Audit] POS orders table not available:', e)
    }

    // 2. Total wholesale invoices created that day
    let invoiceCreated = 0
    let invoiceValidated = 0
    let invoiceUnvalidated: Array<{ id: number; invoiceNumber: string; customerName: string | null; total: number; currency: string; createdAt: string }> = []

    try {
      const invoiceResult = await db.query(`
        SELECT
          wi.id,
          wi.invoicenumber,
          wi.total,
          wi.currency,
          wi.createdat,
          c.businessname as customername
        FROM market_wholesale_invoices wi
        LEFT JOIN market_customers c ON wi.customerid = c.id
        WHERE wi.companyid = $1
          AND DATE(wi.createdat) = $2
          AND wi.status IN ('pending', 'completed', 'paid')
        ORDER BY wi.createdat DESC
      `, [companyId, date])

      invoiceCreated = invoiceResult.rows.length

      for (const inv of invoiceResult.rows) {
        const valResult = await db.query(`
          SELECT id FROM market_visitor_invoice_validations
          WHERE documenttype = 'wholesale_invoice'
            AND (documentid = $1 OR documentnumber = $2)
            AND validated = true
          LIMIT 1
        `, [inv.id, inv.invoicenumber])

        if (valResult.rows.length > 0) {
          invoiceValidated++
        } else {
          invoiceUnvalidated.push({
            id: inv.id,
            invoiceNumber: inv.invoicenumber,
            customerName: inv.customername,
            total: parseFloat(inv.total || '0'),
            currency: inv.currency || 'CUP',
            createdAt: inv.createdat
          })
        }
      }
    } catch (e) {
      console.log('[Audit] Wholesale invoices table not available:', e)
    }

    // 3. Door exits stats
    let totalExits = 0
    let exitsWithValidation = 0
    let exitsWithoutInvoice = 0
    let skippedValidation = 0

    try {
      // Total exits today
      const exitsResult = await db.query(`
        SELECT
          vl.id,
          vl.invoicesvalidated,
          vl.haspendinginvoices,
          (SELECT COUNT(*) FROM market_visitor_invoice_validations v WHERE v.visitorlogid = vl.id) as validation_count
        FROM market_visitor_logs vl
        WHERE vl.companyid = $1
          AND DATE(vl.exittime) = $2
          AND vl.exittime IS NOT NULL
      `, [companyId, date])

      totalExits = exitsResult.rows.length

      for (const exit of exitsResult.rows) {
        const valCount = parseInt(exit.validation_count || '0')
        if (valCount > 0) {
          exitsWithValidation++
        } else if (exit.haspendinginvoices) {
          skippedValidation++
        } else {
          exitsWithoutInvoice++
        }
      }
    } catch (e) {
      console.log('[Audit] Visitor logs table not available:', e)
    }

    // Calculate validation rate
    const totalDocuments = posCreated + invoiceCreated
    const totalValidated = posValidated + invoiceValidated
    const validationRate = totalDocuments > 0
      ? Math.round((totalValidated / totalDocuments) * 100)
      : 100

    return NextResponse.json({
      success: true,
      data: {
        date,
        posOrders: {
          created: posCreated,
          validated: posValidated,
          unvalidated: posCreated - posValidated,
          details: posUnvalidated
        },
        wholesaleInvoices: {
          created: invoiceCreated,
          validated: invoiceValidated,
          unvalidated: invoiceCreated - invoiceValidated,
          details: invoiceUnvalidated
        },
        doorExits: {
          total: totalExits,
          withValidation: exitsWithValidation,
          withoutInvoice: exitsWithoutInvoice,
          skippedValidation
        },
        validationRate
      }
    })

  } catch (error) {
    console.error('[Audit Invoices] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener auditoria'
    }, { status: 500 })
  }
}
