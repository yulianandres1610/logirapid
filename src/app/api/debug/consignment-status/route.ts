import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/debug/consignment-status
 * Debug endpoint to check consignment data status
 */
export async function GET() {
  try {
    // Check if tables exist
    const tablesCheck = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN (
        'consignment_orders',
        'consignment_order_lines',
        'consignment_lot_inventory',
        'consignment_suppliers',
        'consignment_supplier_wallets',
        'consignment_wallet_transactions'
      )
      ORDER BY table_name
    `)

    const existingTables = tablesCheck.rows.map(r => r.table_name)

    // Get consignment orders with details
    let ordersData: any[] = []
    if (existingTables.includes('consignment_orders')) {
      const ordersResult = await db.query(`
        SELECT
          o.id,
          o.order_number,
          o.status,
          o.total_cost,
          o.total_sold,
          o.total_paid,
          s.name as supplier_name,
          o.created_at
        FROM consignment_orders o
        LEFT JOIN consignment_suppliers s ON s.id = o.supplier_id
        ORDER BY o.created_at DESC
        LIMIT 20
      `)
      ordersData = ordersResult.rows
    }

    // Get order lines with quantity_sold
    let orderLinesData: any[] = []
    if (existingTables.includes('consignment_order_lines')) {
      const linesResult = await db.query(`
        SELECT
          ol.id,
          ol.order_id,
          o.order_number,
          p.name as product_name,
          ol.quantity_ordered,
          ol.quantity_received,
          ol.quantity_sold,
          ol.unit_cost,
          ol.unit_price,
          (ol.quantity_sold * ol.unit_price) as calculated_sold_value
        FROM consignment_order_lines ol
        JOIN consignment_orders o ON o.id = ol.order_id
        LEFT JOIN market_products p ON p.id = ol.product_id
        ORDER BY ol.order_id DESC
        LIMIT 50
      `)
      orderLinesData = linesResult.rows
    }

    // Get lot inventory status
    let lotsData: any[] = []
    if (existingTables.includes('consignment_lot_inventory')) {
      const lotsResult = await db.query(`
        SELECT
          cli.id,
          cli.lot_number,
          cli.order_line_id,
          p.name as product_name,
          w.name as warehouse_name,
          cli.quantity_initial,
          cli.quantity_available,
          cli.quantity_sold,
          cli.unit_cost,
          s.name as supplier_name
        FROM consignment_lot_inventory cli
        LEFT JOIN market_products p ON p.id = cli.product_id
        LEFT JOIN market_warehouses w ON w.id = cli.warehouse_id
        LEFT JOIN consignment_suppliers s ON s.id = cli.supplier_id
        ORDER BY cli.received_at DESC
        LIMIT 50
      `)
      lotsData = lotsResult.rows
    }

    // Calculate totals comparison
    let totalsComparison: any = {}
    if (existingTables.includes('consignment_order_lines') && existingTables.includes('consignment_orders')) {
      const comparisonResult = await db.query(`
        SELECT
          o.id,
          o.order_number,
          o.total_sold as stored_total_sold,
          COALESCE((
            SELECT SUM(ol.quantity_sold * ol.unit_price)
            FROM consignment_order_lines ol
            WHERE ol.order_id = o.id
          ), 0) as calculated_total_sold,
          COALESCE((
            SELECT SUM(ol.quantity_sold)
            FROM consignment_order_lines ol
            WHERE ol.order_id = o.id
          ), 0) as total_units_sold
        FROM consignment_orders o
        ORDER BY o.created_at DESC
        LIMIT 20
      `)
      totalsComparison = comparisonResult.rows
    }

    // Check wallet transactions
    let walletTransactions: any[] = []
    if (existingTables.includes('consignment_wallet_transactions')) {
      const txResult = await db.query(`
        SELECT
          t.id,
          t.transaction_type,
          t.amount,
          t.quantity,
          t.pos_order_number,
          t.notes,
          t.created_at,
          s.name as supplier_name
        FROM consignment_wallet_transactions t
        JOIN consignment_supplier_wallets w ON w.id = t.wallet_id
        JOIN consignment_suppliers s ON s.id = w.supplier_id
        WHERE t.transaction_type = 'sale'
        ORDER BY t.created_at DESC
        LIMIT 20
      `)
      walletTransactions = txResult.rows
    }

    // Summary stats
    let stats: any = {}
    if (existingTables.includes('consignment_orders')) {
      const statsResult = await db.query(`
        SELECT
          COUNT(*) as total_orders,
          COALESCE(SUM(total_cost), 0) as total_consigned,
          COALESCE(SUM(total_sold), 0) as total_sold_stored,
          COALESCE((
            SELECT SUM(ol.quantity_sold * ol.unit_price)
            FROM consignment_order_lines ol
          ), 0) as total_sold_calculated
        FROM consignment_orders
      `)
      stats = statsResult.rows[0]
    }

    // Check lots with order_line_id
    let lotsWithLineId: any = {}
    if (existingTables.includes('consignment_lot_inventory')) {
      const lotsLineIdResult = await db.query(`
        SELECT
          COUNT(*) as total_lots,
          COUNT(order_line_id) as lots_with_line_id,
          COUNT(*) - COUNT(order_line_id) as lots_without_line_id,
          COALESCE(SUM(quantity_sold), 0) as total_quantity_sold
        FROM consignment_lot_inventory
      `)
      lotsWithLineId = lotsLineIdResult.rows[0]
    }

    return NextResponse.json({
      success: true,
      data: {
        existingTables,
        stats: {
          ...stats,
          discrepancy: stats.total_sold_calculated ?
            (parseFloat(stats.total_sold_calculated) - parseFloat(stats.total_sold_stored || 0)).toFixed(2) : 0
        },
        lotsWithLineId,
        totalsComparison,
        orders: ordersData.map(o => ({
          ...o,
          total_cost: parseFloat(o.total_cost) || 0,
          total_sold: parseFloat(o.total_sold) || 0,
          total_paid: parseFloat(o.total_paid) || 0
        })),
        orderLines: orderLinesData.map(ol => ({
          ...ol,
          quantity_ordered: parseFloat(ol.quantity_ordered) || 0,
          quantity_received: parseFloat(ol.quantity_received) || 0,
          quantity_sold: parseFloat(ol.quantity_sold) || 0,
          unit_cost: parseFloat(ol.unit_cost) || 0,
          unit_price: parseFloat(ol.unit_price) || 0,
          calculated_sold_value: parseFloat(ol.calculated_sold_value) || 0
        })),
        lots: lotsData.map(l => ({
          ...l,
          quantity_initial: parseFloat(l.quantity_initial) || 0,
          quantity_available: parseFloat(l.quantity_available) || 0,
          quantity_sold: parseFloat(l.quantity_sold) || 0,
          unit_cost: parseFloat(l.unit_cost) || 0,
          has_order_line_id: !!l.order_line_id
        })),
        walletTransactions: walletTransactions.map(t => ({
          ...t,
          amount: parseFloat(t.amount) || 0,
          quantity: parseFloat(t.quantity) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Debug Consignment] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error'
    }, { status: 500 })
  }
}
