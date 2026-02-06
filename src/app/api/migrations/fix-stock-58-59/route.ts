import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-stock-58-59
 * Corrige el stock de los productos 58 y 59
 *
 * Producto 59 (sopas): 11 en tienda, 74 en Infanta
 * Producto 58 (crema de champiñones): 7 en tienda, 83 en Infanta
 */
export async function GET() {
  try {
    const results: string[] = []

    // Definir las correcciones
    const corrections = [
      { productId: 59, warehouseName: 'tienda', newStock: 11 },
      { productId: 59, warehouseName: 'infanta', newStock: 74 },
      { productId: 58, warehouseName: 'tienda', newStock: 7 },
      { productId: 58, warehouseName: 'infanta', newStock: 83 },
    ]

    for (const fix of corrections) {
      // Obtener info del producto
      const productResult = await db.query(`
        SELECT id, name, company_id FROM market_products WHERE id = $1
      `, [fix.productId])

      if (productResult.rows.length === 0) {
        results.push(`ERROR: Producto ${fix.productId} no encontrado`)
        continue
      }

      const product = productResult.rows[0]

      // Buscar el almacén por nombre
      const warehouseResult = await db.query(`
        SELECT id, name FROM market_warehouses
        WHERE company_id = $1 AND LOWER(name) LIKE LOWER($2)
        LIMIT 1
      `, [product.company_id, `%${fix.warehouseName}%`])

      if (warehouseResult.rows.length === 0) {
        results.push(`ERROR: Almacén "${fix.warehouseName}" no encontrado para producto ${fix.productId}`)
        continue
      }

      const warehouse = warehouseResult.rows[0]

      // Obtener stock actual
      const currentStockResult = await db.query(`
        SELECT id, quantity_on_hand FROM market_warehouse_stock
        WHERE product_id = $1 AND warehouse_id = $2 AND variant_id IS NULL
      `, [fix.productId, warehouse.id])

      const currentStock = parseFloat(currentStockResult.rows[0]?.quantity_on_hand) || 0
      const stockId = currentStockResult.rows[0]?.id

      if (currentStock === fix.newStock) {
        results.push(`OK: ${product.name} @ ${warehouse.name}: ya tiene ${fix.newStock} unidades`)
        continue
      }

      // Actualizar o insertar stock
      if (stockId) {
        await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = $1, updated_at = NOW(), last_movement_at = NOW()
          WHERE id = $2
        `, [fix.newStock, stockId])
      } else {
        await db.query(`
          INSERT INTO market_warehouse_stock (
            warehouse_id, product_id, variant_id, quantity_on_hand,
            quantity_reserved, created_at, updated_at, last_movement_at
          ) VALUES ($1, $2, NULL, $3, 0, NOW(), NOW(), NOW())
        `, [warehouse.id, fix.productId, fix.newStock])
      }

      // Crear registro de ajuste
      const operationNumber = `FIX-STOCK-${Date.now()}-${fix.productId}`
      await db.query(`
        INSERT INTO market_warehouse_operations (
          company_id, operation_number, operation_type, status,
          source_warehouse_id, notes, created_at, completed_at
        ) VALUES ($1, $2, 'adjustment', 'done', $3, $4, NOW(), NOW())
      `, [
        product.company_id,
        operationNumber,
        warehouse.id,
        `Corrección de stock automática: ${currentStock} -> ${fix.newStock}. Discrepancia física detectada.`
      ])

      results.push(`CORREGIDO: ${product.name} @ ${warehouse.name}: ${currentStock} -> ${fix.newStock}`)
    }

    // Actualizar totales de productos
    for (const productId of [58, 59]) {
      const totalResult = await db.query(`
        SELECT COALESCE(SUM(quantity_on_hand), 0) as total
        FROM market_warehouse_stock
        WHERE product_id = $1 AND variant_id IS NULL
      `, [productId])

      const total = parseFloat(totalResult.rows[0]?.total) || 0

      await db.query(`
        UPDATE market_products
        SET quantity_on_hand = $1, updated_at = NOW()
        WHERE id = $2
      `, [total, productId])

      results.push(`TOTAL: Producto ${productId} actualizado a ${total} unidades`)
    }

    return NextResponse.json({
      success: true,
      message: 'Stock corregido',
      results
    })

  } catch (error) {
    console.error('[Fix Stock 58-59] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
