import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/test/debug-receive
 * Debug endpoint to test each query individually
 */
export async function POST(request: NextRequest) {
  const results: { step: string; success: boolean; error?: string }[] = []

  try {
    const body = await request.json()
    const { warehouseId, orderId, lines } = body

    // Test data
    const companyId = 1
    const userId = 1

    // Step 1: Verify warehouse
    try {
      const warehouseResult = await db.query(`
        SELECT id, name, code FROM market_warehouses
        WHERE id = $1 AND company_id = $2
      `, [parseInt(String(warehouseId)), companyId])
      results.push({ step: '1. Verify warehouse', success: true })
    } catch (err) {
      results.push({ step: '1. Verify warehouse', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    // Step 2: Get order
    try {
      const orderResult = await db.query(`
        SELECT o.*, s.code as supplier_code, s.name as supplier_name
        FROM consignment_orders o
        JOIN consignment_suppliers s ON s.id = o.supplier_id
        WHERE o.id = $1 AND o.company_id = $2
      `, [parseInt(String(orderId)), companyId])
      results.push({ step: '2. Get order', success: true })
    } catch (err) {
      results.push({ step: '2. Get order', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    // Get order data for next queries
    const orderData = await db.query(`
      SELECT o.*, s.code as supplier_code
      FROM consignment_orders o
      JOIN consignment_suppliers s ON s.id = o.supplier_id
      WHERE o.id = $1
    `, [parseInt(String(orderId))])

    if (orderData.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found', results })
    }

    const order = orderData.rows[0]
    const supplierId = parseInt(order.supplier_id)
    const supplierCode = order.supplier_code

    const line = lines[0]
    const lineId = parseInt(String(line.lineId))
    const productId = parseInt(String(line.productId))
    const quantityReceived = parseInt(String(line.quantityReceived))
    const lotNumber = line.lotNumber || `TEST${Date.now()}`
    const expirationDate = line.expirationDate || null

    // Step 3: Check supplier conflict
    try {
      const conflictCheck = await db.query(`
        SELECT
          cli.supplier_id,
          cs.code as supplier_code,
          cs.name as supplier_name,
          cli.unit_cost,
          SUM(cli.quantity_available) as total_available
        FROM consignment_lot_inventory cli
        JOIN consignment_suppliers cs ON cs.id = cli.supplier_id
        WHERE cli.warehouse_id = $1
          AND cli.product_id = $2
          AND cli.quantity_available > 0
          AND cli.supplier_id != $3
        GROUP BY cli.supplier_id, cs.code, cs.name, cli.unit_cost
      `, [parseInt(String(warehouseId)), productId, supplierId])
      results.push({ step: '3. Check supplier conflict', success: true })
    } catch (err) {
      results.push({ step: '3. Check supplier conflict', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    // Step 4: Get order line
    try {
      const lineResult = await db.query(`
        SELECT * FROM consignment_order_lines WHERE id = $1 AND order_id = $2
      `, [lineId, parseInt(String(orderId))])
      results.push({ step: '4. Get order line', success: true })
    } catch (err) {
      results.push({ step: '4. Get order line', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    // Get order line data
    const lineData = await db.query(`
      SELECT * FROM consignment_order_lines WHERE id = $1
    `, [lineId])

    const orderLine = lineData.rows[0]
    const unitCost = parseFloat(orderLine?.unit_cost) || 0

    // Step 5: Update order line
    try {
      await db.query(`
        UPDATE consignment_order_lines SET
          quantity_received = COALESCE(quantity_received, 0) + $1,
          lot_number = $2,
          expiration_date = $3
        WHERE id = $4
      `, [
        quantityReceived,
        lotNumber,
        expirationDate === '' ? null : expirationDate,
        lineId
      ])
      results.push({ step: '5. Update order line', success: true })
    } catch (err) {
      results.push({ step: '5. Update order line', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    // Step 6: Insert FIFO inventory (THE CRITICAL ONE)
    try {
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
        parseInt(String(warehouseId)),
        productId,
        lineId,
        supplierId,
        lotNumber,
        expirationDate === '' ? null : expirationDate,
        quantityReceived,
        quantityReceived,
        unitCost
      ])
      results.push({ step: '6. Insert FIFO inventory', success: true })
    } catch (err) {
      results.push({ step: '6. Insert FIFO inventory', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    // Step 7: Check warehouse stock
    try {
      const stockExists = await db.query(`
        SELECT id, quantity_on_hand FROM market_warehouse_stock
        WHERE warehouse_id = $1 AND product_id = $2 AND variant_id IS NULL
      `, [parseInt(String(warehouseId)), productId])
      results.push({ step: '7. Check warehouse stock', success: true })
    } catch (err) {
      results.push({ step: '7. Check warehouse stock', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    // Step 8: Update warehouse stock
    try {
      await db.query(`
        UPDATE market_warehouse_stock SET
          quantity_on_hand = quantity_on_hand + $1,
          last_movement_at = NOW(),
          updated_at = NOW()
        WHERE warehouse_id = $2 AND product_id = $3 AND variant_id IS NULL
      `, [quantityReceived, parseInt(String(warehouseId)), productId])
      results.push({ step: '8. Update warehouse stock', success: true })
    } catch (err) {
      results.push({ step: '8. Update warehouse stock', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    // Step 9: Check pending lines
    try {
      const pendingResult = await db.query(`
        SELECT COUNT(*) as pending FROM consignment_order_lines
        WHERE order_id = $1 AND quantity_ordered > COALESCE(quantity_received, 0)
      `, [parseInt(String(orderId))])
      results.push({ step: '9. Check pending lines', success: true })
    } catch (err) {
      results.push({ step: '9. Check pending lines', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    // Step 10: Update order status (use $5 as duplicate of $1 to avoid type inference issue)
    try {
      await db.query(`
        UPDATE consignment_orders SET
          status = $1,
          warehouse_id = COALESCE(warehouse_id, $2),
          received_at = CASE WHEN $5 = 'received' THEN NOW() ELSE received_at END,
          received_by = $3,
          updated_at = NOW()
        WHERE id = $4
      `, ['received', parseInt(String(warehouseId)), userId, parseInt(String(orderId)), 'received'])
      results.push({ step: '10. Update order status', success: true })
    } catch (err) {
      results.push({ step: '10. Update order status', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    // Step 11: Get wallet
    try {
      const walletResult = await db.query(
        'SELECT id FROM consignment_supplier_wallets WHERE supplier_id = $1',
        [supplierId]
      )
      results.push({ step: '11. Get wallet', success: true })
    } catch (err) {
      results.push({ step: '11. Get wallet', success: false, error: err instanceof Error ? err.message : 'Error' })
    }

    const failedSteps = results.filter(r => !r.success)

    return NextResponse.json({
      success: failedSteps.length === 0,
      message: failedSteps.length === 0 ? 'All queries passed' : 'Some queries failed',
      results,
      failedSteps
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error',
      results
    }, { status: 500 })
  }
}
