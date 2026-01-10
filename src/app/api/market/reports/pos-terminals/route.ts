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

/**
 * GET /api/market/reports/pos-terminals
 * Returns POS terminal performance report
 * Query params: startDate, endDate, terminalIds
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({ success: false, error: 'Token inválido' }, { status: 401 })
    }

    const companyId = payload.companyId
    const { searchParams } = new URL(request.url)

    const startDate = searchParams.get('startDate') || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0]
    const terminalIdsParam = searchParams.get('terminalIds')
    const terminalIds = terminalIdsParam ? terminalIdsParam.split(',').map(id => parseInt(id)) : null

    // Performance by terminal
    const byTerminalResult = await db.query(`
      SELECT
        t.id as terminal_id,
        t.name as terminal_name,
        t.code as terminal_code,
        w.name as warehouse_name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_sales,
        COALESCE(AVG(o.total_amount), 0) as average_ticket,
        COUNT(DISTINCT s.id) as session_count,
        COUNT(DISTINCT DATE(o.created_at)) as active_days,
        MAX(o.created_at) as last_sale_at
      FROM market_pos_terminals t
      LEFT JOIN market_warehouses w ON t.warehouse_id = w.id
      LEFT JOIN market_pos_orders o ON t.id = o.pos_terminal_id
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
      LEFT JOIN market_pos_sessions s ON t.id = s.pos_terminal_id
        AND DATE(s.opened_at) BETWEEN $2 AND $3
      WHERE t.company_id = $1 AND t.is_active = true
      GROUP BY t.id, t.name, t.code, w.name
      ORDER BY total_sales DESC
    `, [companyId, startDate, endDate])

    // Calculate previous period for comparison
    const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    const prevStartDate = new Date(new Date(startDate).getTime() - (daysDiff * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
    const prevEndDate = new Date(new Date(startDate).getTime() - (24 * 60 * 60 * 1000)).toISOString().split('T')[0]

    // Previous period by terminal
    const prevByTerminalResult = await db.query(`
      SELECT
        t.id as terminal_id,
        COALESCE(SUM(o.total_amount), 0) as prev_sales,
        COUNT(o.id) as prev_orders
      FROM market_pos_terminals t
      LEFT JOIN market_pos_orders o ON t.id = o.pos_terminal_id
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
      WHERE t.company_id = $1 AND t.is_active = true
      GROUP BY t.id
    `, [companyId, prevStartDate, prevEndDate])

    const prevByTerminalMap = new Map<number, { prevSales: number; prevOrders: number }>(
      prevByTerminalResult.rows.map(row => [row.terminal_id, {
        prevSales: parseFloat(row.prev_sales) || 0,
        prevOrders: parseInt(row.prev_orders) || 0
      }])
    )

    // Sales by terminal and day of week
    const byDayOfWeekResult = await db.query(`
      SELECT
        t.id as terminal_id,
        t.name as terminal_name,
        EXTRACT(DOW FROM o.created_at) as day_of_week,
        TO_CHAR(o.created_at, 'Day') as day_name,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as sales
      FROM market_pos_terminals t
      LEFT JOIN market_pos_orders o ON t.id = o.pos_terminal_id
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
      WHERE t.company_id = $1 AND t.is_active = true
      GROUP BY t.id, t.name, EXTRACT(DOW FROM o.created_at), TO_CHAR(o.created_at, 'Day')
      ORDER BY t.id, day_of_week
    `, [companyId, startDate, endDate])

    // Sales by terminal and hour
    const byHourResult = await db.query(`
      SELECT
        t.id as terminal_id,
        EXTRACT(HOUR FROM o.created_at) as hour,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as sales
      FROM market_pos_terminals t
      LEFT JOIN market_pos_orders o ON t.id = o.pos_terminal_id
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
      WHERE t.company_id = $1 AND t.is_active = true
      GROUP BY t.id, EXTRACT(HOUR FROM o.created_at)
      ORDER BY t.id, hour
    `, [companyId, startDate, endDate])

    // Top products by terminal
    const topProductsResult = await db.query(`
      SELECT
        t.id as terminal_id,
        t.name as terminal_name,
        ol.product_id,
        COALESCE(ol.product_name, p.name, 'Producto') as product_name,
        SUM(ol.quantity) as quantity,
        SUM(ol.total) as sales
      FROM market_pos_terminals t
      JOIN market_pos_orders o ON t.id = o.pos_terminal_id
      JOIN market_pos_order_lines ol ON o.id = ol.order_id
      LEFT JOIN market_products p ON ol.product_id = p.id
      WHERE t.company_id = $1
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
      GROUP BY t.id, t.name, ol.product_id, ol.product_name, p.name
      ORDER BY t.id, sales DESC
    `, [companyId, startDate, endDate])

    // Group top products by terminal (top 5 each)
    const topProductsByTerminal = new Map<number, any[]>()
    for (const row of topProductsResult.rows) {
      const terminalId = row.terminal_id
      if (!topProductsByTerminal.has(terminalId)) {
        topProductsByTerminal.set(terminalId, [])
      }
      const products = topProductsByTerminal.get(terminalId)!
      if (products.length < 5) {
        products.push({
          productId: row.product_id,
          productName: row.product_name,
          quantity: parseFloat(row.quantity) || 0,
          sales: parseFloat(row.sales) || 0
        })
      }
    }

    // Summary totals
    const totalSales = byTerminalResult.rows.reduce((sum, row) => sum + parseFloat(row.total_sales || 0), 0)
    const totalOrders = byTerminalResult.rows.reduce((sum, row) => sum + parseInt(row.order_count || 0), 0)
    const activeTerminals = byTerminalResult.rows.filter(row => parseInt(row.order_count) > 0).length

    // Daily trend by terminal
    const dailyTrendResult = await db.query(`
      SELECT
        t.id as terminal_id,
        DATE(o.created_at) as date,
        COALESCE(SUM(o.total_amount), 0) as sales,
        COUNT(o.id) as orders
      FROM market_pos_terminals t
      LEFT JOIN market_pos_orders o ON t.id = o.pos_terminal_id
        AND o.status IN ('paid', 'completed')
        AND DATE(o.created_at) BETWEEN $2 AND $3
      WHERE t.company_id = $1 AND t.is_active = true
      GROUP BY t.id, DATE(o.created_at)
      ORDER BY date, t.id
    `, [companyId, startDate, endDate])

    // Group daily trend by date
    const dailyTrendByDate = new Map<string, any[]>()
    for (const row of dailyTrendResult.rows) {
      if (!row.date) continue
      const dateStr = new Date(row.date).toISOString().split('T')[0]
      if (!dailyTrendByDate.has(dateStr)) {
        dailyTrendByDate.set(dateStr, [])
      }
      dailyTrendByDate.get(dateStr)!.push({
        terminalId: row.terminal_id,
        sales: parseFloat(row.sales) || 0,
        orders: parseInt(row.orders) || 0
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        filters: {
          startDate,
          endDate,
          terminalIds
        },
        summary: {
          totalTerminals: byTerminalResult.rows.length,
          activeTerminals,
          totalSales,
          totalOrders,
          averagePerTerminal: activeTerminals > 0 ? totalSales / activeTerminals : 0
        },
        byTerminal: byTerminalResult.rows.map(row => {
          const prev = prevByTerminalMap.get(row.terminal_id) || { prevSales: 0, prevOrders: 0 }
          const currentSales = parseFloat(row.total_sales) || 0
          const percentChange = prev.prevSales > 0
            ? ((currentSales - prev.prevSales) / prev.prevSales) * 100
            : 0

          return {
            terminalId: row.terminal_id,
            terminalName: row.terminal_name,
            terminalCode: row.terminal_code,
            warehouseName: row.warehouse_name,
            orderCount: parseInt(row.order_count) || 0,
            totalSales: currentSales,
            averageTicket: parseFloat(row.average_ticket) || 0,
            sessionCount: parseInt(row.session_count) || 0,
            activeDays: parseInt(row.active_days) || 0,
            lastSaleAt: row.last_sale_at,
            comparison: {
              previousPeriodSales: prev.prevSales,
              previousPeriodOrders: prev.prevOrders,
              percentChange: Math.round(percentChange * 100) / 100
            },
            topProducts: topProductsByTerminal.get(row.terminal_id) || []
          }
        }),
        byDayOfWeek: Array.from(
          byDayOfWeekResult.rows.reduce((map, row) => {
            const day = parseInt(row.day_of_week)
            if (!map.has(day)) {
              map.set(day, {
                dayOfWeek: day,
                dayName: row.day_name?.trim(),
                terminals: []
              })
            }
            map.get(day).terminals.push({
              terminalId: row.terminal_id,
              terminalName: row.terminal_name,
              orderCount: parseInt(row.order_count) || 0,
              sales: parseFloat(row.sales) || 0
            })
            return map
          }, new Map<number, any>())
        ).map(([_, value]) => value).sort((a, b) => a.dayOfWeek - b.dayOfWeek),
        byHour: Array.from(
          byHourResult.rows.reduce((map, row) => {
            const hour = parseInt(row.hour)
            if (!map.has(hour)) {
              map.set(hour, {
                hour,
                terminals: []
              })
            }
            map.get(hour).terminals.push({
              terminalId: row.terminal_id,
              orderCount: parseInt(row.order_count) || 0,
              sales: parseFloat(row.sales) || 0
            })
            return map
          }, new Map<number, any>())
        ).map(([_, value]) => value).sort((a, b) => a.hour - b.hour),
        dailyTrend: Array.from(dailyTrendByDate.entries()).map(([date, terminals]) => ({
          date,
          terminals
        })).sort((a, b) => a.date.localeCompare(b.date))
      }
    })

  } catch (error) {
    console.error('[POS Terminals Report API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener reporte de terminales'
    }, { status: 500 })
  }
}
