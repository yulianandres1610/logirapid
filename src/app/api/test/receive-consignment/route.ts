import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/test/receive-consignment
 * Prueba de recepción de consignación - solo para desarrollo
 */
export async function GET() {
  try {
    // 1. Obtener una orden pendiente con sus líneas
    const orderResult = await db.query(`
      SELECT
        o.id as order_id,
        o.order_number,
        o.status,
        o.company_id,
        o.warehouse_id,
        s.id as supplier_id,
        s.code as supplier_code,
        s.name as supplier_name
      FROM consignment_orders o
      JOIN consignment_suppliers s ON s.id = o.supplier_id
      WHERE o.status IN ('pending', 'partial')
      ORDER BY o.id
      LIMIT 1
    `)

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay órdenes pendientes',
        suggestion: 'Crea una orden de consignación primero'
      })
    }

    const order = orderResult.rows[0]

    // 2. Obtener líneas de la orden
    const linesResult = await db.query(`
      SELECT
        ol.id as line_id,
        ol.product_id,
        ol.quantity_ordered,
        ol.quantity_received,
        ol.unit_cost,
        p.name as product_name,
        p.sku
      FROM consignment_order_lines ol
      JOIN market_products p ON p.id = ol.product_id
      WHERE ol.order_id = $1
    `, [order.order_id])

    // 3. Obtener almacenes disponibles
    const warehouseResult = await db.query(`
      SELECT id, name, code FROM market_warehouses
      WHERE company_id = $1 AND is_active = true
      LIMIT 1
    `, [order.company_id])

    const warehouse = warehouseResult.rows[0]

    // 4. Preparar datos para recepción
    const linesToReceive = linesResult.rows.map(line => ({
      lineId: parseInt(line.line_id),
      productId: parseInt(line.product_id),
      quantityReceived: parseInt(line.quantity_ordered) - parseInt(line.quantity_received || 0),
      lotNumber: '',
      expirationDate: null
    })).filter(l => l.quantityReceived > 0)

    return NextResponse.json({
      success: true,
      message: 'Datos para prueba de recepción',
      testData: {
        endpoint: `/api/market/warehouses/${warehouse?.id || 1}/unified-receive`,
        method: 'POST',
        body: {
          orderType: 'consignment',
          orderId: parseInt(order.order_id),
          lines: linesToReceive
        }
      },
      orderInfo: {
        id: order.order_id,
        orderNumber: order.order_number,
        status: order.status,
        supplier: {
          id: order.supplier_id,
          code: order.supplier_code,
          name: order.supplier_name
        }
      },
      warehouse: warehouse,
      lines: linesResult.rows.map(l => ({
        lineId: l.line_id,
        productId: l.product_id,
        productName: l.product_name,
        sku: l.sku,
        quantityOrdered: l.quantity_ordered,
        quantityReceived: l.quantity_received || 0,
        quantityPending: parseInt(l.quantity_ordered) - parseInt(l.quantity_received || 0),
        unitCost: l.unit_cost
      }))
    })

  } catch (error) {
    console.error('[Test Receive] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}

/**
 * POST /api/test/receive-consignment
 * Ejecuta la prueba de recepción
 */
export async function POST() {
  try {
    // 0. Si no hay órdenes, crear una de prueba
    const checkOrders = await db.query(`
      SELECT COUNT(*)::int as count FROM consignment_orders WHERE status IN ('pending', 'partial')
    `)

    if (parseInt(checkOrders.rows[0].count) === 0) {
      // Crear orden de prueba
      // Primero obtener un proveedor
      const supplierResult = await db.query(`
        SELECT id, company_id FROM consignment_suppliers LIMIT 1
      `)

      if (supplierResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No hay proveedores de consignación. Crea uno primero.'
        })
      }

      const supplier = supplierResult.rows[0]

      // Obtener un producto
      const productResult = await db.query(`
        SELECT id, cost_price FROM market_products WHERE company_id = $1 LIMIT 1
      `, [supplier.company_id])

      if (productResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No hay productos. Crea uno primero.'
        })
      }

      const product = productResult.rows[0]

      // Obtener un almacén
      const warehouseResult = await db.query(`
        SELECT id FROM market_warehouses WHERE company_id = $1 AND is_active = true LIMIT 1
      `, [supplier.company_id])

      if (warehouseResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No hay almacenes activos. Crea uno primero.'
        })
      }

      const warehouseIdForOrder = warehouseResult.rows[0].id

      // Crear orden
      const orderNumber = `TEST-${Date.now()}`
      const totalCost = (parseFloat(product.cost_price) || 1) * 10
      const orderInsert = await db.query(`
        INSERT INTO consignment_orders (
          company_id, supplier_id, warehouse_id, order_number, status, consignment_date,
          total_items, total_units, total_cost, created_at
        ) VALUES ($1, $2, $3, $4, 'pending', CURRENT_DATE, 1, 10, $5, NOW())
        RETURNING id
      `, [supplier.company_id, supplier.id, warehouseIdForOrder, orderNumber, totalCost])

      const orderId = orderInsert.rows[0].id

      // Crear línea de orden
      await db.query(`
        INSERT INTO consignment_order_lines (
          order_id, product_id, quantity_ordered, quantity_received, unit_cost
        ) VALUES ($1, $2, 10, 0, $3)
      `, [orderId, product.id, parseFloat(product.cost_price) || 1])

      console.log(`[Test] Created test order ${orderNumber} with id ${orderId}`)
    }

    // 1. Obtener datos de prueba
    const orderResult = await db.query(`
      SELECT
        o.id as order_id,
        o.company_id,
        s.id as supplier_id
      FROM consignment_orders o
      JOIN consignment_suppliers s ON s.id = o.supplier_id
      WHERE o.status IN ('pending', 'partial')
      ORDER BY o.id
      LIMIT 1
    `)

    if (orderResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay órdenes pendientes'
      })
    }

    const order = orderResult.rows[0]

    // 2. Obtener warehouse
    const warehouseResult = await db.query(`
      SELECT id FROM market_warehouses
      WHERE company_id = $1 AND is_active = true
      LIMIT 1
    `, [order.company_id])

    if (warehouseResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay almacenes activos'
      })
    }

    const warehouseId = warehouseResult.rows[0].id

    // 3. Obtener líneas
    const linesResult = await db.query(`
      SELECT
        ol.id as line_id,
        ol.product_id,
        ol.quantity_ordered,
        ol.quantity_received,
        ol.unit_cost
      FROM consignment_order_lines ol
      WHERE ol.order_id = $1
    `, [order.order_id])

    // 4. Procesar cada línea manualmente (simular lo que hace unified-receive)
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '').slice(2)

    let totalReceived = 0
    const errors: string[] = []

    for (const line of linesResult.rows) {
      const qtyPending = parseInt(line.quantity_ordered) - parseInt(line.quantity_received || 0)
      if (qtyPending <= 0) continue

      const productId = parseInt(line.product_id)
      const lineId = parseInt(line.line_id)
      const qtyReceived = qtyPending
      const unitCost = parseFloat(line.unit_cost) || 0
      const supplierId = parseInt(order.supplier_id)
      const companyId = parseInt(order.company_id)

      // Generar lote
      const seqResult = await db.query(`
        SELECT COUNT(*)::int as count FROM consignment_lot_inventory
        WHERE lot_number LIKE $1
      `, [`TEST${dateStr}%`])
      const seq = (parseInt(seqResult.rows[0].count) + 1).toString().padStart(2, '0')
      const lotNumber = `TEST${dateStr}${seq}`

      try {
        // Update order line
        await db.query(`
          UPDATE consignment_order_lines SET
            quantity_received = COALESCE(quantity_received, 0) + $1,
            lot_number = $2
          WHERE id = $3
        `, [qtyReceived, lotNumber, lineId])

        // Insert into lot inventory
        await db.query(`
          INSERT INTO consignment_lot_inventory (
            company_id, warehouse_id, product_id, order_line_id, supplier_id,
            lot_number, expiration_date, quantity_initial, quantity_available, unit_cost
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (warehouse_id, product_id, lot_number) DO UPDATE SET
            quantity_initial = consignment_lot_inventory.quantity_initial + EXCLUDED.quantity_initial,
            quantity_available = consignment_lot_inventory.quantity_available + EXCLUDED.quantity_available
        `, [
          companyId,
          warehouseId,
          productId,
          lineId,
          supplierId,
          lotNumber,
          null,
          qtyReceived,
          qtyReceived,
          unitCost
        ])

        // Update warehouse stock
        const stockExists = await db.query(`
          SELECT id FROM market_warehouse_stock
          WHERE warehouse_id = $1 AND product_id = $2 AND variant_id IS NULL
        `, [warehouseId, productId])

        if (stockExists.rows.length > 0) {
          await db.query(`
            UPDATE market_warehouse_stock SET
              quantity_on_hand = quantity_on_hand + $1,
              updated_at = NOW()
            WHERE warehouse_id = $2 AND product_id = $3 AND variant_id IS NULL
          `, [qtyReceived, warehouseId, productId])
        } else {
          await db.query(`
            INSERT INTO market_warehouse_stock (
              warehouse_id, product_id, variant_id, quantity_on_hand, quantity_reserved,
              last_movement_at, created_at, updated_at
            ) VALUES ($1, $2, NULL, $3, 0, NOW(), NOW(), NOW())
          `, [warehouseId, productId, qtyReceived])
        }

        totalReceived += qtyReceived
      } catch (err) {
        errors.push(`Line ${lineId}: ${err instanceof Error ? err.message : 'Error'}`)
      }
    }

    // Update order status
    if (errors.length === 0 && totalReceived > 0) {
      await db.query(`
        UPDATE consignment_orders SET
          status = 'received',
          warehouse_id = $1,
          received_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [warehouseId, order.order_id])
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: errors.length === 0 ? 'Recepción exitosa' : 'Recepción con errores',
      totalReceived,
      errors
    })

  } catch (error) {
    console.error('[Test Receive POST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
