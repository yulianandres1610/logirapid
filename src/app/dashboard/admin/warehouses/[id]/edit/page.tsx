'use client'

import { useState, useEffect, useLayoutEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  X,
  Building,
  MapPin,
  User,
  Phone,
  Mail,
  Package,
  Store,
  Archive,
  Settings,
  Clock,
  AlertCircle,
  Check,
  Plus,
  Calculator,
  Calendar,
  Navigation,
  Loader2,
  ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import MapboxAddressAutofill from '@/components/ui/MapboxAddressAutofill'

const WAREHOUSE_TYPES = [
  {
    id: 'distribution',
    name: 'Centro de Distribución',
    icon: Store,
    description: 'Para distribución de productos a múltiples destinos',
    color: 'bg-blue-500'
  },
  {
    id: 'storage',
    name: 'Almacén de Almacenaje',
    icon: Archive,
    description: 'Para almacenamiento a largo plazo',
    color: 'bg-purple-500'
  },
  {
    id: 'cross_docking',
    name: 'Cross-Docking',
    icon: Package,
    description: 'Para transferencia rápida sin almacenamiento',
    color: 'bg-orange-500'
  },
  {
    id: 'fulfillment',
    name: 'Centro de Fulfillment',
    icon: Package,
    description: 'Para procesamiento de pedidos de e-commerce',
    color: 'bg-emerald-500'
  }
]

const OPERATING_HOURS = [
  { id: '24/7', label: '24/7', description: 'Operación continua' },
  { id: 'standard', label: 'Estándar (8AM-6PM)', description: 'Horario comercial tradicional' },
  { id: 'extended', label: 'Extendido (6AM-10PM)', description: 'Horario extendido' },
  { id: 'custom', label: 'Personalizado', description: 'Horario personalizado' }
]

const WAREHOUSE_STATUS = [
  {
    id: 'active',
    name: 'Activo',
    icon: '✅',
    description: 'Operación normal',
    color: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-500',
    textColor: 'text-green-700 dark:text-green-300'
  },
  {
    id: 'inactive',
    name: 'Inactivo',
    icon: '⏸️',
    description: 'Temporalmente fuera de servicio',
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-700 dark:text-yellow-300'
  },
  {
    id: 'maintenance',
    name: 'Mantenimiento',
    icon: '🔧',
    description: 'En mantenimiento programado',
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-700 dark:text-blue-300'
  }
]

interface WarehouseData {
  name: string
  code: string
  address: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  types: string[]
  status: 'active' | 'inactive' | 'maintenance'
  managerName: string
  managerEmail: string
  managerPhone: string
  operatingHours: string
  customOperatingHours?: string
  totalArea: number
  cajas_vacias_capacity: number
  bultos_capacity: number
  openingDate: string
  notes: string
  latitude?: number | null
  longitude?: number | null
}

export default function EditWarehousePage() {
  const params = useParams()
  const router = useRouter()
  const warehouseId = params.id as string
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  const [warehouseData, setWarehouseData] = useState<WarehouseData>({
    name: '',
    code: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'Estados Unidos'
    },
    types: [],
    status: 'active',
    managerName: '',
    managerEmail: '',
    managerPhone: '',
    operatingHours: 'standard',
    customOperatingHours: '',
    totalArea: 0,
    cajas_vacias_capacity: 0,
    bultos_capacity: 0,
    openingDate: '',
    notes: '',
    latitude: null,
    longitude: null
  })

  // Scroll to top when component mounts
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Fetch warehouse data
  useEffect(() => {
    const fetchWarehouse = async () => {
      try {
        setLoadingData(true)
        const response = await fetch(`/api/warehouses/${warehouseId}`)

        if (!response.ok) {
          throw new Error('Error al cargar almacén')
        }

        const data = await response.json()

        // Parse type field (comma-separated string) into array
        const types = data.type ? data.type.split(',').map((t: string) => t.trim()) : []

        // Format opening date for input[type="date"]
        const openingDate = data.openingDate ? data.openingDate.split('T')[0] : ''

        setWarehouseData({
          name: data.name || '',
          code: data.code || '',
          address: {
            street: data.address || '',
            city: data.city || '',
            state: data.state || '',
            zipCode: data.zipCode || '',
            country: data.country || 'Estados Unidos'
          },
          types: types,
          status: data.status || 'active',
          managerName: data.managerName || '',
          managerEmail: data.managerEmail || '',
          managerPhone: data.managerPhone || '',
          operatingHours: data.operatingHours || 'standard',
          customOperatingHours: data.customOperatingHours || '',
          totalArea: data.totalArea || 0,
          cajas_vacias_capacity: data.cajas_vacias_capacity || 0,
          bultos_capacity: data.bultos_capacity || 0,
          openingDate: openingDate,
          notes: data.notes || '',
          latitude: data.latitude || null,
          longitude: data.longitude || null
        })

        // Set coordinates if available
        if (data.latitude && data.longitude) {
          setCoordinates({ latitude: data.latitude, longitude: data.longitude })
        }
      } catch (error) {
        console.error('Error fetching warehouse:', error)
        showNotification('error', 'Error', 'No se pudo cargar la información del almacén')
        router.push('/dashboard/admin/warehouses')
      } finally {
        setLoadingData(false)
      }
    }

    if (warehouseId) {
      fetchWarehouse()
    }
  }, [warehouseId])

  // Function to geocode address using Mapbox API
  const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    if (!address || typeof address !== 'string' || address.trim() === '') {
      console.warn('⚠️ Invalid address provided for geocoding:', address)
      return null
    }

    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

      let searchAddress = address.trim()
      searchAddress = searchAddress.replace(/,\s*us$/i, '')
      const encodedAddress = encodeURIComponent(searchAddress)

      console.log(`🔍 Geocodificando dirección de almacén: "${searchAddress}"`)

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?` +
        `access_token=${token}&` +
        `limit=1&` +
        `types=address&` +
        `country=US`
      )

      if (!response.ok) {
        console.warn('Geocoding API request failed:', response.status, 'for address:', address)
        return null
      }

      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const [longitude, latitude] = data.features[0].center
        console.log(`✅ Geocoded "${address}" to coordinates: [${longitude}, ${latitude}]`)
        return { latitude, longitude }
      } else {
        console.warn('⚠️ No geocoding results for address:', address)
        return null
      }
    } catch (error) {
      console.error('❌ Geocoding error for address:', address, error)
      return null
    }
  }

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  // Geocode address when it changes (only on client side)
  useEffect(() => {
    if (!mounted || loadingData) return

    const fullAddress = `${warehouseData.address.street}, ${warehouseData.address.city}, ${warehouseData.address.state} ${warehouseData.address.zipCode}`
    if (warehouseData.address.street && warehouseData.address.city && warehouseData.address.state) {
      geocodeAddress(fullAddress)
        .then(coords => {
          if (coords) {
            setCoordinates(coords)
            setWarehouseData(prev => ({
              ...prev,
              latitude: coords.latitude,
              longitude: coords.longitude
            }))
          } else {
            setCoordinates(null)
            setWarehouseData(prev => ({
              ...prev,
              latitude: null,
              longitude: null
            }))
          }
        })
        .catch(error => {
          console.error('❌ Error en geocodificación:', error)
          setCoordinates(null)
        })
    }
  }, [mounted, loadingData, warehouseData.address.street, warehouseData.address.city, warehouseData.address.state, warehouseData.address.zipCode])

  const updateWarehouseData = (field: string, value: any) => {
    console.log(`Actualizando ${field}:`, value)
    setWarehouseData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const updateAddressData = (field: string, value: string) => {
    console.log(`Actualizando address.${field}:`, value)
    setWarehouseData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value
      }
    }))
  }

  const toggleWarehouseType = (typeId: string) => {
    console.log(`Toggle warehouse type: ${typeId}`)
    setWarehouseData(prev => {
      const newTypes = prev.types.includes(typeId)
        ? prev.types.filter(t => t !== typeId)
        : [...prev.types, typeId]
      console.log('New types:', newTypes)
      return {
        ...prev,
        types: newTypes
      }
    })
  }

  const validateForm = (): boolean => {
    try {
      if (!mounted || loadingData) {
        console.log('Componente no está completamente montado')
        return false
      }

      console.log('Datos actuales del almacén:', warehouseData)

      const hasRequiredFields = warehouseData.name?.trim() &&
                              warehouseData.code?.trim() &&
                              warehouseData.types &&
                              warehouseData.types.length > 0

      console.log('¿Campos requeridos presentes?', hasRequiredFields)

      return Boolean(hasRequiredFields)
    } catch (error) {
      console.error('Error en validación:', error)
      return false
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      console.log('🔍 DEBUG - warehouseData completo:', JSON.stringify(warehouseData, null, 2))

      const street = warehouseData.address?.street?.trim() || ''
      const city = warehouseData.address?.city?.trim() || ''
      const state = warehouseData.address?.state?.trim() || ''
      const zipCode = warehouseData.address?.zipCode?.trim() || ''
      const country = warehouseData.address?.country?.trim() || 'Estados Unidos'

      console.log('🔍 DEBUG - Datos extraídos del address:', { street, city, state, zipCode, country })

      if (!street || !city || !state || !zipCode) {
        showNotification('error', 'Error de Validación', 'Por favor completa todos los campos de la dirección (calle, ciudad, estado, código postal).')
        setLoading(false)
        return
      }

      const requestData = {
        name: warehouseData.name?.trim() || '',
        code: warehouseData.code?.trim() || '',
        address: street,
        city: city,
        state: state,
        zipCode: zipCode,
        country: country,
        type: Array.isArray(warehouseData.types) ? warehouseData.types.join(',') : (warehouseData.types || ''),
        status: warehouseData.status || 'active',
        managerName: warehouseData.managerName?.trim() || '',
        managerEmail: warehouseData.managerEmail?.trim() || '',
        managerPhone: warehouseData.managerPhone?.trim() || '',
        operatingHours: warehouseData.operatingHours || 'standard',
        customOperatingHours: warehouseData.customOperatingHours || null,
        totalArea: Number(warehouseData.totalArea) || 0,
        capacity: 0,
        cajas_vacias_capacity: Number(warehouseData.cajas_vacias_capacity) || 0,
        bultos_capacity: Number(warehouseData.bultos_capacity) || 0,
        openingDate: warehouseData.openingDate || '',
        notes: warehouseData.notes?.trim() || null,
        latitude: warehouseData.latitude || null,
        longitude: warehouseData.longitude || null
      }

      console.log('📤 DEBUG - Enviando al servidor (solo campos necesarios):', JSON.stringify(requestData, null, 2))

      const response = await fetch(`/api/warehouses/${warehouseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      if (response.ok) {
        const data = await response.json()
        showNotification('success', 'Almacén Actualizado', data.message || 'El almacén ha sido actualizado exitosamente')
        router.push(`/dashboard/admin/warehouses/${warehouseId}`)
      } else {
        const errorText = await response.text()
        console.error('❌ Error del servidor:', response.status, errorText)
        try {
          const errorData = JSON.parse(errorText)
          showNotification('error', 'Error', errorData.error || 'No se pudo actualizar el almacén')
        } catch {
          showNotification('error', 'Error', `Error del servidor: ${response.status} - ${errorText}`)
        }
      }
    } catch (error) {
      console.error('Error updating warehouse:', error)
      showNotification('error', 'Error de conexión', 'No se pudo conectar con el servidor. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // Show loading skeleton while loading data
  if (loadingData || !mounted) {
    return (
      <DashboardLayout>
        <div className="min-h-screen p-4 lg:p-6">
          <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-5xl mx-auto px-2 lg:px-4">
            <div className={cn(
              'rounded-xl border shadow-xl p-8',
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              <div className="animate-pulse">
                <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-8"></div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                    <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded"></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center mt-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  Cargando datos del almacén...
                </span>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-4 lg:p-6">
        <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-5xl mx-auto px-2 lg:px-4">
          <div
            className={cn(
              'rounded-xl border shadow-xl',
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            )}
          >
            {/* Header */}
            <div className={cn(
              'p-6 border-b',
              theme === 'dark'
                ? 'border-gray-700'
                : 'border-gray-200'
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <button
                    onClick={() => router.push(`/dashboard/admin/warehouses/${warehouseId}`)}
                    className="mb-2 flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Volver al Almacén
                  </button>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Editar Almacén
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Modifica la información del almacén "{warehouseData.name}"
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/dashboard/admin/warehouses/${warehouseId}`)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark'
                      ? 'hover:bg-gray-700 text-gray-400'
                      : 'hover:bg-gray-100 text-gray-600'
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Basic Information */}
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nombre del Almacén *
                      </label>
                      <input
                        type="text"
                        value={warehouseData.name}
                        onChange={(e) => updateWarehouseData('name', e.target.value)}
                        className={cn(
                          'w-full px-4 py-3 rounded-lg border transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-black'
                        )}
                        placeholder="Ej: Almacén Central Miami"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Código del Almacén *
                      </label>
                      <input
                        type="text"
                        value={warehouseData.code}
                        onChange={(e) => updateWarehouseData('code', e.target.value.toUpperCase())}
                        className={cn(
                          'w-full px-4 py-3 rounded-lg border transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-black'
                        )}
                        placeholder="Ej: MIA-FL-331-001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Estado del Almacén
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {WAREHOUSE_STATUS.map((status) => (
                          <button
                            key={status.id}
                            type="button"
                            onClick={() => updateWarehouseData('status', status.id)}
                            className={cn(
                              'p-4 rounded-lg border-2 transition-all duration-200 text-left relative',
                              'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                              warehouseData.status === status.id
                                ? `${status.borderColor} ${status.bgColor} shadow-lg`
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">{status.icon}</div>
                              <div className="flex-1">
                                <div className={cn(
                                  'font-medium text-sm mb-1',
                                  warehouseData.status === status.id
                                    ? status.textColor
                                    : 'text-gray-900 dark:text-white'
                                )}>
                                  {status.name}
                                </div>
                                <div className={cn(
                                  'text-xs',
                                  warehouseData.status === status.id
                                    ? `${status.textColor} opacity-90`
                                    : 'text-gray-500 dark:text-gray-400'
                                )}>
                                  {status.description}
                                </div>
                              </div>
                            </div>
                            {warehouseData.status === status.id && (
                              <div className={`absolute top-2 right-2 w-5 h-5 ${status.color} rounded-full flex items-center justify-center`}>
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Location */}
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Dirección *
                      </label>
                      <MapboxAddressAutofill
                        value={{
                          street: warehouseData.address.street,
                          apartment: '',
                          city: warehouseData.address.city,
                          state: warehouseData.address.state,
                          zipCode: warehouseData.address.zipCode,
                          country: warehouseData.address.country
                        }}
                        onChange={(addressData) => {
                          console.log('🏠 MapboxAddressAutofill onChange:', addressData)
                          updateAddressData('street', addressData.street)
                          updateAddressData('city', addressData.city)
                          updateAddressData('state', addressData.state)
                          updateAddressData('zipCode', addressData.zipCode)
                          updateAddressData('country', addressData.country)
                        }}
                        onCoordinatesChange={(coords) => {
                          console.log('📍 Coords from Mapbox:', coords)
                          setCoordinates(coords)
                          if (coords) {
                            setWarehouseData(prev => ({
                              ...prev,
                              latitude: coords.latitude,
                              longitude: coords.longitude
                            }))
                          }
                        }}
                        required={true}
                        className="mt-2"
                      />
                    </div>

                    {coordinates && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <Navigation className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-800 dark:text-green-200">
                          Coordenadas: {Number(coordinates.latitude).toFixed(6)}, {Number(coordinates.longitude).toFixed(6)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Warehouse Types Section */}
              <div className="mt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {WAREHOUSE_TYPES.map((type) => {
                    const Icon = type.icon
                    const isSelected = warehouseData.types.includes(type.id)
                    return (
                      <button
                        key={type.id}
                        onClick={() => toggleWarehouseType(type.id)}
                        className={cn(
                          'p-4 rounded-lg border-2 transition-all duration-200 text-left relative',
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2 rounded-lg', type.color)}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                              {type.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {type.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {warehouseData.types.length === 0 && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Debes seleccionar al menos un tipo de almacén
                  </div>
                )}
              </div>

              {/* Manager Information Section */}
              <div className="mt-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nombre del Responsable *
                    </label>
                    <input
                      type="text"
                      value={warehouseData.managerName}
                      onChange={(e) => updateWarehouseData('managerName', e.target.value)}
                      className={cn(
                        'w-full px-4 py-3 rounded-lg border transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-black'
                      )}
                      placeholder="Juan Pérez"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email del Responsable *
                    </label>
                    <input
                      type="email"
                      value={warehouseData.managerEmail}
                      onChange={(e) => updateWarehouseData('managerEmail', e.target.value)}
                      className={cn(
                        'w-full px-4 py-3 rounded-lg border transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-black'
                      )}
                      placeholder="juan.perez@empresa.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Teléfono del Responsable *
                    </label>
                    <input
                      type="tel"
                      value={warehouseData.managerPhone}
                      onChange={(e) => updateWarehouseData('managerPhone', e.target.value)}
                      className={cn(
                        'w-full px-4 py-3 rounded-lg border transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-black'
                      )}
                      placeholder="+1 (305) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Operational Configuration Section */}
              <div className="mt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Horario de Operación *
                    </label>
                    <div className="space-y-2">
                      {OPERATING_HOURS.map((hours) => (
                        <button
                          key={hours.id}
                          onClick={() => updateWarehouseData('operatingHours', hours.id)}
                          className={cn(
                            'w-full p-3 rounded-lg border-2 transition-all duration-200 text-left',
                            warehouseData.operatingHours === hours.id
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          )}
                        >
                          <div className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                            {hours.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {hours.description}
                          </div>
                        </button>
                      ))}
                    </div>

                    {warehouseData.operatingHours === 'custom' && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Horario Personalizado *
                        </label>
                        <input
                          type="text"
                          value={warehouseData.customOperatingHours}
                          onChange={(e) => updateWarehouseData('customOperatingHours', e.target.value)}
                          className={cn(
                            'w-full px-4 py-3 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-black'
                          )}
                          placeholder="Ej: Lunes-Viernes 7AM-9PM, Sábados 8AM-6PM"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Área Total (m²) *
                        </label>
                        <input
                          type="number"
                          value={warehouseData.totalArea}
                          onChange={(e) => updateWarehouseData('totalArea', parseFloat(e.target.value) || 0)}
                          className={cn(
                            'w-full px-4 py-3 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-black'
                          )}
                          placeholder="5000"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Cantidad de Cajas Vacías *
                        </label>
                        <input
                          type="number"
                          value={warehouseData.cajas_vacias_capacity}
                          onChange={(e) => updateWarehouseData('cajas_vacias_capacity', parseFloat(e.target.value) || 0)}
                          className={cn(
                            'w-full px-4 py-3 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-black'
                          )}
                          placeholder="5000"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Cantidad de Bultos *
                        </label>
                        <input
                          type="number"
                          value={warehouseData.bultos_capacity}
                          onChange={(e) => updateWarehouseData('bultos_capacity', parseFloat(e.target.value) || 0)}
                          className={cn(
                            'w-full px-4 py-3 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-blue-500',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-black'
                          )}
                          placeholder="5000"
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha de Apertura *
                      </label>
                      <input
                        type="date"
                        value={warehouseData.openingDate}
                        onChange={(e) => updateWarehouseData('openingDate', e.target.value)}
                        className={cn(
                          'w-full px-4 py-3 rounded-lg border transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500',
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-black'
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notas Adicionales
                  </label>
                  <textarea
                    value={warehouseData.notes}
                    onChange={(e) => updateWarehouseData('notes', e.target.value)}
                    rows={3}
                    className={cn(
                      'w-full px-4 py-3 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-black'
                    )}
                    placeholder="Ingresa cualquier información adicional relevante sobre el almacén..."
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={cn(
              'px-6 py-4 border-t flex items-center justify-end',
              theme === 'dark'
                ? 'border-gray-700'
                : 'border-gray-200'
            )}>
              <button
                onClick={() => router.push(`/dashboard/admin/warehouses/${warehouseId}`)}
                className={cn(
                  'flex items-center gap-2 px-6 py-2 mr-4 rounded-lg font-medium transition-colors',
                  'hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                Cancelar
              </button>

              <button
                onClick={handleSubmit}
                disabled={loading || !validateForm()}
                className={cn(
                  'flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors',
                  (loading || !validateForm()) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
