'use client'

import React, { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { motion } from 'framer-motion'
import { Map as MapIcon, Satellite, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

// Token de Mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

interface PickupLocationMapProps {
  order: {
    orderNumber: string
    customerName: string
    customerAddress: string
    scheduledDate?: string
    timeSlot?: string
    services: string[]
    latitude?: number | string | null
    longitude?: number | string | null
  }
  zone?: {
    name: string
    color: string
  } | null
  route?: {
    routeNumber: string
    stops: any[]
    optimizedRoute?: any
  } | null
  className?: string
}

export default function PickupLocationMap({ order, zone, route, className }: PickupLocationMapProps) {
  const { theme } = useTheme()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets')
  const [isLoading, setIsLoading] = useState(true)
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)

  const lat = order.latitude ? parseFloat(order.latitude.toString()) : null
  const lng = order.longitude ? parseFloat(order.longitude.toString()) : null

  // Geocoding si no hay coordenadas
  useEffect(() => {
    const geocodeAddress = async () => {
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        setCoordinates({ lat, lng })
        return
      }

      // Si no hay coordenadas pero sí dirección, hacer geocoding
      if (order.customerAddress) {
        try {
          const address = typeof order.customerAddress === 'string'
            ? order.customerAddress
            : JSON.parse(order.customerAddress).street || order.customerAddress

          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}&limit=1`
          )
          const data = await response.json()

          if (data.features && data.features.length > 0) {
            const [longitude, latitude] = data.features[0].center
            setCoordinates({ lat: latitude, lng: longitude })
          } else {
            setIsLoading(false)
          }
        } catch (error) {
          console.error('Error geocoding address:', error)
          setIsLoading(false)
        }
      } else {
        setIsLoading(false)
      }
    }

    geocodeAddress()
  }, [lat, lng, order.customerAddress])

  useEffect(() => {
    if (!mapContainer.current || !coordinates) {
      return
    }

    // Inicializar mapa
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle === 'streets'
        ? 'mapbox://styles/mapbox/streets-v12'
        : 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [coordinates.lng, coordinates.lat],
      zoom: 14
    })

    map.current.on('load', () => {
      setIsLoading(false)

      if (!map.current) return

      // 1. Agregar marker de la ubicación de recogida (estilo PackageDeliveryMap)
      const el = document.createElement('div')
      el.className = 'pickup-marker'
      const markerColor = zone?.color || '#F59E0B'
      el.innerHTML = `
        <div class="marker-container" style="
          position: relative;
          cursor: pointer;
          transition: all 0.3s ease;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
        ">
          <!-- Pin principal con animación -->
          <div class="marker-pin" style="
            width: 40px;
            height: 40px;
            background: ${markerColor};
            border-radius: 50% 50% 50% 15%;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
            position: relative;
            animation: markerBounce 2s infinite ease-in-out;
          ">
            <span style="
              transform: rotate(45deg);
              font-size: 18px;
              filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
            ">📦</span>
          </div>

          <!-- Círculo exterior pulsante -->
          <div class="pulse-ring" style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 60px;
            height: 60px;
            border: 2px solid ${markerColor};
            border-radius: 50%;
            opacity: 0;
            animation: pulseAnimation 2s infinite;
          "></div>
        </div>

        <!-- Estilos CSS mejorados -->
        <style>
          @keyframes markerBounce {
            0%, 100% { transform: rotate(-45deg) scale(1); }
            50% { transform: rotate(-45deg) scale(1.1); }
          }

          @keyframes pulseAnimation {
            0% {
              transform: translate(-50%, -50%) scale(0.8);
              opacity: 0.8;
            }
            100% {
              transform: translate(-50%, -50%) scale(1.5);
              opacity: 0;
            }
          }
        </style>
      `

      // Popup de información
      const popupContent = `
        <div style="padding: 8px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">${order.orderNumber}</h3>
          <p style="margin: 4px 0; font-size: 12px;"><strong>Cliente:</strong> ${order.customerName}</p>
          <p style="margin: 4px 0; font-size: 12px;"><strong>Dirección:</strong> ${order.customerAddress}</p>
          ${zone ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Zona:</strong> ${zone.name}</p>` : ''}
          ${order.scheduledDate ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Fecha:</strong> ${new Date(order.scheduledDate).toLocaleDateString('es-ES')}</p>` : ''}
          ${order.timeSlot ? `<p style="margin: 4px 0; font-size: 12px;"><strong>Horario:</strong> ${order.timeSlot}</p>` : ''}
          <p style="margin: 4px 0; font-size: 12px;"><strong>Servicios:</strong> ${order.services.join(', ')}</p>
        </div>
      `

      const popup = new mapboxgl.Popup({ offset: 25 })
        .setHTML(popupContent)

      new mapboxgl.Marker(el)
        .setLngLat([coordinates.lng, coordinates.lat])
        .setPopup(popup)
        .addTo(map.current!)

      // 2. Si hay ruta, dibujar la ruta completa con waypoints
      if (route && route.stops && route.stops.length > 0) {
        // Dibujar línea de ruta
        if (route.optimizedRoute && route.optimizedRoute.geometry) {
          map.current!.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: route.optimizedRoute.geometry
            }
          })

          map.current!.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': zone?.color || '#3B82F6',
              'line-width': 4,
              'line-opacity': 0.8
            }
          })
        }

        // Dibujar waypoints numerados
        route.stops.forEach((stop: any, index: number) => {
          if (stop.latitude && stop.longitude) {
            const stopLat = parseFloat(stop.latitude.toString())
            const stopLng = parseFloat(stop.longitude.toString())

            if (!isNaN(stopLat) && !isNaN(stopLng)) {
              const waypointEl = document.createElement('div')
              waypointEl.className = 'waypoint-marker'
              const waypointColor = stop.status === 'delivered' ? '#10B981' : (stop.zoneColor || '#6B7280')
              waypointEl.innerHTML = `
                <div class="marker-container" style="
                  position: relative;
                  cursor: pointer;
                  transition: all 0.3s ease;
                  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
                ">
                  <div class="marker-pin" style="
                    width: 32px;
                    height: 32px;
                    background: ${waypointColor};
                    border-radius: 50% 50% 50% 15%;
                    transform: rotate(-45deg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid white;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
                    position: relative;
                  ">
                    <span style="
                      transform: rotate(45deg);
                      color: white;
                      font-weight: bold;
                      font-size: 12px;
                    ">${index + 1}</span>
                  </div>
                </div>
              `

              const waypointPopup = new mapboxgl.Popup({ offset: 15 })
                .setHTML(`
                  <div style="padding: 6px;">
                    <p style="margin: 0; font-size: 12px;"><strong>Parada ${index + 1}</strong></p>
                    <p style="margin: 2px 0; font-size: 11px;">${stop.address || stop.customerAddress}</p>
                    ${stop.status ? `<p style="margin: 2px 0; font-size: 11px;">Estado: ${stop.status}</p>` : ''}
                  </div>
                `)

              new mapboxgl.Marker(waypointEl)
                .setLngLat([stopLng, stopLat])
                .setPopup(waypointPopup)
                .addTo(map.current!)
            }
          }
        })

        // Ajustar bounds para mostrar toda la ruta
        const bounds = new mapboxgl.LngLatBounds()
        if (coordinates) {
          bounds.extend([coordinates.lng, coordinates.lat])
        }
        route.stops.forEach((stop: any) => {
          if (stop.latitude && stop.longitude) {
            const stopLat = parseFloat(stop.latitude.toString())
            const stopLng = parseFloat(stop.longitude.toString())
            if (!isNaN(stopLat) && !isNaN(stopLng)) {
              bounds.extend([stopLng, stopLat])
            }
          }
        })
        map.current!.fitBounds(bounds, { padding: 50 })
      }

      // Agregar controles de navegación
      map.current!.addControl(new mapboxgl.NavigationControl(), 'top-right')
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [coordinates, mapStyle])

  // Cambiar estilo del mapa
  const toggleMapStyle = () => {
    setMapStyle(prev => prev === 'streets' ? 'satellite' : 'streets')
  }

  if (!coordinates && !isLoading) {
    return (
      <div className={cn(
        'flex items-center justify-center rounded-xl',
        theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100',
        className
      )}>
        <div className="text-center p-8">
          <MapIcon className={cn(
            'w-12 h-12 mx-auto mb-3',
            theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
          )} />
          <p className={cn(
            'text-sm',
            theme === 'dark' ? 'text-gray-500' : 'text-gray-600'
          )}>
            No se pudo obtener la ubicación para esta dirección
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative w-full', className)} style={{ height: '400px' }}>
      {/* Loading Skeleton */}
      {isLoading && (
        <div className={cn(
          'absolute inset-0 z-10 flex items-center justify-center rounded-xl',
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
        )}>
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Layers className={cn(
                'w-8 h-8 mx-auto mb-2',
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              )} />
            </motion.div>
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Cargando mapa...
            </p>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapContainer}
        className="absolute inset-0 w-full h-full rounded-xl overflow-hidden"
      />

      {/* Map Style Toggle */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleMapStyle}
        className={cn(
          'absolute bottom-4 right-4 z-10',
          'px-3 py-2 rounded-lg shadow-lg',
          'flex items-center gap-2',
          'transition-colors duration-200',
          theme === 'dark'
            ? 'bg-gray-800 hover:bg-gray-700 text-white'
            : 'bg-white hover:bg-gray-50 text-gray-900'
        )}
      >
        {mapStyle === 'streets' ? (
          <>
            <Satellite className="w-4 h-4" />
            <span className="text-xs font-medium">Satélite</span>
          </>
        ) : (
          <>
            <MapIcon className="w-4 h-4" />
            <span className="text-xs font-medium">Calles</span>
          </>
        )}
      </motion.button>

      {/* Legend */}
      {route && route.stops && route.stops.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            'absolute top-4 left-4 z-10',
            'px-3 py-2 rounded-lg shadow-lg',
            theme === 'dark' ? 'bg-gray-800/95 backdrop-blur-sm' : 'bg-white/95 backdrop-blur-sm'
          )}
        >
          <p className={cn(
            'text-xs font-semibold mb-2',
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Leyenda
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone?.color || '#3B82F6' }}></div>
              <span className={cn(
                'text-xs',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Ubicación de recogida
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span className={cn(
                'text-xs',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Paradas pendientes
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className={cn(
                'text-xs',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Paradas completadas
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
