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
      const secret = process.env.JWT_SECRET || 'your-secret-key'
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

    // Get wallet balances
    const walletBalances = await db.query(`
      SELECT
        currency,
        COALESCE(available_balance, 0) as available_balance,
        COALESCE(reserved_balance, 0) as reserved_balance,
        COALESCE(total_deposits, 0) as total_deposits,
        COALESCE(total_withdrawals, 0) as total_withdrawals
      FROM broker_wallet_balances
      WHERE company_id = $1
      ORDER BY
        CASE currency
          WHEN 'USD' THEN 1
          WHEN 'EUR' THEN 2
          WHEN 'CUP' THEN 3
          WHEN 'MLC' THEN 4
          ELSE 5
        END
    `, [companyId])

    // Format wallet data
    const wallet = {
      balances: walletBalances.rows.map(row => ({
        currency: row.currency,
        availableBalance: parseFloat(row.available_balance) || 0,
        reservedBalance: parseFloat(row.reserved_balance) || 0,
        totalDeposits: parseFloat(row.total_deposits) || 0,
        totalWithdrawals: parseFloat(row.total_withdrawals) || 0
      })),
      primaryBalance: walletBalances.rows.find(r => r.currency === 'USD')
        ? parseFloat(walletBalances.rows.find(r => r.currency === 'USD')!.available_balance)
        : 0
    }

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
        wallet
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
