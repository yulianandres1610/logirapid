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
 * GET /api/market/wholesale/invoices/[id]
 * Get a single invoice with all details
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
    const invoiceId = parseInt(id)

    const result = await db.query(`
      SELECT
        i.*,
        c.business_name as customer_name,
        c.code as customer_code,
        c.email as customer_email,
        c.phone as customer_phone,
        c.address as customer_address,
        c.city as customer_city,
        c.tax_id as customer_tax_id,
        w.name as warehouse_name,
        q.quote_number,
        pl.name as pricelist_name,
        u.email as created_by_email
      FROM market_invoices i
      JOIN market_wholesale_customers c ON c.id = i.customer_id
      LEFT JOIN market_warehouses w ON w.id = i.warehouse_id
      LEFT JOIN market_quotes q ON q.id = i.quote_id
      LEFT JOIN market_pricelists pl ON pl.id = i.pricelist_id
      LEFT JOIN users u ON u.id = i.created_by
      WHERE i.id = $1 AND i.company_id = $2
    `, [invoiceId, payload.companyId])

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    const row = result.rows[0]

    // Get invoice lines
    const linesResult = await db.query(`
      SELECT
        il.*,
        p.image_url as product_image
      FROM market_invoice_lines il
      LEFT JOIN market_products p ON p.id = il.product_id
      WHERE il.invoice_id = $1
      ORDER BY il.id
    `, [invoiceId])

    // Get deliveries
    const deliveriesResult = await db.query(`
      SELECT
        d.*,
        w.name as warehouse_name,
        u.email as created_by_email
      FROM market_invoice_deliveries d
      LEFT JOIN market_warehouses w ON w.id = d.warehouse_id
      LEFT JOIN users u ON u.id = d.created_by
      WHERE d.invoice_id = $1
      ORDER BY d.created_at DESC
    `, [invoiceId])

    // Get payments
    const paymentsResult = await db.query(`
      SELECT
        p.*,
        u.email as created_by_email
      FROM market_invoice_payments p
      LEFT JOIN users u ON u.id = p.created_by
      WHERE p.invoice_id = $1
      ORDER BY p.payment_date DESC
    `, [invoiceId])

    const invoice = {
      id: row.id,
      invoiceNumber: row.invoice_number,
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
      quoteId: row.quote_id,
      quoteNumber: row.quote_number,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      pricelistId: row.pricelist_id,
      pricelistName: row.pricelist_name,
      status: row.status,
      paymentStatus: row.payment_status,
      subtotal: parseFloat(row.subtotal) || 0,
      discountPercent: parseFloat(row.discount_percent) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      totalAmount: parseFloat(row.total_amount) || 0,
      amountPaid: parseFloat(row.amount_paid) || 0,
      amountDue: parseFloat(row.amount_due) || 0,
      currency: row.currency,
      dueDate: row.due_date,
      notes: row.notes,
      internalNotes: row.internal_notes,
      createdBy: row.created_by_email,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      confirmedAt: row.confirmed_at,
      deliveredAt: row.delivered_at,
      paidAt: row.paid_at,
      lines: linesResult.rows.map(line => ({
        id: line.id,
        productId: line.product_id,
        variantId: line.variant_id,
        productName: line.product_name,
        productSku: line.product_sku,
        productImage: line.product_image,
        quantity: parseFloat(line.quantity) || 0,
        quantityDelivered: parseFloat(line.quantity_delivered) || 0,
        unitPrice: parseFloat(line.unit_price) || 0,
        costPrice: parseFloat(line.cost_price) || 0,
        originalPrice: parseFloat(line.original_price) || 0,
        discountPercent: parseFloat(line.discount_percent) || 0,
        discountAmount: parseFloat(line.discount_amount) || 0,
        subtotal: parseFloat(line.subtotal) || 0,
        notes: line.notes
      })),
      deliveries: deliveriesResult.rows.map(d => ({
        id: d.id,
        deliveryNumber: d.delivery_number,
        warehouseId: d.warehouse_id,
        warehouseName: d.warehouse_name,
        status: d.status,
        deliveryDate: d.delivery_date,
        deliveryAddress: d.delivery_address,
        notes: d.notes,
        createdBy: d.created_by_email,
        createdAt: d.created_at,
        dispatchedAt: d.dispatched_at,
        deliveredAt: d.delivered_at
      })),
      payments: paymentsResult.rows.map(p => ({
        id: p.id,
        paymentNumber: p.payment_number,
        amount: parseFloat(p.amount) || 0,
        currency: p.currency,
        paymentMethod: p.payment_method,
        reference: p.reference,
        paymentDate: p.payment_date,
        notes: p.notes,
        createdBy: p.created_by_email,
        createdAt: p.created_at
      }))
    }

    return NextResponse.json({
      success: true,
      data: invoice
    })

  } catch (error) {
    console.error('[Wholesale Invoice GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener factura'
    }, { status: 500 })
  }
}

/**
 * PUT /api/market/wholesale/invoices/[id]
 * Update an invoice (only if in draft status)
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
    const invoiceId = parseInt(id)
    const body = await request.json()

    // Verify invoice exists and is in draft status
    const checkResult = await db.query(
      'SELECT id, status FROM market_invoices WHERE id = $1 AND company_id = $2',
      [invoiceId, payload.companyId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    if (checkResult.rows[0].status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden editar facturas en estado borrador'
      }, { status: 400 })
    }

    const {
      warehouseId,
      dueDate,
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
      const existingResult = await db.query(
        'SELECT subtotal FROM market_invoices WHERE id = $1',
        [invoiceId]
      )
      subtotal = parseFloat(existingResult.rows[0].subtotal) || 0
    }

    const discountAmount = discountPercent ? (subtotal * discountPercent / 100) : 0
    const totalAmount = subtotal - discountAmount

    await db.transaction(async (client) => {
      // Update invoice
      await client.query(`
        UPDATE market_invoices SET
          warehouse_id = COALESCE($1, warehouse_id),
          due_date = $2,
          discount_percent = COALESCE($3, discount_percent),
          discount_amount = $4,
          subtotal = $5,
          total_amount = $6,
          amount_due = $6,
          notes = $7,
          internal_notes = $8,
          updated_at = NOW()
        WHERE id = $9
      `, [
        warehouseId,
        dueDate || null,
        discountPercent,
        discountAmount,
        subtotal,
        totalAmount,
        notes || null,
        internalNotes || null,
        invoiceId
      ])

      // Update lines if provided
      if (lines && lines.length > 0) {
        // Delete existing lines
        await client.query('DELETE FROM market_invoice_lines WHERE invoice_id = $1', [invoiceId])

        // Insert new lines
        for (const line of lines) {
          const costResult = await client.query(`
            SELECT cost_price FROM market_products WHERE id = $1
          `, [line.productId])
          const costPrice = costResult.rows[0]?.cost_price || 0

          const lineDiscountAmount = line.discountPercent
            ? (line.quantity * line.unitPrice * line.discountPercent / 100)
            : (line.discountAmount || 0)
          const lineSubtotal = (line.quantity * line.unitPrice) - lineDiscountAmount

          await client.query(`
            INSERT INTO market_invoice_lines (
              invoice_id, product_id, variant_id, product_name, product_sku,
              quantity, unit_price, cost_price, original_price, discount_percent,
              discount_amount, subtotal, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          `, [
            invoiceId,
            line.productId,
            line.variantId || null,
            line.productName,
            line.productSku || null,
            line.quantity,
            line.unitPrice,
            costPrice,
            line.originalPrice || line.unitPrice,
            line.discountPercent || 0,
            lineDiscountAmount,
            lineSubtotal,
            line.notes || null
          ])
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Factura actualizada exitosamente'
    })

  } catch (error) {
    console.error('[Wholesale Invoice PUT] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al actualizar factura'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/market/wholesale/invoices/[id]
 * Cancel an invoice (soft delete - changes status to cancelled)
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
    const invoiceId = parseInt(id)

    // Verify invoice exists
    const checkResult = await db.query(
      'SELECT id, status, payment_status FROM market_invoices WHERE id = $1 AND company_id = $2',
      [invoiceId, payload.companyId]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    const invoice = checkResult.rows[0]

    if (invoice.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        error: 'La factura ya está cancelada'
      }, { status: 400 })
    }

    if (invoice.payment_status === 'paid') {
      return NextResponse.json({
        success: false,
        error: 'No se puede cancelar una factura ya pagada'
      }, { status: 400 })
    }

    // Check for deliveries
    const deliveriesResult = await db.query(`
      SELECT COUNT(*) as count FROM market_invoice_deliveries
      WHERE invoice_id = $1 AND status NOT IN ('pending', 'cancelled')
    `, [invoiceId])

    if (parseInt(deliveriesResult.rows[0].count) > 0) {
      return NextResponse.json({
        success: false,
        error: 'No se puede cancelar una factura con entregas en proceso'
      }, { status: 400 })
    }

    // Cancel invoice
    await db.query(`
      UPDATE market_invoices SET
        status = 'cancelled',
        updated_at = NOW()
      WHERE id = $1
    `, [invoiceId])

    return NextResponse.json({
      success: true,
      message: 'Factura cancelada exitosamente'
    })

  } catch (error) {
    console.error('[Wholesale Invoice DELETE] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al cancelar factura'
    }, { status: 500 })
  }
}
