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

    // Get order stats
    const orderStats = await db.query(`
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
    const ordersByMonth = await db.query(`
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
    const recentOrders = await db.query(`
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
    const productStats = await db.query(`
      SELECT
        COUNT(*) as total_products,
        COUNT(*) FILTER (WHERE quantity_on_hand > 0) as products_in_stock,
        COUNT(*) FILTER (WHERE quantity_on_hand <= minimum_stock AND quantity_on_hand > 0) as low_stock_products,
        COUNT(*) FILTER (WHERE quantity_on_hand = 0) as out_of_stock_products
      FROM market_products
      WHERE company_id = $1 AND is_active = true
    `, [companyId])

    // Get consignment statistics
    const consignmentStats = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
        COUNT(*) FILTER (WHERE status = 'partial') as partial_orders,
        COUNT(*) FILTER (WHERE status = 'received') as received_orders,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(total_sold), 0) as total_sold,
        COALESCE(SUM(total_returned), 0) as total_returned,
        COUNT(*) FILTER (WHERE DATE_TRUNC('month', consignment_date) = DATE_TRUNC('month', CURRENT_DATE)) as orders_this_month,
        COALESCE(SUM(total_cost) FILTER (WHERE DATE_TRUNC('month', consignment_date) = DATE_TRUNC('month', CURRENT_DATE)), 0) as cost_this_month
      FROM consignment_orders
      WHERE company_id = $1
    `, [companyId])

    // Get recent consignments
    const recentConsignments = await db.query(`
      SELECT
        co.id,
        co.order_number,
        co.status,
        co.total_cost,
        co.total_sold,
        co.consignment_date,
        cs.name as supplier_name
      FROM consignment_orders co
      LEFT JOIN consignment_suppliers cs ON co.supplier_id = cs.id
      WHERE co.company_id = $1
      ORDER BY co.created_at DESC
      LIMIT 5
    `, [companyId])

    // Get purchase statistics
    const purchaseStats = await db.query(`
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
        }
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
