import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

async function getPayload(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret'
    return jwt.verify(token, secret) as JWTPayload
  } catch {
    return null
  }
}

/**
 * GET /api/consignments/analytics/dashboard
 * Dashboard con KPIs y estadisticas de consignacion
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload()
    if (!payload) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    // Get inventory value in consignment
    const inventoryResult = await db.query(`
      SELECT
        COALESCE(SUM(cli.quantity_available * cli.unit_cost), 0) as total_value,
        COALESCE(SUM(cli.quantity_available), 0) as total_units,
        COUNT(DISTINCT cli.product_id) as product_count
      FROM consignment_lot_inventory cli
      WHERE cli.company_id = $1 AND cli.quantity_available > 0
    `, [payload.companyId])

    const inventory = inventoryResult.rows[0]

    // Get pending payments to suppliers
    const pendingPaymentsResult = await db.query(`
      SELECT COALESCE(SUM(w.balance_available), 0) as pending_to_pay
      FROM consignment_supplier_wallets w
      JOIN consignment_suppliers s ON s.id = w.supplier_id
      WHERE s.company_id = $1
    `, [payload.companyId])

    const pendingPayments = parseFloat(pendingPaymentsResult.rows[0].pending_to_pay) || 0

    // Get order stats (calculate total_sold from line items for accuracy)
    const orderStatsResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE o.status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE o.status = 'received') as received_orders,
        COUNT(*) FILTER (WHERE o.status = 'selling') as selling_orders,
        COUNT(*) as total_orders,
        COALESCE(SUM(o.total_cost), 0) as total_consigned,
        COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_price)
          FROM consignment_order_lines ol
          JOIN consignment_orders o2 ON o2.id = ol.order_id
          JOIN consignment_suppliers s2 ON s2.id = o2.supplier_id
          WHERE s2.company_id = $1
        ), 0) as total_sold,
        COALESCE(SUM(o.total_paid), 0) as total_paid
      FROM consignment_orders o
      JOIN consignment_suppliers s ON s.id = o.supplier_id
      WHERE s.company_id = $1
    `, [payload.companyId])

    const orderStats = orderStatsResult.rows[0]

    // Get sales by period (last 30 days)
    const salesTrendResult = await db.query(`
      SELECT
        DATE(t.created_at) as sale_date,
        SUM(t.amount) as daily_sales
      FROM consignment_wallet_transactions t
      JOIN consignment_supplier_wallets w ON w.id = t.wallet_id
      JOIN consignment_suppliers s ON s.id = w.supplier_id
      WHERE s.company_id = $1
        AND t.transaction_type = 'sale'
        AND t.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(t.created_at)
      ORDER BY sale_date ASC
    `, [payload.companyId])

    const salesTrend = salesTrendResult.rows.map(r => ({
      date: r.sale_date,
      amount: parseFloat(r.daily_sales)
    }))

    // Get top suppliers by sales (calculate from line items for accuracy)
    const topSuppliersResult = await db.query(`
      SELECT
        s.id,
        s.code,
        s.name,
        COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_price)
          FROM consignment_order_lines ol
          JOIN consignment_orders o2 ON o2.id = ol.order_id
          WHERE o2.supplier_id = s.id
        ), 0) as total_sold,
        COALESCE(SUM(o.total_cost), 0) as total_consigned,
        COUNT(o.id) as order_count
      FROM consignment_suppliers s
      LEFT JOIN consignment_orders o ON o.supplier_id = s.id
      WHERE s.company_id = $1 AND s.is_active = true
      GROUP BY s.id, s.code, s.name
      ORDER BY total_sold DESC
      LIMIT 5
    `, [payload.companyId])

    const topSuppliers = topSuppliersResult.rows.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      totalSold: parseFloat(s.total_sold),
      totalConsigned: parseFloat(s.total_consigned),
      orderCount: parseInt(s.order_count)
    }))

    // Get top products by sales
    const topProductsResult = await db.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        COALESCE(SUM(cli.quantity_sold), 0) as units_sold,
        COALESCE(SUM(cli.quantity_sold * cli.unit_cost), 0) as total_value,
        COALESCE(SUM(cli.quantity_available), 0) as stock_available
      FROM market_products p
      JOIN consignment_lot_inventory cli ON cli.product_id = p.id
      WHERE cli.company_id = $1
      GROUP BY p.id, p.name, p.sku
      ORDER BY units_sold DESC
      LIMIT 10
    `, [payload.companyId])

    const topProducts = topProductsResult.rows.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      unitsSold: parseInt(p.units_sold),
      totalValue: parseFloat(p.total_value),
      stockAvailable: parseInt(p.stock_available)
    }))

    // Get supplier count
    const supplierCountResult = await db.query(`
      SELECT COUNT(*) as count FROM consignment_suppliers WHERE company_id = $1 AND is_active = true
    `, [payload.companyId])

    // Get sales by supplier (for pie chart)
    const salesBySupplierResult = await db.query(`
      SELECT
        s.code,
        s.name,
        COALESCE(SUM(t.amount), 0) as total_sales
      FROM consignment_suppliers s
      LEFT JOIN consignment_supplier_wallets w ON w.supplier_id = s.id
      LEFT JOIN consignment_wallet_transactions t ON t.wallet_id = w.id AND t.transaction_type = 'sale'
      WHERE s.company_id = $1 AND s.is_active = true
      GROUP BY s.id, s.code, s.name
      HAVING COALESCE(SUM(t.amount), 0) > 0
      ORDER BY total_sales DESC
      LIMIT 6
    `, [payload.companyId])

    const salesBySupplier = salesBySupplierResult.rows.map(s => ({
      code: s.code,
      name: s.name,
      value: parseFloat(s.total_sales)
    }))

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          inventoryValue: parseFloat(inventory.total_value),
          inventoryUnits: parseInt(inventory.total_units),
          productCount: parseInt(inventory.product_count),
          pendingPayments,
          supplierCount: parseInt(supplierCountResult.rows[0].count),
          totalConsigned: parseFloat(orderStats.total_consigned),
          totalSold: parseFloat(orderStats.total_sold),
          totalPaid: parseFloat(orderStats.total_paid)
        },
        orders: {
          pending: parseInt(orderStats.pending_orders),
          received: parseInt(orderStats.received_orders),
          selling: parseInt(orderStats.selling_orders),
          total: parseInt(orderStats.total_orders)
        },
        salesTrend,
        topSuppliers,
        topProducts,
        salesBySupplier
      }
    })

  } catch (error) {
    console.error('[Consignment Analytics] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al cargar analytics'
    }, { status: 500 })
  }
}
