'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MapPin, Loader2, Check, X } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface AddressData {
  street: string
  apartment: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface MapboxAddressAutofillProps {
  value: AddressData
  onChange: (data: AddressData) => void
  onCoordinatesChange?: (coordinates: { latitude: number; longitude: number } | null) => void
  required?: boolean
  className?: string
}

export default function MapboxAddressAutofill({
  value,
  onChange,
  onCoordinatesChange,
  required = false,
  className = ""
}: MapboxAddressAutofillProps) {
  const { theme } = useTheme()
  const [accessToken, setAccessToken] = useState<string>('')
  const [selectedFeature, setSelectedFeature] = useState<any>(null)
  const [showMinimap, setShowMinimap] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [mapboxLoaded, setMapboxLoaded] = useState(false)
  const [lastValidAddress, setLastValidAddress] = useState<AddressData>({
    ...value,
    apartment: value.apartment || ''
  })

  const formRef = useRef<HTMLFormElement>(null)
  const streetInputRef = useRef<HTMLInputElement>(null)
  const minimapContainerRef = useRef<HTMLDivElement>(null)
  const autofillRef = useRef<any>(null)
  const minimapRef = useRef<any>(null)

  // Load Mapbox script and get token
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'
    setAccessToken(token)

    // Load Mapbox Search JS SDK
    if (typeof window !== 'undefined' && !window.mapboxsearch) {
      const script = document.createElement('script')
      script.id = 'search-js'
      script.src = 'https://api.mapbox.com/search-js/v1.5.0/web.js'
      script.async = true
      script.onload = () => {
        setMapboxLoaded(true)
        if (window.mapboxsearch) {
          window.mapboxsearch.config.accessToken = token
        }
      }
      document.head.appendChild(script)
    } else if (window.mapboxsearch) {
      setMapboxLoaded(true)
      window.mapboxsearch.config.accessToken = token
    }
  }, [])

  // Initialize autofill and minimap when Mapbox is loaded
  useEffect(() => {
    if (!mapboxLoaded || !window.mapboxsearch || !streetInputRef.current || !formRef.current) return

    // Initialize autofill
    if (!autofillRef.current) {
      autofillRef.current = window.mapboxsearch.autofill({
        input: streetInputRef.current,
        options: {
          language: 'es',
          country: 'US,CU'
        }
      })

      // Add retrieve event listener
      autofillRef.current.addEventListener('retrieve', (e: any) => {
        console.log('🔥 MAPBOX RETRIEVE RESULT:', e.detail)
        setIsLoading(true)

        if (e.detail && e.detail.features && e.detail.features.length > 0) {
          const feature = e.detail.features[0]
          console.log('🔥 SELECTED FEATURE:', JSON.stringify(feature, null, 2))
          setSelectedFeature(feature)
          setShowMinimap(true)

          // Extract address components from the feature
          const address = feature.properties || {}
          const context = address.context || {}

          console.log('🔥 RAW ADDRESS:', JSON.stringify(address, null, 2))
          console.log('🔥 RAW CONTEXT:', JSON.stringify(context, null, 2))

          // Try multiple sources for street name - prioritize complete street address
          let street = ''

          // First try: full_address should contain complete address
          if (address.full_address && address.full_address.trim() !== '') {
            street = address.full_address.trim()
            console.log('🔥 USING full_address:', street)
          }
          // Second try: construct from components
          else {
            const streetNumber = address.address_number || address.house_number || ''
            const streetName = context.street?.name || address.street || address.road || ''

            console.log('🔥 STREET NUMBER:', streetNumber)
            console.log('🔥 STREET NAME:', streetName)

            if (streetNumber && streetName) {
              street = `${streetNumber} ${streetName}`.trim()
              console.log('🔥 COMBINED STREET:', street)
            } else if (streetName) {
              street = streetName
              console.log('🔥 USING STREET NAME ONLY:', street)
            } else if (address.name && address.name.trim() !== '') {
              street = address.name.trim()
              console.log('🔥 USING ADDRESS NAME:', street)
            } else if (address.display_name && address.display_name.trim() !== '') {
              street = address.display_name.trim()
              console.log('🔥 USING DISPLAY NAME:', street)
            } else {
              console.log('🔥 NO STREET FOUND!')
            }
          }

          const city = context.place?.name || context.locality?.name || ''
          const state = context.region?.name || ''
          const zipCode = context.postcode?.name || ''
          const country = context.country?.name || ''

          console.log('🔥 EXTRACTED COMPONENTS:', {
            street,
            city,
            state,
            zipCode,
            country
          })

          const newAddressData = {
            street: street,
            apartment: value.apartment || '', // Preserve existing apartment value
            city: city,
            state: state,
            zipCode: zipCode,
            country: country
          }

          console.log('🔥 MAPBOX ADDRESS DATA:', newAddressData)

          // Always ensure we have a valid street, prioritizing new data then fallback
          const finalAddressData = (newAddressData.street && newAddressData.street.trim() !== '')
            ? newAddressData
            : (lastValidAddress.street && lastValidAddress.street.trim() !== ''
              ? lastValidAddress
              : {
                  street: newAddressData.street || '',
                  apartment: newAddressData.apartment || lastValidAddress.apartment || '',
                  city: newAddressData.city || lastValidAddress.city || '',
                  state: newAddressData.state || lastValidAddress.state || '',
                  zipCode: newAddressData.zipCode || lastValidAddress.zipCode || '',
                  country: newAddressData.country || lastValidAddress.country || ''
                })

          // Update last valid address if we have valid street data
          if (finalAddressData.street && finalAddressData.street.trim() !== '') {
            setLastValidAddress(finalAddressData)
          }

          console.log('🔥 FINAL ADDRESS DATA BEING SENT:', finalAddressData)
          console.log('🔥 SENDING TO PARENT - STREET:', finalAddressData.street)

          // Extract coordinates from the feature
          if (feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates.length >= 2) {
            const longitude = feature.geometry.coordinates[0]
            const latitude = feature.geometry.coordinates[1]
            console.log('🔥 EXTRACTED COORDINATES:', { latitude, longitude })
            onCoordinatesChange?.({ latitude, longitude })
          } else {
            console.log('🔥 NO COORDINATES FOUND IN FEATURE')
            onCoordinatesChange?.(null)
          }

          onChange(finalAddressData)

          // Initialize minimap if not already created
          if (!minimapRef.current && minimapContainerRef.current) {
            minimapRef.current = new window.mapboxsearch.MapboxAddressMinimap()
            minimapRef.current.canAdjustMarker = true
            minimapRef.current.satelliteToggle = true
            minimapRef.current.onSaveMarkerLocation = (lnglat: any) => {
              console.log(`Marker moved to ${lnglat}`)
            }
            minimapContainerRef.current.appendChild(minimapRef.current)
          }

          // Update minimap feature
          if (minimapRef.current) {
            minimapRef.current.feature = feature
          }
        }

        setIsLoading(false)
      })
    }

    return () => {
      if (autofillRef.current) {
        autofillRef.current.removeEventListener('retrieve')
      }
    }
  }, [mapboxLoaded, onChange])

  // Update minimap when showMinimap changes
  useEffect(() => {
    if (minimapRef.current && minimapContainerRef.current) {
      if (showMinimap) {
        minimapContainerRef.current.style.display = 'block'
      } else {
        minimapContainerRef.current.style.display = 'none'
      }
    }
  }, [showMinimap])

  // Initialize component with proper default address value and sync external changes
  useEffect(() => {
    console.log('🔥 MapboxAddressAutofill - value prop changed:', value)

    // Ensure we always have a proper address object
    if (!value || typeof value !== 'object') {
      const defaultAddress = {
        street: '',
        apartment: '',
        city: '',
        state: '',
        zipCode: '',
        country: ''
      }
      console.log('🔥 MapboxAddressAutofill - Estableciendo dirección por defecto:', defaultAddress)
      onChange(defaultAddress)
      return
    }

    // Sync the street input value with the prop value
    if (streetInputRef.current && value.street !== undefined) {
      console.log('🔥 MapboxAddressAutofill - Sincronizando street input:', value.street)
      streetInputRef.current.value = value.street || ''
    }
  }, [value, onChange])

  // Manual field changes
  const handleFieldChange = (field: keyof AddressData, fieldValue: string) => {
    const updatedAddress = { ...value, [field]: fieldValue }
    console.log('🔥 MapboxAddressAutofill - handleFieldChange:', { field, fieldValue, updatedAddress })

    // If updating street field, also update last valid address
    if (field === 'street' && fieldValue.trim() !== '') {
      setLastValidAddress(updatedAddress)
    }

    // Update the input ref value when street field changes
    if (field === 'street' && streetInputRef.current) {
      streetInputRef.current.value = fieldValue
    }

    onChange(updatedAddress)
  }

  // Clear selection
  const handleClear = () => {
    setSelectedFeature(null)
    setShowMinimap(false)
    if (streetInputRef.current) {
      streetInputRef.current.value = ''
    }
    const clearedAddress = {
      street: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    }
    setLastValidAddress(clearedAddress)
    onChange(clearedAddress)
  }

  // Handle confirm address
  const handleConfirmAddress = async () => {
    if (!formRef.current) return

    try {
      const result = await window.mapboxsearch.confirmAddress(formRef.current, {
        minimap: true,
        skipConfirmModal: (feature: any) => {
          return ['exact'].includes(feature.properties.match_code.confidence)
        }
      })

      if (result.type === 'nochange') {
        setShowMinimap(false)
      }
    } catch (error) {
      console.error('Error confirming address:', error)
    }
  }

  if (!mapboxLoaded) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Cargando Mapbox...</span>
        </div>
      </div>
    )
  }

  return (
    <form ref={formRef} className={cn("space-y-4", className)}>
      {/* Mapbox Address Input */}
      <div>
        <label className={cn(
          "block text-sm font-medium mb-2",
          theme === 'dark' ? "text-gray-300" : "text-gray-700"
        )}>
          Buscar Dirección {required && <span className="text-red-500">*</span>}
        </label>

        <div className="relative">
          <input
            ref={streetInputRef}
            type="text"
            value={value.street || ''}
            onChange={(e) => handleFieldChange('street', e.target.value)}
            placeholder="Ej: 1241 Northeast 146th Street, Miami, FL"
            autoComplete="address-line1"
            name="address-line1"
            className={cn(
              "w-full px-4 py-3 text-sm border rounded-lg",
              "focus:ring-2 focus:border-transparent transition-colors duration-200",
              theme === 'dark'
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-red-500"
            )}
          />

          {value.street && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}

          {isLoading && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      </div>

      {/* Apartment/Suite Field */}
      <div>
        <label className={cn(
          "block text-sm font-medium mb-2",
          theme === 'dark' ? "text-gray-300" : "text-gray-700"
        )}>
          Apartamento/Suite (Opcional)
        </label>
        <input
          type="text"
          value={value.apartment}
          onChange={(e) => handleFieldChange('apartment', e.target.value)}
          placeholder="Ej: Apt 4B, Suite 200"
          className={cn(
            "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors duration-200",
            theme === 'dark'
              ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500"
              : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-red-500"
          )}
        />
      </div>

      {/* Minimap Container */}
      <div
        ref={minimapContainerRef}
        className="h-48 w-full relative rounded-lg overflow-hidden border"
        style={{ display: showMinimap ? 'block' : 'none' }}
      />

      {/* Confirm Button when minimap is shown */}
      {showMinimap && selectedFeature && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirmAddress}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg",
              "text-white hover:opacity-90 transition-colors duration-200",
              theme === 'dark' ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
            )}
          >
            <Check className="h-4 w-4" />
            Confirmar Dirección
          </button>

          <button
            type="button"
            onClick={() => setShowMinimap(false)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg",
              "bg-gray-500 text-white hover:bg-gray-600",
              "transition-colors duration-200"
            )}
          >
            <X className="h-4 w-4" />
            Cerrar
          </button>
        </div>
      )}

      {/* Manual Form Fields */}
      <div className="space-y-4">
        {/* Estado y Ciudad */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={cn(
              "block text-sm font-medium mb-2",
              theme === 'dark' ? "text-gray-300" : "text-gray-700"
            )}>
              Estado/Provincia
            </label>
            <input
              name="address-level1"
              type="text"
              value={value.state}
              onChange={(e) => handleFieldChange('state', e.target.value)}
              placeholder="Ingrese el estado"
              autoComplete="address-level1"
              className={cn(
                "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors duration-200",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-red-500"
              )}
            />
          </div>

          <div>
            <label className={cn(
              "block text-sm font-medium mb-2",
              theme === 'dark' ? "text-gray-300" : "text-gray-700"
            )}>
              Ciudad/Municipio
            </label>
            <input
              name="address-level2"
              type="text"
              value={value.city}
              onChange={(e) => handleFieldChange('city', e.target.value)}
              placeholder="Ingrese la ciudad"
              autoComplete="address-level2"
              className={cn(
                "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors duration-200",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-red-500"
              )}
            />
          </div>
        </div>

        {/* Código Postal y País */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={cn(
              "block text-sm font-medium mb-2",
              theme === 'dark' ? "text-gray-300" : "text-gray-700"
            )}>
              Zip Code/Código Postal
            </label>
            <input
              name="postal-code"
              type="text"
              value={value.zipCode}
              onChange={(e) => handleFieldChange('zipCode', e.target.value)}
              placeholder="Ej: 33161"
              autoComplete="postal-code"
              className={cn(
                "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors duration-200",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-red-500"
              )}
            />
          </div>

          <div>
            <label className={cn(
              "block text-sm font-medium mb-2",
              theme === 'dark' ? "text-gray-300" : "text-gray-700"
            )}>
              País
            </label>
            <input
              name="country"
              type="text"
              value={value.country}
              onChange={(e) => handleFieldChange('country', e.target.value)}
              placeholder="Ingrese el país"
              autoComplete="country"
              className={cn(
                "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-colors duration-200",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500"
                  : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-red-500"
              )}
            />
          </div>
        </div>
      </div>

      {/* Status Indicator */}
      {selectedFeature && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg",
          theme === 'dark' ? "bg-blue-900" : "bg-red-100"
        )}>
          <Check className={cn(
            "h-4 w-4",
            theme === 'dark' ? "text-blue-400" : "text-red-600"
          )} />
          <span className={cn(
            "text-sm",
            theme === 'dark' ? "text-blue-200" : "text-red-800"
          )}>
            Dirección seleccionada correctamente
          </span>
        </div>
      )}
    </form>
  )
}

// Add type declaration for window.mapboxsearch
declare global {
  interface Window {
    mapboxsearch: any
  }
}