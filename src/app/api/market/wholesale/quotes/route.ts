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
 * GET /api/market/wholesale/quotes
 * List quotes for the company
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
    const customerId = searchParams.get('customerId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Build WHERE clause
    let whereClause = 'WHERE q.company_id = $1'
    const params: (string | number)[] = [payload.companyId]
    let paramIndex = 2

    if (status && status !== 'all') {
      // Support comma-separated statuses: ?status=draft,sent,accepted
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        whereClause += ` AND q.status = $${paramIndex}`
        params.push(statuses[0])
        paramIndex++
      } else if (statuses.length > 1) {
        const placeholders = statuses.map((_, i) => `$${paramIndex + i}`).join(', ')
        whereClause += ` AND q.status IN (${placeholders})`
        for (const s of statuses) {
          params.push(s)
          paramIndex++
        }
      }
    }

    // Filter out already-converted quotes
    const notConverted = searchParams.get('notConverted')
    if (notConverted === 'true') {
      whereClause += ` AND q.converted_to_invoice_id IS NULL`
    }

    if (search) {
      whereClause += ` AND (q.quote_number ILIKE $${paramIndex} OR c.business_name ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    if (customerId) {
      whereClause += ` AND q.customer_id = $${paramIndex}`
      params.push(parseInt(customerId))
      paramIndex++
    }

    // Count total
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM market_quotes q
      JOIN market_wholesale_customers c ON c.id = q.customer_id
      ${whereClause}
    `, params)
    const total = parseInt(countResult.rows[0]?.total || '0')

    // Get quotes
    const query = `
      SELECT
        q.*,
        c.business_name as customer_name,
        c.code as customer_code,
        w.name as warehouse_name,
        pl.name as pricelist_name,
        u.email as created_by_email,
        (SELECT COUNT(*) FROM market_quote_lines ql WHERE ql.quote_id = q.id) as lines_count
      FROM market_quotes q
      JOIN market_wholesale_customers c ON c.id = q.customer_id
      LEFT JOIN market_warehouses w ON w.id = q.warehouse_id
      LEFT JOIN market_pricelists pl ON pl.id = q.pricelist_id
      LEFT JOIN users u ON u.id = q.created_by
      ${whereClause}
      ORDER BY q.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const result = await db.query(query, params)

    const quotes = result.rows.map(row => ({
      id: row.id,
      quoteNumber: row.quote_number,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerCode: row.customer_code,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      pricelistId: row.pricelist_id,
      pricelistName: row.pricelist_name,
      status: row.status,
      subtotal: parseFloat(row.subtotal) || 0,
      discountPercent: parseFloat(row.discount_percent) || 0,
      discountAmount: parseFloat(row.discount_amount) || 0,
      totalAmount: parseFloat(row.total_amount) || 0,
      currency: row.currency,
      validUntil: row.valid_until,
      linesCount: parseInt(row.lines_count) || 0,
      convertedToInvoiceId: row.converted_to_invoice_id,
      createdBy: row.created_by_email,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      acceptedAt: row.accepted_at
    }))

    // Calculate stats
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE status = 'converted') as converted,
        COALESCE(SUM(CASE WHEN status IN ('sent', 'accepted') THEN total_amount ELSE 0 END), 0) as pending_value
      FROM market_quotes
      WHERE company_id = $1
    `, [payload.companyId])

    const stats = statsResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        quotes,
        stats: {
          total: parseInt(stats.total) || 0,
          draft: parseInt(stats.draft) || 0,
          sent: parseInt(stats.sent) || 0,
          accepted: parseInt(stats.accepted) || 0,
          converted: parseInt(stats.converted) || 0,
          pendingValue: parseFloat(stats.pending_value) || 0
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
    console.error('[Wholesale Quotes GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener cotizaciones'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/wholesale/quotes
 * Create a new quote
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const {
      customerId,
      warehouseId,
      pricelistId,
      validUntil,
      discountPercent,
      notes,
      internalNotes,
      lines
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
      'SELECT id, pricelist_id FROM market_wholesale_customers WHERE id = $1 AND company_id = $2',
      [customerId, payload.companyId]
    )

    if (customerResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Cliente no encontrado'
      }, { status: 404 })
    }

    // Use customer's pricelist if not specified
    const effectivePricelistId = pricelistId || customerResult.rows[0].pricelist_id

    // Generate quote number: COT-2025-0001
    const year = new Date().getFullYear()
    const numberResult = await db.query(`
      SELECT quote_number FROM market_quotes
      WHERE company_id = $1 AND quote_number LIKE $2
      ORDER BY id DESC
      LIMIT 1
    `, [payload.companyId, `COT-${year}-%`])

    let nextNumber = 1
    if (numberResult.rows.length > 0) {
      const lastNumber = numberResult.rows[0].quote_number
      const match = lastNumber.match(/COT-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const quoteNumber = `COT-${year}-${String(nextNumber).padStart(4, '0')}`

    // Calculate totals
    let subtotal = 0
    for (const line of lines) {
      const lineSubtotal = (line.quantity * line.unitPrice) - (line.discountAmount || 0)
      subtotal += lineSubtotal
    }

    const discountAmount = discountPercent ? (subtotal * discountPercent / 100) : 0
    const totalAmount = subtotal - discountAmount

    // Ensure estimated_delivery column exists
    try {
      await db.query('ALTER TABLE market_quote_lines ADD COLUMN IF NOT EXISTS estimated_delivery VARCHAR(20)')
    } catch { /* column may already exist */ }

    // Create quote using transaction
    const result = await db.transaction(async (client) => {
      // Insert quote
      const quoteResult = await client.query(`
        INSERT INTO market_quotes (
          company_id, quote_number, customer_id, pricelist_id, warehouse_id,
          status, subtotal, discount_percent, discount_amount, total_amount,
          currency, valid_until, notes, internal_notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `, [
        payload.companyId,
        quoteNumber,
        customerId,
        effectivePricelistId,
        warehouseId || null,
        'draft',
        subtotal,
        discountPercent || 0,
        discountAmount,
        totalAmount,
        'USD',
        validUntil || null,
        notes || null,
        internalNotes || null,
        payload.userId
      ])

      const quoteId = quoteResult.rows[0].id

      // Insert lines
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

      return { quoteId, quoteNumber }
    })

    return NextResponse.json({
      success: true,
      message: 'Cotización creada exitosamente',
      data: {
        id: result.quoteId,
        quoteNumber: result.quoteNumber
      }
    })

  } catch (error) {
    console.error('[Wholesale Quotes POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear cotización'
    }, { status: 500 })
  }
}
