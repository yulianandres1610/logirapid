'use client'

import React, { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { MapPin, Truck, Package, Navigation } from 'lucide-react'

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
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const routeLayerRef = useRef<string>('route-layer')
  const [loading, setLoading] = useState(true)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizationProgress, setOptimizationProgress] = useState(0)

  // Función para obtener ruta optimizada con Mapbox Directions API
  const getOptimizedRoute = async (stops: RouteStop[], warehouse: [number, number]) => {
    console.log('🚀 Iniciando optimización de ruta con Mapbox')
    console.log('📍 Almacén:', warehouse)
    console.log('📦 Paradas:', stops.length)

    if (stops.length === 0) {
      console.warn('❌ No hay paradas para optimizar')
      return null
    }

    try {
      setOptimizing(true)
      setOptimizationProgress(20)

      // Preparar coordenadas: almacén -> paradas -> almacén
      const coordinates: [number, number][] = [warehouse]

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
      coordinates.push(warehouse)

      console.log('📍 Coordenadas preparadas:', coordinates.length, 'puntos')

      if (coordinates.length < 2) {
        console.warn('❌ No hay suficientes coordenadas válidas')
        return null
      }

      setOptimizationProgress(50)

      // Llamar a Mapbox Directions API
      const coordinatesString = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';')
      const mapboxToken = mapboxgl.accessToken

      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?` +
        `access_token=${mapboxToken}&` +
        `geometries=geojson&` +
        `overview=full&` +
        `steps=true`

      console.log('📤 Llamando a Mapbox Directions API...')

      const response = await fetch(directionsUrl)

      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.status}`)
      }

      setOptimizationProgress(80)

      const result = await response.json()
      console.log('✅ Respuesta de Mapbox recibida')

      if (result.routes && result.routes.length > 0) {
        const route = result.routes[0]
        const distanceMiles = (route.distance / 1609.34).toFixed(1)
        const durationMinutes = Math.floor(route.duration / 60)

        console.log(`🎯 Ruta optimizada: ${distanceMiles} mi, ${durationMinutes} min`)

        const optimizedData = {
          geometry: route.geometry,
          distance: parseFloat(distanceMiles),
          duration: durationMinutes,
          coordinates: route.geometry.coordinates,
          stops: validStops
        }

        setOptimizationProgress(100)

        // Llamar al callback
        if (onOptimizationComplete) {
          onOptimizationComplete(optimizedData)
        }

        return optimizedData
      }

      return null

    } catch (error) {
      console.error('❌ Error en optimización:', error)
      return null
    } finally {
      setOptimizing(false)
      setTimeout(() => setOptimizationProgress(0), 1000)
    }
  }

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: warehouseCoordinates,
      zoom: 12,
      pitch: 0,
      bearing: 0
    })

    mapRef.current.on('load', () => {
      setLoading(false)
      console.log('✅ Mapa cargado')
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = undefined
      }
    }
  }, [warehouseCoordinates])

  // Actualizar mapa cuando hay resultados de optimización
  useEffect(() => {
    const updateMapWithRoute = async () => {
      if (!mapRef.current || !optimizationResult || loading || optimizing) {
        return
      }

      const map = mapRef.current
      console.log('🗺️ Actualizando mapa con ruta optimizada')

      // Optimizar ruta
      const optimizedData = await getOptimizedRoute(optimizationResult.route.stops, warehouseCoordinates)

      if (!optimizedData) {
        console.warn('⚠️ No se pudo obtener la ruta optimizada')
        return
      }

      // Limpiar elementos existentes
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []

      // Remover capa de ruta anterior
      if (map.getLayer(routeLayerRef.current)) {
        map.removeLayer(routeLayerRef.current)
      }
      if (map.getSource(routeLayerRef.current)) {
        map.removeSource(routeLayerRef.current)
      }

      // Dibujar la ruta
      if (optimizedData.coordinates && optimizedData.coordinates.length > 0) {
        console.log('🛣️ Dibujando ruta con', optimizedData.coordinates.length, 'puntos')

        const routeGeoJSON = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: optimizedData.coordinates
          }
        }

        // Añadir fuente
        map.addSource(routeLayerRef.current, {
          type: 'geojson',
          data: routeGeoJSON
        })

        // Añadir capa de ruta
        map.addLayer({
          id: routeLayerRef.current,
          type: 'line',
          source: routeLayerRef.current,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#DC2626',
            'line-width': 6,
            'line-opacity': 1
          }
        })

        console.log('✅ Ruta dibujada en el mapa')
      }

      // Crear marcador del almacén
      const createWarehouseMarker = (label: string) => {
        const el = document.createElement('div')
        el.style.cssText = `
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
          position: relative;
        `
        el.innerHTML = '🏢'

        // Añadir etiqueta
        const labelEl = document.createElement('div')
        labelEl.style.cssText = `
          position: absolute;
          bottom: -25px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(16, 185, 129, 0.9);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
        `
        labelEl.textContent = label
        el.appendChild(labelEl)

        return el
      }

      // Marcador de almacén (inicio)
      const warehouseMarker = new mapboxgl.Marker({
        element: createWarehouseMarker('Inicio'),
        anchor: 'center'
      })
        .setLngLat(warehouseCoordinates)
        .addTo(map)

      markersRef.current.push(warehouseMarker)

      // Crear marcadores para las paradas
      optimizedData.stops.forEach((stop, index) => {
        const isPickup = stop.type === 'pickup'
        const color = isPickup ? '#F59E0B' : '#3B82F6'

        const stopEl = document.createElement('div')
        stopEl.style.cssText = `
          width: 36px;
          height: 36px;
          background: ${color};
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
          box-shadow: 0 4px 12px ${color}66;
          position: relative;
        `
        stopEl.innerHTML = `${index + 1}`

        // Añadir etiqueta con nombre del cliente
        const labelEl = document.createElement('div')
        labelEl.style.cssText = `
          position: absolute;
          bottom: -22px;
          left: 50%;
          transform: translateX(-50%);
          background: ${color};
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
        `
        labelEl.textContent = stop.customer.substring(0, 15) + (stop.customer.length > 15 ? '...' : '')
        stopEl.appendChild(labelEl)

        const stopMarker = new mapboxgl.Marker({
          element: stopEl,
          anchor: 'center'
        })
          .setLngLat(stop.coordinates!)
          .addTo(map)

        markersRef.current.push(stopMarker)
      })

      // Marcador de almacén (fin)
      const warehouseEndMarker = new mapboxgl.Marker({
        element: createWarehouseMarker('Fin'),
        anchor: 'center'
      })
        .setLngLat(warehouseCoordinates)
        .addTo(map)

      markersRef.current.push(warehouseEndMarker)

      // Ajustar vista para mostrar toda la ruta
      if (optimizedData.coordinates && optimizedData.coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds()
        optimizedData.coordinates.forEach(coord => bounds.extend(coord))
        map.fitBounds(bounds, { padding: 50, maxZoom: 14 })
      }

      console.log('✅ Mapa actualizado completamente')
    }

    updateMapWithRoute()
  }, [optimizationResult, warehouseCoordinates])

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '500px', height: '500px' }}
      />

      {/* Estado de carga */}
      {loading && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando mapa...</p>
          </div>
        </div>
      )}

      {/* Estado de optimización */}
      {optimizing && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Optimizando ruta</h3>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Procesando con Mapbox...</span>
                <span>{optimizationProgress}%</span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${optimizationProgress}%` }}
                ></div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {optimizationProgress < 50 && 'Preparando coordenadas...'}
                {optimizationProgress >= 50 && optimizationProgress < 90 && 'Optimizando ruta...'}
                {optimizationProgress >= 90 && 'Finalizando...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Información de la ruta */}
      {optimizationResult && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Navigation className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Resumen de Ruta</h3>
          </div>
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
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Distancia:</span>
              <span className="font-medium text-gray-900 dark:text-white">{optimizationResult.totalDistance} mi</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Duración:</span>
              <span className="font-medium text-gray-900 dark:text-white">{optimizationResult.estimatedDuration}</span>
            </div>
          </div>
        </div>
      )}

      {/* Leyenda */}
      {optimizationResult && (
        <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Leyenda</h4>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
              <span className="text-gray-600 dark:text-gray-400">Almacén</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 bg-amber-500 rounded-full border-2 border-white"></div>
              <span className="text-gray-600 dark:text-gray-400">Recogida</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
              <span className="text-gray-600 dark:text-gray-400">Entrega</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-8 h-1 bg-red-600"></div>
              <span className="text-gray-600 dark:text-gray-400">Ruta</span>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay ruta */}
      {!optimizationResult && !loading && !optimizing && (
        <div className="absolute inset-0 bg-gray-50 dark:bg-gray-800 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <MapPin className="w-16 h-16 mx-auto text-gray-400 mb-4" />
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