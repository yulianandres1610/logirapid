import { NextRequest, NextResponse } from 'next/server'
import { Database } from 'sqlite3'
import { open } from 'sqlite'

// Types
export interface Route {
  id: number
  routeNumber: string
  name: string
  driverId?: number
  driverName?: string
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
  waypoints?: Array<{
    id: number
    address: string
    latitude: number
    longitude: number
    customerName: string
    status: 'pending' | 'delivered' | 'failed'
  }>
  mechanism: 'automatic' | 'manual'
  timeWindows: string[]
  warehouseId: string
  optimizedRoute?: any
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

    // Construir la consulta WHERE
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

    // Consulta para obtener el total de registros
    const countQuery = `SELECT COUNT(*) as total FROM routes ${whereClause}`
    const countResult = await db.get(countQuery, params)
    const total = countResult.total

    // Consulta principal con paginación
    const query = `
      SELECT * FROM routes
      ${whereClause}
      ORDER BY date DESC, createdAt DESC
      LIMIT ? OFFSET ?
    `

    const routes = await db.all(query, [...params, limit, (page - 1) * limit])

    // Procesar resultados para formatear campos JSON
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('🚀 POST /api/routes - Creando ruta con optimización Mapbox')
    console.log('📦 Selected orders:', body.selectedOrders)
    console.log('📍 Warehouse ID:', body.warehouseId)

    let optimizedRouteData = null
    let waypoints: any[] = []
    let selectedOrdersWithCoords: any[] = []

    // Procesar ruta alternativa seleccionada si existe
    let selectedAlternativeRoute = null
    if (body.selectedRouteData && body.selectedRouteData.selectedRoute) {
      console.log('🛣️ Usando ruta alternativa seleccionada:', body.selectedRouteData.selectedRouteIndex)
      selectedAlternativeRoute = {
        geometry: body.selectedRouteData.selectedRoute.geometry,
        distance: body.selectedRouteData.selectedRoute.distance,
        duration: body.selectedRouteData.selectedRoute.duration,
        routeIndex: body.selectedRouteData.selectedRouteIndex,
        isAlternative: body.selectedRouteData.selectedRouteIndex > 0
      }
      console.log('✅ Ruta alternativa procesada:', {
        distance: selectedAlternativeRoute.distance,
        duration: selectedAlternativeRoute.duration,
        isAlternative: selectedAlternativeRoute.isAlternative
      })
    }

    // Si es ruta automática y hay órdenes seleccionadas, optimizar con Mapbox
    if (body.mechanism === 'automatic' && body.selectedOrders && body.selectedOrders.length > 0) {
      console.log('🗺️ Iniciando optimización con Mapbox API...')
      console.log(`📦 Órdenes seleccionadas en body:`, body.selectedOrders)
      console.log(`📊 Body completo:`, JSON.stringify(body, null, 2))

      try {
        // Obtener coordenadas del almacén
        const warehouseCoordinates = [-80.2395, 25.7548] // Miami coordinates por defecto

        // Obtener órdenes con coordenadas - SOLO del día actual y estados Pendiente/Reprogramada
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
        console.log(`📅 Fecha actual (hoy): ${today}`)

        const ordersResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/package-orders`)
        const ordersData = await ordersResponse.json()

        console.log(`📋 Total órdenes en BD: ${ordersData.data?.length || 0}`)

        const allSelectedOrders = ordersData.data?.filter((order: any) => {
          return body.selectedOrders.includes(order.id)
        }) || []

        console.log(`📦 Órdenes seleccionadas encontradas: ${allSelectedOrders.length}`)

        selectedOrdersWithCoords = allSelectedOrders
          .filter((order: any) => {
            // Solo incluir órdenes del día actual y con estados correctos para rutas
            const isToday = order.scheduledDate === today || order.createdAt?.startsWith(today)
            const isValidStatus = order.status === 'pending' || order.status === 'reprogrammed'
            const hasCoords = order.latitude && order.longitude &&
                             order.latitude !== 0 && order.longitude !== 0

            const shouldInclude = isToday && isValidStatus && hasCoords

            console.log(`🔍 Orden ${order.id}: ${order.orderNumber || 'N/A'} -`, {
              scheduledDate: order.scheduledDate,
              createdAt: order.createdAt,
              status: order.status,
              hasCoords,
              isToday,
              isValidStatus,
              shouldInclude
            })

            return shouldInclude
          })
          .map((order: any) => ({
            id: order.id,
            customer: order.customerName,
            address: order.customerAddress?.street || order.address,
            coordinates: [order.longitude, order.latitude],
            orderNumber: order.orderNumber,
            scheduledDate: order.scheduledDate,
            status: order.status
          }))

        console.log(`✅ Encontradas ${selectedOrdersWithCoords.length} órdenes con coordenadas válidas`)
        console.log(`📍 Coordenadas de las órdenes:`, selectedOrdersWithCoords.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          coordinates: o.coordinates
        })))

        if (selectedOrdersWithCoords.length > 0) {
          // Preparar coordenadas para Mapbox Directions API
          const coordinates = [
            warehouseCoordinates,
            ...selectedOrdersWithCoords.map(order => order.coordinates)
          ]

          const coordinatesString = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';')
          const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

          const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?` +
            `access_token=${mapboxToken}&` +
            `geometries=geojson&` +
            `overview=full&` +
            `steps=true`

          console.log('📤 Llamando a Mapbox Directions API...')
          console.log('📍 URL:', directionsUrl.replace(mapboxToken, 'TOKEN_HIDDEN'))

          const response = await fetch(directionsUrl)

          if (!response.ok) {
            throw new Error(`Mapbox API error: ${response.status}`)
          }

          const mapboxResult = await response.json()
          console.log('✅ Respuesta de Mapbox recibida')

          if (mapboxResult.routes && mapboxResult.routes.length > 0) {
            const route = mapboxResult.routes[0]
            const distanceMiles = (route.distance / 1609.34).toFixed(1)
            const durationMinutes = Math.floor(route.duration / 60)

            optimizedRouteData = {
              geometry: route.geometry,
              distance: parseFloat(distanceMiles),
              duration: durationMinutes,
              coordinates: route.geometry.coordinates
            }

            // Crear waypoints en el orden optimizado
            waypoints = selectedOrdersWithCoords.map((order, index) => ({
              id: order.id,
              address: order.address,
              customer: order.customer,
              status: 'pending' as const,
              latitude: order.coordinates[1],
              longitude: order.coordinates[0],
              estimatedArrival: index === 0 ? '08:00' : ''
            }))

            console.log(`🎯 Ruta optimizada: ${distanceMiles} mi, ${durationMinutes} min, ${waypoints.length} paradas`)
          }
        }
      } catch (mapboxError) {
        console.error('❌ Error en optimización Mapbox:', mapboxError)
        // Continuar sin optimización si falla Mapbox
      }
    }

    // Generar número de ruta único
    const db = await open({
      filename: './data/cubarapid.db',
      driver: Database
    })

    const lastRoute = await db.get('SELECT id FROM routes ORDER BY id DESC LIMIT 1')
    const routeNumber = `RUT-${new Date().getFullYear()}-${String((lastRoute?.id || 0) + 1).padStart(3, '0')}`

    // Usar ruta alternativa seleccionada si existe, si no usar la ruta optimizada
    if (selectedAlternativeRoute) {
      optimizedRouteData = selectedAlternativeRoute
      console.log('✅ Usando ruta alternativa seleccionada para guardar en BD')
    }

    // Calcular distancia y duración estimadas si no hay datos de optimización
    let estimatedDistance = optimizedRouteData?.distance
    let estimatedDuration = optimizedRouteData ? `${optimizedRouteData.duration}m` : null

    // Si no hay datos de Mapbox, usar valores del body o calcular estimaciones básicas
    if (!optimizedRouteData) {
      // Usar valores del body si existen
      if (body.distance) {
        estimatedDistance = parseFloat(body.distance.toString())
      } else if (waypoints.length > 0) {
        // Estimar distancia: ~2.5 millas por parada
        estimatedDistance = Math.round(waypoints.length * 2.5)
      }

      if (body.estimatedDuration) {
        estimatedDuration = body.estimatedDuration
      } else if (waypoints.length > 0) {
        // Estimar duración: 25 min por parada + 30 min base
        const estimatedMinutes = waypoints.length * 25 + 30
        const hours = Math.floor(estimatedMinutes / 60)
        const minutes = estimatedMinutes % 60
        estimatedDuration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
      }

      console.log(`📊 Usando estimaciones locales: ${estimatedDistance} mi, ${estimatedDuration}`)
    }

    const newRoute = {
      routeNumber,
      name: `Ruta ${body.mechanism === 'automatic' ? 'Automática' : 'Manual'} ${new Date().toLocaleDateString('es-ES')}`,
      driverId: parseInt(body.driverId) || null,
      driverName: body.driverName || null,
      vehicleId: parseInt(body.vehicleId) || null,
      vehiclePlate: body.vehiclePlate || null,
      status: 'planning',
      totalPackages: body.totalPackages || waypoints.length,
      deliveredPackages: 0,
      estimatedDuration: estimatedDuration,
      actualDuration: null,
      distance: estimatedDistance || 0,
      startTime: null,
      endTime: null,
      date: body.date || new Date().toISOString().split('T')[0],
      notes: body.notes || `Ruta ${body.mechanism === 'automatic' ? 'automática' : 'manual'}${selectedAlternativeRoute && selectedAlternativeRoute.isAlternative ? ' (alternativa ' + selectedAlternativeRoute.routeIndex + ')' : ''} creada el ${new Date().toLocaleDateString('es-ES')} con ${waypoints.length} paradas`,
      mechanism: body.mechanism,
      timeWindows: JSON.stringify(body.timeWindows || []),
      warehouseId: body.warehouseId,
      optimizedRoute: optimizedRouteData ? JSON.stringify(optimizedRouteData) : null,
      stops: JSON.stringify(waypoints),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const result = await db.run(`
      INSERT INTO routes (
        routeNumber, name, driverId, driverName, vehicleId, vehiclePlate,
        status, totalPackages, deliveredPackages, estimatedDuration,
        actualDuration, distance, startTime, endTime, date, notes,
        mechanism, timeWindows, warehouseId, optimizedRoute, stops,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newRoute.routeNumber, newRoute.name, newRoute.driverId, newRoute.driverName,
      newRoute.vehicleId, newRoute.vehiclePlate, newRoute.status,
      newRoute.totalPackages, newRoute.deliveredPackages, newRoute.estimatedDuration,
      newRoute.actualDuration, newRoute.distance, newRoute.startTime,
      newRoute.endTime, newRoute.date, newRoute.notes, newRoute.mechanism,
      newRoute.timeWindows, newRoute.warehouseId, newRoute.optimizedRoute,
      newRoute.stops, newRoute.createdAt, newRoute.updatedAt
    ])

    const insertedRoute = await db.get('SELECT * FROM routes WHERE id = ?', [result.lastID])

    await db.close()

    // Si es ruta automática y hay órdenes, actualizar su estado a 'in_transit' y asignar routeId
    if (body.mechanism === 'automatic' && selectedOrdersWithCoords.length > 0) {
      console.log('🔄 Actualizando estados de órdenes a "En Ruta"...')

      try {
        const updatePromises = selectedOrdersWithCoords.map(async (order, index) => {
          const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/package-orders/${order.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'in_transit',
              routeId: insertedRoute.id,
              stopNumber: index + 1
            })
          })

          if (!response.ok) {
            throw new Error(`Failed to update order ${order.id}`)
          }

          return response.json()
        })

        const updatedOrders = await Promise.all(updatePromises)
        console.log(`✅ ${updatedOrders.length} órdenes actualizadas a "En Ruta"`)

      } catch (updateError) {
        console.error('❌ Error actualizando órdenes:', updateError)
        // La ruta se creó pero no se pudieron actualizar las órdenes
      }
    }

    console.log('✅ Ruta creada exitosamente:', {
      routeNumber: insertedRoute.routeNumber,
      waypoints: waypoints.length,
      distance: optimizedRouteData?.distance,
      duration: optimizedRouteData?.duration,
      optimized: !!optimizedRouteData,
      ordersProcessed: body.mechanism === 'automatic' ? selectedOrdersWithCoords.length : 0
    })

    // Formatear respuesta
    const responseRoute = {
      ...insertedRoute,
      waypoints: waypoints,
      optimizedRoute: optimizedRouteData
    }

    return NextResponse.json(responseRoute, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/routes:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}