import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/migrations/fix-levadura-stock
 * Manually deduct 400 levadura from stock + update consignment
 * since the confirm endpoint ran without stock deduction
 */
export async function GET() {
  try {
    const productId = 87 // Levadura Angel 500g
    const warehouseId = 1 // Almacen Infanta
    const quantity = 400
    const invoiceId = 21
    const results: string[] = []

    // 1. Deduct from warehouse stock
    const stockBefore = await db.query(
      'SELECT quantity_on_hand FROM market_warehouse_stock WHERE warehouse_id = $1 AND product_id = $2',
      [warehouseId, productId]
    )
    const beforeQty = parseFloat(stockBefore.rows[0]?.quantity_on_hand) || 0
    const afterQty = beforeQty - quantity

    await db.query(
      'UPDATE market_warehouse_stock SET quantity_on_hand = $1, updated_at = NOW() WHERE warehouse_id = $2 AND product_id = $3',
      [afterQty, warehouseId, productId]
    )
    results.push(`Warehouse stock: ${beforeQty} → ${afterQty}`)

    // 2. Update market_products.quantity_on_hand
    await db.query(`
      UPDATE market_products SET quantity_on_hand = (
        SELECT COALESCE(SUM(quantity_on_hand), 0) FROM market_warehouse_stock WHERE product_id = $1
      ), updated_at = NOW() WHERE id = $1
    `, [productId])
    const prodAfter = await db.query('SELECT quantity_on_hand FROM market_products WHERE id = $1', [productId])
    results.push(`Product total: ${prodAfter.rows[0]?.quantity_on_hand}`)

    // 3. Deduct from consignment lot (lot 88, warehouse 1)
    const lotBefore = await db.query(
      'SELECT id, quantity_available, quantity_sold, unit_cost, order_line_id FROM consignment_lot_inventory WHERE id = 88'
    )
    if (lotBefore.rows.length > 0) {
      const lot = lotBefore.rows[0]
      const lotAvailBefore = parseFloat(lot.quantity_available) || 0
      const toDeduct = Math.min(quantity, lotAvailBefore)
      const unitCost = parseFloat(lot.unit_cost) || 0

      await db.query(
        'UPDATE consignment_lot_inventory SET quantity_available = quantity_available - $1, quantity_sold = COALESCE(quantity_sold, 0) + $1 WHERE id = $2',
        [toDeduct, 88]
      )
      results.push(`Consignment lot 88: available ${lotAvailBefore} → ${lotAvailBefore - toDeduct}, sold += ${toDeduct}`)

      // Update consignment order line
      if (lot.order_line_id) {
        await db.query(
          'UPDATE consignment_order_lines SET quantity_sold = COALESCE(quantity_sold, 0) + $1 WHERE id = $2',
          [toDeduct, lot.order_line_id]
        )

        const orderRes = await db.query('SELECT order_id FROM consignment_order_lines WHERE id = $1', [lot.order_line_id])
        if (orderRes.rows.length > 0) {
          const saleAmount = toDeduct * unitCost
          await db.query(
            'UPDATE consignment_orders SET total_sold = COALESCE(total_sold, 0) + $1, updated_at = NOW() WHERE id = $2',
            [saleAmount, orderRes.rows[0].order_id]
          )
          results.push(`Consignment order: total_sold += $${saleAmount.toFixed(2)}`)
        }
      }

      // Update supplier wallet
      try {
        const supplierId = lot.supplier_id || (await db.query('SELECT supplier_id FROM consignment_lot_inventory WHERE id = 88')).rows[0]?.supplier_id
        if (supplierId) {
          const walletAmount = toDeduct * unitCost
          await db.query(
            'UPDATE consignment_supplier_wallets SET balance_available = COALESCE(balance_available, 0) + $1, total_earned = COALESCE(total_earned, 0) + $1 WHERE supplier_id = $2',
            [walletAmount, supplierId]
          )
          results.push(`Supplier wallet: +$${walletAmount.toFixed(2)}`)
        }
      } catch { results.push('Supplier wallet: skipped') }
    }

    // 4. Create stock movement record
    await db.query(`
      INSERT INTO market_stock_movements (
        company_id, from_warehouse_id, product_id, variant_id,
        movement_type, quantity, quantity_before, quantity_after,
        reference_type, reference_id, notes, created_by, created_at
      ) VALUES (31, $1, $2, NULL, 'wholesale_out', $3, $4, $5, 'wholesale_delivery', $6,
        'Corrección manual: Entrega mayorista FAC-2026-0011 - 400 Levadura Angel 500g', 1, NOW())
    `, [warehouseId, productId, quantity, beforeQty, afterQty, invoiceId])
    results.push('Stock movement: wholesale_out recorded')

    return NextResponse.json({
      success: true,
      message: 'Stock de levadura corregido manualmente',
      results
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
