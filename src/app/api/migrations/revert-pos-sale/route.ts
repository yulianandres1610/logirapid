import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/revert-pos-sale
 * Revert a POS sale - return quantity to inventory
 * Query params: productName, quantity (default 1), warehouseId (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productName = searchParams.get('productName')
    const quantity = parseFloat(searchParams.get('quantity') || '1')
    const warehouseId = searchParams.get('warehouseId')

    if (!productName) {
      return NextResponse.json({
        success: false,
        error: 'productName is required'
      }, { status: 400 })
    }

    console.log(`[Revert POS Sale] Looking for product: ${productName}`)

    // Find the product
    const productResult = await db.query(`
      SELECT id, name, sku, quantity_on_hand, company_id
      FROM market_products
      WHERE LOWER(name) LIKE LOWER($1)
      LIMIT 1
    `, [`%${productName}%`])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Product "${productName}" not found`
      }, { status: 404 })
    }

    const product = productResult.rows[0]
    console.log(`[Revert POS Sale] Found product:`, product)

    // Find the most recent POS order line for this product
    const orderLineResult = await db.query(`
      SELECT
        pol.id as line_id,
        pol.order_id,
        pol.quantity,
        pol.unit_price,
        po.order_number,
        po.warehouse_id,
        po.created_at
      FROM market_pos_order_lines pol
      JOIN market_pos_orders po ON po.id = pol.order_id
      WHERE pol.product_id = $1
      ORDER BY po.created_at DESC
      LIMIT 1
    `, [product.id])

    const recentOrder = orderLineResult.rows[0]
    const targetWarehouseId = warehouseId ? parseInt(warehouseId) : recentOrder?.warehouse_id

    await db.query('BEGIN')

    try {
      const quantityBefore = parseFloat(product.quantity_on_hand) || 0
      const quantityAfter = quantityBefore + quantity

      // 1. Update main product stock
      await db.query(`
        UPDATE market_products
        SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
        WHERE id = $2
      `, [quantity, product.id])

      console.log(`[Revert POS Sale] Updated product stock: ${quantityBefore} -> ${quantityAfter}`)

      // 2. Update warehouse stock if we have a warehouse
      if (targetWarehouseId) {
        const warehouseStockResult = await db.query(`
          UPDATE market_warehouse_stock
          SET quantity_on_hand = quantity_on_hand + $1, updated_at = NOW()
          WHERE product_id = $2 AND warehouse_id = $3 AND variant_id IS NULL
          RETURNING quantity_on_hand
        `, [quantity, product.id, targetWarehouseId])

        if (warehouseStockResult.rows.length > 0) {
          console.log(`[Revert POS Sale] Updated warehouse stock: ${warehouseStockResult.rows[0].quantity_on_hand}`)
        } else {
          // Create warehouse stock if it doesn't exist
          await db.query(`
            INSERT INTO market_warehouse_stock (warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved, created_at)
            VALUES ($1, $2, NULL, $3, 0, NOW())
          `, [targetWarehouseId, product.id, quantity])
          console.log(`[Revert POS Sale] Created warehouse stock record`)
        }
      }

      // 3. Record the inventory adjustment
      await db.query(`
        INSERT INTO market_inventory_movements (
          product_id, company_id, movement_type, quantity,
          quantity_before, quantity_after, reference_type, notes, created_at
        ) VALUES ($1, $2, 'adjustment_in', $3, $4, $5, 'manual_revert', $6, NOW())
      `, [
        product.id,
        product.company_id,
        quantity,
        quantityBefore,
        quantityAfter,
        `Reversión de venta POS accidental${recentOrder ? ` - Orden: ${recentOrder.order_number}` : ''}`
      ])

      await db.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: `Reverted ${quantity} unit(s) of "${product.name}" back to inventory`,
        data: {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantityReverted: quantity,
          stockBefore: quantityBefore,
          stockAfter: quantityAfter,
          warehouseId: targetWarehouseId,
          recentOrder: recentOrder ? {
            orderNumber: recentOrder.order_number,
            quantity: recentOrder.quantity,
            createdAt: recentOrder.created_at
          } : null
        }
      })

    } catch (txError) {
      await db.query('ROLLBACK')
      throw txError
    }

  } catch (error) {
    console.error('[Revert POS Sale] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error reverting sale'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/revert-pos-sale
 * Preview - find product and recent orders
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productName = searchParams.get('productName')

    if (!productName) {
      return NextResponse.json({
        success: false,
        error: 'productName is required'
      }, { status: 400 })
    }

    // Find the product
    const productResult = await db.query(`
      SELECT id, name, sku, quantity_on_hand
      FROM market_products
      WHERE LOWER(name) LIKE LOWER($1)
      LIMIT 5
    `, [`%${productName}%`])

    if (productResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No products found matching "${productName}"`
      }, { status: 404 })
    }

    const products = productResult.rows

    // Get recent orders for first matching product
    const recentOrdersResult = await db.query(`
      SELECT
        pol.quantity,
        pol.unit_price,
        po.order_number,
        po.warehouse_id,
        mw.name as warehouse_name,
        po.created_at
      FROM market_pos_order_lines pol
      JOIN market_pos_orders po ON po.id = pol.order_id
      LEFT JOIN market_warehouses mw ON mw.id = po.warehouse_id
      WHERE pol.product_id = $1
      ORDER BY po.created_at DESC
      LIMIT 5
    `, [products[0].id])

    return NextResponse.json({
      success: true,
      message: 'DRY RUN - Use POST to execute',
      data: {
        matchingProducts: products.map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          currentStock: parseFloat(p.quantity_on_hand) || 0
        })),
        recentOrders: recentOrdersResult.rows.map(o => ({
          orderNumber: o.order_number,
          quantity: o.quantity,
          unitPrice: parseFloat(o.unit_price),
          warehouseId: o.warehouse_id,
          warehouseName: o.warehouse_name,
          createdAt: o.created_at
        }))
      }
    })

  } catch (error) {
    console.error('[Revert POS Sale Preview] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
