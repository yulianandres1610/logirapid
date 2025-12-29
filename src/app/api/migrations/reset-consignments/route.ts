import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * POST /api/migrations/reset-consignments
 * Elimina todas las órdenes de consignación y datos relacionados
 * PRECAUCIÓN: Esta operación es irreversible
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'delete' // 'delete' | 'reset'

    console.log(`[Migration] Starting consignment ${action}...`)

    if (action === 'delete') {
      // Delete all consignment data in order (respecting foreign keys)

      // 1. Delete wallet transactions
      const txResult = await db.query(`
        DELETE FROM consignment_wallet_transactions
        RETURNING id
      `)
      console.log(`[Migration] Deleted ${txResult.rowCount} wallet transactions`)

      // 2. Delete return lines
      const returnLinesResult = await db.query(`
        DELETE FROM consignment_return_lines
        RETURNING id
      `)
      console.log(`[Migration] Deleted ${returnLinesResult.rowCount} return lines`)

      // 3. Delete returns
      const returnsResult = await db.query(`
        DELETE FROM consignment_returns
        RETURNING id
      `)
      console.log(`[Migration] Deleted ${returnsResult.rowCount} returns`)

      // 4. Delete lot inventory
      const lotResult = await db.query(`
        DELETE FROM consignment_lot_inventory
        RETURNING id
      `)
      console.log(`[Migration] Deleted ${lotResult.rowCount} lot inventory records`)

      // 5. Delete order lines
      const linesResult = await db.query(`
        DELETE FROM consignment_order_lines
        RETURNING id
      `)
      console.log(`[Migration] Deleted ${linesResult.rowCount} order lines`)

      // 6. Delete orders
      const ordersResult = await db.query(`
        DELETE FROM consignment_orders
        RETURNING id
      `)
      console.log(`[Migration] Deleted ${ordersResult.rowCount} orders`)

      // 7. Reset supplier wallets
      const walletResult = await db.query(`
        UPDATE consignment_supplier_wallets
        SET
          balance_available = 0,
          balance_pending = 0,
          total_earned = 0,
          total_paid = 0,
          total_returned = 0,
          updated_at = NOW()
        RETURNING id
      `)
      console.log(`[Migration] Reset ${walletResult.rowCount} wallets`)

      // 8. Reset warehouse stock related to consignment
      await db.query(`
        UPDATE market_warehouse_stock
        SET quantity_on_hand = 0, quantity_reserved = 0, updated_at = NOW()
        WHERE quantity_on_hand > 0
      `)

      return NextResponse.json({
        success: true,
        message: 'All consignment data deleted successfully',
        deleted: {
          walletTransactions: txResult.rowCount,
          returnLines: returnLinesResult.rowCount,
          returns: returnsResult.rowCount,
          lotInventory: lotResult.rowCount,
          orderLines: linesResult.rowCount,
          orders: ordersResult.rowCount,
          walletsReset: walletResult.rowCount
        }
      })
    } else if (action === 'reset') {
      // Reset quantities but keep orders

      // Reset order lines
      await db.query(`
        UPDATE consignment_order_lines
        SET
          quantity_received = 0,
          quantity_sold = 0,
          quantity_returned = 0,
          updated_at = NOW()
      `)

      // Reset orders to pending
      const ordersResult = await db.query(`
        UPDATE consignment_orders
        SET
          status = 'pending',
          received_at = NULL,
          updated_at = NOW()
        RETURNING id
      `)

      // Delete lot inventory
      await db.query(`DELETE FROM consignment_lot_inventory`)

      // Reset wallets
      await db.query(`
        UPDATE consignment_supplier_wallets
        SET
          balance_available = 0,
          balance_pending = 0,
          total_earned = 0,
          total_paid = 0,
          total_returned = 0,
          updated_at = NOW()
      `)

      // Reset warehouse stock
      await db.query(`
        UPDATE market_warehouse_stock
        SET quantity_on_hand = 0, quantity_reserved = 0, updated_at = NOW()
      `)

      return NextResponse.json({
        success: true,
        message: 'All consignment orders reset to pending',
        ordersReset: ordersResult.rowCount
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use ?action=delete or ?action=reset'
    }, { status: 400 })

  } catch (error) {
    console.error('[Migration] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}

/**
 * GET /api/migrations/reset-consignments
 * Muestra el estado actual de las consignaciones
 */
export async function GET() {
  try {
    const stats = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM consignment_orders) as orders,
        (SELECT COUNT(*) FROM consignment_order_lines) as order_lines,
        (SELECT COUNT(*) FROM consignment_lot_inventory) as lot_inventory,
        (SELECT COUNT(*) FROM consignment_returns) as returns,
        (SELECT COUNT(*) FROM consignment_wallet_transactions) as transactions,
        (SELECT COUNT(*) FROM consignment_orders WHERE status = 'pending') as pending_orders,
        (SELECT COUNT(*) FROM consignment_orders WHERE status = 'received') as received_orders,
        (SELECT COUNT(*) FROM consignment_orders WHERE status = 'selling') as selling_orders
    `)

    return NextResponse.json({
      success: true,
      stats: stats.rows[0],
      actions: {
        delete: 'POST /api/migrations/reset-consignments?action=delete - Elimina todo',
        reset: 'POST /api/migrations/reset-consignments?action=reset - Resetea a pendiente'
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats'
    }, { status: 500 })
  }
}
