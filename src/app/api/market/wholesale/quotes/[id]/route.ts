import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

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
 * GET /api/market/wholesale/quotes/[id]
 * Get a single quote with all details
 */
export async function GET(
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

    // Ensure columns and decimal precision
    try {
      await db.query('ALTER TABLE market_quote_lines ADD COLUMN IF NOT EXISTS estimated_delivery VARCHAR(20)')
      await db.query(`ALTER TABLE market_quote_lines ALTER COLUMN unit_price TYPE DECIMAL(12,3)`)
      await db.query(`ALTER TABLE market_quote_lines ALTER COLUMN original_price TYPE DECIMAL(12,3)`)
      await db.query(`ALTER TABLE market_quote_lines ALTER COLUMN subtotal TYPE DECIMAL(12,3)`)
    } catch { /* already migrated */ }

    const result = await db.query(`
      SELECT
        q.*,
        c.business_name as customer_name,
        c.code as customer_code,
        c.email as customer_email,
        c.phone as customer_phone,
        c.address as customer_address,
        c.city as customer_city,
        c.tax_id as customer_tax_id,
        w.name as warehouse_name,
        pl.name as pricelist_name,
        u.email as created_by_email,
        CONCAT(sr.firstname, ' ', sr.lastname) as sales_rep_name,
        sr.email as sales_rep_email
      FROM market_quotes q
      JOIN market_wholesale_customers c ON c.id = q.customer_id
      LEFT JOIN market_warehouses w ON w.id = q.warehouse_id
      LEFT JOIN market_pricelists pl ON pl.id = q.pricelist_id
      LEFT JOIN users u ON u.id = q.created_by
      LEFT JOIN users sr ON sr.id = q.sales_rep_id
      WHERE q.id = $1 AND q.company_id = $2
    `, [quoteId, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada'
      }, { status: 404 })
    }

    const row = result.rows[0]

    // Get quote lines
    const linesResult = await db.query(`
      SELECT
        ql.*,
        p.image_url as product_image
      FROM market_quote_lines ql
      LEFT JOIN market_products p ON p.id = ql.product_id
      WHERE ql.quote_id = $1
      ORDER BY ql.id
    `, [quoteId])

    const quote = {
      id: row.id,
      quoteNumber: row.quote_number,
      customer: {
        id: row.customer_id,
        code: row.customer_code,
        businessName: row.customer_name,
        email: row.customer_email,
        phone: row.customer_phone,
        address: row.customer_address,
        city: row.customer_city,
        taxId: row.customer_tax_id
      },
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      pricelistId: row.pricelist_id,
      pricelistName: row.pricelist_name,
      status: row.status,
      subtotal: parseFloat(row.subtotal) || 0,
      discountPercent: parseFloat(row.discount_percent) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      totalAmount: parseFloat(row.total_amount) || 0,
      includeTax: row.include_tax !== false,
      currency: row.currency,
      validUntil: row.valid_until,
      notes: row.notes,
      internalNotes: row.internal_notes,
      convertedToInvoiceId: row.converted_to_invoice_id,
      salesRepId: row.sales_rep_id || null,
      salesRepName: row.sales_rep_name || null,
      salesRepEmail: row.sales_rep_email || null,
      createdBy: row.created_by_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sentAt: row.sent_at,
      acceptedAt: row.accepted_at,
      signatureToken: row.signature_token || null,
      signatureData: row.signature_data || null,
      signedAt: row.signed_at || null,
      signerName: row.signer_name || null,
      cancellationReason: row.cancellation_reason || null,
      cancelledAt: row.cancelled_at || null,
      lines: linesResult.rows.map(line => ({
        id: line.id,
        productId: line.product_id,
        variantId: line.variant_id,
        productName: line.product_name,
        productSku: line.product_sku,
        productImage: line.product_image,
        quantity: parseFloat(line.quantity) || 0,
        unitPrice: parseFloat(line.unit_price) || 0,
        originalPrice: parseFloat(line.original_price) || 0,
        discountPercent: parseFloat(line.discount_percent) || 0,
        discountAmount: parseFloat(line.discount_amount) || 0,
        subtotal: parseFloat(line.subtotal) || 0,
        notes: line.notes,
        estimatedDelivery: line.estimated_delivery || null
      }))
    }

    return NextResponse.json({
      success: true,
      data: quote
    })

  } catch (error) {
    console.error('[Wholesale Quote GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener cotización'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/wholesale/quotes/[id]
 * Update a quote (only if in draft status)
 */
export async function PUT(
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

    // Verify quote exists and is in draft status
    const checkResult = await db.query(
      'SELECT id, status FROM market_quotes WHERE id = $1 AND company_id = $2',
      [quoteId, payload.companyId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada'
      }, { status: 404 })
    }

    if (checkResult.rows[0].status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden editar cotizaciones en estado borrador'
      }, { status: 400 })
    }

    const {
      warehouseId,
      pricelistId,
      validUntil,
      discountPercent,
      notes,
      internalNotes,
      lines
    } = body

    // Calculate totals if lines provided
    let subtotal = 0
    if (lines && lines.length > 0) {
      for (const line of lines) {
        const lineSubtotal = (line.quantity * line.unitPrice) - (line.discountAmount || 0)
        subtotal += lineSubtotal
      }
    } else {
      // Get existing subtotal
      const existingResult = await db.query(
        'SELECT subtotal FROM market_quotes WHERE id = $1',
        [quoteId]
      )
      subtotal = parseFloat(existingResult.rows[0].subtotal) || 0
    }

    const discountAmount = discountPercent ? (subtotal * discountPercent / 100) : 0
    const totalAmount = subtotal - discountAmount

    await db.transaction(async (client) => {
      // Update quote
      await client.query(`
        UPDATE market_quotes SET
          warehouse_id = COALESCE($1, warehouse_id),
          pricelist_id = COALESCE($2, pricelist_id),
          valid_until = $3,
          discount_percent = COALESCE($4, discount_percent),
          discount_amount = $5,
          subtotal = $6,
          total_amount = $7,
          notes = $8,
          internal_notes = $9,
          updated_at = NOW()
        WHERE id = $10
      `, [
        warehouseId,
        pricelistId,
        validUntil || null,
        discountPercent,
        discountAmount,
        subtotal,
        totalAmount,
        notes || null,
        internalNotes || null,
        quoteId
      ])

      // Update lines if provided
      if (lines && lines.length > 0) {
        // Delete existing lines
        await client.query('DELETE FROM market_quote_lines WHERE quote_id = $1', [quoteId])

        // Insert new lines
        for (const line of lines) {
          const lineDiscountAmount = line.discountPercent
            ? (line.quantity * line.unitPrice * line.discountPercent / 100)
            : (line.discountAmount || 0)
          const lineSubtotal = (line.quantity * line.unitPrice) - lineDiscountAmount

          await client.query(`
            INSERT INTO market_quote_lines (
              quote_id, product_id, variant_id, product_name, product_sku,
              quantity, unit_price, original_price, discount_percent, discount_amount, subtotal, notes,
              estimated_delivery
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            quoteId,
            line.productId,
            line.variantId || null,
            line.productName,
            line.productSku || null,
            line.quantity,
            line.unitPrice,
            line.originalPrice || line.unitPrice,
            line.discountPercent || 0,
            lineDiscountAmount,
            lineSubtotal,
            line.notes || null,
            line.estimatedDelivery || null
          ])
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Cotización actualizada exitosamente'
    })

  } catch (error) {
    console.error('[Wholesale Quote PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar cotización'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/wholesale/quotes/[id]
 * Cancel a quote (sets status to 'cancelled') or permanently delete with ?force=true
 * Supports cancelling from: draft, sent, accepted
 * Force delete removes the quote permanently (any status except converted)
 */
export async function DELETE(
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
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Verify quote exists
    const checkResult = await db.query(
      'SELECT id, status, quote_number, converted_to_invoice_id FROM market_quotes WHERE id = $1 AND company_id = $2',
      [quoteId, payload.companyId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cotización no encontrada'
      }, { status: 404 })
    }

    const quote = checkResult.rows[0]

    // Cannot cancel/delete converted quotes
    if (quote.status === 'converted' || quote.converted_to_invoice_id) {
      return NextResponse.json({
        success: false,
        error: 'No se puede cancelar una cotización que ya fue convertida a factura'
      }, { status: 400 })
    }

    // Read cancellation reason from body
    let cancellationReason: string | null = null
    try {
      const body = await request.json()
      cancellationReason = body.cancellationReason || null
    } catch { /* no body or invalid JSON */ }

    // Ensure cancellation columns exist
    try {
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS cancelled_by INTEGER`)
      await db.query(`ALTER TABLE market_quotes ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`)
    } catch { /* columns may already exist */ }

    // Force delete - permanently remove (only draft or cancelled)
    if (force) {
      if (!['draft', 'cancelled'].includes(quote.status)) {
        return NextResponse.json({
          success: false,
          error: 'Solo se pueden eliminar permanentemente cotizaciones en estado borrador o cancelada'
        }, { status: 400 })
      }

      await db.query('DELETE FROM market_quote_lines WHERE quote_id = $1', [quoteId])
      await db.query('DELETE FROM market_quotes WHERE id = $1', [quoteId])

      return NextResponse.json({
        success: true,
        message: `Cotización ${quote.quote_number} eliminada permanentemente`
      })
    }

    // Normal cancellation
    if (!['draft', 'sent', 'accepted'].includes(quote.status)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden cancelar cotizaciones en estado borrador, enviada o aceptada'
      }, { status: 400 })
    }

    await db.query(`
      UPDATE market_quotes
      SET status = 'cancelled', cancellation_reason = $2, cancelled_by = $3, cancelled_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [quoteId, cancellationReason, payload.userId])

    return NextResponse.json({
      success: true,
      message: `Cotización ${quote.quote_number} cancelada exitosamente`
    })

  } catch (error) {
    console.error('[Wholesale Quote DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al procesar cotización'
    }, { status: 500 })
  }
}
