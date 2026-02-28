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

    // First find the quote by signature_token
    // Use q.* to avoid failing on missing columns
    let result
    try {
      result = await db.query(`
        SELECT q.*,
          c.business_name as customer_name, c.code as customer_code,
          c.tax_id as customer_tax_id,
          comp.name as company_name
        FROM market_quotes q
        JOIN market_wholesale_customers c ON c.id = q.customer_id
        JOIN companies comp ON comp.id = q.company_id
        WHERE q.signature_token = $1
      `, [token])
    } catch (queryError) {
      // If signature_token column doesn't exist, try to create it
      console.error('[Public Quote Sign] Main query failed, trying to create columns:', queryError)
      try {
        await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signature_token UUID`)
        await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signature_data TEXT`)
        await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP`)
        await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signer_name VARCHAR(255)`)
        await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS signer_ip VARCHAR(45)`)
      } catch {
        // ignore
      }
      // Retry the query
      result = await db.query(`
        SELECT q.*,
          c.business_name as customer_name, c.code as customer_code,
          c.tax_id as customer_tax_id,
          comp.name as company_name
        FROM market_quotes q
        JOIN market_wholesale_customers c ON c.id = q.customer_id
        JOIN companies comp ON comp.id = q.company_id
        WHERE q.signature_token = $1
      `, [token])
    }

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada o enlace inválido'
      }, { status: 404 })
    }

    const row = result.rows[0]

    // Get company logo separately (column may not exist)
    let companyLogo: string | null = null
    try {
      const logoResult = await db.query(
        'SELECT logo_url FROM companies WHERE id = $1',
        [row.company_id]
      )
      companyLogo = logoResult.rows[0]?.logo_url || null
    } catch {
      // logo_url column doesn't exist - ignore
    }

    // Get signature data from q.* result (safe - undefined becomes null)
    const signatureData = row.signature_data || null
    const signedAt = row.signed_at || null
    const signerName = row.signer_name || null

    // Get quote lines
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
    `, [row.id])

    return NextResponse.json({
      success: true,
      data: {
        quoteNumber: row.quote_number,
        status: row.status,
        subtotal: parseFloat(row.subtotal) || 0,
        discountPercent: parseFloat(row.discount_percent) || 0,
        discountAmount: parseFloat(row.discount_amount) || 0,
        totalAmount: parseFloat(row.total_amount) || 0,
        currency: row.currency,
        validUntil: row.valid_until,
        notes: row.notes,
        createdAt: row.created_at,
        signatureData,
        signedAt,
        signerName,
        customer: {
          businessName: row.customer_name,
          code: row.customer_code,
          taxId: row.customer_tax_id
        },
        company: {
          name: row.company_name,
          logoUrl: companyLogo
        },
        lines: linesResult.rows.map(line => ({
          id: line.id,
          productName: line.product_name,
          productSku: line.product_sku,
          productImage: line.product_image,
          quantity: parseFloat(line.quantity) || 0,
          unitPrice: parseFloat(line.unit_price) || 0,
          originalPrice: parseFloat(line.original_price) || 0,
          discountPercent: parseFloat(line.discount_percent) || 0,
          discountAmount: parseFloat(line.discount_amount) || 0,
          subtotal: parseFloat(line.subtotal) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Public Quote Sign GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener cotización'
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
      // Column might not exist
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
      error: 'Error al firmar cotización'
    }, { status: 500 })
  }
}
