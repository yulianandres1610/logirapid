'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  Phone,
  MapPin,
  Package,
  Box,
  Archive,
  Calendar,
  Clock,
  AlertCircle,
  Check,
  Plus,
  Home,
  Building,
  Mail,
  MessageSquare,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import MapboxAddressAutofill from '@/components/ui/MapboxAddressAutofill'

interface Customer {
  id: number
  firstName: string
  lastName: string
  phone: string
  email?: string
  address?: {
    street: string
    apartment: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  notes?: string
}

interface PackageOrderWizardProps {
  customers: Customer[]
  onClose: () => void
  onSuccess: (orderData: any) => void
}

interface NewCustomerData {
  firstName: string
  lastName: string
  phone: string
  email: string
  address: {
    street: string
    apartment: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  notes: string
}

interface CustomerAddress {
  id: number
  customerId: number
  street: string
  apartment?: string
  city: string
  state: string
  zipCode: string
  country: string
  notes?: string
  isPrimary: boolean
  createdAt: string
}

const SERVICE_TYPES = [
  { id: 'full-box', name: 'Recogida Caja Llena', icon: Box, description: 'Recogemos tu caja completa' },
  { id: 'box-delivery', name: 'Entrega Caja', icon: Package, description: 'Entregamos una caja vacía' },
  { id: 'durable-pickup', name: 'Recogida de Duradero', icon: Archive, description: 'Recogemos artículos duraderos' }
]

const TIME_SLOTS = [
  { id: 'morning', label: '8:00 AM - 12:00 PM', start: '08:00', end: '12:00', description: 'Mañana' },
  { id: 'afternoon', label: '12:00 PM - 4:00 PM', start: '12:00', end: '16:00', description: 'Tarde' },
  { id: 'evening', label: '4:00 PM - 8:00 PM', start: '16:00', end: '20:00', description: 'Noche' }
]

export function PackageOrderWizard({ customers, onClose, onSuccess }: PackageOrderWizardProps) {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [currentStep, setCurrentStep] = useState(1)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({})
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('')
  const [scheduledDate, setScheduledDate] = useState<string>('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [isScheduledPickup, setIsScheduledPickup] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomer, setNewCustomer] = useState<NewCustomerData>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: {
      street: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    },
    notes: ''
  })

  // State for custom delivery address (when existing customer wants delivery to a different address)
  const [customDeliveryAddress, setCustomDeliveryAddress] = useState({
    street: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    country: ''
  })
  const [useCustomAddress, setUseCustomAddress] = useState(false)

  // State for customer addresses management
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [loadingAddresses, setLoadingAddresses] = useState(false)

  // State for coordinates
  const [customerCoordinates, setCustomerCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)

  // Function to geocode address using Mapbox API
  const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    if (!address || typeof address !== 'string' || address.trim() === '') {
      console.warn('⚠️ Invalid address provided for geocoding:', address)
      return null
    }

    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

      // NO forzar Miami, FL - usar la dirección exacta
      let searchAddress = address.trim()
      searchAddress = searchAddress.replace(/,\s*us$/i, '') // Remover "us" final
      const encodedAddress = encodeURIComponent(searchAddress)

      console.log(`🔍 Geocodificando dirección de cliente existente: "${searchAddress}"`)

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

  // Geocode customer address when customer is selected or changes
  useEffect(() => {
    if (selectedCustomer) {
      const getAddressToGeocode = () => {
        // If using custom address, geocode that
        if (useCustomAddress && customDeliveryAddress.street) {
          return customDeliveryAddress.street
        }

        // If using selected address from customer addresses
        if (selectedAddressId) {
          const selectedAddress = customerAddresses.find(addr => addr.id === selectedAddressId)
          if (selectedAddress?.street) {
            return selectedAddress.street
          }
        }

        // Otherwise, use customer's default address
        if (selectedCustomer.address?.street) {
          return selectedCustomer.address.street
        }

        return null
      }

      const addressToGeocode = getAddressToGeocode()

      if (addressToGeocode) {
        console.log(`🎯 Geocodificando dirección para cliente ${selectedCustomer.firstName} ${selectedCustomer.lastName}: "${addressToGeocode}"`)
        geocodeAddress(addressToGeocode)
          .then(coordinates => {
            if (coordinates) {
              console.log(`✅ Coordenadas obtenidas para ${selectedCustomer.firstName}:`, coordinates)
              setCustomerCoordinates(coordinates)
            } else {
              console.log(`❌ No se pudieron obtener coordenadas para: ${addressToGeocode}`)
              setCustomerCoordinates(null)
            }
          })
          .catch(error => {
            console.error('❌ Error en geocodificación:', error)
            setCustomerCoordinates(null)
          })
      } else {
        console.log(`📍 Sin dirección para geocodificar para cliente ${selectedCustomer.firstName}`)
        setCustomerCoordinates(null)
      }
    }
  }, [selectedCustomer, useCustomAddress, customDeliveryAddress.street, selectedAddressId, customerAddresses])

  // Get available time slots based on current time
  const getAvailableTimeSlots = () => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinutes = now.getMinutes()
    const currentTime = currentHour + currentMinutes / 60

    console.log(`Hora actual: ${currentHour}:${currentMinutes.toString().padStart(2, '0')} (${currentTime.toFixed(2)})`)

    let availableSlots
    // Lógica mejorada basada en hora exacta del navegador
    if (currentTime < 8) {
      // Antes de 8:00 AM - mostrar todos los slots del mismo día
      availableSlots = TIME_SLOTS
      console.log('Antes de 8AM - Mostrando todos los horarios')
    } else if (currentTime >= 8 && currentTime < 12) {
      // 8:00 AM - 12:00 PM - mostrar afternoon y evening del mismo día
      availableSlots = TIME_SLOTS.filter(slot => slot.id === 'afternoon' || slot.id === 'evening')
      console.log('8AM-12PM - Mostrando afternoon y evening')
    } else if (currentTime >= 12 && currentTime < 16) {
      // 12:00 PM - 4:00 PM - mostrar evening del mismo día SOLAMENTE
      availableSlots = TIME_SLOTS.filter(slot => slot.id === 'evening')
      console.log('12PM-4PM - Mostrando SOLAMENTE evening (4-8PM)')
    } else if (currentTime >= 16 && currentTime < 20) {
      // 4:00 PM - 8:00 PM - mostrar todos los slots del día siguiente
      availableSlots = TIME_SLOTS
      console.log('4PM-8PM - Mostrando todos los horarios del día siguiente')
    } else {
      // Después de 8:00 PM - mostrar todos los slots del día siguiente
      availableSlots = TIME_SLOTS
      console.log('Después de 8PM - Mostrando todos los horarios del día siguiente')
    }

    console.log('Horarios disponibles:', availableSlots.map(s => s.label))
    return availableSlots
  }

  // Auto-search customer by phone when 10 digits are entered
  const handlePhoneSearch = async (value: string) => {
    setSearchTerm(value)

    // If exactly 10 digits (US phone format), search automatically
    if (value.length === 10 && /^\d+$/.test(value)) {
      setSearching(true)
      console.log(`Buscando cliente con teléfono: ${value}`)
      try {
        const response = await fetch(`/api/crm/customers?phone=${encodeURIComponent(value)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.data && data.data.length > 0) {
            // Cliente encontrado
            setFoundCustomer(data.data[0])
            setSelectedCustomer(data.data[0])
            resetAddressStates() // Reset address states when finding existing customer
            loadCustomerAddresses(data.data[0].id) // Load customer addresses
            setCurrentStep(2)
            showNotification('success', 'Cliente Encontrado', `Cliente: ${data.data[0].firstName} ${data.data[0].lastName}`)
            console.log('Cliente encontrado:', data.data[0])
          } else {
            // Cliente no encontrado - ir automáticamente a formulario de creación
            console.log('Cliente no encontrado, yendo a formulario de creación')
            setNewCustomer(prev => ({ ...prev, phone: value }))
            setShowNewCustomerForm(true)
            showNotification('info', 'Cliente No Encontrado', 'Por favor complete el formulario para registrar un nuevo cliente')
          }
        }
      } catch (error) {
        console.error('Error auto-searching customer:', error)
        showNotification('error', 'Error de Búsqueda', 'No se pudo buscar el cliente. Intente nuevamente.')
      } finally {
        setSearching(false)
      }
    }
  }

  // Filter customers based on search
  const filteredCustomers = customers.filter(customer => {
    const searchLower = searchTerm.toLowerCase()
    const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase()
    const phone = customer.phone.toLowerCase()

    return fullName.includes(searchLower) || phone.includes(searchLower)
  })

  // Function to load customer addresses
  const loadCustomerAddresses = async (customerId: number) => {
    setLoadingAddresses(true)
    try {
      const response = await fetch(`/api/customer-addresses?customerId=${customerId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCustomerAddresses(data.data || [])
          // Auto-select the primary address
          const primaryAddress = data.data?.find((addr: CustomerAddress) => addr.isPrimary)
          if (primaryAddress) {
            setSelectedAddressId(primaryAddress.id)
          } else if (data.data && data.data.length > 0) {
            // If no primary address, select the first one
            setSelectedAddressId(data.data[0].id)
          }
        }
      }
    } catch (error) {
      console.error('Error loading customer addresses:', error)
    } finally {
      setLoadingAddresses(false)
    }
  }

  // Handle customer selection
  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    resetAddressStates() // Reset address states when selecting existing customer
    loadCustomerAddresses(customer.id) // Load customer addresses
    setCurrentStep(2)
  }

  // Reset custom address states when customer changes
  const resetAddressStates = () => {
    setUseCustomAddress(false)
    setCustomerAddresses([])
    setSelectedAddressId(null)
    setCustomDeliveryAddress({
      street: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    })
  }

  // Handle new customer creation
  const handleCreateCustomer = async () => {
    try {
      // Validate required fields
      if (!newCustomer.firstName || !newCustomer.lastName || !newCustomer.phone || !newCustomer.address.street) {
        showNotification('error', 'Error de Validación', 'Por favor completa los campos requeridos')
        return
      }

      // Create new customer via API
      const response = await fetch('/api/crm/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newCustomer.firstName,
          lastName: newCustomer.lastName,
          phone: newCustomer.phone,
          email: newCustomer.email,
          address: newCustomer.address,
          notes: newCustomer.notes
        })
      })

      if (response.ok) {
        const createdCustomer = await response.json()
        setSelectedCustomer(createdCustomer.data)
        setShowNewCustomerForm(false)
        setCurrentStep(2)
        showNotification('success', 'Cliente Creado', 'El cliente ha sido creado exitosamente')
      } else {
        throw new Error('Error creating customer')
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      showNotification('error', 'Error', 'No se pudo crear el cliente')
    }
  }

  // Handle service selection
  const toggleService = (serviceName: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceName)
        ? prev.filter(s => s !== serviceName)
        : [...prev, serviceName]
    )

    // Initialize quantity to 1 when service is selected
    if (!selectedServices.includes(serviceName)) {
      setServiceQuantities(prev => ({
        ...prev,
        [serviceName]: 1
      }))
    } else {
      // Remove quantity when service is deselected
      setServiceQuantities(prev => {
        const newQuantities = { ...prev }
        delete newQuantities[serviceName]
        return newQuantities
      })
    }
  }

  // Handle service quantity change
  const updateServiceQuantity = (serviceName: string, quantity: number) => {
    if (quantity <= 0) return
    setServiceQuantities(prev => ({
      ...prev,
      [serviceName]: quantity
    }))
  }

  // Handle form submission
  const handleSubmit = () => {
    if (!selectedCustomer || selectedServices.length === 0) {
      showNotification('error', 'Error', 'Por favor completa todos los campos requeridos')
      return
    }

    // Validate that we have a delivery address
    let hasValidAddress = false
    if (showNewCustomerForm) {
      hasValidAddress = newCustomer.address.street.trim() !== ''
    } else if (useCustomAddress) {
      hasValidAddress = customDeliveryAddress.street.trim() !== ''
    } else {
      // Check if we have a selected address from customer addresses
      const selectedAddress = customerAddresses.find(addr => addr.id === selectedAddressId)
      hasValidAddress = selectedAddress?.street?.trim() !== '' || selectedCustomer.address?.street?.trim() !== ''
    }

    if (!hasValidAddress) {
      showNotification('error', 'Error', 'Por favor ingresa una dirección de entrega válida')
      return
    }

    // Generate order number
    const random = Math.floor(Math.random() * 900000) + 100000  // Número aleatorio de 6 dígitos (100000-999999)
    const orderNumber = `PACK${random}`

    const servicesWithQuantities = selectedServices.map(service => ({
      name: service,
      quantity: serviceQuantities[service] || 1
    }))

    // Determine the correct delivery address
    let deliveryAddress = ''

    // If it's a new customer, use the new customer address
    if (showNewCustomerForm) {
      deliveryAddress = newCustomer.address.street
    }
    // If it's an existing customer but wants delivery to a different address
    else if (useCustomAddress && customDeliveryAddress.street) {
      deliveryAddress = customDeliveryAddress.street
    }
    // If it's an existing customer, use the selected address from their addresses
    else if (selectedAddressId) {
      const selectedAddress = customerAddresses.find(addr => addr.id === selectedAddressId)
      if (selectedAddress) {
        deliveryAddress = selectedAddress.street
      }
    }
    // Fallback to customer's default address
    else {
      deliveryAddress = selectedCustomer.address?.street || ''
    }

    const orderData = {
      orderNumber: orderNumber,
      customerId: selectedCustomer.id,
      customerName: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`,
      customerAddress: deliveryAddress,
      services: selectedServices,
      serviceQuantities: servicesWithQuantities,
      notes: deliveryNote,
      scheduledDate: scheduledDate || null,
      timeSlot: selectedTimeSlot || null,
      status: scheduledDate ? 'scheduled' : 'pending',
      latitude: customerCoordinates?.latitude || null,
      longitude: customerCoordinates?.longitude || null
    }

    console.log('Enviando orden:', orderData)
    onSuccess(orderData)
  }

  // Get current date for min date in calendar
  const getMinDate = () => {
    const now = new Date()
    const currentHour = now.getHours()

    // If between 4 PM and 8 PM, allow next day
    if (currentHour >= 16 && currentHour < 20) {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow.toISOString().split('T')[0]
    }

    return now.toISOString().split('T')[0]
  }

  const availableTimeSlots = getAvailableTimeSlots()

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-start z-50 p-4 pl-80"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={cn(
            'w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={cn(
            'flex items-center justify-between p-6 border-b',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Nueva Orden de Paquetería
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Paso {currentStep} de 3: {currentStep === 1 ? 'Seleccionar Cliente' : currentStep === 2 ? 'Servicios' : 'Programación'}
              </p>
            </div>
            <button
              onClick={onClose}
              className={cn(
                'p-2 rounded-lg transition-colors',
                'hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    currentStep >= step
                      ? 'bg-exa-primary text-white'
                      : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'
                  )}>
                    {currentStep > step ? <Check className="w-5 h-5" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={cn(
                      'w-20 h-1 mx-2 transition-colors',
                      currentStep > step ? 'bg-exa-primary' : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Step 1: Customer Selection */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {!showNewCustomerForm ? (
                  <>
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="tel"
                        placeholder="Ingresa número de teléfono (10 dígitos)..."
                        value={searchTerm}
                        onChange={(e) => handlePhoneSearch(e.target.value)}
                        className={cn(
                          'w-full pl-10 pr-4 py-3 rounded-lg border transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                      {searching && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Loader2 className="w-5 h-5 text-exa-primary animate-spin" />
                        </div>
                      )}
                      {searchTerm.length === 10 && !searching && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <Check className="w-5 h-5 text-green-600" />
                        </div>
                      )}
                    </div>

                    {/* New Customer Button */}
                    <button
                      onClick={() => setShowNewCustomerForm(true)}
                      className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-exa-primary transition-colors group"
                    >
                      <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 group-hover:text-exa-primary dark:group-hover:text-exa-primary">
                        <Plus className="w-5 h-5" />
                        <span>Registrar Nuevo Cliente</span>
                      </div>
                    </button>

                    {/* Customer List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <motion.button
                          key={customer.id}
                          onClick={() => handleCustomerSelect(customer)}
                          className={cn(
                            'w-full p-4 rounded-lg border text-left transition-all',
                            'hover:border-exa-primary hover:shadow-md',
                            theme === 'dark'
                              ? 'border-gray-700 hover:bg-gray-700'
                              : 'border-gray-200 hover:bg-gray-50'
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {customer.firstName} {customer.lastName}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <Phone className="w-3 h-3" />
                                  {customer.phone}
                                </div>
                                {customer.email && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <Mail className="w-3 h-3" />
                                    {customer.email}
                                  </div>
                                )}
                                {customer.address?.street && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <MapPin className="w-3 h-3" />
                                    {customer.address.street}
                                  </div>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </div>
                        </motion.button>
                      ))}

                      {filteredCustomers.length === 0 && searchTerm && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          No se encontraron clientes con "{searchTerm}"
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* New Customer Form */
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Nuevo Cliente
                      </h3>
                      <button
                        onClick={() => setShowNewCustomerForm(false)}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Nombre *
                        </label>
                        <input
                          type="text"
                          value={newCustomer.firstName}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, firstName: e.target.value }))}
                          className={cn(
                            'w-full px-3 py-2 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Apellido *
                        </label>
                        <input
                          type="text"
                          value={newCustomer.lastName}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, lastName: e.target.value }))}
                          className={cn(
                            'w-full px-3 py-2 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Teléfono *
                        </label>
                        <input
                          type="tel"
                          value={newCustomer.phone}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                          className={cn(
                            'w-full px-3 py-2 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Email
                        </label>
                        <input
                          type="email"
                          value={newCustomer.email}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                          className={cn(
                            'w-full px-3 py-2 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Dirección *
                      </label>
                      <MapboxAddressAutofill
                        value={newCustomer.address}
                        onChange={(value) => setNewCustomer(prev => ({
                          ...prev,
                          address: value
                        }))}
                        onCoordinatesChange={(coordinates) => {
                          console.log('🔥 Customer coordinates updated:', coordinates)
                          setCustomerCoordinates(coordinates)
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notas
                      </label>
                      <textarea
                        value={newCustomer.notes}
                        onChange={(e) => setNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        className={cn(
                          'w-full px-3 py-2 rounded-lg border transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>

                    <button
                      onClick={handleCreateCustomer}
                      className="w-full py-3 bg-exa-primary hover:bg-exa-primary/90 text-white rounded-lg font-medium transition-colors"
                    >
                      Crear Cliente
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Service Selection */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Customer Information */}
                {selectedCustomer && (
                  <div className={cn(
                    'p-4 rounded-lg border space-y-4',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-700'
                      : 'bg-gray-50 border-gray-200'
                  )}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">Información del Cliente</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <User className="w-4 h-4" />
                        {selectedCustomer.firstName} {selectedCustomer.lastName}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Phone */}
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-300">{selectedCustomer.phone}</span>
                      </div>

                      {/* Email */}
                      {selectedCustomer.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700 dark:text-gray-300">{selectedCustomer.email}</span>
                        </div>
                      )}

                      {/* Address Selection */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dirección de Entrega:</span>
                        </div>

                        {/* Customer Addresses */}
                        {loadingAddresses ? (
                          <div className="text-sm text-gray-500 dark:text-gray-400 p-3">
                            Cargando direcciones...
                          </div>
                        ) : customerAddresses.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                              Seleccionar Dirección de Entrega
                            </div>
                            {customerAddresses.map((address) => (
                              <div
                                key={address.id}
                                className={cn(
                                  'p-3 rounded-lg border',
                                  selectedAddressId === address.id && !useCustomAddress
                                    ? 'border-exa-primary bg-exa-primary/5 dark:bg-exa-primary/10'
                                    : 'border-gray-200 dark:border-gray-700'
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <input
                                    type="radio"
                                    id={`address-${address.id}`}
                                    name="addressOption"
                                    checked={selectedAddressId === address.id && !useCustomAddress}
                                    onChange={() => {
                                      setSelectedAddressId(address.id)
                                      setUseCustomAddress(false)
                                    }}
                                    className="mt-1 w-4 h-4 text-exa-primary border-gray-300 focus:ring-exa-primary"
                                  />
                                  <div className="flex-1">
                                    <label htmlFor={`address-${address.id}`} className="cursor-pointer">
                                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">
                                        {address.isPrimary && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-exa-primary text-white mr-2">
                                            Principal
                                          </span>
                                        )}
                                        Dirección #{customerAddresses.indexOf(address) + 1}
                                      </div>
                                      <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {address.street}
                                        {address.apartment && `, ${address.apartment}`}
                                        {address.city && `, ${address.city}`}
                                        {address.state && `, ${address.state}`}
                                        {address.zipCode && ` ${address.zipCode}`}
                                      </div>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          /* Fallback to default address if no addresses loaded */
                          selectedCustomer.address?.street && (
                            <div className={cn(
                              'p-3 rounded-lg border',
                              !useCustomAddress ? 'border-exa-primary bg-exa-primary/5 dark:bg-exa-primary/10' : 'border-gray-200 dark:border-gray-700'
                            )}>
                              <div className="flex items-start gap-3">
                                <input
                                  type="radio"
                                  id="defaultAddress"
                                  name="addressOption"
                                  checked={!useCustomAddress}
                                  onChange={() => {
                                    setUseCustomAddress(false)
                                    setSelectedAddressId(null)
                                    // Reset custom address
                                    setCustomDeliveryAddress({
                                      street: '',
                                      apartment: '',
                                      city: '',
                                      state: '',
                                      zipCode: '',
                                      country: ''
                                    })
                                  }}
                                  className="mt-1 w-4 h-4 text-exa-primary border-gray-300 focus:ring-exa-primary"
                                />
                                <div className="flex-1">
                                  <label htmlFor="defaultAddress" className="cursor-pointer">
                                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">
                                      Dirección Predeterminada
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      {selectedCustomer.address?.street || 'No hay dirección guardada'}
                                      {selectedCustomer.address?.apartment && `, ${selectedCustomer.address.apartment}`}
                                      {selectedCustomer.address?.city && `, ${selectedCustomer.address.city}`}
                                      {selectedCustomer.address?.state && `, ${selectedCustomer.address.state}`}
                                      {selectedCustomer.address?.zipCode && ` ${selectedCustomer.address.zipCode}`}
                                    </div>
                                  </label>
                                </div>
                              </div>
                            </div>
                          )
                        )}

                        {/* Custom Address Option */}
                        <div className={cn(
                          'p-3 rounded-lg border',
                          useCustomAddress ? 'border-exa-primary bg-exa-primary/5 dark:bg-exa-primary/10' : 'border-gray-200 dark:border-gray-700'
                        )}>
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              id="customAddress"
                              name="addressOption"
                              checked={useCustomAddress}
                              onChange={() => setUseCustomAddress(true)}
                              className="mt-1 w-4 h-4 text-exa-primary border-gray-300 focus:ring-exa-primary"
                            />
                            <div className="flex-1">
                              <label htmlFor="customAddress" className="cursor-pointer">
                                <div className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">
                                  Usar Dirección Diferente
                                </div>
                              </label>

                              {useCustomAddress && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="space-y-2"
                                >
                                  <MapboxAddressAutofill
                                    value={customDeliveryAddress}
                                    onChange={(value) => setCustomDeliveryAddress(value)}
                                    onCoordinatesChange={(coordinates) => {
                                      console.log('🔥 Custom address coordinates updated:', coordinates)
                                      setCustomerCoordinates(coordinates)
                                    }}
                                  />
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Selecciona los Servicios
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    El cliente puede necesitar múltiples servicios
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {SERVICE_TYPES.map((service) => (
                    <motion.button
                      key={service.id}
                      onClick={() => toggleService(service.name)}
                      className={cn(
                        'p-6 rounded-lg border-2 transition-all',
                        selectedServices.includes(service.name)
                          ? 'border-exa-primary bg-exa-primary/10 dark:bg-exa-primary/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                      )}
                    >
                      <service.icon className={cn(
                        'w-8 h-8 mx-auto mb-3',
                        selectedServices.includes(service.name)
                          ? 'text-exa-primary dark:text-exa-primary'
                          : 'text-gray-400'
                      )} />
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {service.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {service.description}
                      </p>
                      {selectedServices.includes(service.name) && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-center">
                            <Check className="w-5 h-5 text-exa-primary" />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                              Cantidad:
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="99"
                              value={serviceQuantities[service.name] || 1}
                              onChange={(e) => updateServiceQuantity(service.name, parseInt(e.target.value) || 1)}
                              className={cn(
                                'w-16 px-2 py-1 text-xs rounded border transition-colors',
                                'focus:outline-none focus:ring-1 focus:ring-exa-primary',
                                theme === 'dark'
                                  ? 'bg-gray-700 border-gray-600 text-white'
                                  : 'bg-white border-gray-300 text-gray-900'
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notas para el Repartidor
                  </label>
                  <textarea
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    placeholder="Instrucciones especiales para el repartidor..."
                    rows={4}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    )}
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3: Scheduling */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Programación de Recogida
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Selecciona cuando deseas programar la recogida
                  </p>
                </div>

                {/* Time Slots */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Horarios Disponibles para Hoy
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {availableTimeSlots.map((slot) => (
                      <motion.button
                        key={slot.id}
                        onClick={() => {
                          setSelectedTimeSlot(slot.id)
                          // Set today's date when selecting a time slot
                          setScheduledDate(new Date().toISOString().split('T')[0])
                        }}
                        className={cn(
                          'p-4 rounded-lg border-2 transition-all',
                          selectedTimeSlot === slot.id
                            ? 'border-exa-primary bg-exa-primary/10 dark:bg-exa-primary/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}
                      >
                        <Clock className={cn(
                          'w-6 h-6 mx-auto mb-2',
                          selectedTimeSlot === slot.id
                            ? 'text-exa-primary dark:text-exa-primary'
                            : 'text-gray-400'
                        )} />
                        <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {slot.label}
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {slot.description}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Scheduled Pickup */}
                <div className={cn(
                  'p-6 rounded-lg border-2 border-dashed',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-6 h-6 text-exa-primary dark:text-exa-primary" />
                      <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Programar Recogida Futura
                      </h4>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isScheduledPickup}
                        onChange={(e) => {
                          setIsScheduledPickup(e.target.checked)
                          if (!e.target.checked) {
                            // Reset to today when unchecking
                            setScheduledDate(new Date().toISOString().split('T')[0])
                          }
                        }}
                        className="w-4 h-4 text-exa-primary bg-gray-100 border-gray-300 rounded focus:ring-exa-primary dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Activar
                      </span>
                    </label>
                  </div>

                  {isScheduledPickup && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha de Recogida
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={getMinDate()}
                        className={cn(
                          'w-full px-3 py-2 rounded-lg border transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Hora de Recogida
                      </label>
                      <input
                        type="time"
                        value={selectedTimeSlot ? TIME_SLOTS.find(s => s.id === selectedTimeSlot)?.start : ''}
                        onChange={(e) => {
                          // Find matching time slot or set custom time
                          const matchingSlot = TIME_SLOTS.find(s => s.start === e.target.value)
                          if (matchingSlot) {
                            setSelectedTimeSlot(matchingSlot.id)
                          }
                        }}
                        min="08:00"
                        max="20:00"
                        className={cn(
                          'w-full px-3 py-2 rounded-lg border transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                      </div>
                    </div>
                    </motion.div>
                  )}
                </div>

                {/* Order Summary */}
                <div className={cn(
                  'p-6 rounded-lg border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-900/20' : 'border-gray-200 bg-gray-50'
                )}>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Resumen de la Orden</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Cliente:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {selectedCustomer?.firstName} {selectedCustomer?.lastName}
                      </span>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Servicios:</span>
                      </div>
                      <div className="space-y-1">
                        {selectedServices.map((service, index) => (
                          <div key={index} className="flex justify-between text-xs">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              • {service}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">
                              Cantidad: {serviceQuantities[service] || 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {scheduledDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Fecha:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {new Date(scheduledDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {selectedTimeSlot && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Horario:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {TIME_SLOTS.find(s => s.id === selectedTimeSlot)?.label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className={cn(
            'flex items-center justify-between p-6 border-t',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className={cn(
                    'px-4 py-2 rounded-lg border transition-colors flex items-center gap-2',
                    theme === 'dark'
                      ? 'border-gray-600 hover:bg-gray-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  )}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className={cn(
                  'px-4 py-2 rounded-lg border transition-colors',
                  theme === 'dark'
                    ? 'border-gray-600 hover:bg-gray-700'
                    : 'border-gray-300 hover:bg-gray-50'
                )}
              >
                Cancelar
              </button>

              {currentStep < 3 ? (
                <button
                  onClick={() => {
                    if (currentStep === 1 && selectedCustomer) {
                      setCurrentStep(2)
                    } else if (currentStep === 2 && selectedServices.length > 0) {
                      setCurrentStep(3)
                    } else {
                      showNotification('error', 'Error', 'Por favor completa los campos requeridos')
                    }
                  }}
                  className="px-4 py-2 bg-exa-primary hover:bg-exa-primary/90 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Crear Orden
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}