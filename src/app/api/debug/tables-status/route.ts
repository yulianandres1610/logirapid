import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/debug/tables-status
 * Check existence of critical tables for consignment/purchase FIFO system
 */
export async function GET() {
  try {
    const tables = [
      'market_suppliers',
      'consignment_orders',
      'consignment_order_lines',
      'consignment_lot_inventory',
      'consignment_supplier_wallets',
      'consignment_wallet_transactions',
      'market_purchases',
      'market_purchase_lines',
      'purchase_lot_inventory',
      'market_warehouse_stock',
      'market_pos_orders',
      'market_pos_order_lines',
      'market_inventory_movements'
    ]

    const results: { table: string; exists: boolean; columns?: string[] }[] = []

    for (const table of tables) {
      const check = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table])

      results.push({
        table,
        exists: check.rows.length > 0,
        columns: check.rows.map(r => r.column_name)
      })
    }

    // Check POS order lines traceability columns
    const posLinesCols = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'market_pos_order_lines'
      AND column_name IN ('supplier_id', 'lot_id', 'cost_price', 'is_consignment')
    `)

    // Check consignment lot inventory columns
    const consignmentLotCols = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'consignment_lot_inventory'
    `)

    // Check purchase lot inventory columns
    const purchaseLotCols = await db.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'purchase_lot_inventory'
    `)

    return NextResponse.json({
      success: true,
      summary: {
        totalTables: tables.length,
        existingTables: results.filter(r => r.exists).length,
        missingTables: results.filter(r => !r.exists).map(r => r.table)
      },
      traceabilityFields: {
        posOrderLines: posLinesCols.rows,
        consignmentLotInventory: consignmentLotCols.rows.length > 0,
        purchaseLotInventory: purchaseLotCols.rows.length > 0
      },
      tables: results
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
