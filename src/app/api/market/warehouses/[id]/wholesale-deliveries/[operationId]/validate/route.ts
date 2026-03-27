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
 * GET /api/market/warehouses/[id]/wholesale-deliveries/[operationId]/validate
 * Get validation data for a wholesale delivery operation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; operationId: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id, operationId } = await params
    const warehouseId = parseInt(id)
    const opId = parseInt(operationId)

    // Try to find by operation ID first, then by delivery ID
    let realOpId = opId
    const deliveryCheck = await db.query(
      'SELECT operation_id FROM market_invoice_deliveries WHERE id = $1',
      [opId]
    )
    if (deliveryCheck.rows.length > 0 && deliveryCheck.rows[0].operation_id) {
      realOpId = deliveryCheck.rows[0].operation_id
    }

    // Get operation details
    const operationResult = await db.query(`
      SELECT
        o.id, o.operation_number, o.operation_type, o.status, o.validation_status,
        o.source_warehouse_id, sw.name as source_warehouse_name, sw.code as source_warehouse_code,
        i.invoice_number, o.reference_id as invoice_id,
        o.notes, o.created_at, o.created_by,
        CONCAT(u.firstname, ' ', u.lastname) as created_by_name,
        c.id as customer_id, c.business_name as customer_name, c.code as customer_code
      FROM market_warehouse_operations o
      LEFT JOIN market_warehouses sw ON sw.id = o.source_warehouse_id
      LEFT JOIN users u ON u.id = o.created_by
      LEFT JOIN market_invoices i ON i.id = o.reference_id
      LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
      WHERE o.id = $1 AND o.company_id = $2 AND o.operation_type = 'wholesale_delivery'
    `, [realOpId, payload.companyId])

    if (operationResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Operación no encontrada'
      }, { status: 404 })
    }

    const operation = operationResult.rows[0]

    // Get lines with product details
    const linesResult = await db.query(`
      SELECT
        l.id as line_id,
        l.product_id,
        l.variant_id,
        p.name as product_name,
        p.sku,
        p.barcode,
        pv.variant_name as variant_name,
        pv.sku as variant_sku,
        pv.barcode as variant_barcode,
        l.quantity_planned as quantity_expected,
        COALESCE(l.quantity_validated, 0) as quantity_validated
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      LEFT JOIN market_product_variants pv ON pv.id = l.variant_id
      WHERE l.operation_id = $1
      ORDER BY p.name
    `, [opId])

    const lines = linesResult.rows.map(line => ({
      lineId: line.line_id,
      productId: line.product_id,
      variantId: line.variant_id,
      productName: line.product_name,
      variantName: line.variant_name,
      sku: line.variant_sku || line.sku,
      barcode: line.variant_barcode || line.barcode,
      quantityExpected: parseFloat(line.quantity_expected) || 0,
      quantityValidated: parseFloat(line.quantity_validated) || 0,
      isComplete: parseFloat(line.quantity_validated) >= parseFloat(line.quantity_expected)
    }))

    // Calculate progress
    const totalExpected = lines.reduce((sum, l) => sum + l.quantityExpected, 0)
    const totalValidated = lines.reduce((sum, l) => sum + l.quantityValidated, 0)
    const completedLines = lines.filter(l => l.isComplete).length

    return NextResponse.json({
      success: true,
      data: {
        operation: {
          id: operation.id,
          operationNumber: operation.operation_number,
          invoiceNumber: operation.invoice_number,
          invoiceId: operation.invoice_id,
          sourceWarehouse: {
            id: operation.source_warehouse_id,
            name: operation.source_warehouse_name,
            code: operation.source_warehouse_code
          },
          customer: {
            id: operation.customer_id,
            name: operation.customer_name,
            code: operation.customer_code
          },
          status: operation.status,
          validationStatus: operation.validation_status,
          createdAt: operation.created_at,
          createdBy: operation.created_by_name
        },
        lines,
        progress: {
          totalLines: lines.length,
          completedLines,
          totalExpected,
          totalValidated,
          progressPercent: totalExpected > 0 ? Math.round((totalValidated / totalExpected) * 100) : 0,
          isAllValidated: completedLines === lines.length
        }
      }
    })

  } catch (error) {
    console.error('[Wholesale Delivery Validate GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener datos de validación'
    }, { status: 500 })
  }
}

/**
 * POST /api/market/warehouses/[id]/wholesale-deliveries/[operationId]/validate
 * Update validation quantities for a wholesale delivery
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; operationId: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id, operationId } = await params
    const opId = parseInt(operationId)

    const body = await request.json()
    const { lines } = body

    if (!lines || !Array.isArray(lines)) {
      return NextResponse.json({
        success: false,
        error: 'Datos de validación inválidos'
      }, { status: 400 })
    }

    // Resolve delivery ID → operation ID
    let realOpId = opId
    const delCheck = await db.query('SELECT operation_id FROM market_invoice_deliveries WHERE id = $1', [opId])
    if (delCheck.rows.length > 0 && delCheck.rows[0].operation_id) {
      realOpId = delCheck.rows[0].operation_id
    }

    // Verify operation exists and is in correct state
    const operationCheck = await db.query(`
      SELECT id, status, validation_status
      FROM market_warehouse_operations
      WHERE id = $1 AND company_id = $2 AND operation_type = 'wholesale_delivery'
    `, [realOpId, payload.companyId])

    if (operationCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Operación no encontrada'
      }, { status: 404 })
    }

    const operation = operationCheck.rows[0]
    if (!['pending', 'confirmed', 'in_progress'].includes(operation.status) && operation.status !== 'done') {
      return NextResponse.json({
        success: false,
        error: 'Esta operación ya no está pendiente de validación'
      }, { status: 400 })
    }

    // Update validated quantities
    for (const line of lines) {
      await db.query(`
        UPDATE market_warehouse_operation_lines
        SET quantity_validated = $1
        WHERE id = $2 AND operation_id = $3
      `, [line.quantityValidated, line.lineId, opId])
    }

    // Fetch updated lines for response
    const linesResult = await db.query(`
      SELECT
        l.id as line_id,
        l.product_id,
        l.variant_id,
        p.name as product_name,
        pv.variant_name as variant_name,
        COALESCE(pv.sku, p.sku) as sku,
        COALESCE(pv.barcode, p.barcode) as barcode,
        l.quantity_planned as quantity_expected,
        COALESCE(l.quantity_validated, 0) as quantity_validated
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      LEFT JOIN market_product_variants pv ON pv.id = l.variant_id
      WHERE l.operation_id = $1
      ORDER BY p.name
    `, [opId])

    const updatedLines = linesResult.rows.map(line => ({
      lineId: line.line_id,
      productId: line.product_id,
      variantId: line.variant_id,
      productName: line.product_name,
      variantName: line.variant_name,
      sku: line.sku,
      barcode: line.barcode,
      quantityExpected: parseFloat(line.quantity_expected) || 0,
      quantityValidated: parseFloat(line.quantity_validated) || 0,
      isComplete: parseFloat(line.quantity_validated) >= parseFloat(line.quantity_expected)
    }))

    const totalExpected = updatedLines.reduce((sum, l) => sum + l.quantityExpected, 0)
    const totalValidated = updatedLines.reduce((sum, l) => sum + l.quantityValidated, 0)
    const completedLines = updatedLines.filter(l => l.isComplete).length

    return NextResponse.json({
      success: true,
      data: {
        operationId: opId,
        lines: updatedLines,
        progress: {
          totalLines: updatedLines.length,
          completedLines,
          totalExpected,
          totalValidated,
          progressPercent: totalExpected > 0 ? Math.round((totalValidated / totalExpected) * 100) : 0,
          isAllValidated: completedLines === updatedLines.length
        }
      }
    })

  } catch (error) {
    console.error('[Wholesale Delivery Validate POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al guardar validación'
    }, { status: 500 })
  }
}
