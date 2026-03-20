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
 * Get wholesale invoice deliveries pending dispatch for this warehouse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const { id } = await params
    const warehouseId = parseInt(id)

    if (isNaN(warehouseId)) {
      return NextResponse.json({ success: false, error: 'ID de almacén inválido' }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseCheck = await db.query(
      'SELECT id, name, code FROM market_warehouses WHERE id = $1 AND company_id = $2',
      [warehouseId, payload.companyId]
    )

    if (warehouseCheck.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Almacén no encontrado' }, { status: 404 })
    }

    // Get pending deliveries from market_invoice_deliveries
    // One-time fix: correct deliveries that were created as 'delivered' when they should be 'pending'
    try {
      await db.query(`
        UPDATE market_invoice_deliveries
        SET status = 'pending', dispatched_at = NULL, delivered_at = NULL, dispatched_by = NULL, delivered_by = NULL
        WHERE status = 'delivered' AND dispatched_at = created_at AND delivered_at = created_at
      `)
      await db.query(`
        UPDATE market_invoices SET status = 'confirmed', delivered_at = NULL
        WHERE status = 'delivered' AND id IN (
          SELECT invoice_id FROM market_invoice_deliveries WHERE status = 'pending'
        )
      `)
    } catch { /* ignore */ }

    // Status: pending = not yet dispatched, dispatched = in transit, delivered = completed
    let deliveries: any[] = []

    try {
      const deliveriesResult = await db.query(`
        SELECT
          d.id,
          d.delivery_number,
          d.invoice_id,
          d.warehouse_id,
          d.status,
          d.created_at,
          i.invoice_number,
          i.customer_id,
          i.total_amount,
          c.business_name as customer_name,
          c.code as customer_code,
          COALESCE(u.firstname || ' ' || u.lastname, u.email, 'Sistema') as created_by_name
        FROM market_invoice_deliveries d
        JOIN market_invoices i ON i.id = d.invoice_id
        LEFT JOIN market_wholesale_customers c ON c.id = i.customer_id
        LEFT JOIN users u ON u.id = d.created_by
        WHERE d.warehouse_id = $1
          AND i.company_id = $2
          AND d.status IN ('pending', 'dispatched')
        ORDER BY d.created_at DESC
      `, [warehouseId, payload.companyId])

      // Get lines for each delivery
      deliveries = await Promise.all(
        deliveriesResult.rows.map(async (delivery) => {
          const linesResult = await db.query(`
            SELECT
              dl.id as line_id,
              dl.product_id,
              dl.variant_id,
              dl.quantity,
              dl.quantity_delivered,
              il.product_name,
              il.product_sku,
              p.barcode as product_barcode,
              p.unit_of_measure as product_unit,
              pv.variant_name,
              pv.sku as variant_sku,
              pv.barcode as variant_barcode
            FROM market_invoice_delivery_lines dl
            LEFT JOIN market_invoice_lines il ON il.id = dl.invoice_line_id
            LEFT JOIN market_products p ON p.id = dl.product_id
            LEFT JOIN market_product_variants pv ON pv.id = dl.variant_id
            WHERE dl.delivery_id = $1
            ORDER BY dl.id
          `, [delivery.id])

          return {
            id: delivery.id,
            operationNumber: delivery.delivery_number,
            invoiceNumber: delivery.invoice_number,
            invoiceId: delivery.invoice_id,
            customerName: delivery.customer_name || 'Cliente',
            customerCode: delivery.customer_code,
            status: delivery.status,
            createdAt: delivery.created_at,
            createdBy: delivery.created_by_name,
            totalProducts: linesResult.rows.length,
            totalUnits: linesResult.rows.reduce((sum: number, l: any) => sum + (parseFloat(l.quantity) || 0), 0),
            lines: linesResult.rows.map((line: any) => ({
              lineId: line.line_id,
              productId: line.product_id,
              variantId: line.variant_id,
              productName: line.variant_name
                ? `${line.product_name} - ${line.variant_name}`
                : line.product_name || 'Producto',
              sku: line.variant_sku || line.product_sku || '',
              barcode: line.variant_barcode || line.product_barcode || '',
              unit: line.product_unit || 'unidad',
              quantityExpected: parseFloat(line.quantity) || 0,
              quantityValidated: parseFloat(line.quantity_delivered) || 0,
            }))
          }
        })
      )
    } catch (err) {
      console.log('[Pending Wholesale] Query error:', err)
      // Table may not exist yet
    }

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
