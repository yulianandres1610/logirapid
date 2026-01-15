'use client'

import React, { useState, useEffect } from 'react'
import { Search, User, Phone, Mail, Loader2, MapPin, Plus, Edit2, FileText, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Props {
  wizardData: any
  updateWizardData: (key: string, value: any) => void
  setCanProceed: (can: boolean) => void
  onNext: () => void
}

interface CubaAddressData {
  id?: number
  street: string
  number: string
  reparto: string
  floor: string
  provinceId: number | null
  provinceName: string
  municipalityId: number | null
  municipalityName: string
  deliveryInstructions: string
  isPrimary?: boolean
}

interface Province {
  id: number
  name: string
}

interface Municipality {
  id: number
  name: string
  stateId: number
}

export default function RecipientSearchStep({ wizardData, updateWizardData, setCanProceed }: Props) {
  const { theme } = useTheme()
  const [searchPhone, setSearchPhone] = useState('')
  const [searching, setSearching] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null)

  // Estado para direcciones del cliente seleccionado
  const [customerAddresses, setCustomerAddresses] = useState<CubaAddressData[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [showAddressSelector, setShowAddressSelector] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)

  // Provincias y municipios de Cuba
  const [provinces, setProvinces] = useState<Province[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)

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
      number: '',
      reparto: '',
      floor: '',
      provinceId: null,
      provinceName: '',
      municipalityId: null,
      municipalityName: '',
      deliveryInstructions: ''
    } as CubaAddressData
  })

  // Cargar provincias y municipios al montar
  useEffect(() => {
    loadProvincesMunicipalities()
  }, [])

  const loadProvincesMunicipalities = async () => {
    setLoadingLocations(true)
    try {
      const response = await fetch('/api/apacargo/municipalities?includeStates=true')
      const data = await response.json()
      if (data.success && data.data) {
        setProvinces(data.data.states || [])
        setMunicipalities(data.data.municipalities || [])
      }
    } catch (error) {
      console.error('Error loading provinces/municipalities:', error)
    } finally {
      setLoadingLocations(false)
    }
  }

  // Filtrar municipios por provincia seleccionada
  const filteredMunicipalities = newRecipient.address.provinceId
    ? municipalities.filter(m => m.stateId === newRecipient.address.provinceId)
    : []

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

  const selectCustomer = async (customer: any) => {
    setSelectedCustomer(customer)
    setLoadingAddresses(true)

    try {
      // Cargar direcciones del cliente
      const response = await fetch(`/api/customer-addresses?customerId=${customer.id}&addressType=cuba`)
      const data = await response.json()

      if (data.success && data.data && data.data.length > 0) {
        setCustomerAddresses(data.data)
        // Si tiene múltiples direcciones, mostrar selector
        if (data.data.length > 1) {
          setShowAddressSelector(true)
        } else {
          // Si solo tiene una dirección, seleccionarla automáticamente
          selectAddressForCustomer(customer, data.data[0])
        }
      } else {
        // Si no tiene direcciones de Cuba, mostrar formulario para agregar una
        setShowAddressSelector(true)
        setShowNewAddressForm(true)
        setCustomerAddresses([])
      }
    } catch (error) {
      console.error('Error loading customer addresses:', error)
      // En caso de error, permitir crear nueva dirección
      setShowAddressSelector(true)
      setShowNewAddressForm(true)
      setCustomerAddresses([])
    } finally {
      setLoadingAddresses(false)
    }
  }

  const selectAddressForCustomer = (customer: any, address: CubaAddressData) => {
    const addressDisplay = buildAddressDisplay(address)

    const recipientData = {
      ...customer,
      address: addressDisplay,
      addressId: address.id,
      // Campos estructurados de Cuba
      street: address.street || '',
      number: address.number || '',
      reparto: address.reparto || '',
      floor: address.floor || '',
      provinceId: address.provinceId || null,
      provinceName: address.provinceName || '',
      municipalityId: address.municipalityId || null,
      municipalityName: address.municipalityName || '',
      deliveryInstructions: address.deliveryInstructions || ''
    }

    updateWizardData('recipient', recipientData)
    setCanProceed(true)
    setShowAddressSelector(false)
    setSelectedCustomer(null)
    setCustomerAddresses([])
  }

  const createAddressForExistingCustomer = async () => {
    if (!selectedCustomer) return

    if (!newRecipient.address.street || !newRecipient.address.provinceId || !newRecipient.address.municipalityId) {
      alert('Calle, provincia y municipio son requeridos')
      return
    }

    try {
      const response = await fetch('/api/customer-addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          street: newRecipient.address.street,
          number: newRecipient.address.number,
          reparto: newRecipient.address.reparto,
          floor: newRecipient.address.floor,
          provinceId: newRecipient.address.provinceId,
          provinceName: newRecipient.address.provinceName,
          municipalityId: newRecipient.address.municipalityId,
          municipalityName: newRecipient.address.municipalityName,
          deliveryInstructions: newRecipient.address.deliveryInstructions,
          addressType: 'cuba',
          country: 'Cuba',
          isPrimary: customerAddresses.length === 0 // Primera dirección es primaria
        })
      })

      const data = await response.json()
      if (data.success) {
        selectAddressForCustomer(selectedCustomer, data.data)
        // Reset form
        setNewRecipient(prev => ({
          ...prev,
          address: {
            street: '',
            number: '',
            reparto: '',
            floor: '',
            provinceId: null,
            provinceName: '',
            municipalityId: null,
            municipalityName: '',
            deliveryInstructions: ''
          }
        }))
        setShowNewAddressForm(false)
      } else {
        alert(data.error || 'Error al crear dirección')
      }
    } catch (error) {
      console.error('Error creating address:', error)
      alert('Error al crear dirección')
    }
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
      } else {
        alert(data.error || 'Error al eliminar dirección')
      }
    } catch (error) {
      console.error('Error deleting address:', error)
      alert('Error al eliminar dirección')
    }
  }

  const buildAddressDisplay = (data: any): string => {
    const parts = []
    if (data.street) parts.push(data.street)
    if (data.number) parts.push(`#${data.number}`)
    if (data.floor) parts.push(data.floor)
    if (data.reparto) parts.push(data.reparto)
    if (data.municipalityName) parts.push(data.municipalityName)
    if (data.provinceName) parts.push(data.provinceName)
    parts.push('Cuba')
    return parts.join(', ')
  }

  const handleProvinceChange = (provinceId: number) => {
    const province = provinces.find(p => p.id === provinceId)
    setNewRecipient({
      ...newRecipient,
      address: {
        ...newRecipient.address,
        provinceId,
        provinceName: province?.name || '',
        municipalityId: null,
        municipalityName: ''
      }
    })
  }

  const handleMunicipalityChange = (municipalityId: number) => {
    const municipality = municipalities.find(m => m.id === municipalityId)
    setNewRecipient({
      ...newRecipient,
      address: {
        ...newRecipient.address,
        municipalityId,
        municipalityName: municipality?.name || ''
      }
    })
  }

  const createRecipient = async () => {
    if (!newRecipient.firstName || !newRecipient.lastName || !newRecipient.phone) {
      alert('Nombre, apellido y teléfono son requeridos')
      return
    }

    if (!newRecipient.address.street || !newRecipient.address.provinceId || !newRecipient.address.municipalityId) {
      alert('Calle, provincia y municipio son requeridos')
      return
    }

    // Validar contacto alternativo si está activado
    if (newRecipient.hasAlternateContact && (!newRecipient.alternateContactName || !newRecipient.alternateContactPhone)) {
      alert('Si activas el contacto alternativo, debes proporcionar nombre y teléfono')
      return
    }

    try {
      // Construir dirección completa para el campo address legacy
      const fullAddress = buildAddressDisplay(newRecipient.address)

      // Si estamos editando, usar PUT en lugar de POST
      const method = isEditing && editingCustomerId ? 'PUT' : 'POST'
      const customerData: any = {
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
        country: 'CU'
      }

      if (isEditing && editingCustomerId) {
        customerData.id = editingCustomerId
      }

      const response = await fetch('/api/customers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
      })

      const data = await response.json()
      if (data.success) {
        const customerId = isEditing && editingCustomerId ? editingCustomerId : data.data.id
        const createdCustomer = data.data

        // Crear la dirección en customer_addresses
        const addressResponse = await fetch('/api/customer-addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customerId,
            street: newRecipient.address.street,
            number: newRecipient.address.number,
            reparto: newRecipient.address.reparto,
            floor: newRecipient.address.floor,
            provinceId: newRecipient.address.provinceId,
            provinceName: newRecipient.address.provinceName,
            municipalityId: newRecipient.address.municipalityId,
            municipalityName: newRecipient.address.municipalityName,
            deliveryInstructions: newRecipient.address.deliveryInstructions,
            addressType: 'cuba',
            country: 'Cuba',
            isPrimary: true
          })
        })

        const addressData = await addressResponse.json()
        let addressId = null
        if (addressData.success) {
          addressId = addressData.data.id
        }

        // Guardar el destinatario con dirección estructurada
        updateWizardData('recipient', {
          ...createdCustomer,
          addressId,
          street: newRecipient.address.street,
          number: newRecipient.address.number,
          reparto: newRecipient.address.reparto,
          floor: newRecipient.address.floor,
          provinceId: newRecipient.address.provinceId,
          provinceName: newRecipient.address.provinceName,
          municipalityId: newRecipient.address.municipalityId,
          municipalityName: newRecipient.address.municipalityName,
          deliveryInstructions: newRecipient.address.deliveryInstructions,
          address: fullAddress
        })
        setCanProceed(true)
        setShowCreateForm(false)
        setIsEditing(false)
        setEditingCustomerId(null)
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
            Busca al destinatario en Cuba o crea uno nuevo
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
          {customers.length > 0 && !showAddressSelector && (
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

          {/* Address Selector for Existing Customer */}
          {showAddressSelector && selectedCustomer && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "p-6 sm:p-8 rounded-2xl border shadow-lg",
                theme === 'dark' ? 'bg-gray-700/50 border-gray-600 backdrop-blur-sm' : 'bg-gray-50 border-gray-200'
              )}
            >
              {/* Customer Info Header */}
              <div className="flex items-center gap-4 mb-6 pb-4 border-b border-gray-600">
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center",
                  theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                )}>
                  <User className="w-7 h-7 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className={cn(
                    "font-bold text-lg",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {selectedCustomer.firstName} {selectedCustomer.lastName}
                  </p>
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    {selectedCustomer.phone}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setShowAddressSelector(false)
                    setSelectedCustomer(null)
                    setCustomerAddresses([])
                    setShowNewAddressForm(false)
                  }}
                  variant="ghost"
                  className={cn(
                    "text-sm",
                    theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  Cancelar
                </Button>
              </div>

              {loadingAddresses ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600 mr-2" />
                  <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Cargando direcciones...
                  </span>
                </div>
              ) : !showNewAddressForm ? (
                <>
                  {/* Existing Addresses */}
                  {customerAddresses.length > 0 && (
                    <div className="mb-6">
                      <h4 className={cn(
                        "text-sm font-semibold mb-3",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Selecciona una dirección existente:
                      </h4>
                      <div className="space-y-3">
                        {customerAddresses.map((addr, index) => (
                          <motion.div
                            key={addr.id || index}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => selectAddressForCustomer(selectedCustomer, addr)}
                            className={cn(
                              "p-4 rounded-xl border cursor-pointer transition-all",
                              theme === 'dark'
                                ? 'bg-gray-600/50 border-gray-500 hover:bg-gray-600 hover:border-purple-500'
                                : 'bg-white border-gray-200 hover:bg-purple-50 hover:border-purple-300'
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <MapPin className={cn(
                                "w-5 h-5 mt-0.5 flex-shrink-0",
                                theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                              )} />
                              <div className="flex-1">
                                <p className={cn(
                                  "font-medium",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {buildAddressDisplay(addr)}
                                </p>
                                {addr.deliveryInstructions && (
                                  <p className={cn(
                                    "text-sm mt-1 italic",
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                  )}>
                                    {addr.deliveryInstructions}
                                  </p>
                                )}
                                {addr.isPrimary && (
                                  <span className={cn(
                                    "inline-block mt-2 px-2 py-0.5 text-xs rounded-full",
                                    theme === 'dark' ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700'
                                  )}>
                                    Principal
                                  </span>
                                )}
                              </div>
                              {/* Botón eliminar dirección */}
                              {customerAddresses.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => deleteAddress(addr.id!, e)}
                                  className={cn(
                                    "p-1.5 rounded-full transition-colors flex-shrink-0",
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
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add New Address Button */}
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={() => setShowNewAddressForm(true)}
                      className={cn(
                        "w-full rounded-xl font-medium py-3 flex items-center justify-center gap-2",
                        theme === 'dark' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600',
                        'text-white'
                      )}
                    >
                      <Plus className="w-5 h-5" />
                      Agregar Nueva Dirección
                    </Button>
                  </motion.div>
                </>
              ) : (
                /* New Address Form for Existing Customer */
                <div>
                  <h4 className={cn(
                    "text-sm font-semibold mb-4 flex items-center gap-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    <MapPin className="w-4 h-4" />
                    Nueva Dirección en Cuba
                  </h4>

                  {loadingLocations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-purple-600 mr-2" />
                      <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Cargando provincias y municipios...
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Calle y Número */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <Input
                            placeholder="Calle *"
                            value={newRecipient.address.street}
                            onChange={(e) => setNewRecipient({
                              ...newRecipient,
                              address: { ...newRecipient.address, street: e.target.value }
                            })}
                            className={cn(
                              "rounded-xl",
                              theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                            )}
                          />
                        </div>
                        <Input
                          placeholder="Número"
                          value={newRecipient.address.number}
                          onChange={(e) => setNewRecipient({
                            ...newRecipient,
                            address: { ...newRecipient.address, number: e.target.value }
                          })}
                          className={cn(
                            "rounded-xl",
                            theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                          )}
                        />
                      </div>

                      {/* Reparto y Piso */}
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="Reparto / Barrio"
                          value={newRecipient.address.reparto}
                          onChange={(e) => setNewRecipient({
                            ...newRecipient,
                            address: { ...newRecipient.address, reparto: e.target.value }
                          })}
                          className={cn(
                            "rounded-xl",
                            theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                          )}
                        />
                        <Input
                          placeholder="Piso / Apt"
                          value={newRecipient.address.floor}
                          onChange={(e) => setNewRecipient({
                            ...newRecipient,
                            address: { ...newRecipient.address, floor: e.target.value }
                          })}
                          className={cn(
                            "rounded-xl",
                            theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                          )}
                        />
                      </div>

                      {/* Provincia y Municipio */}
                      <div className="grid grid-cols-2 gap-4">
                        <select
                          value={newRecipient.address.provinceId || ''}
                          onChange={(e) => handleProvinceChange(Number(e.target.value))}
                          className={cn(
                            "rounded-xl px-3 py-2 border",
                            theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300'
                          )}
                        >
                          <option value="">Provincia *</option>
                          {provinces.map(province => (
                            <option key={province.id} value={province.id}>
                              {province.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={newRecipient.address.municipalityId || ''}
                          onChange={(e) => handleMunicipalityChange(Number(e.target.value))}
                          disabled={!newRecipient.address.provinceId}
                          className={cn(
                            "rounded-xl px-3 py-2 border",
                            theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300',
                            !newRecipient.address.provinceId && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <option value="">Municipio *</option>
                          {filteredMunicipalities.map(municipality => (
                            <option key={municipality.id} value={municipality.id}>
                              {municipality.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Instrucciones de entrega */}
                      <div>
                        <textarea
                          placeholder="Instrucciones de entrega (opcional)"
                          value={newRecipient.address.deliveryInstructions}
                          onChange={(e) => setNewRecipient({
                            ...newRecipient,
                            address: { ...newRecipient.address, deliveryInstructions: e.target.value }
                          })}
                          rows={2}
                          className={cn(
                            "w-full rounded-xl px-3 py-2 border resize-none",
                            theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300'
                          )}
                        />
                      </div>

                      {/* Buttons */}
                      <div className="flex gap-3 pt-2">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                          <Button
                            onClick={() => {
                              setShowNewAddressForm(false)
                              // Reset address form
                              setNewRecipient(prev => ({
                                ...prev,
                                address: {
                                  street: '',
                                  number: '',
                                  reparto: '',
                                  floor: '',
                                  provinceId: null,
                                  provinceName: '',
                                  municipalityId: null,
                                  municipalityName: '',
                                  deliveryInstructions: ''
                                }
                              }))
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
                            onClick={createAddressForExistingCustomer}
                            className="w-full rounded-xl font-medium py-3 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/30"
                          >
                            Guardar Dirección
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Create Form for Cuba Address */}
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
                {isEditing ? 'Editar Destinatario' : 'Crear Nuevo Destinatario'}
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
                  <option value="carnet">Carnet de Identidad</option>
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

              {/* Cuba Address Section */}
              <div className="mb-6">
                <h4 className={cn(
                  "text-sm font-semibold mb-3 flex items-center gap-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  <MapPin className="w-4 h-4" />
                  Dirección en Cuba *
                </h4>

                {loadingLocations ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600 mr-2" />
                    <span className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Cargando provincias y municipios...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Calle y Número */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Input
                          placeholder="Calle *"
                          value={newRecipient.address.street}
                          onChange={(e) => setNewRecipient({
                            ...newRecipient,
                            address: { ...newRecipient.address, street: e.target.value }
                          })}
                          className={cn(
                            "rounded-xl",
                            theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                          )}
                        />
                      </div>
                      <Input
                        placeholder="Número"
                        value={newRecipient.address.number}
                        onChange={(e) => setNewRecipient({
                          ...newRecipient,
                          address: { ...newRecipient.address, number: e.target.value }
                        })}
                        className={cn(
                          "rounded-xl",
                          theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                        )}
                      />
                    </div>

                    {/* Reparto y Piso */}
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        placeholder="Reparto / Barrio"
                        value={newRecipient.address.reparto}
                        onChange={(e) => setNewRecipient({
                          ...newRecipient,
                          address: { ...newRecipient.address, reparto: e.target.value }
                        })}
                        className={cn(
                          "rounded-xl",
                          theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                        )}
                      />
                      <Input
                        placeholder="Piso / Apt"
                        value={newRecipient.address.floor}
                        onChange={(e) => setNewRecipient({
                          ...newRecipient,
                          address: { ...newRecipient.address, floor: e.target.value }
                        })}
                        className={cn(
                          "rounded-xl",
                          theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : ''
                        )}
                      />
                    </div>

                    {/* Provincia y Municipio */}
                    <div className="grid grid-cols-2 gap-4">
                      <select
                        value={newRecipient.address.provinceId || ''}
                        onChange={(e) => handleProvinceChange(Number(e.target.value))}
                        className={cn(
                          "rounded-xl px-3 py-2 border",
                          theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300'
                        )}
                      >
                        <option value="">Provincia *</option>
                        {provinces.map(province => (
                          <option key={province.id} value={province.id}>
                            {province.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newRecipient.address.municipalityId || ''}
                        onChange={(e) => handleMunicipalityChange(Number(e.target.value))}
                        disabled={!newRecipient.address.provinceId}
                        className={cn(
                          "rounded-xl px-3 py-2 border",
                          theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300',
                          !newRecipient.address.provinceId && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <option value="">Municipio *</option>
                        {filteredMunicipalities.map(municipality => (
                          <option key={municipality.id} value={municipality.id}>
                            {municipality.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Instrucciones de entrega */}
                    <div>
                      <textarea
                        placeholder="Instrucciones de entrega (opcional)"
                        value={newRecipient.address.deliveryInstructions}
                        onChange={(e) => setNewRecipient({
                          ...newRecipient,
                          address: { ...newRecipient.address, deliveryInstructions: e.target.value }
                        })}
                        rows={2}
                        className={cn(
                          "w-full rounded-xl px-3 py-2 border resize-none",
                          theme === 'dark' ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300'
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                  <Button
                    onClick={() => {
                      setShowCreateForm(false)
                      setIsEditing(false)
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
                    onClick={createRecipient}
                    className="w-full rounded-xl font-medium py-3 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/30"
                  >
                    {isEditing ? 'Guardar Cambios' : 'Crear Destinatario'}
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
                  {wizardData.recipient.deliveryInstructions && (
                    <div className="flex items-start gap-2 mt-1">
                      <FileText className="w-4 h-4 text-purple-600 mt-0.5" />
                      <span className={cn(
                        "text-sm italic",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        {wizardData.recipient.deliveryInstructions}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  onClick={() => {
                    // Cargar datos del cliente en el formulario para editar
                    setNewRecipient({
                      firstName: wizardData.recipient.firstName || '',
                      lastName: wizardData.recipient.lastName || '',
                      phone: wizardData.recipient.phone || '',
                      email: wizardData.recipient.email || '',
                      idType: wizardData.recipient.idType || '',
                      idNumber: wizardData.recipient.idNumber || '',
                      hasAlternateContact: wizardData.recipient.hasAlternateContact || false,
                      alternateContactName: wizardData.recipient.alternateContactName || '',
                      alternateContactPhone: wizardData.recipient.alternateContactPhone || '',
                      address: {
                        street: wizardData.recipient.street || '',
                        number: wizardData.recipient.number || '',
                        reparto: wizardData.recipient.reparto || '',
                        floor: wizardData.recipient.floor || '',
                        provinceId: wizardData.recipient.provinceId || null,
                        provinceName: wizardData.recipient.provinceName || '',
                        municipalityId: wizardData.recipient.municipalityId || null,
                        municipalityName: wizardData.recipient.municipalityName || '',
                        deliveryInstructions: wizardData.recipient.deliveryInstructions || ''
                      }
                    })
                    setIsEditing(true)
                    setEditingCustomerId(wizardData.recipient.id || null)
                    setShowCreateForm(true)
                    updateWizardData('recipient', null)
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
                    updateWizardData('recipient', null)
                    setCanProceed(false)
                    setCustomers([])
                    setIsEditing(false)
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
        </motion.div>
      )}
    </div>
  )
}
