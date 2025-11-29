import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

interface TimelineEvent {
  status: string
  label: string
  timestamp?: string
  completed: boolean
  current: boolean
}

const STATUS_ORDER = [
  'pending',
  'picked_up',
  'in_transit',
  'in_route',
  'delivered',
]

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pedido Recibido',
  picked_up: 'Recogido',
  in_transit: 'En Tránsito',
  in_route: 'En Reparto',
  en_ruta: 'En Ruta',
  en_reparto: 'En Reparto',
  delivered: 'Entregado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  reprogrammed: 'Reprogramado',
}

function generateTimeline(order: any): TimelineEvent[] {
  const currentStatus = order.status || 'pending'

  // Map various statuses to their position in the flow
  const statusMapping: Record<string, number> = {
    pending: 0,
    reprogrammed: 0,
    picked_up: 1,
    in_transit: 2,
    en_ruta: 3,
    in_route: 3,
    en_reparto: 3,
    delivered: 4,
    completed: 4,
    cancelled: -1,
  }

  const currentIndex = statusMapping[currentStatus] ?? -1
  const isCancelled = currentStatus === 'cancelled'

  const timeline: TimelineEvent[] = [
    {
      status: 'pending',
      label: 'Pedido Recibido',
      timestamp: order.createdat ? formatDate(order.createdat) : undefined,
      completed: !isCancelled && currentIndex >= 0,
      current: currentIndex === 0,
    },
    {
      status: 'picked_up',
      label: 'Recogido por Driver',
      timestamp: currentIndex >= 1 ? formatDate(order.updatedat) : undefined,
      completed: !isCancelled && currentIndex >= 1,
      current: currentIndex === 1,
    },
    {
      status: 'in_transit',
      label: 'En Tránsito',
      timestamp: currentIndex >= 2 ? formatDate(order.updatedat) : undefined,
      completed: !isCancelled && currentIndex >= 2,
      current: currentIndex === 2,
    },
    {
      status: 'in_route',
      label: 'En Reparto',
      timestamp: currentIndex >= 3 ? formatDate(order.updatedat) : undefined,
      completed: !isCancelled && currentIndex >= 3,
      current: currentIndex === 3,
    },
    {
      status: 'delivered',
      label: 'Entregado',
      timestamp: currentIndex >= 4 ? formatDate(order.updatedat) : undefined,
      completed: !isCancelled && currentIndex >= 4,
      current: currentIndex === 4,
    },
  ]

  // If cancelled, add a cancelled event
  if (isCancelled) {
    timeline.push({
      status: 'cancelled',
      label: 'Orden Cancelada',
      timestamp: formatDate(order.updatedat),
      completed: false,
      current: true,
    })
  }

  return timeline
}

function formatDate(date: string | Date): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function calculateETA(order: any): string | undefined {
  // If order is delivered or cancelled, no ETA
  if (['delivered', 'completed', 'cancelled'].includes(order.status)) {
    return undefined
  }

  // Return the scheduled date if available
  if (order.scheduleddate) {
    const scheduled = new Date(order.scheduleddate)
    const timeslot = order.timeslot || ''

    let timeRange = ''
    if (timeslot.includes('morning') || timeslot.includes('mañana')) {
      timeRange = '8:00 AM - 12:00 PM'
    } else if (timeslot.includes('afternoon') || timeslot.includes('tarde')) {
      timeRange = '12:00 PM - 6:00 PM'
    } else if (timeslot.includes('evening') || timeslot.includes('noche')) {
      timeRange = '6:00 PM - 10:00 PM'
    }

    return `${scheduled.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} ${timeRange}`.trim()
  }

  return undefined
}

export async function GET(request: NextRequest) {
  const orderNumber = request.nextUrl.searchParams.get('order')

  if (!orderNumber) {
    return NextResponse.json(
      { error: 'Se requiere el número de orden' },
      { status: 400 }
    )
  }

  try {
    // Search for order by order number (public data only) - simple query without complex joins
    const orderResult = await db.query(`
      SELECT
        ordernumber,
        status,
        createdat,
        updatedat,
        customername,
        customeraddress as destination,
        scheduleddate,
        timeslot,
        routeid
      FROM package_orders
      WHERE LOWER(ordernumber) = LOWER($1)
    `, [orderNumber.trim()])

    if (orderResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Orden no encontrada. Verifica el número de orden e intenta de nuevo.' },
        { status: 404 }
      )
    }

    const order = orderResult.rows[0]

    // Generate timeline based on current status
    const timeline = generateTimeline(order)

    // Calculate ETA
    const estimatedDelivery = calculateETA(order)

    // Try to get driver info if route exists
    let driver = undefined
    if (order.routeid) {
      try {
        const routeResult = await db.query(`
          SELECT
            r.drivername,
            v.make as vehicle_make,
            v.model as vehicle_model
          FROM routes r
          LEFT JOIN vehicles v ON r.vehicleid = v.id
          WHERE r.id = $1
        `, [order.routeid])

        if (routeResult.rows.length > 0 && routeResult.rows[0].drivername) {
          driver = {
            name: routeResult.rows[0].drivername || 'Conductor Asignado',
            vehicle: routeResult.rows[0].vehicle_make && routeResult.rows[0].vehicle_model
              ? `${routeResult.rows[0].vehicle_make} ${routeResult.rows[0].vehicle_model}`
              : 'Vehículo de Reparto',
          }
        }
      } catch {
        // Ignore driver fetch errors
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orderNumber: order.ordernumber,
        status: order.status,
        customerName: order.customername || 'Cliente',
        destination: order.destination || 'Dirección de entrega',
        timeline,
        estimatedDelivery,
        driver,
      },
    })
  } catch (error) {
    console.error('Error fetching tracking info:', error)
    return NextResponse.json(
      { error: 'Error al buscar la información de rastreo' },
      { status: 500 }
    )
  }
}
