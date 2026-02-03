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

interface OrderLine {
  lineId: number
  productId: number
  productName: string
  sku: string
  barcode: string | null
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  variantBarcode: string | null
  quantityOrdered: number
  quantityReceived: number
  quantityPending: number
  unitCost: number
}

interface DetectedOrder {
  orderType: 'consignment' | 'purchase' | 'production' | 'production_delivery'
  orderId: number
  orderNumber: string
  supplier: {
    id: number
    code: string
    name: string
  }
  warehouseId: number
  lines: OrderLine[]
  // Production-specific fields
  lotNumber?: string
  expirationDate?: string
  costPerUnit?: number
}

/**
 * GET /api/market/warehouses/[id]/detect-order?code=CONS-2025-0001
 * Detecta si el codigo es una consignacion o compra y retorna productos pendientes
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
    const warehouseId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')?.trim().toUpperCase()

    if (!code) {
      return NextResponse.json({
        success: false,
        error: 'El codigo de orden es requerido'
      }, { status: 400 })
    }

    // Verify warehouse belongs to company
    const warehouseResult = await db.query(`
      SELECT id, name, code FROM market_warehouses
      WHERE id = $1 AND company_id = $2
    `, [warehouseId, payload.companyId])

    if (warehouseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Almacen no encontrado'
      }, { status: 404 })
    }

    let detectedOrder: DetectedOrder | null = null

    // Try to detect consignment order (CONS-YYYY-XXXX)
    if (code.startsWith('CONS-') || !code.startsWith('PUR-')) {
      const consignmentResult = await db.query(`
        SELECT
          o.id, o.order_number, o.status, o.warehouse_id, o.validation_status,
          s.id as supplier_id, s.supplier_code as supplier_code, s.name as supplier_name
        FROM consignment_orders o
        JOIN market_suppliers s ON s.id = o.supplier_id
        WHERE (o.order_number = $1 OR o.order_number ILIKE $2)
          AND o.company_id = $3
          AND o.status IN ('pending', 'partial')
      `, [code, `%${code}%`, payload.companyId])

      if (consignmentResult.rows.length > 0) {
        const order = consignmentResult.rows[0]

        // Check if order is pending validation - cannot receive until approved
        if (order.validation_status === 'pending_validation') {
          return NextResponse.json({
            success: false,
            error: 'Esta consignación está pendiente de aprobación. Debe ser aprobada antes de poder recibirla.'
          }, { status: 400 })
        }

        // Check if order is for this warehouse or can be received here
        if (order.warehouse_id && order.warehouse_id !== warehouseId) {
          return NextResponse.json({
            success: false,
            error: `Esta orden es para el almacen con ID ${order.warehouse_id}, no para este almacen`
          }, { status: 400 })
        }

        // Get order lines with pending quantities (including variant info)
        const linesResult = await db.query(`
          SELECT
            col.id as line_id,
            col.product_id,
            col.variant_id,
            col.quantity_ordered,
            COALESCE(col.quantity_received, 0) as quantity_received,
            col.unit_cost,
            mp.name as product_name,
            mp.sku,
            mp.barcode,
            v.variant_name,
            v.sku as variant_sku,
            v.barcode as variant_barcode
          FROM consignment_order_lines col
          JOIN market_products mp ON mp.id = col.product_id
          LEFT JOIN market_product_variants v ON v.id = col.variant_id
          WHERE col.order_id = $1
            AND col.quantity_ordered > COALESCE(col.quantity_received, 0)
        `, [order.id])

        const lines: OrderLine[] = linesResult.rows.map(row => ({
          lineId: row.line_id,
          productId: row.product_id,
          productName: row.product_name,
          sku: row.sku,
          barcode: row.barcode,
          variantId: row.variant_id || null,
          variantName: row.variant_name || null,
          variantSku: row.variant_sku || null,
          variantBarcode: row.variant_barcode || null,
          quantityOrdered: parseFloat(row.quantity_ordered),
          quantityReceived: parseFloat(row.quantity_received),
          quantityPending: parseFloat(row.quantity_ordered) - parseFloat(row.quantity_received),
          unitCost: parseFloat(row.unit_cost)
        }))

        if (lines.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Esta orden ya fue recibida completamente'
          }, { status: 400 })
        }

        detectedOrder = {
          orderType: 'consignment',
          orderId: order.id,
          orderNumber: order.order_number,
          supplier: {
            id: order.supplier_id,
            code: order.supplier_code,
            name: order.supplier_name
          },
          warehouseId: order.warehouse_id || warehouseId,
          lines
        }
      }
    }

    // Try to detect purchase order (PUR-YYYY-XXXX) if no consignment found
    if (!detectedOrder && (code.startsWith('PUR-') || !code.startsWith('CONS-'))) {
      const purchaseResult = await db.query(`
        SELECT
          p.id, p.purchase_number, p.status, p.warehouse_id, p.validation_status,
          p.supplier_id, p.supplier_name,
          ms.supplier_code
        FROM market_purchases p
        LEFT JOIN market_suppliers ms ON ms.id = p.supplier_id
        WHERE (p.purchase_number = $1 OR p.purchase_number ILIKE $2)
          AND p.company_id = $3
          AND p.status IN ('comprada', 'pendiente')
      `, [code, `%${code}%`, payload.companyId])

      if (purchaseResult.rows.length > 0) {
        const purchase = purchaseResult.rows[0]

        // Check if purchase is pending validation - cannot receive until approved
        if (purchase.validation_status === 'pending_validation') {
          return NextResponse.json({
            success: false,
            error: 'Esta compra está pendiente de aprobación. Debe ser aprobada antes de poder recibirla.'
          }, { status: 400 })
        }

        // Check if purchase is for this warehouse
        if (purchase.warehouse_id && purchase.warehouse_id !== warehouseId) {
          return NextResponse.json({
            success: false,
            error: `Esta compra es para el almacen con ID ${purchase.warehouse_id}, no para este almacen`
          }, { status: 400 })
        }

        // Get purchase lines with pending quantities (including variant info)
        const linesResult = await db.query(`
          SELECT
            pl.id as line_id,
            pl.product_id,
            pl.variant_id,
            pl.quantity,
            COALESCE(pl.quantity_received, 0) as quantity_received,
            pl.unit_price as unit_cost,
            mp.name as product_name,
            mp.sku,
            mp.barcode,
            v.variant_name,
            v.sku as variant_sku,
            v.barcode as variant_barcode
          FROM market_purchase_lines pl
          JOIN market_products mp ON mp.id = pl.product_id
          LEFT JOIN market_product_variants v ON v.id = pl.variant_id
          WHERE pl.purchase_id = $1
            AND pl.quantity > COALESCE(pl.quantity_received, 0)
        `, [purchase.id])

        const lines: OrderLine[] = linesResult.rows.map(row => ({
          lineId: row.line_id,
          productId: row.product_id,
          productName: row.product_name,
          sku: row.sku,
          barcode: row.barcode,
          variantId: row.variant_id || null,
          variantName: row.variant_name || null,
          variantSku: row.variant_sku || null,
          variantBarcode: row.variant_barcode || null,
          quantityOrdered: parseFloat(row.quantity),
          quantityReceived: parseFloat(row.quantity_received),
          quantityPending: parseFloat(row.quantity) - parseFloat(row.quantity_received),
          unitCost: parseFloat(row.unit_cost)
        }))

        if (lines.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'Esta compra ya fue recibida completamente'
          }, { status: 400 })
        }

        detectedOrder = {
          orderType: 'purchase',
          orderId: purchase.id,
          orderNumber: purchase.purchase_number,
          supplier: {
            id: purchase.supplier_id || 0,
            code: purchase.supplier_code || 'PROV',
            name: purchase.supplier_name || 'Proveedor'
          },
          warehouseId: purchase.warehouse_id || warehouseId,
          lines
        }
      }
    }

    // Try to detect production order (PRD-YYYY-XXXX)
    // Can be either pending (for material delivery) or in_progress (for reception)
    if (!detectedOrder && (code.startsWith('PRD-') || code.startsWith('PROD-'))) {
      const productionResult = await db.query(`
        SELECT
          po.id, po.order_number, po.status,
          po.source_warehouse_id, po.target_warehouse_id,
          po.source_product_id, po.source_variant_id, po.source_quantity,
          po.source_weight_kg, po.source_unit_cost,
          po.target_product_id, po.target_variant_id, po.target_quantity,
          po.actual_quantity, po.lot_number, po.expiration_date,
          po.cost_per_unit,
          sp.name as source_product_name,
          sp.sku as source_product_sku,
          sp.barcode as source_product_barcode,
          sv.variant_name as source_variant_name,
          sv.sku as source_variant_sku,
          sv.barcode as source_variant_barcode,
          tp.name as target_product_name,
          tp.sku as target_product_sku,
          tp.barcode as target_product_barcode,
          tp.image_url as target_product_image,
          tv.variant_name as target_variant_name,
          tv.sku as target_variant_sku,
          tv.barcode as target_variant_barcode
        FROM market_production_orders po
        LEFT JOIN market_products sp ON po.source_product_id = sp.id
        LEFT JOIN market_product_variants sv ON po.source_variant_id = sv.id
        LEFT JOIN market_products tp ON po.target_product_id = tp.id
        LEFT JOIN market_product_variants tv ON po.target_variant_id = tv.id
        WHERE (po.order_number = $1 OR po.order_number ILIKE $2)
          AND po.company_id = $3
          AND po.status IN ('pending', 'in_progress')
      `, [code, `%${code}%`, payload.companyId])

      if (productionResult.rows.length > 0) {
        const order = productionResult.rows[0]

        if (order.status === 'pending') {
          // DELIVERY MODE: Validate warehouse is the source warehouse
          if (order.source_warehouse_id && order.source_warehouse_id !== warehouseId) {
            return NextResponse.json({
              success: false,
              error: `Los materiales deben entregarse desde el almacén de origen (ID ${order.source_warehouse_id})`
            }, { status: 400 })
          }

          // Get materials for this production order
          const materialsResult = await db.query(`
            SELECT
              pm.id, pm.product_id, pm.variant_id, pm.quantity, pm.warehouse_id,
              p.name as product_name, p.sku, p.barcode,
              v.variant_name, v.sku as variant_sku, v.barcode as variant_barcode
            FROM market_production_materials pm
            LEFT JOIN market_products p ON pm.product_id = p.id
            LEFT JOIN market_product_variants v ON pm.variant_id = v.id
            WHERE pm.production_order_id = $1
          `, [order.id])

          // Build lines: first the source product, then materials
          const lines: OrderLine[] = []

          // Add source product (raw material)
          lines.push({
            lineId: -1, // Special ID for source product
            productId: order.source_product_id,
            productName: order.source_product_name,
            sku: order.source_product_sku || '',
            barcode: order.source_product_barcode || null,
            variantId: order.source_variant_id || null,
            variantName: order.source_variant_name || null,
            variantSku: order.source_variant_sku || null,
            variantBarcode: order.source_variant_barcode || null,
            quantityOrdered: parseFloat(order.source_quantity) || 1,
            quantityReceived: 0,
            quantityPending: parseFloat(order.source_quantity) || 1,
            unitCost: parseFloat(order.source_unit_cost) || 0
          })

          // Add materials
          for (const mat of materialsResult.rows) {
            lines.push({
              lineId: mat.id,
              productId: mat.product_id,
              productName: mat.product_name,
              sku: mat.sku || '',
              barcode: mat.barcode || null,
              variantId: mat.variant_id || null,
              variantName: mat.variant_name || null,
              variantSku: mat.variant_sku || null,
              variantBarcode: mat.variant_barcode || null,
              quantityOrdered: parseFloat(mat.quantity),
              quantityReceived: 0,
              quantityPending: parseFloat(mat.quantity),
              unitCost: 0
            })
          }

          detectedOrder = {
            orderType: 'production_delivery',
            orderId: order.id,
            orderNumber: order.order_number,
            supplier: {
              id: 0,
              code: 'PROD',
              name: 'Producción - Entrega de Materiales'
            },
            warehouseId: order.source_warehouse_id || warehouseId,
            lines
          }
        } else if (order.status === 'in_progress') {
          // RECEPTION MODE: Validate warehouse is the target warehouse
          if (order.target_warehouse_id && order.target_warehouse_id !== warehouseId) {
            return NextResponse.json({
              success: false,
              error: `Esta orden de producción es para el almacén con ID ${order.target_warehouse_id}, no para este almacén`
            }, { status: 400 })
          }

          // Check if already received
          if (order.actual_quantity !== null && order.actual_quantity > 0) {
            return NextResponse.json({
              success: false,
              error: 'Esta orden de producción ya fue recibida'
            }, { status: 400 })
          }

          // For production reception, we have a single "line" which is the target product
          const lines: OrderLine[] = [{
            lineId: order.id, // Use order id as line id for production
            productId: order.target_product_id,
            productName: order.target_product_name,
            sku: order.target_product_sku || '',
            barcode: order.target_product_barcode || null,
            variantId: order.target_variant_id || null,
            variantName: order.target_variant_name || null,
            variantSku: order.target_variant_sku || null,
            variantBarcode: order.target_variant_barcode || null,
            quantityOrdered: order.target_quantity,
            quantityReceived: 0,
            quantityPending: order.target_quantity,
            unitCost: parseFloat(order.cost_per_unit) || 0
          }]

          detectedOrder = {
            orderType: 'production',
            orderId: order.id,
            orderNumber: order.order_number,
            supplier: {
              id: 0,
              code: 'PROD',
              name: 'Producción Interna'
            },
            warehouseId: order.target_warehouse_id || warehouseId,
            lines,
            lotNumber: order.lot_number || undefined,
            expirationDate: order.expiration_date || undefined,
            costPerUnit: parseFloat(order.cost_per_unit) || 0
          }
        }
      }
    }

    if (!detectedOrder) {
      return NextResponse.json({
        success: false,
        error: `No se encontro una orden pendiente con el codigo: ${code}`
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: detectedOrder
    })

  } catch (error) {
    console.error('[Detect Order] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al detectar orden'
    }, { status: 500 })
  }
}
