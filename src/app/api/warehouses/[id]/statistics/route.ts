import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || 'month'

    // Get statistics for warehouse
    const stats = await getWarehouseStatistics(parseInt(id), range)

    return NextResponse.json(stats, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching warehouse statistics:', error)
    return NextResponse.json(
      { error: 'Error al obtener estadísticas' },
      { status: 500 }
    )
  }
}

async function getWarehouseStatistics(warehouseId: number, range: string) {
  // Total packages received
  const totalPackagesResult = await db.query(
    `SELECT COUNT(*) as total FROM package_orders WHERE warehouse_id = $1`,
    [warehouseId]
  )
  const totalPackages = parseInt(totalPackagesResult.rows[0]?.total || '0')

  // Empaques disponibles (cajas vacías en el almacén)
  // Incluye estados: disponible, disponible_almacen, recogida
  // Excluye empaques con order_number (esos son bultos)
  const empaquesResult = await db.query(
    `SELECT COUNT(*) as total FROM empaques
     WHERE warehouse_id = $1
     AND estado IN ('disponible', 'disponible_almacen', 'recogida')
     AND (order_number IS NULL OR order_number = '')`,
    [warehouseId]
  )
  const empaquesDisponibles = parseInt(empaquesResult.rows[0]?.total || '0')

  // Bultos en ubicación (empaques con estado 'en_almacen')
  const paquetesEnUbicacionResult = await db.query(
    `SELECT COUNT(*) as total FROM empaques
     WHERE warehouse_id = $1 AND estado = 'en_almacen'`,
    [warehouseId]
  )
  const paquetesEnUbicacion = parseInt(paquetesEnUbicacionResult.rows[0]?.total || '0')

  // Capacidad usada (empaques + paquetes)
  const capacidadUsada = empaquesDisponibles + paquetesEnUbicacion

  // Get time-series data based on range
  let packagesPerPeriod: any[] = []

  if (range === 'day') {
    // Packages per hour of current day
    packagesPerPeriod = await getPackagesPerHour(warehouseId)
  } else if (range === 'week') {
    // Packages per day of current week
    packagesPerPeriod = await getPackagesPerDayOfWeek(warehouseId)
  } else if (range === 'month') {
    // Packages per day of current month
    packagesPerPeriod = await getPackagesPerDayOfMonth(warehouseId)
  } else if (range === 'year') {
    // Packages per month of current year
    packagesPerPeriod = await getPackagesPerMonth(warehouseId)
  }

  return {
    totalPackages,
    empaquesDisponibles,
    paquetesEnUbicacion,
    capacidadUsada,
    capacidadTotal: 1000, // This should come from warehouses table
    packagesPerMonth: packagesPerPeriod,
    packagesPerDay: packagesPerPeriod,
    packagesPerWeek: packagesPerPeriod
  }
}

async function getPackagesPerHour(warehouseId: number) {
  const result = await db.query(`
    SELECT
      EXTRACT(HOUR FROM createdat) as hour,
      COUNT(*) as count
    FROM package_orders
    WHERE warehouse_id = $1
      AND DATE(createdat) = CURRENT_DATE
    GROUP BY hour
    ORDER BY hour
  `, [warehouseId])

  const hours = Array.from({ length: 24 }, (_, i) => ({
    name: `${i}:00`,
    paquetes: 0
  }))

  result.rows.forEach(row => {
    const hourIndex = parseInt(row.hour)
    hours[hourIndex].paquetes = parseInt(row.count)
  })

  return hours
}

async function getPackagesPerDayOfWeek(warehouseId: number) {
  const result = await db.query(`
    SELECT
      TO_CHAR(createdat, 'Day') as day_name,
      EXTRACT(DOW FROM createdat) as day_num,
      COUNT(*) as count
    FROM package_orders
    WHERE warehouse_id = $1
      AND createdat >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY day_name, day_num
    ORDER BY day_num
  `, [warehouseId])

  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const days = daysOfWeek.map((name, i) => ({
    name,
    paquetes: 0
  }))

  result.rows.forEach(row => {
    const dayIndex = parseInt(row.day_num)
    days[dayIndex].paquetes = parseInt(row.count)
  })

  return days
}

async function getPackagesPerDayOfMonth(warehouseId: number) {
  const result = await db.query(`
    SELECT
      EXTRACT(DAY FROM createdat) as day,
      COUNT(*) as count
    FROM package_orders
    WHERE warehouse_id = $1
      AND EXTRACT(MONTH FROM createdat) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(YEAR FROM createdat) = EXTRACT(YEAR FROM CURRENT_DATE)
    GROUP BY day
    ORDER BY day
  `, [warehouseId])

  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate()

  const days = Array.from({ length: daysInMonth }, (_, i) => ({
    name: `${i + 1}`,
    paquetes: 0
  }))

  result.rows.forEach(row => {
    const dayIndex = parseInt(row.day) - 1
    days[dayIndex].paquetes = parseInt(row.count)
  })

  return days
}

async function getPackagesPerMonth(warehouseId: number) {
  const result = await db.query(`
    SELECT
      TO_CHAR(createdat, 'Mon') as month_name,
      EXTRACT(MONTH FROM createdat) as month_num,
      COUNT(*) as count
    FROM package_orders
    WHERE warehouse_id = $1
      AND EXTRACT(YEAR FROM createdat) = EXTRACT(YEAR FROM CURRENT_DATE)
    GROUP BY month_name, month_num
    ORDER BY month_num
  `, [warehouseId])

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const monthsData = months.map((name, i) => ({
    name,
    paquetes: 0
  }))

  result.rows.forEach(row => {
    const monthIndex = parseInt(row.month_num) - 1
    monthsData[monthIndex].paquetes = parseInt(row.count)
  })

  return monthsData
}
