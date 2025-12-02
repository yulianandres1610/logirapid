'use client'

import React, { useState, useEffect } from 'react'
import { Search, User, Phone, Mail, Loader2, MapPin, Plus } from 'lucide-react'
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

export default function RecipientSearchStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [searchPhone, setSearchPhone] = useState('')
  const [searching, setSearching] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)

  // Estado para nuevo destinatario
  const [newRecipient, setNewRecipient] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    idType: '',
    idNumber: '',
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
          setNewRecipient(prev => ({ ...prev, phone: searchPhone }))
        }
      }
    } catch (error) {
      console.error('Error searching customer:', error)
    } finally {
      setSearching(false)
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
          updateWizardData('recipient', customer)
          setCanProceed(false) // Usuario debe seleccionar una dirección manualmente
        } else {
          // No tiene direcciones guardadas, usar la dirección legacy del customer
          // Ensure structured address fields are present
          const recipientWithFields = { ...customer }
          if (!recipientWithFields.street && recipientWithFields.address) {
            // Parse the address string to extract components
            const addressParts = recipientWithFields.address.split(',').map((p: string) => p.trim())

            if (addressParts.length >= 4) {
              // Format: "street, city, state zipcode, country"
              recipientWithFields.street = addressParts[0]
              recipientWithFields.city = addressParts[1]

              // Parse "state zipcode" part
              const stateZip = addressParts[2].split(' ').filter(Boolean)
              if (stateZip.length >= 2) {
                recipientWithFields.state = stateZip[0]
                recipientWithFields.zipCode = stateZip[1]
              }

              // Country is the last part
              if (addressParts[3]) {
                recipientWithFields.country = addressParts[3]
              }
            } else {
              // Fallback: just use the address as street
              recipientWithFields.street = recipientWithFields.address
            }
          }
          if (!recipientWithFields.city) {
            recipientWithFields.city = ''
          }
          if (!recipientWithFields.state) {
            recipientWithFields.state = ''
          }
          if (!recipientWithFields.zipCode && !recipientWithFields.zipcode) {
            recipientWithFields.zipCode = recipientWithFields.zipcode || ''
          }
          if (!recipientWithFields.country) {
            recipientWithFields.country = 'US'
          }
          updateWizardData('recipient', recipientWithFields)
          setCanProceed(true)
        }
      }
    } catch (error) {
      console.error('Error loading addresses:', error)
      // Si falla, usar dirección legacy
      const recipientWithFields = { ...customer }
      if (!recipientWithFields.street && recipientWithFields.address) {
        // Parse the address string to extract components
        const addressParts = recipientWithFields.address.split(',').map((p: string) => p.trim())

        if (addressParts.length >= 4) {
          // Format: "street, city, state zipcode, country"
          recipientWithFields.street = addressParts[0]
          recipientWithFields.city = addressParts[1]

          // Parse "state zipcode" part
          const stateZip = addressParts[2].split(' ').filter(Boolean)
          if (stateZip.length >= 2) {
            recipientWithFields.state = stateZip[0]
            recipientWithFields.zipCode = stateZip[1]
          }

          // Country is the last part
          if (addressParts[3]) {
            recipientWithFields.country = addressParts[3]
          }
        } else {
          // Fallback: just use the address as street
          recipientWithFields.street = recipientWithFields.address
        }
      }
      if (!recipientWithFields.city) {
        recipientWithFields.city = ''
      }
      if (!recipientWithFields.state) {
        recipientWithFields.state = ''
      }
      if (!recipientWithFields.zipCode && !recipientWithFields.zipcode) {
        recipientWithFields.zipCode = recipientWithFields.zipcode || ''
      }
      if (!recipientWithFields.country) {
        recipientWithFields.country = 'US'
      }
      updateWizardData('recipient', recipientWithFields)
      setCanProceed(true)
    } finally {
      setLoadingAddresses(false)
    }
  }

  const selectCustomer = (customer: any) => {
    setSelectedCustomer(customer)
    loadCustomerAddresses(customer)
  }

  const selectAddress = (address: any, customer?: any) => {
    // Usar el customer pasado como parámetro o el selectedCustomer del estado
    const customerToUse = customer || selectedCustomer
    console.log('📍 [RecipientSearchStep] selectAddress called with:', { address, customer: customerToUse })

    // Construir la dirección completa para el campo address legacy
    const fullAddress = `${address.street}${address.apartment ? ', ' + address.apartment : ''}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country || 'US'}`

    const recipientData = {
      ...customerToUse,
      street: address.street,
      apartment: address.apartment || '',
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country,
      addressId: address.id,
      address: fullAddress
    }
    console.log('📍 [RecipientSearchStep] Final recipientData:', recipientData)
    setSelectedAddressId(address.id)
    updateWizardData('recipient', recipientData)
    setCanProceed(true)
  }

  const createRecipient = async () => {
    if (!newRecipient.firstName || !newRecipient.lastName || !newRecipient.phone) {
      alert('Nombre, apellido y teléfono son requeridos')
      return
    }

    if (!newRecipient.address.street || !newRecipient.address.city) {
      alert('Dirección completa es requerida')
      return
    }

    // Si no tiene coordenadas, intentar geocodificar automáticamente
    if (!newRecipient.coordinates) {
      const fullAddress = `${newRecipient.address.street}${newRecipient.address.apartment ? ', ' + newRecipient.address.apartment : ''}, ${newRecipient.address.city}, ${newRecipient.address.state} ${newRecipient.address.zipCode}, ${newRecipient.address.country || 'US'}`
      console.log('📍 Intentando geocodificar dirección automáticamente:', fullAddress)

      const coords = await geocodeAddress(fullAddress)
      if (coords) {
        newRecipient.coordinates = coords
        console.log('✅ Dirección geocodificada exitosamente:', coords)
      } else {
        console.warn('⚠️ No se pudo geocodificar automáticamente, continuando sin coordenadas')
        // Permitir continuar sin coordenadas - se geocodificarán posteriormente
      }
    }

    // Validar contacto alternativo si está activado
    if (newRecipient.hasAlternateContact && (!newRecipient.alternateContactName || !newRecipient.alternateContactPhone)) {
      alert('Si activas el contacto alternativo, debes proporcionar nombre y teléfono')
      return
    }

    try {
      // Construir dirección completa para el campo address legacy
      const fullAddress = `${newRecipient.address.street}${newRecipient.address.apartment ? ', ' + newRecipient.address.apartment : ''}, ${newRecipient.address.city}, ${newRecipient.address.state} ${newRecipient.address.zipCode}, ${newRecipient.address.country}`

      // Crear el cliente con todos los campos de dirección estructurados
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newRecipient.firstName,
          lastName: newRecipient.lastName,
          phone: newRecipient.phone,
          email: newRecipient.email,
          idType: newRecipient.idType || null,
          idNumber: newRecipient.idNumber || null,
          hasAlternateContact: newRecipient.hasAlternateContact,
          alternateContactName: newRecipient.alternateContactName || null,
          alternateContactPhone: newRecipient.alternateContactPhone || null,
          // Dirección completa (legacy)
          address: fullAddress,
          // Campos estructurados de dirección
          city: newRecipient.address.city || null,
          state: newRecipient.address.state || null,
          zipCode: newRecipient.address.zipCode || null,
          country: newRecipient.address.country || 'US',
          apartment: newRecipient.address.apartment || null
        })
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
              street: newRecipient.address.street,
              apartment: newRecipient.address.apartment || '',
              city: newRecipient.address.city,
              state: newRecipient.address.state,
              zipCode: newRecipient.address.zipCode,
              country: newRecipient.address.country,
              isPrimary: true,
              notes: newRecipient.coordinates
                ? `Coordenadas: ${newRecipient.coordinates.latitude}, ${newRecipient.coordinates.longitude}`
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

        // Guardar el destinatario con coordenadas y dirección estructurada
        updateWizardData('recipient', {
          ...createdCustomer,
          ...newRecipient.address,
          coordinates: newRecipient.coordinates
        })
        setCanProceed(true)
        setShowCreateForm(false)
      } else {
        alert(data.error || 'Error al crear destinatario')
      }
    } catch (error) {
      console.error('Error creating recipient:', error)
      alert('Error al crear destinatario')
    }
  }

  useEffect(() => {
    if (wizardData.recipient) {
      setCanProceed(true)
    }
  }, [wizardData.recipient])

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
              ? 'bg-gradient-to-br from-purple-600 to-purple-700 shadow-purple-500/30'
              : 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-purple-400/30'
          )}
        >
          <MapPin className="w-10 h-10 text-white" />
        </motion.div>
        <div>
          <h2 className={cn(
            "text-3xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Buscar Destinatario
          </h2>
          <p className={cn(
            "text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Busca al destinatario o crea uno nuevo con su dirección
          </p>
        </div>
      </div>

      {!wizardData.recipient ? (
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
                  "pl-10 rounded-xl",
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
                      theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                    )}>
                      <User className="w-7 h-7 text-purple-600" />
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
                Crear Nuevo Destinatario
              </h3>

              {/* Personal Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <Input
                  placeholder="Nombre *"
                  value={newRecipient.firstName}
                  onChange={(e) => setNewRecipient({ ...newRecipient, firstName: e.target.value })}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                  )}
                />
                <Input
                  placeholder="Apellido *"
                  value={newRecipient.lastName}
                  onChange={(e) => setNewRecipient({ ...newRecipient, lastName: e.target.value })}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                  )}
                />
                <Input
                  placeholder="Teléfono *"
                  value={newRecipient.phone}
                  onChange={(e) => setNewRecipient({ ...newRecipient, phone: e.target.value })}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                  )}
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={newRecipient.email}
                  onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                  )}
                />
                <select
                  value={newRecipient.idType}
                  onChange={(e) => setNewRecipient({ ...newRecipient, idType: e.target.value })}
                  className={cn(
                    "rounded-xl px-3 py-2 border",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300'
                  )}
                >
                  <option value="">Tipo de Documento</option>
                  <option value="passport">Pasaporte</option>
                  <option value="license">Licencia de Conducir</option>
                  <option value="id_card">Carnet de Identidad</option>
                </select>
                <Input
                  placeholder="Número de Documento"
                  value={newRecipient.idNumber}
                  onChange={(e) => setNewRecipient({ ...newRecipient, idNumber: e.target.value })}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                  )}
                  disabled={!newRecipient.idType}
                />
              </div>

              {/* Alternate Contact Section */}
              <div className="mb-6">
                <label className="flex items-center gap-2 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRecipient.hasAlternateContact}
                    onChange={(e) => setNewRecipient({ ...newRecipient, hasAlternateContact: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className={cn("font-medium", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                    Agregar contacto alternativo
                  </span>
                </label>

                {newRecipient.hasAlternateContact && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <Input
                      placeholder="Nombre del contacto *"
                      value={newRecipient.alternateContactName}
                      onChange={(e) => setNewRecipient({ ...newRecipient, alternateContactName: e.target.value })}
                      className={cn(
                        "rounded-xl",
                        theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                      )}
                    />
                    <Input
                      placeholder="Teléfono del contacto *"
                      value={newRecipient.alternateContactPhone}
                      onChange={(e) => setNewRecipient({ ...newRecipient, alternateContactPhone: e.target.value })}
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
                  Dirección de Entrega *
                </h4>
                <MapboxAddressAutofill
                  value={newRecipient.address}
                  onChange={(addressData) => {
                    setNewRecipient({ ...newRecipient, address: addressData })
                  }}
                  onCoordinatesChange={(coordinates) => {
                    setNewRecipient({ ...newRecipient, coordinates })
                  }}
                />
              </div>

              <div className="flex gap-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    onClick={() => setShowCreateForm(false)}
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
                    onClick={createRecipient}
                    className="w-full rounded-xl font-medium py-3 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/30"
                  >
                    Crear Destinatario
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </>
      ) : (
        /* Selected Recipient */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "relative p-6 sm:p-8 rounded-2xl border shadow-lg",
            theme === 'dark' ? 'bg-purple-900/20 border-purple-700 backdrop-blur-sm' : 'bg-purple-50 border-purple-200'
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
              <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-3" />
              <span className={cn(
                "text-sm font-medium",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Cargando direcciones...
              </span>
            </motion.div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 sm:gap-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className={cn(
                  "w-18 h-18 sm:w-20 sm:h-20 rounded-full flex items-center justify-center shadow-lg",
                  theme === 'dark' ? 'bg-purple-900/30 shadow-purple-500/20' : 'bg-purple-100 shadow-purple-400/20'
                )}
              >
                <User className="w-9 h-9 sm:w-10 sm:h-10 text-purple-600" />
              </motion.div>
              <div className="flex-1">
                <p className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {wizardData.recipient.firstName} {wizardData.recipient.lastName}
                </p>
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-purple-600" />
                    <span className={cn(
                      "font-medium",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      {wizardData.recipient.phone}
                    </span>
                  </div>
                  {wizardData.recipient.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-600" />
                      <span className={cn(
                        "font-medium",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {wizardData.recipient.email}
                      </span>
                    </div>
                  )}
                  {wizardData.recipient.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-purple-600 mt-0.5" />
                      <span className={cn(
                        "font-medium text-sm",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {wizardData.recipient.address}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => {
                    updateWizardData('recipient', null)
                    setCanProceed(false)
                    setCustomers([])
                    setCustomerAddresses([])
                    setSelectedAddressId(null)
                  }}
                  variant="outline"
                  className={cn(
                    "rounded-xl font-medium px-6 py-2.5",
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
              theme === 'dark' ? 'border-purple-700/50' : 'border-purple-200'
            )}>
              <h4 className={cn(
                "text-lg font-semibold mb-4",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Selecciona una dirección de entrega:
              </h4>

              {loadingAddresses ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
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
                            ? 'border-purple-500 bg-purple-900/30'
                            : 'border-purple-500 bg-purple-50'
                          : theme === 'dark'
                            ? 'border-gray-600 hover:border-purple-500 hover:bg-gray-700'
                            : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <MapPin className={cn(
                            "w-5 h-5 mt-1",
                            selectedAddressId === address.id
                              ? 'text-purple-600'
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
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200">
                              Principal
                            </span>
                          )}
                          {selectedAddressId === address.id && (
                            <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
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
