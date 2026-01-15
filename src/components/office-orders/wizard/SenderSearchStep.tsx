'use client'

import React, { useState, useEffect } from 'react'
import { Search, User, Phone, Mail, Loader2, MapPin, Plus, Edit2, Key, FileText, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import MapboxAddressAutofill from '@/components/ui/MapboxAddressAutofill'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext: () => void
}

interface AddressData {
  street: string
  apartment: string
  city: string
  state: string
  zipCode: string
  country: string
}

// Lista de códigos de estados de USA
const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]

/**
 * Parsea una dirección en formato texto a componentes estructurados
 * Maneja varios formatos comunes de direcciones de USA
 */
function parseAddressString(address: string): Partial<AddressData> {
  const result: Partial<AddressData> = {}

  if (!address) return result

  // 1. Extraer zipcode usando regex (5 dígitos, opcionalmente seguidos de -4 dígitos)
  const zipMatch = address.match(/\b(\d{5})(-\d{4})?\b/)
  if (zipMatch) {
    result.zipCode = zipMatch[1]
  }

  // 2. Buscar código de estado de USA
  const upperAddress = address.toUpperCase()
  for (const state of US_STATE_CODES) {
    // Buscar el código de estado como palabra completa
    const stateRegex = new RegExp(`\\b${state}\\b`)
    if (stateRegex.test(upperAddress)) {
      result.state = state
      break
    }
  }

  // 3. Buscar país
  const countryPatterns = [
    { pattern: /\bUSA?\b/i, country: 'US' },
    { pattern: /\bUnited States\b/i, country: 'US' },
    { pattern: /\bEstados Unidos\b/i, country: 'US' },
    { pattern: /\bCuba\b/i, country: 'CU' }
  ]
  for (const { pattern, country } of countryPatterns) {
    if (pattern.test(address)) {
      result.country = country
      break
    }
  }
  if (!result.country) {
    result.country = 'US' // Default to US
  }

  // 4. Parsear por comas para extraer street y city
  const parts = address.split(',').map(p => p.trim())

  if (parts.length >= 1) {
    // Primera parte generalmente es la calle
    result.street = parts[0]
  }

  if (parts.length >= 2) {
    // Segunda parte puede ser ciudad o apt
    const secondPart = parts[1]

    // Si parece número de apartamento, lo extraemos
    if (/^(apt|unit|#|suite)/i.test(secondPart)) {
      result.apartment = secondPart
      if (parts.length >= 3) {
        result.city = parts[2].replace(/\b\d{5}(-\d{4})?\b/, '').replace(/\b[A-Z]{2}\b/g, '').trim()
      }
    } else {
      // Probablemente es la ciudad
      result.city = secondPart.replace(/\b\d{5}(-\d{4})?\b/, '').replace(/\b[A-Z]{2}\b/g, '').trim()
    }
  }

  // 5. Si city aún no está, intentar extraerla del tercer elemento
  if (!result.city && parts.length >= 3) {
    // Limpiar el tercer elemento quitando zipcode y estado
    let cityCandidate = parts[2]
      .replace(/\b\d{5}(-\d{4})?\b/g, '') // Quitar zipcode
      .replace(/\b[A-Z]{2}\b/g, '')        // Quitar estado
      .trim()

    if (cityCandidate && !cityCandidate.toLowerCase().includes('us')) {
      result.city = cityCandidate
    }
  }

  // 6. Limpiar city si quedó vacía
  if (!result.city) {
    result.city = ''
  }

  return result
}

export default function SenderSearchStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [searchPhone, setSearchPhone] = useState('')
  const [searching, setSearching] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)

  // Estado para nuevo remitente
  const [newSender, setNewSender] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    idType: '',
    idNumber: '',
    entryPin: '',
    entryInstructions: '',
    hasAlternateContact: false,
    alternateContactName: '',
    alternateContactPhone: '',
    address: {
      street: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    } as AddressData,
    coordinates: null as { latitude: number; longitude: number } | null
  })

  // Estado para modo edición
  const [isEditing, setIsEditing] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null)

  const searchCustomer = async () => {
    if (!searchPhone.trim()) return

    setSearching(true)
    try {
      const response = await fetch(`/api/customers?search=${searchPhone}`)
      const data = await response.json()
      if (data.success) {
        const results = data.data || []
        setCustomers(results)

        // Si no hay resultados, abrir automáticamente el formulario de creación
        if (results.length === 0) {
          setShowCreateForm(true)
          // Pre-llenar el teléfono en el formulario
          setNewSender(prev => ({ ...prev, phone: searchPhone }))
        }
      }
    } catch (error) {
      console.error('Error searching customer:', error)
    } finally {
      setSearching(false)
    }
  }

  const geocodeAddress = async (addressText: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const mapboxToken = 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'
      const encodedAddress = encodeURIComponent(addressText)
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&country=US&limit=1`

      const response = await fetch(url)
      const data = await response.json()

      if (data.features && data.features.length > 0) {
        const [longitude, latitude] = data.features[0].center
        return { latitude, longitude }
      }
      return null
    } catch (error) {
      console.error('Error geocoding address:', error)
      return null
    }
  }

  const loadCustomerAddresses = async (customer: any) => {
    setLoadingAddresses(true)
    try {
      const response = await fetch(`/api/customer-addresses?customerId=${customer.id}`)
      const data = await response.json()
      if (data.success) {
        const addresses = data.data || []
        setCustomerAddresses(addresses)

        // Si solo tiene una dirección, auto-seleccionarla
        if (addresses.length === 1) {
          selectAddress(addresses[0], customer)
        } else if (addresses.length > 1) {
          // Mostrar direcciones inline en el formulario
          // Actualizar wizardData para que la UI cambie al estado "seleccionado"
          updateWizardData('sender', customer)
          setCanProceed(false) // Usuario debe seleccionar una dirección manualmente
        } else {
          // No tiene direcciones guardadas, usar dirección del customer
          let customerWithCoords = { ...customer }

          // Primero: Verificar si el cliente YA tiene campos estructurados de la BD
          const hasStructuredAddress = customer.city || customer.state || customer.zipCode

          if (hasStructuredAddress) {
            // Usar los campos estructurados de la BD
            customerWithCoords.street = customer.street || ''
            customerWithCoords.city = customer.city || ''
            customerWithCoords.state = customer.state || ''
            customerWithCoords.zipCode = customer.zipCode || customer.zipcode || ''
            customerWithCoords.apartment = customer.apartment || ''
            customerWithCoords.country = customer.country || 'US'
            // Mantener el address legacy para display
            customerWithCoords.address = customer.address || `${customerWithCoords.street}, ${customerWithCoords.city}, ${customerWithCoords.state} ${customerWithCoords.zipCode}`
            console.log('📍 [SenderSearchStep] Using structured address from DB:', {
              street: customerWithCoords.street,
              city: customerWithCoords.city,
              state: customerWithCoords.state,
              zipCode: customerWithCoords.zipCode
            })
          } else if (customer.address) {
            // No hay campos estructurados, parsear la dirección legacy
            console.log('📍 [SenderSearchStep] Parsing legacy address:', customer.address)
            const parsed = parseAddressString(customer.address)
            customerWithCoords.street = parsed.street || customer.address
            customerWithCoords.city = parsed.city || ''
            customerWithCoords.state = parsed.state || ''
            customerWithCoords.zipCode = parsed.zipCode || ''
            customerWithCoords.apartment = parsed.apartment || ''
            customerWithCoords.country = parsed.country || 'US'
            console.log('📍 [SenderSearchStep] Parsed address result:', parsed)
          }

          // Geocodificar si no tiene coordenadas
          if (customer.address && !customer.latitude && !customer.longitude) {
            const fullAddress = `${customerWithCoords.street}, ${customerWithCoords.city}, ${customerWithCoords.state} ${customerWithCoords.zipCode}, ${customerWithCoords.country}`
            console.log('📍 [SenderSearchStep] Geocoding full address:', fullAddress)
            const coords = await geocodeAddress(fullAddress)
            if (coords) {
              customerWithCoords.latitude = coords.latitude
              customerWithCoords.longitude = coords.longitude
              console.log('📍 [SenderSearchStep] Geocoding successful:', coords)
            }
          }

          updateWizardData('sender', customerWithCoords)
          setCanProceed(true)
        }
      }
    } catch (error) {
      console.error('Error loading addresses:', error)
      // Fallback: usar datos del customer directamente
      let customerWithCoords = { ...customer }

      // Verificar si el cliente YA tiene campos estructurados de la BD
      const hasStructuredAddress = customer.city || customer.state || customer.zipCode

      if (hasStructuredAddress) {
        customerWithCoords.street = customer.street || ''
        customerWithCoords.city = customer.city || ''
        customerWithCoords.state = customer.state || ''
        customerWithCoords.zipCode = customer.zipCode || customer.zipcode || ''
        customerWithCoords.apartment = customer.apartment || ''
        customerWithCoords.country = customer.country || 'US'
        customerWithCoords.address = customer.address || `${customerWithCoords.street}, ${customerWithCoords.city}, ${customerWithCoords.state} ${customerWithCoords.zipCode}`
      } else if (customer.address) {
        const parsed = parseAddressString(customer.address)
        customerWithCoords.street = parsed.street || customer.address
        customerWithCoords.city = parsed.city || ''
        customerWithCoords.state = parsed.state || ''
        customerWithCoords.zipCode = parsed.zipCode || ''
        customerWithCoords.apartment = parsed.apartment || ''
        customerWithCoords.country = parsed.country || 'US'
      }

      // Geocodificar si no tiene coordenadas
      if (customer.address && !customer.latitude && !customer.longitude) {
        const fullAddress = `${customerWithCoords.street}, ${customerWithCoords.city}, ${customerWithCoords.state} ${customerWithCoords.zipCode}, ${customerWithCoords.country}`
        const coords = await geocodeAddress(fullAddress)
        if (coords) {
          customerWithCoords.latitude = coords.latitude
          customerWithCoords.longitude = coords.longitude
        }
      }

      updateWizardData('sender', customerWithCoords)
      setCanProceed(true)
    } finally {
      setLoadingAddresses(false)
    }
  }

  const selectCustomer = (customer: any) => {
    console.log('📍 [SenderSearchStep] selectCustomer called with:', customer)
    setSelectedCustomer(customer)
    loadCustomerAddresses(customer)
  }

  const selectAddress = async (address: any, customer?: any) => {
    // Usar el customer pasado como parámetro o el selectedCustomer del estado
    const customerToUse = customer || selectedCustomer
    console.log('📍 [SenderSearchStep] selectAddress called with:', { address, customer: customerToUse })

    // Extraer coordenadas del campo notes si están disponibles
    let latitude = null
    let longitude = null
    if (address.notes) {
      // Formato: "Coordenadas: 25.7617, -80.1918"
      const coordMatch = address.notes.match(/Coordenadas:\s*([-\d.]+),\s*([-\d.]+)/)
      if (coordMatch) {
        latitude = parseFloat(coordMatch[1])
        longitude = parseFloat(coordMatch[2])
        console.log('📍 [SenderSearchStep] Coordinates extracted from notes:', { latitude, longitude })
      }
    }

    // Si no hay coordenadas en las notas, geocodificar la dirección
    if (!latitude || !longitude) {
      const fullAddress = `${address.street}${address.apartment ? ', ' + address.apartment : ''}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country || 'US'}`
      console.log('📍 [SenderSearchStep] Geocoding address:', fullAddress)

      const coords = await geocodeAddress(fullAddress)
      if (coords) {
        latitude = coords.latitude
        longitude = coords.longitude
        console.log('📍 [SenderSearchStep] Geocoding successful:', { latitude, longitude })

        // Actualizar la dirección en la base de datos con las coordenadas
        try {
          await fetch(`/api/customer-addresses/${address.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notes: `Coordenadas: ${latitude}, ${longitude}`
            })
          })
          console.log('📍 [SenderSearchStep] Coordinates saved to database')
        } catch (error) {
          console.error('Error updating address with coordinates:', error)
        }
      } else {
        console.warn('📍 [SenderSearchStep] Geocoding failed for address:', fullAddress)
      }
    }

    // Construir la dirección completa para el campo address legacy
    const fullAddressText = `${address.street}${address.apartment ? ', ' + address.apartment : ''}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country || 'US'}`

    const senderData = {
      ...customerToUse,
      street: address.street,
      apartment: address.apartment || '',
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country,
      addressId: address.id,
      address: fullAddressText,
      latitude,
      longitude
    }

    console.log('📍 [SenderSearchStep] Final senderData with coordinates:', {
      name: `${customerToUse?.firstName} ${customerToUse?.lastName}`,
      address: address.street,
      latitude,
      longitude
    })

    setSelectedAddressId(address.id)
    updateWizardData('sender', senderData)
    setCanProceed(true)
  }

  const deleteAddress = async (addressId: number, e: React.MouseEvent) => {
    e.stopPropagation() // Evitar que se seleccione la dirección al eliminar

    if (!confirm('¿Estás seguro de eliminar esta dirección?')) {
      return
    }

    try {
      const response = await fetch(`/api/customer-addresses?id=${addressId}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (data.success) {
        // Actualizar la lista de direcciones
        setCustomerAddresses(prev => prev.filter(addr => addr.id !== addressId))

        // Si la dirección eliminada era la seleccionada, deseleccionar
        if (selectedAddressId === addressId) {
          setSelectedAddressId(null)
          setCanProceed(false)
        }
      } else {
        alert(data.error || 'Error al eliminar dirección')
      }
    } catch (error) {
      console.error('Error deleting address:', error)
      alert('Error al eliminar dirección')
    }
  }

  const createSender = async () => {
    if (!newSender.firstName || !newSender.lastName || !newSender.phone) {
      alert('Nombre, apellido y teléfono son requeridos')
      return
    }

    if (!newSender.address.street || !newSender.address.city) {
      alert('Dirección completa es requerida')
      return
    }

    // Si no tiene coordenadas, intentar geocodificar automáticamente
    if (!newSender.coordinates) {
      const fullAddress = `${newSender.address.street}${newSender.address.apartment ? ', ' + newSender.address.apartment : ''}, ${newSender.address.city}, ${newSender.address.state} ${newSender.address.zipCode}, ${newSender.address.country || 'US'}`
      console.log('📍 Intentando geocodificar dirección automáticamente:', fullAddress)

      const coords = await geocodeAddress(fullAddress)
      if (coords) {
        newSender.coordinates = coords
        console.log('✅ Dirección geocodificada exitosamente:', coords)
      } else {
        console.warn('⚠️ No se pudo geocodificar automáticamente, continuando sin coordenadas')
        // Permitir continuar sin coordenadas - se geocodificarán posteriormente
      }
    }

    // Validar contacto alternativo si está activado
    if (newSender.hasAlternateContact && (!newSender.alternateContactName || !newSender.alternateContactPhone)) {
      alert('Si activas el contacto alternativo, debes proporcionar nombre y teléfono')
      return
    }

    try {
      // Construir dirección completa para el campo address legacy
      const fullAddress = `${newSender.address.street}${newSender.address.apartment ? ', ' + newSender.address.apartment : ''}, ${newSender.address.city}, ${newSender.address.state} ${newSender.address.zipCode}, ${newSender.address.country}`

      // Crear o actualizar el cliente con todos los campos de dirección estructurados
      const customerData = {
        firstName: newSender.firstName,
        lastName: newSender.lastName,
        phone: newSender.phone,
        email: newSender.email,
        idType: newSender.idType || null,
        idNumber: newSender.idNumber || null,
        entryPin: newSender.entryPin || null,
        entryInstructions: newSender.entryInstructions || null,
        hasAlternateContact: newSender.hasAlternateContact,
        alternateContactName: newSender.alternateContactName || null,
        alternateContactPhone: newSender.alternateContactPhone || null,
        // Dirección completa (legacy)
        address: fullAddress,
        // Campos estructurados de dirección
        city: newSender.address.city || null,
        state: newSender.address.state || null,
        zipCode: newSender.address.zipCode || null,
        country: newSender.address.country || 'US',
        apartment: newSender.address.apartment || null
      }

      // Si estamos editando, agregar el ID y usar PUT
      if (isEditing && editingCustomerId) {
        (customerData as any).id = editingCustomerId
      }

      const response = await fetch('/api/customers', {
        method: isEditing && editingCustomerId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
      })

      const data = await response.json()
      if (data.success) {
        const createdCustomer = data.data

        // Guardar dirección en customer_addresses
        try {
          const addressResponse = await fetch('/api/customer-addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: createdCustomer.id,
              street: newSender.address.street,
              apartment: newSender.address.apartment || '',
              city: newSender.address.city,
              state: newSender.address.state,
              zipCode: newSender.address.zipCode,
              country: newSender.address.country,
              addressType: 'usa',
              entryPin: newSender.entryPin || null,
              entryInstructions: newSender.entryInstructions || null,
              latitude: newSender.coordinates?.latitude || null,
              longitude: newSender.coordinates?.longitude || null,
              isPrimary: true,
              notes: newSender.coordinates
                ? `Coordenadas: ${newSender.coordinates.latitude}, ${newSender.coordinates.longitude}`
                : ''
            })
          })

          const addressData = await addressResponse.json()
          if (addressData.success) {
            console.log('Dirección guardada en customer_addresses:', addressData.data)
          }
        } catch (addressError) {
          console.error('Error guardando dirección:', addressError)
          // Continuar aunque falle el guardado de la dirección
        }

        // Guardar el remitente con coordenadas y dirección estructurada
        updateWizardData('sender', {
          ...createdCustomer,
          ...newSender.address,
          entryPin: newSender.entryPin || null,
          entryInstructions: newSender.entryInstructions || null,
          latitude: newSender.coordinates?.latitude || null,
          longitude: newSender.coordinates?.longitude || null
        })
        setCanProceed(true)
        setShowCreateForm(false)
        setIsEditing(false)
        setEditingCustomerId(null)
      } else {
        alert(data.error || (isEditing ? 'Error al actualizar remitente' : 'Error al crear remitente'))
      }
    } catch (error) {
      console.error('Error creating sender:', error)
      alert('Error al crear remitente')
    }
  }

  useEffect(() => {
    if (wizardData.sender) {
      setCanProceed(true)
    }
  }, [wizardData.sender])

  return (
    <div className="space-y-8">
      {/* Centered Icon Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center shadow-lg",
            theme === 'dark'
              ? 'bg-gradient-to-br from-blue-600 to-blue-700 shadow-blue-500/30'
              : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-400/30'
          )}
        >
          <Phone className="w-10 h-10 text-white" />
        </motion.div>
        <div>
          <h2 className={cn(
            "text-3xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Buscar Remitente
          </h2>
          <p className={cn(
            "text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Busca al cliente por teléfono o crea uno nuevo
          </p>
        </div>
      </div>

      {!wizardData.sender ? (
        <>
          {/* Search Bar */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Phone className={cn(
                "absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )} />
              <Input
                placeholder="Buscar por teléfono..."
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchCustomer()}
                className={cn(
                  "pl-10",
                  theme === 'dark' ? 'bg-gray-700 text-white' : ''
                )}
              />
            </div>
            <Button
              onClick={searchCustomer}
              disabled={searching || !searchPhone.trim()}
              className={cn(
                "flex items-center gap-2 rounded-xl",
                theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500',
                'text-white'
              )}
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Buscar
            </Button>
          </div>

          {/* Search Results */}
          {customers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 gap-4 max-w-md mx-auto"
            >
              {customers.map((customer, index) => (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectCustomer(customer)}
                  className={cn(
                    "p-5 rounded-xl border cursor-pointer transition-all shadow-md",
                    theme === 'dark'
                      ? 'bg-gray-700/50 border-gray-600 hover:bg-gray-700 hover:shadow-lg'
                      : 'bg-white border-gray-200 hover:bg-gray-50 hover:shadow-lg'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center shadow-md",
                      theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                    )}>
                      <User className="w-7 h-7 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className={cn(
                        "font-bold text-lg",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {customer.firstName} {customer.lastName}
                      </p>
                      <p className={cn(
                        "text-sm flex items-center gap-1 mt-1",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        <Phone className="w-3.5 h-3.5" />
                        {customer.phone}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Create Form with MapboxAddressAutofill */}
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "p-6 sm:p-8 rounded-2xl border shadow-lg",
                theme === 'dark' ? 'bg-gray-700/50 border-gray-600 backdrop-blur-sm' : 'bg-gray-50 border-gray-200'
              )}
            >
              <h3 className={cn(
                "text-xl font-bold mb-6 text-center",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {isEditing ? 'Editar Remitente' : 'Crear Nuevo Remitente'}
              </h3>

              {/* Personal Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <Input
                  placeholder="Nombre *"
                  value={newSender.firstName}
                  onChange={(e) => setNewSender({ ...newSender, firstName: e.target.value })}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                  )}
                />
                <Input
                  placeholder="Apellido *"
                  value={newSender.lastName}
                  onChange={(e) => setNewSender({ ...newSender, lastName: e.target.value })}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                  )}
                />
                <Input
                  placeholder="Teléfono *"
                  value={newSender.phone}
                  onChange={(e) => setNewSender({ ...newSender, phone: e.target.value })}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                  )}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={newSender.email}
                  onChange={(e) => setNewSender({ ...newSender, email: e.target.value })}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                  )}
                />
                <select
                  value={newSender.idType}
                  onChange={(e) => setNewSender({ ...newSender, idType: e.target.value })}
                  className={cn(
                    "rounded-xl px-3 py-2 border",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300'
                  )}
                >
                  <option value="">Tipo de Documento</option>
                  <option value="passport">Pasaporte</option>
                  <option value="license">Licencia de Conducir / ID</option>
                </select>
                <Input
                  placeholder="Número de Documento"
                  value={newSender.idNumber}
                  onChange={(e) => setNewSender({ ...newSender, idNumber: e.target.value })}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                  )}
                  disabled={!newSender.idType}
                />
              </div>

              {/* Entry Information Section */}
              <div className="mb-6">
                <h4 className={cn(
                  "text-sm font-semibold mb-3 flex items-center gap-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  <Key className="w-4 h-4" />
                  Acceso al Edificio (opcional)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    placeholder="PIN de entrada"
                    value={newSender.entryPin}
                    onChange={(e) => setNewSender({ ...newSender, entryPin: e.target.value })}
                    className={cn(
                      "rounded-xl",
                      theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                    )}
                  />
                  <Input
                    placeholder="Instrucciones de entrada"
                    value={newSender.entryInstructions}
                    onChange={(e) => setNewSender({ ...newSender, entryInstructions: e.target.value })}
                    className={cn(
                      "rounded-xl",
                      theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                    )}
                  />
                </div>
              </div>

              {/* Alternate Contact Section */}
              <div className="mb-6">
                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSender.hasAlternateContact}
                    onChange={(e) => setNewSender({ ...newSender, hasAlternateContact: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className={cn("font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Agregar contacto alternativo
                  </span>
                </label>

                {newSender.hasAlternateContact && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <Input
                      placeholder="Nombre del contacto *"
                      value={newSender.alternateContactName}
                      onChange={(e) => setNewSender({ ...newSender, alternateContactName: e.target.value })}
                      className={cn(
                        "rounded-xl",
                        theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                      )}
                    />
                    <Input
                      placeholder="Teléfono del contacto *"
                      value={newSender.alternateContactPhone}
                      onChange={(e) => setNewSender({ ...newSender, alternateContactPhone: e.target.value })}
                      className={cn(
                        "rounded-xl",
                        theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Address Section with Mapbox */}
              <div className="mb-6">
                <h4 className={cn(
                  "text-sm font-semibold mb-3 flex items-center gap-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  <MapPin className="w-4 h-4" />
                  Dirección del Remitente *
                </h4>
                <MapboxAddressAutofill
                  value={newSender.address}
                  onChange={(addressData) => {
                    setNewSender({ ...newSender, address: addressData })
                  }}
                  onCoordinatesChange={(coordinates) => {
                    setNewSender({ ...newSender, coordinates })
                  }}
                />
              </div>

              <div className="flex gap-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    onClick={() => {
                      setShowCreateForm(false)
                      setIsEditing(false)
                      setEditingCustomerId(null)
                    }}
                    className={cn(
                      "w-full rounded-xl font-medium py-3",
                      theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-200 hover:bg-gray-300',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}
                  >
                    Cancelar
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    onClick={createSender}
                    className="w-full rounded-xl font-medium py-3 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/30"
                  >
                    {isEditing ? 'Guardar Cambios' : 'Crear Remitente'}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </>
      ) : (
        /* Selected Customer */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "relative p-6 sm:p-8 rounded-2xl border shadow-lg",
            theme === 'dark' ? 'bg-green-900/20 border-green-700 backdrop-blur-sm' : 'bg-green-50 border-green-200'
          )}
        >
          {/* Loading overlay mientras se cargan direcciones */}
          {loadingAddresses && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                "absolute inset-0 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm z-10",
                theme === 'dark' ? 'bg-gray-800/90' : 'bg-white/90'
              )}
            >
              <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-3" />
              <span className={cn(
                "text-sm font-medium",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Cargando direcciones...
              </span>
            </motion.div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className={cn(
                  "w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-lg",
                  theme === 'dark' ? 'bg-green-900/30 shadow-green-500/20' : 'bg-green-100 shadow-green-400/20'
                )}
              >
                <User className="w-9 h-9 sm:w-10 sm:h-10 text-green-600" />
              </motion.div>
              <div>
                <p className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {wizardData.sender.firstName} {wizardData.sender.lastName}
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-green-600" />
                    <span className={cn(
                      "font-medium",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      {wizardData.sender.phone}
                    </span>
                  </div>
                  {wizardData.sender.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-green-600" />
                      <span className={cn(
                        "font-medium",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {wizardData.sender.email}
                      </span>
                    </div>
                  )}
                </div>
                {/* Mostrar dirección del remitente */}
                {(wizardData.sender.address || wizardData.sender.street) && (
                  <div className="flex items-start gap-2 mt-3">
                    <MapPin className="w-4 h-4 text-green-600 mt-0.5" />
                    <span className={cn(
                      "font-medium text-sm",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      {wizardData.sender.address ||
                       `${wizardData.sender.street}${wizardData.sender.apartment ? ', ' + wizardData.sender.apartment : ''}, ${wizardData.sender.city}, ${wizardData.sender.state} ${wizardData.sender.zipCode}`}
                    </span>
                  </div>
                )}
                {/* Mostrar PIN e instrucciones de entrada */}
                {(wizardData.sender.entryPin || wizardData.sender.entryInstructions) && (
                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    {wizardData.sender.entryPin && (
                      <div className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-green-600" />
                        <span className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          PIN: {wizardData.sender.entryPin}
                        </span>
                      </div>
                    )}
                    {wizardData.sender.entryInstructions && (
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-green-600" />
                        <span className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          {wizardData.sender.entryInstructions}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => {
                    // Cargar datos del cliente en el formulario para editar
                    setNewSender({
                      firstName: wizardData.sender.firstName || '',
                      lastName: wizardData.sender.lastName || '',
                      phone: wizardData.sender.phone || '',
                      email: wizardData.sender.email || '',
                      idType: wizardData.sender.idType || '',
                      idNumber: wizardData.sender.idNumber || '',
                      entryPin: wizardData.sender.entryPin || '',
                      entryInstructions: wizardData.sender.entryInstructions || '',
                      hasAlternateContact: wizardData.sender.hasAlternateContact || false,
                      alternateContactName: wizardData.sender.alternateContactName || '',
                      alternateContactPhone: wizardData.sender.alternateContactPhone || '',
                      address: {
                        street: wizardData.sender.street || '',
                        apartment: wizardData.sender.apartment || '',
                        city: wizardData.sender.city || '',
                        state: wizardData.sender.state || '',
                        zipCode: wizardData.sender.zipCode || '',
                        country: wizardData.sender.country || 'US'
                      },
                      coordinates: wizardData.sender.latitude && wizardData.sender.longitude
                        ? { latitude: wizardData.sender.latitude, longitude: wizardData.sender.longitude }
                        : null
                    })
                    setIsEditing(true)
                    setEditingCustomerId(wizardData.sender.id)
                    setShowCreateForm(true)
                    updateWizardData('sender', null)
                    setCanProceed(false)
                  }}
                  variant="outline"
                  className={cn(
                    "rounded-xl font-medium px-4 py-2.5 flex items-center gap-2",
                    theme === 'dark' ? 'border-blue-600 text-blue-400 hover:bg-blue-900/30' : 'border-blue-500 text-blue-600 hover:bg-blue-50'
                  )}
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => {
                    updateWizardData('sender', null)
                    setCanProceed(false)
                    setCustomers([])
                    setCustomerAddresses([])
                    setSelectedAddressId(null)
                    setIsEditing(false)
                    setEditingCustomerId(null)
                  }}
                  variant="outline"
                  className={cn(
                    "rounded-xl font-medium px-4 py-2.5",
                    theme === 'dark' ? 'border-gray-600 hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  Cambiar
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Lista de direcciones inline */}
          {selectedCustomer && customerAddresses.length > 1 && (
            <div className={cn(
              "mt-6 pt-6 border-t",
              theme === 'dark' ? 'border-green-700/50' : 'border-green-200'
            )}>
              <h4 className={cn(
                "text-lg font-semibold mb-4",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Selecciona una dirección de envío:
              </h4>

              {loadingAddresses ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                </div>
              ) : (
                <div className="grid gap-3">
                  {customerAddresses.map((address) => (
                    <motion.button
                      key={address.id}
                      onClick={() => selectAddress(address)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border-2 transition-all",
                        selectedAddressId === address.id
                          ? theme === 'dark'
                            ? 'border-green-500 bg-green-900/30'
                            : 'border-green-500 bg-green-50'
                          : theme === 'dark'
                            ? 'border-gray-600 hover:border-green-500 hover:bg-gray-700'
                            : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <MapPin className={cn(
                            "w-5 h-5 mt-1",
                            selectedAddressId === address.id
                              ? 'text-green-600'
                              : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )} />
                          <div className="flex-1">
                            <div className={cn(
                              "font-semibold mb-1",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {address.street}{address.apartment && `, ${address.apartment}`}
                            </div>
                            <div className={cn(
                              "text-sm",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                            )}>
                              {address.city}, {address.state} {address.zipCode}
                            </div>
                            {address.country && address.country !== 'US' && (
                              <div className={cn(
                                "text-sm",
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                {address.country}
                              </div>
                            )}
                            {address.notes && (
                              <div className={cn(
                                "text-xs mt-1 italic",
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              )}>
                                {address.notes}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {address.isPrimary && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                              Principal
                            </span>
                          )}
                          {selectedAddressId === address.id && (
                            <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {/* Botón eliminar dirección */}
                          {customerAddresses.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => deleteAddress(address.id, e)}
                              className={cn(
                                "p-1.5 rounded-full transition-colors",
                                theme === 'dark'
                                  ? 'hover:bg-red-900/50 text-gray-400 hover:text-red-400'
                                  : 'hover:bg-red-100 text-gray-500 hover:text-red-600'
                              )}
                              title="Eliminar dirección"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
