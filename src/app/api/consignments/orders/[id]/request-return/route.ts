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

interface RequestReturnLine {
  orderLineId: number
  warehouseId: number
  quantity: number
}

/**
 * POST /api/consignments/orders/[id]/request-return
 * Create a pending supplier return request from consignment order
 * This creates a return in 'pending' status for warehouse staff to process
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
    const orderId = parseInt(id)
    const { reason, notes, lines } = await request.json() as {
      reason: 'not_sold' | 'damaged' | 'expired' | 'agreement' | 'other'
      notes?: string
      lines: RequestReturnLine[]
    }

    if (!lines || lines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Debe seleccionar al menos un producto'
      }, { status: 400 })
    }

    // Verify order exists and belongs to company
    const orderResult = await db.query(`
      SELECT
        o.*,
        s.company_id,
        s.id as supplier_id,
        s.name as supplier_name,
        s.supplier_code
      FROM consignment_orders o
      JOIN market_suppliers s ON s.id = o.supplier_id
      WHERE o.id = $1 AND o.company_id = $2
    `, [orderId, payload.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Check order status - must be received or selling
    if (!['received', 'selling', 'paid'].includes(order.status)) {
      return NextResponse.json({
        success: false,
        error: 'Solo se pueden solicitar devoluciones de órdenes recibidas o en venta'
      }, { status: 400 })
    }

    // Validate each line has stock available in the specified warehouse
    let totalUnits = 0
    let totalValue = 0
    const validatedLines: Array<{
      orderLineId: number
      warehouseId: number
      productId: number
      quantity: number
      unitCost: number
      lotInventoryId: number | null
    }> = []

    for (const line of lines) {
      if (line.quantity <= 0) continue

      // Get order line info
      const lineResult = await db.query(`
        SELECT
          ol.id,
          ol.product_id,
          ol.unit_cost
        FROM consignment_order_lines ol
        WHERE ol.id = $1 AND ol.order_id = $2
      `, [line.orderLineId, orderId])

      if (lineResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: `Línea de producto ${line.orderLineId} no encontrada`
        }, { status: 400 })
      }

      const orderLine = lineResult.rows[0]

      // Get warehouse ID - use provided or default to order's warehouse
      const warehouseId = line.warehouseId || order.warehouse_id

      // Find lot inventory for this product in the specified warehouse
      const lotResult = await db.query(`
        SELECT id, quantity_available
        FROM consignment_lot_inventory
        WHERE warehouse_id = $1 AND product_id = $2 AND order_line_id = $3
          AND quantity_available > 0
        LIMIT 1
      `, [warehouseId, orderLine.product_id, line.orderLineId])

      if (lotResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: `No hay stock disponible en el almacén seleccionado para el producto`
        }, { status: 400 })
      }

      const lotInventory = lotResult.rows[0]
      const availableInLot = parseInt(lotInventory.quantity_available) || 0

      // Check for pending returns for this same order line
      const pendingReturnsResult = await db.query(`
        SELECT COALESCE(SUM(rl.quantity_to_return), 0) as pending_qty
        FROM consignment_return_lines rl
        JOIN consignment_returns r ON r.id = rl.return_id
        WHERE rl.order_line_id = $1
          AND rl.lot_inventory_id = $2
          AND r.status = 'pending'
      `, [line.orderLineId, lotInventory.id])

      const pendingQty = parseInt(pendingReturnsResult.rows[0]?.pending_qty) || 0
      const available = availableInLot - pendingQty

      if (available <= 0) {
        return NextResponse.json({
          success: false,
          error: `Ya existe una devolución pendiente para este producto. Complete o cancele la devolución pendiente primero.`
        }, { status: 400 })
      }

      if (line.quantity > available) {
        return NextResponse.json({
          success: false,
          error: `Cantidad solicitada (${line.quantity}) excede disponible (${available}) en el almacén (${pendingQty} unidades en devolución pendiente)`
        }, { status: 400 })
      }

      validatedLines.push({
        orderLineId: line.orderLineId,
        warehouseId,
        productId: orderLine.product_id,
        quantity: line.quantity,
        unitCost: parseFloat(orderLine.unit_cost),
        lotInventoryId: lotInventory.id
      })

      totalUnits += line.quantity
      totalValue += line.quantity * parseFloat(orderLine.unit_cost)
    }

    if (validatedLines.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay productos válidos para devolver'
      }, { status: 400 })
    }

    // Get unique warehouse from lines (for now we support one warehouse per return)
    const targetWarehouseId = validatedLines[0].warehouseId

    // Generate return number
    const year = new Date().getFullYear()
    const seqResult = await db.query(`
      SELECT COUNT(*) as count
      FROM consignment_returns
      WHERE EXTRACT(YEAR FROM created_at) = $1
    `, [year])
    const seq = (parseInt(seqResult.rows[0].count) + 1).toString().padStart(4, '0')
    const returnNumber = `DEV-SUPP-${year}-${seq}`

    // Create return with status 'pending'
    const insertResult = await db.query(`
      INSERT INTO consignment_returns (
        return_number, order_id, supplier_id, warehouse_id, company_id, status,
        total_items, total_units, total_value, reason, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11)
      RETURNING id, return_number
    `, [
      returnNumber,
      orderId,
      order.supplier_id,
      targetWarehouseId,
      payload.companyId,
      validatedLines.length,
      totalUnits,
      totalValue,
      reason || 'not_sold',
      notes || null,
      payload.userId
    ])

    const returnId = insertResult.rows[0].id

    // Create return lines
    for (const line of validatedLines) {
      await db.query(`
        INSERT INTO consignment_return_lines (
          return_id, order_line_id, lot_inventory_id, product_id,
          quantity_to_return, unit_cost
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        returnId,
        line.orderLineId,
        line.lotInventoryId,
        line.productId,
        line.quantity,
        line.unitCost
      ])
    }

    return NextResponse.json({
      success: true,
      message: 'Solicitud de devolución creada exitosamente',
      data: {
        returnId,
        returnNumber,
        status: 'pending',
        totalUnits,
        totalValue,
        supplierName: order.supplier_name
      }
    })

  } catch (error) {
    console.error('[Request Return] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al crear solicitud de devolución'
    }, { status: 500 })
  }
}

/**
 * GET /api/consignments/orders/[id]/request-return
 * Get available stock per warehouse for return request
 * Returns products with quantity available in each warehouse
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
    const orderId = parseInt(id)

    // Verify order exists and belongs to company
    const orderResult = await db.query(`
      SELECT
        o.id, o.order_number, o.warehouse_id,
        s.id as supplier_id, s.name as supplier_name
      FROM consignment_orders o
      JOIN market_suppliers s ON s.id = o.supplier_id
      WHERE o.id = $1 AND o.company_id = $2
    `, [orderId, payload.companyId])

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 })
    }

    const order = orderResult.rows[0]

    // Get all order lines with product info
    const linesResult = await db.query(`
      SELECT
        ol.id as order_line_id,
        ol.product_id,
        ol.unit_cost,
        p.name as product_name,
        p.sku as product_sku,
        p.barcode as product_barcode,
        p.image_url
      FROM consignment_order_lines ol
      JOIN market_products p ON p.id = ol.product_id
      WHERE ol.order_id = $1
    `, [orderId])

    // Get available stock per warehouse for each order line
    const productsWithStock: Array<{
      orderLineId: number
      productId: number
      productName: string
      productSku: string
      imageUrl: string | null
      unitCost: number
      warehouses: Array<{
        warehouseId: number
        warehouseName: string
        warehouseCode: string
        quantityAvailable: number
      }>
    }> = []

    for (const line of linesResult.rows) {
      // Get available stock in each warehouse from lot inventory
      // Subtract any pending returns from the available quantity
      const stockResult = await db.query(`
        SELECT
          li.id as lot_id,
          li.warehouse_id,
          li.quantity_available,
          w.name as warehouse_name,
          w.code as warehouse_code,
          COALESCE((
            SELECT SUM(rl.quantity_to_return)
            FROM consignment_return_lines rl
            JOIN consignment_returns r ON r.id = rl.return_id
            WHERE rl.lot_inventory_id = li.id
              AND r.status = 'pending'
          ), 0) as pending_returns
        FROM consignment_lot_inventory li
        JOIN market_warehouses w ON w.id = li.warehouse_id
        WHERE li.order_line_id = $1
          AND li.quantity_available > 0
        ORDER BY w.name
      `, [line.order_line_id])

      // Filter warehouses that have available stock after subtracting pending returns
      const warehousesWithStock = stockResult.rows
        .map(w => {
          const available = parseInt(w.quantity_available) || 0
          const pending = parseInt(w.pending_returns) || 0
          const realAvailable = available - pending
          return {
            warehouseId: w.warehouse_id,
            warehouseName: w.warehouse_name,
            warehouseCode: w.warehouse_code,
            quantityAvailable: realAvailable,
            pendingReturns: pending
          }
        })
        .filter(w => w.quantityAvailable > 0)

      // Only include products that have stock somewhere
      if (warehousesWithStock.length > 0) {
        productsWithStock.push({
          orderLineId: line.order_line_id,
          productId: line.product_id,
          productName: line.product_name,
          productSku: line.product_sku,
          imageUrl: line.image_url,
          unitCost: parseFloat(line.unit_cost),
          warehouses: warehousesWithStock
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        supplier: {
          id: order.supplier_id,
          name: order.supplier_name
        },
        products: productsWithStock
      }
    })

  } catch (error) {
    console.error('[Request Return GET] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener productos para devolución'
    }, { status: 500 })
  }
}
