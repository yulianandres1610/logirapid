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

/**
 * GET /api/market/warehouses/[id]/pending-wholesale-deliveries
 * Get wholesale delivery operations pending validation for this warehouse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({
        success: false,
        error: 'ID de almacén inválido'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id, name, code FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacén no encontrado'
      }, { status: 404 })
    }

    // Get pending wholesale deliveries where this warehouse is the source
    const deliveriesResult = await db.query(`
      SELECT
        o.id,
        o.operation_number,
        COALESCE(i.invoice_number, o.reference_id::text) as invoice_number,
        o.reference_id as invoice_id,
        o.status,
        o.validation_status,
        o.notes,
        o.created_at,
        o.created_by,
        COALESCE(CONCAT(NULLIF(TRIM(u.firstname), ''), ' ', NULLIF(TRIM(u.lastname), '')), u.email, 'Sistema') as created_by_name,
        i.customer_id,
        c.business_name as customer_name,
        c.code as customer_code,
        (SELECT COUNT(*) FROM market_warehouse_operation_lines WHERE operation_id = o.id) as total_products,
        (SELECT COALESCE(SUM(quantity_planned), 0) FROM market_warehouse_operation_lines WHERE operation_id = o.id) as total_units
      FROM market_warehouse_operations o
      LEFT JOIN users u ON u.id = o.created_by
      LEFT JOIN market_invoices i ON i.id = o.reference_id AND o.reference_type = 'wholesale_invoice'
      LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
      WHERE o.source_warehouse_id = $1
        AND o.company_id = $2
        AND o.operation_type = 'wholesale_delivery'
        AND o.status = 'pending'
        AND (o.validation_status = 'pending_validation' OR o.validation_status IS NULL)
      ORDER BY o.created_at DESC
    `, [warehouseId, payload.companyId])

    // Get lines for each delivery
    const deliveries = await Promise.all(
      deliveriesResult.rows.map(async (delivery) => {
        const linesResult = await db.query(`
          SELECT
            l.id as line_id,
            l.product_id,
            l.variant_id,
            p.name as product_name,
            p.sku,
            p.barcode,
            pv.name as variant_name,
            pv.sku as variant_sku,
            pv.barcode as variant_barcode,
            l.quantity_planned as quantity_expected,
            COALESCE(l.quantity_validated, 0) as quantity_validated
          FROM market_warehouse_operation_lines l
          JOIN market_products p ON p.id = l.product_id
          LEFT JOIN market_product_variants pv ON pv.id = l.variant_id
          WHERE l.operation_id = $1
          ORDER BY p.name
        `, [delivery.id])

        return {
          id: delivery.id,
          operationNumber: delivery.operation_number,
          invoiceNumber: delivery.invoice_number,
          invoiceId: delivery.invoice_id,
          customer: {
            id: delivery.customer_id,
            name: delivery.customer_name,
            code: delivery.customer_code
          },
          status: delivery.status,
          validationStatus: delivery.validation_status,
          notes: delivery.notes,
          createdAt: delivery.created_at,
          createdBy: delivery.created_by_name,
          totalProducts: parseInt(delivery.total_products) || 0,
          totalUnits: parseFloat(delivery.total_units) || 0,
          lines: linesResult.rows.map(line => ({
            lineId: line.line_id,
            productId: line.product_id,
            variantId: line.variant_id,
            productName: line.product_name,
            variantName: line.variant_name,
            sku: line.variant_sku || line.sku,
            barcode: line.variant_barcode || line.barcode,
            quantityExpected: parseFloat(line.quantity_expected) || 0,
            quantityValidated: parseFloat(line.quantity_validated) || 0
          }))
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        warehouseId,
        warehouseName: warehouseCheck.rows[0].name,
        pendingCount: deliveries.length,
        deliveries
      }
    })

  } catch (error) {
    console.error('[Pending Wholesale Deliveries] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener entregas pendientes'
    }, { status: 500 })
  }
}
