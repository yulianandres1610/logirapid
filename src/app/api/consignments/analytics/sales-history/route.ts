import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * GET /api/consignments/analytics/sales-history
 * Get historical sales data for charts
 *
 * Query params:
 * - days: Number of days to include (default 30)
 * - granularity: 'day' | 'week' | 'month' (default 'day')
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

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const granularity = searchParams.get('granularity') || 'day'

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Build date truncation based on granularity
    let dateTrunc: string
    switch (granularity) {
      case 'week':
        dateTrunc = 'week'
        break
      case 'month':
        dateTrunc = 'month'
        break
      default:
        dateTrunc = 'day'
    }

    // Get sales history
    const salesQuery = `
      SELECT
        DATE_TRUNC('${dateTrunc}', cwt.created_at) as period,
        COALESCE(SUM(CASE WHEN cwt.transaction_type = 'sale' THEN cwt.amount ELSE 0 END), 0) as sales,
        COALESCE(SUM(CASE WHEN cwt.transaction_type = 'return' THEN ABS(cwt.amount) ELSE 0 END), 0) as returns,
        COUNT(DISTINCT CASE WHEN cwt.transaction_type = 'sale' THEN cwt.id END) as sale_count
      FROM consignment_wallet_transactions cwt
      JOIN consignment_wallets cw ON cw.id = cwt.wallet_id
      WHERE cw.provider_company_id = $1
        AND cwt.created_at >= $2
        AND cwt.transaction_type IN ('sale', 'return')
      GROUP BY DATE_TRUNC('${dateTrunc}', cwt.created_at)
      ORDER BY period
    `

    const salesHistory = await db.query(salesQuery, [currentCompanyId, startDate.toISOString()])

    // Get previous period for comparison
    const previousStartDate = new Date(startDate)
    previousStartDate.setDate(previousStartDate.getDate() - days)

    const previousSalesQuery = `
      SELECT COALESCE(SUM(cwt.amount), 0) as total
      FROM consignment_wallet_transactions cwt
      JOIN consignment_wallets cw ON cw.id = cwt.wallet_id
      WHERE cw.provider_company_id = $1
        AND cwt.transaction_type = 'sale'
        AND cwt.created_at >= $2
        AND cwt.created_at < $3
    `

    const previousSalesResult = await db.query(previousSalesQuery, [
      currentCompanyId,
      previousStartDate.toISOString(),
      startDate.toISOString()
    ])
    const previousPeriodTotal = parseFloat(previousSalesResult.rows[0]?.total || '0')

    // Calculate current period total
    let currentPeriodTotal = 0
    let currentPeriodReturns = 0
    let totalSaleCount = 0

    const dataPoints = salesHistory.rows.map(row => {
      const sales = parseFloat(row.sales) || 0
      const returns = parseFloat(row.returns) || 0
      const saleCount = parseInt(row.sale_count) || 0

      currentPeriodTotal += sales
      currentPeriodReturns += returns
      totalSaleCount += saleCount

      return {
        date: row.period,
        sales,
        returns,
        netSales: sales - returns,
        saleCount
      }
    })

    // Calculate trend
    const changePercent = previousPeriodTotal > 0
      ? ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100
      : currentPeriodTotal > 0 ? 100 : 0

    // Get top products sold
    const topProductsQuery = `
      SELECT
        mp.id as product_id,
        mp.name as product_name,
        mp.sku,
        COALESCE(SUM(coi.quantity_sold), 0) as total_sold,
        COALESCE(SUM(coi.quantity_sold * coi.provider_price), 0) as total_value
      FROM consignment_order_items coi
      JOIN consignment_orders co ON co.id = coi.consignment_order_id
      LEFT JOIN market_products mp ON mp.id = coi.product_id
      WHERE co.provider_company_id = $1
        AND co.status IN ('received', 'completed')
        AND coi.quantity_sold > 0
      GROUP BY mp.id, mp.name, mp.sku
      ORDER BY total_sold DESC
      LIMIT 5
    `

    const topProducts = await db.query(topProductsQuery, [currentCompanyId])

    return NextResponse.json({
      success: true,
      data: {
        history: dataPoints,
        summary: {
          currentPeriodTotal,
          currentPeriodReturns,
          currentPeriodNet: currentPeriodTotal - currentPeriodReturns,
          previousPeriodTotal,
          changePercent,
          totalSaleCount,
          days,
          granularity
        },
        topProducts: topProducts.rows.map(p => ({
          id: p.product_id,
          name: p.product_name,
          sku: p.sku,
          totalSold: parseInt(p.total_sold) || 0,
          totalValue: parseFloat(p.total_value) || 0
        }))
      }
    })

  } catch (error) {
    console.error('[Sales History] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener histórico de ventas'
    }, { status: 500 })
  }
}
