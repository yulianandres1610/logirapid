import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'
import { createProductionPlansForQuote } from '@/lib/quote-production-helper'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * POST /api/market/wholesale/quotes/[id]/convert
 * Convert a quote to an invoice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const quoteId = parseInt(id)
    const body = await request.json()
    const { dueDate } = body

    // Verify quote exists and is in accepted status (or sent for quick conversion)
    const checkResult = await db.query(`
      SELECT q.*, c.credit_days
      FROM market_quotes q
      JOIN market_wholesale_customers c ON c.id = q.customer_id
      WHERE q.id = $1 AND q.company_id = $2
    `, [quoteId, payload.companyId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada'
      }, { status: 404 })
    }

    const quote = checkResult.rows[0]

    if (!['sent', 'accepted'].includes(quote.status)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden convertir cotizaciones enviadas o aceptadas'
      }, { status: 400 })
    }

    if (quote.converted_to_invoice_id) {
      return NextResponse.json({
        success: false,
        error: 'Esta cotización ya fue convertida a factura'
      }, { status: 400 })
    }

    // Get quote lines
    const linesResult = await db.query(`
      SELECT * FROM market_quote_lines WHERE quote_id = $1
    `, [quoteId])

    // Generate invoice number: FAC-2025-0001
    const year = new Date().getFullYear()
    const numberResult = await db.query(`
      SELECT invoice_number FROM market_invoices
      WHERE company_id = $1 AND invoice_number LIKE $2
      ORDER BY id DESC
      LIMIT 1
    `, [payload.companyId, `FAC-${year}-%`])

    let nextNumber = 1
    if (numberResult.rows.length > 0) {
      const lastNumber = numberResult.rows[0].invoice_number
      const match = lastNumber.match(/FAC-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const invoiceNumber = `FAC-${year}-${String(nextNumber).padStart(4, '0')}`

    // Calculate due date based on credit days if not specified
    let effectiveDueDate = dueDate
    if (!effectiveDueDate && quote.credit_days > 0) {
      const date = new Date()
      date.setDate(date.getDate() + quote.credit_days)
      effectiveDueDate = date.toISOString().split('T')[0]
    }

    const result = await db.transaction(async (client) => {
      // Create invoice
      const invoiceResult = await client.query(`
        INSERT INTO market_invoices (
          company_id, invoice_number, customer_id, quote_id, pricelist_id, warehouse_id,
          status, payment_status, subtotal, discount_percent, discount_amount, total_amount,
          amount_due, currency, due_date, notes, internal_notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id
      `, [
        payload.companyId,
        invoiceNumber,
        quote.customer_id,
        quoteId,
        quote.pricelist_id,
        quote.warehouse_id,
        'draft',
        'pending',
        quote.subtotal,
        quote.discount_percent,
        quote.discount_amount,
        quote.total_amount,
        quote.total_amount, // amount_due = total at creation
        quote.currency,
        effectiveDueDate || null,
        quote.notes,
        quote.internal_notes,
        payload.userId
      ])

      const invoiceId = invoiceResult.rows[0].id

      // Copy quote lines to invoice lines
      for (const line of linesResult.rows) {
        // Get current cost price for the product
        const costResult = await client.query(`
          SELECT cost_price FROM market_products WHERE id = $1
        `, [line.product_id])
        const costPrice = costResult.rows[0]?.cost_price || 0

        await client.query(`
          INSERT INTO market_invoice_lines (
            invoice_id, product_id, variant_id, product_name, product_sku,
            quantity, unit_price, cost_price, original_price, discount_percent,
            discount_amount, subtotal, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          invoiceId,
          line.product_id,
          line.variant_id,
          line.product_name,
          line.product_sku,
          line.quantity,
          line.unit_price,
          costPrice,
          line.original_price,
          line.discount_percent,
          line.discount_amount,
          line.subtotal,
          line.notes
        ])
      }

      // Update quote status to converted
      await client.query(`
        UPDATE market_quotes SET
          status = 'converted',
          converted_to_invoice_id = $1,
          accepted_at = COALESCE(accepted_at, NOW()),
          updated_at = NOW()
        WHERE id = $2
      `, [invoiceId, quoteId])

      return { invoiceId, invoiceNumber }
    })

    // Auto-create production plans if not already created
    try {
      // Check if plans already exist for this quote
      const existingPlans = await db.query(
        "SELECT id FROM market_production_plans WHERE notes LIKE $1 LIMIT 1",
        [`%${quote.quote_number}%`]
      )
      if (existingPlans.rows.length === 0) {
        // Get lines with estimated_delivery
        let quoteLines: Array<{ productId: number; productName: string; quantity: number; estimatedDelivery: string | null }> = []
        try {
          const qlResult = await db.query(
            'SELECT product_id, product_name, quantity, estimated_delivery FROM market_quote_lines WHERE quote_id = $1',
            [quoteId]
          )
          quoteLines = qlResult.rows.map(r => ({
            productId: r.product_id,
            productName: r.product_name,
            quantity: parseFloat(r.quantity) || 0,
            estimatedDelivery: r.estimated_delivery || null
          }))
        } catch { /* estimated_delivery column might not exist */ }

        if (quoteLines.some(l => l.estimatedDelivery === '1-3d')) {
          await createProductionPlansForQuote(
            payload.companyId,
            quote.warehouse_id,
            quote.quote_number,
            quoteId,
            quoteLines
          )
        }
      }
    } catch (planError) {
      console.error('[Wholesale Quote Convert] Error creating production plans:', planError)
      // Don't fail the conversion because of plan creation errors
    }

    return NextResponse.json({
      success: true,
      message: `Cotización convertida a factura ${result.invoiceNumber}`,
      data: {
        invoiceId: result.invoiceId,
        invoiceNumber: result.invoiceNumber
      }
    })

  } catch (error) {
    console.error('[Wholesale Quote Convert] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al convertir cotización'
    }, { status: 500 })
  }
}
