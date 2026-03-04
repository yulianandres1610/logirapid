import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { createProductionPlansForQuote } from '@/lib/quote-production-helper'

/**
 * GET /api/public/quote-sign/[token]
 * Get quote data by signature token (public, no auth required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token requerido' }, { status: 400 })
    }

    // Ensure signature columns exist
    try {
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signature_token UUID`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signature_data TEXT`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signer_name VARCHAR(255)`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signer_ip VARCHAR(45)`)
    } catch {
      // ignore - columns may already exist
    }

    // Step 1: Find the quote by signature_token (minimal query)
    const quoteResult = await db.query(
      'SELECT * FROM market_quotes WHERE signature_token = $1',
      [token]
    )

    if (quoteResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada o enlace inválido'
      }, { status: 404 })
    }

    const q = quoteResult.rows[0]

    // Step 2: Get customer info separately
    let customerName = ''
    let customerCode = ''
    let customerTaxId: string | null = null
    let customerAddress: string | null = null
    let customerPhone: string | null = null
    try {
      const custResult = await db.query(
        'SELECT business_name, code, tax_id, address, phone FROM market_wholesale_customers WHERE id = $1',
        [q.customer_id]
      )
      if (custResult.rows.length > 0) {
        customerName = custResult.rows[0].business_name || ''
        customerCode = custResult.rows[0].code || ''
        customerTaxId = custResult.rows[0].tax_id || null
        customerAddress = custResult.rows[0].address || null
        customerPhone = custResult.rows[0].phone || null
      }
    } catch {
      // Try without tax_id/address/phone
      try {
        const custResult2 = await db.query(
          'SELECT business_name, code FROM market_wholesale_customers WHERE id = $1',
          [q.customer_id]
        )
        if (custResult2.rows.length > 0) {
          customerName = custResult2.rows[0].business_name || ''
          customerCode = custResult2.rows[0].code || ''
        }
      } catch {
        // ignore
      }
    }

    // Step 2b: Get sales rep info separately
    let salesRepName: string | null = null
    let salesRepEmail: string | null = null
    if (q.sales_rep_id) {
      try {
        const srResult = await db.query(
          "SELECT CONCAT(firstname, ' ', lastname) as name, email FROM users WHERE id = $1",
          [q.sales_rep_id]
        )
        if (srResult.rows.length > 0) {
          salesRepName = srResult.rows[0].name?.trim() || null
          salesRepEmail = srResult.rows[0].email || null
        }
      } catch { /* ignore */ }
    }

    // Step 3: Get company info separately
    let companyName = ''
    let companyLogo: string | null = null
    try {
      const compResult = await db.query(
        'SELECT name, logo_url FROM companies WHERE id = $1',
        [q.company_id]
      )
      if (compResult.rows.length > 0) {
        companyName = compResult.rows[0].name || ''
        companyLogo = compResult.rows[0].logo_url || null
      }
    } catch {
      // Try without logo_url
      try {
        const compResult2 = await db.query(
          'SELECT legalname as name FROM companies WHERE id = $1',
          [q.company_id]
        )
        if (compResult2.rows.length > 0) {
          companyName = compResult2.rows[0].name || ''
        }
      } catch {
        // ignore
      }
    }

    // Step 4: Get quote lines
    let lines: Array<{
      id: number
      productId: number
      productName: string
      productSku: string | null
      productImage: string | null
      quantity: number
      unitPrice: number
      originalPrice: number
      discountPercent: number
      discountAmount: number
      subtotal: number
      estimatedDelivery: string | null
    }> = []
    try {
      const linesResult = await db.query(`
        SELECT
          ql.id, ql.product_id, ql.product_name, ql.product_sku, ql.quantity,
          ql.unit_price, ql.original_price, ql.discount_percent,
          ql.discount_amount, ql.subtotal, ql.estimated_delivery,
          p.image_url as product_image
        FROM market_quote_lines ql
        LEFT JOIN market_products p ON p.id = ql.product_id
        WHERE ql.quote_id = $1
        ORDER BY ql.id
      `, [q.id])

      lines = linesResult.rows.map(line => ({
        id: line.id,
        productId: line.product_id,
        productName: line.product_name,
        productSku: line.product_sku || null,
        productImage: line.product_image || null,
        quantity: parseFloat(line.quantity) || 0,
        unitPrice: parseFloat(line.unit_price) || 0,
        originalPrice: parseFloat(line.original_price) || 0,
        discountPercent: parseFloat(line.discount_percent) || 0,
        discountAmount: parseFloat(line.discount_amount) || 0,
        subtotal: parseFloat(line.subtotal) || 0,
        estimatedDelivery: line.estimated_delivery || null
      }))
    } catch {
      // Try simpler query without JOIN
      try {
        const linesResult2 = await db.query(`
          SELECT id, product_id, product_name, product_sku, quantity, unit_price, subtotal
          FROM market_quote_lines
          WHERE quote_id = $1
          ORDER BY id
        `, [q.id])

        lines = linesResult2.rows.map(line => ({
          id: line.id,
          productId: line.product_id,
          productName: line.product_name,
          productSku: line.product_sku || null,
          productImage: null,
          quantity: parseFloat(line.quantity) || 0,
          unitPrice: parseFloat(line.unit_price) || 0,
          originalPrice: 0,
          discountPercent: 0,
          discountAmount: 0,
          subtotal: parseFloat(line.subtotal) || 0,
          estimatedDelivery: null
        }))
      } catch {
        // ignore - return empty lines
      }
    }

    // Auto-mark as "sent" when a draft quote link is opened
    if (q.status === 'draft') {
      try {
        await db.query(
          `UPDATE market_quotes SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [q.id]
        )
        q.status = 'sent'
      } catch {
        // sent_at column might not exist, try without it
        try {
          await db.query(
            `UPDATE market_quotes SET status = 'sent', updated_at = NOW() WHERE id = $1`,
            [q.id]
          )
          q.status = 'sent'
        } catch { /* ignore */ }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        quoteNumber: q.quote_number,
        status: q.status,
        subtotal: parseFloat(q.subtotal) || 0,
        discountPercent: parseFloat(q.discount_percent) || 0,
        discountAmount: parseFloat(q.discount_amount) || 0,
        totalAmount: parseFloat(q.total_amount) || 0,
        currency: q.currency,
        validUntil: q.valid_until,
        notes: q.notes,
        createdAt: q.created_at,
        signatureData: q.signature_data || null,
        signedAt: q.signed_at || null,
        signerName: q.signer_name || null,
        customer: {
          businessName: customerName,
          code: customerCode,
          taxId: customerTaxId,
          address: customerAddress,
          phone: customerPhone
        },
        company: {
          name: companyName,
          logoUrl: companyLogo
        },
        salesRep: salesRepName ? {
          name: salesRepName,
          email: salesRepEmail
        } : null,
        lines
      }
    })

  } catch (error) {
    console.error('[Public Quote Sign GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener cotización'
    }, { status: 500 })
  }
}

/**
 * POST /api/public/quote-sign/[token]
 * Sign a quote (public, no auth required)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { signatureData, signerName } = body

    if (!signatureData) {
      return NextResponse.json({
        success: false,
        error: 'La firma es requerida'
      }, { status: 400 })
    }

    if (!signerName || !signerName.trim()) {
      return NextResponse.json({
        success: false,
        error: 'El nombre del firmante es requerido'
      }, { status: 400 })
    }

    // Find quote by token
    let result
    try {
      result = await db.query(
        'SELECT id, status FROM market_quotes WHERE signature_token = $1',
        [token]
      )
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada o enlace inválido'
      }, { status: 404 })
    }

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada o enlace inválido'
      }, { status: 404 })
    }

    const quote = result.rows[0]

    // Check if already signed
    try {
      const sigCheck = await db.query(
        'SELECT signed_at FROM market_quotes WHERE id = $1',
        [quote.id]
      )
      if (sigCheck.rows[0]?.signed_at) {
        return NextResponse.json({
          success: false,
          error: 'Esta cotización ya fue firmada'
        }, { status: 400 })
      }
    } catch {
      // Column doesn't exist - not signed
    }

    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown'

    // Update quote with signature - use resilient approach for optional columns
    const newStatus = (quote.status === 'draft' || quote.status === 'sent') ? 'accepted' : quote.status

    // Core update (columns guaranteed to exist from GET migration)
    await db.query(`
      UPDATE market_quotes SET
        signature_data = $1,
        signed_at = NOW(),
        signer_name = $2,
        signer_ip = $3,
        status = $4
      WHERE id = $5
    `, [signatureData, signerName.trim(), ip, String(newStatus), quote.id])

    // Try updating accepted_at if column exists
    if (newStatus === 'accepted') {
      try {
        await db.query(`UPDATE market_quotes SET accepted_at = NOW() WHERE id = $1`, [quote.id])
      } catch { /* column may not exist */ }
    }

    // Try updating updated_at if column exists
    try {
      await db.query(`UPDATE market_quotes SET updated_at = NOW() WHERE id = $1`, [quote.id])
    } catch { /* column may not exist */ }

    // Auto-create production plans for items that have active formulas and insufficient stock
    if (newStatus === 'accepted') {
      try {
        const quoteData = await db.query(
          'SELECT company_id, warehouse_id, quote_number FROM market_quotes WHERE id = $1',
          [quote.id]
        )
        if (quoteData.rows.length > 0) {
          const q = quoteData.rows[0]
          let quoteLines: Array<{ productId: number; productName: string; quantity: number; estimatedDelivery: string | null }> = []
          try {
            const qlResult = await db.query(
              'SELECT product_id, product_name, quantity FROM market_quote_lines WHERE quote_id = $1',
              [quote.id]
            )
            quoteLines = qlResult.rows.map(r => ({
              productId: r.product_id,
              productName: r.product_name,
              quantity: parseFloat(r.quantity) || 0,
              estimatedDelivery: null
            }))
          } catch { /* ignore */ }

          if (quoteLines.length > 0) {
            await createProductionPlansForQuote(
              q.company_id,
              q.warehouse_id,
              q.quote_number,
              quote.id,
              quoteLines
            )
          }
        }
      } catch (planError) {
        console.error('[Public Quote Sign] Error creating production plans:', planError)
        // Don't fail the signature because of plan creation errors
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cotización firmada exitosamente'
    })

  } catch (error) {
    console.error('[Public Quote Sign POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al firmar cotización'
    }, { status: 500 })
  }
}
