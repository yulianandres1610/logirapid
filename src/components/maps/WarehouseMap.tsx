'use client'

import React, { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { Building, MapPin, Navigation, Store, Package, CheckCircle, AlertCircle } from 'lucide-react'

// Importar CSS de Mapbox
import 'mapbox-gl/dist/mapbox-gl.css'

// Configurar token de Mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

interface Warehouse {
  id: number
  name: string
  code: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  managerName?: string
  managerEmail?: string
  managerPhone?: string
  totalArea?: number
  usedArea?: number
  status: 'active' | 'inactive' | 'maintenance'
  types: string[]  // Multiple types support
  openingDate?: string
  operatingHours?: string
  capacity?: number
  currentStock?: number
  notes?: string
  createdAt: string
  updatedAt: string
  latitude?: number | null
  longitude?: number | null
}

interface WarehouseMapProps {
  warehouses: Warehouse[]
  theme?: 'light' | 'dark'
  onWarehouseClick?: (warehouse: Warehouse) => void
}

export default function WarehouseMap({
  warehouses,
  theme = 'light',
  onWarehouseClick
}: WarehouseMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map>()
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)

  // Helper function to format address
  const formatAddress = (warehouse: Warehouse) => {
    const parts = []
    if (warehouse.address) parts.push(warehouse.address)
    if (warehouse.city) parts.push(warehouse.city)
    if (warehouse.state) parts.push(warehouse.state)
    if (warehouse.zipCode) parts.push(warehouse.zipCode)
    return parts.length > 0 ? parts.join(', ') : 'Sin dirección'
  }

  // Helper function to format warehouse type
  const formatWarehouseType = (type: string) => {
    const types = {
      distribution: 'Centro de Distribución',
      storage: 'Almacén',
      cross_docking: 'Cross-Docking',
      fulfillment: 'Fulfillment'
    }
    return types[type as keyof typeof types] || type
  }

  // Siempre usar el estilo de mapa claro por defecto
  const mapStyle = 'mapbox://styles/mapbox/streets-v12'

  // Inicializar el mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    console.log('🗺️ Inicializando mapa de almacenes Mapbox GL JS')

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [-80.2, 26.0], // Center of South Florida
      zoom: 9,
      pitch: 0,
      bearing: 0
    })

    console.log('✅ Mapa de almacenes inicializado')

    // Agregar controles
    mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapRef.current.addControl(new mapboxgl.FullscreenControl(), 'top-right')
    mapRef.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left')

    console.log('✅ Controles del mapa agregados')

    // Esperar a que el mapa esté completamente cargado
    mapRef.current.on('load', () => {
      console.log('🎯 Mapa de almacenes completamente cargado y listo')

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

  // Función para geocodificar direcciones usando Mapbox Geocoding API
  const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
    if (!address || typeof address !== 'string' || address.trim() === '') {
      console.warn('⚠️ Invalid address provided for geocoding:', address)
      return null
    }

    try {
      const token = mapboxgl.accessToken

      // Limpiar y formatear la dirección
      let searchAddress = address.trim()
      searchAddress = searchAddress.replace(/,\s*us$/i, '')

      const encodedAddress = encodeURIComponent(searchAddress)

      console.log(`🔍 Geocodificando dirección de almacén: "${searchAddress}"`)

      let response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?` +
        `access_token=${token}&` +
        `limit=5&` +
        `types=address,postcode,place&` +
        `country=US&` +
        `autocomplete=false`
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

          score += relevance * 100

          // Preferir resultados con alta relevancia en Florida
          if (searchAddress.toLowerCase().includes('florida') ||
              searchAddress.toLowerCase().includes('fl')) {
            if (placeName.toLowerCase().includes('florida') ||
                placeName.toLowerCase().includes('fl')) {
              score += 50
            }
          }

          // Bonus para direcciones exactas
          if (feature.place_type && feature.place_type[0] === 'address') {
            score += 30
          }

          if (score > bestScore) {
            bestScore = score
            bestFeature = feature
          }
        }

        const [longitude, latitude] = bestFeature.center
        const placeName = bestFeature.place_name || 'Unknown location'

        console.log(`✅ Geocoded warehouse address "${address}" to "${placeName}" coordinates: [${longitude}, ${latitude}]`)

        // Validar que las coordenadas sean razonables para Estados Unidos continentales
        if (latitude < 24 || latitude > 49 || longitude < -125 || longitude > -66) {
          console.warn(`⚠️ Coordenadas fuera del rango continental de EE.UU: [${longitude}, ${latitude}]`)
        }

        return [longitude, latitude]
      } else {
        console.warn('⚠️ No geocoding results for warehouse address:', address)
        return null
      }
    } catch (error) {
      console.error('❌ Geocoding error for warehouse address:', address, error)
      return null
    }
  }

  // Función para crear marcadores personalizados para almacenes
  const createMarkerElement = (warehouse: Warehouse) => {
    const el = document.createElement('div')
    el.className = 'custom-warehouse-marker'

    // Determinar colores y iconos según estado y tipo
    const statusConfig = {
      active: {
        color: '#10B981', // emerald-500
        icon: '🏢',
        label: 'Activo'
      },
      inactive: {
        color: '#6B7280', // gray-500
        icon: '🏢',
        label: 'Inactivo'
      },
      maintenance: {
        color: '#F59E0B', // amber-500
        icon: '🔧',
        label: 'Mantenimiento'
      }
    }

    const typeConfig = {
      distribution: { symbol: '📦', label: 'Distribución' },
      storage: { symbol: '📊', label: 'Almacenaje' },
      cross_docking: { symbol: '🔄', label: 'Cross-Docking' },
      fulfillment: { symbol: '📦', label: 'Fulfillment' }
    }

    const config = statusConfig[warehouse.status as keyof typeof statusConfig] || statusConfig.active

    // Handle multiple types
    const primaryType = warehouse.types[0] || 'storage'
    const typeConfigSelected = typeConfig[primaryType as keyof typeof typeConfig] || typeConfig.storage
    const additionalTypes = warehouse.types.slice(1)

    el.innerHTML = `
      <div class="marker-container" style="
        position: relative;
        cursor: pointer;
        transition: all 0.3s ease;
        filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
      ">
        <!-- Pin principal con animación -->
        <div class="marker-pin" style="
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%);
          border-radius: 50% 50% 50% 15%;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
          position: relative;
          animation: markerBounce 2s infinite ease-in-out;
        ">
          <span style="
            transform: rotate(45deg);
            font-size: 20px;
            filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
          ">${config.icon}</span>
        </div>

        <!-- Círculo exterior pulsante -->
        <div class="pulse-ring" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 66px;
          height: 66px;
          border: 2px solid ${config.color};
          border-radius: 50%;
          opacity: 0;
          animation: pulseAnimation 2s infinite;
        "></div>

        <!-- Tooltip mejorado para almacén -->
        <div class="marker-tooltip" style="
          position: absolute;
          top: 24px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #1F2937 0%, #374151 100%);
          color: white;
          padding: 14px 18px;
          border-radius: 12px;
          font-size: 12px;
          white-space: nowrap;
          opacity: 0;
          visibility: hidden;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          z-index: 10000;
          min-width: 260px;
          max-width: 300px;
          border: 2px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
        ">
          <!-- Header del tooltip -->
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15);
          ">
            <span style="font-size: 20px; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));">${config.icon}</span>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">${warehouse.name}</div>
              <div style="font-size: 10px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">${warehouse.code} • ${config.label}</div>
            </div>
          </div>

          <!-- Contenido del tooltip -->
          <div style="space-y: 8px;">
            <div style="display: flex; align-items: start; gap: 8px; margin-bottom: 8px;">
              <span style="opacity: 0.8; font-size: 14px; margin-top: 1px;">${typeConfigSelected.symbol}</span>
              <div>
                <div style="font-weight: 600; font-size: 11px;">${typeConfigSelected.label}</div>
                ${additionalTypes.length > 0 ? `
                  <div style="font-size: 9px; opacity: 0.8; margin-top: 2px;">
                    +${additionalTypes.length} más
                  </div>
                ` : ''}
              </div>
            </div>
            ${additionalTypes.length > 0 ? `
              <div style="font-size: 9px; opacity: 0.7; padding: 4px 6px; background: rgba(255,255,255,0.1); border-radius: 4px;">
                ${additionalTypes.map(type => {
                  const typeInfo = typeConfig[type as keyof typeof typeConfig]
                  return typeInfo ? `${typeInfo.symbol} ${typeInfo.label}` : type
                }).join(' • ')}
              </div>
            ` : ''}
            <div style="display: flex; align-items: start; gap: 8px; margin-bottom: 8px;">
              <span style="opacity: 0.8; font-size: 14px; margin-top: 1px;">📍</span>
              <div>
                <div style="font-size: 10px; opacity: 0.9; line-height: 1.3;">${formatAddress(warehouse)}</div>
              </div>
            </div>
            ${warehouse.managerName ? `
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="opacity: 0.8; font-size: 14px;">👤</span>
                <div>
                  <div style="font-size: 10px; font-weight: 600;">${warehouse.managerName}</div>
                  <div style="font-size: 9px; opacity: 0.8; margin-top: 1px;">${warehouse.managerEmail || 'Sin email'}</div>
                </div>
              </div>
            ` : ''}
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span style="opacity: 0.8; font-size: 14px;">📊</span>
              <div>
                <div style="font-size: 10px;">
                  Capacidad: ${warehouse.currentStock || 0} / ${warehouse.capacity || 0}
                  ${warehouse.capacity ? `(${Math.round((warehouse.currentStock || 0) / warehouse.capacity * 100)}%)` : ''}
                </div>
                <div style="width: 100px; background: rgba(255,255,255,0.2); border-radius: 3px; height: 4px; margin-top: 2px;">
                  <div style="
                    background: ${warehouse.capacity && (warehouse.currentStock || 0) / warehouse.capacity > 0.8 ? '#EF4444' : '#10B981'};
                    height: 4px; border-radius: 3px;
                    width: ${warehouse.capacity ? Math.min(100, (warehouse.currentStock || 0) / warehouse.capacity * 100) : 0}%;
                  "></div>
                </div>
              </div>
            </div>
            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 9px; opacity: 0.7;">Área Total</span>
                <span style="font-weight: 700; font-size: 14px; color: #3B82F6;">
                  ${warehouse.totalArea ? `${warehouse.totalArea.toLocaleString()} m²` : 'N/A'}
                </span>
              </div>
              <button
                onclick="window.location.href='/dashboard/admin/warehouses/${warehouse.id}'"
                style="
                  background: linear-gradient(135deg, #10B981 0%, #059669 100%);
                  color: white;
                  border: none;
                  padding: 8px 12px;
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
      setSelectedWarehouse(warehouse)
      onWarehouseClick?.(warehouse)

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

  // Agregar marcadores para cada almacén
  useEffect(() => {
    if (!mapRef.current || !warehouses.length) return

    console.log(`🗺️ Actualizando mapa con ${warehouses.length} almacenes`)
    console.log('📋 ANÁLISIS DE ALMACENES RECIBIDOS:')
    warehouses.forEach((w, index) => {
      console.log(`  ${index + 1}. ${w.name} (${w.code}):`)
      console.log(`     Dirección: ${formatAddress(w)}`)
      console.log(`     Coordenadas: ${w.latitude && w.longitude ? `[${w.latitude}, ${w.longitude}]` : 'NO GUARDADAS'}`)
      console.log(`     Usará: ${w.latitude && w.longitude ? 'COORDENADAS GUARDADAS' : 'GEOCODIFICACIÓN'}`)
    })

    // Limpiar marcadores existentes
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Agregar marcadores para cada almacén
    Promise.all(
      warehouses.map(async (warehouse) => {
        let coordinates: [number, number] | null = null

        // VALIDAR y usar coordenadas guardadas en la base de datos
        if (warehouse.latitude && warehouse.longitude) {
          // Validar que las coordenadas existentes sean razonables para EE.UU
          const isValidLat = warehouse.latitude >= 24 && warehouse.latitude <= 49
          const isValidLng = warehouse.longitude >= -125 && warehouse.longitude <= -66

          if (isValidLat && isValidLng) {
            coordinates = [warehouse.longitude, warehouse.latitude]
            console.log(`✅ USANDO COORDENADAS VÁLIDAS para almacén ${warehouse.name}: [${warehouse.longitude}, ${warehouse.latitude}]`)
          } else {
            console.warn(`⚠️ Coordenadas existentes inválidas para almacén ${warehouse.name}: [${warehouse.longitude}, ${warehouse.latitude}] - Geocodificando`)
            // Si las coordenadas son inválidas, geocodificar
            const formattedAddress = formatAddress(warehouse)
            coordinates = await geocodeAddress(formattedAddress)
            console.log(`🔄 RECUPERACIÓN - Geocodificando dirección "${formattedAddress}" para almacén ${warehouse.name}:`, coordinates)
          }
        } else {
          // Geocodificar la dirección si no hay coordenadas
          const formattedAddress = formatAddress(warehouse)
          coordinates = await geocodeAddress(formattedAddress)
          console.log(`📍 PRIMERA VEZ - Geocodificando dirección "${formattedAddress}" para almacén ${warehouse.name}:`, coordinates)
        }

        if (!coordinates) return null

        console.log(`🗺️ Creando marcador para almacén ${warehouse.name} en coordenadas:`, coordinates)

        const marker = new mapboxgl.Marker({
          element: createMarkerElement(warehouse),
          anchor: 'bottom'
        })
          .setLngLat(coordinates)
          .addTo(mapRef.current!)

        console.log(`✅ Marcador creado y añadido para almacén ${warehouse.name}`)
        console.log(`📍 Posición final del marcador:`, marker.getLngLat())

        markersRef.current.push(marker)
        return { warehouse, coordinates }
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
        console.log(`🎯 Ajustando vista para mostrar ${validResults.length} almacenes`)

        // Si solo hay una almacén, centrar el mapa con más zoom
        if (validResults.length === 1) {
          const warehouseCoords = validResults[0].coordinates
          if (warehouseCoords) {
            console.log(`📍 Centrando mapa en una sola almacén:`, warehouseCoords)
            setTimeout(() => {
              if (mapRef.current && !mapRef.current.isMoving()) {
                mapRef.current.flyTo({
                  center: warehouseCoords,
                  zoom: 14,
                  bearing: 0,
                  pitch: 0,
                  speed: 1.2,
                  curve: 1.2,
                  easing: (t) => t,
                  essential: true
                })
                console.log(`✅ Mapa centrado en:`, warehouseCoords)
              }
            }, 1000)
          }
        } else {
          // Si hay múltiples almacenes, usar fitBounds
          mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 12 })
        }
      }
    })

    return () => {
      markersRef.current.forEach(marker => marker.remove())
      markersRef.current = []
    }
  }, [warehouses, onWarehouseClick])

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
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Estado de Almacenes - South Florida</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Activo</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Inactivo</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Mantenimiento</span>
          </div>
        </div>
      </div>

      {/* Contador de almacenes */}
      <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {warehouses.length} {warehouses.length === 1 ? 'almacén' : 'almacenes'}
          </span>
        </div>
      </div>
    </div>
  )
}