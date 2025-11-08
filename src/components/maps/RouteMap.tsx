'use client'

import React, { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { MapPin, Navigation, Clock, Info, Maximize, Minimize } from 'lucide-react'

// Importar CSS de Mapbox
import 'mapbox-gl/dist/mapbox-gl.css'

// Configurar token de Mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

interface RouteStop {
  id: number
  address: string
  customer: string
  type: 'pickup' | 'delivery'
  timeSlot?: string
  coordinates?: [number, number]
  orderNumber?: string
  orderIds?: number[]
  orderNumbers?: string[]
  totalOrders?: number
}

interface OptimizationResult {
  totalOrders: number
  pickups: number
  deliveries: number
  totalDistance: number
  estimatedDuration: string
  optimizedStops: number
  route: {
    start: string
    stops: RouteStop[]
    end: string
  }
}

interface RouteMapProps {
  optimizationResult: OptimizationResult | null
  warehouseCoordinates?: [number, number]
  theme?: 'light' | 'dark'
  onOptimizationComplete?: (result: any) => void
}

export default function RouteMap({
  optimizationResult,
  warehouseCoordinates = [-80.2395, 25.7548], // Miami coordinates
  theme = 'light',
  onOptimizationComplete
}: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [routes, setRoutes] = useState<any[]>([])
  const [selectedRoute, setSelectedRoute] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allCoordinates, setAllCoordinates] = useState<[number, number][]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const onOptimizationCompleteRef = useRef(onOptimizationComplete)
  const lastNotifiedRoute = useRef<number>(-1)

  // Limpiar marcadores existentes
  const clearMarkers = () => {
    console.log('🧹 Limpiando marcadores anteriores. Total:', markersRef.current.length)

    markersRef.current.forEach((marker, index) => {
      try {
        if (marker && marker.remove) {
          marker.remove()
          console.log(`✅ Marcador ${index} eliminado`)
        }
      } catch (error) {
        console.warn(`⚠️ Error eliminando marcador ${index}:`, error)
      }
    })

    markersRef.current = []
    console.log('✅ Todos los marcadores han sido limpiados')
  }

  // Manejar fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true)
        // Resize map after fullscreen
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.resize()
          }
        }, 100)
      }).catch((err) => {
        console.error('Error entering fullscreen:', err)
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
        // Resize map after exit fullscreen
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.resize()
          }
        }, 100)
      }).catch((err) => {
        console.error('Error exiting fullscreen:', err)
      })
    }
  }

  // Escuchar cambios en fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
      // Resize map when fullscreen state changes
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.resize()
        }
      }, 100)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Update ref when callback changes
  useEffect(() => {
    onOptimizationCompleteRef.current = onOptimizationComplete
  }, [onOptimizationComplete])

  useEffect(() => {
    // Crear mapa
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12',
      center: warehouseCoordinates,
      zoom: 11,
    })

    mapRef.current.on('load', () => {
      setLoading(false)
    })

    // Limpieza
    return () => {
      clearMarkers()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = undefined
      }
    }
  }, [warehouseCoordinates, theme])

  // Cuando hay resultados de optimización, procesar las rutas
  useEffect(() => {
    if (!optimizationResult) {
      console.log('⚠️ No hay resultados de optimización')
      return
    }

    console.log('🔍 [RouteMap] Datos recibidos:', {
      hasGeometry: !!optimizationResult.geometry,
      hasCoordinates: !!optimizationResult.coordinates,
      coordinatesLength: optimizationResult.coordinates?.length,
      hasStops: !!optimizationResult.stops,
      stopsLength: optimizationResult.stops?.length,
      hasRoute: !!optimizationResult.route,
      routeStopsLength: optimizationResult.route?.stops?.length
    })

    // Si ya hay datos de ruta optimizada con geometría, usarlos directamente
    if (optimizationResult.geometry || (optimizationResult.optimizedRoute && optimizationResult.optimizedRoute.data)) {
      console.log('📊 Usando rutas optimizadas existentes')

      // Obtener geometría y coordenadas de diferentes posibles fuentes
      const geometry = optimizationResult.geometry ||
                     optimizationResult.optimizedRoute?.data?.route?.geometry ||
                     optimizationResult.optimizedRoute?.geometry

      const distance = optimizationResult.distance ||
                      optimizationResult.optimizedRoute?.data?.route?.distance ||
                      optimizationResult.optimizedRoute?.distance ||
                      0

      const duration = optimizationResult.duration ||
                      optimizationResult.optimizedRoute?.data?.route?.duration ||
                      optimizationResult.optimizedRoute?.duration ||
                      0

      const coordinates = optimizationResult.coordinates ||
                         optimizationResult.optimizedRoute?.data?.route?.coordinates ||
                         optimizationResult.optimizedRoute?.coordinates ||
                         []

      console.log(`🛣️ Datos de ruta: ${distance} mi, ${duration} min`)

      if (geometry && coordinates.length > 0) {
        // Construir ruta principal
        const allRoutes = [
          {
            geometry: geometry,
            distance: distance * 1609.34, // Convertir millas a metros
            duration: duration * 60, // Convertir minutos a segundos
            coordinates: coordinates
          }
        ]

        setRoutes(allRoutes)

        // Preparar coordenadas para los marcadores
        const markerCoordinates: [number, number][] = [warehouseCoordinates]

        // Buscar paradas en múltiples ubicaciones posibles
        const stops = optimizationResult.stops ||
                     optimizationResult.route?.stops ||
                     []

        console.log('📍 [RouteMap] Paradas encontradas (sin almacén):', stops.length)
        console.log('📊 [RouteMap] Estructura completa de paradas:', stops.map((s: any, i: number) => ({
          index: i,
          waypointIndex: s.waypointIndex,
          address: s.address,
          coordinates: s.coordinates,
          customer: s.customer
        })))

        // Agregar coordenadas de cada parada
        if (stops.length > 0) {
          stops.forEach((stop: any, index: number) => {
            console.log(`  🎯 Parada ${index + 1} de ${stops.length}:`, {
              address: stop.address,
              customer: stop.customer,
              hasCoords: !!stop.coordinates,
              coords: stop.coordinates,
              waypointIndex: stop.waypointIndex
            })

            // Intentar obtener coordenadas de diferentes formatos
            let stopCoords: [number, number] | null = null

            if (stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2) {
              stopCoords = stop.coordinates as [number, number]
            } else if (stop.longitude && stop.latitude) {
              stopCoords = [stop.longitude, stop.latitude]
            }

            if (stopCoords) {
              markerCoordinates.push(stopCoords)
              console.log(`  ✅ Waypoint ${index + 1}: [${stopCoords[0].toFixed(6)}, ${stopCoords[1].toFixed(6)}] - ${stop.address}`)
            } else {
              console.warn(`  ⚠️ Parada ${index} sin coordenadas válidas`)
            }
          })
        }

        // Volver al almacén
        markerCoordinates.push(warehouseCoordinates)

        console.log('📍 Total coordenadas para marcadores:', markerCoordinates.length, '(incluye almacén inicio y fin)')
        console.log('🏁 Secuencia: Almacén → ' + stops.length + ' paradas → Almacén')
        setAllCoordinates(markerCoordinates)
        return
      }
    }

    // Si no hay rutas pre-procesadas, obtenerlas de la API
    if (!optimizationResult.route || !optimizationResult.route.stops) {
      console.log('⚠️ No hay paradas en los resultados de optimización')
      return
    }

    const fetchRoutes = async () => {
      try {
        const stops = optimizationResult.route.stops
        console.log(`📦 Procesando ${stops.length} paradas`)

        // Preparar coordenadas: almacén -> paradas -> almacén
        const coordinates: [number, number][] = [warehouseCoordinates]

        // Añadir paradas válidas con coordenadas
        console.log('🔍 DEBUG - Análisis detallado de paradas:')
        stops.forEach((stop, index) => {
          console.log(`📦 Parada ${index}:`, {
            id: stop.id,
            customerName: stop.customerName,
            coordinates: stop.coordinates,
            hasCoords: stop.coordinates && Array.isArray(stop.coordinates) && stop.coordinates.length === 2,
            coordsValid: stop.coordinates &&
              Array.isArray(stop.coordinates) &&
              stop.coordinates.length === 2 &&
              stop.coordinates[0] !== 0 &&
              stop.coordinates[1] !== 0 &&
              !isNaN(stop.coordinates[0]) &&
              !isNaN(stop.coordinates[1])
          })
        })

        const validStops = stops.filter((stop, index) => {
          const isValid = stop.coordinates &&
            Array.isArray(stop.coordinates) &&
            stop.coordinates.length === 2 &&
            stop.coordinates[0] !== 0 &&
            stop.coordinates[1] !== 0 &&
            !isNaN(stop.coordinates[0]) &&
            !isNaN(stop.coordinates[1])

          if (!isValid) {
            console.log(`❌ Parada ${index} (ID: ${stop.id}) INVÁLIDA:`, {
              customerName: stop.customerName,
              coordinates: stop.coordinates,
              reason: !stop.coordinates ? 'Sin coordenadas' :
                !Array.isArray(stop.coordinates) ? 'No es array' :
                stop.coordinates.length !== 2 ? 'Longitud incorrecta' :
                stop.coordinates[0] === 0 || stop.coordinates[1] === 0 ? 'Coordenadas cero' :
                isNaN(stop.coordinates[0]) || isNaN(stop.coordinates[1]) ? 'Coordenadas NaN' : 'Desconocido'
            })
          } else {
            console.log(`✅ Parada ${index} (ID: ${stop.id}) VÁLIDA:`, {
              customerName: stop.customerName,
              coordinates: stop.coordinates
            })
          }

          return isValid
        })

        console.log(`📊 Resumen: ${validStops.length} de ${stops.length} paradas con coordenadas válidas`)

        validStops.forEach((stop, index) => {
          console.log(`📍 Agregando coordenadas de parada ${index}:`, stop.coordinates)
          coordinates.push(stop.coordinates as [number, number])
        })

        // Volver al almacén
        coordinates.push(warehouseCoordinates)

        setAllCoordinates(coordinates)

        if (coordinates.length < 2) {
          console.warn('❌ No hay suficientes coordenadas válidas')
          return
        }

        console.log('📍 Coordenadas totales:', coordinates.length)

        // Construir URL para Mapbox Directions API
        const coordinatesString = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';')
        const apiUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?alternatives=true&geometries=geojson&overview=full&steps=true&access_token=${mapboxgl.accessToken}`

        console.log('📤 Obteniendo rutas de Mapbox API...')
        const response = await fetch(apiUrl)

        if (!response.ok) {
          throw new Error(`Mapbox API error: ${response.status}`)
        }

        const data = await response.json()

        console.log('✅ Rutas obtenidas:', data.routes.length)
        console.log('📊 Distancias:', data.routes.map((r: any) => `${(r.distance / 1609.34).toFixed(1)}mi`).join(', '))

        setRoutes(data.routes)

      } catch (error) {
        console.error('❌ Error obteniendo rutas:', error)
      }
    }

    fetchRoutes()
  }, [optimizationResult, warehouseCoordinates])

  // Crear marcadores (función separada para reutilización)
  const createMarkers = () => {
    const map = mapRef.current
    if (!map) {
      console.warn('⚠️ Mapa no disponible para crear marcadores')
      return
    }

    if (allCoordinates.length === 0) {
      console.warn('⚠️ No hay coordenadas para crear marcadores')
      return
    }

    // Obtener las paradas desde múltiples ubicaciones posibles
    const stops = optimizationResult?.stops || optimizationResult?.route?.stops || []

    console.log('📍 Creando marcadores. Coordenadas:', allCoordinates.length)
    console.log('📍 Paradas disponibles:', stops.length)

    // Limpiar marcadores anteriores
    clearMarkers()

    // Crear marcadores simples y robustos
    const createMarker = (coord: [number, number], index: number, isWarehouse: boolean = false, isStart: boolean = false, isEnd: boolean = false) => {
      console.log(`🎯 createMarker llamado - index: ${index}, isWarehouse: ${isWarehouse}, isStart: ${isStart}, isEnd: ${isEnd}`)
      console.log(`📍 Coordenadas:`, coord)

      let markerElement: HTMLDivElement
      let popupText = ''

      if (isWarehouse) {
        // Marcador de almacén - usar emoji simple
        markerElement = document.createElement('div')
        markerElement.style.cssText = `
          width: 32px;
          height: 32px;
          background: #10B981;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          z-index: 1000;
        `
        markerElement.innerHTML = '🏢'
        popupText = isStart ? 'Almacén (Inicio)' : 'Almacén (Fin)'
        console.log(`🏢 Marcador de almacén creado: ${popupText}`)
      } else {
        // Marcadores de paradas
        // El índice de la parada real es index - 1 (porque index 0 es el almacén)
        const stopIndex = index - 1
        const stop = stops[stopIndex]

        // El número del waypoint para MOSTRAR es index (porque excluimos el almacén)
        // index=1 → Parada 1, index=2 → Parada 2, etc.
        const waypointNumber = index

        console.log(`🔍 Procesando waypoint ${waypointNumber}:`, {
          allCoordinatesIndex: index,
          stopIndex: stopIndex,
          stopData: stop ? {
            address: stop.address,
            customer: stop.customer,
            coordinates: stop.coordinates,
            waypointIndexFromBackend: stop.waypointIndex
          } : 'NO ENCONTRADO'
        })

        // Obtener número de órdenes en esta parada
        const ordersCount = stop?.totalOrders || stop?.orderIds?.length || 1
        const hasMultipleOrders = ordersCount > 1

        const color = '#3B82F6' // Color azul consistente para todos los waypoints

        markerElement = document.createElement('div')

        if (hasMultipleOrders) {
          // Diseño especial para paradas con múltiples órdenes
          markerElement.style.cssText = `
            position: relative;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          `

          // Círculo principal con el número de waypoint
          const mainCircle = document.createElement('div')
          mainCircle.style.cssText = `
            width: 28px;
            height: 28px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 11px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          `
          mainCircle.innerHTML = `${waypointNumber}`

          // Badge con el número de órdenes
          const badge = document.createElement('div')
          badge.style.cssText = `
            position: absolute;
            top: -6px;
            right: -6px;
            width: 18px;
            height: 18px;
            background: #EF4444;
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          `
          badge.innerHTML = `${ordersCount}`

          markerElement.appendChild(mainCircle)
          markerElement.appendChild(badge)
        } else {
          // Diseño normal para paradas con una sola orden
          markerElement.style.cssText = `
            width: 28px;
            height: 28px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            z-index: 1000;
          `
          markerElement.innerHTML = `${waypointNumber}`
        }

        if (stop) {
          const address = typeof stop.address === 'string'
            ? stop.address
            : stop.address?.street || 'Dirección no disponible'

          // Construir el texto del popup
          if (hasMultipleOrders && stop.orderNumbers && stop.orderNumbers.length > 0) {
            const ordersList = stop.orderNumbers.map((orderNum: string, idx: number) =>
              `<div style="padding: 2px 0;">📦 ${orderNum}</div>`
            ).join('')
            popupText = `
              <div style="font-weight: 600; margin-bottom: 4px;">Parada ${waypointNumber} (${ordersCount} órdenes)</div>
              <div style="margin-bottom: 6px;">${address}</div>
              <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 4px; font-size: 11px;">
                ${ordersList}
              </div>
            `
          } else {
            popupText = `
              <div style="font-weight: 600; margin-bottom: 2px;">Parada ${waypointNumber}</div>
              <div style="font-size: 12px; opacity: 0.9;">${stop.customer || 'Cliente'}</div>
              <div style="font-size: 11px; opacity: 0.7; margin-top: 2px;">${address}</div>
            `
          }
          console.log(`✅ Marcador de parada creado - Waypoint ${waypointNumber}: ${stop.customer} en ${address} (${ordersCount} órdenes)`)
        } else {
          popupText = `
            <div style="font-weight: 600;">Parada ${waypointNumber}</div>
            <div style="font-size: 11px; opacity: 0.7;">Información no disponible</div>
          `
          console.log(`⚠️ No se encontró información de la parada para waypoint ${waypointNumber}`)
        }
      }

      // Crear popup con información
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 15,
        className: 'custom-popup',
        maxWidth: '300px'
      }).setHTML(`
        <div style="
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 500;
          background: rgb(17, 24, 39) !important;
          color: white !important;
          border-radius: 6px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.6);
          border: 1px solid rgb(55, 65, 81);
          white-space: normal;
          max-width: 280px;
          position: relative;
        ">
          ${popupText}
        </div>
      `)

      // Crear y guardar el marcador
      const marker = new mapboxgl.Marker({
        element: markerElement,
        anchor: 'center'
      })
        .setLngLat(coord)
        .setPopup(popup)
        .addTo(map)

      markersRef.current.push(marker)

      console.log(`✅ Marcador creado para índice ${index} en coordenadas:`, coord)

      // Mostrar popup al pasar el mouse
      markerElement.addEventListener('mouseenter', () => {
        popup.addTo(map)
      })

      markerElement.addEventListener('mouseleave', () => {
        popup.remove()
      })

      return marker
    }

    // Agregar marcadores para cada coordenada
    console.log('🚀 Iniciando creación de marcadores para allCoordinates:', allCoordinates.length)
    console.log('📊 Desglose esperado: 1 almacén inicio + ' + stops.length + ' paradas + 1 almacén fin = ' + (stops.length + 2) + ' marcadores')

    allCoordinates.forEach((coord, index) => {
      console.log(`📍 Procesando coordenada index ${index}/${allCoordinates.length - 1}:`, coord)
      if (index === 0) {
        // Almacén inicio
        console.log('🏢 Creando marcador de almacén inicio')
        createMarker(coord, index, true, true, false)
      } else if (index === allCoordinates.length - 1 && allCoordinates.length > 1) {
        // Almacén fin (solo si hay más de un punto)
        console.log('🏢 Creando marcador de almacén fin')
        createMarker(coord, index, true, false, true)
      } else {
        // Paradas intermedias (index 1 hasta length-2)
        const waypointNum = index // Este será el número que se muestra
        console.log(`📦 Creando marcador de parada intermedia - Waypoint ${waypointNum}`)
        createMarker(coord, index, false, false, false)
      }
    })

    console.log(`✅ Total de marcadores creados: ${markersRef.current.length}`)
    console.log(`   - 1 Almacén (Inicio)`)
    console.log(`   - ${stops.length} Paradas de entrega`)
    console.log(`   - 1 Almacén (Regreso)`)
    console.log(`🎯 Paradas SIN contar almacén: ${stops.length}`)
  }

  // Dibujar rutas en el mapa
  useEffect(() => {
    const map = mapRef.current
    if (!map || routes.length === 0) return

    const updateMap = () => {
      // Limpiar capas de rutas anteriores
      routes.forEach((_, i) => {
        const id = `route-${i}`
        if (map.getLayer(id)) {
          map.removeLayer(id)
        }
        if (map.getSource(id)) {
          map.removeSource(id)
        }
      })

      // Añadir cada ruta como una capa
      routes.forEach((route, i) => {
        const id = `route-${i}`

        map.addSource(id, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: route.geometry,
          },
        })

        map.addLayer({
          id,
          type: 'line',
          source: id,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': i === selectedRoute ? '#DC2626' : '#888',
            'line-width': i === selectedRoute ? 6 : 3,
            'line-opacity': i === selectedRoute ? 0.9 : 0.4,
          },
        })
      })

      // Ajustar vista para mostrar toda la ruta
      if (allCoordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds()
        allCoordinates.forEach(coord => bounds.extend(coord))
        map.fitBounds(bounds, { padding: 60, maxZoom: 15 })
      }
    }

    if (map.loaded()) {
      updateMap()
      createMarkers()
    } else {
      map.on('load', () => {
        updateMap()
        createMarkers()
      })
    }

    // Cleanup para cuando se desmonte el componente
    return () => {
      clearMarkers()
    }
  }, [routes, allCoordinates, optimizationResult])

  // Efecto separado para manejar cambios en selectedRoute
  useEffect(() => {
    const map = mapRef.current
    if (!map || routes.length === 0) return

    console.log('🔄 Actualizando ruta seleccionada:', selectedRoute)

    // Actualizar colores de rutas
    routes.forEach((_, i) => {
      const id = `route-${i}`
      if (map.getLayer(id)) {
        map.setPaintProperty(id, 'line-color', i === selectedRoute ? '#DC2626' : '#888')
        map.setPaintProperty(id, 'line-width', i === selectedRoute ? 6 : 3)
        map.setPaintProperty(id, 'line-opacity', i === selectedRoute ? 0.9 : 0.4)
      }
    })

    // Recrear marcadores con un pequeño retraso para asegurar que el mapa esté listo
    const recreateMarkers = () => {
      console.log('📍 Recreando marcadores para ruta:', selectedRoute)
      createMarkers()
    }

    // Usar setTimeout para evitar condiciones de carrera
    const timeoutId = setTimeout(recreateMarkers, 100)

    // Notificar al componente padre sobre la ruta seleccionada SOLO si ha cambiado realmente
    if (onOptimizationCompleteRef.current && routes[selectedRoute] && lastNotifiedRoute.current !== selectedRoute) {
      const routeData = {
        selectedRouteIndex: selectedRoute,
        selectedRoute: routes[selectedRoute],
        allRoutes: routes
      }

      // Marcar como notificado para evitar bucles
      lastNotifiedRoute.current = selectedRoute

      // Usar setTimeout para evitar el bucle infinito
      setTimeout(() => {
        if (onOptimizationCompleteRef.current) {
          onOptimizationCompleteRef.current(routeData)
        }
      }, 0)
    }

    // Limpiar timeout
    return () => {
      clearTimeout(timeoutId)
    }
  }, [selectedRoute, routes])

  // Reset last notified route when routes array changes
  useEffect(() => {
    lastNotifiedRoute.current = -1
  }, [routes])

  // Función para formatear duración en horas y minutos
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (hours === 0) {
      return `${minutes} min`
    } else if (minutes === 0) {
      return `${hours}h`
    } else {
      return `${hours}h ${minutes}min`
    }
  }

  const highlightRoute = (index: number) => {
    if (selectedRoute !== index) {
      setSelectedRoute(index)
    }
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '500px', height: isFullscreen ? '100vh' : '500px' }}
      />

      {/* Botón de Fullscreen */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-20 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 p-3 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-200 hover:scale-110"
        title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
      >
        {isFullscreen ? (
          <Minimize className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        ) : (
          <Maximize className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        )}
      </button>

      {/* Panel lateral de rutas alternativas */}
      {routes.length > 0 && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 border border-gray-200 dark:border-gray-700 max-w-xs z-10">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Rutas disponibles</h3>
          </div>

          {routes.map((route, i) => {
            const distanceMi = (route.distance / 1609.34).toFixed(1)
            const durationFormatted = formatDuration(route.duration)
            const isOptimal = i === 0
            const isSelected = selectedRoute === i

            return (
              <button
                key={i}
                onClick={() => highlightRoute(i)}
                className={`w-full text-left p-3 mb-2 rounded-lg transition-all transform hover:scale-[1.02] ${
                  isSelected
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border-2 border-blue-500 shadow-md'
                    : isOptimal
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-300 border-2 border-green-400 hover:border-green-500'
                      : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium">Ruta {i + 1}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : isOptimal
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                  }`}>
                    {isOptimal ? '⭐ Óptima' : `Alt ${i}`}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <Navigation className="w-3 h-3" />
                    <span>{distanceMi} mi</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{durationFormatted}</span>
                  </div>
                </div>

                {isOptimal && (
                  <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                    Ruta más eficiente
                  </div>
                )}
              </button>
            )
          })}

          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1 mb-1">
                <Info className="w-3 h-3" />
                <span>La ruta óptima minimiza distancia y tiempo</span>
              </div>
              {routes.length > 1 && (
                <div>
                  {routes.length - 1} alternativa{routes.length - 1 !== 1 ? 's' : ''} disponible{routes.length - 1 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

  
      {/* Estado de carga */}
      {loading && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando mapa...</p>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay ruta */}
      {!optimizationResult && !loading && (
        <div className="absolute inset-0 bg-gray-50 dark:bg-gray-800 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Mapa de Ruta
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Esperando datos de la ruta optimizada...
            </p>
          </div>
        </div>
      )}

      {/* Estilos CSS personalizados para popups */}
      <style jsx global>{`
        /* Asegurar que los popups estén en primer plano - MÁXIMA PRIORIDAD */
        .mapboxgl-popup.custom-popup {
          z-index: 99999 !important;
          pointer-events: auto !important;
        }

        /* Contenedor del popup - Sin background para que se vea el interno */
        .mapboxgl-popup.custom-popup .mapboxgl-popup-content {
          background: rgb(17, 24, 39) !important;
          padding: 0 !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6) !important;
          border: none !important;
          border-radius: 8px !important;
          overflow: visible !important;
          min-width: 180px !important;
        }

        /* Asegurar que el contenido interno también tenga el background oscuro */
        .mapboxgl-popup.custom-popup .mapboxgl-popup-content > div {
          background: rgb(17, 24, 39) !important;
          color: white !important;
          border-radius: 6px !important;
        }

        /* Punta del popup - Color oscuro para que coincida */
        .mapboxgl-popup.custom-popup .mapboxgl-popup-tip {
          border-top-color: rgb(17, 24, 39) !important;
          border-bottom-color: rgb(17, 24, 39) !important;
          border-left-color: rgb(17, 24, 39) !important;
          border-right-color: rgb(17, 24, 39) !important;
          z-index: 99998 !important;
        }

        /* Asegurar que los marcadores estén DETRÁS del popup */
        .mapboxgl-marker {
          z-index: 100 !important;
        }

        /* Cuando el popup está activo, forzar z-index aún más alto */
        .mapboxgl-popup.custom-popup.mapboxgl-popup-anchor-top,
        .mapboxgl-popup.custom-popup.mapboxgl-popup-anchor-bottom,
        .mapboxgl-popup.custom-popup.mapboxgl-popup-anchor-left,
        .mapboxgl-popup.custom-popup.mapboxgl-popup-anchor-right {
          z-index: 99999 !important;
        }
      `}</style>
    </div>
  )
}