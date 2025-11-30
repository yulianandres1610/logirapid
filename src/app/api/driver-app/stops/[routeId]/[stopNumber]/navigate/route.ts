import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

/**
 * GET /api/driver-app/stops/[routeId]/[stopNumber]/navigate
 * Obtener información de navegación para una parada
 * Incluye coordenadas, dirección y links para abrir en apps de mapas
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string; stopNumber: string }> }
) {
  try {
    // Obtener usuario del token
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Decodificar token
    let userId: number
    let userRole: string
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [id, , role] = decoded.split(':')
      userId = parseInt(id)
      userRole = role
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Verificar rol DRIVER
    if (userRole !== 'DRIVER') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado. Solo drivers pueden acceder.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.routeId)
    const stopNumber = parseInt(resolvedParams.stopNumber)

    if (isNaN(routeId) || isNaN(stopNumber)) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos' },
        { status: 400 }
      )
    }

    // Obtener posición actual del driver (opcional del query)
    const { searchParams } = new URL(request.url)
    const currentLat = searchParams.get('lat')
    const currentLng = searchParams.get('lng')

    // Obtener la ruta
    const routeQuery = `
      SELECT
        r.id,
        r.route_number as "routeNumber",
        r.driver_id as "driverId",
        r.stops
      FROM routes r
      WHERE r.id = $1
    `
    const routeResult = await db.query(routeQuery, [routeId])

    if (routeResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ruta no encontrada' },
        { status: 404 }
      )
    }

    const route = routeResult.rows[0]

    // Verificar que el driver está asignado a la ruta
    if (route.driverId && route.driverId !== userId) {
      return NextResponse.json(
        { success: false, error: 'No tiene permisos para ver esta ruta' },
        { status: 403 }
      )
    }

    // Parsear waypoints
    let waypoints: any[] = []
    try {
      waypoints = typeof route.stops === 'string'
        ? JSON.parse(route.stops)
        : (Array.isArray(route.stops) ? route.stops : [])
    } catch {
      waypoints = []
    }

    // Encontrar la parada
    const orderStops = waypoints.filter((s: any) => s.orderId || s.orderIds)
    if (stopNumber < 1 || stopNumber > orderStops.length) {
      return NextResponse.json(
        { success: false, error: `Parada ${stopNumber} no encontrada` },
        { status: 404 }
      )
    }

    // Encontrar índice real en waypoints
    let stopData = null
    let orderStopCounter = 0
    for (let i = 0; i < waypoints.length; i++) {
      if (waypoints[i].orderId || waypoints[i].orderIds) {
        orderStopCounter++
        if (orderStopCounter === stopNumber) {
          stopData = waypoints[i]
          break
        }
      }
    }

    if (!stopData) {
      return NextResponse.json(
        { success: false, error: 'No se encontró la parada' },
        { status: 404 }
      )
    }

    // Obtener coordenadas
    let latitude = 0
    let longitude = 0

    if (stopData.coordinates && Array.isArray(stopData.coordinates)) {
      longitude = stopData.coordinates[0]
      latitude = stopData.coordinates[1]
    } else if (stopData.lat && stopData.lng) {
      latitude = stopData.lat
      longitude = stopData.lng
    } else if (stopData.latitude && stopData.longitude) {
      latitude = stopData.latitude
      longitude = stopData.longitude
    }

    // Si no hay coordenadas, intentar obtenerlas de las órdenes
    if (latitude === 0 && longitude === 0) {
      const stopOrderIds = stopData.orderIds || (stopData.orderId ? [stopData.orderId] : [])
      if (stopOrderIds.length > 0) {
        const orderQuery = `
          SELECT latitude, longitude
          FROM package_orders
          WHERE id = ANY($1::int[]) AND latitude IS NOT NULL AND longitude IS NOT NULL
          LIMIT 1
        `
        const orderResult = await db.query(orderQuery, [stopOrderIds])
        if (orderResult.rows.length > 0) {
          latitude = orderResult.rows[0].latitude
          longitude = orderResult.rows[0].longitude
        }
      }
    }

    // Obtener dirección
    const address = stopData.address || 'Dirección no disponible'

    // Construir URLs de navegación
    const encodedAddress = encodeURIComponent(address)
    const navLinks = {
      // Google Maps
      googleMaps: latitude && longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`,

      // Apple Maps (iOS)
      appleMaps: latitude && longitude
        ? `maps://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`
        : `maps://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`,

      // Waze
      waze: latitude && longitude
        ? `https://www.waze.com/ul?ll=${latitude},${longitude}&navigate=yes`
        : `https://www.waze.com/ul?q=${encodedAddress}&navigate=yes`,

      // URL genérico geo:
      geo: latitude && longitude
        ? `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedAddress})`
        : `geo:0,0?q=${encodedAddress}`
    }

    // Calcular distancia aproximada si hay posición actual
    let distance = null
    let distanceText = null
    if (currentLat && currentLng && latitude && longitude) {
      const lat1 = parseFloat(currentLat)
      const lng1 = parseFloat(currentLng)
      distance = calculateDistance(lat1, lng1, latitude, longitude)
      distanceText = distance < 1
        ? `${Math.round(distance * 1000)} m`
        : `${distance.toFixed(1)} km`
    }

    return NextResponse.json({
      success: true,
      data: {
        routeId,
        routeNumber: route.routeNumber,
        stopNumber,
        address,
        coordinates: {
          latitude,
          longitude
        },
        navigation: navLinks,
        distance: distance ? {
          km: distance,
          text: distanceText
        } : null
      }
    })

  } catch (error) {
    console.error('Error getting navigation info:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener información de navegación' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/driver-app/stops/[routeId]/[stopNumber]/navigate
 * Registrar que el driver inició navegación a esta parada
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ routeId: string; stopNumber: string }> }
) {
  try {
    // Obtener usuario del token
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Decodificar token
    let userId: number
    let userRole: string
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8')
      const [id, , role] = decoded.split(':')
      userId = parseInt(id)
      userRole = role
    } catch {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Verificar rol DRIVER
    if (userRole !== 'DRIVER') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado.' },
        { status: 403 }
      )
    }

    const resolvedParams = await params
    const routeId = parseInt(resolvedParams.routeId)
    const stopNumber = parseInt(resolvedParams.stopNumber)

    if (isNaN(routeId) || isNaN(stopNumber)) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos' },
        { status: 400 }
      )
    }

    // Obtener datos del body
    let latitude = null
    let longitude = null
    try {
      const body = await request.json()
      latitude = body.latitude
      longitude = body.longitude
    } catch {
      // Sin body está OK
    }

    // Obtener la ruta
    const routeQuery = `
      SELECT
        r.id,
        r.driver_id as "driverId",
        r.stops
      FROM routes r
      WHERE r.id = $1
    `
    const routeResult = await db.query(routeQuery, [routeId])

    if (routeResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Ruta no encontrada' },
        { status: 404 }
      )
    }

    const route = routeResult.rows[0]

    // Verificar que el driver está asignado
    if (route.driverId && route.driverId !== userId) {
      return NextResponse.json(
        { success: false, error: 'No tiene permisos' },
        { status: 403 }
      )
    }

    // Parsear y actualizar waypoints
    let waypoints: any[] = []
    try {
      waypoints = typeof route.stops === 'string'
        ? JSON.parse(route.stops)
        : (Array.isArray(route.stops) ? route.stops : [])
    } catch {
      waypoints = []
    }

    // Encontrar y actualizar la parada
    let orderStopCounter = 0
    for (let i = 0; i < waypoints.length; i++) {
      if (waypoints[i].orderId || waypoints[i].orderIds) {
        orderStopCounter++
        if (orderStopCounter === stopNumber) {
          waypoints[i] = {
            ...waypoints[i],
            status: 'en_curso',
            navigationStartedAt: new Date().toISOString(),
            driverStartLocation: latitude && longitude ? { latitude, longitude } : null
          }
          break
        }
      }
    }

    // Actualizar en la base de datos
    await db.query(`
      UPDATE routes
      SET stops = $1,
          updatedat = NOW()
      WHERE id = $2
    `, [JSON.stringify(waypoints), routeId])

    return NextResponse.json({
      success: true,
      message: 'Navegación iniciada',
      data: {
        routeId,
        stopNumber,
        startedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error starting navigation:', error)
    return NextResponse.json(
      { success: false, error: 'Error al iniciar navegación' },
      { status: 500 }
    )
  }
}

/**
 * Calcular distancia entre dos puntos usando fórmula de Haversine
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Radio de la Tierra en km
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}
