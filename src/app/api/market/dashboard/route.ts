import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { db } from '@/lib/database'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
  companyName: string
}

/**
 * GET /api/market/dashboard
 * Returns dashboard statistics for a market company
 */
export async function GET(request: NextRequest) {
  try {
    // Verify auth
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    const companyId = payload.companyId

    // Verify company is a market
    const companyCheck = await db.query(`
      SELECT companytype FROM companies WHERE id = $1
    `, [companyId])

    if (companyCheck.rows.length === 0 || companyCheck.rows[0].companytype !== 'market') {
      return NextResponse.json({
        success: false,
        error: 'Esta empresa no es un mercado'
      }, { status: 403 })
    }

    // Helper function to safely execute queries
    const safeQuery = async (query: string, params: any[]) => {
      try {
        return await db.query(query, params)
      } catch (error) {
        console.log('[Dashboard] Query skipped (table may not exist):', error instanceof Error ? error.message : error)
        return { rows: [] }
      }
    }

    // Get order stats
    const orderStats = await safeQuery(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE status IN ('accepted', 'preparing')) as preparing_orders,
        COUNT(*) FILTER (WHERE status = 'ready') as ready_orders,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
        COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) as orders_this_month,
        COALESCE(SUM(total_amount) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)), 0) as total_invoiced_month,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'delivered' AND DATE_TRUNC('month', delivered_at) = DATE_TRUNC('month', CURRENT_DATE)), 0) as total_sold_month
      FROM market_orders
      WHERE market_company_id = $1
    `, [companyId])

    // Get orders by month (last 6 months)
    const ordersByMonth = await safeQuery(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month,
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') as month_name,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM market_orders
      WHERE market_company_id = $1
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at) ASC
    `, [companyId])

    // Get recent orders
    const recentOrders = await safeQuery(`
      SELECT
        id,
        order_number,
        customer_name,
        total_amount,
        currency,
        status,
        created_at
      FROM market_orders
      WHERE market_company_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [companyId])

    // Get product stats
    const productStats = await safeQuery(`
      SELECT
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE quantity_on_hand > 0) as products_in_stock,
        COUNT(*) FILTER (WHERE quantity_on_hand <= minimum_stock AND quantity_on_hand > 0) as low_stock_products,
        COUNT(*) FILTER (WHERE quantity_on_hand = 0) as out_of_stock_products
      FROM market_products
      WHERE company_id = $1 AND is_active = true
    `, [companyId])

    // Get consignment statistics (calculate total_sold from line items for accuracy)
    const consignmentStats = await safeQuery(`
      SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE status = 'partial') as partial_orders,
        COUNT(*) FILTER (WHERE status = 'received') as received_orders,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_cost)
          FROM consignment_order_lines ol
          JOIN consignment_orders o2 ON o2.id = ol.order_id
          WHERE o2.company_id = $1
        ), 0) as total_sold,
        COALESCE(SUM(total_returned), 0) as total_returned,
        COUNT(*) FILTER (WHERE DATE_TRUNC('month', consignment_date) = DATE_TRUNC('month', CURRENT_DATE)) as orders_this_month,
        COALESCE(SUM(total_cost) FILTER (WHERE DATE_TRUNC('month', consignment_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as cost_this_month
      FROM consignment_orders
      WHERE company_id = $1
    `, [companyId])

    // Get recent consignments (calculate total_sold from line items for accuracy)
    const recentConsignments = await safeQuery(`
      SELECT
        co.id,
        co.order_number,
        co.status,
        co.total_cost,
        COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_cost)
          FROM consignment_order_lines ol
          WHERE ol.order_id = co.id
        ), 0) as total_sold,
        co.consignment_date,
        cs.name as supplier_name
      FROM consignment_orders co
      LEFT JOIN market_suppliers cs ON co.supplier_id = cs.id
      WHERE co.company_id = $1
      ORDER BY co.created_at DESC
      LIMIT 5
    `, [companyId])

    // Get purchase statistics
    const purchaseStats = await safeQuery(`
      SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE status = 'received') as received_orders,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COUNT(*) FILTER (WHERE DATE_TRUNC('month', purchase_date) = DATE_TRUNC('month', CURRENT_DATE)) as orders_this_month,
        COALESCE(SUM(total_amount) FILTER (WHERE DATE_TRUNC('month', purchase_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as amount_this_month
      FROM market_purchases
      WHERE company_id = $1
    `, [companyId])

    // Get recent purchases
    const recentPurchases = await safeQuery(`
      SELECT
        mp.id,
        mp.order_number,
        mp.status,
        mp.total_amount,
        mp.purchase_date,
        ps.name as supplier_name
      FROM market_purchases mp
      LEFT JOIN purchase_suppliers ps ON mp.supplier_id = ps.id
      WHERE mp.company_id = $1
      ORDER BY mp.created_at DESC
      LIMIT 5
    `, [companyId])

    // Get POS sales statistics (day, month, year)
    const posSales = await safeQuery(`
      SELECT
        COALESCE(SUM(total_amount) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0) as sales_today,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as orders_today,
        COALESCE(SUM(total_amount) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)), 0) as sales_month,
        COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) as orders_month,
        COALESCE(SUM(total_amount) FILTER (WHERE DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)), 0) as sales_year,
        COUNT(*) FILTER (WHERE DATE_TRUNC('year', created_at) = DATE_TRUNC('year', CURRENT_DATE)) as orders_year
      FROM market_pos_orders
      WHERE company_id = $1 AND status IN ('paid', 'completed')
    `, [companyId])

    // Get POS sales by terminal
    const posByTerminal = await safeQuery(`
      SELECT
        t.id as terminal_id,
        t.name as terminal_name,
        COALESCE(SUM(o.total_amount) FILTER (WHERE DATE(o.created_at) = CURRENT_DATE), 0) as sales_today,
        COALESCE(SUM(o.total_amount) FILTER (WHERE DATE_TRUNC('month', o.created_at) = DATE_TRUNC('month', CURRENT_DATE)), 0) as sales_month
      FROM market_pos_terminals t
      LEFT JOIN market_pos_orders o ON t.id = o.pos_terminal_id AND o.status IN ('paid', 'completed')
      WHERE t.company_id = $1 AND t.is_active = true
      GROUP BY t.id, t.name
      ORDER BY sales_today DESC
    `, [companyId])

    // Get consignments by supplier (with pending to pay - calculate total_sold from line items)
    const consignmentsBySupplier = await safeQuery(`
      SELECT
        cs.id as supplier_id,
        cs.name as supplier_name,
        COUNT(DISTINCT co.id) as total_orders,
        COALESCE(SUM(co.total_cost), 0) as total_cost,
        COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_cost)
          FROM consignment_order_lines ol
          JOIN consignment_orders o2 ON o2.id = ol.order_id
          WHERE o2.supplier_id = cs.id AND o2.status != 'cancelled'
        ), 0) as total_sold,
        COALESCE(SUM(co.total_returned), 0) as total_returned,
        COALESCE(SUM(co.total_cost), 0) - COALESCE((
          SELECT SUM(ol.quantity_sold * ol.unit_cost)
          FROM consignment_order_lines ol
          JOIN consignment_orders o2 ON o2.id = ol.order_id
          WHERE o2.supplier_id = cs.id AND o2.status != 'cancelled'
        ), 0) - COALESCE(SUM(co.total_returned), 0) as pending_to_pay
      FROM market_suppliers cs
      LEFT JOIN consignment_orders co ON cs.id = co.supplier_id AND co.status != 'cancelled'
      WHERE cs.company_id = $1
      GROUP BY cs.id, cs.name
      HAVING SUM(co.total_cost) > 0
      ORDER BY pending_to_pay DESC
      LIMIT 5
    `, [companyId])

    return NextResponse.json({
      success: true,
      data: {
        orders: {
          pending: parseInt(orderStats.rows[0]?.pending_orders) || 0,
          preparing: parseInt(orderStats.rows[0]?.preparing_orders) || 0,
          ready: parseInt(orderStats.rows[0]?.ready_orders) || 0,
          delivered: parseInt(orderStats.rows[0]?.delivered_orders) || 0,
          thisMonth: parseInt(orderStats.rows[0]?.orders_this_month) || 0,
          totalInvoicedMonth: parseFloat(orderStats.rows[0]?.total_invoiced_month) || 0,
          totalSoldMonth: parseFloat(orderStats.rows[0]?.total_sold_month) || 0
        },
        ordersByMonth: ordersByMonth.rows.map(row => ({
          month: row.month,
          monthName: row.month_name,
          orderCount: parseInt(row.order_count) || 0,
          totalAmount: parseFloat(row.total_amount) || 0
        })),
        recentOrders: recentOrders.rows.map(row => ({
          id: row.id,
          orderNumber: row.order_number,
          customerName: row.customer_name,
          totalAmount: parseFloat(row.total_amount) || 0,
          currency: row.currency || 'USD',
          status: row.status,
          createdAt: row.created_at
        })),
        products: {
          total: parseInt(productStats.rows[0]?.total_products) || 0,
          inStock: parseInt(productStats.rows[0]?.products_in_stock) || 0,
          lowStock: parseInt(productStats.rows[0]?.low_stock_products) || 0,
          outOfStock: parseInt(productStats.rows[0]?.out_of_stock_products) || 0
        },
        consignments: {
          total: parseInt(consignmentStats.rows[0]?.total_orders) || 0,
          pending: parseInt(consignmentStats.rows[0]?.pending_orders) || 0,
          partial: parseInt(consignmentStats.rows[0]?.partial_orders) || 0,
          received: parseInt(consignmentStats.rows[0]?.received_orders) || 0,
          totalCost: parseFloat(consignmentStats.rows[0]?.total_cost) || 0,
          totalSold: parseFloat(consignmentStats.rows[0]?.total_sold) || 0,
          totalReturned: parseFloat(consignmentStats.rows[0]?.total_returned) || 0,
          thisMonth: parseInt(consignmentStats.rows[0]?.orders_this_month) || 0,
          costThisMonth: parseFloat(consignmentStats.rows[0]?.cost_this_month) || 0
        },
        recentConsignments: recentConsignments.rows.map(row => ({
          id: row.id,
          orderNumber: row.order_number,
          supplierName: row.supplier_name || 'Sin proveedor',
          status: row.status,
          totalCost: parseFloat(row.total_cost) || 0,
          totalSold: parseFloat(row.total_sold) || 0,
          consignmentDate: row.consignment_date
        })),
        purchases: {
          total: parseInt(purchaseStats.rows[0]?.total_orders) || 0,
          pending: parseInt(purchaseStats.rows[0]?.pending_orders) || 0,
          received: parseInt(purchaseStats.rows[0]?.received_orders) || 0,
          totalAmount: parseFloat(purchaseStats.rows[0]?.total_amount) || 0,
          thisMonth: parseInt(purchaseStats.rows[0]?.orders_this_month) || 0,
          amountThisMonth: parseFloat(purchaseStats.rows[0]?.amount_this_month) || 0
        },
        recentPurchases: recentPurchases.rows.map(row => ({
          id: row.id,
          orderNumber: row.order_number,
          supplierName: row.supplier_name || 'Sin proveedor',
          status: row.status,
          totalAmount: parseFloat(row.total_amount) || 0,
          purchaseDate: row.purchase_date
        })),
        posSales: {
          today: parseFloat(posSales.rows[0]?.sales_today) || 0,
          ordersToday: parseInt(posSales.rows[0]?.orders_today) || 0,
          month: parseFloat(posSales.rows[0]?.sales_month) || 0,
          ordersMonth: parseInt(posSales.rows[0]?.orders_month) || 0,
          year: parseFloat(posSales.rows[0]?.sales_year) || 0,
          ordersYear: parseInt(posSales.rows[0]?.orders_year) || 0
        },
        posByTerminal: posByTerminal.rows.map(row => ({
          terminalId: row.terminal_id,
          terminalName: row.terminal_name,
          salesToday: parseFloat(row.sales_today) || 0,
          salesMonth: parseFloat(row.sales_month) || 0
        })),
        consignmentsBySupplier: consignmentsBySupplier.rows.map(row => ({
          supplierId: row.supplier_id,
          supplierName: row.supplier_name,
          totalOrders: parseInt(row.total_orders) || 0,
          totalCost: parseFloat(row.total_cost) || 0,
          totalSold: parseFloat(row.total_sold) || 0,
          pendingToPay: parseFloat(row.pending_to_pay) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Market Dashboard API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener dashboard'
    }, { status: 500 })
  }
}
