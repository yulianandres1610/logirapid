import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/drivers/[id]/statistics
 * Obtiene estadísticas del driver (cajas, bultos, rutas)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const driverId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'month'

    if (isNaN(driverId)) {
      return NextResponse.json(
        { success: false, error: 'ID de driver inválido' },
        { status: 400 }
      )
    }

    // Get driver inventory stats
    const inventoryQuery = `
      SELECT
        COALESCE(di.cajas_vacias_count, 0) as "cajasVaciasCount",
        COALESCE(di.bultos_count, 0) as "bultosCount",
        COALESCE(di.cajas_vacias_capacity, 50) as "cajasVaciasCapacity",
        COALESCE(di.bultos_capacity, 100) as "bultosCapacity"
      FROM driver_inventory di
      WHERE di.driver_id = $1
    `
    const inventoryResult = await db.query(inventoryQuery, [driverId])

    // Get empaques count by estado
    const empaquesQuery = `
      SELECT
        estado,
        COUNT(*) as count
      FROM empaques
      WHERE driver_id = $1
      GROUP BY estado
    `
    const empaquesResult = await db.query(empaquesQuery, [driverId])

    // Get routes stats
    const routesQuery = `
      SELECT
        COUNT(*) as "totalRoutes",
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as "completedRoutes",
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as "activeRoutes",
        SUM(COALESCE(totalpackages, 0)) as "totalPackages",
        SUM(COALESCE(deliveredpackages, 0)) as "deliveredPackages"
      FROM routes
      WHERE driverid = $1
    `
    const routesResult = await db.query(routesQuery, [driverId])

    // Calculate date range for chart data
    let dateCondition = ''
    if (range === 'day') {
      dateCondition = "AND created_at >= NOW() - INTERVAL '24 hours'"
    } else if (range === 'week') {
      dateCondition = "AND created_at >= NOW() - INTERVAL '7 days'"
    } else if (range === 'month') {
      dateCondition = "AND created_at >= NOW() - INTERVAL '30 days'"
    } else if (range === 'year') {
      dateCondition = "AND created_at >= NOW() - INTERVAL '1 year'"
    }

    // Get activity per day for chart
    const activityQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM empaques
      WHERE driver_id = $1 ${dateCondition}
      GROUP BY DATE(created_at)
      ORDER BY date
    `
    const activityResult = await db.query(activityQuery, [driverId])

    const inventory = inventoryResult.rows[0] || {
      cajasVaciasCount: 0,
      bultosCount: 0,
      cajasVaciasCapacity: 50,
      bultosCapacity: 100
    }

    const routes = routesResult.rows[0] || {
      totalRoutes: 0,
      completedRoutes: 0,
      activeRoutes: 0,
      totalPackages: 0,
      deliveredPackages: 0
    }

    // Build estado breakdown
    const estadoBreakdown: Record<string, number> = {}
    empaquesResult.rows.forEach((row: any) => {
      estadoBreakdown[row.estado] = parseInt(row.count)
    })

    return NextResponse.json({
      success: true,
      data: {
        // Inventory stats
        cajasVaciasCount: parseInt(inventory.cajasVaciasCount) || 0,
        bultosCount: parseInt(inventory.bultosCount) || 0,
        cajasVaciasCapacity: parseInt(inventory.cajasVaciasCapacity) || 50,
        bultosCapacity: parseInt(inventory.bultosCapacity) || 100,

        // Calculated percentages
        cajasVaciasPercentage: Math.round(
          ((parseInt(inventory.cajasVaciasCount) || 0) / (parseInt(inventory.cajasVaciasCapacity) || 50)) * 100
        ),
        bultosPercentage: Math.round(
          ((parseInt(inventory.bultosCount) || 0) / (parseInt(inventory.bultosCapacity) || 100)) * 100
        ),

        // Routes stats
        totalRoutes: parseInt(routes.totalRoutes) || 0,
        completedRoutes: parseInt(routes.completedRoutes) || 0,
        activeRoutes: parseInt(routes.activeRoutes) || 0,
        totalPackages: parseInt(routes.totalPackages) || 0,
        deliveredPackages: parseInt(routes.deliveredPackages) || 0,

        // Estado breakdown
        estadoBreakdown,

        // Activity chart data
        activityData: activityResult.rows.map((row: any) => ({
          date: row.date,
          count: parseInt(row.count)
        }))
      }
    })
  } catch (error) {
    console.error('Error fetching driver statistics:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener estadísticas del driver' },
      { status: 500 }
    )
  }
}
