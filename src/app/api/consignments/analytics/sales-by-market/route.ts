import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

/**
 * GET /api/consignments/analytics/sales-by-market
 * Get sales breakdown by receiving market
 *
 * Query params:
 * - limit: Number of markets to return (default 5)
 * - period: 'month' | 'quarter' | 'year' | 'all' (default 'month')
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
    const limit = parseInt(searchParams.get('limit') || '5')
    const period = searchParams.get('period') || 'month'

    // Calculate date filter
    const now = new Date()
    let dateFilter = ''
    let dateParam: string | null = null

    switch (period) {
      case 'month':
        dateParam = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        dateFilter = `AND cwt.created_at >= $2`
        break
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        dateParam = quarterStart.toISOString()
        dateFilter = `AND cwt.created_at >= $2`
        break
      case 'year':
        dateParam = new Date(now.getFullYear(), 0, 1).toISOString()
        dateFilter = `AND cwt.created_at >= $2`
        break
      default:
        dateFilter = ''
    }

    // Get sales by market
    const query = `
      SELECT
        cw.receiver_company_id as market_id,
        r.legalname as market_name,
        r.logo_url as market_logo,
        COALESCE(SUM(CASE WHEN cwt.transaction_type = 'sale' THEN cwt.amount ELSE 0 END), 0) as total_sales,
        COALESCE(SUM(CASE WHEN cwt.transaction_type = 'return' THEN ABS(cwt.amount) ELSE 0 END), 0) as total_returns,
        cw.balance as pending_balance,
        cw.total_paid,
        COUNT(DISTINCT CASE WHEN cwt.transaction_type = 'sale' THEN cwt.id END) as sale_count
      FROM consignment_wallets cw
      LEFT JOIN companies r ON r.id = cw.receiver_company_id
      LEFT JOIN consignment_wallet_transactions cwt ON cwt.wallet_id = cw.id ${dateFilter}
      WHERE cw.provider_company_id = $1
      GROUP BY cw.receiver_company_id, r.legalname, r.logo_url, cw.balance, cw.total_paid
      ORDER BY total_sales DESC
      LIMIT ${limit}
    `

    const params: (string | number)[] = [currentCompanyId]
    if (dateParam) params.push(dateParam)

    const salesByMarket = await db.query(query, params)

    // Calculate totals
    let grandTotalSales = 0
    for (const row of salesByMarket.rows) {
      grandTotalSales += parseFloat(row.total_sales) || 0
    }

    // Get total from all markets for percentage calculation
    const totalQuery = `
      SELECT COALESCE(SUM(cwt.amount), 0) as total
      FROM consignment_wallet_transactions cwt
      JOIN consignment_wallets cw ON cw.id = cwt.wallet_id
      WHERE cw.provider_company_id = $1
        AND cwt.transaction_type = 'sale'
        ${dateFilter}
    `
    const totalResult = await db.query(totalQuery, params)
    const allMarketsTotalSales = parseFloat(totalResult.rows[0]?.total || '0')

    return NextResponse.json({
      success: true,
      data: {
        markets: salesByMarket.rows.map(m => ({
          id: m.market_id,
          name: m.market_name,
          logoUrl: m.market_logo,
          totalSales: parseFloat(m.total_sales) || 0,
          totalReturns: parseFloat(m.total_returns) || 0,
          netSales: (parseFloat(m.total_sales) || 0) - (parseFloat(m.total_returns) || 0),
          pendingBalance: parseFloat(m.pending_balance) || 0,
          totalPaid: parseFloat(m.total_paid) || 0,
          saleCount: parseInt(m.sale_count) || 0,
          percentage: allMarketsTotalSales > 0
            ? ((parseFloat(m.total_sales) || 0) / allMarketsTotalSales) * 100
            : 0
        })),
        summary: {
          totalSales: allMarketsTotalSales,
          topMarketsTotal: grandTotalSales,
          marketCount: salesByMarket.rows.length,
          period
        }
      }
    })

  } catch (error) {
    console.error('[Sales by Market] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener ventas por mercado'
    }, { status: 500 })
  }
}
