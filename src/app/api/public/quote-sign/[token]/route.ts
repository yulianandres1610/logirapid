import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

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
    try {
      const custResult = await db.query(
        'SELECT business_name, code, tax_id FROM market_wholesale_customers WHERE id = $1',
        [q.customer_id]
      )
      if (custResult.rows.length > 0) {
        customerName = custResult.rows[0].business_name || ''
        customerCode = custResult.rows[0].code || ''
        customerTaxId = custResult.rows[0].tax_id || null
      }
    } catch {
      // Try without tax_id
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
      productName: string
      productSku: string | null
      productImage: string | null
      quantity: number
      unitPrice: number
      originalPrice: number
      discountPercent: number
      discountAmount: number
      subtotal: number
    }> = []
    try {
      const linesResult = await db.query(`
        SELECT
          ql.id, ql.product_name, ql.product_sku, ql.quantity,
          ql.unit_price, ql.original_price, ql.discount_percent,
          ql.discount_amount, ql.subtotal,
          p.image_url as product_image
        FROM market_quote_lines ql
        LEFT JOIN market_products p ON p.id = ql.product_id
        WHERE ql.quote_id = $1
        ORDER BY ql.id
      `, [q.id])

      lines = linesResult.rows.map(line => ({
        id: line.id,
        productName: line.product_name,
        productSku: line.product_sku || null,
        productImage: line.product_image || null,
        quantity: parseFloat(line.quantity) || 0,
        unitPrice: parseFloat(line.unit_price) || 0,
        originalPrice: parseFloat(line.original_price) || 0,
        discountPercent: parseFloat(line.discount_percent) || 0,
        discountAmount: parseFloat(line.discount_amount) || 0,
        subtotal: parseFloat(line.subtotal) || 0
      }))
    } catch {
      // Try simpler query without JOIN
      try {
        const linesResult2 = await db.query(`
          SELECT id, product_name, product_sku, quantity, unit_price, subtotal
          FROM market_quote_lines
          WHERE quote_id = $1
          ORDER BY id
        `, [q.id])

        lines = linesResult2.rows.map(line => ({
          id: line.id,
          productName: line.product_name,
          productSku: line.product_sku || null,
          productImage: null,
          quantity: parseFloat(line.quantity) || 0,
          unitPrice: parseFloat(line.unit_price) || 0,
          originalPrice: 0,
          discountPercent: 0,
          discountAmount: 0,
          subtotal: parseFloat(line.subtotal) || 0
        }))
      } catch {
        // ignore - return empty lines
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
          taxId: customerTaxId
        },
        company: {
          name: companyName,
          logoUrl: companyLogo
        },
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

    // Update quote with signature
    const newStatus = quote.status === 'sent' ? 'accepted' : quote.status

    await db.query(`
      UPDATE market_quotes SET
        signature_data = $1,
        signed_at = NOW(),
        signer_name = $2,
        signer_ip = $3,
        status = $4,
        accepted_at = CASE WHEN $4 = 'accepted' THEN NOW() ELSE accepted_at END,
        updated_at = NOW()
      WHERE id = $5
    `, [signatureData, signerName.trim(), ip, newStatus, quote.id])

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
