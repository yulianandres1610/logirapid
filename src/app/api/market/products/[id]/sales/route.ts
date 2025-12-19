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

    // Get current date info
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    // Previous periods for trend calculation
    const prevWeekStart = new Date(startOfWeek)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1)

    // Try to get sales data from market_order_items if exists
    let weekData = { total: 0, quantity: 0, trend: 0 }
    let monthData = { total: 0, quantity: 0, trend: 0 }
    let yearData = { total: 0, quantity: 0, trend: 0 }

    try {
      // This week's sales
      const weekResult = await db.query(`
        SELECT COALESCE(SUM(quantity), 0) as quantity, COALESCE(SUM(total), 0) as total
        FROM market_order_items moi
        JOIN market_orders mo ON moi.order_id = mo.id
        WHERE moi.product_id = $1 AND mo.company_id = $2
        AND mo.created_at >= $3 AND mo.status != 'cancelled'
      `, [productId, parseInt(companyId), startOfWeek.toISOString()])

      // Previous week for trend
      const prevWeekResult = await db.query(`
        SELECT COALESCE(SUM(quantity), 0) as quantity
        FROM market_order_items moi
        JOIN market_orders mo ON moi.order_id = mo.id
        WHERE moi.product_id = $1 AND mo.company_id = $2
        AND mo.created_at >= $3 AND mo.created_at < $4 AND mo.status != 'cancelled'
      `, [productId, parseInt(companyId), prevWeekStart.toISOString(), startOfWeek.toISOString()])

      weekData = {
        total: parseFloat(weekResult.rows[0]?.total) || 0,
        quantity: parseInt(weekResult.rows[0]?.quantity) || 0,
        trend: prevWeekResult.rows[0]?.quantity > 0
          ? Math.round(((weekResult.rows[0]?.quantity - prevWeekResult.rows[0]?.quantity) / prevWeekResult.rows[0]?.quantity) * 100)
          : 0
      }

      // This month's sales
      const monthResult = await db.query(`
        SELECT COALESCE(SUM(quantity), 0) as quantity, COALESCE(SUM(total), 0) as total
        FROM market_order_items moi
        JOIN market_orders mo ON moi.order_id = mo.id
        WHERE moi.product_id = $1 AND mo.company_id = $2
        AND mo.created_at >= $3 AND mo.status != 'cancelled'
      `, [productId, parseInt(companyId), startOfMonth.toISOString()])

      const prevMonthResult = await db.query(`
        SELECT COALESCE(SUM(quantity), 0) as quantity
        FROM market_order_items moi
        JOIN market_orders mo ON moi.order_id = mo.id
        WHERE moi.product_id = $1 AND mo.company_id = $2
        AND mo.created_at >= $3 AND mo.created_at < $4 AND mo.status != 'cancelled'
      `, [productId, parseInt(companyId), prevMonthStart.toISOString(), startOfMonth.toISOString()])

      monthData = {
        total: parseFloat(monthResult.rows[0]?.total) || 0,
        quantity: parseInt(monthResult.rows[0]?.quantity) || 0,
        trend: prevMonthResult.rows[0]?.quantity > 0
          ? Math.round(((monthResult.rows[0]?.quantity - prevMonthResult.rows[0]?.quantity) / prevMonthResult.rows[0]?.quantity) * 100)
          : 0
      }

      // This year's sales
      const yearResult = await db.query(`
        SELECT COALESCE(SUM(quantity), 0) as quantity, COALESCE(SUM(total), 0) as total
        FROM market_order_items moi
        JOIN market_orders mo ON moi.order_id = mo.id
        WHERE moi.product_id = $1 AND mo.company_id = $2
        AND mo.created_at >= $3 AND mo.status != 'cancelled'
      `, [productId, parseInt(companyId), startOfYear.toISOString()])

      const prevYearResult = await db.query(`
        SELECT COALESCE(SUM(quantity), 0) as quantity
        FROM market_order_items moi
        JOIN market_orders mo ON moi.order_id = mo.id
        WHERE moi.product_id = $1 AND mo.company_id = $2
        AND mo.created_at >= $3 AND mo.created_at < $4 AND mo.status != 'cancelled'
      `, [productId, parseInt(companyId), prevYearStart.toISOString(), startOfYear.toISOString()])

      yearData = {
        total: parseFloat(yearResult.rows[0]?.total) || 0,
        quantity: parseInt(yearResult.rows[0]?.quantity) || 0,
        trend: prevYearResult.rows[0]?.quantity > 0
          ? Math.round(((yearResult.rows[0]?.quantity - prevYearResult.rows[0]?.quantity) / prevYearResult.rows[0]?.quantity) * 100)
          : 0
      }
    } catch {
      // Tables may not exist, return empty data
    }

    return NextResponse.json({
      success: true,
      data: {
        week: weekData,
        month: monthData,
        year: yearData,
        chartData: [] // Could add daily chart data here
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
