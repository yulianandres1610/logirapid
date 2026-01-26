import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/debug/operation-lines?operationId=X
 * Debug endpoint to see raw operation lines data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')
    const showPaintCatalog = searchParams.get('paintCatalog')

    // Show all paint products and their variants
    if (showPaintCatalog) {
      const paintProducts = await db.query(`
        SELECT
          p.id as product_id,
          p.name as product_name,
          v.id as variant_id,
          v.variant_name
        FROM market_products p
        LEFT JOIN market_product_variants v ON v.product_id = p.id
        WHERE p.name ILIKE '%pintura%'
           OR p.name ILIKE '%vinil%'
           OR p.name ILIKE '%esmalte%'
        ORDER BY p.name, v.variant_name NULLS FIRST
      `)
      return NextResponse.json({
        success: true,
        message: 'Paint products catalog',
        products: paintProducts.rows
      })
    }

    // Diagnóstico completo de stock de un producto
    // ?stockDiag=productId&variantId=X&warehouseId=Y
    const stockDiag = searchParams.get('stockDiag')
    if (stockDiag) {
      const productId = parseInt(stockDiag)
      const variantId = searchParams.get('variantId') ? parseInt(searchParams.get('variantId')!) : null
      const warehouseId = searchParams.get('warehouseId') ? parseInt(searchParams.get('warehouseId')!) : null

      // Info del producto
      const productInfo = await db.query(`
        SELECT p.id, p.name, p.sku, p.quantity_on_hand as product_stock,
               v.id as variant_id, v.variant_name, v.sku as variant_sku, v.quantity_on_hand as variant_stock
        FROM market_products p
        LEFT JOIN market_product_variants v ON v.product_id = p.id AND ($2::int IS NULL OR v.id = $2)
        WHERE p.id = $1
      `, [productId, variantId])

      // Stock en market_warehouse_stock (todos los registros)
      let warehouseStockQuery = `
        SELECT ws.*, w.name as warehouse_name
        FROM market_warehouse_stock ws
        JOIN market_warehouses w ON w.id = ws.warehouse_id
        WHERE ws.product_id = $1
      `
      const warehouseStockParams: (number | null)[] = [productId]
      if (variantId) {
        warehouseStockQuery += ` AND (ws.variant_id = $2 OR ws.variant_id IS NULL)`
        warehouseStockParams.push(variantId)
      }
      if (warehouseId) {
        warehouseStockQuery += ` AND ws.warehouse_id = $${warehouseStockParams.length + 1}`
        warehouseStockParams.push(warehouseId)
      }
      warehouseStockQuery += ` ORDER BY w.name, ws.variant_id NULLS FIRST`
      const warehouseStock = await db.query(warehouseStockQuery, warehouseStockParams)

      // Lotes de compra
      let purchaseLotsQuery = `
        SELECT pli.*, w.name as warehouse_name
        FROM purchase_lot_inventory pli
        JOIN market_warehouses w ON w.id = pli.warehouse_id
        WHERE pli.product_id = $1
      `
      const purchaseLotsParams: (number | null)[] = [productId]
      if (variantId) {
        purchaseLotsQuery += ` AND (pli.variant_id = $2 OR pli.variant_id IS NULL)`
        purchaseLotsParams.push(variantId)
      }
      if (warehouseId) {
        purchaseLotsQuery += ` AND pli.warehouse_id = $${purchaseLotsParams.length + 1}`
        purchaseLotsParams.push(warehouseId)
      }
      purchaseLotsQuery += ` ORDER BY pli.received_at DESC`
      const purchaseLots = await db.query(purchaseLotsQuery, purchaseLotsParams)

      // Lotes de consignación
      let consignmentLotsQuery = `
        SELECT cli.*, w.name as warehouse_name, s.name as supplier_name
        FROM consignment_lot_inventory cli
        JOIN market_warehouses w ON w.id = cli.warehouse_id
        LEFT JOIN market_suppliers s ON s.id = cli.supplier_id
        WHERE cli.product_id = $1
      `
      const consignmentLotsParams: (number | null)[] = [productId]
      if (variantId) {
        consignmentLotsQuery += ` AND (cli.variant_id = $2 OR cli.variant_id IS NULL)`
        consignmentLotsParams.push(variantId)
      }
      if (warehouseId) {
        consignmentLotsQuery += ` AND cli.warehouse_id = $${consignmentLotsParams.length + 1}`
        consignmentLotsParams.push(warehouseId)
      }
      consignmentLotsQuery += ` ORDER BY cli.received_at DESC`
      const consignmentLots = await db.query(consignmentLotsQuery, consignmentLotsParams)

      // Movimientos recientes
      let movementsQuery = `
        SELECT m.*, fw.name as from_warehouse, tw.name as to_warehouse
        FROM market_stock_movements m
        LEFT JOIN market_warehouses fw ON fw.id = m.from_warehouse_id
        LEFT JOIN market_warehouses tw ON tw.id = m.to_warehouse_id
        WHERE m.product_id = $1
      `
      const movementsParams: (number | null)[] = [productId]
      if (variantId) {
        movementsQuery += ` AND (m.variant_id = $2 OR m.variant_id IS NULL)`
        movementsParams.push(variantId)
      }
      if (warehouseId) {
        movementsQuery += ` AND (m.from_warehouse_id = $${movementsParams.length + 1} OR m.to_warehouse_id = $${movementsParams.length + 1})`
        movementsParams.push(warehouseId)
      }
      movementsQuery += ` ORDER BY m.created_at DESC LIMIT 20`
      const movements = await db.query(movementsQuery, movementsParams)

      // Calcular totales
      const totalWarehouseStock = warehouseStock.rows.reduce((sum, r) => sum + (parseFloat(r.quantity_on_hand) || 0), 0)
      const totalPurchaseLots = purchaseLots.rows.reduce((sum, r) => sum + (parseFloat(r.quantity_available) || 0), 0)
      const totalConsignmentLots = consignmentLots.rows.reduce((sum, r) => sum + (parseFloat(r.quantity_available) || 0), 0)

      return NextResponse.json({
        success: true,
        message: 'Diagnóstico de stock',
        product: productInfo.rows,
        summary: {
          totalWarehouseStock,
          totalPurchaseLots,
          totalConsignmentLots,
          totalLots: totalPurchaseLots + totalConsignmentLots
        },
        warehouseStock: warehouseStock.rows,
        purchaseLots: purchaseLots.rows,
        consignmentLots: consignmentLots.rows,
        recentMovements: movements.rows
      })
    }

    // Show stock movements for an operation
    const showMovements = searchParams.get('movements')
    if (showMovements) {
      const movements = await db.query(`
        SELECT
          m.id,
          m.movement_type,
          m.product_id,
          m.variant_id,
          p.name as product_name,
          v.variant_name,
          m.quantity,
          m.stock_before,
          m.stock_after,
          m.reference_number,
          m.created_at
        FROM market_stock_movements m
        JOIN market_products p ON p.id = m.product_id
        LEFT JOIN market_product_variants v ON v.id = m.variant_id
        WHERE m.reference_number LIKE '%' || $1 || '%'
           OR m.operation_id = $1::int
        ORDER BY m.created_at DESC
      `, [showMovements])
      return NextResponse.json({
        success: true,
        message: 'Stock movements for operation',
        movements: movements.rows
      })
    }

    // Show reserved stock in a warehouse
    const showReserved = searchParams.get('reserved')
    if (showReserved) {
      const reserved = await db.query(`
        SELECT
          ws.product_id,
          ws.variant_id,
          p.name as product_name,
          v.variant_name,
          ws.quantity_on_hand,
          ws.quantity_reserved
        FROM market_warehouse_stock ws
        JOIN market_products p ON p.id = ws.product_id
        LEFT JOIN market_product_variants v ON v.id = ws.variant_id
        WHERE ws.warehouse_id = $1
          AND ws.quantity_reserved > 0
        ORDER BY p.name, v.variant_name NULLS FIRST
      `, [showReserved])
      return NextResponse.json({
        success: true,
        message: 'Reserved stock in warehouse',
        warehouseId: parseInt(showReserved),
        reserved: reserved.rows
      })
    }

    if (!operationId) {
      // Get recent operations
      const ops = await db.query(`
        SELECT id, operation_number, operation_type, status, validation_status,
               source_warehouse_id, destination_warehouse_id, created_at
        FROM market_warehouse_operations
        WHERE operation_type = 'internal'
        ORDER BY created_at DESC
        LIMIT 10
      `)
      return NextResponse.json({
        success: true,
        message: 'Provide ?operationId=X to see lines',
        recentOperations: ops.rows
      })
    }

    // Get all lines for this operation (raw, not grouped)
    const lines = await db.query(`
      SELECT
        l.id as line_id,
        l.product_id,
        l.variant_id,
        p.name as product_name,
        v.variant_name,
        l.quantity_planned,
        l.quantity_validated,
        l.line_status
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      LEFT JOIN market_product_variants v ON v.id = l.variant_id
      WHERE l.operation_id = $1
      ORDER BY l.id
    `, [operationId])

    // Get grouped view
    const grouped = await db.query(`
      SELECT
        l.product_id,
        l.variant_id,
        p.name as product_name,
        v.variant_name,
        COUNT(*) as line_count,
        SUM(l.quantity_planned) as total_planned,
        SUM(COALESCE(l.quantity_validated, 0)) as total_validated
      FROM market_warehouse_operation_lines l
      JOIN market_products p ON p.id = l.product_id
      LEFT JOIN market_product_variants v ON v.id = l.variant_id
      WHERE l.operation_id = $1
      GROUP BY l.product_id, l.variant_id, p.name, v.variant_name
      ORDER BY p.name, v.variant_name NULLS FIRST
    `, [operationId])

    return NextResponse.json({
      success: true,
      operationId: parseInt(operationId),
      totalLines: lines.rows.length,
      rawLines: lines.rows,
      groupedLines: grouped.rows
    })

  } catch (error) {
    console.error('[Debug] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
