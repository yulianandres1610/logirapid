'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Phone,
  Search,
  User,
  MapPin,
  Mail,
  Package,
  Box,
  Archive,
  DollarSign,
  Calendar,
  Clock,
  AlertCircle,
  Check,
  Plus,
  Home,
  Building,
  MessageSquare,
  Loader2,
  Download,
  Printer,
  Smartphone,
  CheckCircle,
  MailIcon,
  Receipt,
  Send,
  FileText,
  X,
  Star,
  Trash2,
  Shield,
  Ruler,
  ChevronRight,
  Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import MapboxAddressAutofill from '@/components/ui/MapboxAddressAutofill'
import { BoxRecipientManager } from '@/components/services/BoxRecipientManager'

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

interface CreatedOrder {
  id: number
  orderNumber: string
  customerName: string
  services: string[]
  scheduledDate?: string
  timeSlot?: string
  total: number
}

interface BoxItem {
  id: string
  size: 'pequeno' | 'mediano' | 'grande'
  quantity: number
  recipient: Customer | null
  recipientSearchTerm: string
  isNewRecipient: boolean
  newRecipientData: {
    firstName: string
    lastName: string
    phone: string
    email: string
  } | null
  packageCodes: string[]
  needsConstruction: boolean
}

interface OrderData {
  customerId?: number
  customerName?: string
  customerAddress?: string
  customerAddressObject?: {
    street: string
    apartment: string
    city: string
    state: string
    zipCode: string
    country: string
  } | null
  services: string[]
  serviceQuantities: { [serviceName: string]: number }
  needsBoxConstruction: { [serviceName: string]: boolean }
  boxSizes: { [serviceName: string]: string | undefined }
  boxSelections: { [serviceName: string]: Array<{size: string, quantity: number, needsConstruction: boolean}> }
  paymentMethod: 'cash_on_delivery' | 'credit_debit'
  notes?: string
  scheduledDate?: string
  timeSlot?: string
  status: string
  // Financial fields needed by database
  subtotal?: number
  taxAmount?: number
  totalAmount?: number
  boxCount?: number
  boxPrice?: number
  additionalServices?: string
  createdBy?: string
}

const SERVICE_TYPES = [
  { id: 'full-box', name: 'Recogida Caja Llena', icon: Box, description: 'Recogemos tu caja completamente llena sin importar el peso o contenido' },
  { id: 'box-delivery', name: 'Entrega de Caja', icon: Package, description: 'Entregamos caja vacía en tu domicilio para que la prepares a tu gusto' },
  { id: 'durable-pickup', name: 'Recogida de Duradero', icon: Archive, description: 'Recogemos tus artículos duraderos directamente en la comodidad de tu hogar' }
]

const BOX_SIZES = [
  { id: 'small', name: 'Pequeña', description: 'Ideal para documentos pequeños', dimensions: '12" x 9" x 4"', price: 45, icon: '📦' },
  { id: 'medium', name: 'Mediana', description: 'Perfecta para artículos medianos', dimensions: '18" x 12" x 6"', price: 55, icon: '📋' },
  { id: 'large', name: 'Grande', description: 'Espaciosa para artículos grandes', dimensions: '24" x 18" x 8"', price: 65, icon: '📚' }
]

const BOX_SIZE_PRICES: { [key: string]: number } = {
  'small': 45,
  'medium': 55,
  'large': 65
}

const BOX_CONSTRUCTION_COST = 5

const TIME_SLOTS = [
  { id: 'morning', label: '8:00 AM - 12:00 PM', start: '08:00', end: '12:00', description: 'Mañana' },
  { id: 'afternoon', label: '12:00 PM - 4:00 PM', start: '12:00', end: '16:00', description: 'Tarde' },
  { id: 'evening', label: '4:00 PM - 8:00 PM', start: '16:00', end: '20:00', description: 'Noche' }
]

export default function CreatePackageOrderPage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { showNotification } = useNotifications()
  const router = useRouter()

  const [step, setStep] = useState<'search' | 'found' | 'new-customer' | 'services' | 'scheduling' | 'confirmation'>('search')
  const [loading, setLoading] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [searching, setSearching] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null)
  const [orderData, setOrderData] = useState<OrderData>({
    services: [], // No default service selection
    serviceQuantities: {},
    needsBoxConstruction: {},
    boxSizes: {},
    boxSelections: {},
    paymentMethod: 'cash_on_delivery',
    status: 'pending'
  })

  // Box size selection modal state
  const [showSizeModal, setShowSizeModal] = useState(false)
  const [selectedServiceForSize, setSelectedServiceForSize] = useState<string | null>(null)
  const [tempSelectedSize, setTempSelectedSize] = useState<string>('medium')
  const [tempBoxSelections, setTempBoxSelections] = useState<Array<{size: string, quantity: number, needsConstruction: boolean}>>([])

  // Address selection state
  const [addressOption, setAddressOption] = useState<'same' | 'new' | 'existing'>('existing')
  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [newAddress, setNewAddress] = useState({
    street: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    notes: ''
  })

  // Coordinates state for mapping
  const [customerCoordinates, setCustomerCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)

  // Boxes state for individual box management
  const [boxes, setBoxes] = useState<BoxItem[]>([])
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null)
  const [searchingRecipient, setSearchingRecipient] = useState<{ [boxId: string]: boolean }>({})
  const [recipientSearchResults, setRecipientSearchResults] = useState<{ [boxId: string]: Customer[] }>({})

  // New customer form state
  const [newCustomer, setNewCustomer] = useState({
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

  // Get available time slots based on current time
  const getAvailableTimeSlots = () => {
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinutes = now.getMinutes()
    const currentTime = currentHour + currentMinutes / 60

    // If before 12:00 PM, show afternoon and evening of same day
    if (currentTime < 12) {
      return TIME_SLOTS.filter(slot => slot.id === 'afternoon' || slot.id === 'evening')
    }
    // If between 4:00 PM and 8:00 PM, show all slots for next day
    else if (currentTime >= 16 && currentTime < 20) {
      return TIME_SLOTS
    }
    // Otherwise, show all available slots
    else {
      return TIME_SLOTS
    }
  }

  // Search customer by phone
  const handleSearchCustomer = async () => {
    if (!phoneNumber.trim()) {
      showNotification('error', 'Error', 'Por favor ingresa un número de teléfono')
      return
    }

    setSearching(true)
    try {
      const response = await fetch(`/api/crm/customers?phone=${encodeURIComponent(phoneNumber.trim())}`)
      if (response.ok) {
        const data = await response.json()
        if (data.data && data.data.length > 0) {
          setFoundCustomer(data.data[0])
          setStep('found')
        } else {
          setNewCustomer(prev => ({ ...prev, phone: phoneNumber.trim() }))
          setStep('new-customer')
        }
      } else {
        throw new Error('Error searching customer')
      }
    } catch (error) {
      console.error('Error searching customer:', error)
      showNotification('error', 'Error', 'No se pudo buscar el cliente')
    } finally {
      setSearching(false)
    }
  }

  // Helper function to format address as string
  const formatAddressString = (address: any) => {
    if (!address) return ''

    if (typeof address === 'string') {
      return address
    }

    return `${address.street || ''}${address.apartment ? ' ' + address.apartment : ''}${address.city ? ', ' + address.city : ''}${address.state ? ', ' + address.state : ''}${address.zipCode ? ' ' + address.zipCode : ''}${address.country ? ', ' + address.country : ''}`.replace(/^[,\s]+|[,\s]+$/g, '')
  }

  // Function to get the correct address based on selection
  const getAddressForOrder = (customer: Customer | null) => {
    if (!customer) return ''

    switch (addressOption) {
      case 'same':
        return formatAddressString(customer.address)
      case 'existing':
        return formatAddressString(selectedAddress) || formatAddressString(customer.address)
      case 'new':
        return formatAddressString(newAddress)
      default:
        return formatAddressString(customer.address)
    }
  }

  // Function to get the complete address object for saving
  const getCompleteAddressForOrder = (customer: Customer | null) => {
    if (!customer) return null

    switch (addressOption) {
      case 'same':
        return customer.address || null
      case 'existing':
        return selectedAddress || customer.address || null
      case 'new':
        return newAddress.street ? newAddress : null
      default:
        return customer.address || null
    }
  }

  // Function to geocode address using Mapbox API
  const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    if (!address || typeof address !== 'string' || address.trim() === '') {
      console.warn('⚠️ Invalid address provided for geocoding:', address)
      return null
    }

    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

      // NO forzar Miami, FL - usar dirección exacta
      let searchAddress = address.trim()
      searchAddress = searchAddress.replace(/,\s*us$/i, '') // Remover "us" final
      const encodedAddress = encodeURIComponent(searchAddress)

      console.log(`🔍 Geocodificando dirección en creación de orden: "${searchAddress}"`)

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

  // Geocode address whenever it changes
  useEffect(() => {
    const getCurrentAddress = () => {
      if (!foundCustomer) return null

      switch (addressOption) {
        case 'new':
          return formatAddressString(newAddress)
        case 'existing':
          if (selectedAddress) {
            return formatAddressString(selectedAddress)
          }
          return formatAddressString(foundCustomer.address)
        case 'same':
        default:
          return formatAddressString(foundCustomer.address)
      }
    }

    const address = getCurrentAddress()

    if (address && address.trim() !== '') {
      console.log(`🎯 Geocodificando dirección actual: "${address}"`)
      geocodeAddress(address)
        .then(coordinates => {
          if (coordinates) {
            console.log(`✅ Coordenadas obtenidas:`, coordinates)
            setCustomerCoordinates(coordinates)
          } else {
            console.log(`❌ No se pudieron obtener coordenadas para: ${address}`)
            setCustomerCoordinates(null)
          }
        })
        .catch(error => {
          console.error('❌ Error en geocodificación:', error)
          setCustomerCoordinates(null)
        })
    } else {
      console.log(`📍 Sin dirección para geocodificar`)
      setCustomerCoordinates(null)
    }
  }, [foundCustomer, addressOption, selectedAddress, newAddress])

  // Handle found customer selection
  const handleSelectCustomer = async () => {
    if (foundCustomer) {
      console.log('=== handleSelectCustomer DEBUG ===')
      console.log('addressOption:', addressOption)
      console.log('selectedAddress:', selectedAddress)
      console.log('newAddress:', newAddress)
      console.log('foundCustomer.address:', foundCustomer.address)
      console.log('customerAddresses available:', customerAddresses.length)

      let addressToUse = ''
      let addressObjectToUse: any = null

      // Strict validation for address selection
      if (addressOption === 'existing') {
        if (!selectedAddress) {
          showNotification('error', 'Error de Selección', 'Por favor selecciona una dirección existente o elige otra opción')
          return
        }
        // Use the selected existing address
        addressToUse = formatAddressString(selectedAddress)
        addressObjectToUse = selectedAddress
        console.log('✅ Using existing address:', addressToUse)

        // Save the address selection to customer's address book if needed
        await saveAddressToCustomer(foundCustomer.id)
      } else if (addressOption === 'new') {
        if (!newAddress.street || !newAddress.city) {
          showNotification('error', 'Error de Validación', 'Por favor completa la calle y la ciudad para la nueva dirección')
          return
        }
        // Use the new address
        addressToUse = formatAddressString(newAddress)
        addressObjectToUse = newAddress
        console.log('✅ Using new address:', addressToUse)

        // Save the new address to customer's address book
        await saveAddressToCustomer(foundCustomer.id)
      } else if (addressOption === 'same') {
        // Warning if there are other addresses available
        if (customerAddresses.length > 0) {
          console.log('⚠️  User chose primary address despite having', customerAddresses.length, 'other addresses available')
        }
        // Use primary address
        addressToUse = formatAddressString(foundCustomer.address)
        addressObjectToUse = foundCustomer.address
        console.log('✅ Using primary address:', addressToUse)
      } else {
        // This should not happen with proper UI validation
        console.error('❌ Invalid address option:', addressOption)
        showNotification('error', 'Error', 'Opción de dirección inválida')
        return
      }

      console.log('🎯 Final address to be used in order:', addressToUse)
      console.log('🎯 Final address object:', addressObjectToUse)
      console.log('==========================')

      setOrderData(prev => ({
        ...prev,
        customerId: foundCustomer.id,
        customerName: `${foundCustomer.firstName} ${foundCustomer.lastName}`,
        customerAddress: addressToUse,
        customerAddressObject: addressObjectToUse
      }))
      setStep('services')
    }
  }

  // Create new customer
  const handleCreateCustomer = async () => {
    try {
      // Validate required fields
      if (!newCustomer.firstName || !newCustomer.lastName || !newCustomer.phone || !newCustomer.address.street) {
        showNotification('error', 'Error de Validación', 'Por favor completa los campos requeridos')
        return
      }

      setLoading(true)
      const response = await fetch('/api/crm/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      })

      if (response.ok) {
        const createdCustomer = await response.json()
        const completeAddress = formatAddressString(createdCustomer.data.address)
        console.log('=== handleCreateCustomer DEBUG ===')
        console.log('Created customer address:', createdCustomer.data.address)
        console.log('Formatted complete address:', completeAddress)
        console.log('==================================')

        setOrderData(prev => ({
          ...prev,
          customerId: createdCustomer.data.id,
          customerName: `${createdCustomer.data.firstName} ${createdCustomer.data.lastName}`,
          customerAddress: completeAddress,
          customerAddressObject: createdCustomer.data.address
        }))
        setStep('services')
        showNotification('success', 'Cliente Creado', 'El cliente ha sido creado exitosamente')
      } else {
        throw new Error('Error creating customer')
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      showNotification('error', 'Error', 'No se pudo crear el cliente')
    } finally {
      setLoading(false)
    }
  }

  // Toggle service selection
  const toggleService = (serviceName: string) => {
    const isBoxService = serviceName.toLowerCase().includes('caja') || serviceName.toLowerCase().includes('box')

    setOrderData(prev => {
      const isSelected = prev.services.includes(serviceName)

      if (isSelected) {
        // If unselecting, remove the service
        return {
          ...prev,
          services: prev.services.filter(s => s !== serviceName),
          serviceQuantities: {
            ...prev.serviceQuantities,
            [serviceName]: 0
          },
          boxSizes: {
            ...prev.boxSizes,
            [serviceName]: undefined
          }
        }
      } else {
        // If selecting a box service, show size modal first
        if (isBoxService) {
          setSelectedServiceForSize(serviceName)
          setTempSelectedSize('medium')
          setShowSizeModal(true)
        }

        return {
          ...prev,
          services: [...prev.services, serviceName],
          serviceQuantities: {
            ...prev.serviceQuantities,
            [serviceName]: prev.serviceQuantities[serviceName] || 1
          },
          boxSizes: {
            ...prev.boxSizes,
            [serviceName]: isBoxService ? (prev.boxSizes[serviceName] || 'medium') : undefined
          }
        }
      }
    })
  }

  const updateServiceQuantity = (serviceName: string, quantity: number) => {
    if (quantity < 0) return
    setOrderData(prev => ({
      ...prev,
      serviceQuantities: {
        ...prev.serviceQuantities,
        [serviceName]: quantity
      }
    }))
  }

  // Toggle box construction
  const toggleBoxConstruction = (serviceName: string) => {
    setOrderData(prev => ({
      ...prev,
      needsBoxConstruction: {
        ...prev.needsBoxConstruction,
        [serviceName]: !prev.needsBoxConstruction[serviceName]
      }
    }))
  }

  // Update order address when address option changes (only if not using wizard address)
  useEffect(() => {
    if (foundCustomer && !orderData.customerAddress) {
      const addressObject = getCompleteAddressForOrder(foundCustomer)
      setOrderData(prev => ({
        ...prev,
        customerAddress: getAddressForOrder(foundCustomer),
        customerAddressObject: addressObject
      }))
    }
  }, [addressOption, selectedAddress, newAddress.street, foundCustomer])

  // Load customer addresses when customer is found
  useEffect(() => {
    if (foundCustomer && step === 'found') {
      loadCustomerAddresses(foundCustomer.id)
    }
  }, [foundCustomer, step])

  // Force address selection when customer addresses are loaded
  useEffect(() => {
    if (customerAddresses.length > 0) {
      // Always force user to select from existing addresses
      setAddressOption('existing')
      if (customerAddresses.length === 1) {
        // If only one address, auto-select it
        setSelectedAddress(customerAddresses[0])
      } else if (customerAddresses.length > 1) {
        // If multiple addresses, clear selection to force user choice
        setSelectedAddress(null)
      }
    } else {
      // Only fall back to 'same' if no saved addresses exist
      setAddressOption('same')
    }
  }, [customerAddresses])

  // Function to load customer addresses
  const loadCustomerAddresses = async (customerId: number) => {
    setLoadingAddresses(true)
    try {
      const response = await fetch(`/api/customer-addresses?customerId=${customerId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCustomerAddresses(data.data || [])
        }
      }
    } catch (error) {
      console.error('Error loading customer addresses:', error)
    } finally {
      setLoadingAddresses(false)
    }
  }

  // Delete customer address
  const deleteCustomerAddress = async (addressId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta dirección? Esta acción no se puede deshacer.')) {
      return
    }

    try {
      const response = await fetch(`/api/customer-addresses?id=${addressId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          showNotification('success', 'Dirección Eliminada', 'La dirección ha sido eliminada exitosamente')

          // Recargar direcciones del cliente
          if (foundCustomer?.id) {
            await loadCustomerAddresses(foundCustomer.id)
          }

          // Si la dirección eliminada estaba seleccionada, resetear selección
          if (selectedAddress?.id === addressId) {
            setSelectedAddress(null)
            setAddressOption('same')
          }
        } else {
          showNotification('error', 'Error', data.error || 'No se pudo eliminar la dirección')
        }
      } else {
        const errorData = await response.json()
        showNotification('error', 'Error', errorData.error || 'No se pudo eliminar la dirección')
      }
    } catch (error) {
      console.error('Error deleting address:', error)
      showNotification('error', 'Error de conexión', 'No se pudo conectar con el servidor')
    }
  }

  // Save address to customer record for future recognition
  const saveAddressToCustomer = async (customerId: number) => {
    try {
      let addressToSave = null

      if (addressOption === 'new' && newAddress.street) {
        addressToSave = newAddress
      } else if (addressOption === 'existing' && selectedAddress) {
        // For existing addresses, we already have it in the system
        return
      }

      if (addressToSave && addressToSave.street) {
        // Save to customer_addresses table using the new API
        const response = await fetch('/api/customer-addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customerId,
            street: addressToSave.street,
            apartment: addressToSave.apartment,
            city: addressToSave.city,
            state: addressToSave.state,
            zipCode: addressToSave.zipCode,
            country: addressToSave.country || 'Estados Unidos',
            notes: addressToSave.notes,
            isPrimary: false
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            showNotification('success', 'Dirección Guardada', 'La nueva dirección ha sido guardada para futuros envíos')
            // Reload addresses to show the newly added one
            loadCustomerAddresses(customerId)
          }
        } else {
          console.error('Error saving address to customer record')
        }
      }
    } catch (error) {
      console.error('Error saving address to customer:', error)
    }
  }

  // Handle final order submission
  const handleSubmitOrder = async () => {
    try {
      // Enhanced validation with detailed logging
      console.log('Submitting order with current data:', orderData)

      if (!orderData.customerId) {
        console.error('Missing customerId:', orderData.customerId)
        showNotification('error', 'Error', 'Falta el ID del cliente')
        return
      }

      if (!orderData.services || orderData.services.length === 0) {
        console.error('Missing services:', orderData.services)
        showNotification('error', 'Error', 'Debes seleccionar al menos un servicio')
        return
      }

      if (!orderData.customerAddress) {
        console.error('Missing customerAddress:', orderData.customerAddress)
        showNotification('error', 'Error', 'Falta la dirección del cliente')
        return
      }

      if (!orderData.timeSlot) {
        console.error('Missing timeSlot:', orderData.timeSlot)
        showNotification('error', 'Error', 'Debes seleccionar una hora de entrega')
        return
      }

      // Generate order number
      const random = Math.floor(Math.random() * 900000) + 100000  // Número aleatorio de 6 dígitos (100000-999999)
      const orderNumber = `PACK${random}`

      // Use the address from the wizard (orderData already has the correct address)
      const finalAddress = orderData.customerAddress

      console.log('Final address to use:', finalAddress)
      console.log('Order data validation passed')

      // Calcular totales para guardar en BD
      const filteredBoxSizes = Object.fromEntries(
        Object.entries(orderData.boxSizes || {}).filter(([_, value]) => value !== undefined)
      ) as { [key: string]: string }
      const calculatedTotal = calculateOrderTotal(orderData.services, orderData.serviceQuantities, orderData.needsBoxConstruction, filteredBoxSizes, orderData.boxSelections)

      const orderPayload = {
        ...orderData,
        orderNumber,
        createdBy: user?.name || 'system',
        customerAddress: finalAddress,  // Use customerAddress instead of address
        paymentMethod: orderData.paymentMethod || 'cash_on_delivery', // Include payment method
        // Include coordinates for mapping
        latitude: customerCoordinates?.latitude || null,
        longitude: customerCoordinates?.longitude || null,
        // Financial data for database
        subtotal: calculatedTotal,
        taxAmount: 0, // 7% tax but we can set it to 0 for now
        totalAmount: calculatedTotal,
        boxCount: boxes.reduce((sum, b) => sum + b.quantity, 0),
        boxPrice: 65, // Base price, will be calculated per item
        // Include boxes array with recipient information
        boxes: boxes.map(box => ({
          id: box.id,
          size: box.size,
          quantity: box.quantity,
          needsConstruction: box.needsConstruction,
          recipient: box.recipient ? {
            id: box.recipient.id,
            firstName: box.recipient.firstName,
            lastName: box.recipient.lastName,
            phone: box.recipient.phone,
            email: box.recipient.email,
            address: box.recipient.address
          } : null,
          isNewRecipient: box.isNewRecipient,
          newRecipientData: box.newRecipientData,
          packageCodes: box.packageCodes || []
        })),
        additionalServices: JSON.stringify(orderData.services.map(serviceName => {
          const quantity = orderData.serviceQuantities[serviceName] || 1
          const isBoxService = serviceName.toLowerCase().includes('caja') || serviceName.toLowerCase().includes('box')
          const needsConstruction = orderData.needsBoxConstruction[serviceName] || false

          let unitPrice = 0
          if (isBoxService) {
            unitPrice = needsConstruction ? 70 : 65
          } else if (serviceName.toLowerCase().includes('duradero')) {
            unitPrice = 0
          } else {
            unitPrice = 0
          }

          return {
            name: serviceName,
            quantity,
            unitPrice,
            needsConstruction,
            isBoxService,
            subtotal: unitPrice * quantity
          }
        }))
      }

      console.log('Creating order with payload:', orderPayload)
      console.log('Final address to be used:', finalAddress)

      setLoading(true)
      const response = await fetch('/api/package-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      })

      console.log('API Response status:', response.status)
      console.log('API Response ok:', response.ok)

      if (response.ok) {
        const result = await response.json()
        const customerName = foundCustomer
          ? `${foundCustomer.firstName} ${foundCustomer.lastName}`
          : orderData.customerName || 'Cliente'

    
        // Calcular total con la lógica correcta de precios
        const filteredBoxSizes2 = Object.fromEntries(
          Object.entries(orderData.boxSizes || {}).filter(([_, value]) => value !== undefined)
        ) as { [key: string]: string }
        const servicesTotal = calculateOrderTotal(orderData.services, orderData.serviceQuantities, orderData.needsBoxConstruction, filteredBoxSizes2, orderData.boxSelections)

        // Preparar datos detallados para la factura
        let orderItems = []

        orderData.services.forEach(serviceName => {
          const isBoxService = serviceName.toLowerCase().includes('caja') || serviceName.toLowerCase().includes('box')
          const isDeliveryService = serviceName.toLowerCase().includes('entrega') && serviceName.toLowerCase().includes('caja')

          // Para servicios de caja con múltiples selecciones, mostrar cada selección por separado
          if (isBoxService && orderData.boxSelections[serviceName] && orderData.boxSelections[serviceName].length > 0) {
            orderData.boxSelections[serviceName].forEach(selection => {
              const boxSizeInfo = BOX_SIZES.find(s => s.id === selection.size)

              let unitPrice = 0
              if (!isDeliveryService) {
                unitPrice = (BOX_SIZE_PRICES[selection.size] || BOX_SIZE_PRICES['medium']) +
                           (selection.needsConstruction ? BOX_CONSTRUCTION_COST : 0)
              }

              orderItems.push({
                name: serviceName,
                quantity: selection.quantity,
                unitPrice,
                needsConstruction: selection.needsConstruction,
                isBoxService,
                isDeliveryService,
                boxSize: boxSizeInfo,
                boxSelection: selection,
                subtotal: unitPrice * selection.quantity
              })
            })
          } else {
            // Para otros servicios sin múltiples selecciones
            const quantity = orderData.serviceQuantities[serviceName] || 1
            const needsConstruction = orderData.needsBoxConstruction[serviceName] || false
            const boxSize = orderData.boxSizes[serviceName] || 'medium'
            const boxSizeInfo = BOX_SIZES.find(s => s.id === boxSize)

            let unitPrice = 0
            if (isDeliveryService) {
              unitPrice = 0
            } else if (isBoxService) {
              unitPrice = BOX_SIZE_PRICES[boxSize] || BOX_SIZE_PRICES['medium']
              if (needsConstruction) {
                unitPrice += BOX_CONSTRUCTION_COST
              }
            } else if (serviceName.toLowerCase().includes('duradero')) {
              unitPrice = 0
            }

            orderItems.push({
              name: serviceName,
              quantity,
              unitPrice,
              needsConstruction,
              isBoxService,
              isDeliveryService,
              boxSize: boxSizeInfo,
              subtotal: unitPrice * quantity
            })
          }
        })

        setCreatedOrder({
          id: result.data.id,
          orderNumber,
          customerName,
          services: orderData.services,
          scheduledDate: orderData.scheduledDate,
          timeSlot: orderData.timeSlot,
          total: servicesTotal
        })

        showNotification('success', 'Orden Creada', 'La orden de paquetería ha sido creada exitosamente')
        setStep('confirmation')
      } else {
        // Handle error response
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error Response:', errorData)
        console.error('Response status:', response.status)
        console.error('Response text:', await response.text())
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Error creating order:', error)
      const errorMessage = error instanceof Error ? error.message : 'No se pudo crear la orden'
      showNotification('error', 'Error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!createdOrder) return

    try {
      showNotification('info', 'Enviando', 'Enviando recibo por correo electrónico...')

      // Simular envío de correo
      await new Promise(resolve => setTimeout(resolve, 2000))

      showNotification('success', 'Correo Enviado', `Recibo enviado a ${foundCustomer?.email || 'el cliente'}`)
    } catch (error) {
      showNotification('error', 'Error', 'No se pudo enviar el correo electrónico')
    }
  }

  const handleSendSMS = async () => {
    if (!createdOrder) return

    try {
      showNotification('info', 'Enviando', 'Enviando recibo por SMS...')

      // Simular envío de SMS
      await new Promise(resolve => setTimeout(resolve, 2000))

      showNotification('success', 'SMS Enviado', `Recibo enviado al ${foundCustomer?.phone || 'número del cliente'}`)
    } catch (error) {
      showNotification('error', 'Error', 'No se pudo enviar el SMS')
    }
  }

  const handlePrintReceipt = (format: '80mm' | 'letter') => {
    if (!createdOrder) return

    // Crear contenido del recibo
    const paymentMethodText = 'Cash on Delivery'

    // Calculate order items for the invoice
    let orderItems: any[] = []

    createdOrder.services.forEach(serviceName => {
      const isBoxService = serviceName.toLowerCase().includes('caja') || serviceName.toLowerCase().includes('box')
      const isDeliveryService = serviceName.toLowerCase().includes('entrega') && serviceName.toLowerCase().includes('caja')

      // Para servicios de caja con múltiples selecciones, mostrar cada selección por separado
      if (isBoxService && orderData.boxSelections[serviceName] && orderData.boxSelections[serviceName].length > 0) {
        orderData.boxSelections[serviceName].forEach(selection => {
          const boxSizeInfo = BOX_SIZES.find(s => s.id === selection.size)

          let unitPrice = 0
          if (!isDeliveryService) {
            unitPrice = (BOX_SIZE_PRICES[selection.size] || BOX_SIZE_PRICES['medium']) +
                       (selection.needsConstruction ? BOX_CONSTRUCTION_COST : 0)
          }

          orderItems.push({
            name: serviceName,
            quantity: selection.quantity,
            unitPrice,
            needsConstruction: selection.needsConstruction,
            isBoxService,
            isDeliveryService,
            boxSize: boxSizeInfo,
            boxSelection: selection,
            subtotal: unitPrice * selection.quantity
          })
        })
      } else {
        // Para otros servicios sin múltiples selecciones
        const quantity = orderData.serviceQuantities?.[serviceName] || 1
        const needsConstruction = orderData.needsBoxConstruction?.[serviceName] || false
        const boxSize = orderData.boxSizes[serviceName] || 'medium'
        const boxSizeInfo = BOX_SIZES.find(s => s.id === boxSize)

        let unitPrice = 0
        if (isDeliveryService) {
          unitPrice = 0
        } else if (isBoxService) {
          unitPrice = BOX_SIZE_PRICES[boxSize] || BOX_SIZE_PRICES['medium']
          if (needsConstruction) {
            unitPrice += BOX_CONSTRUCTION_COST
          }
        } else if (serviceName.toLowerCase().includes('duradero')) {
          unitPrice = 0
        }

        orderItems.push({
          name: serviceName,
          quantity,
          unitPrice,
          needsConstruction,
          isBoxService,
          isDeliveryService,
          boxSize: boxSizeInfo,
          subtotal: unitPrice * quantity
        })
      }
    })
    const receiptContent = `
====================================
          CUBARAPID - RECIBO
====================================

Número de Orden: ${createdOrder.orderNumber}
Fecha: ${new Date().toLocaleDateString('es-ES')}
Cliente: ${createdOrder.customerName}

Servicios:
${createdOrder.services.map((service, i) => {
  const quantity = orderData.serviceQuantities?.[service] || 1
  const isBoxService = service.toLowerCase().includes('caja') || service.toLowerCase().includes('box')
  const needsConstruction = orderData.needsBoxConstruction?.[service] || false
  const constructionText = isBoxService && needsConstruction ? ' (Con confección)' : ''
  return `${i + 1}. ${service}${constructionText} - Cantidad: ${quantity}`
}).join('\n')}

Método de Pago: ${paymentMethodText}
Total: $${createdOrder.total}

Estado: Pendiente
====================================
          ¡Gracias por su preferencia!
====================================
    `.trim()

    if (format === '80mm') {
      // Para impresora térmica 80mm
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Recibo - ${createdOrder.orderNumber}</title>
              <style>
                body {
                  font-family: 'Courier New', monospace;
                  font-size: 12px;
                  width: 80mm;
                  margin: 0;
                  padding: 5px;
                  white-space: pre;
                }
                @media print {
                  body { margin: 0; }
                }
              </style>
            </head>
            <body>${receiptContent}</body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    } else {
      // Para impresora tamaño carta - Factura Profesional
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Factura - ${createdOrder.orderNumber}</title>
              <style>
                @page {
                  margin: 15mm;
                  size: letter;
                }
                body {
                  font-family: 'Arial', sans-serif;
                  font-size: 12px;
                  line-height: 1.4;
                  color: #333;
                  margin: 0;
                  padding: 0;
                }
                .invoice-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: 30px;
                  border-bottom: 2px solid #2563eb;
                  padding-bottom: 20px;
                }
                .company-info {
                  flex: 1;
                }
                .company-name {
                  font-size: 24px;
                  font-weight: bold;
                  color: #2563eb;
                  margin-bottom: 5px;
                }
                .company-tagline {
                  font-size: 14px;
                  color: #666;
                  margin-bottom: 10px;
                }
                .company-address {
                  font-size: 11px;
                  color: #666;
                }
                .invoice-info {
                  text-align: right;
                  min-width: 200px;
                }
                .invoice-title {
                  font-size: 20px;
                  font-weight: bold;
                  color: #333;
                  margin-bottom: 10px;
                }
                .invoice-number {
                  font-size: 16px;
                  font-weight: bold;
                  color: #2563eb;
                  margin-bottom: 5px;
                }
                .invoice-date {
                  font-size: 12px;
                  color: #666;
                }
                .billing-section {
                  display: flex;
                  gap: 40px;
                  margin-bottom: 30px;
                }
                .bill-to, .service-info {
                  flex: 1;
                }
                .section-title {
                  font-size: 12px;
                  font-weight: bold;
                  color: #666;
                  text-transform: uppercase;
                  margin-bottom: 10px;
                  padding-bottom: 5px;
                  border-bottom: 1px solid #ddd;
                }
                .customer-name {
                  font-size: 14px;
                  font-weight: bold;
                  margin-bottom: 5px;
                }
                .customer-details {
                  font-size: 11px;
                  color: #666;
                  line-height: 1.3;
                }
                .items-table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 20px;
                }
                .items-table th {
                  background-color: #f8fafc;
                  padding: 12px 8px;
                  text-align: left;
                  font-size: 11px;
                  font-weight: bold;
                  color: #666;
                  border-bottom: 2px solid #e5e7eb;
                  text-transform: uppercase;
                }
                .items-table td {
                  padding: 10px 8px;
                  font-size: 12px;
                  border-bottom: 1px solid #f3f4f6;
                }
                .items-table .description {
                  font-weight: 500;
                }
                .items-table .amount {
                  text-align: right;
                  font-weight: bold;
                }
                .totals-section {
                  display: flex;
                  justify-content: flex-end;
                  margin-bottom: 30px;
                }
                .totals-box {
                  min-width: 250px;
                  border: 1px solid #e5e7eb;
                  border-radius: 4px;
                }
                .total-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 8px 15px;
                  font-size: 12px;
                }
                .total-row:not(:last-child) {
                  border-bottom: 1px solid #f3f4f6;
                }
                .total-row.grand-total {
                  background-color: #f8fafc;
                  font-weight: bold;
                  font-size: 14px;
                  color: #2563eb;
                }
                .footer-section {
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  text-align: center;
                }
                .terms {
                  font-size: 10px;
                  color: #666;
                  margin-bottom: 10px;
                }
                .thank-you {
                  font-size: 12px;
                  font-weight: bold;
                  color: #333;
                }
                @media print {
                  body {
                    margin: 0;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                  .invoice-header {
                    page-break-inside: avoid;
                  }
                  .billing-section {
                    page-break-inside: avoid;
                  }
                  .items-table {
                    page-break-inside: auto;
                  }
                  .totals-section {
                    page-break-inside: avoid;
                  }
                }
              </style>
            </head>
            <body>
              <!-- Header -->
              <div class="invoice-header">
                <div class="company-info">
                  <div class="company-name">CUBARAPID</div>
                  <div class="company-tagline">Servicios de Paquetería Express</div>
                  <div class="company-address">
                    Calle Principal #123<br>
                    La Habana, Cuba<br>
                    Tel: +53 5 555 5555<br>
                    Email: info@cubarapid.cu
                  </div>
                </div>
                <div class="invoice-info">
                  <div class="invoice-title">FACTURA</div>
                  <div class="invoice-number">N°: ${createdOrder.orderNumber}</div>
                  <div class="invoice-date">Fecha: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                  <div class="invoice-date">Vencimiento: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                </div>
              </div>

              <!-- Billing Information -->
              <div class="billing-section">
                <div class="bill-to">
                  <div class="section-title">Facturar a:</div>
                  <div class="customer-name">${createdOrder.customerName}</div>
                  <div class="customer-details">
                    ${foundCustomer?.phone || 'Teléfono no disponible'}<br>
                    ${foundCustomer?.email || 'Email no disponible'}<br>
                    ${foundCustomer?.address ? typeof foundCustomer.address === 'object' ?
                      `${foundCustomer.address.street || ''}<br>${foundCustomer.address.city || ''}, ${foundCustomer.address.state || ''} ${foundCustomer.address.zipCode || ''}` :
                      foundCustomer.address : 'Dirección no disponible'}
                  </div>
                </div>
                <div class="service-info">
                  <div class="section-title">Información del Servicio:</div>
                  <div class="customer-details">
                    Estado: <strong>Pendiente</strong><br>
                    ${createdOrder.scheduledDate ? `Fecha Programada: ${new Date(createdOrder.scheduledDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}<br>` : ''}
                    ${createdOrder.timeSlot ? `Horario: ${createdOrder.timeSlot}<br>` : ''}
                    Tipo de Pago: <strong>${paymentMethodText}</strong>
                  </div>
                </div>
              </div>

              <!-- Items Table -->
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 10%;">Código</th>
                    <th style="width: 50%;">Descripción</th>
                    <th style="width: 15%;">Cantidad</th>
                    <th style="width: 15%;">Precio Unit.</th>
                    <th style="width: 10%;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderItems.map((item, i) => {
                    const sizeText = item.boxSize ? `<span style="color: #16a34a; font-size: 11px; font-weight: bold;"> (${item.boxSize.name})</span>` : ''
                    const constructionText = item.needsConstruction ? '<span style="color: #2563eb; font-size: 10px;"> (Con confección)</span>' : ''
                    const freeText = item.isDeliveryService ? '<span style="color: #16a34a; font-size: 10px; font-weight: bold;"> (Gratis)</span>' : ''
                    const detailsText = item.boxSize ? `<br><span style="color: #6b7280; font-size: 10px;">${item.boxSize.dimensions}</span>` : ''

                    return `
                    <tr>
                      <td>00${i + 1}</td>
                      <td class="description">${item.name}${sizeText}${constructionText}${freeText}${detailsText}</td>
                      <td>${item.quantity}</td>
                      <td>$${item.unitPrice.toFixed(2)}</td>
                      <td class="amount">$${item.subtotal.toFixed(2)}</td>
                    </tr>
                    `
                  }).join('')}
                  <tr>
                    <td colspan="4" style="text-align: right; padding-right: 15px;"><strong>Subtotal:</strong></td>
                    <td class="amount">$${createdOrder.total.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td colspan="4" style="text-align: right; padding-right: 15px;">Impuesto (0%):</td>
                    <td class="amount">$0.00</td>
                  </tr>
                </tbody>
              </table>

              <!-- Totals -->
              <div class="totals-section">
                <div class="totals-box">
                  <div class="total-row">
                    <span>Subtotal:</span>
                    <span>$${createdOrder.total.toFixed(2)}</span>
                  </div>
                  <div class="total-row">
                    <span>Impuesto (0%):</span>
                    <span>$0.00</span>
                  </div>
                  <div class="total-row grand-total">
                    <span>TOTAL A PAGAR:</span>
                    <span>$${createdOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="footer-section">
                <div class="terms">
                  <strong>Términos y Condiciones:</strong><br>
                  - Los precios están en USD (Dólares Estadounidenses)<br>
                  - El pago se realiza al momento de la entrega<br>
                  - Esta factura es válida como comprobante de pago<br>
                  - Para cualquier consulta, contactarnos al +53 5 555 5555
                </div>
                <div class="thank-you">
                  ¡Gracias por elegir CUBARAPID!
                </div>
              </div>
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  // Function to calculate order total with correct pricing logic
  const calculateOrderTotal = (services: string[], serviceQuantities: {[key: string]: number}, needsBoxConstruction: {[key: string]: boolean}, boxSizes: {[key: string]: string} = {}, boxSelections: {[key: string]: Array<{size: string, quantity: number, needsConstruction: boolean}>} = {}) => {
    return services.reduce((total, serviceName) => {
      const isBoxService = serviceName.toLowerCase().includes('caja') || serviceName.toLowerCase().includes('box')

      if (isBoxService && boxSelections[serviceName]) {
        // Use multiple box selections
        return boxSelections[serviceName].reduce((serviceTotal, selection) => {
          const unitPrice = (BOX_SIZE_PRICES[selection.size] || BOX_SIZE_PRICES['medium']) +
                           (selection.needsConstruction ? BOX_CONSTRUCTION_COST : 0)
          return serviceTotal + (unitPrice * selection.quantity)
        }, total)
      } else {
        // Fallback to single selection for non-box services or backward compatibility
        const quantity = serviceQuantities[serviceName] || 1
        const needsConstruction = needsBoxConstruction[serviceName] || false
        const boxSize = boxSizes[serviceName] || 'medium'

        let unitPrice = 0
        if (isBoxService) {
          unitPrice = BOX_SIZE_PRICES[boxSize] || BOX_SIZE_PRICES['medium']
          if (needsConstruction) {
            unitPrice += BOX_CONSTRUCTION_COST
          }
        } else if (serviceName.toLowerCase().includes('duradero')) {
          unitPrice = 0
        }

        return total + (unitPrice * quantity)
      }
    }, 0)
  }

  // Box size selection functions
  const handleBoxServiceSelect = (serviceName: string) => {
    const isBoxService = serviceName.toLowerCase().includes('caja') || serviceName.toLowerCase().includes('box')
    if (isBoxService) {
      setSelectedServiceForSize(serviceName)
      // Initialize with existing selections or default
      const existingSelections = orderData.boxSelections[serviceName] || []
      setTempBoxSelections(existingSelections.length > 0 ? [...existingSelections] : [{size: 'medium', quantity: 1, needsConstruction: false}])
      setShowSizeModal(true)
    }
  }

  const addBoxSelection = () => {
    setTempBoxSelections(prev => [...prev, {size: 'medium', quantity: 1, needsConstruction: false}])
  }

  const updateBoxSelection = (index: number, field: 'size' | 'quantity' | 'needsConstruction', value: any) => {
    setTempBoxSelections(prev => {
      const updated = [...prev]
      if (field === 'quantity') {
        updated[index].quantity = Math.max(1, parseInt(value) || 1)
      } else if (field === 'needsConstruction') {
        updated[index].needsConstruction = value
      } else {
        updated[index].size = value
      }
      return updated
    })
  }

  const removeBoxSelection = (index: number) => {
    setTempBoxSelections(prev => prev.filter((_, i) => i !== index))
  }

  const confirmSizeSelection = () => {
    if (selectedServiceForSize) {
      setOrderData(prev => ({
        ...prev,
        boxSelections: {
          ...prev.boxSelections,
          [selectedServiceForSize]: tempBoxSelections.filter(s => s.quantity > 0)
        }
      }))
    }
    setShowSizeModal(false)
    setSelectedServiceForSize(null)
    setTempBoxSelections([])
  }

  const cancelSizeSelection = () => {
    setShowSizeModal(false)
    setSelectedServiceForSize(null)
    setTempBoxSelections([])
  }

  const getBoxSizeDisplay = (serviceName: string) => {
    const size = orderData.boxSizes[serviceName]
    if (!size) return ''
    const sizeInfo = BOX_SIZES.find(s => s.id === size)
    return sizeInfo ? ` (${sizeInfo.name})` : ''
  }

  const handleFinish = () => {
    if (createdOrder) {
      // Redirigir a la página de edición de la orden recién creada
      router.push(`/dashboard/admin/package-orders/${createdOrder.id}/edit`)
    } else {
      // Fallback: redirigir a la tabla de órdenes
      router.push('/dashboard/admin/package-orders')
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8 pt-12 sm:pt-16 lg:pt-20"
        >
          {/* Close Button */}
          <div className="flex justify-end mb-4">
            <motion.button
              onClick={() => router.push('/dashboard/admin/package-orders')}
              className={cn(
                "p-2 rounded-full transition-all duration-200",
                "hover:bg-gray-100 dark:hover:bg-gray-700",
                "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              )}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Modern Progress Indicator */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl mx-auto mb-8"
          >
            {/* Progress Labels */}
            <div className="flex justify-between mb-4">
              {[
                { id: 'search', label: 'Cliente', icon: User },
                { id: 'services', label: 'Servicios', icon: Package },
                { id: 'scheduling', label: 'Programar', icon: Calendar },
                { id: 'confirmation', label: 'Confirmar', icon: CheckCircle }
              ].map((stepInfo, index) => {
                const stepOrder = ['search', 'found', 'new-customer', 'services', 'scheduling', 'confirmation']
                const currentStepIndex = stepOrder.indexOf(step)

                // Fixed logic: Handle the 6 internal steps with 4 visual steps
                const isStepActive = (
                  (index === 0 && currentStepIndex >= 0 && currentStepIndex <= 2) || // search, found, new-customer
                  (index === 1 && currentStepIndex >= 3 && currentStepIndex <= 3) || // services
                  (index === 2 && currentStepIndex >= 4 && currentStepIndex <= 4) || // scheduling
                  (index === 3 && currentStepIndex >= 5) // confirmation
                )
                const isStepCompleted = (
                  (index === 0 && currentStepIndex > 2) || // after new-customer
                  (index === 1 && currentStepIndex > 3) || // after services
                  (index === 2 && currentStepIndex > 4) || // after scheduling
                  (index === 3 && currentStepIndex > 5) // after confirmation (never happens)
                )

                return (
                  <motion.div
                    key={stepInfo.id}
                    className="flex flex-col items-center"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <motion.div
                      className={cn(
                        'w-14 h-14 rounded-full flex items-center justify-center border-3 transition-all duration-300 relative z-10',
                        'bg-white dark:bg-gray-800',
                        isStepActive
                          ? cn(
                              'border-2 shadow-xl',
                              theme === 'dark'
                                ? 'border-blue-600 shadow-blue-600/40'
                                : 'border-red-600 shadow-red-600/40'
                            )
                          : isStepCompleted
                          ? 'border-green-600 shadow-xl shadow-green-600/40'
                          : theme === 'dark'
                            ? 'border-gray-600'
                            : 'border-gray-300'
                      )}
                      whileHover={{
                        scale: 1.05,
                        boxShadow: isStepActive
                          ? theme === 'dark'
                            ? '0 20px 25px -5px rgba(37, 99, 235, 0.4)'
                            : '0 20px 25px -5px rgba(239, 68, 68, 0.4)'
                          : isStepCompleted
                          ? '0 20px 25px -5px rgba(34, 197, 94, 0.4)'
                          : '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <motion.div
                        initial={false}
                        animate={{
                          rotate: isStepActive ? 360 : 0,
                          scale: isStepActive ? 1.1 : 1
                        }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                      >
                        {isStepCompleted ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200 }}
                          >
                            <Check className={cn(
                              'w-7 h-7',
                              isStepActive
                                ? cn(
                                    theme === 'dark' ? 'text-blue-600' : 'text-red-600'
                                  )
                                : 'text-green-600'
                            )} />
                          </motion.div>
                        ) : (
                          <stepInfo.icon className={cn(
                            'w-6 h-6 transition-colors duration-300',
                            isStepActive
                              ? cn(
                                  theme === 'dark' ? 'text-blue-600' : 'text-red-600'
                                )
                              : theme === 'dark'
                                ? 'text-gray-400'
                                : 'text-gray-500'
                          )} />
                        )}
                      </motion.div>

                      {/* Pulsing ring for active step */}
                      {isStepActive && (
                        <motion.div
                          className={cn(
                            'absolute inset-0 rounded-full border-2',
                            theme === 'dark'
                              ? 'border-blue-600'
                              : 'border-red-600'
                          )}
                          initial={{ scale: 1, opacity: 0.6 }}
                          animate={{ scale: 1.3, opacity: 0 }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeOut"
                          }}
                        />
                      )}
                    </motion.div>

                    <motion.span
                      className={cn(
                        'text-sm font-semibold text-center mt-3 transition-colors duration-300',
                        isStepActive
                          ? cn(
                              theme === 'dark' ? 'text-blue-400' : 'text-red-600'
                            )
                          : isStepCompleted
                          ? 'text-green-600 dark:text-green-400'
                          : theme === 'dark'
                            ? 'text-gray-400'
                            : 'text-gray-500'
                      )}
                      animate={{
                        fontWeight: isStepActive ? 700 : 600,
                        scale: isStepActive ? 1.05 : 1
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      {stepInfo.label}
                    </motion.span>
                  </motion.div>
                )
              })}
            </div>

            {/* Progress Bar */}
            <div className="relative mt-2">
              {/* Background Line */}
              <div className={cn(
                'absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 rounded-full',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              )} />

              {/* Animated Progress Line */}
              <motion.div
                className={cn(
                  "absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r",
                  theme === 'dark'
                    ? "from-blue-500 to-blue-600"
                    : "from-red-600 to-red-700"
                )}
                initial={{ width: "0%" }}
                animate={{
                  width: (() => {
                    // Convert 6 internal steps to 4 visual steps
                    const stepOrder = ['search', 'found', 'new-customer', 'services', 'scheduling', 'confirmation']
                    const currentStepIndex = stepOrder.indexOf(step)

                    if (currentStepIndex <= 2) return "25%"      // search, found, new-customer
                    if (currentStepIndex === 3) return "50%"     // services
                    if (currentStepIndex === 4) return "75%"     // scheduling
                    if (currentStepIndex >= 5) return "100%"     // confirmation
                    return "25%" // default
                  })()
                }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{
                  boxShadow: theme === 'dark'
                    ? '0 0 10px rgba(37, 99, 235, 0.5)'
                    : '0 0 10px rgba(185, 28, 28, 0.5)'
                }}
              />
            </div>
          </motion.div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {/* Step 1: Search Customer */}
            {step === 'search' && (
              <motion.div
                key="search"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn(
                  'p-8 rounded-xl border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white shadow-md'
                )}
              >
                <div className="max-w-md mx-auto space-y-6">
                  <div className="text-center">
                    <div className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                    theme === 'dark' ? 'bg-blue-100' : 'bg-red-50'
                  )}>
                      <Phone className={cn(
                        "w-8 h-8",
                        theme === 'dark' ? 'text-blue-600' : 'text-red-600'
                      )} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Buscar Cliente
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Ingresa el número de teléfono del cliente
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Número de Teléfono
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSearchCustomer()}
                          placeholder="+1 (555) 123-4567"
                          className={cn(
                            'w-full pl-10 pr-4 py-3 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-blue-500',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleSearchCustomer}
                      disabled={searching || !phoneNumber.trim()}
                      className={cn(
                        "w-full py-3 text-white transition-colors",
                        theme === 'dark'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-red-600 hover:bg-red-700'
                      )}
                    >
                      {searching ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Buscando...
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          Buscar Cliente
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step: Customer Found */}
            {step === 'found' && foundCustomer && (
              <motion.div
                key="found"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn(
                  'p-8 rounded-xl border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white shadow-sm'
                )}
              >
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="text-center">
                    <div className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                      theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                    )}>
                      <Check className={cn(
                        "w-8 h-8",
                        theme === 'dark' ? 'text-green-400' : 'text-green-600'
                      )} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Cliente Encontrado
                    </h2>
                  </div>

                  {/* Customer Information Card */}
                  <div className={cn(
                    'p-6 rounded-xl border shadow-sm',
                    theme === 'dark' ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-white'
                  )}>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
                        )}>
                          <User className={cn(
                            "w-5 h-5",
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          )} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-lg">
                            {foundCustomer.firstName} {foundCustomer.lastName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Cliente</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-13">
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-400">
                            {foundCustomer.phone}
                          </span>
                        </div>
                        {foundCustomer.email && (
                          <div className="flex items-center gap-3">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 dark:text-gray-400">
                              {foundCustomer.email}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Address Selection Section */}
                  <div className={cn(
                    'p-6 rounded-xl border shadow-sm',
                    theme === 'dark' ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-white'
                  )}>
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className={cn(
                        "w-5 h-5",
                        theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      )} />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Selección de Dirección
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {/* Address Options */}
                      <div className="space-y-3">
                        {/* Only show primary address option if no saved addresses exist */}
                        {customerAddresses.length === 0 && (
                          <label className={cn(
                            "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                            addressOption === 'same'
                              ? cn(
                                  "border-2",
                                  theme === 'dark' ? 'border-blue-600 bg-blue-900/20' : 'border-red-600 bg-red-50'
                                )
                              : cn(
                                  "border",
                                  theme === 'dark' ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                )
                          )}>
                            <input
                              type="radio"
                              name="addressOption"
                              value="same"
                              checked={addressOption === 'same'}
                              onChange={() => setAddressOption('same')}
                              className="w-4 h-4"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">
                                Usar dirección principal
                              </p>
                              {foundCustomer.address?.street && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {foundCustomer.address.street}
                                  {foundCustomer.address.city && `, ${foundCustomer.address.city}`}
                                  {foundCustomer.address.state && `, ${foundCustomer.address.state}`}
                                  {foundCustomer.address.zipCode && ` ${foundCustomer.address.zipCode}`}
                                </p>
                              )}
                            </div>
                          </label>
                        )}

                        {/* Existing Addresses Section */}
                        {customerAddresses.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
                              Direcciones guardadas:
                            </p>
                            {customerAddresses.map((address: any, index: number) => (
                              <label key={address.id} className={cn(
                                "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all group",
                                addressOption === 'existing' && selectedAddress?.id === address.id
                                  ? cn(
                                      "border-2",
                                      theme === 'dark' ? 'border-blue-600 bg-blue-900/20' : 'border-red-600 bg-red-50'
                                    )
                                  : cn(
                                      "border",
                                      theme === 'dark' ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                                    )
                              )}>
                                <input
                                  type="radio"
                                  name="addressOption"
                                  value="existing"
                                  checked={addressOption === 'existing' && selectedAddress?.id === address.id}
                                  onChange={() => {
                                    setAddressOption('existing')
                                    setSelectedAddress(address)
                                  }}
                                  className="w-4 h-4"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {address.isPrimary && (
                                        <div className={cn(
                                          "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                          theme === 'dark' ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'
                                        )}>
                                          <Shield className="w-3 h-3" />
                                          Principal
                                        </div>
                                      )}
                                      <p className="font-medium text-gray-900 dark:text-white">
                                        {address.street}
                                        {address.apartment && ` ${address.apartment}`}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        deleteCustomerAddress(address.id)
                                      }}
                                      className={cn(
                                        "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                                        "p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30",
                                        "text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                      )}
                                      title="Eliminar dirección"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {address.city}
                                    {address.state && `, ${address.state}`}
                                    {address.zipCode && ` ${address.zipCode}`}
                                    {address.country && `, ${address.country}`}
                                  </p>
                                  {address.notes && (
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                      Nota: {address.notes}
                                    </p>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                        )}

                        <label className={cn(
                          "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                          addressOption === 'new'
                            ? cn(
                                "border-2",
                                theme === 'dark' ? 'border-blue-600 bg-blue-900/20' : 'border-red-600 bg-red-50'
                              )
                            : cn(
                                "border",
                                theme === 'dark' ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                              )
                        )}>
                          <input
                            type="radio"
                            name="addressOption"
                            value="new"
                            checked={addressOption === 'new'}
                            onChange={() => setAddressOption('new')}
                            className="w-4 h-4"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">
                              Agregar nueva dirección
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Registrar una dirección diferente para esta orden
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* New Address Form with Mapbox */}
                      {addressOption === 'new' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 p-4 rounded-lg border bg-gray-50 dark:bg-gray-800/50"
                        >
                          <div className="flex items-center gap-2 mb-4">
                            <MapPin className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            )} />
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Buscar Dirección con Mapa
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Usa el mapa para encontrar la dirección fácilmente
                            </p>
                          </div>

                          <MapboxAddressAutofill
                            value={{
                              street: newAddress.street,
                              apartment: newAddress.apartment,
                              city: newAddress.city,
                              state: newAddress.state,
                              zipCode: newAddress.zipCode,
                              country: newAddress.country
                            }}
                            onChange={(addressData) => {
                              setNewAddress({
                                ...newAddress,
                                ...addressData
                              })
                            }}
                          />

                          {/* Notes Field */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Notas de la dirección (opcional)
                            </label>
                            <textarea
                              value={newAddress.notes}
                              onChange={(e) => setNewAddress({...newAddress, notes: e.target.value})}
                              className={cn(
                                "w-full p-3 rounded-lg border transition-colors focus:outline-none focus:ring-2",
                                theme === 'dark'
                                  ? 'bg-gray-700 border-gray-600 text-white focus:ring-blue-500'
                                  : 'bg-white border-gray-300 text-gray-900 focus:ring-red-500'
                              )}
                              placeholder="Referencias, instrucciones especiales, apartamento, etc..."
                              rows={2}
                            />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStep('search')
                        setFoundCustomer(null)
                        setPhoneNumber('')
                        setAddressOption('same')
                        setNewAddress({
                          street: '',
                          apartment: '',
                          city: '',
                          state: '',
                          zipCode: '',
                          country: '',
                          notes: ''
                        })
                      }}
                      className="flex-1"
                    >
                      Buscar Otro
                    </Button>
                    <Button
                      onClick={handleSelectCustomer}
                      disabled={
                        (addressOption === 'new' && (!newAddress.street.trim() || !newAddress.city.trim())) ||
                        (addressOption === 'existing' && !selectedAddress)
                      }
                      className={cn(
                        "flex-1 text-white transition-colors",
                        theme === 'dark'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-red-600 hover:bg-red-700'
                      )}
                    >
                      {addressOption === 'new' ? 'Continuar con Nueva Dirección' :
                       addressOption === 'existing' ? 'Continuar con Dirección Existente' :
                       'Continuar con Dirección Principal'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step: New Customer */}
            {step === 'new-customer' && (
              <motion.div
                key="new-customer"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn(
                  'p-8 rounded-xl border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white shadow-sm'
                )}
              >
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="text-center">
                    <div className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                    theme === 'dark' ? 'bg-blue-100' : 'bg-red-50'
                  )}>
                      <Plus className={cn(
                        "w-8 h-8",
                        theme === 'dark' ? 'text-blue-600' : 'text-red-600'
                      )} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Nuevo Cliente
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Registra la información del nuevo cliente
                    </p>
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
                          'focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-blue-500',
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
                          'focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-blue-500',
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
                          'focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-blue-500',
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
                          'focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-blue-500',
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
                        'focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-blue-500',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep('search')}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateCustomer}
                      disabled={loading}
                      className={cn(
                        "flex-1 text-white transition-colors",
                        theme === 'dark'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-red-600 hover:bg-red-700'
                      )}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        'Crear Cliente'
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step: Services */}
            {step === 'services' && (
              <motion.div
                key="services"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn(
                  'p-8 rounded-xl border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white shadow-sm'
                )}
              >
                <div className="max-w-3xl mx-auto space-y-6">
                  <div className="text-center mb-6">
                    <div className={cn(
                    'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
                    theme === 'dark' ? 'bg-blue-100' : 'bg-red-50'
                  )}>
                      <Package className={cn(
                        "w-8 h-8",
                        theme === 'dark' ? 'text-blue-600' : 'text-red-600'
                      )} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Cajas para Enviar
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Agregue cajas individuales con su tamaño y destinatario
                    </p>
                  </div>

                  {/* Box Recipient Manager */}
                  <BoxRecipientManager
                    boxes={boxes}
                    onBoxesChange={setBoxes}
                    selectedServices={orderData.services}
                    onServicesChange={(services) => setOrderData(prev => ({ ...prev, services }))}
                    theme={theme}
                  />

                  {/* Old service selection removed - keeping placeholder for easier rollback if needed */}
                  {false && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {SERVICE_TYPES.map((service) => (
                      <motion.div
                        key={service.id}
                        className={cn(
                          'p-6 rounded-lg border-2 transition-all cursor-pointer',
                          orderData.services.includes(service.name)
                            ? cn(
                                'border-2',
                                theme === 'dark' ? 'border-blue-600 bg-blue-100' : 'border-red-600 bg-red-100'
                              )
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleService(service.name)}
                      >
                        <service.icon className={cn(
                          'w-8 h-8 mx-auto mb-3',
                          orderData.services.includes(service.name)
                            ? cn(
                                theme === 'dark' ? 'text-blue-600' : 'text-red-600'
                              )
                            : 'text-gray-400'
                        )} />
                        <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                          {service.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {service.description}
                        </p>
                        </motion.div>
                    ))}
                  </div>
                  )}

                  {/* Payment Method Selection */}
                  {orderData.services.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'p-6 rounded-xl border mb-4',
                        theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white shadow-sm'
                      )}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                        )}>
                          <DollarSign className={cn(
                            'w-5 h-5',
                            theme === 'dark' ? 'text-green-600' : 'text-green-600'
                          )} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Método de Pago
                        </h3>
                      </div>

                      <div className="space-y-3">
                        <label className={cn(
                          'flex items-center p-4 rounded-lg border cursor-pointer transition-all',
                          'hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20',
                          orderData.paymentMethod === 'cash_on_delivery'
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-gray-600'
                        )}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="cash_on_delivery"
                            checked={orderData.paymentMethod === 'cash_on_delivery'}
                            onChange={() => setOrderData(prev => ({ ...prev, paymentMethod: 'cash_on_delivery' }))}
                            className="mr-3 text-green-500 focus:ring-green-500"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              Pago Contra Entrega (Cash on Delivery)
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Pague en efectivo cuando recibamos el servicio
                            </div>
                          </div>
                        </label>
                      </div>
                    </motion.div>
                  )}

                  {/* Financial Summary */}
                  {orderData.services.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'p-6 rounded-xl border',
                        theme === 'dark'
                          ? 'border-gray-700 bg-gray-900/50'
                          : 'border-gray-200 bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center',
                          theme === 'dark' ? 'bg-blue-100' : 'bg-red-100'
                        )}>
                          <span className={cn(
                            'text-sm font-bold',
                            theme === 'dark' ? 'text-blue-600' : 'text-red-600'
                          )}>
                            $
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Resumen Financiero
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {orderData.services.map((serviceName, index) => {
                          const isDeliveryService = serviceName.toLowerCase().includes('entrega') && serviceName.toLowerCase().includes('caja')
                          const isBoxService = serviceName.toLowerCase().includes('caja') || serviceName.toLowerCase().includes('box')

                          // For box services with multiple selections, show each selection separately
                          if (isBoxService && orderData.boxSelections[serviceName] && orderData.boxSelections[serviceName].length > 0) {
                            return orderData.boxSelections[serviceName].map((selection, selectionIndex) => {
                              const boxSizeInfo = BOX_SIZES.find(s => s.id === selection.size)
                              const unitPrice = isDeliveryService ? 0 :
                                               ((BOX_SIZE_PRICES[selection.size] || BOX_SIZE_PRICES['medium']) +
                                                (selection.needsConstruction ? BOX_CONSTRUCTION_COST : 0))
                              const subtotal = unitPrice * selection.quantity

                              return (
                                <div key={`${index}-${selectionIndex}`} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-white">
                                      {serviceName}
                                      {boxSizeInfo && (
                                        <span className="ml-2 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                                          {boxSizeInfo.name}
                                        </span>
                                      )}
                                      {selection.needsConstruction && (
                                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                                          Con confección
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {isDeliveryService ? (
                                        <span className="text-green-600 dark:text-green-400 font-medium">Gratis</span>
                                      ) : (
                                        <>
                                          Cantidad: {selection.quantity} × ${unitPrice.toFixed(2)}
                                          {boxSizeInfo && (
                                            <span className="ml-2 text-xs text-gray-500">
                                              ({boxSizeInfo.dimensions})
                                            </span>
                                          )}
                                          {selection.needsConstruction && (
                                            <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">
                                              (+$5.00)
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className={cn(
                                      'font-semibold',
                                      isDeliveryService ? 'text-green-600 dark:text-green-400' : (theme === 'dark' ? 'text-white' : 'text-gray-900')
                                    )}>
                                      {isDeliveryService ? 'Gratis' : `$${subtotal.toFixed(2)}`}
                                    </p>
                                  </div>
                                </div>
                              )
                            })
                          } else {
                            // For delivery services and other services without multiple selections
                            const quantity = orderData.serviceQuantities[serviceName] || 1
                            const needsConstruction = orderData.needsBoxConstruction[serviceName] || false
                            const boxSize = orderData.boxSizes[serviceName] || 'medium'
                            const boxSizeInfo = BOX_SIZES.find(s => s.id === boxSize)

                            // Calculate unit price - delivery services are free
                            let unitPrice = 0
                            if (isDeliveryService) {
                              unitPrice = 0
                            } else if (isBoxService) {
                              unitPrice = BOX_SIZE_PRICES[boxSize] || BOX_SIZE_PRICES['medium']
                              if (needsConstruction) {
                                unitPrice += BOX_CONSTRUCTION_COST
                              }
                            } else if (serviceName.toLowerCase().includes('duradero')) {
                              unitPrice = 0
                            } else {
                              unitPrice = 0
                            }

                            const subtotal = unitPrice * quantity

                            return (
                              <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {serviceName}
                                    {isBoxService && boxSizeInfo && (
                                      <span className="ml-2 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                                        {boxSizeInfo.name}
                                      </span>
                                    )}
                                    {isBoxService && needsConstruction && (
                                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                                        Con confección
                                      </span>
                                    )}
                                    {isDeliveryService && (
                                      <span className="ml-2 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                                        Gratis
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {isDeliveryService ? (
                                      <span>Servicio gratuito - Entregamos caja confeccionada</span>
                                    ) : (
                                      <>
                                        Cantidad: {quantity} × ${unitPrice.toFixed(2)}
                                        {isBoxService && boxSizeInfo && (
                                          <span className="ml-2 text-xs text-gray-500">
                                            ({boxSizeInfo.dimensions})
                                          </span>
                                        )}
                                        {isBoxService && needsConstruction && (
                                          <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">
                                            (+$5.00)
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={cn(
                                    'font-semibold',
                                    isDeliveryService ? 'text-green-600 dark:text-green-400' : (theme === 'dark' ? 'text-white' : 'text-gray-900')
                                  )}>
                                    {isDeliveryService ? 'Gratis' : `$${subtotal.toFixed(2)}`}
                                  </p>
                                  {unitPrice === 0 && !isDeliveryService && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Por determinar
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          }
                        })}

                        <div className="pt-3 border-t-2 border-gray-300 dark:border-gray-600">
                          <div className="flex justify-between items-center">
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              Total Estimado:
                            </p>
                            <p className={cn(
                              'text-xl font-bold',
                              theme === 'dark' ? 'text-blue-400' : 'text-red-600'
                            )}>
                              ${(() => {
                                const filteredBoxSizes = Object.fromEntries(
                                  Object.entries(orderData.boxSizes || {}).filter(([_, value]) => value !== undefined)
                                ) as { [key: string]: string }
                                return calculateOrderTotal(orderData.services, orderData.serviceQuantities, orderData.needsBoxConstruction, filteredBoxSizes, orderData.boxSelections).toFixed(2)
                              })()}
                            </p>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            *Los servicios de caja tienen costos variables según tamaño: Pequeña $45, Mediana $55, Grande $65 (+$5 si requiere confección).
                            Los servicios de duradero son gratuitos.
                          </p>
                        </div>
                      </div>

                    </motion.div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Notas para el Repartidor
                    </label>
                    <textarea
                      value={orderData.notes || ''}
                      onChange={(e) => setOrderData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Instrucciones especiales para el repartidor..."
                      rows={4}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-blue-500',
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep('search')}
                      className="flex-1"
                    >
                      Anterior
                    </Button>
                    <Button
                      onClick={() => setStep('scheduling')}
                      disabled={orderData.services.length === 0 && boxes.length === 0}
                      className={cn(
                        "flex-1 text-white transition-colors",
                        theme === 'dark'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-red-600 hover:bg-red-700'
                      )}
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step: Scheduling */}
            {step === 'scheduling' && (
              <motion.div
                key="scheduling"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={cn(
                  'p-8 rounded-xl border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white shadow-sm'
                )}
              >
                <div className="max-w-3xl mx-auto space-y-6">
                  <div className="text-center">
                    <div className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                      theme === 'dark' ? 'bg-blue-100' : 'bg-red-50'
                    )}>
                      <Calendar className={cn(
                        "w-8 h-8",
                        theme === 'dark' ? 'text-blue-600' : 'text-red-600'
                      )} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Programación
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Selecciona cuándo se realizará el servicio
                    </p>
                  </div>

                  {/* Available Time Slots */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Horarios Disponibles
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {getAvailableTimeSlots().map((slot) => (
                        <motion.button
                          key={slot.id}
                          onClick={() => {
                            setOrderData(prev => ({
                              ...prev,
                              timeSlot: slot.id,
                              scheduledDate: new Date().toISOString().split('T')[0]
                            }))
                          }}
                          className={cn(
                            'p-4 rounded-lg border-2 transition-all',
                            orderData.timeSlot === slot.id
                              ? 'border-exa-secondary bg-exa-secondary/10 dark:bg-purple-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                          )}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Clock className={cn(
                            'w-6 h-6 mx-auto mb-2',
                            orderData.timeSlot === slot.id
                              ? 'text-exa-secondary dark:text-exa-secondary'
                              : 'text-gray-400'
                          )} />
                          <h5 className="font-medium text-gray-900 dark:text-white mb-1">
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
                    <div className="flex items-center gap-3 mb-4">
                      <Calendar className="w-6 h-6 text-exa-secondary dark:text-exa-secondary" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Programar para otra fecha
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={orderData.scheduledDate || ''}
                          onChange={(e) => setOrderData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                          min={new Date().toISOString().split('T')[0]}
                          className={cn(
                            'w-full px-3 py-2 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-exa-secondary',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Hora
                        </label>
                        <select
                          value={orderData.timeSlot || ''}
                          onChange={(e) => setOrderData(prev => ({ ...prev, timeSlot: e.target.value }))}
                          className={cn(
                            'w-full px-3 py-2 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-exa-secondary',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          )}
                        >
                          <option value="">Seleccionar hora</option>
                          {TIME_SLOTS.map(slot => (
                            <option key={slot.id} value={slot.id}>{slot.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className={cn(
                    'p-6 rounded-lg border',
                    theme === 'dark' ? 'border-gray-700 bg-gray-900/20' : 'border-gray-200 bg-gray-50'
                  )}>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3">Resumen de la Orden</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Cliente:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {orderData.customerName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Servicios:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {orderData.services.join(', ')}
                        </span>
                      </div>
                      {orderData.scheduledDate && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Fecha:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {new Date(orderData.scheduledDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {orderData.timeSlot && (
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Horario:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {TIME_SLOTS.find(s => s.id === orderData.timeSlot)?.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep('services')}
                      className="flex-1"
                    >
                      Anterior
                    </Button>
                    <Button
                      onClick={handleSubmitOrder}
                      disabled={loading || !orderData.timeSlot}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creando Orden...
                        </>
                      ) : (
                        'Crear Orden'
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step: Confirmation */}
            {step === 'confirmation' && createdOrder && (
              <motion.div
                key="confirmation"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  'p-8 rounded-xl border',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white shadow-sm'
                )}
              >
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* Success Animation Header */}
                  <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <motion.div
                      className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    >
                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                    </motion.div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      ¡Orden Creada con Éxito!
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Su orden ha sido registrada correctamente
                    </p>
                  </motion.div>

                  {/* Order Details Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className={cn(
                      'p-5 rounded-xl border-2 border-green-200 dark:border-green-800',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-green-50/50 shadow-sm'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Detalles de la Orden
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Número de Orden</p>
                          <p className="text-base font-bold text-gray-900 dark:text-white">
                            {createdOrder.orderNumber}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Cliente</p>
                          <p className="text-base font-medium text-gray-900 dark:text-white">
                            {createdOrder.customerName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Servicios</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {createdOrder.services.map((service, index) => (
                              <span
                                key={index}
                                className={cn(
                                  "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
                                  theme === 'dark'
                                    ? 'bg-blue-900/30 text-blue-400'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                )}
                              >
                                {service}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {createdOrder.scheduledDate && (
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Fecha Programada</p>
                            <p className="text-base font-medium text-gray-900 dark:text-white">
                              {new Date(createdOrder.scheduledDate).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        )}
                        {createdOrder.timeSlot && (
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Horario</p>
                            <p className="text-base font-medium text-gray-900 dark:text-white">
                              {createdOrder.timeSlot}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Total Estimado</p>
                          <p className="text-base font-bold text-green-600 dark:text-green-400">
                            ${createdOrder.total.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Receipt Actions */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-4"
                  >
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Opciones del Recibo
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Envíe el recibo o imprímalo para el cliente
                      </p>
                    </div>

                    {/* Send Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <motion.button
                        onClick={handleSendEmail}
                        disabled={loading}
                        className={cn(
                          'p-4 rounded-lg border-2 border-dashed transition-all',
                          theme === 'dark'
                            ? 'hover:border-blue-300 hover:bg-blue-900/20'
                            : 'hover:border-red-400 hover:bg-red-50',
                          theme === 'dark'
                            ? 'border-gray-700 bg-gray-800/50'
                            : 'border-gray-300 bg-white/50 shadow-sm',
                          loading && 'opacity-50 cursor-not-allowed'
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Mail className={cn(
                          "w-6 h-6 mx-auto mb-2",
                          theme === 'dark' ? 'text-blue-600' : 'text-red-600'
                        )} />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                          Enviar por Email
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Recibo al correo del cliente
                        </p>
                      </motion.button>

                      <motion.button
                        onClick={handleSendSMS}
                        disabled={loading}
                        className={cn(
                          'p-4 rounded-lg border-2 border-dashed transition-all',
                          'hover:border-green-300 hover:bg-green-50 dark:hover:border-green-700 dark:hover:bg-green-900/20',
                          theme === 'dark'
                            ? 'border-gray-700 bg-gray-800/50'
                            : 'border-gray-300 bg-white/50 shadow-sm',
                          loading && 'opacity-50 cursor-not-allowed'
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Phone className="w-6 h-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                          Enviar por SMS
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Resumen por mensaje de texto
                        </p>
                      </motion.button>
                    </div>

                    {/* Print Options */}
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Opciones de Impresión
                      </p>
                      <div className="flex justify-center gap-2">
                        <motion.button
                          onClick={() => handlePrintReceipt('80mm')}
                          className={cn(
                            'px-3 py-2 rounded-lg border transition-all text-sm',
                            'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600',
                            'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          )}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Printer className="w-3 h-3 mr-1 inline" />
                          Ticket 80mm
                        </motion.button>
                        <motion.button
                          onClick={() => handlePrintReceipt('letter')}
                          className={cn(
                            'px-3 py-2 rounded-lg border transition-all text-sm',
                            'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600',
                            'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          )}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <FileText className="w-3 h-3 mr-1 inline" />
                          Factura
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>

                  {/* Action Buttons */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex gap-3"
                  >
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStep('search')
                        setCreatedOrder(null)
                        setFoundCustomer(null)
                        setOrderData({
                          customerId: 0,
                          customerName: '',
                          services: [],
                          notes: '',
                          scheduledDate: '',
                          timeSlot: '',
                          serviceQuantities: {},
                          needsBoxConstruction: {},
                          boxSizes: {},
                          boxSelections: {},
                          customerAddress: '',
                          customerAddressObject: null,
                          paymentMethod: 'cash_on_delivery',
                          status: 'pending'
                        })
                      }}
                      className="flex-1"
                    >
                      <Plus className="w-3 h-3 mr-2" />
                      Nueva Orden
                    </Button>
                    <Button
                      onClick={() => router.push('/dashboard/admin/package-orders')}
                      className={cn(
                        "flex-1 text-white transition-colors",
                        theme === 'dark'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-red-600 hover:bg-red-700'
                      )}
                    >
                      Ver Órdenes
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Box Size Selection Modal */}
        <AnimatePresence>
          {showSizeModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClick={cancelSizeSelection}
            >
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={cancelSizeSelection}
              />

              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="relative w-full max-w-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className={cn(
                  'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
                  'overflow-hidden'
                )}>
                  {/* Header */}
                  <div className={cn(
                    'relative px-6 py-4 border-b',
                    theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-100'
                      )}>
                        <Box className={cn(
                          'w-6 h-6',
                          theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        )} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          Seleccionar Tamaño de Caja
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Elige el tamaño adecuado para tu servicio: {selectedServiceForSize}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={cancelSizeSelection}
                      className={cn(
                        'absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-400'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Size Selections */}
                  <div className="p-6">
                    <div className="space-y-4">
                      {/* Current Selections */}
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Tus Selecciones</h4>
                        {tempBoxSelections.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                            No has agregado ninguna caja aún
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {tempBoxSelections.map((selection, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className={cn(
                                  'p-4 rounded-lg border',
                                  theme === 'dark'
                                    ? 'border-gray-700 bg-gray-800'
                                    : 'border-gray-200 bg-white'
                                )}
                              >
                                <div className="flex items-start gap-4">
                                  {/* Size Selection */}
                                  <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                      Tamaño
                                    </label>
                                    <select
                                      value={selection.size}
                                      onChange={(e) => updateBoxSelection(index, 'size', e.target.value)}
                                      className={cn(
                                        'w-full px-3 py-2 rounded-lg border transition-colors',
                                        'focus:outline-none focus:ring-2 focus:ring-blue-500',
                                        theme === 'dark'
                                          ? 'bg-gray-700 border-gray-600 text-white'
                                          : 'bg-white border-gray-300 text-gray-900'
                                      )}
                                    >
                                      {BOX_SIZES.map(size => (
                                        <option key={size.id} value={size.id}>
                                          {size.name}{selectedServiceForSize?.toLowerCase().includes('entrega') ? '' : ` - $${size.price}`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Quantity */}
                                  <div className="w-32">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                      Cantidad
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={selection.quantity}
                                      onChange={(e) => updateBoxSelection(index, 'quantity', e.target.value)}
                                      className={cn(
                                        'w-full px-3 py-2 rounded-lg border transition-colors',
                                        'focus:outline-none focus:ring-2 focus:ring-blue-500',
                                        theme === 'dark'
                                          ? 'bg-gray-700 border-gray-600 text-white'
                                          : 'bg-white border-gray-300 text-gray-900'
                                      )}
                                    />
                                  </div>

                                  {/* Construction Checkbox - Ocultar para servicios de entrega */}
                                  {!selectedServiceForSize?.toLowerCase().includes('entrega') && (
                                    <div className="flex items-center">
                                      <input
                                        type="checkbox"
                                        id={`construction-${index}`}
                                        checked={selection.needsConstruction}
                                        onChange={(e) => updateBoxSelection(index, 'needsConstruction', e.target.checked)}
                                        className="mr-2 text-blue-500 focus:ring-blue-500"
                                      />
                                      <label
                                        htmlFor={`construction-${index}`}
                                        className="text-sm text-gray-700 dark:text-gray-300"
                                      >
                                        Confección (+$5)
                                      </label>
                                    </div>
                                  )}

                                  {/* Remove Button */}
                                  <button
                                    onClick={() => removeBoxSelection(index)}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Selection Details */}
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {(() => {
                                      const sizeInfo = BOX_SIZES.find(s => s.id === selection.size)
                                      const isDeliveryService = selectedServiceForSize?.toLowerCase().includes('entrega')

                                      if (isDeliveryService) {
                                        return (
                                          <div>
                                            <span>{sizeInfo?.dimensions || ''}</span>
                                            <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                                              Servicio gratuito
                                            </span>
                                          </div>
                                        )
                                      } else {
                                        const unitPrice = (sizeInfo?.price || 55) + (selection.needsConstruction ? BOX_CONSTRUCTION_COST : 0)
                                        return (
                                          <div>
                                            <span>{sizeInfo?.dimensions || ''}</span>
                                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                              ${unitPrice} × {selection.quantity} = ${(unitPrice * selection.quantity).toFixed(2)}
                                            </span>
                                          </div>
                                        )
                                      }
                                    })()}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add Selection Button */}
                      <motion.button
                        onClick={addBoxSelection}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full p-4 border-2 border-dashed border-blue-400 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200"
                      >
                        <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400">
                          <Plus className="w-5 h-5" />
                          <span className="font-medium">Agregar otra caja</span>
                        </div>
                      </motion.button>

                      {/* Construction Cost Note */}
                      <div className={cn(
                        'mt-6 p-4 rounded-lg border',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-700'
                          : 'bg-blue-50 border-blue-200'
                      )}>
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                              Confección de Caja
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Si necesitas que confeccionemos la caja, se agregará un costo adicional de ${BOX_CONSTRUCTION_COST} por unidad.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className={cn(
                    'px-6 py-4 border-t flex gap-3 justify-end',
                    theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                  )}>
                    <Button
                      variant="outline"
                      onClick={cancelSizeSelection}
                      className={cn(
                        theme === 'dark'
                          ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={confirmSizeSelection}
                      className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    >
                      Confirmar Selección
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}