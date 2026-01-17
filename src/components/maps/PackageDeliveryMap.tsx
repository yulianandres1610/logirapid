'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import { Package, MapPin, Navigation, User, Clock, Truck } from 'lucide-react'

// Importar CSS de Mapbox
import 'mapbox-gl/dist/mapbox-gl.css'

// Configurar token de Mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

interface PackageOrder {
  id: number
  orderNumber: string
  customerName: string
  customerAddress?: string
  services: (string | { name?: string; type?: string; quantity?: number; unitPrice?: number; subtotal?: number })[]
  boxes?: any[]
  status: string
  scheduledDate?: string
  timeSlot?: string
  total?: number
  totalAmount?: number
  driverName?: string
  driverId?: number
  latitude?: number | null
  longitude?: number | null
}

interface Zone {
  id: number
  name: string
  color: string
  zipCodes: string[]
}

interface PackageDeliveryMapProps {
  orders: PackageOrder[]
  zones?: Zone[]
  theme?: 'light' | 'dark'
  onOrderClick?: (order: PackageOrder) => void
}

export default function PackageDeliveryMap({
  orders,
  zones = [],
  theme = 'light',
  onOrderClick
}: PackageDeliveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map>()
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [selectedOrder, setSelectedOrder] = useState<PackageOrder | null>(null)

  // Helper function to extract zipcode from address
  const extractZipcode = (address: any): string | null => {
    if (!address) return null

    let addressText = ''
    if (typeof address === 'string') {
      addressText = address
    } else if (address?.street) {
      addressText = address.street
    } else {
      return null
    }

    // Intentar múltiples patrones para extraer zipcode:
    // 1. Patrón "STATE zipcode" (ej: "FL 33186" o "FL, 33142")
    // Acepta tanto espacio como coma+espacio entre estado y código postal
    let zipcodeMatch = addressText.match(/\b[A-Z]{2}[,\s]+(\d{5})(?:-\d{4})?\b/)
    if (zipcodeMatch) return zipcodeMatch[1]

    // 2. Patrón "state_name zipcode" (ej: "florida 33186", "miami florida 33186")
    zipcodeMatch = addressText.match(/(?:florida|miami|kentucky|texas|california|new york)[,\s]+(\d{5})(?:-\d{4})?\b/i)
    if (zipcodeMatch) return zipcodeMatch[1]

    // 3. Cualquier secuencia de 5 dígitos al final o en medio de la dirección
    zipcodeMatch = addressText.match(/\b(\d{5})(?:-\d{4})?\b/)
    if (zipcodeMatch) return zipcodeMatch[1]

    return null
  }

  // Helper function to get zone color for an order
  const getZoneColor = (order: PackageOrder): string | null => {
    try {
      if (!zones || zones.length === 0) return null

      const zipcode = extractZipcode(order.customerAddress)
      if (!zipcode) return null

      const zone = zones.find(z => {
        const zipCodes = Array.isArray(z.zipCodes) ? z.zipCodes : []
        return zipCodes.includes(zipcode)
      })

      return zone?.color || null
    } catch (error) {
      console.error('Error en getZoneColor:', error)
      return null
    }
  }

  // Helper function to format address object to string
  const formatAddress = (address: any) => {
    if (!address) return 'Sin dirección'

    // If it's already a string, clean it and return as is
    if (typeof address === 'string') {
      // Limpiar dirección string: remover "us" al final y espacios extras
      return address.replace(/,\s*us$/i, '').trim()
    }

    // If it's an object, format it
    if (typeof address === 'object' && address !== null) {
      const parts = []
      if (address.street) parts.push(address.street)
      if (address.apartment) parts.push(`Apt: ${address.apartment}`)
      if (address.city) parts.push(address.city)
      if (address.state) parts.push(address.state)
      if (address.zipCode) parts.push(address.zipCode)
      // No incluir country si es "us" para evitar confusiones

      const formattedAddress = parts.length > 0 ? parts.join(', ') : 'Sin dirección'
      return formattedAddress.replace(/,\s*us$/i, '').trim()
    }

    return 'Sin dirección'
  }

  // Helper function to format time slot
  const formatTimeSlot = (timeSlot?: string) => {
    if (!timeSlot) return 'Sin horario'

    const timeSlots: Record<string, string> = {
      morning: '9:00 AM - 12:00 PM',
      afternoon: '1:00 PM - 5:00 PM',
      evening: '5:00 PM - 8:00 PM',
      '9-12': '9:00 AM - 12:00 PM',
      '12-3': '12:00 PM - 3:00 PM',
      '3-6': '3:00 PM - 6:00 PM',
      '6-9': '6:00 PM - 9:00 PM'
    }

    return timeSlots[timeSlot] || timeSlot
  }

  // Siempre usar el estilo de mapa claro por defecto
  const mapStyle = 'mapbox://styles/mapbox/streets-v12'

  // Inicializar el mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    console.log('🗺️ Inicializando mapa Mapbox GL JS')

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [-80.2, 26.0], // Center of South Florida (between Miami and Fort Lauderdale)
      zoom: 9, // Slightly lower zoom to cover broader area
      pitch: 0,
      bearing: 0
    })

    console.log('✅ Mapa inicializado')

    // Agregar controles
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapRef.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')
    mapRef.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left')

    console.log('✅ Controles del mapa agregados')

    // Esperar a que el mapa esté completamente cargado
    mapRef.current.on('load', () => {
      console.log('🎯 Mapa completamente cargado y listo para añadir marcadores')

      // Agregar event listener para cerrar info panel al hacer click en el mapa
      mapRef.current!.on('click', () => {
        document.querySelectorAll('.marker-container.selected').forEach(marker => {
          marker.classList.remove('selected')
        })
        setSelectedOrder(null)
      })
    })

    return () => {
      if (mapRef.current) {
        console.log('🗑️ Limpiando mapa')
        mapRef.current.remove()
        mapRef.current = undefined
      }
    }
  }, [])

  // Función mejorada para geocodificar direcciones usando Mapbox Geocoding API
  const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
    if (!address || typeof address !== 'string' || address.trim() === '') {
      console.warn('⚠️ Invalid address provided for geocoding:', address)
      return null
    }

    try {
      const token = mapboxgl.accessToken

      // Limpiar y formatear la dirección EXACTAMENTE como viene
      let searchAddress = address.trim()

      // Remover "us" al final si existe para evitar confusiones
      searchAddress = searchAddress.replace(/,\s*us$/i, '')

      const encodedAddress = encodeURIComponent(searchAddress)

      console.log(`🔍 Geocodificando dirección EXACTA: "${searchAddress}"`)

      // Intentar primero con la dirección completa y sin restricciones
      let response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?` +
        `access_token=${token}&` +
        `limit=5&` + // Obtener múltiples resultados para poder elegir el mejor
        `types=address,postcode,place&` + // Incluir más tipos de resultados
        `country=US&` + // Restringir a Estados Unidos
        `autocomplete=false` // No usar autocomplete para resultados más precisos
      )

      if (!response.ok) {
        console.warn('Geocoding API request failed:', response.status, 'for address:', address)
        return null
      }

      const data = await response.json()

      if (data.features && data.features.length > 0) {
        // Buscar el resultado más relevante
        let bestFeature = data.features[0]
        let bestScore = 0

        for (const feature of data.features) {
          let score = 0
          const center = feature.center
          const placeName = feature.place_name || ''
          const relevance = feature.relevance || 0

          // Preferir resultados con alta relevancia
          score += relevance * 100

          // Preferir resultados que coincidan con el estado y ciudad
          if (searchAddress.toLowerCase().includes('kentucky') ||
              searchAddress.toLowerCase().includes('ky')) {
            if (placeName.toLowerCase().includes('kentucky') ||
                placeName.toLowerCase().includes('ky')) {
              score += 50
            }
          }

          // Bonus para direcciones exactas (type: address)
          if (feature.place_type && feature.place_type[0] === 'address') {
            score += 30
          }

          // Bonus para resultados que coincidan con el código postal
          const zipMatch = searchAddress.match(/\b(\d{5})\b/)
          if (zipMatch && placeName.includes(zipMatch[1])) {
            score += 20
          }

          if (score > bestScore) {
            bestScore = score
            bestFeature = feature
          }
        }

        const [longitude, latitude] = bestFeature.center
        const placeName = bestFeature.place_name || 'Unknown location'

        console.log(`✅ Geocoded "${address}" to "${placeName}" coordinates: [${longitude}, ${latitude}]`)
        console.log(`📍 Coordenadas finales: Longitud=${longitude}, Latitud=${latitude}`)
        console.log(`🎯 Score del resultado: ${bestScore}`)

        // Validar que las coordenadas sean razonables para Estados Unidos continentales
        if (latitude < 24 || latitude > 49 || longitude < -125 || longitude > -66) {
          console.warn(`⚠️ Coordenadas fuera del rango continental de EE.UU: [${longitude}, ${latitude}]`)
          // Aun así retornar las coordenadas, pero con advertencia
        }

        return [longitude, latitude]
      } else {
        console.warn('⚠️ No geocoding results for address:', address)
        return null
      }
    } catch (error) {
      console.error('❌ Geocoding error for address:', address, error)
      return null
    }
  }

  // Función para crear marcadores personalizados más atractivos
  const createMarkerElement = (order: PackageOrder) => {
    const el = document.createElement('div')
    el.className = 'custom-delivery-marker'

    // Determinar colores y iconos según estado
    const statusConfig = {
      pending: {
        color: '#F59E0B', // amber-500
        icon: '📦',
        label: 'Pendiente'
      },
      scheduled: {
        color: '#3B82F6', // blue-500
        icon: '📅',
        label: 'Programado'
      },
      picked_up: {
        color: '#8B5CF6', // violet-500
        icon: '🚚',
        label: 'En Camino'
      },
      delivered: {
        color: '#10B981', // emerald-500
        icon: '✅',
        label: 'Entregado'
      },
      cancelled: {
        color: '#EF4444', // red-500
        icon: '❌',
        label: 'Cancelado'
      },
      in_progress: {
        color: '#06B6D4', // cyan-500
        icon: '🔄',
        label: 'En Progreso'
      }
    }

    const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending

    // Usar color de zona si está disponible, sino usar color de estado
    const zoneColor = getZoneColor(order)
    const markerColor = zoneColor || config.color

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
          ">${config.icon}</span>
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

        <!-- Estado activo visual -->
        <div class="active-indicator" style="
          position: absolute;
          top: -8px;
          left: -8px;
          right: -8px;
          bottom: -8px;
          border: 3px solid ${config.color};
          border-radius: 50%;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
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

        .marker-container.selected .marker-pin {
          transform: rotate(-45deg) scale(1.25);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }

        .marker-container.selected .active-indicator {
          opacity: 1;
        }
      </style>
    `

    el.addEventListener('click', (e) => {
      e.stopPropagation()

      // Remover selección de otros marcadores
      document.querySelectorAll('.marker-container.selected').forEach(other => {
        other.classList.remove('selected')
      })

      // Marcar este marcador como seleccionado
      el.classList.add('selected')
      setSelectedOrder(order)
      onOrderClick?.(order)
    })

    return el
  }

  // Agregar marcadores para cada orden
  useEffect(() => {
    if (!mapRef.current || !orders.length) return

    console.log(`🗺️ Actualizando mapa con ${orders.length} órdenes`)
    console.log('📋 ANÁLISIS DE ÓRDENES RECIBIDAS:')
    orders.forEach((o, index) => {
      console.log(`  ${index + 1}. ${o.orderNumber}:`)
      console.log(`     Dirección: ${o.customerAddress}`)
      console.log(`     Coordenadas: ${o.latitude && o.longitude ? `[${o.latitude}, ${o.longitude}]` : 'NO GUARDADAS'}`)
      console.log(`     Usará: ${o.latitude && o.longitude ? 'COORDENADAS GUARDADAS' : 'GEOCODIFICACIÓN'}`)
    })

    // Limpiar marcadores existentes
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Agregar marcadores para cada orden
    Promise.all(
      orders.map(async (order) => {
        let coordinates: [number, number] | null = null

        // VALIDAR y usar coordenadas guardadas en la base de datos
        if (order.latitude && order.longitude) {
          // Validar que las coordenadas existentes sean razonables para EE.UU
          const isValidLat = order.latitude >= 24 && order.latitude <= 49
          const isValidLng = order.longitude >= -125 && order.longitude <= -66

          if (isValidLat && isValidLng) {
            coordinates = [order.longitude, order.latitude]
            console.log(`✅ USANDO COORDENADAS VÁLIDAS para orden ${order.orderNumber}: [${order.longitude}, ${order.latitude}]`)
          } else {
            console.warn(`⚠️ Coordenadas existentes inválidas para orden ${order.orderNumber}: [${order.longitude}, ${order.latitude}] - Geocodificando`)
            // Si las coordenadas son inválidas, geocodificar
            const formattedAddress = formatAddress(order.customerAddress)
            coordinates = await geocodeAddress(formattedAddress)
            console.log(`🔄 RECUPERACIÓN - Geocodificando dirección "${formattedAddress}" para orden ${order.orderNumber}:`, coordinates)
          }
        } else {
          // Geocodificar la dirección si no hay coordenadas
          const formattedAddress = formatAddress(order.customerAddress)
          coordinates = await geocodeAddress(formattedAddress)
          console.log(`📍 PRIMERA VEZ - Geocodificando dirección "${formattedAddress}" para orden ${order.orderNumber}:`, coordinates)
        }

        if (!coordinates) return null

        console.log(`🗺️ Creando marcador para orden ${order.orderNumber} en coordenadas:`, coordinates)

        const marker = new mapboxgl.Marker({
          element: createMarkerElement(order),
          anchor: 'bottom'
        })
          .setLngLat(coordinates)
          .addTo(mapRef.current!)

        console.log(`✅ Marcador creado y añadido para orden ${order.orderNumber}`)
        console.log(`📍 Posición final del marcador:`, marker.getLngLat())

        markersRef.current.push(marker)
        return { order, coordinates }
      })
    ).then((results) => {
      // Filtrar resultados nulos y ajustar vista para mostrar todos los marcadores
      const validResults = results.filter(r => r !== null)
      if (validResults.length > 0 && mapRef.current) {
        const bounds = new mapboxgl.LngLatBounds()
        validResults.forEach(result => {
          if (result?.coordinates) {
            bounds.extend(result.coordinates)
          }
        })
        console.log(`🎯 Ajustando vista para mostrar ${validResults.length} marcadores`)

        // Si solo hay una orden, centrar el mapa con más zoom
        if (validResults.length === 1) {
          const orderCoords = validResults[0].coordinates
          if (orderCoords) {
            console.log(`📍 Centrando mapa en una sola orden:`, orderCoords)
            // Esperar a que el mapa esté completamente cargado y listo
            setTimeout(() => {
              if (mapRef.current && !mapRef.current.isMoving()) {
                mapRef.current.flyTo({
                  center: orderCoords,
                  zoom: 15,
                  bearing: 0,
                  pitch: 0,
                  speed: 1.2,
                  curve: 1.2,
                  easing: (t) => t,
                  essential: true
                })
                console.log(`✅ Mapa centrado en:`, orderCoords)
              }
            }, 1000) // Aumentado el tiempo para asegurar carga completa
          }
        } else {
          // Si hay múltiples órdenes, usar fitBounds como antes
          mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 12 })
        }
      }
    })

    return () => {
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
    }
  }, [orders, onOrderClick])

  // Calcular color de zona para el panel seleccionado
  const selectedZoneColor = selectedOrder ? (getZoneColor(selectedOrder) || '#3B82F6') : '#3B82F6'

  return (
    <div className="relative w-full h-full">
      {/* Contenedor del mapa */}
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '70vh', height: '70vh' }}
      />

      {/* Panel de información de orden seleccionada - Superior izquierdo */}
      {selectedOrder && (
        <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden max-w-sm w-80" style={{ zIndex: 10000 }}>
          {/* Header con color dinámico de zona */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{
              background: `linear-gradient(135deg, ${selectedZoneColor} 0%, ${selectedZoneColor}dd 100%)`
            }}
          >
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-white" />
              <div>
                <h3 className="text-sm font-bold text-white">{selectedOrder.orderNumber}</h3>
                <p className="text-xs text-white opacity-90">Información de la orden</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedOrder(null)
                document.querySelectorAll('.marker-container.selected').forEach(marker => {
                  marker.classList.remove('selected')
                })
              }}
              className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Contenido */}
          <div className="p-4 space-y-3">
            {/* Cliente */}
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Cliente</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedOrder.customerName}</p>
              </div>
            </div>

            {/* Dirección */}
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Dirección</p>
                <p className="text-sm text-gray-900 dark:text-white leading-relaxed">{formatAddress(selectedOrder.customerAddress)}</p>
              </div>
            </div>

            {/* Fecha y Hora */}
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Fecha programada</p>
                <p className="text-sm text-gray-900 dark:text-white">{selectedOrder.scheduledDate || 'Sin fecha'}</p>
                {selectedOrder.timeSlot && (
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{formatTimeSlot(selectedOrder.timeSlot)}</p>
                )}
              </div>
            </div>

            {/* Servicios */}
            <div className="flex items-start gap-3">
              <Package className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Servicios</p>
                <div className="space-y-1">
                  {selectedOrder.services.map((service, index) => {
                    // Manejar tanto strings como objetos de servicio
                    const serviceName = typeof service === 'string'
                      ? service
                      : (service as { name?: string; type?: string })?.name || (service as { name?: string; type?: string })?.type || 'Servicio'
                    return (
                      <div key={index} className="text-sm text-gray-900 dark:text-white">
                        {serviceName}
                      </div>
                    )
                  })}
                  {(() => {
                    // Parsear boxes si es string JSON
                    let boxes = selectedOrder.boxes
                    if (typeof boxes === 'string') {
                      try {
                        boxes = JSON.parse(boxes)
                      } catch (e) {
                        boxes = []
                      }
                    }

                    return boxes && Array.isArray(boxes) && boxes.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {boxes.map((box: any, index: number) => (
                          <div key={index} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span className="font-medium">{box.quantity || 1}x</span>
                            <span className="capitalize">{box.size || box.name || 'Caja'}</span>
                            {box.type && box.type !== 'empty' && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded capitalize">
                                {box.type === 'full' ? 'Llena' : box.type}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            {/* Zona */}
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Zona</p>
                {(() => {
                  const zipcode = extractZipcode(selectedOrder.customerAddress)
                  const zone = zones.find(z => {
                    const zipCodes = Array.isArray(z.zipCodes) ? z.zipCodes : []
                    return zipCodes.includes(zipcode || '')
                  })
                  return zone ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: zone.color }}
                      />
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{zone.name}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Sin zona asignada</p>
                  )
                })()}
              </div>
            </div>

            {/* Estado */}
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Estado</p>
                {(() => {
                  const statusLabels: Record<string, string> = {
                    pending: 'Pendiente',
                    scheduled: 'Programado',
                    picked_up: 'Recogido',
                    in_transit: 'En Tránsito',
                    delivered: 'Entregado',
                    cancelled: 'Cancelado',
                    reprogrammed: 'Reprogramada'
                  }
                  const statusColors: Record<string, string> = {
                    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
                    scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                    picked_up: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800',
                    in_transit: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
                    delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
                    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
                    reprogrammed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800'
                  }
                  return (
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[selectedOrder.status] || statusColors.pending}`}>
                      {statusLabels[selectedOrder.status] || selectedOrder.status}
                    </span>
                  )
                })()}
              </div>
            </div>

            {/* Driver si está asignado */}
            {selectedOrder.driverName && (
              <div className="flex items-start gap-3">
                <Truck className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Conductor</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedOrder.driverName}</p>
                </div>
              </div>
            )}

            {/* Total y botón */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  ${Number(selectedOrder.totalAmount || selectedOrder.total || 0).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => window.location.href = `/dashboard/admin/package-orders/${selectedOrder.id}`}
                className="text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-md hover:shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${selectedZoneColor} 0%, ${selectedZoneColor}dd 100%)`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${selectedZoneColor}dd 0%, ${selectedZoneColor}bb 100%)`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${selectedZoneColor} 0%, ${selectedZoneColor}dd 100%)`
                }}
              >
                Ver Detalles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contador de órdenes */}
      <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}
          </span>
        </div>
      </div>
    </div>
  )
}