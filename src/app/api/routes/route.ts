import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import crypto from 'crypto'

// Force dynamic rendering - don't execute during build
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'


// Mapbox Optimization API v2 + Directions API Integration - Updated 2025-11-07
// Types
export interface Route {
  id: number
  routeNumber: string
  name: string
  driverId?: number | null
  driverName?: string | null
  vehicleId?: number
  vehiclePlate?: string
  status: 'planning' | 'active' | 'completed' | 'cancelled'
  totalPackages: number
  deliveredPackages: number
  estimatedDuration?: string
  actualDuration?: string
  distance?: number
  startTime?: string
  endTime?: string
  date: string
  notes?: string
  createdAt: string
  updatedAt: string
  qrCode?: string | null
  waypoints?: Array<{
    id: number
    address: string
    latitude: number
    longitude: number
    customerName: string
    status: 'pending' | 'delivered' | 'failed'
    orderIds: number[] // Múltiples órdenes por dirección
  }>
  mechanism: 'automatic' | 'manual'
  timeWindows: string[]
  warehouseId: string
  optimizedRoute?: any
}

/**
 * Helper: Generar código QR único para la ruta
 */
function generateQRCode(routeId: number, routeNumber: string): string {
  const timestamp = Date.now()
  const random = crypto.randomBytes(8).toString('hex')
  const hash = crypto.createHash('sha256')
    .update(`${routeId}-${routeNumber}-${timestamp}-${random}`)
    .digest('hex')
    .substring(0, 16)

  return `RT-${hash.toUpperCase()}`
}

/**
 * Helper: Agrupar órdenes por dirección única
 * Esto es crítico para evitar paradas duplicadas
 */
function groupOrdersByAddress(orders: any[]) {
  const addressMap = new Map<string, any>()

  orders.forEach(order => {
    // Obtener dirección como string (manejar tanto string como objeto)
    let addressText = 'Dirección no disponible'
    if (typeof order.customerAddress === 'string') {
      addressText = order.customerAddress
    } else if (order.customerAddress?.street) {
      addressText = order.customerAddress.street
    }

    // Normalizar dirección de texto para agrupar
    const normalizedAddress = addressText
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .replace(/\s+/g, ' ')

    if (addressMap.has(normalizedAddress)) {
      // Dirección ya existe, agregar orden al grupo
      const existing = addressMap.get(normalizedAddress)
      existing.orderIds.push(order.id)
      existing.orderNumbers.push(order.orderNumber || `PACK-${String(order.id).padStart(6, '0')}`)
      existing.orders.push({
        id: order.id,
        orderNumber: order.orderNumber || `PACK-${String(order.id).padStart(6, '0')}`,
        timeSlot: order.timeSlot,
        customerName: order.customerName,
        type: 'delivery'
      })
      existing.totalOrders++
    } else {
      // Nueva dirección
      addressMap.set(normalizedAddress, {
        address: addressText,
        latitude: order.latitude,
        longitude: order.longitude,
        customer: order.customerName,
        orderIds: [order.id],
        orderNumbers: [order.orderNumber || `PACK-${String(order.id).padStart(6, '0')}`],
        orders: [{
          id: order.id,
          orderNumber: order.orderNumber || `PACK-${String(order.id).padStart(6, '0')}`,
          timeSlot: order.timeSlot,
          customerName: order.customerName,
          type: 'delivery'
        }],
        totalOrders: 1,
        type: 'delivery',
        timeSlot: order.timeSlot, // Agregar timeSlot a nivel de parada
        coordinates: [Number(order.longitude), Number(order.latitude)]
      })
    }
  })

  return Array.from(addressMap.values())
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const dayFilter = searchParams.get('dayFilter') || ''
    const driver = searchParams.get('driver') || ''

    // Build WHERE conditions for PostgreSQL
    const conditions = []
    const params = []

    if (search) {
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
      conditions.push(`(
        routenumber ILIKE $${params.length - 3} OR
        name ILIKE $${params.length - 2} OR
        drivername ILIKE $${params.length - 1} OR
        vehicleplate ILIKE $${params.length}
      )`)
    }

    if (status && status !== 'all') {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    }

    if (driver && driver !== 'all') {
      params.push(driver)
      conditions.push(`driverid = $${params.length}`)
    }

    if (dayFilter && dayFilter !== 'all') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      switch (dayFilter) {
        case 'today':
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          params.push(today.toISOString().split('T')[0], tomorrow.toISOString().split('T')[0])
          conditions.push(`date >= $${params.length - 1} AND date < $${params.length}`)
          break
        case 'tomorrow':
          const tomorrowDate = new Date(today)
          tomorrowDate.setDate(tomorrowDate.getDate() + 1)
          const dayAfter = new Date(tomorrowDate)
          dayAfter.setDate(dayAfter.getDate() + 1)
          params.push(tomorrowDate.toISOString().split('T')[0], dayAfter.toISOString().split('T')[0])
          conditions.push(`date >= $${params.length - 1} AND date < $${params.length}`)
          break
        case 'week':
          const weekEnd = new Date(today)
          weekEnd.setDate(weekEnd.getDate() + 7)
          params.push(today.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0])
          conditions.push(`date >= $${params.length - 1} AND date < $${params.length}`)
          break
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM routes ${whereClause}`
    const countResult = await db.query(countQuery, params)
    const total = parseInt(countResult.rows[0].total)

    // Get paginated results
    const offset = (page - 1) * limit
    params.push(limit, offset)
    const dataQuery = `
      SELECT
        id,
        routenumber as "routeNumber",
        name,
        driverid as "driverId",
        drivername as "driverName",
        vehicleid as "vehicleId",
        vehicleplate as "vehiclePlate",
        status,
        totalpackages as "totalPackages",
        deliveredpackages as "deliveredPackages",
        estimatedduration as "estimatedDuration",
        actualduration as "actualDuration",
        distance,
        starttime as "startTime",
        endtime as "endTime",
        date,
        notes,
        mechanism,
        timewindows as "timeWindows",
        warehouseid as "warehouseId",
        mapboxjobid as "mapboxJobId",
        optimizedroute as "optimizedRoute",
        stops,
        createdat as "createdAt",
        updatedat as "updatedAt"
      FROM routes
      ${whereClause}
      ORDER BY date DESC, createdat DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const result = await db.query(dataQuery, params)

    // Process the routes to parse JSON fields with error handling
    const processedRoutes = result.rows.map(route => {
      // Helper function to safely parse JSON
      const safeJSONParse = (data: any, defaultValue: any = null) => {
        // If data is null or undefined, return default
        if (data == null) return defaultValue

        // If data is already an object or array, return it as is
        if (typeof data === 'object') {
          return data
        }

        // If data is not a string, convert to string first
        if (typeof data !== 'string') {
          return defaultValue
        }

        try {
          // Check if the string is corrupted (e.g., "[object Object]")
          if (data.includes('[object Object]') || data === '[object Object]') {
            return defaultValue
          }

          // Try to parse as JSON
          return JSON.parse(data)
        } catch (error) {
          // Silent fail - return default value
          return defaultValue
        }
      }

      return {
        ...route,
        waypoints: safeJSONParse(route.stops, []),
        optimizedRoute: safeJSONParse(route.optimizedRoute, null),
        timeWindows: safeJSONParse(route.timeWindows, [])
      }
    })

    return NextResponse.json({
      routes: processedRoutes,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    })
  } catch (error) {
    console.error('Error in GET /api/routes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle warehouse route optimization
 */
async function handleWarehouseRoute(body: any, shouldSaveRoute: boolean) {
  try {
    console.log('🏭 [Warehouse Route] Iniciando optimización de ruta de almacenes')

    // Fetch all warehouses
    const warehousesResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/warehouses?limit=1000`)
    const warehousesData = await warehousesResponse.json()

    // Filter selected warehouses with valid coordinates
    const selectedWarehouses = warehousesData.data?.filter((wh: any) => {
      const isSelected = body.selectedWarehouses && body.selectedWarehouses.includes(wh.id)
      const hasCoords = wh.longitude && wh.latitude &&
                       wh.longitude !== 0 && wh.latitude !== 0
      return isSelected && hasCoords
    }) || []

    console.log(`✅ [Warehouse Route] ${selectedWarehouses.length} almacenes seleccionados`)

    if (selectedWarehouses.length === 0) {
      return NextResponse.json(
        { error: 'No hay almacenes válidos con coordenadas para crear la ruta' },
        { status: 400 }
      )
    }

    // Get origin warehouse coordinates
    const originWarehouseResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/warehouses/${body.warehouseId}`)
    let originCoordinates: [number, number] = [-80.2395, 25.7548] // Miami default

    if (originWarehouseResponse.ok) {
      const originData = await originWarehouseResponse.json()
      if (originData.longitude && originData.latitude) {
        originCoordinates = [Number(originData.longitude), Number(originData.latitude)]
        console.log(`🏭 [Origin] Coordenadas: ${originCoordinates}`)
      }
    }

    // Build stops from warehouses with complete data
    const stops = selectedWarehouses.map((wh: any, index: number) => {
      // Calculate available capacity
      const totalCapacity = wh.capacity || 0
      const currentUsage = 0 // TODO: Calculate from actual stored items
      const availableCapacity = totalCapacity - currentUsage

      return {
        id: wh.id,
        name: wh.name,
        code: wh.code,
        address: `${wh.address || ''}, ${wh.city || ''}, ${wh.state || ''} ${wh.zipCode || ''}`.trim(),
        coordinates: [Number(wh.longitude), Number(wh.latitude)] as [number, number],
        latitude: Number(wh.latitude),
        longitude: Number(wh.longitude),
        sequence: index + 1,
        type: 'warehouse',
        // Additional warehouse data
        managerPhone: wh.managerPhone,
        managerName: wh.managerName,
        capacity: totalCapacity,
        availableCapacity,
        warehouseType: wh.type,
        // Extract zipcode for zone color matching
        zipCode: wh.zipCode || wh.zipcode || wh.zip_code
      }
    })

    // Call Mapbox Directions API for optimization
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

    // Build coordinates string: origin → warehouses → origin
    const coordinatesString = [
      originCoordinates,
      ...stops.map(stop => stop.coordinates),
      originCoordinates
    ].map(coord => `${coord[0]},${coord[1]}`).join(';')

    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&overview=full&steps=true&access_token=${mapboxToken}`
    const directionsResponse = await fetch(directionsUrl)

    if (!directionsResponse.ok) {
      const errorText = await directionsResponse.text()
      console.error('❌ [Warehouse Route] Mapbox Directions error:', errorText)
      throw new Error(`Mapbox Directions API error: ${directionsResponse.status}`)
    }

    // Verificar que la respuesta sea JSON
    const contentType = directionsResponse.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await directionsResponse.text()
      console.error('❌ [Warehouse Route] Expected JSON but got:', responseText.substring(0, 200))
      throw new Error(`Mapbox returned non-JSON response: ${contentType}`)
    }

    const directionsData = await directionsResponse.json()
    const route = directionsData.routes[0]
    const geometry = route?.geometry
    const coordinates = geometry?.coordinates || []

    // Calculate distance (convert meters to miles) and duration (convert seconds to minutes)
    const distanceMeters = route?.distance || 0
    const distanceMiles = (distanceMeters / 1609.34).toFixed(1)
    const durationSeconds = route?.duration || 0
    const durationMinutes = Math.round(durationSeconds / 60)

    console.log(`📊 [Warehouse Route] Distancia: ${distanceMiles} mi, Duración: ${durationMinutes} min`)

    // Build result
    const result = {
      success: true,
      data: {
        distance: Number(distanceMiles),
        duration: durationMinutes,
        totalStops: stops.length,
        totalOrders: stops.length, // For consistency with order routes
        stops,
        geometry,
        coordinates,
        warehouseCoordinates: originCoordinates,
        routeType: 'warehouses'
      }
    }

    // If saving, create route in database
    if (shouldSaveRoute) {
      console.log('💾 [Warehouse Route] Guardando ruta en base de datos...')

      try {
        // Get the last route ID for numbering
        const lastRouteResult = await db.query('SELECT id FROM routes ORDER BY id DESC LIMIT 1')
        const lastRouteId = lastRouteResult.rows[0]?.id || 0
        const routeNumber = `RUT-WH-${new Date().getFullYear()}-${String(lastRouteId + 1).padStart(4, '0')}`

        const insertQuery = `
          INSERT INTO routes (
            routenumber, name, driverid, drivername, vehicleid, vehicleplate,
            status, totalpackages, deliveredpackages, estimatedduration,
            actualduration, distance, starttime, endtime, date, notes,
            mechanism, timewindows, warehouseid, mapboxjobid, optimizedroute, stops,
            createdat, updatedat
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
            NOW(), NOW()
          )
          RETURNING id
        `

        const values = [
          routeNumber,
          `Ruta de Almacenes - ${new Date().toLocaleDateString('es-ES')}`,
          body.driverId ? parseInt(body.driverId) : null,
          body.driverName || null,
          body.vehicleId || null,
          body.vehiclePlate || null,
          'planning',
          stops.length,
          0,
          `${durationMinutes}m`,
          null,
          Number(distanceMiles),
          body.startTime || null,
          null,
          body.date || new Date().toISOString().split('T')[0],
          `Ruta de ${stops.length} almacenes`,
          'manual', // Warehouse routes are always manual
          JSON.stringify([]),
          body.warehouseId,
          null, // No Mapbox job ID for warehouse routes
          JSON.stringify({
            distance: Number(distanceMiles),
            duration: durationMinutes,
            geometry,
            coordinates,
            routeType: 'warehouses'
          }),
          JSON.stringify(stops.map((stop, index) => ({
            // Solo información del almacén, no hay órdenes ni clientes
            id: stop.id,
            name: stop.name,
            code: stop.code,
            address: stop.address,
            coordinates: stop.coordinates,
            latitude: stop.latitude,
            longitude: stop.longitude,
            sequence: index + 1,
            type: 'warehouse',
            status: 'pending',
            // Metadata adicional del almacén
            managerPhone: stop.managerPhone,
            managerName: stop.managerName,
            capacity: stop.capacity,
            availableCapacity: stop.availableCapacity,
            warehouseType: stop.warehouseType,
            zipCode: stop.zipCode
          })))
        ]

        const insertResult = await db.query(insertQuery, values)
        const routeId = insertResult.rows[0].id

        console.log(`✅ [Warehouse Route] Ruta creada: ${routeNumber} (ID: ${routeId})`)

        return NextResponse.json({
          success: true,
          routeId,
          routeNumber,
          totalStops: stops.length,
          distance: Number(distanceMiles),
          duration: `${durationMinutes}m`,
          message: `Ruta ${routeNumber} creada con ${stops.length} almacenes`
        }, { status: 201 })
      } catch (dbError) {
        console.error('❌ [Warehouse Route] Error guardando en BD:', dbError)
        return NextResponse.json(
          { error: 'Error guardando ruta de almacenes', details: dbError instanceof Error ? dbError.message : 'Unknown error' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [Warehouse Route] Error:', error)
    return NextResponse.json(
      { error: 'Error optimizing warehouse route' },
      { status: 500 }
    )
  }
}

// Mapbox Optimization API v2 Integration - Complete with job_id storage
// Updated: 2025-11-07 - Full ISO 8601 timestamps + mapbox/driving-traffic + job_id
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // ==============================
    // PASO 1: Validaciones iniciales
    // ==============================
    console.log('🚀 [Routes API] Iniciando creación de ruta v3 (Mapbox Optimization API v2 + job_id)')
    console.log('📦 [Payload]', JSON.stringify(body, null, 2))

    if (!body.vehicleId) {
      return NextResponse.json(
        { error: 'Vehículo es requerido' },
        { status: 400 }
      )
    }

    if (!body.warehouseId) {
      return NextResponse.json(
        { error: 'Almacén es requerido' },
        { status: 400 }
      )
    }

    const shouldSaveRoute = body.saveRoute !== false
    console.log(`💾 [Modo]: ${shouldSaveRoute ? 'Guardar ruta' : 'Solo preview'}`)

    // ==============================
    // HANDLE WAREHOUSE ROUTES SEPARATELY
    // ==============================
    if (body.routeType === 'warehouses') {
      console.log('🏭 [Warehouse Route] Procesando ruta de almacenes...')
      return await handleWarehouseRoute(body, shouldSaveRoute)
    }

    // ==============================
    // PASO 2: Obtener y agrupar órdenes por dirección
    // ==============================
    const ordersResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/package-orders?limit=1000`)
    const ordersData = await ordersResponse.json()

    console.log(`📋 [Órdenes] Total en BD: ${ordersData.data?.length || 0}`)

    // Filtrar órdenes seleccionadas con coordenadas válidas
    const selectedOrders = ordersData.data?.filter((order: any) => {
      const isSelected = body.selectedOrders && body.selectedOrders.includes(order.id)
      const hasCoords = order.latitude && order.longitude &&
                       order.latitude !== 0 && order.longitude !== 0
      const isValidStatus = order.status === 'pending' || order.status === 'reprogrammed'

      return isSelected && hasCoords && (shouldSaveRoute ? isValidStatus : true)
    }) || []

    console.log(`✅ [Filtrado] ${selectedOrders.length} órdenes válidas seleccionadas`)

    if (selectedOrders.length === 0) {
      return NextResponse.json(
        { error: 'No hay órdenes válidas con coordenadas para crear la ruta' },
        { status: 400 }
      )
    }

    // ==============================
    // PASO 3: AGRUPAR PRIMERO POR HORARIO, LUEGO POR DIRECCIÓN
    // ==============================
    console.log('⏰ [Agrupación] Paso 1: Agrupar por horarios...')

    // Definir orden cronológico de horarios
    const timeSlotOrder = ['morning', 'afternoon', 'evening', '8-12', '12-16', '16-20']

    // Agrupar órdenes por timeSlot
    const ordersByTimeSlot = new Map<string, any[]>()
    selectedOrders.forEach(order => {
      const timeSlot = order.timeSlot || 'morning'
      if (!ordersByTimeSlot.has(timeSlot)) {
        ordersByTimeSlot.set(timeSlot, [])
      }
      ordersByTimeSlot.get(timeSlot)!.push(order)
    })

    console.log('📊 [Horarios] Distribución:')
    ordersByTimeSlot.forEach((orders, timeSlot) => {
      console.log(`   ${timeSlot}: ${orders.length} órdenes`)
    })

    console.log('🗺️ [Agrupación] Paso 2: Consolidar por dirección dentro de cada horario...')

    // Agrupar por dirección dentro de cada timeSlot
    const groupedStopsByTimeSlot = new Map<string, any[]>()
    ordersByTimeSlot.forEach((orders, timeSlot) => {
      const stops = groupOrdersByAddress(orders)
      groupedStopsByTimeSlot.set(timeSlot, stops)
      console.log(`   ${timeSlot}: ${stops.length} paradas únicas (de ${orders.length} órdenes)`)
    })

    // ✅ Crear array plano en ORDEN CRONOLÓGICO (no en orden de inserción)
    const groupedStops: any[] = []
    for (const timeSlot of timeSlotOrder) {
      const stopsForTimeSlot = groupedStopsByTimeSlot.get(timeSlot)
      if (stopsForTimeSlot && stopsForTimeSlot.length > 0) {
        groupedStops.push(...stopsForTimeSlot)
      }
    }
    console.log(`📍 [Total] ${groupedStops.length} paradas únicas en orden cronológico (de ${selectedOrders.length} órdenes)`)

    // ==============================
    // PASO 4: Obtener coordenadas del almacén
    // ==============================
    const warehouseResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/warehouses/${body.warehouseId}`)
    let warehouseCoordinates: [number, number] = [-80.2395, 25.7548] // Miami default

    if (warehouseResponse.ok) {
      const warehouseData = await warehouseResponse.json()
      if (warehouseData.longitude && warehouseData.latitude) {
        warehouseCoordinates = [Number(warehouseData.longitude), Number(warehouseData.latitude)]
        console.log(`🏭 [Almacén] Coordenadas: ${warehouseCoordinates}`)
      }
    }

    // ==============================
    // PASO 5: Optimización con Mapbox Optimization API v2 + Job ID Storage
    // ==============================
    let optimizedRouteData: any = null
    let orderedStops = groupedStops
    let mapboxJobId: string | null = null
    // Declarar variables de distancia/duración aquí para que estén disponibles en preview
    let totalDistance = 0
    let totalDuration = 0

    if (body.mechanism === 'automatic') {
      console.log('🔧 [Optimización] Usando ordenamiento manual por horarios (Mapbox Optimization deshabilitada temporalmente)')

      // Token de Mapbox
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

      try {
        // ⚠️ DESHABILITADO: Mapbox Optimization API causaba timeouts
        // En su lugar, usamos ordenamiento manual por horarios
        console.warn('⚠️ [Optimización] Mapbox Optimization API deshabilitada - usando fallback')
        throw new Error('Using fallback - Mapbox Optimization disabled')
        // Array para almacenar las paradas ordenadas finales
        let allOrderedStops: any[] = []
        let allCoordinates: [number, number][] = [warehouseCoordinates]

        // OPTIMIZAR CADA HORARIO POR SEPARADO
        for (const timeSlot of timeSlotOrder) {
          const stopsForTimeSlot = groupedStopsByTimeSlot.get(timeSlot)

          if (!stopsForTimeSlot || stopsForTimeSlot.length === 0) {
            console.log(`⏭️ [${timeSlot}] Sin paradas, omitiendo...`)
            continue
          }

          console.log(`\n📍 [${timeSlot}] Optimizando ${stopsForTimeSlot.length} paradas...`)

          // Determinar ventana horaria
          let earliestStart: string
          let latestEnd: string
          const today = new Date()

          switch (timeSlot) {
            case 'morning':
            case '8-12':
              earliestStart = new Date(today.setHours(8, 0, 0, 0)).toISOString()
              latestEnd = new Date(today.setHours(12, 0, 0, 0)).toISOString()
              break
            case 'afternoon':
            case '12-16':
              earliestStart = new Date(today.setHours(12, 0, 0, 0)).toISOString()
              latestEnd = new Date(today.setHours(16, 0, 0, 0)).toISOString()
              break
            case 'evening':
            case '16-20':
              earliestStart = new Date(today.setHours(16, 0, 0, 0)).toISOString()
              latestEnd = new Date(today.setHours(20, 0, 0, 0)).toISOString()
              break
            default:
              earliestStart = new Date(today.setHours(8, 0, 0, 0)).toISOString()
              latestEnd = new Date(today.setHours(20, 0, 0, 0)).toISOString()
          }

          // Construir payload para este horario
          const locations = [
            {
              name: 'warehouse',
              coordinates: warehouseCoordinates
            },
            ...stopsForTimeSlot.map((stop, index) => ({
              name: `stop_${index + 1}`,
              coordinates: stop.coordinates
            }))
          ]

          const services = stopsForTimeSlot.map((stop, index) => ({
            name: `service_${index + 1}`,
            location: `stop_${index + 1}`,
            duration: 1500 // 25 minutos por parada (1500 segundos)
          }))

          const optimizationPayload = {
            version: 1,
            locations,
            vehicles: [
              {
                name: 'vehicle_1',
                routing_profile: 'mapbox/driving-traffic',
                start_location: 'warehouse',
                end_location: 'warehouse',
                earliest_start: earliestStart,
                latest_end: latestEnd
              }
            ],
            services
          }

          console.log(`📤 [${timeSlot}] ${locations.length} locations, ${services.length} services`)

          // PASO 5.1: POST para crear el job
          const optimizationUrl = `https://api.mapbox.com/optimized-trips/v2?access_token=${mapboxToken}`
          console.log(`📤 [${timeSlot}] Enviando solicitud de optimización a Mapbox...`)

          const createJobResponse = await fetch(optimizationUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(optimizationPayload)
          })

          if (!createJobResponse.ok) {
            const errorText = await createJobResponse.text()
            console.error(`❌ [${timeSlot}] Error creando job:`, errorText)
            throw new Error(`Mapbox Optimization error for ${timeSlot}: ${createJobResponse.status}`)
          }

          // Verificar que la respuesta sea JSON
          const contentType = createJobResponse.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            const responseText = await createJobResponse.text()
            console.error(`❌ [${timeSlot}] Expected JSON but got:`, responseText.substring(0, 200))
            throw new Error(`Mapbox returned non-JSON response: ${contentType}`)
          }

          const createJobResult = await createJobResponse.json()
          const timeSlotJobId = createJobResult.id

          console.log(`✅ [${timeSlot}] Job creado: ${timeSlotJobId}`)

          // PASO 5.2: Polling para obtener el resultado (máximo 60 segundos)
          let attempts = 0
          const maxAttempts = 60
          let optimizationResult: any = null

          console.log(`⏳ [${timeSlot}] Esperando resultado de optimización...`)

          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)) // Esperar 1 segundo
            attempts++

            const resultUrl = `https://api.mapbox.com/optimized-trips/v2/${timeSlotJobId}?access_token=${mapboxToken}`
            const resultResponse = await fetch(resultUrl)

            console.log(`[${timeSlot} - Polling ${attempts}/${maxAttempts}] Status: ${resultResponse.status}`)

            if (resultResponse.status === 200) {
              // Verificar que la respuesta sea JSON
              const contentType = resultResponse.headers.get('content-type')
              if (!contentType || !contentType.includes('application/json')) {
                const responseText = await resultResponse.text()
                console.error(`❌ [${timeSlot}] Expected JSON but got:`, responseText.substring(0, 200))
                throw new Error(`Mapbox returned non-JSON response: ${contentType}`)
              }

              optimizationResult = await resultResponse.json()
              console.log(`✅ [${timeSlot}] Resultado obtenido después de ${attempts} intentos`)
              break
            } else if (resultResponse.status === 202) {
              // Job aún en proceso
              console.log(`⏳ [${timeSlot}] Job aún procesando (intento ${attempts})`)
            } else if (resultResponse.status === 404) {
              console.log(`⏳ [${timeSlot}] Job aún no disponible (intento ${attempts})`)
            } else {
              const errorText = await resultResponse.text()
              console.error(`❌ [${timeSlot}] Error inesperado:`, resultResponse.status, errorText)
              throw new Error(`Mapbox result error for ${timeSlot}: ${resultResponse.status} - ${errorText}`)
            }
          }

          if (!optimizationResult) {
            console.error(`❌ [${timeSlot}] Timeout después de ${maxAttempts} segundos`)
            console.error(`Job ID: ${timeSlotJobId}`)
            throw new Error(`Timeout esperando resultado de optimización para ${timeSlot}. Job ID: ${timeSlotJobId}`)
          }

          console.log(`📊 [${timeSlot}] Estructura del resultado:`, JSON.stringify(optimizationResult, null, 2))

          // PASO 5.3: Procesar resultado
          const route = optimizationResult.routes?.[0]
          if (!route) {
            console.error(`❌ [${timeSlot}] No routes en resultado:`, optimizationResult)
            throw new Error(`No se encontraron rutas en el resultado de optimización para ${timeSlot}`)
          }

          // DEBUG: Mostrar estructura de stops
          console.log(`🔍 [${timeSlot}] Total stops en respuesta:`, route.stops.length)
          console.log(`🔍 [${timeSlot}] Primer stop:`, JSON.stringify(route.stops[0], null, 2))
          console.log(`🔍 [${timeSlot}] Último stop:`, JSON.stringify(route.stops[route.stops.length - 1], null, 2))

          const stops = route.stops.filter((stop: any) => stop.type === 'service')

          console.log(`📍 [${timeSlot}] ${stops.length} paradas optimizadas`)

          // Mapear las paradas optimizadas a nuestras órdenes
          const timeSlotOrderedStops = stops.map((stop: any, index: number) => {
            const serviceIndex = parseInt(stop.services[0].split('_')[1]) - 1
            const originalStop = stopsForTimeSlot[serviceIndex]

            // Usar las coordenadas "snapped" de Mapbox para mejor precisión en el mapa
            const snappedCoords = stop.location_metadata?.snapped_coordinate
            const useCoordinates = snappedCoords && snappedCoords.length === 2
              ? snappedCoords
              : originalStop.coordinates

            console.log(`  📍 [${timeSlot}] Parada ${index + 1}: Coords originales vs snapped:`, {
              original: originalStop.coordinates,
              snapped: snappedCoords,
              usando: useCoordinates
            })

            return {
              ...originalStop,
              waypointIndex: allOrderedStops.length + index,
              sequence: allOrderedStops.length + index + 1,
              eta: stop.eta,
              coordinates: useCoordinates,
              timeSlot // Agregar el timeSlot para referencia
            }
          })

          // Agregar las paradas de este horario al array total
          allOrderedStops.push(...timeSlotOrderedStops)

          // Calcular distancia y duración de este segmento desde la respuesta de Mapbox
          // La Optimization API v2 devuelve la distancia en el campo 'odometer' del último stop (en metros)
          const lastStop = route.stops[route.stops.length - 1]
          const firstStop = route.stops[0]

          // Distancia total del segmento (odometer viene en metros)
          const segmentDistanceMeters = Number(lastStop.odometer || 0)
          const segmentDistance = segmentDistanceMeters / 1609.34 // Convertir a millas

          // Duración total del segmento (calcular desde ETAs)
          const startEta = new Date(firstStop.eta)
          const endEta = new Date(lastStop.eta)
          const segmentDuration = Math.floor((endEta.getTime() - startEta.getTime()) / 1000 / 60) // Convertir a minutos

          totalDistance += segmentDistance
          totalDuration += segmentDuration

          console.log(`📊 [${timeSlot}] Segmento desde Mapbox:`)
          console.log(`  - Odómetro último stop: ${segmentDistanceMeters}m → ${segmentDistance.toFixed(1)} mi`)
          console.log(`  - ETA inicio: ${firstStop.eta}, ETA fin: ${lastStop.eta}`)
          console.log(`  - Duración calculada: ${segmentDuration} min`)
          console.log(`  - Total acumulado: ${totalDistance.toFixed(1)} mi, ${totalDuration} min`)

          // OBTENER GEOMETRÍA para el mapa usando Directions API
          try {
            const coordinatesString = [
              warehouseCoordinates,
              ...timeSlotOrderedStops.map(stop => stop.coordinates),
              warehouseCoordinates
            ].map(coord => `${coord[0]},${coord[1]}`).join(';')

            const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&overview=full&access_token=${mapboxToken}`
            const directionsResponse = await fetch(directionsUrl)

            if (directionsResponse.ok) {
              // Verificar que la respuesta sea JSON
              const contentType = directionsResponse.headers.get('content-type')
              if (!contentType || !contentType.includes('application/json')) {
                const responseText = await directionsResponse.text()
                console.error(`❌ [${timeSlot}] Expected JSON but got:`, responseText.substring(0, 200))
                throw new Error(`Mapbox returned non-JSON response: ${contentType}`)
              }

              const directionsData = await directionsResponse.json()
              const segmentGeometry = directionsData.routes[0]?.geometry
              const segmentCoordinates = segmentGeometry?.coordinates || []

              // Agregar coordenadas del segmento (sin duplicar el warehouse del final)
              if (segmentCoordinates.length > 0) {
                // Si no es el primer segmento, quitar el primer punto (warehouse) para evitar duplicados
                const coordsToAdd = allCoordinates.length > 1
                  ? segmentCoordinates.slice(1)
                  : segmentCoordinates
                allCoordinates.push(...coordsToAdd)
              }

              console.log(`✅ [${timeSlot}] Geometría obtenida de Directions API`)
            }
          } catch (geoError) {
            console.warn(`⚠️ [${timeSlot}] No se pudo obtener geometría:`, geoError)
          }

          // Guardar el último job ID (para referencia)
          mapboxJobId = timeSlotJobId

          console.log(`✅ [${timeSlot}] Completado: ${timeSlotOrderedStops.length} paradas agregadas`)
        }

        // DESPUÉS DEL LOOP: Consolidar resultados
        console.log('\n📊 [Consolidación] Resultados finales:')
        console.log(`  Total paradas: ${allOrderedStops.length}`)
        console.log(`  Distancia total: ${totalDistance.toFixed(1)} mi`)
        console.log(`  Duración total: ${totalDuration} min`)
        console.log(`  Coordenadas totales: ${allCoordinates.length} puntos`)

        // Usar las paradas ordenadas consolidadas
        orderedStops = allOrderedStops

        // Construir geometría final uniendo todas las coordenadas
        const geometry = allCoordinates.length > 0 ? {
          type: 'LineString',
          coordinates: allCoordinates
        } : null

        optimizedRouteData = {
          mapboxJobId, // Último job_id como referencia
          distance: totalDistance,
          duration: totalDuration,
          stops: orderedStops,
          geometry,
          coordinates: allCoordinates,
          optimizationResult: {
            message: 'Multi-timeslot optimization',
            timeSlots: Array.from(groupedStopsByTimeSlot.keys()),
            totalStops: allOrderedStops.length
          }
        }

        console.log(`📊 [Resultado Final] ${totalDistance.toFixed(1)} mi, ${totalDuration} min`)
        console.log(`🗺️ [Geometría] ${geometry ? 'Consolidada' : 'No disponible'}`)

      } catch (error) {
        console.error('❌ [Mapbox] Error:', error)
        console.log('⚠️ Usando fallback: ordenar por horarios sin optimización de Mapbox')

        // FALLBACK: Ordenar manualmente por horarios
        orderedStops = []
        for (const timeSlot of timeSlotOrder) {
          const stopsForTimeSlot = groupedStopsByTimeSlot.get(timeSlot)
          if (stopsForTimeSlot && stopsForTimeSlot.length > 0) {
            console.log(`  📍 [Fallback ${timeSlot}] Agregando ${stopsForTimeSlot.length} paradas`)
            stopsForTimeSlot.forEach((stop, index) => {
              orderedStops.push({
                ...stop,
                waypointIndex: orderedStops.length,
                sequence: orderedStops.length + 1,
                timeSlot: timeSlot
              })
            })
          }
        }

        console.log(`✅ [Fallback] ${orderedStops.length} paradas ordenadas por horario`)
        mapboxJobId = null

        // Calcular distancia y duración usando Directions API
        try {
          const coordinatesString = [
            warehouseCoordinates,
            ...orderedStops.map(stop => stop.coordinates),
            warehouseCoordinates
          ].map(coord => `${coord[0]},${coord[1]}`).join(';')

          const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?overview=full&access_token=${mapboxToken}`
          const directionsResponse = await fetch(directionsUrl)

          if (directionsResponse.ok) {
            // Verificar que la respuesta sea JSON
            const contentType = directionsResponse.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
              const responseText = await directionsResponse.text()
              console.error('❌ [Fallback] Expected JSON but got:', responseText.substring(0, 200))
              throw new Error(`Mapbox returned non-JSON response: ${contentType}`)
            }

            const directionsData = await directionsResponse.json()
            const route = directionsData.routes[0]

            // Distancia en metros, convertir a millas
            totalDistance = (route.distance / 1609.34)
            // Duración en segundos, convertir a minutos
            totalDuration = Math.floor(route.duration / 60)

            console.log(`📊 [Fallback] Distancia: ${totalDistance.toFixed(1)} mi, Duración: ${totalDuration} min`)
          }
        } catch (distError) {
          console.warn('⚠️ [Fallback] No se pudo calcular distancia/duración:', distError)
          // Estimación básica: 0.5 millas por parada + 5 minutos por parada
          totalDistance = orderedStops.length * 0.5
          totalDuration = orderedStops.length * 5
        }
      }
    }

    // ==============================
    // PASO 6: Si es solo preview, obtener geometría con Directions API
    // ==============================
    if (!shouldSaveRoute) {
      console.log('🔄 [Preview] Retornando datos sin guardar')

      // Para mostrar en el mapa, necesitamos la geometría con Directions API
      let geometry: any = null
      let coordinates: any = null

      try {
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

        // Construir coordenadas en el orden optimizado
        const coordinatesString = [
          warehouseCoordinates,
          ...orderedStops.map(stop => stop.coordinates),
          warehouseCoordinates
        ].map(coord => `${coord[0]},${coord[1]}`).join(';')

        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinatesString}?geometries=geojson&overview=full&steps=false&access_token=${mapboxToken}`

        console.log('📍 [Preview] Obteniendo geometría con Directions API...')
        const directionsResponse = await fetch(directionsUrl)

        if (directionsResponse.ok) {
          // Verificar que la respuesta sea JSON
          const contentType = directionsResponse.headers.get('content-type')
          if (!contentType || !contentType.includes('application/json')) {
            const responseText = await directionsResponse.text()
            console.error('❌ [Preview] Expected JSON but got:', responseText.substring(0, 200))
            throw new Error(`Mapbox returned non-JSON response: ${contentType}`)
          }

          const directionsResult = await directionsResponse.json()
          geometry = directionsResult.routes[0].geometry
          coordinates = geometry.coordinates
          console.log(`✅ [Preview] Geometría obtenida: ${coordinates.length} puntos`)
        }
      } catch (error) {
        console.warn('⚠️ [Preview] No se pudo obtener geometría:', error)
      }

      // Construir datos para RouteMap
      console.log(`🔍 [Preview] optimizedRouteData:`, {
        distance: optimizedRouteData?.distance,
        duration: optimizedRouteData?.duration,
        typeDistance: typeof optimizedRouteData?.distance,
        typeDuration: typeof optimizedRouteData?.duration
      })

      const previewData = {
        stops: orderedStops,
        totalStops: orderedStops.length,
        totalOrders: selectedOrders.length,
        distance: Math.round((Number(optimizedRouteData?.distance || totalDistance) || 0) * 10) / 10,
        duration: Math.round(Number(optimizedRouteData?.duration || totalDuration) || 0),
        warehouseCoordinates,
        mapboxJobId, // Incluir job_id si existe
        // Estructura para RouteMap
        geometry,
        coordinates,
        optimizedRoute: optimizedRouteData,
        // Estructura para compatibilidad con RouteMap
        route: {
          stops: orderedStops.map((stop, index) => ({
            ...stop,
            id: stop.orderIds?.[0] || index,
            customer: stop.customer,
            customerName: stop.customer,
            address: stop.address,
            coordinates: stop.coordinates || [stop.longitude, stop.latitude],
            waypointIndex: stop.waypointIndex !== undefined ? stop.waypointIndex : index
          }))
        }
      }

      console.log('📤 [Preview] Datos enviados:', {
        hasGeometry: !!previewData.geometry,
        hasCoordinates: !!previewData.coordinates,
        coordinatesCount: previewData.coordinates?.length || 0,
        stopsCount: previewData.route.stops.length,
        mapboxJobId: previewData.mapboxJobId
      })

      return NextResponse.json({
        success: true,
        preview: true,
        data: previewData
      })
    }

    // ==============================
    // PASO 7: Guardar ruta en la base de datos
    // ==============================
    console.log('💾 [DB] Guardando ruta...')

    // Get the last route ID for numbering
    const lastRouteResult = await db.query('SELECT id FROM routes ORDER BY id DESC LIMIT 1')
    const lastRouteId = lastRouteResult.rows[0]?.id || 0
    const routeNumber = `RUT-${new Date().getFullYear()}-${String(lastRouteId + 1).padStart(4, '0')}`

    const insertQuery = `
      INSERT INTO routes (
        routenumber, name, driverid, drivername, vehicleid, vehicleplate,
        status, totalpackages, deliveredpackages, estimatedduration,
        actualduration, distance, starttime, endtime, date, notes,
        mechanism, timewindows, warehouseid, mapboxjobid, optimizedroute, stops,
        createdat, updatedat
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
        NOW(), NOW()
      )
      RETURNING id
    `

    const values = [
      routeNumber,
      `Ruta ${body.mechanism === 'automatic' ? 'Automática' : 'Manual'} - ${new Date().toLocaleDateString('es-ES')}`,
      body.driverId ? parseInt(body.driverId) : null,
      body.driverName || null,
      body.vehicleId || null,  // vehicleId es string, no convertir a int
      body.vehiclePlate || null,
      'planning',
      selectedOrders.length,
      0,
      optimizedRouteData?.duration ? `${optimizedRouteData.duration}m` : body.estimatedDuration,
      null,
      // Usar totalDistance/totalDuration si optimizedRouteData no tiene valores válidos
      optimizedRouteData?.distance ? parseFloat(optimizedRouteData.distance) : (totalDistance || body.distance || 0),
      body.startTime || null,
      null,
      body.date || new Date().toISOString().split('T')[0],
      body.notes || `${orderedStops.length} paradas, ${selectedOrders.length} órdenes`,
      body.mechanism,
      JSON.stringify(body.timeWindows || []),
      body.warehouseId,
      mapboxJobId,
      optimizedRouteData ? JSON.stringify(optimizedRouteData) : null,
      JSON.stringify(orderedStops.map((stop, index) => ({
        ...stop,
        sequence: index + 1,
        status: 'pending'
      })))
    ]

    const result = await db.query(insertQuery, values)
    const routeId = result.rows[0].id

    // QR code generation disabled for SQLite (column doesn't exist)
    // const qrCode = generateQRCode(routeId, routeNumber)
    // await db.query('UPDATE routes SET qrcode = $1 WHERE id = $2', [qrCode, routeId])

    console.log(`✅ [DB] Ruta creada: ${routeNumber} (ID: ${routeId})`)

    // ==============================
    // PASO 8: Actualizar estados de órdenes a "in_transit"
    // ==============================
    console.log(`🔄 [Órdenes] Actualizando ${selectedOrders.length} órdenes a "in_transit"...`)

    try {
      for (const order of selectedOrders) {
        await db.query(
          'UPDATE package_orders SET status = $1, updatedat = NOW() WHERE id = $2',
          ['in_transit', order.id]
        )
      }
      console.log(`✅ [Órdenes] ${selectedOrders.length} órdenes actualizadas`)
    } catch (error) {
      console.error('❌ [Órdenes] Error actualizando estados:', error)
    }

    // ==============================
    // PASO 9: Retornar respuesta
    // ==============================
    console.log('✅ [Completado] Ruta creada exitosamente')

    // Calcular distancia y duración finales con redondeo apropiado
    const finalDistance = optimizedRouteData?.distance
      ? Math.round(parseFloat(optimizedRouteData.distance) * 10) / 10
      : Math.round((totalDistance || body.distance || 0) * 10) / 10;

    const finalDuration = optimizedRouteData?.duration
      ? Math.round(optimizedRouteData.duration)
      : Math.round(totalDuration || 0);

    return NextResponse.json({
      success: true,
      routeId,
      routeNumber,
      mapboxJobId,
      totalStops: orderedStops.length,
      totalOrders: selectedOrders.length,
      distance: finalDistance,
      duration: `${finalDuration}m`,
      message: `Ruta ${routeNumber} creada con ${orderedStops.length} paradas y ${selectedOrders.length} órdenes`
    }, { status: 201 })

  } catch (error) {
    console.error('❌ [Error] POST /api/routes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}