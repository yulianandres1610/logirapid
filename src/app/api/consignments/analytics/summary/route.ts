import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * GET /api/consignments/analytics/summary
 * Get summary analytics for consignments dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const companyIdCookie = cookieStore.get('user-company-id')
    const currentCompanyId = companyIdCookie?.value

    if (!currentCompanyId) {
      return NextResponse.json({
        success: false,
        error: 'No autenticado'
      }, { status: 401 })
    }

    // Get current month boundaries
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    // Total pending collection (as provider)
    const pendingCollectionResult = await db.query(`
      SELECT COALESCE(SUM(balance), 0) as total
      FROM consignment_wallets
      WHERE provider_company_id = $1
    `, [currentCompanyId])
    const pendingCollection = parseFloat(pendingCollectionResult.rows[0]?.total || '0')

    // In transit value (orders sent but not received)
    const inTransitResult = await db.query(`
      SELECT
        COUNT(*) as order_count,
        COALESCE(SUM(subtotal), 0) as total_value
      FROM consignment_orders
      WHERE provider_company_id = $1
        AND status IN ('pending_approval', 'approved', 'in_transit')
    `, [currentCompanyId])
    const inTransitOrders = parseInt(inTransitResult.rows[0]?.order_count || '0')
    const inTransitValue = parseFloat(inTransitResult.rows[0]?.total_value || '0')

    // Sales this month (as provider - from wallet transactions)
    const currentMonthSalesResult = await db.query(`
      SELECT COALESCE(SUM(cwt.amount), 0) as total
      FROM consignment_wallet_transactions cwt
      JOIN consignment_wallets cw ON cw.id = cwt.wallet_id
      WHERE cw.provider_company_id = $1
        AND cwt.transaction_type = 'sale'
        AND cwt.created_at >= $2
    `, [currentCompanyId, startOfMonth.toISOString()])
    const currentMonthSales = parseFloat(currentMonthSalesResult.rows[0]?.total || '0')

    // Sales last month for comparison
    const lastMonthSalesResult = await db.query(`
      SELECT COALESCE(SUM(cwt.amount), 0) as total
      FROM consignment_wallet_transactions cwt
      JOIN consignment_wallets cw ON cw.id = cwt.wallet_id
      WHERE cw.provider_company_id = $1
        AND cwt.transaction_type = 'sale'
        AND cwt.created_at >= $2
        AND cwt.created_at <= $3
    `, [currentCompanyId, startOfLastMonth.toISOString(), endOfLastMonth.toISOString()])
    const lastMonthSales = parseFloat(lastMonthSalesResult.rows[0]?.total || '0')

    // Calculate change percentage
    const salesChangePercent = lastMonthSales > 0
      ? ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100
      : currentMonthSales > 0 ? 100 : 0

    // Returns this month
    const currentMonthReturnsResult = await db.query(`
      SELECT COALESCE(SUM(total_value), 0) as total
      FROM consignment_returns cr
      JOIN consignment_orders co ON co.id = cr.consignment_order_id
      WHERE co.provider_company_id = $1
        AND cr.created_at >= $2
    `, [currentCompanyId, startOfMonth.toISOString()])
    const currentMonthReturns = parseFloat(currentMonthReturnsResult.rows[0]?.total || '0')

    // Returns last month
    const lastMonthReturnsResult = await db.query(`
      SELECT COALESCE(SUM(total_value), 0) as total
      FROM consignment_returns cr
      JOIN consignment_orders co ON co.id = cr.consignment_order_id
      WHERE co.provider_company_id = $1
        AND cr.created_at >= $2
        AND cr.created_at <= $3
    `, [currentCompanyId, startOfLastMonth.toISOString(), endOfLastMonth.toISOString()])
    const lastMonthReturns = parseFloat(lastMonthReturnsResult.rows[0]?.total || '0')

    const returnsChangePercent = lastMonthReturns > 0
      ? ((currentMonthReturns - lastMonthReturns) / lastMonthReturns) * 100
      : currentMonthReturns > 0 ? 100 : 0

    // Active markets (unique receivers with active consignments)
    const activeMarketsResult = await db.query(`
      SELECT COUNT(DISTINCT receiver_company_id) as count
      FROM consignment_orders
      WHERE provider_company_id = $1
        AND status IN ('pending_approval', 'approved', 'received')
    `, [currentCompanyId])
    const activeMarkets = parseInt(activeMarketsResult.rows[0]?.count || '0')

    // Orders by status
    const ordersByStatusResult = await db.query(`
      SELECT status, COUNT(*) as count
      FROM consignment_orders
      WHERE provider_company_id = $1
      GROUP BY status
    `, [currentCompanyId])
    const ordersByStatus: Record<string, number> = {}
    for (const row of ordersByStatusResult.rows) {
      ordersByStatus[row.status] = parseInt(row.count)
    }

    // Pending payment requests
    const pendingPaymentsResult = await db.query(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(amount_requested - amount_paid), 0) as total
      FROM consignment_payment_requests
      WHERE provider_company_id = $1
        AND status IN ('pending', 'partial')
    `, [currentCompanyId])
    const pendingPaymentRequests = parseInt(pendingPaymentsResult.rows[0]?.count || '0')
    const pendingPaymentAmount = parseFloat(pendingPaymentsResult.rows[0]?.total || '0')

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          pendingCollection: {
            value: pendingCollection,
            label: 'Por Cobrar'
          },
          inTransit: {
            value: inTransitValue,
            orderCount: inTransitOrders,
            label: 'En Tránsito'
          },
          monthSales: {
            value: currentMonthSales,
            changePercent: salesChangePercent,
            label: 'Vendido este Mes'
          },
          monthReturns: {
            value: currentMonthReturns,
            changePercent: returnsChangePercent,
            label: 'Devoluciones'
          }
        },
        summary: {
          activeMarkets,
          ordersByStatus,
          pendingPaymentRequests,
          pendingPaymentAmount
        }
      }
    })

  } catch (error) {
    console.error('[Analytics Summary] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener analytics'
    }, { status: 500 })
  }
}
