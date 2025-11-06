'use client'

import React, { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'

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
  const [routes, setRoutes] = useState<any[]>([])
  const [selectedRoute, setSelectedRoute] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allCoordinates, setAllCoordinates] = useState<[number, number][]>([])
  const markersRef = useRef<mapboxgl.Marker[]>([])

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

  // Cuando hay resultados de optimización, obtener rutas de Mapbox
  useEffect(() => {
    if (!optimizationResult || !optimizationResult.route || !optimizationResult.route.stops) {
      return
    }

    const fetchRoutes = async () => {
      try {
        const stops = optimizationResult.route.stops

        // Preparar coordenadas: almacén -> paradas -> almacén
        const coordinates: [number, number][] = [warehouseCoordinates]

        // Añadir paradas válidas con coordenadas
        const validStops = stops.filter(stop =>
          stop.coordinates &&
          stop.coordinates[0] !== 0 &&
          stop.coordinates[1] !== 0
        )

        validStops.forEach(stop => {
          coordinates.push(stop.coordinates!)
        })

        // Volver al almacén
        coordinates.push(warehouseCoordinates)

        setAllCoordinates(coordinates)

        if (coordinates.length < 2) {
          console.warn('❌ No hay suficientes coordenadas válidas')
          return
        }

        // Construir URL para Mapbox Directions API
        const coordinatesString = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';')
        const apiUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?alternatives=true&geometries=geojson&overview=full&steps=true&access_token=${mapboxgl.accessToken}`

        console.log('📤 Obteniendo rutas de Mapbox API...')
        const response = await fetch(apiUrl)
        const data = await response.json()

        console.log('✅ Rutas obtenidas:', data.routes.length)
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

    console.log('📍 Creando marcadores. Coordenadas:', allCoordinates.length)
    console.log('📍 Paradas disponibles:', optimizationResult?.route?.stops?.length || 0)

    // Limpiar marcadores anteriores
    clearMarkers()

    // Crear marcadores simples y robustos
    const createMarker = (coord: [number, number], index: number, isWarehouse: boolean = false, isStart: boolean = false, isEnd: boolean = false) => {
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
      } else {
        // Marcadores de paradas
        const stop = optimizationResult?.route?.stops?.[index - 1]
        const isPickup = stop?.type === 'pickup'
        const color = isPickup ? '#F59E0B' : '#3B82F6'

        markerElement = document.createElement('div')
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
        markerElement.innerHTML = `${index}`

        if (stop) {
          popupText = `${index}. ${stop.customer}\n${stop.address}`
        }
      }

      // Crear popup con información
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10
      }).setHTML(`
        <div style="padding: 4px 8px; font-size: 12px; font-weight: 500;">
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
    allCoordinates.forEach((coord, index) => {
      if (index === 0) {
        // Almacén inicio
        createMarker(coord, index, true, true, false)
      } else if (index === allCoordinates.length - 1 && allCoordinates.length > 1) {
        // Almacén fin (solo si hay más de un punto)
        createMarker(coord, index, true, false, true)
      } else {
        // Paradas intermedias
        createMarker(coord, index, false, false, false)
      }
    })

    console.log(`✅ Total de marcadores creados: ${markersRef.current.length}`)
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

    // Notificar al componente padre sobre la ruta seleccionada
    if (onOptimizationComplete && routes[selectedRoute]) {
      onOptimizationComplete({
        selectedRouteIndex: selectedRoute,
        selectedRoute: routes[selectedRoute],
        allRoutes: routes
      })
    }

    // Limpiar timeout
    return () => {
      clearTimeout(timeoutId)
    }
  }, [selectedRoute, routes, onOptimizationComplete])

  const highlightRoute = (index: number) => {
    if (selectedRoute !== index) {
      setSelectedRoute(index)
    }
  }

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '500px', height: '500px' }}
      />

      {/* Panel lateral de rutas alternativas */}
      {routes.length > 0 && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700 max-w-xs">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Rutas alternativas</h3>
          {routes.map((route, i) => {
            const distanceKm = (route.distance / 1000).toFixed(2)
            const durationMin = Math.round(route.duration / 60)
            return (
              <button
                key={i}
                onClick={() => highlightRoute(i)}
                className={`w-full text-left p-2 mb-2 rounded-md transition-colors ${
                  selectedRoute === i
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-2 border-red-500'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">Ruta {i + 1}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    selectedRoute === i
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                  }`}>
                    {i === 0 ? 'Óptima' : `Alt ${i}`}
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {distanceKm} km • {durationMin} min
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Información de la ruta optimizada */}
      {optimizationResult && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700 max-w-xs">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Resumen de Ruta</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Total Paradas:</span>
              <span className="font-medium text-gray-900 dark:text-white">{optimizationResult.totalOrders}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Recogidas:</span>
              <span className="font-medium text-amber-600">{optimizationResult.pickups}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Entregas:</span>
              <span className="font-medium text-blue-600">{optimizationResult.deliveries}</span>
            </div>
            {routes[selectedRoute] && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">Distancia:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {(routes[selectedRoute].distance / 1000).toFixed(2)} km
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">Duración:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {Math.round(routes[selectedRoute].duration / 60)} min
                  </span>
                </div>
              </>
            )}
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
    </div>
  )
}