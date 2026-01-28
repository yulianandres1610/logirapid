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
 * POST /api/market/wholesale/invoices/[id]/confirm
 * Confirm an invoice (changes status from draft to confirmed)
 * This reserves stock for the invoice items
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

    // Verify invoice exists and is in draft status
    const checkResult = await db.query(`
      SELECT i.id, i.status, i.invoice_number, i.warehouse_id, w.name as warehouse_name
      FROM market_invoices i
      LEFT JOIN market_warehouses w ON w.id = i.warehouse_id
      WHERE i.id = $1 AND i.company_id = $2
    `, [invoiceId, payload.companyId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Factura no encontrada'
      }, { status: 404 })
    }

    const invoice = checkResult.rows[0]

    if (invoice.status !== 'draft') {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden confirmar facturas en estado borrador'
      }, { status: 400 })
    }

    // Get invoice lines
    const linesResult = await db.query(`
      SELECT il.*, p.name as product_name
      FROM market_invoice_lines il
      JOIN market_products p ON p.id = il.product_id
      WHERE il.invoice_id = $1
    `, [invoiceId])

    // If warehouse is specified, verify stock availability
    if (invoice.warehouse_id) {
      const insufficientStock = []

      for (const line of linesResult.rows) {
        // Check stock in warehouse
        const stockResult = await db.query(`
          SELECT COALESCE(SUM(quantity), 0) as available
          FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
          ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
        `, line.variant_id
          ? [invoice.warehouse_id, line.product_id, line.variant_id]
          : [invoice.warehouse_id, line.product_id]
        )

        const available = parseFloat(stockResult.rows[0]?.available) || 0
        if (available < parseFloat(line.quantity)) {
          insufficientStock.push({
            product: line.product_name,
            required: parseFloat(line.quantity),
            available
          })
        }
      }

      if (insufficientStock.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Stock insuficiente para algunos productos',
          data: { insufficientStock }
        }, { status: 400 })
      }
    }

    // Confirm invoice
    await db.query(`
      UPDATE market_invoices SET
        status = 'confirmed',
        confirmed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [invoiceId])

    // Update customer balance
    const invoiceTotal = await db.query(
      'SELECT total_amount, customer_id FROM market_invoices WHERE id = $1',
      [invoiceId]
    )
    const { total_amount, customer_id } = invoiceTotal.rows[0]

    await db.query(`
      UPDATE market_wholesale_customers SET
        current_balance = current_balance + $1,
        updated_at = NOW()
      WHERE id = $2
    `, [total_amount, customer_id])

    return NextResponse.json({
      success: true,
      message: `Factura ${invoice.invoice_number} confirmada exitosamente`,
      data: {
        invoiceNumber: invoice.invoice_number,
        warehouseName: invoice.warehouse_name
      }
    })

  } catch (error) {
    console.error('[Wholesale Invoice Confirm] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al confirmar factura'
    }, { status: 500 })
  }
}
