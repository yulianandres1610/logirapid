'use client'

import React, { useEffect, useRef, useState } from 'react'
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
  services: string[]
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

interface PackageDeliveryMapProps {
  orders: PackageOrder[]
  theme?: 'light' | 'dark'
  onOrderClick?: (order: PackageOrder) => void
}

export default function PackageDeliveryMap({
  orders,
  theme = 'light',
  onOrderClick
}: PackageDeliveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map>()
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [selectedOrder, setSelectedOrder] = useState<PackageOrder | null>(null)

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

      // Agregar event listener para cerrar tooltips estáticos al hacer click en el mapa
      mapRef.current!.on('click', () => {
        document.querySelectorAll('.marker-container.clicked').forEach(marker => {
          marker.classList.remove('clicked')
          marker.classList.remove('active')
        })
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
          background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%);
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
          border: 2px solid ${config.color};
          border-radius: 50%;
          opacity: 0;
          animation: pulseAnimation 2s infinite;
        "></div>

        <!-- Tooltip mejorado responsivo -->
        <div class="marker-tooltip" style="
          position: absolute;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #1F2937 0%, #374151 100%);
          color: white;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 12px;
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          z-index: 10000;
          min-width: 240px;
          max-width: 280px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
        ">
          <!-- Header del tooltip -->
          <div style="
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          ">
            <span style="font-size: 18px; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));">${config.icon}</span>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">${order.orderNumber}</div>
              <div style="font-size: 9px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">${config.label}</div>
            </div>
          </div>

          <!-- Contenido del tooltip -->
          <div style="space-y: 6px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="opacity: 0.8; font-size: 12px;">👤</span>
              <div>
                <div style="font-weight: 600; font-size: 11px;">${order.customerName}</div>
              </div>
            </div>
            <div style="display: flex; align-items: start; gap: 6px; margin-bottom: 6px;">
              <span style="opacity: 0.8; font-size: 12px; margin-top: 1px;">📍</span>
              <div>
                <div style="font-size: 10px; opacity: 0.9; line-height: 1.3;">${formatAddress(order.customerAddress)}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="opacity: 0.8; font-size: 12px;">📅</span>
              <div>
                <div style="font-size: 10px;">${order.scheduledDate || 'Sin fecha'}</div>
                ${order.timeSlot ? `<div style="font-size: 9px; opacity: 0.8; margin-top: 1px;">${formatTimeSlot(order.timeSlot)}</div>` : ''}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="opacity: 0.8; font-size: 12px;">📦</span>
              <div>
                <div style="font-size: 10px;">${order.services.join(', ')}</div>
              </div>
            </div>
            {/* Driver asignado */}
            ${order.driverName ? `
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                <span style="opacity: 0.8; font-size: 12px;">🚚</span>
                <div>
                  <div style="font-size: 10px; font-weight: 600;">${order.driverName}</div>
                </div>
              </div>
            ` : ''}
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 9px; opacity: 0.7;">Total</span>
                <span style="font-weight: 700; font-size: 14px; color: #10B981;">
                  $${(order.totalAmount || order.total || 0).toFixed(2)}
                </span>
              </div>
              <button
                onclick="window.location.href='/dashboard/admin/package-orders/${order.id}'"
                style="
                  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                  color: white;
                  border: none;
                  padding: 6px 10px;
                  border-radius: 6px;
                  font-size: 9px;
                  font-weight: 600;
                  cursor: pointer;
                  transition: all 0.3s ease;
                  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
                  text-transform: uppercase;
                  letter-spacing: 0.3px;
                "
                onmouseover="this.style.transform='translateY(-1px) scale(1.05)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.4)'"
                onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 2px 6px rgba(16, 185, 129, 0.3)'"
              >
                Ver Detalles
              </button>
            </div>
          </div>
        </div>

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

        @keyframes tooltipFadeIn {
          0% {
            opacity: 0;
            visibility: hidden;
            transform: translateX(-50%) translateY(-10px) scale(0.9);
          }
          100% {
            opacity: 1;
            visibility: visible;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        .marker-container:hover .marker-pin {
          transform: rotate(-45deg) scale(1.3);
          background: linear-gradient(135deg, ${config.color} 0%, ${config.color}ff 100%);
        }

        .marker-container:hover .marker-tooltip {
          opacity: 1;
          visibility: visible;
          animation: tooltipFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .marker-container:hover .pulse-ring {
          animation-duration: 1s;
        }

        .marker-container:hover .active-indicator {
          opacity: 0.3;
        }

        .marker-container.active .marker-tooltip {
          opacity: 1;
          visibility: visible;
          animation: tooltipFadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .marker-container.active .marker-pin {
          transform: rotate(-45deg) scale(1.2);
          background: linear-gradient(135deg, ${config.color} 0%, ${config.color}ff 100%);
        }

        .marker-container.active .active-indicator {
          opacity: 0.5;
        }
      </style>
    `

    el.addEventListener('click', (e) => {
      e.stopPropagation()
      setSelectedOrder(order)
      onOrderClick?.(order)

      // Toggle para estado activo (tooltip estático)
      if (el.classList.contains('clicked')) {
        el.classList.remove('clicked')
        el.classList.remove('active')
      } else {
        // Cerrar otros tooltips
        document.querySelectorAll('.marker-container.clicked').forEach(other => {
          other.classList.remove('clicked')
          other.classList.remove('active')
        })
        el.classList.add('clicked')
        el.classList.add('active')
      }
    })

    // Manejar estado activo para tooltip hover
    el.addEventListener('mouseenter', () => {
      if (!el.classList.contains('clicked')) {
        el.classList.add('active')
      }
    })

    el.addEventListener('mouseleave', () => {
      if (!el.classList.contains('clicked')) {
        el.classList.remove('active')
      }
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

  return (
    <div className="relative w-full h-full">
      {/* Contenedor del mapa */}
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-lg overflow-hidden"
        style={{ minHeight: '70vh', height: '70vh' }}
      />

      {/* Leyenda */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 border border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Estado de entregas - South Florida</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Pendiente</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">En progreso</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Completado</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Cancelado</span>
          </div>
        </div>
      </div>

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