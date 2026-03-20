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
    // One-time fix: correct deliveries that were auto-set to 'delivered' on creation
    // These have dispatched_at within 1 second of created_at (set in same transaction)
    try {
      const fixResult = await db.query(`
        UPDATE market_invoice_deliveries
        SET status = 'pending', dispatched_at = NULL, delivered_at = NULL, dispatched_by = NULL, delivered_by = NULL
        WHERE status = 'delivered'
          AND ABS(EXTRACT(EPOCH FROM (dispatched_at - created_at))) < 2
          AND warehouse_id = $1
      `, [warehouseId])
      if (fixResult.rowCount && fixResult.rowCount > 0) {
        console.log(`[Wholesale Fix] Corrected ${fixResult.rowCount} deliveries from delivered to pending`)
        await db.query(`
          UPDATE market_invoices SET status = 'confirmed', delivered_at = NULL
          WHERE status = 'delivered' AND id IN (
            SELECT invoice_id FROM market_invoice_deliveries WHERE status = 'pending' AND warehouse_id = $1
          )
        `, [warehouseId])
      }
    } catch (fixErr) {
      console.log('[Wholesale Fix] Error:', fixErr)
    }

    // Status: pending = not yet dispatched, dispatched = in transit, delivered = completed
    let deliveries: any[] = []

    try {
      // Simple query first to find deliveries, then enrich
      const deliveriesResult = await db.query(`
        SELECT
          d.id,
          d.delivery_number,
          d.invoice_id,
          d.warehouse_id,
          d.status,
          d.created_at,
          d.created_by
        FROM market_invoice_deliveries d
        WHERE d.warehouse_id = $1
          AND d.status IN ('pending', 'dispatched')
        ORDER BY d.created_at DESC
      `, [warehouseId])

      console.log('[Pending Wholesale] Found', deliveriesResult.rows.length, 'deliveries for warehouse', warehouseId)

      // Enrich with invoice and customer data
      for (const d of deliveriesResult.rows) {
        try {
          const inv = await db.query('SELECT invoice_number, customer_id, total_amount FROM market_invoices WHERE id = $1', [d.invoice_id])
          if (inv.rows[0]) {
            d.invoice_number = inv.rows[0].invoice_number
            d.customer_id = inv.rows[0].customer_id
            d.total_amount = inv.rows[0].total_amount
            if (inv.rows[0].customer_id) {
              const cust = await db.query('SELECT business_name, code FROM market_wholesale_customers WHERE id = $1', [inv.rows[0].customer_id])
              d.customer_name = cust.rows[0]?.business_name || 'Cliente'
              d.customer_code = cust.rows[0]?.code || ''
            }
          }
        } catch { /* ignore enrichment errors */ }
        try {
          const usr = await db.query("SELECT COALESCE(firstname || ' ' || lastname, email) as name FROM users WHERE id = $1", [d.created_by])
          d.created_by_name = usr.rows[0]?.name || 'Sistema'
        } catch { d.created_by_name = 'Sistema' }
      }

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
    } catch (err: any) {
      console.error('[Pending Wholesale] Query error:', err)
      return NextResponse.json({
        success: true,
        data: {
          warehouseId,
          warehouseName: warehouseCheck.rows[0].name,
          pendingCount: 0,
          deliveries: [],
          _queryError: err?.message || String(err)
        }
      })
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
