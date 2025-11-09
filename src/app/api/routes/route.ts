import { NextRequest, NextResponse } from 'next/server'
import { Database } from 'sqlite3'
import { open } from 'sqlite'
import crypto from 'crypto'

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
      existing.orderNumbers.push(order.orderNumber || `ORD-${order.id}`)
      existing.orders.push({
        id: order.id,
        orderNumber: order.orderNumber || `ORD-${order.id}`,
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
        orderNumbers: [order.orderNumber || `ORD-${order.id}`],
        orders: [{
          id: order.id,
          orderNumber: order.orderNumber || `ORD-${order.id}`,
          timeSlot: order.timeSlot,
          customerName: order.customerName,
          type: 'delivery'
        }],
        totalOrders: 1,
        type: 'delivery',
        timeSlot: order.timeSlot, // Agregar timeSlot a nivel de parada
        coordinates: [order.longitude, order.latitude]
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

    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    let whereConditions = []
    let params = []

    if (search) {
      whereConditions.push(`
        (routeNumber LIKE ? OR name LIKE ? OR driverName LIKE ? OR vehiclePlate LIKE ?)
      `)
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm, searchTerm)
    }

    if (status && status !== 'all') {
      whereConditions.push('status = ?')
      params.push(status)
    }

    if (driver && driver !== 'all') {
      whereConditions.push('driverId = ?')
      params.push(driver)
    }

    if (dayFilter && dayFilter !== 'all') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      switch (dayFilter) {
        case 'today':
          whereConditions.push('date >= ? AND date < ?')
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          params.push(today.toISOString().split('T')[0], tomorrow.toISOString().split('T')[0])
          break
        case 'tomorrow':
          whereConditions.push('date >= ? AND date < ?')
          const tomorrowDate = new Date(today)
          tomorrowDate.setDate(tomorrowDate.getDate() + 1)
          const dayAfter = new Date(tomorrowDate)
          dayAfter.setDate(dayAfter.getDate() + 1)
          params.push(tomorrowDate.toISOString().split('T')[0], dayAfter.toISOString().split('T')[0])
          break
        case 'week':
          whereConditions.push('date >= ? AND date < ?')
          const weekEnd = new Date(today)
          weekEnd.setDate(weekEnd.getDate() + 7)
          params.push(today.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0])
          break
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    const countQuery = `SELECT COUNT(*) as total FROM routes ${whereClause}`
    const countResult = await db.get(countQuery, params)
    const total = countResult.total

    const query = `
      SELECT * FROM routes
      ${whereClause}
      ORDER BY date DESC, createdAt DESC
      LIMIT ? OFFSET ?
    `

    const routes = await db.all(query, [...params, limit, (page - 1) * limit])

    const processedRoutes = routes.map(route => ({
      ...route,
      waypoints: route.stops ? JSON.parse(route.stops) : [],
      optimizedRoute: route.optimizedRoute ? JSON.parse(route.optimizedRoute) : null,
      timeWindows: route.timeWindows ? JSON.parse(route.timeWindows) : []
    }))

    await db.close()

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
        warehouseCoordinates = [warehouseData.longitude, warehouseData.latitude]
        console.log(`🏭 [Almacén] Coordenadas: ${warehouseCoordinates}`)
      }
    }

    // ==============================
    // PASO 5: Optimización con Mapbox Optimization API v2 + Job ID Storage
    // ==============================
    let optimizedRouteData: any = null
    let orderedStops = groupedStops
    let mapboxJobId: string | null = null

    if (body.mechanism === 'automatic') {
      console.log('🔧 [Optimización] Usando optimización por horarios + distancia')

      try {
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

        // Array para almacenar las paradas ordenadas finales
        let allOrderedStops: any[] = []
        let totalDistance = 0
        let totalDuration = 0
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
            duration: 300 // 5 minutos por parada
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
          const route = optimizationResult.routes[0]
          if (!route) {
            console.error(`❌ [${timeSlot}] No routes en resultado:`, optimizationResult)
            throw new Error(`No se encontraron rutas en el resultado de optimización para ${timeSlot}`)
          }

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

          // Calcular distancia y duración de este segmento
          const lastStop = route.stops[route.stops.length - 1]
          const segmentDistance = lastStop.odometer / 1609.34 // Convertir a millas
          const startEta = new Date(route.stops[0].eta)
          const endEta = new Date(lastStop.eta)
          const segmentDuration = Math.floor((endEta.getTime() - startEta.getTime()) / 1000 / 60)

          totalDistance += segmentDistance
          totalDuration += segmentDuration

          console.log(`📊 [${timeSlot}] Segmento: ${segmentDistance.toFixed(1)} mi, ${segmentDuration} min`)

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
          distance: totalDistance.toFixed(1),
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
          const directionsResult = await directionsResponse.json()
          geometry = directionsResult.routes[0].geometry
          coordinates = geometry.coordinates
          console.log(`✅ [Preview] Geometría obtenida: ${coordinates.length} puntos`)
        }
      } catch (error) {
        console.warn('⚠️ [Preview] No se pudo obtener geometría:', error)
      }

      // Construir datos para RouteMap
      const previewData = {
        stops: orderedStops,
        totalStops: orderedStops.length,
        totalOrders: selectedOrders.length,
        distance: optimizedRouteData?.distance || 'N/A',
        duration: optimizedRouteData?.duration || 'N/A',
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

    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    const lastRoute = await db.get('SELECT id FROM routes ORDER BY id DESC LIMIT 1')
    const routeNumber = `RUT-${new Date().getFullYear()}-${String((lastRoute?.id || 0) + 1).padStart(4, '0')}`

    const newRoute = {
      routeNumber,
      name: `Ruta ${body.mechanism === 'automatic' ? 'Automática' : 'Manual'} - ${new Date().toLocaleDateString('es-ES')}`,
      driverId: body.driverId ? parseInt(body.driverId) : null,
      driverName: body.driverName || null,
      vehicleId: parseInt(body.vehicleId),
      vehiclePlate: body.vehiclePlate || null,
      status: 'planning',
      totalPackages: selectedOrders.length,
      deliveredPackages: 0,
      estimatedDuration: optimizedRouteData ? `${optimizedRouteData.duration}m` : body.estimatedDuration,
      actualDuration: null,
      distance: optimizedRouteData ? parseFloat(optimizedRouteData.distance) : (body.distance || 0),
      startTime: body.startTime || null,
      endTime: null,
      date: body.date || new Date().toISOString().split('T')[0],
      notes: body.notes || `${orderedStops.length} paradas, ${selectedOrders.length} órdenes`,
      mechanism: body.mechanism,
      timeWindows: JSON.stringify(body.timeWindows || []),
      warehouseId: body.warehouseId,
      mapboxJobId: mapboxJobId, // ✅ Guardar job_id de Mapbox para recuperar ruta después
      optimizedRoute: optimizedRouteData ? JSON.stringify(optimizedRouteData) : null,
      stops: JSON.stringify(orderedStops.map((stop, index) => ({
        ...stop,
        sequence: index + 1,
        status: 'pending'
      }))),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      qrCode: null // Se genera después de insertar
    }

    const result = await db.run(`
      INSERT INTO routes (
        routeNumber, name, driverId, driverName, vehicleId, vehiclePlate,
        status, totalPackages, deliveredPackages, estimatedDuration,
        actualDuration, distance, startTime, endTime, date, notes,
        mechanism, timeWindows, warehouseId, mapboxJobId, optimizedRoute, stops,
        createdAt, updatedAt, qrCode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newRoute.routeNumber, newRoute.name, newRoute.driverId, newRoute.driverName,
      newRoute.vehicleId, newRoute.vehiclePlate, newRoute.status,
      newRoute.totalPackages, newRoute.deliveredPackages, newRoute.estimatedDuration,
      newRoute.actualDuration, newRoute.distance, newRoute.startTime,
      newRoute.endTime, newRoute.date, newRoute.notes, newRoute.mechanism,
      newRoute.timeWindows, newRoute.warehouseId, newRoute.mapboxJobId,
      newRoute.optimizedRoute, newRoute.stops, newRoute.createdAt,
      newRoute.updatedAt, newRoute.qrCode
    ])

    const routeId = result.lastID

    // Generar y actualizar QR code
    const qrCode = generateQRCode(routeId as number, routeNumber)
    await db.run('UPDATE routes SET qrCode = ? WHERE id = ?', [qrCode, routeId])

    console.log(`✅ [DB] Ruta creada: ${routeNumber} (ID: ${routeId}, QR: ${qrCode})`)

    // ==============================
    // PASO 8: Actualizar estados de órdenes a "in_transit"
    // ==============================
    console.log(`🔄 [Órdenes] Actualizando ${selectedOrders.length} órdenes a "in_transit"...`)

    try {
      for (const order of selectedOrders) {
        await db.run(
          'UPDATE package_orders SET status = ?, updatedAt = ? WHERE id = ?',
          ['in_transit', new Date().toISOString(), order.id]
        )
      }
      console.log(`✅ [Órdenes] ${selectedOrders.length} órdenes actualizadas`)
    } catch (error) {
      console.error('❌ [Órdenes] Error actualizando estados:', error)
    }

    await db.close()

    // ==============================
    // PASO 9: Retornar respuesta
    // ==============================
    console.log('✅ [Completado] Ruta creada exitosamente')

    return NextResponse.json({
      success: true,
      routeId,
      routeNumber,
      qrCode,
      mapboxJobId, // ✅ Retornar job_id para uso futuro
      totalStops: orderedStops.length,
      totalOrders: selectedOrders.length,
      distance: newRoute.distance,
      duration: newRoute.estimatedDuration,
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
