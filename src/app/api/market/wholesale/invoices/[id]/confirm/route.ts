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
 * Generate next operation number for wholesale delivery
 */
async function generateOperationNumber(companyId: number): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `WD-${year}-`

  const result = await db.query(`
    SELECT operation_number FROM market_warehouse_operations
    WHERE company_id = $1 AND operation_number LIKE $2
    ORDER BY operation_number DESC LIMIT 1
  `, [companyId, `${prefix}%`])

  let nextNumber = 1
  if (result.rows.length > 0) {
    const lastNumber = result.rows[0].operation_number
    const match = lastNumber.match(/WD-\d{4}-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1]) + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}

/**
 * POST /api/market/wholesale/invoices/[id]/confirm
 * Confirm an invoice (changes status from draft to confirmed)
 * This reserves stock for the invoice items and creates a warehouse operation
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
      SELECT i.id, i.status, i.invoice_number, i.warehouse_id, i.customer_id,
             w.name as warehouse_name, c.business_name as customer_name
      FROM market_invoices i
      LEFT JOIN market_warehouses w ON w.id = i.warehouse_id
      LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
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

    if (!invoice.warehouse_id) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar un almacén para confirmar la factura'
      }, { status: 400 })
    }

    // Get invoice lines
    const linesResult = await db.query(`
      SELECT il.*, p.name as product_name, p.sku as product_sku, p.barcode
      FROM market_invoice_lines il
      JOIN market_products p ON p.id = il.product_id
      WHERE il.invoice_id = $1
    `, [invoiceId])

    // Verify stock availability and check reserved amounts
    const insufficientStock = []

    for (const line of linesResult.rows) {
      const stockResult = await db.query(`
        SELECT
          COALESCE(quantity_on_hand, 0) as on_hand,
          COALESCE(quantity_reserved, 0) as reserved
        FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2
        ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
      `, line.variant_id
        ? [invoice.warehouse_id, line.product_id, line.variant_id]
        : [invoice.warehouse_id, line.product_id]
      )

      const onHand = parseFloat(stockResult.rows[0]?.on_hand) || 0
      const reserved = parseFloat(stockResult.rows[0]?.reserved) || 0
      const available = onHand - reserved
      const required = parseFloat(line.quantity)

      if (available < required) {
        insufficientStock.push({
          product: line.product_name,
          required: required,
          available: available,
          onHand: onHand,
          reserved: reserved
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

    // Start transaction
    await db.query('BEGIN')

    try {
      // 1. Confirm invoice
      await db.query(`
        UPDATE market_invoices SET
          status = 'confirmed',
          confirmed_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
      `, [invoiceId])

      // 2. Reserve stock for each line
      for (const line of linesResult.rows) {
        // First, check if stock record exists
        const stockCheck = await db.query(`
          SELECT id FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2
          ${line.variant_id ? 'AND variant_id = $3' : 'AND variant_id IS NULL'}
        `, line.variant_id
          ? [invoice.warehouse_id, line.product_id, line.variant_id]
          : [invoice.warehouse_id, line.product_id]
        )

        if (stockCheck.rows.length > 0) {
          // Update existing stock record - reserve the quantity
          await db.query(`
            UPDATE market_warehouse_stock SET
              quantity_reserved = COALESCE(quantity_reserved, 0) + $1,
              updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3
            ${line.variant_id ? 'AND variant_id = $4' : 'AND variant_id IS NULL'}
          `, line.variant_id
            ? [line.quantity, invoice.warehouse_id, line.product_id, line.variant_id]
            : [line.quantity, invoice.warehouse_id, line.product_id]
          )
        }
      }

      // 3. Create warehouse operation for the delivery
      const operationNumber = await generateOperationNumber(payload.companyId)

      const operationResult = await db.query(`
        INSERT INTO market_warehouse_operations (
          company_id, operation_number, operation_type, status,
          source_warehouse_id, validation_status,
          reference_type, reference_id, reference_number,
          notes, created_by, created_at
        ) VALUES (
          $1, $2, 'wholesale_delivery', 'pending',
          $3, 'pending_validation',
          'wholesale_invoice', $4, $5,
          $6, $7, NOW()
        ) RETURNING id
      `, [
        payload.companyId,
        operationNumber,
        invoice.warehouse_id,
        invoiceId,
        invoice.invoice_number,
        `Entrega mayorista - Cliente: ${invoice.customer_name}`,
        payload.userId
      ])

      const operationId = operationResult.rows[0].id

      // 4. Create operation lines
      for (const line of linesResult.rows) {
        await db.query(`
          INSERT INTO market_warehouse_operation_lines (
            operation_id, product_id, variant_id,
            quantity_planned, quantity_validated,
            created_at
          ) VALUES ($1, $2, $3, $4, 0, NOW())
        `, [operationId, line.product_id, line.variant_id, line.quantity])
      }

      // 5. Link operation to invoice delivery (if delivery exists) or store operation reference
      await db.query(`
        UPDATE market_invoices SET
          notes = COALESCE(notes, '') || E'\nOperación de almacén: ' || $1
        WHERE id = $2
      `, [operationNumber, invoiceId])

      // 6. Update customer balance
      const invoiceTotal = await db.query(
        'SELECT total_amount FROM market_invoices WHERE id = $1',
        [invoiceId]
      )
      const { total_amount } = invoiceTotal.rows[0]

      await db.query(`
        UPDATE market_wholesale_customers SET
          current_balance = current_balance + $1,
          updated_at = NOW()
        WHERE id = $2
      `, [total_amount, invoice.customer_id])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Factura ${invoice.invoice_number} confirmada exitosamente`,
        data: {
          invoiceNumber: invoice.invoice_number,
          warehouseName: invoice.warehouse_name,
          operationNumber: operationNumber,
          operationId: operationId
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Wholesale Invoice Confirm] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al confirmar factura'
    }, { status: 500 })
  }
}
