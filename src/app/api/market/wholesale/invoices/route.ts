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
 * GET /api/market/wholesale/invoices
 * List invoices for the company
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const paymentStatus = searchParams.get('paymentStatus') || ''
    const customerId = searchParams.get('customerId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build WHERE clause
    let whereClause = 'WHERE i.company_id = $1'
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (status && status !== 'all') {
      whereClause += ` AND i.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }

    if (paymentStatus && paymentStatus !== 'all') {
      whereClause += ` AND i.payment_status = $${paramIndex}`
      params.push(paymentStatus)
      paramIndex++
    }

    if (search) {
      whereClause += ` AND (i.invoice_number ILIKE $${paramIndex} OR c.business_name ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (customerId) {
      whereClause += ` AND i.customer_id = $${paramIndex}`
      params.push(parseInt(customerId))
      paramIndex++
    }

    // Count total
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM market_invoices i
      JOIN market_wholesale_customers c ON c.id = i.customer_id
      ${whereClause}
    `, params)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get invoices
    const query = `
      SELECT
        i.*,
        c.business_name as customer_name,
        c.code as customer_code,
        w.name as warehouse_name,
        q.quote_number,
        u.email as created_by_email,
        (SELECT COUNT(*) FROM market_invoice_lines il WHERE il.invoice_id = i.id) as lines_count,
        (SELECT COUNT(*) FROM market_invoice_deliveries d WHERE d.invoice_id = i.id) as deliveries_count
      FROM market_invoices i
      JOIN market_wholesale_customers c ON c.id = i.customer_id
      LEFT JOIN market_warehouses w ON w.id = i.warehouse_id
      LEFT JOIN market_quotes q ON q.id = i.quote_id
      LEFT JOIN users u ON u.id = i.created_by
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const result = await db.query(query, params)

    const invoices = result.rows.map(row => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerCode: row.customer_code,
      quoteId: row.quote_id,
      quoteNumber: row.quote_number,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
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
      linesCount: parseInt(row.lines_count) || 0,
      deliveriesCount: parseInt(row.deliveries_count) || 0,
      createdBy: row.created_by_email,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
      deliveredAt: row.delivered_at,
      paidAt: row.paid_at
    }))

    // Calculate stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE payment_status = 'pending') as pending_payment,
        COUNT(*) FILTER (WHERE payment_status = 'overdue') as overdue,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) as total_sales,
        COALESCE(SUM(CASE WHEN payment_status IN ('pending', 'partial', 'overdue') THEN amount_due ELSE 0 END), 0) as total_pending
      FROM market_invoices
      WHERE company_id = $1
    `, [payload.companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        invoices,
        stats: {
          total: parseInt(stats.total) || 0,
          draft: parseInt(stats.draft) || 0,
          confirmed: parseInt(stats.confirmed) || 0,
          delivered: parseInt(stats.delivered) || 0,
          pendingPayment: parseInt(stats.pending_payment) || 0,
          overdue: parseInt(stats.overdue) || 0,
          totalSales: parseFloat(stats.total_sales) || 0,
          totalPending: parseFloat(stats.total_pending) || 0
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('[Wholesale Invoices GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener facturas'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/wholesale/invoices
 * Create a new invoice (direct, without quote)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Ensure downpayment columns exist (inline migration)
    await db.query(`ALTER TABLE market_invoices ADD COLUMN IF NOT EXISTS downpayment_type VARCHAR(20)`)
    await db.query(`ALTER TABLE market_invoices ADD COLUMN IF NOT EXISTS downpayment_value DECIMAL(12,2)`)
    await db.query(`ALTER TABLE market_invoices ADD COLUMN IF NOT EXISTS downpayment_amount DECIMAL(12,2)`)
    await db.query(`ALTER TABLE market_invoices ADD COLUMN IF NOT EXISTS wholesale_exchange_rate DECIMAL(10,2)`)

    // Ensure invoice_lines columns exist (inline migration)
    await db.query(`ALTER TABLE market_invoice_lines ADD COLUMN IF NOT EXISTS warehouse_quantities JSONB DEFAULT '{}'`)
    await db.query(`ALTER TABLE market_invoice_lines ADD COLUMN IF NOT EXISTS original_price DECIMAL(12,2)`)
    await db.query(`ALTER TABLE market_invoice_lines ADD COLUMN IF NOT EXISTS cost_price DECIMAL(12,2)`)
    await db.query(`ALTER TABLE market_invoice_lines ADD COLUMN IF NOT EXISTS variant_id INTEGER`)
    await db.query(`ALTER TABLE market_invoice_lines ADD COLUMN IF NOT EXISTS product_sku VARCHAR(100)`)
    await db.query(`ALTER TABLE market_invoice_lines ADD COLUMN IF NOT EXISTS quantity_delivered DECIMAL(12,2) DEFAULT 0`)

    const body = await request.json()
    const {
      customerId,
      warehouseId,
      pricelistId,
      dueDate,
      discountPercent,
      notes,
      internalNotes,
      lines,
      payment, // Optional payment data for immediate payment
      // New downpayment fields
      downpaymentType, // 'percentage' | 'fixed_amount' | null
      downpaymentValue, // number (percentage or amount)
      wholesaleExchangeRate // Store the exchange rate used for this invoice
    } = body

    if (!customerId) {
      return NextResponse.json({
        success: false,
        error: 'El cliente es requerido'
      }, { status: 400 })
    }

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe agregar al menos un producto'
      }, { status: 400 })
    }

    // Verify customer belongs to company
    const customerResult = await db.query(
      'SELECT id, pricelist_id, credit_days FROM market_wholesale_customers WHERE id = $1 AND company_id = $2',
      [customerId, payload.companyId]
    )

    if (customerResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cliente no encontrado'
      }, { status: 404 })
    }

    const customer = customerResult.rows[0]
    const effectivePricelistId = pricelistId || customer.pricelist_id

    // Calculate due date based on credit days if not specified
    let effectiveDueDate = dueDate
    if (!effectiveDueDate && customer.credit_days > 0) {
      const date = new Date()
      date.setDate(date.getDate() + customer.credit_days)
      effectiveDueDate = date.toISOString().split('T')[0]
    }

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

    // Calculate totals
    let subtotal = 0
    for (const line of lines) {
      const lineSubtotal = (line.quantity * line.unitPrice) - (line.discountAmount || 0)
      subtotal += lineSubtotal
    }

    const discountAmount = discountPercent ? (subtotal * discountPercent / 100) : 0
    const totalAmount = subtotal - discountAmount

    // Calculate downpayment amount if specified
    let downpaymentAmount = 0
    if (downpaymentType && downpaymentValue) {
      if (downpaymentType === 'percentage') {
        downpaymentAmount = (totalAmount * downpaymentValue) / 100
      } else if (downpaymentType === 'fixed_amount') {
        downpaymentAmount = Math.min(downpaymentValue, totalAmount)
      }
    }

    // Determine initial status based on payment
    const hasImmediatePayment = payment && payment.amount > 0
    const hasDownpayment = downpaymentAmount > 0 && hasImmediatePayment

    // Status logic:
    // - Immediate full payment: confirmed + paid
    // - With downpayment paid: confirmed + partial
    // - Credit (no immediate payment): draft + pending
    const initialStatus = hasImmediatePayment ? 'confirmed' : 'draft'
    const initialPaymentStatus = hasImmediatePayment
      ? (hasDownpayment && payment.amount < totalAmount ? 'partial' : 'paid')
      : 'pending'
    const paidAmount = hasImmediatePayment ? (hasDownpayment ? downpaymentAmount : totalAmount) : 0
    const initialAmountDue = totalAmount - paidAmount
    const initialAmountPaid = paidAmount

    // Create invoice using transaction
    const result = await db.transaction(async (client) => {
      // Insert invoice with new downpayment fields
      const invoiceResult = await client.query(`
        INSERT INTO market_invoices (
          company_id, invoice_number, customer_id, pricelist_id, warehouse_id,
          status, payment_status, subtotal, discount_percent, discount_amount, total_amount,
          amount_due, amount_paid, currency, due_date, notes, internal_notes, created_by,
          confirmed_at, paid_at,
          downpayment_type, downpayment_value, downpayment_amount, wholesale_exchange_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING id
      `, [
        payload.companyId,
        invoiceNumber,
        customerId,
        effectivePricelistId,
        warehouseId || null,
        initialStatus,
        initialPaymentStatus,
        subtotal,
        discountPercent || 0,
        discountAmount,
        totalAmount,
        initialAmountDue,
        initialAmountPaid,
        'USD',
        effectiveDueDate || null,
        notes || null,
        internalNotes || null,
        payload.userId,
        hasImmediatePayment ? new Date().toISOString() : null,
        hasImmediatePayment && initialPaymentStatus === 'paid' ? new Date().toISOString() : null,
        downpaymentType || null,
        downpaymentValue || null,
        downpaymentAmount || null,
        wholesaleExchangeRate || null
      ])

      const invoiceId = invoiceResult.rows[0].id

      // Insert lines
      for (const line of lines) {
        // Get current cost price for the product
        const costResult = await client.query(`
          SELECT cost_price FROM market_products WHERE id = $1
        `, [line.productId])
        const costPrice = costResult.rows[0]?.cost_price || 0

        const lineDiscountAmount = line.discountPercent
          ? (line.quantity * line.unitPrice * line.discountPercent / 100)
          : (line.discountAmount || 0)
        const lineSubtotal = (line.quantity * line.unitPrice) - lineDiscountAmount

        // Serialize warehouse quantities as JSONB (multi-warehouse support)
        const warehouseQuantities = line.warehouseQuantities || {}
        const warehouseQuantitiesJson = JSON.stringify(warehouseQuantities)

        await client.query(`
          INSERT INTO market_invoice_lines (
            invoice_id, product_id, variant_id, product_name, product_sku,
            quantity, unit_price, cost_price, original_price, discount_percent,
            discount_amount, subtotal, warehouse_quantities, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
          warehouseQuantitiesJson,
          line.notes || null
        ])
      }

      // Note: Deliveries are handled through warehouse operations, not created here

      // If immediate payment, record the payment
      if (hasImmediatePayment) {
        // Generate payment number
        const paymentNumberResult = await client.query(`
          SELECT payment_number FROM market_invoice_payments
          WHERE invoice_id IN (SELECT id FROM market_invoices WHERE company_id = $1)
          ORDER BY id DESC
          LIMIT 1
        `, [payload.companyId])

        let nextPaymentNumber = 1
        if (paymentNumberResult.rows.length > 0) {
          const lastNum = paymentNumberResult.rows[0].payment_number
          const match = lastNum.match(/PAY-\d{4}-(\d+)/)
          if (match) {
            nextPaymentNumber = parseInt(match[1]) + 1
          }
        }
        const paymentNumber = `PAY-${year}-${String(nextPaymentNumber).padStart(4, '0')}`

        // Record the actual payment amount (could be downpayment or full amount)
        const actualPaymentAmount = hasDownpayment ? downpaymentAmount : payment.amount
        const paymentNotes = []
        if (hasDownpayment) {
          paymentNotes.push(`Anticipo (${downpaymentType === 'percentage' ? `${downpaymentValue}%` : `$${downpaymentValue}`})`)
        }
        if (payment.amountTendered && payment.amountTendered > actualPaymentAmount) {
          paymentNotes.push(`Cambio: $${(payment.amountTendered - actualPaymentAmount).toFixed(2)}`)
        }

        await client.query(`
          INSERT INTO market_invoice_payments (
            invoice_id, payment_number, amount, currency, payment_method, reference, payment_date, notes, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          invoiceId,
          paymentNumber,
          actualPaymentAmount,
          payment.currency || 'USD',
          payment.method || 'cash',
          payment.reference || null,
          new Date().toISOString().split('T')[0],
          paymentNotes.length > 0 ? paymentNotes.join(' | ') : null,
          payload.userId
        ])
      }

      return { invoiceId, invoiceNumber }
    })

    return NextResponse.json({
      success: true,
      message: 'Factura creada exitosamente',
      data: {
        id: result.invoiceId,
        invoiceNumber: result.invoiceNumber
      }
    })

  } catch (error) {
    console.error('[Wholesale Invoices POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear factura'
    }, { status: 500 })
  }
}
