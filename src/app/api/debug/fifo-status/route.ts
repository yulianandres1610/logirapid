import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * GET /api/debug/fifo-status
 * Debug endpoint to verify FIFO inventory and wallet status
 * Only for auditing - should be removed in production
 */
export async function GET() {
  try {
    // 1. Check consignment lots with available stock
    const consignmentLots = await db.query(`
      SELECT
        cli.id,
        cli.lot_number,
        cli.warehouse_id,
        w.name as warehouse_name,
        cli.product_id,
        p.name as product_name,
        cli.quantity_initial,
        cli.quantity_available,
        cli.quantity_sold,
        cli.unit_cost,
        cs.id as supplier_id,
        cs.name as supplier_name,
        cs.supplier_code,
        cli.received_at
      FROM consignment_lot_inventory cli
      JOIN market_products p ON p.id = cli.product_id
      JOIN market_suppliers cs ON cs.id = cli.supplier_id
      JOIN market_warehouses w ON w.id = cli.warehouse_id
      WHERE cli.quantity_available > 0
      ORDER BY cli.received_at ASC
      LIMIT 50
    `)

    // 2. Check supplier wallets
    const wallets = await db.query(`
      SELECT
        w.id as wallet_id,
        w.supplier_id,
        cs.name as supplier_name,
        cs.supplier_code,
        w.balance_available,
        w.balance_pending,
        w.total_earned,
        w.total_paid,
        w.updated_at
      FROM consignment_supplier_wallets w
      JOIN market_suppliers cs ON cs.id = w.supplier_id
      ORDER BY w.balance_available DESC
      LIMIT 20
    `)

    // 3. Check purchase lots
    const purchaseLots = await db.query(`
      SELECT
        pli.id,
        pli.lot_number,
        pli.warehouse_id,
        pli.product_id,
        p.name as product_name,
        pli.quantity_initial,
        pli.quantity_available,
        pli.quantity_sold,
        pli.unit_cost,
        pli.received_at
      FROM purchase_lot_inventory pli
      JOIN market_products p ON p.id = pli.product_id
      WHERE pli.quantity_available > 0
      ORDER BY pli.received_at ASC
      LIMIT 50
    `)

    // 4. Check recent POS sales with traceability
    const recentSales = await db.query(`
      SELECT
        o.id as order_id,
        o.order_number,
        o.total_amount,
        o.created_at,
        ol.product_name,
        ol.quantity,
        ol.unit_price,
        ol.cost_price,
        ol.is_consignment,
        ol.supplier_id,
        cs.name as supplier_name,
        ol.lot_id
      FROM market_pos_orders o
      JOIN market_pos_order_lines ol ON o.id = ol.order_id
      LEFT JOIN market_suppliers cs ON cs.id = ol.supplier_id
      ORDER BY o.created_at DESC
      LIMIT 30
    `)

    // 5. Check recent wallet transactions
    const recentTransactions = await db.query(`
      SELECT
        t.id,
        t.transaction_type,
        t.amount,
        t.pos_order_number,
        t.notes,
        t.created_at,
        w.supplier_id,
        cs.name as supplier_name
      FROM consignment_wallet_transactions t
      JOIN consignment_supplier_wallets w ON w.id = t.wallet_id
      JOIN market_suppliers cs ON cs.id = w.supplier_id
      ORDER BY t.created_at DESC
      LIMIT 20
    `)

    // Summary stats
    const stats = {
      consignmentLotsWithStock: consignmentLots.rows.length,
      totalConsignmentAvailable: consignmentLots.rows.reduce((sum, lot) =>
        sum + parseInt(lot.quantity_available), 0),
      purchaseLotsWithStock: purchaseLots.rows.length,
      totalPurchaseAvailable: purchaseLots.rows.reduce((sum, lot) =>
        sum + parseInt(lot.quantity_available), 0),
      suppliersWithBalance: wallets.rows.filter(w => parseFloat(w.balance_available) > 0).length,
      totalSupplierBalance: wallets.rows.reduce((sum, w) =>
        sum + parseFloat(w.balance_available), 0).toFixed(2),
      recentSalesCount: recentSales.rows.length,
      consignmentSalesCount: recentSales.rows.filter(s => s.is_consignment).length
    }

    return NextResponse.json({
      success: true,
      stats,
      data: {
        consignmentLots: consignmentLots.rows.map(row => ({
          id: row.id,
          lotNumber: row.lot_number,
          warehouse: row.warehouse_name,
          product: row.product_name,
          quantityInitial: parseInt(row.quantity_initial),
          quantityAvailable: parseInt(row.quantity_available),
          quantitySold: parseInt(row.quantity_sold),
          unitCost: parseFloat(row.unit_cost),
          supplier: {
            id: row.supplier_id,
            name: row.supplier_name,
            code: row.supplier_code
          },
          receivedAt: row.received_at
        })),
        purchaseLots: purchaseLots.rows.map(row => ({
          id: row.id,
          lotNumber: row.lot_number,
          product: row.product_name,
          quantityAvailable: parseInt(row.quantity_available),
          unitCost: parseFloat(row.unit_cost),
          receivedAt: row.received_at
        })),
        supplierWallets: wallets.rows.map(row => ({
          walletId: row.wallet_id,
          supplier: {
            id: row.supplier_id,
            name: row.supplier_name,
            code: row.supplier_code
          },
          balanceAvailable: parseFloat(row.balance_available),
          balancePending: parseFloat(row.balance_pending),
          totalEarned: parseFloat(row.total_earned),
          totalPaid: parseFloat(row.total_paid)
        })),
        recentSales: recentSales.rows.map(row => ({
          orderId: row.order_id,
          orderNumber: row.order_number,
          product: row.product_name,
          quantity: parseFloat(row.quantity),
          unitPrice: parseFloat(row.unit_price),
          costPrice: row.cost_price ? parseFloat(row.cost_price) : null,
          isConsignment: row.is_consignment,
          supplier: row.supplier_name,
          lotId: row.lot_id,
          createdAt: row.created_at
        })),
        recentWalletTransactions: recentTransactions.rows.map(row => ({
          id: row.id,
          type: row.transaction_type,
          amount: parseFloat(row.amount),
          posOrderNumber: row.pos_order_number,
          notes: row.notes,
          supplier: row.supplier_name,
          createdAt: row.created_at
        }))
      }
    })

  } catch (error) {
    console.error('[Debug FIFO Status] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
