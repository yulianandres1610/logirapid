import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const companyId = cookieStore.get('user-company-id')?.value

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'Sin empresa asignada' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
    }

    // Get period from query params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'

    const now = new Date()
    const sales: { period: string; quantity: number; revenue: number; orders: number }[] = []

    try {
      // Helper to get combined sales (POS + Wholesale) for a date range
      const getCombinedSales = async (startDate: Date, endDate: Date) => {
        // POS sales
        const posResult = await db.query(`
          SELECT
            COALESCE(SUM(pol.quantity), 0) as quantity,
            COALESCE(SUM(pol.total), 0) as total,
            COUNT(DISTINCT po.id) as orders
          FROM market_pos_order_lines pol
          JOIN market_pos_orders po ON pol.order_id = po.id
          WHERE pol.product_id = $1 AND po.company_id = $2
          AND po.created_at >= $3 AND po.created_at < $4
          AND po.status NOT IN ('cancelled', 'voided', 'draft')
        `, [productId, parseInt(companyId), startDate.toISOString(), endDate.toISOString()])

        // Wholesale sales
        const wholesaleResult = await db.query(`
          SELECT
            COALESCE(SUM(COALESCE(il.quantity_delivered, il.quantity)), 0) as quantity,
            COALESCE(SUM(il.total), 0) as total,
            COUNT(DISTINCT i.id) as orders
          FROM market_invoice_lines il
          JOIN market_invoices i ON il.invoice_id = i.id
          WHERE il.product_id = $1 AND i.company_id = $2
          AND COALESCE(i.delivered_at, i.created_at) >= $3
          AND COALESCE(i.delivered_at, i.created_at) < $4
          AND i.status IN ('delivered', 'paid', 'completed')
        `, [productId, parseInt(companyId), startDate.toISOString(), endDate.toISOString()])

        const posQty = parseInt(posResult.rows[0]?.quantity) || 0
        const posTotal = parseFloat(posResult.rows[0]?.total) || 0
        const posOrders = parseInt(posResult.rows[0]?.orders) || 0

        const wholesaleQty = parseInt(wholesaleResult.rows[0]?.quantity) || 0
        const wholesaleTotal = parseFloat(wholesaleResult.rows[0]?.total) || 0
        const wholesaleOrders = parseInt(wholesaleResult.rows[0]?.orders) || 0

        return {
          quantity: posQty + wholesaleQty,
          revenue: posTotal + wholesaleTotal,
          orders: posOrders + wholesaleOrders
        }
      }

      if (period === 'week') {
        // Get daily data for the last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
          const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)

          const result = await getCombinedSales(startOfDay, endOfDay)
          const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
          sales.push({
            period: dayNames[date.getDay()],
            ...result
          })
        }
      } else if (period === 'month') {
        // Get weekly data for the last 4 weeks
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now)
          weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay())
          weekStart.setHours(0, 0, 0, 0)
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 7)

          const result = await getCombinedSales(weekStart, weekEnd)
          sales.push({
            period: `Sem ${4 - i}`,
            ...result
          })
        }
      } else if (period === 'year') {
        // Get monthly data for the last 12 months
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        for (let i = 11; i >= 0; i--) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

          const result = await getCombinedSales(monthStart, monthEnd)
          sales.push({
            period: monthNames[monthStart.getMonth()],
            ...result
          })
        }
      }
    } catch (err) {
      // Tables may not exist, return empty data
      console.error('[Product Sales API] Query error:', err)
    }

    // Calculate sales velocity (units per day average)
    const totalQuantity = sales.reduce((sum, s) => sum + s.quantity, 0)
    const daysInPeriod = period === 'week' ? 7 : period === 'month' ? 30 : 365
    const salesVelocity = daysInPeriod > 0 ? totalQuantity / daysInPeriod : 0

    return NextResponse.json({
      success: true,
      data: {
        sales,
        period,
        summary: {
          totalQuantity,
          totalRevenue: sales.reduce((sum, s) => sum + s.revenue, 0),
          totalOrders: sales.reduce((sum, s) => sum + s.orders, 0),
          salesVelocity: Math.round(salesVelocity * 100) / 100, // Units per day
          avgOrderValue: sales.reduce((sum, s) => sum + s.revenue, 0) / Math.max(1, sales.reduce((sum, s) => sum + s.orders, 0))
        }
      }
    })
  } catch (error) {
    console.error('Error getting product sales:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al obtener ventas'
    }, { status: 500 })
  }
}
