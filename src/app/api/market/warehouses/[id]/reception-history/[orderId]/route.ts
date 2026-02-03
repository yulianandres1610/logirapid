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
 * GET /api/market/warehouses/[id]/reception-history/[orderId]
 * Obtiene detalles de una recepción específica
 * Query params: type=consignment|purchase
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; orderId: string }> }
) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id, orderId } = await params
    const warehouseId = parseInt(id)
    const orderIdNum = parseInt(orderId)
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type || !['consignment', 'purchase', 'production'].includes(type)) {
      return NextResponse.json({
        success: false,
        error: 'Tipo de orden requerido (consignment, purchase o production)'
      }, { status: 400 })
    }

    if (type === 'consignment') {
      // Get consignment order details
      const orderResult = await db.query(`
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.received_at,
          o.created_at,
          s.id as supplier_id,
          s.supplier_code as supplier_code,
          s.name as supplier_name,
          w.name as warehouse_name,
          w.code as warehouse_code,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as received_by_name
        FROM consignment_orders o
        JOIN market_suppliers s ON s.id = o.supplier_id
        LEFT JOIN market_warehouses w ON w.id = o.warehouse_id
        LEFT JOIN users u ON u.id = o.received_by
        WHERE o.id = $1 AND o.company_id = $2 AND o.warehouse_id = $3
      `, [orderIdNum, payload.companyId, warehouseId])

      if (orderResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Orden de consignación no encontrada'
        }, { status: 404 })
      }

      const order = orderResult.rows[0]

      // Get order lines with product details
      const linesResult = await db.query(`
        SELECT
          ol.id as line_id,
          ol.product_id,
          ol.quantity_ordered,
          ol.quantity_received,
          ol.lot_number,
          ol.expiration_date,
          ol.unit_cost,
          mp.name as product_name,
          mp.sku,
          mp.barcode
        FROM consignment_order_lines ol
        JOIN market_products mp ON mp.id = ol.product_id
        WHERE ol.order_id = $1
        ORDER BY ol.id
      `, [orderIdNum])

      // Get lot inventory entries for this order
      const lotInventory = await db.query(`
        SELECT
          cli.lot_number,
          cli.expiration_date,
          cli.quantity_initial,
          cli.quantity_available,
          cli.quantity_sold,
          cli.received_at,
          mp.name as product_name
        FROM consignment_lot_inventory cli
        JOIN market_products mp ON mp.id = cli.product_id
        WHERE cli.order_line_id IN (
          SELECT id FROM consignment_order_lines WHERE order_id = $1
        )
        ORDER BY cli.received_at DESC
      `, [orderIdNum])

      return NextResponse.json({
        success: true,
        data: {
          orderType: 'consignment',
          order: {
            id: order.id,
            orderNumber: order.order_number,
            status: order.status,
            receivedAt: order.received_at,
            createdAt: order.created_at,
            supplier: {
              id: order.supplier_id,
              code: order.supplier_code,
              name: order.supplier_name
            },
            warehouse: {
              name: order.warehouse_name,
              code: order.warehouse_code
            },
            receivedBy: order.received_by_name
          },
          lines: linesResult.rows.map(line => ({
            lineId: line.line_id,
            productId: line.product_id,
            productName: line.product_name,
            sku: line.sku,
            barcode: line.barcode,
            quantityOrdered: line.quantity_ordered,
            quantityReceived: line.quantity_received,
            lotNumber: line.lot_number,
            expirationDate: line.expiration_date,
            unitCost: parseFloat(line.unit_cost || '0')
          })),
          lotInventory: lotInventory.rows,
          totals: {
            totalOrdered: linesResult.rows.reduce((sum, l) => sum + (l.quantity_ordered || 0), 0),
            totalReceived: linesResult.rows.reduce((sum, l) => sum + (l.quantity_received || 0), 0),
            totalLines: linesResult.rows.length
          }
        }
      })

    } else if (type === 'purchase') {
      // Get purchase order details
      const purchaseResult = await db.query(`
        SELECT
          p.id,
          p.purchase_number,
          p.status,
          p.received_date,
          p.created_at,
          p.supplier_id,
          COALESCE(ms.supplier_code, 'PROV') as supplier_code,
          COALESCE(p.supplier_name, ms.name, 'Proveedor') as supplier_name,
          w.name as warehouse_name,
          w.code as warehouse_code,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as received_by_name
        FROM market_purchases p
        LEFT JOIN market_suppliers ms ON ms.id = p.supplier_id
        LEFT JOIN market_warehouses w ON w.id = p.warehouse_id
        LEFT JOIN users u ON u.id = p.received_by
        WHERE p.id = $1 AND p.company_id = $2 AND p.warehouse_id = $3
      `, [orderIdNum, payload.companyId, warehouseId])

      if (purchaseResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Orden de compra no encontrada'
        }, { status: 404 })
      }

      const purchase = purchaseResult.rows[0]

      // Get purchase lines with product details
      const linesResult = await db.query(`
        SELECT
          pl.id as line_id,
          pl.product_id,
          pl.quantity,
          pl.quantity_received,
          pl.lot_number,
          pl.expiration_date,
          pl.unit_price,
          mp.name as product_name,
          mp.sku,
          mp.barcode
        FROM market_purchase_lines pl
        JOIN market_products mp ON mp.id = pl.product_id
        WHERE pl.purchase_id = $1
        ORDER BY pl.id
      `, [orderIdNum])

      // Get lot inventory entries for this purchase
      const lotInventory = await db.query(`
        SELECT
          pli.lot_number,
          pli.expiration_date,
          pli.quantity_initial,
          pli.quantity_available,
          pli.quantity_sold,
          pli.received_at,
          mp.name as product_name
        FROM purchase_lot_inventory pli
        JOIN market_products mp ON mp.id = pli.product_id
        WHERE pli.purchase_line_id IN (
          SELECT id FROM market_purchase_lines WHERE purchase_id = $1
        )
        ORDER BY pli.received_at DESC
      `, [orderIdNum])

      return NextResponse.json({
        success: true,
        data: {
          orderType: 'purchase',
          order: {
            id: purchase.id,
            orderNumber: purchase.purchase_number,
            status: purchase.status,
            receivedAt: purchase.received_date,
            createdAt: purchase.created_at,
            supplier: {
              id: purchase.supplier_id,
              code: purchase.supplier_code,
              name: purchase.supplier_name
            },
            warehouse: {
              name: purchase.warehouse_name,
              code: purchase.warehouse_code
            },
            receivedBy: purchase.received_by_name
          },
          lines: linesResult.rows.map(line => ({
            lineId: line.line_id,
            productId: line.product_id,
            productName: line.product_name,
            sku: line.sku,
            barcode: line.barcode,
            quantityOrdered: line.quantity,
            quantityReceived: line.quantity_received,
            lotNumber: line.lot_number,
            expirationDate: line.expiration_date,
            unitCost: parseFloat(line.unit_price || '0')
          })),
          lotInventory: lotInventory.rows,
          totals: {
            totalOrdered: linesResult.rows.reduce((sum, l) => sum + (l.quantity || 0), 0),
            totalReceived: linesResult.rows.reduce((sum, l) => sum + (l.quantity_received || 0), 0),
            totalLines: linesResult.rows.length
          }
        }
      })
    } else if (type === 'production') {
      // Get production order details
      const productionResult = await db.query(`
        SELECT
          po.id,
          po.order_number,
          po.status,
          po.completed_at as received_at,
          po.created_at,
          po.target_product_id,
          po.target_variant_id,
          po.target_quantity,
          po.actual_quantity,
          po.lot_number,
          po.expiration_date,
          po.cost_per_unit,
          tp.name as target_product_name,
          tp.sku as target_product_sku,
          tp.barcode as target_product_barcode,
          tv.variant_name as target_variant_name,
          w.name as warehouse_name,
          w.code as warehouse_code,
          COALESCE(u.firstname || ' ' || u.lastname, u.email) as completed_by_name
        FROM market_production_orders po
        LEFT JOIN market_products tp ON tp.id = po.target_product_id
        LEFT JOIN market_product_variants tv ON tv.id = po.target_variant_id
        LEFT JOIN market_warehouses w ON w.id = po.target_warehouse_id
        LEFT JOIN users u ON u.id = po.completed_by
        WHERE po.id = $1 AND po.company_id = $2 AND po.target_warehouse_id = $3
      `, [orderIdNum, payload.companyId, warehouseId])

      if (productionResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Orden de producción no encontrada'
        }, { status: 404 })
      }

      const production = productionResult.rows[0]

      // Get lot inventory entry for this production order
      const lotInventory = await db.query(`
        SELECT
          pli.lot_number,
          pli.expiration_date,
          pli.quantity_initial,
          pli.quantity_available,
          pli.quantity_sold,
          pli.received_at,
          pli.unit_cost,
          mp.name as product_name
        FROM production_lot_inventory pli
        JOIN market_products mp ON mp.id = pli.product_id
        WHERE pli.production_order_id = $1
        ORDER BY pli.received_at DESC
      `, [orderIdNum])

      // Create a single "line" for production
      const lines = [{
        lineId: production.id,
        productId: production.target_product_id,
        productName: production.target_product_name + (production.target_variant_name ? ` - ${production.target_variant_name}` : ''),
        sku: production.target_product_sku,
        barcode: production.target_product_barcode,
        quantityOrdered: parseFloat(production.target_quantity) || 0,
        quantityReceived: parseFloat(production.actual_quantity) || 0,
        lotNumber: production.lot_number,
        expirationDate: production.expiration_date,
        unitCost: parseFloat(production.cost_per_unit) || 0
      }]

      return NextResponse.json({
        success: true,
        data: {
          orderType: 'production',
          order: {
            id: production.id,
            orderNumber: production.order_number,
            status: production.status,
            receivedAt: production.received_at,
            createdAt: production.created_at,
            supplier: {
              id: 0,
              code: 'PROD',
              name: 'Producción Interna'
            },
            warehouse: {
              name: production.warehouse_name,
              code: production.warehouse_code
            },
            receivedBy: production.completed_by_name
          },
          lines,
          lotInventory: lotInventory.rows,
          totals: {
            totalOrdered: parseFloat(production.target_quantity) || 0,
            totalReceived: parseFloat(production.actual_quantity) || 0,
            totalLines: 1
          }
        }
      })
    }

  } catch (error) {
    console.error('[Reception History Detail] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener detalles'
    }, { status: 500 })
  }
}
