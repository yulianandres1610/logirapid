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
 * GET /api/market/wholesale/invoices/[id]/deliveries
 * Get all deliveries for an invoice
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

    // Verify invoice exists
    const invoiceResult = await db.query(
      'SELECT id FROM market_invoices WHERE id = $1 AND company_id = $2',
      [invoiceId, payload.companyId]
    )

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    // Get deliveries with lines
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

    const deliveries = []
    for (const d of deliveriesResult.rows) {
      // Get delivery lines
      const linesResult = await db.query(`
        SELECT
          dl.*,
          il.product_name,
          il.product_sku
        FROM market_invoice_delivery_lines dl
        JOIN market_invoice_lines il ON il.id = dl.invoice_line_id
        WHERE dl.delivery_id = $1
      `, [d.id])

      deliveries.push({
        id: d.id,
        deliveryNumber: d.delivery_number,
        warehouseId: d.warehouse_id,
        warehouseName: d.warehouse_name,
        operationId: d.operation_id,
        status: d.status,
        deliveryDate: d.delivery_date,
        deliveryAddress: d.delivery_address,
        notes: d.notes,
        createdBy: d.created_by_email,
        createdAt: d.created_at,
        dispatchedAt: d.dispatched_at,
        deliveredAt: d.delivered_at,
        lines: linesResult.rows.map(l => ({
          id: l.id,
          invoiceLineId: l.invoice_line_id,
          productId: l.product_id,
          variantId: l.variant_id,
          productName: l.product_name,
          productSku: l.product_sku,
          quantityToDeliver: parseFloat(l.quantity_to_deliver) || 0,
          quantityDelivered: parseFloat(l.quantity_delivered) || 0
        }))
      })
    }

    return NextResponse.json({
      success: true,
      data: deliveries
    })

  } catch (error) {
    console.error('[Wholesale Invoice Deliveries GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener entregas'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/wholesale/invoices/[id]/deliveries
 * Create a new delivery for an invoice
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
    const invoiceId = parseInt(id)
    const body = await request.json()

    const {
      warehouseId,
      deliveryDate,
      deliveryAddress,
      notes,
      lines
    } = body

    // Verify invoice exists and is confirmed
    const invoiceResult = await db.query(`
      SELECT i.id, i.status, i.warehouse_id, c.address as customer_address
      FROM market_invoices i
      JOIN market_wholesale_customers c ON c.id = i.customer_id
      WHERE i.id = $1 AND i.company_id = $2
    `, [invoiceId, payload.companyId])

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    const invoice = invoiceResult.rows[0]

    if (!['confirmed', 'partial_delivery'].includes(invoice.status)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden crear entregas para facturas confirmadas'
      }, { status: 400 })
    }

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe especificar al menos un producto para entregar'
      }, { status: 400 })
    }

    const effectiveWarehouseId = warehouseId || invoice.warehouse_id
    if (!effectiveWarehouseId) {
      return NextResponse.json({
        success: false,
        error: 'Debe especificar un almacén para la entrega'
      }, { status: 400 })
    }

    // Verify quantities don't exceed pending
    const invoiceLinesResult = await db.query(`
      SELECT id, product_id, variant_id, quantity, quantity_delivered
      FROM market_invoice_lines
      WHERE invoice_id = $1
    `, [invoiceId])

    const invoiceLinesMap = new Map()
    for (const line of invoiceLinesResult.rows) {
      invoiceLinesMap.set(line.id, {
        productId: line.product_id,
        variantId: line.variant_id,
        quantity: parseFloat(line.quantity),
        delivered: parseFloat(line.quantity_delivered) || 0
      })
    }

    for (const line of lines) {
      const invoiceLine = invoiceLinesMap.get(line.invoiceLineId)
      if (!invoiceLine) {
        return NextResponse.json({
          success: false,
          error: `Línea de factura ${line.invoiceLineId} no encontrada`
        }, { status: 400 })
      }

      const pending = invoiceLine.quantity - invoiceLine.delivered
      if (line.quantity > pending) {
        return NextResponse.json({
          success: false,
          error: `Cantidad a entregar excede el pendiente para línea ${line.invoiceLineId}`
        }, { status: 400 })
      }
    }

    // Generate delivery number: ENT-2025-0001
    const year = new Date().getFullYear()
    const numberResult = await db.query(`
      SELECT delivery_number FROM market_invoice_deliveries
      WHERE delivery_number LIKE $1
      ORDER BY id DESC
      LIMIT 1
    `, [`ENT-${year}-%`])

    let nextNumber = 1
    if (numberResult.rows.length > 0) {
      const lastNumber = numberResult.rows[0].delivery_number
      const match = lastNumber.match(/ENT-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const deliveryNumber = `ENT-${year}-${String(nextNumber).padStart(4, '0')}`

    const result = await db.transaction(async (client) => {
      // Create delivery
      const deliveryResult = await client.query(`
        INSERT INTO market_invoice_deliveries (
          invoice_id, delivery_number, warehouse_id, status,
          delivery_date, delivery_address, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        invoiceId,
        deliveryNumber,
        effectiveWarehouseId,
        'pending',
        deliveryDate || null,
        deliveryAddress || invoice.customer_address || null,
        notes || null,
        payload.userId
      ])

      const deliveryId = deliveryResult.rows[0].id

      // Create delivery lines
      for (const line of lines) {
        const invoiceLine = invoiceLinesMap.get(line.invoiceLineId)

        await client.query(`
          INSERT INTO market_invoice_delivery_lines (
            delivery_id, invoice_line_id, product_id, variant_id, quantity_to_deliver
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          deliveryId,
          line.invoiceLineId,
          invoiceLine.productId,
          invoiceLine.variantId,
          line.quantity
        ])
      }

      return { deliveryId, deliveryNumber }
    })

    return NextResponse.json({
      success: true,
      message: `Entrega ${result.deliveryNumber} creada exitosamente`,
      data: {
        id: result.deliveryId,
        deliveryNumber: result.deliveryNumber
      }
    })

  } catch (error) {
    console.error('[Wholesale Invoice Deliveries POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al crear entrega'
    }, { status: 500 })
  }
}
