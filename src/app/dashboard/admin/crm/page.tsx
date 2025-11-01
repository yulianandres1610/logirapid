'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Building2,
  TrendingUp,
  FileText,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Home,
  Globe,
  Phone,
  MapPin,
  Mail,
  Calendar,
  Activity,
  Zap,
  Shield,
  Star,
  UserCheck,
  User,
  Package,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  DollarSign,
  ChevronFirst,
  ChevronLast,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import DepartmentPill from '@/components/ui/department-pill'
import NotificationPopup from '@/components/ui/NotificationPopup'
import MapboxAddressAutofill from '@/components/ui/MapboxAddressAutofill'
import { Fragment } from 'react'

// Función para remover ceros iniciales de direcciones
const removeLeadingZeros = (address: string): string => {
  if (!address) return address
  return address.replace(/^0+/, '')
}

interface Customer {
  id: number
  fullName: string
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
  idType?: string
  idNumber?: string
  notes?: string
  createdAt: string
}

interface Order {
  id: number
  orderNumber: string
  customerId: number
  amount: number
  status: 'pending' | 'completed' | 'cancelled'
  createdAt: string
}

interface CallCenterNote {
  id: number
  customerId: number
  note: string
  createdBy: string
  createdAt: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  departments: string[]
}

interface Transaction {
  id: number
  customerId: number
  type: 'payment' | 'refund' | 'credit'
  amount: number
  description: string
  createdAt: string
}

// Funciones para obtener datos de ejemplo
const getSampleOrders = (customerId: number): Order[] => [
  {
    id: 1,
    orderNumber: 'ORD-2024-001',
    customerId,
    amount: 150.00,
    status: 'completed',
    createdAt: '2024-01-15T10:30:00Z'
  },
  {
    id: 2,
    orderNumber: 'ORD-2024-002',
    customerId,
    amount: 75.50,
    status: 'pending',
    createdAt: '2024-01-20T14:15:00Z'
  }
]

const getSampleCallCenterNotes = (customerId: number): CallCenterNote[] => [
  // Array vacío - no hay notas de prueba
]

const getSampleTransactions = (customerId: number): Transaction[] => [
  // Array vacío - no hay transacciones de prueba
]

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'text-red-600 bg-red-100 border-red-200'
    case 'high':
      return 'text-orange-600 bg-orange-100 border-orange-200'
    case 'medium':
      return 'text-yellow-600 bg-yellow-100 border-yellow-200'
    case 'low':
      return 'text-green-600 bg-green-100 border-green-200'
    default:
      return 'text-gray-600 bg-gray-100 border-gray-200'
  }
}

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'Urgente'
    case 'high':
      return 'Alta'
    case 'medium':
      return 'Media'
    case 'low':
      return 'Baja'
    default:
      return 'Sin definir'
  }
}

export default function CRMPage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { showNotification } = useNotifications()
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'orders' | 'notes' | 'transactions'>('orders')
  const [customerNotes, setCustomerNotes] = useState<CallCenterNote[]>([])
  const [customerOrders, setCustomerOrders] = useState<Order[]>([])
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    idNumber: '',
    idType: '',
    phone: '',
    email: '',
    streetAddress: '', // Dirección/calle principal con autocompletado
    state: '',         // Estado/provincia
    city: '',          // Ciudad/municipio
    postalCode: '',    // Código postal
    country: ''
  })

  // Estados para autocompletado de direcciones
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)

  // Función para buscar direcciones usando nuestro API interno (solo Estados Unidos)
  const searchAddressSuggestions = async (query: string) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([])
      setShowAddressSuggestions(false)
      return
    }

    setIsLoadingAddress(true)
    try {
      const response = await fetch(
        `/api/address-lookup?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        const suggestions = data.suggestions || []
        setAddressSuggestions(suggestions)
        setShowAddressSuggestions(true)
      } else {
        console.error('Address lookup API error:', response.status)
        setAddressSuggestions([])
      }
    } catch (error) {
      console.error('Error searching address suggestions:', error)
      setAddressSuggestions([])
    } finally {
      setIsLoadingAddress(false)
    }
  }

  // Función para manejar la selección de una dirección sugerida
  const selectAddressSuggestion = (suggestion: any) => {
    // Si la API ya devuelve los datos separados, usarlos directamente
    if (suggestion.address.street && suggestion.address.city && suggestion.address.state) {
      setEditForm({
        ...editForm,
        streetAddress: suggestion.address.street,
        city: suggestion.address.city,
        state: suggestion.address.state,
        postalCode: suggestion.address.postalCode,
        country: suggestion.address.country
      })
    } else {
      // Si no, parsear el display_name para extraer los componentes
      const addressParts = suggestion.display_name.split(',').map((part: string) => part.trim())

      let streetAddress = suggestion.address.street || addressParts[0] || ''
      let city = suggestion.address.city || ''
      let state = suggestion.address.state || ''
      let postalCode = suggestion.address.postalCode || ''

      // Intentar extraer ciudad, estado y zip code de las partes restantes
      if (addressParts.length >= 2 && !city) {
        city = addressParts[addressParts.length - 3] || ''
      }

      if (addressParts.length >= 1 && !state) {
        // Buscar estado en las partes o extraer del penúltimo elemento
        const statePart = addressParts[addressParts.length - 2] || ''
        // Extraer zip code si existe en el formato "State CP #####"
        const zipMatch = statePart.match(/CP\s*(\d{5})/)
        if (zipMatch) {
          postalCode = zipMatch[1]
          state = statePart.replace(/CP\s*\d{5}/, '').trim()
        } else {
          state = statePart
        }
      }

      // Si aún no hay postal code, buscarlo en las partes
      if (!postalCode) {
        for (const part of addressParts) {
          const zipMatch = part.match(/\b\d{5}\b/)
          if (zipMatch) {
            postalCode = zipMatch[0]
            break
          }
        }
      }

      setEditForm({
        ...editForm,
        streetAddress,
        city,
        state,
        postalCode,
        country: suggestion.address.country || 'United States'
      })
    }

    setShowAddressSuggestions(false)
    setAddressSuggestions([])
  }

  // Función para manejar cambios en el campo de dirección
  const handleStreetAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEditForm({...editForm, streetAddress: value})

    // Buscar sugerencias solo si el usuario está escribiendo
    if (value.length >= 3) {
      searchAddressSuggestions(value)
    } else {
      setShowAddressSuggestions(false)
      setAddressSuggestions([])
    }
  }
  const [changeHistory, setChangeHistory] = useState<any[]>([])
  const [newNote, setNewNote] = useState({
    note: '',
    priority: 'medium' as 'urgent' | 'high' | 'medium' | 'low',
    departments: [] as string[]
  })

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Form states for customer creation
  const [formStep, setFormStep] = useState(1)
  const [formData, setFormData] = useState({
    fullName: '',
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
    idType: '',
    idNumber: ''
  })

  const countries = [
    { code: 'CU', name: 'Cuba', states: ['La Habana', 'Santiago de Cuba', 'Camagüey', 'Holguín', 'Santa Clara', 'Varadero', 'Cienfuegos', 'Pinar del Río'] },
    { code: 'US', name: 'Estados Unidos', states: ['Florida', 'California', 'Texas', 'New York', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia'] },
    { code: 'ES', name: 'España', states: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Málaga', 'Bilbao', 'Zaragoza', 'Las Palmas'] },
    { code: 'MX', name: 'México', states: ['Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana', 'León', 'Juárez', 'Torreón'] },
    { code: 'CA', name: 'Canadá', states: ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Nova Scotia', 'New Brunswick'] }
  ]

  const idTypes = [
    { value: 'passport', label: 'Pasaporte' },
    { value: 'carnet_identidad', label: 'Carnet de Identidad' },
    { value: 'licencia_conducir', label: 'Licencia de Conducir' },
    { value: 'tarjeta_residencia', label: 'Tarjeta de Recidencia' }
  ]

  useEffect(() => {
    loadCustomers()
    // Obtener rol del usuario de las cookies
    const getRole = document.cookie
      .split('; ')
      .find(row => row.startsWith('user-role='))
      ?.split('=')[1]
    setUserRole(getRole || null)
  }, [])

  const loadCustomers = async () => {
    try {
      setLoading(true)
      console.log('🔄 CRM - Cargando clientes...')
      const response = await fetch('/api/crm/customers')
      console.log('📡 CRM - Response status:', response.status)
      const data = await response.json()
      console.log('📊 CRM - Datos recibidos:', data)

      if (data.success) {
        console.log('✅ CRM - Clientes cargados:', data.data.length, 'clientes')
        setCustomers(data.data)
      } else {
        console.log('❌ CRM - Error en respuesta:', data)
        showNotification('error', 'Error', 'Error al cargar clientes')
      }
    } catch (error) {
      console.log('💥 CRM - Error al cargar:', error)
      showNotification('error', 'Error', 'Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const validatePhoneNumber = (phone: string, country?: string): { valid: boolean; error?: string } => {
    const cleanedPhone = phone.replace(/\s+/g, '').replace(/[-()]/g, '').replace(/^\+/, '')

    if (!cleanedPhone || isNaN(Number(cleanedPhone))) {
      return { valid: false, error: 'El teléfono debe contener solo números' }
    }

    if (country === 'Cuba' || country === 'CU') {
      if (cleanedPhone.length !== 8) {
        return { valid: false, error: 'El teléfono para Cuba debe tener 8 dígitos (ej: 5xxxxxxxx)' }
      }
      if (!cleanedPhone.startsWith('5')) {
        return { valid: false, error: 'El teléfono móvil para Cuba debe comenzar con 5 (ej: 5xxxxxxxx)' }
      }
    } else if (country === 'Estados Unidos' || country === 'United States' || country === 'US' || country === 'USA') {
      if (cleanedPhone.length !== 10) {
        return { valid: false, error: 'El teléfono para Estados Unidos debe tener 10 dígitos' }
      }
    } else {
      if (cleanedPhone.length < 8 || cleanedPhone.length > 15) {
        return { valid: false, error: 'El teléfono debe tener entre 8 y 15 dígitos' }
      }
    }

    return { valid: true }
  }

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      // Name & Contact validation
      if (!formData.fullName.trim()) {
        showNotification('error', 'Error', 'El nombre completo es obligatorio')
        return false
      }
      if (!formData.phone.trim()) {
        showNotification('error', 'Error', 'El número de teléfono es obligatorio')
        return false
      }
      if (!formData.email.trim()) {
        showNotification('error', 'Error', 'El correo electrónico es obligatorio')
        return false
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        showNotification('error', 'Error', 'El correo electrónico no es válido')
        return false
      }
    } else if (step === 2) {
      // Address validation - comprehensive check for Mapbox component
      const address = formData.address
      const street = address?.street || ''
      const city = address?.city || ''
      const state = address?.state || ''
      const country = address?.country || ''
      const zipCode = address?.zipCode || ''

      console.log('🔥 Validando dirección:', {
        street,
        city,
        state,
        country,
        zipCode,
        fullAddress: formData.address,
        addressType: typeof formData.address
      })

      // Multiple validation checks
      const hasValidStreet = street && street.trim().length > 0
      const hasValidCity = city && city.trim().length > 0
      const hasValidState = state && state.trim().length > 0
      const hasValidCountry = country && country.trim().length > 0

      // Check if any address field has content
      const hasAnyAddressData = hasValidStreet || hasValidCity || hasValidState || hasValidCountry || zipCode

      console.log('🔥 Resultados de validación:', {
        hasValidStreet,
        hasValidCity,
        hasValidState,
        hasValidCountry,
        hasAnyAddressData,
        streetLength: street.length,
        cityLength: city.length
      })

      // Very flexible validation - accept if we have any address data
      if (hasAnyAddressData) {
        console.log('✅ Dirección válida - se encontraron datos de dirección')
        return true
      } else {
        console.log('❌ Dirección inválida - no se encontraron datos')
        showNotification('error', 'Error', 'Por favor seleccione o ingrese una dirección')
        return false
      }

      // City can be filled later from Mapbox, so we'll allow it to be empty for now
      // if (!city.trim()) {
      //   showNotification('error', 'Error', 'La ciudad es obligatoria')
      //   return false
      // }
      // Country can also be filled later, so we'll skip this validation for now
      // if (!formData.address.country.trim()) {
      //   showNotification('error', 'Error', 'El país es obligatorio')
      //   return false
      // }
    } else if (step === 3) {
      // ID Information validation
      if (!formData.idType) {
        showNotification('error', 'Error', 'El tipo de identificación es obligatorio')
        return false
      }
      if (!formData.idNumber.trim()) {
        showNotification('error', 'Error', 'El número de identificación es obligatorio')
        return false
      }
    }

    return true
  }

  const handleNextStep = () => {
    console.log('🔥 handleNextStep llamado. Paso actual:', formStep)
    console.log('🔥 formData actual:', JSON.stringify(formData, null, 2))

    // Give React more time to update state before validation
    setTimeout(() => {
      console.log('🔥 Ejecutando validación después de timeout...')
      console.log('🔥 formData después de timeout:', JSON.stringify(formData, null, 2))

      if (validateStep(formStep)) {
        if (formStep < 4) {
          console.log('✅ Validación pasó, avanzando al paso:', formStep + 1)
          setFormStep(formStep + 1)
        }
      } else {
        console.log('❌ Validación falló')
      }
    }, 300) // Increased timeout to 300ms
  }

  // Debug function to manually check form data
  const debugFormData = () => {
    console.log('🐛 DEBUG - Form Data Actual:', JSON.stringify(formData, null, 2))
    console.log('🐛 DEBUG - Address Object:', JSON.stringify(formData.address, null, 2))
    console.log('🐛 DEBUG - Address Street:', formData.address?.street)
    console.log('🐛 DEBUG - Address City:', formData.address?.city)
    console.log('🐛 DEBUG - Form Step:', formStep)
  }

  const handlePrevStep = () => {
    if (formStep > 1) {
      setFormStep(formStep - 1)
    }
  }

  const handleCreateCustomer = async () => {
    console.log('🚀 Creando cliente con datos:', JSON.stringify(formData, null, 2))

    if (!validateStep(formStep)) {
      console.log('❌ Validación final falló')
      return
    }

    try {
      setLoading(true)

      // Prepare data for API - ensure address is properly structured
      const customerData = {
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        address: {
          street: formData.address.street || '',
          apartment: formData.address.apartment || '',
          city: formData.address.city || '',
          state: formData.address.state || '',
          zipCode: formData.address.zipCode || '',
          country: formData.address.country || ''
        },
        idType: formData.idType,
        idNumber: formData.idNumber,
        createdBy: 'admin'
      }

      console.log('📤 Enviando datos al API:', JSON.stringify(customerData, null, 2))

      const response = await fetch('/api/crm/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData)
      })

      const data = await response.json()
      console.log('📥 Respuesta del API:', data)

      if (data.success) {
        showNotification('success', 'Éxito', 'Cliente creado exitosamente')
        loadCustomers()
        setTimeout(() => {
          setViewMode('list')
          resetForm()
          // Success handled by notification
        }, 2000)
      } else {
        console.log('❌ Error del API:', data.error)
        showNotification('error', 'Error', data.error || 'Error al crear cliente')
      }
    } catch (error) {
      console.error('❌ Error en creación:', error)
      showNotification('error', 'Error', 'Error al conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      fullName: '',
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
      idType: '',
      idNumber: ''
    })
    setFormStep(1)
  }

  const handleCreateNote = async () => {
    if (!newNote.note.trim()) {
      showNotification('error', 'Error', 'La nota no puede estar vacía')
      return
    }

    if (!selectedCustomer?.id) {
      showNotification('error', 'Error', 'No hay cliente seleccionado')
      return
    }

    if (!user?.name) {
      showNotification('error', 'Error', 'Usuario no autenticado')
      return
    }

    try {
      const response = await fetch('/api/crm/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          note: newNote.note.trim(),
          createdBy: user.name,
          priority: newNote.priority,
          departments: newNote.departments
        })
      })

      const result = await response.json()

      if (result.success) {
        // Recargar notas desde la API
        await loadCustomerNotes(selectedCustomer.id)
        setNewNote({ note: '', priority: 'medium', departments: [] })
        setShowNoteForm(false)
        showNotification('success', 'Éxito', 'Nota creada exitosamente')
        // No need for setTimeout - notification auto-handles
      } else {
        showNotification('error', 'Error', result.error || 'Error al crear nota')
      }
    } catch (error) {
      console.error('Error creating note:', error)
      showNotification('error', 'Error', 'Error al crear nota')
    }
  }

  const loadCustomerNotes = async (customerId: number) => {
    try {
      const response = await fetch(`/api/crm/notes?customerId=${customerId}`)
      const result = await response.json()

      if (result.success) {
        setCustomerNotes(result.data || [])
      } else {
        console.error('Error loading notes:', result.error)
        setCustomerNotes([])
      }
    } catch (error) {
      console.error('Error loading notes:', error)
      setCustomerNotes([])
    }
  }

  const loadCustomerOrders = async (customerId: number) => {
    try {
      const response = await fetch(`/api/crm/orders?customerId=${customerId}`)
      const result = await response.json()

      if (result.success) {
        setCustomerOrders(result.data || [])
      } else {
        console.error('Error loading orders:', result.error)
        setCustomerOrders([])
      }
    } catch (error) {
      console.error('Error loading orders:', error)
      setCustomerOrders([])
    }
  }

  const loadCustomerHistory = async (customerId: number) => {
    try {
      const response = await fetch(`/api/crm/customers/history?customerId=${customerId}`)
      const result = await response.json()

      if (result.success) {
        setChangeHistory(result.data || [])
      } else {
        console.error('Error loading customer history:', result.error)
        setChangeHistory([])
      }
    } catch (error) {
      console.error('Error loading customer history:', error)
      setChangeHistory([])
    }
  }

  const handleViewCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setViewMode('detail')
    // Cargar notas del cliente
    await loadCustomerNotes(customer.id)
    // Cargar órdenes del cliente
    await loadCustomerOrders(customer.id)
    // Cargar historial de cambios
    await loadCustomerHistory(customer.id)
  }

  const handleEditCustomer = () => {
    if (!selectedCustomer || !user?.name) return

    setEditForm({
      firstName: (selectedCustomer as any).firstName || (selectedCustomer.fullName || '').split(' ')[0] || '',
      lastName: (selectedCustomer as any).lastName || (selectedCustomer.fullName || '').split(' ').slice(1).join(' ') || '',
      idNumber: selectedCustomer.idNumber || '',
      idType: selectedCustomer.idType || '',
      phone: selectedCustomer.phone,
      email: selectedCustomer.email || '',
      streetAddress: selectedCustomer.address?.street || '',
      city: selectedCustomer.address?.city || '',
      state: selectedCustomer.address?.state || '',
      postalCode: selectedCustomer.address?.zipCode || '',
      country: selectedCustomer.address?.country || ''
    })
    // Limpiar sugerencias de autocompletado
    setAddressSuggestions([])
    setShowAddressSuggestions(false)
    setIsLoadingAddress(false)
    setShowEditForm(true)
    setShowHistory(false)
  }

  // Función para editar cliente desde la tabla (selecciona primero el cliente)
  const handleEditCustomerFromTable = (customer: any) => {
    if (!customer || !user?.name) return

    // Seleccionar el cliente
    setSelectedCustomer(customer)

    // Poblar el formulario con los datos del cliente
    setEditForm({
      firstName: customer.fullName || `${(customer as any).firstName || ''} ${(customer as any).lastName || ''}`.trim(),
      lastName: '', // Will be empty since we now use fullName
      idNumber: customer.idNumber || '',
      idType: customer.idType || '',
      phone: customer.phone,
      email: customer.email || '',
      streetAddress: customer.address?.street || '',
      city: customer.address?.city || '',
      state: customer.address?.state || '',
      postalCode: customer.address?.zipCode || '',
      country: customer.address?.country || ''
    })

    // Limpiar sugerencias de autocompletado
    setAddressSuggestions([])
    setShowAddressSuggestions(false)
    setIsLoadingAddress(false)

    // Mostrar el formulario de edición
    setShowEditForm(true)
  }

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer?.id || !user?.name) {
      showNotification('error', 'Error', 'Usuario no autenticado o cliente no seleccionado')
      return
    }

    try {
      const response = await fetch('/api/crm/customers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedCustomer.id,
          changedBy: user.name,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          idNumber: editForm.idNumber,
          idType: editForm.idType,
          phone: editForm.phone,
          email: editForm.email,
          // Construir dirección completa
          address: `${editForm.streetAddress}${editForm.city ? ', ' + editForm.city : ''}${editForm.state ? ', ' + editForm.state : ''}${editForm.postalCode ? ', CP ' + editForm.postalCode : ''}`,
          city: editForm.city,
          state: editForm.state,
          country: editForm.country,
          notes: '' // Campo notes vacío como se solicitó
        })
      })

      const result = await response.json()

      if (result.success) {
        // Actualizar el cliente seleccionado
        const updatedCustomer = {
          ...selectedCustomer,
          ...editForm
        }
        setSelectedCustomer(updatedCustomer)

        // Actualizar la lista de clientes
        setCustomers(prevCustomers =>
          prevCustomers.map(customer =>
            customer.id === selectedCustomer.id ? updatedCustomer : customer
          )
        )

        // Recargar historial
        await loadCustomerHistory(selectedCustomer.id)

        setShowEditForm(false)
        showNotification('success', 'Éxito', 'Cliente actualizado exitosamente')
      } else {
        showNotification('error', 'Error', result.error || 'Error al actualizar cliente')
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      showNotification('error', 'Error', 'Error al actualizar cliente')
    }
  }

  const handleDeleteCustomer = async (customerId: number, customerName: string) => {
    // Confirmar eliminación
    const confirmed = window.confirm(
      `¿Estás seguro que deseas eliminar al cliente "${customerName}"?\n\nEsta acción es irreversible y eliminará toda la información relacionada con el cliente.`
    )

    if (!confirmed) return

    try {
      setLoading(true)
      const response = await fetch(`/api/crm/customers?id=${customerId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Éxito', 'Cliente eliminado exitosamente')

        // Si el cliente eliminado estaba seleccionado, volver a la lista
        if (selectedCustomer?.id === customerId) {
          setSelectedCustomer(null)
          setViewMode('list')
        }

        // Recargar la lista de clientes
        await loadCustomers()
      } else {
        showNotification('error', 'Error', data.error || 'Error al eliminar cliente')
      }
    } catch (error) {
      console.error('Error deleting customer:', error)
      showNotification('error', 'Error', 'Error al eliminar cliente')
    } finally {
      setLoading(false)
    }
  }

  const handleShowHistory = async () => {
    if (!selectedCustomer?.id) return

    setShowHistory(true)
    setShowEditForm(false)
    await loadCustomerHistory(selectedCustomer.id)
  }

  // Search across all customers
  const filteredCustomers = customers.filter(customer => {
    const displayName = customer.fullName || `${(customer as any).firstName || ''} ${(customer as any).lastName || ''}`.trim()
    const addressSearch = customer.address ?
      (typeof customer.address === 'string' ? customer.address : customer.address.street) || '' : ''

    return displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.idNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      addressSearch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.address?.city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.address?.country || '').toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Pagination logic
  const totalCustomers = filteredCustomers.length
  const totalPages = Math.ceil(totalCustomers / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex)

  // Reset to page 1 when searching
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const selectedCountry = countries.find(c => c.name === formData.address?.country)
  const availableStates = selectedCountry ? selectedCountry.states : []

  return (
    <Fragment>
      <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          </div>

        
        {/* List View */}
        {viewMode === 'list' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Header with Search and Actions */}
            <div className={cn(
              "mb-6 p-6 rounded-lg border",
              theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
            )}>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className={cn(
                      "absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )} />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, teléfono, email, país..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={cn(
                        "w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                          : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500"
                      )}
                    />
                  </div>
                  <Button
                    className={cn(
                      "px-4 py-3 text-white",
                      theme === 'dark'
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-[#cc0a46] hover:bg-[#b0093d]"
                    )}
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Filtros
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => setViewMode('create')}
                    className={cn(
                      "px-4 py-3 text-white",
                      theme === 'dark'
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-[#cc0a46] hover:bg-[#b0093d]"
                    )}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Cliente
                  </Button>
                </div>
              </div>

              {/* Results Summary */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Mostrando {paginatedCustomers.length} de {totalCustomers} clientes
                  {searchTerm && ` (filtrados de "${searchTerm}")`}
                </p>

                {/* Items per page selector */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Filas por página:
                  </span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className={cn(
                      "px-3 py-1 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    )}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Customer Table */}
            <div className={cn(
              "overflow-hidden rounded-lg border",
              theme === 'dark' ? "border-gray-700" : "border-gray-200"
            )}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
                  <p className={cn(
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Cargando clientes...
                  </p>
                </div>
              ) : paginatedCustomers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={cn(
                      "border-b",
                      theme === 'dark' ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
                    )}>
                      <tr>
                        <th className={cn(
                          "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Cliente
                        </th>
                        <th className={cn(
                          "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Contacto
                        </th>
                        <th className={cn(
                          "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Ubicación
                        </th>
                        <th className={cn(
                          "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Registrado
                        </th>
                        <th className={cn(
                          "px-6 py-4 text-right text-xs font-medium uppercase tracking-wider",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className={cn(
                      "divide-y",
                      theme === 'dark' ? "divide-gray-700" : "divide-gray-200"
                    )}>
                      {paginatedCustomers.map((customer, index) => (
                        <motion.tr
                          key={customer.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            "hover:bg-opacity-50 cursor-pointer transition-colors",
                            theme === 'dark'
                              ? "hover:bg-gray-700/50"
                              : "hover:bg-blue-50/50"
                          )}
                          onClick={() => handleViewCustomer(customer)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center mr-3",
                                theme === 'dark' ? "bg-blue-600/20" : "bg-blue-100"
                              )}>
                                <User className={cn(
                                  "w-5 h-5",
                                  theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                )} />
                              </div>
                              <div>
                                <div className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-white" : "text-gray-900"
                                )}>
                                  {customer.fullName || `${(customer as any).firstName || ''} ${(customer as any).lastName || ''}`.trim()}
                                </div>
                                {customer.idNumber && (
                                  <div className={cn(
                                    "text-xs",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                  )}>
                                    ID: {customer.idNumber}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <Phone className={cn(
                                  "w-4 h-4 mr-1",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )} />
                                <span className={cn(
                                  "text-sm",
                                  theme === 'dark' ? "text-gray-300" : "text-gray-900"
                                )}>
                                  {customer.phone}
                                </span>
                              </div>
                              {customer.email && (
                                <div className="flex items-center">
                                  <Mail className={cn(
                                    "w-4 h-4 mr-1",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                  )} />
                                  <span className={cn(
                                    "text-xs truncate max-w-[200px]",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                    {customer.email}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {customer.address?.country && (
                                <div className="flex items-center">
                                  <Globe className={cn(
                                    "w-4 h-4 mr-1",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                  )} />
                                  <span className={cn(
                                    "text-sm",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-900"
                                  )}>
                                    {customer.address?.country}
                                  </span>
                                </div>
                              )}
                              {/* Complete Address Display */}
                              {customer.address && (
                                <div className={cn(
                                  "text-xs space-y-1",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  {/* Street Address */}
                                  {customer.address?.street && (
                                    <div className="truncate max-w-[200px] flex items-center">
                                      <Home className="w-3 h-3 mr-1 text-gray-400 flex-shrink-0" />
                                      {removeLeadingZeros(customer.address?.street)}
                                      {customer.address?.apartment && ` ${removeLeadingZeros(customer.address?.apartment)}`}
                                    </div>
                                  )}
                                  {/* City, State, Zip Code */}
                                  {(customer.address?.city || customer.address?.state || customer.address?.zipCode) && (
                                    <div className="truncate max-w-[200px]">
                                      {customer.address?.city}
                                      {customer.address?.state && customer.address?.city && ", "}
                                      {customer.address?.state}
                                      {customer.address?.zipCode && (customer.address?.city || customer.address?.state) && " "}
                                      {customer.address?.zipCode}
                                    </div>
                                  )}
                                  {/* Country */}
                                  {customer.address?.country && (
                                    <div className="truncate max-w-[200px]">
                                      {customer.address?.country}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-900"
                            )}>
                              {new Date(customer.createdAt).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewCustomer(customer)
                                }}
                                className={cn(
                                  "text-blue-600 hover:text-blue-800",
                                  theme === 'dark' ? "hover:bg-blue-600/20" : "hover:bg-blue-50"
                                )}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditCustomerFromTable(customer)
                                }}
                                className={cn(
                                  "text-green-600 hover:text-green-800",
                                  theme === 'dark' ? "hover:bg-green-600/20" : "hover:bg-green-50"
                                )}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              {userRole === 'SUPER_ADMIN' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteCustomer(customer.id, customer.fullName || `${(customer as any).firstName || ''} ${(customer as any).lastName || ''}`.trim())
                                  }}
                                  className={cn(
                                    "text-[#cc0a46] hover:text-[#b0093d]",
                                    theme === 'dark' ? "hover:bg-red-600/20" : "hover:bg-[#cc0a46]/5"
                                  )}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className={cn(
                    "w-16 h-16 mx-auto mb-4",
                    theme === 'dark' ? "text-gray-600" : "text-gray-400"
                  )} />
                  <p className={cn(
                    "text-lg font-medium mb-2",
                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                  )}>
                    {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
                  </p>
                  <p className={cn(
                    "text-sm mb-4",
                    theme === 'dark' ? "text-gray-500" : "text-gray-500"
                  )}>
                    {searchTerm ? 'Intenta con otra búsqueda' : 'Crea tu primer cliente para comenzar'}
                  </p>
                  {!searchTerm && (
                    <Button
                      onClick={() => setViewMode('create')}
                      className={cn(
                        "text-white",
                        theme === 'dark'
                          ? "bg-blue-600 hover:bg-blue-700"
                          : "bg-[#cc0a46] hover:bg-[#b0093d]"
                      )}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Primer Cliente
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Página {currentPage} de {totalPages}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className={cn(
                      currentPage === 1 && "opacity-50 cursor-not-allowed",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    )}
                  >
                    <ChevronFirst className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={cn(
                      currentPage === 1 && "opacity-50 cursor-not-allowed",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    )}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNumber}
                          variant={currentPage === pageNumber ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNumber)}
                          className={cn(
                            "min-w-[2.5rem]",
                            currentPage === pageNumber
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : theme === 'dark'
                                ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                                : "border-gray-300 text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={cn(
                      currentPage === totalPages && "opacity-50 cursor-not-allowed",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    )}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className={cn(
                      currentPage === totalPages && "opacity-50 cursor-not-allowed",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    )}
                  >
                    <ChevronLast className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Modern Customer Creation Wizard */}
        {viewMode === 'create' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="min-h-screen"
          >
            <div className="max-w-5xl mx-auto px-6 py-6">
              {/* Header */}
              <div className="mb-6">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setViewMode('list')
                    resetForm()
                  }}
                  className={cn(
                    "mb-6 hover:bg-transparent group",
                    theme === 'dark' ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                  Volver al Listado
                </Button>

  
                {/* Modern Progress Indicator */}
                <div className="relative mb-8">
                  <div className="flex items-center justify-between">
                    {[1, 2, 3, 4].map((step) => (
                      <div key={step} className="flex-1 relative">
                        {/* Progress Line */}
                        {step < 4 && (
                          <div
                            className={cn(
                              "absolute top-5 left-1/2 w-full h-0.5 -translate-y-1/2 transition-colors duration-500",
                              formStep > step
                                ? theme === 'dark' ? "bg-blue-500" : "bg-red-500"
                                : theme === 'dark' ? "bg-gray-700" : "bg-gray-300"
                            )}
                          />
                        )}

                        {/* Step Circle */}
                        <div className="relative flex flex-col items-center">
                          <motion.div
                            className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300",
                              formStep >= step
                                ? theme === 'dark'
                                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                                  : "bg-red-500 text-white shadow-lg shadow-red-500/25"
                                : theme === 'dark'
                                  ? "bg-gray-700 text-gray-400"
                                  : "bg-gray-200 text-gray-600"
                            )}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {formStep > step ? (
                              <Check className="w-5 h-5" />
                            ) : (
                              step
                            )}
                          </motion.div>
                          <span className={cn(
                            "mt-2 text-xs font-medium transition-colors duration-300",
                            formStep >= step
                              ? theme === 'dark' ? "text-blue-400" : "text-red-500"
                              : theme === 'dark' ? "text-gray-500" : "text-gray-500"
                          )}>
                            {step === 1 && "Nombre y Contacto"}
                            {step === 2 && "Dirección"}
                            {step === 3 && "Identificación"}
                            {step === 4 && "Confirmación"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form Container */}
              <motion.div
                className={cn(
                  "rounded-2xl shadow-xl border overflow-hidden",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700"
                    : "bg-white border-gray-200"
                )}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <AnimatePresence mode="wait">
                  {/* Step 1: Name & Contact */}
                  {formStep === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="p-6"
                    >
                      <div className="mb-6">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                          theme === 'dark' ? "bg-blue-500/10" : "bg-red-500/10"
                        )}>
                          <User className={cn(
                            "w-6 h-6",
                            theme === 'dark' ? "text-blue-400" : "text-red-500"
                          )} />
                        </div>
                        <h2 className={cn(
                          "text-xl font-semibold mb-2",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          Información de Contacto
                        </h2>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Proporcione el nombre completo e información de contacto del cliente
                        </p>
                      </div>

                      <div className="space-y-6">
                        {/* Full Name Field */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Nombre Completo <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            className={cn(
                              "w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all duration-200",
                              theme === 'dark'
                                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                                : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-red-500 focus:border-red-500"
                            )}
                            placeholder="Ingrese el nombre completo del cliente"
                          />
                        </div>

                        {/* Phone Field */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Número de Teléfono <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className={cn(
                              "w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all duration-200",
                              theme === 'dark'
                                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                                : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-red-500 focus:border-red-500"
                            )}
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>

                        {/* Email Field */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Correo Electrónico <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className={cn(
                              "w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all duration-200",
                              theme === 'dark'
                                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                                : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-red-500 focus:border-red-500"
                            )}
                            placeholder="correo@ejemplo.com"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2: Address */}
                  {formStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="p-6"
                    >
                      <div className="mb-6">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                          theme === 'dark' ? "bg-blue-500/10" : "bg-red-500/10"
                        )}>
                          <MapPin className={cn(
                            "w-6 h-6",
                            theme === 'dark' ? "text-blue-400" : "text-red-500"
                          )} />
                        </div>
                        <h2 className={cn(
                          "text-xl font-semibold mb-2",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          Información de Dirección
                        </h2>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Use el buscador para encontrar la dirección automáticamente
                        </p>
                      </div>

                      <MapboxAddressAutofill
                        value={formData.address}
                        onChange={(address) => {
                          console.log('🔥 CRM PAGE - Mapbox onChange received:', address)
                          console.log('🔥 CRM PAGE - Full formData before update:', JSON.stringify(formData, null, 2))
                          const updatedFormData = { ...formData, address }
                          console.log('🔥 CRM PAGE - Full formData after update:', JSON.stringify(updatedFormData, null, 2))
                          setFormData(updatedFormData)
                        }}
                        required
                      />
                    </motion.div>
                  )}

                  {/* Step 3: ID Information */}
                  {formStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="p-6"
                    >
                      <div className="mb-6">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                          theme === 'dark' ? "bg-blue-500/10" : "bg-red-500/10"
                        )}>
                          <Shield className={cn(
                            "w-6 h-6",
                            theme === 'dark' ? "text-blue-400" : "text-red-500"
                          )} />
                        </div>
                        <h2 className={cn(
                          "text-xl font-semibold mb-2",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          Información de Identificación
                        </h2>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Seleccione el tipo de documento y proporcione el número de identificación
                        </p>
                      </div>

                      <div className="space-y-6">
                        {/* ID Type */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Tipo de Identificación <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.idType}
                            onChange={(e) => setFormData({ ...formData, idType: e.target.value })}
                            className={cn(
                              "w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all duration-200",
                              theme === 'dark'
                                ? "bg-gray-700 border-gray-600 text-white focus:ring-blue-500 focus:border-blue-500"
                                : "bg-gray-50 border-gray-300 text-gray-900 focus:ring-red-500 focus:border-red-500"
                            )}
                          >
                            <option value="">Seleccione un tipo de documento</option>
                            {idTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* ID Number */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Número de Documento <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formData.idNumber}
                            onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                            className={cn(
                              "w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 transition-all duration-200",
                              theme === 'dark'
                                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                                : "bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-red-500 focus:border-red-500"
                            )}
                            placeholder="Ingrese el número de documento"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4: Confirmation */}
                  {formStep === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="p-6"
                    >
                      <div className="mb-6">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                          theme === 'dark' ? "bg-green-500/10" : "bg-green-500/10"
                        )}>
                          <CheckCircle className={cn(
                            "w-6 h-6",
                            theme === 'dark' ? "text-green-400" : "text-green-500"
                          )} />
                        </div>
                        <h2 className={cn(
                          "text-xl font-semibold mb-2",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          Confirmar Información
                        </h2>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Verifique que toda la información sea correcta antes de crear el cliente
                        </p>
                      </div>

                      <div className="space-y-6">
                        {/* Contact Information */}
                        <div className={cn(
                          "p-4 rounded-lg border",
                          theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                        )}>
                          <h3 className={cn(
                            "font-medium mb-3 flex items-center",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            <User className="w-4 h-4 mr-2" />
                            Información de Contacto
                          </h3>
                          <div className="space-y-2">
                            <div className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              <span className="font-medium">Nombre Completo:</span> {formData.fullName}
                            </div>
                            <div className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              <span className="font-medium">Teléfono:</span> {formData.phone}
                            </div>
                            <div className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              <span className="font-medium">Email:</span> {formData.email}
                            </div>
                          </div>
                        </div>

                        {/* Address Information - Always show if any address data exists */}
                        {(formData.address.street || formData.address.city || formData.address.state || formData.address.country || formData.address.zipCode) && (
                          <div className={cn(
                            "p-4 rounded-lg border",
                            theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                          )}>
                            <h3 className={cn(
                              "font-medium mb-3 flex items-center",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              <MapPin className="w-4 h-4 mr-2" />
                              Dirección
                            </h3>
                            <div className={cn(
                              "text-sm space-y-1",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                                {formData.address.street && <div><span className="font-medium">Calle:</span> {formData.address.street}</div>}
                              {formData.address.apartment && <div><span className="font-medium">Apto/Suite:</span> {formData.address.apartment}</div>}
                              {formData.address.city && <div><span className="font-medium">Ciudad:</span> {formData.address.city}</div>}
                              {formData.address.state && <div><span className="font-medium">Estado:</span> {formData.address.state}</div>}
                              {formData.address.zipCode && <div><span className="font-medium">Código Postal:</span> {formData.address.zipCode}</div>}
                              {formData.address.country && <div><span className="font-medium">País:</span> {formData.address.country}</div>}
                            </div>
                          </div>
                        )}

                        {/* ID Information */}
                        {formData.idType && formData.idNumber && (
                          <div className={cn(
                            "p-4 rounded-lg border",
                            theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                          )}>
                            <h3 className={cn(
                              "font-medium mb-3 flex items-center",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              <Shield className="w-4 h-4 mr-2" />
                              Identificación
                            </h3>
                            <div className="space-y-2">
                              <div className={cn(
                                "text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                <span className="font-medium">Tipo:</span> {idTypes.find(t => t.value === formData.idType)?.label}
                              </div>
                              <div className={cn(
                                "text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                <span className="font-medium">Número:</span> {formData.idNumber}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className={cn(
                  "p-6 border-t flex items-center justify-between",
                  theme === 'dark' ? "border-gray-700" : "border-gray-200"
                )}>
                  <Button
                    variant="ghost"
                    onClick={handlePrevStep}
                    disabled={formStep === 1}
                    className={cn(
                      "font-medium transition-all duration-200",
                      formStep === 1
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700",
                      theme === 'dark' ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Anterior
                  </Button>

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    Paso {formStep} de 4
                  </div>

                  {formStep < 4 ? (
                    <Button
                      onClick={handleNextStep}
                      className={cn(
                        "font-medium transition-all duration-200 hover:shadow-lg",
                        theme === 'dark'
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-red-500 hover:bg-red-600 text-white"
                      )}
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleCreateCustomer}
                      disabled={loading}
                      className={cn(
                        "font-medium transition-all duration-200 hover:shadow-lg",
                        "bg-green-600 hover:bg-green-700 text-white"
                      )}
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Crear Cliente
                    </Button>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Customer Detail View */}
        {viewMode === 'detail' && selectedCustomer && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="max-w-6xl mx-auto">
              {/* Back Button */}
              <Button
                variant="ghost"
                onClick={() => setViewMode('list')}
                className={cn(
                  "mb-6",
                  theme === 'dark' ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                )}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Listado
              </Button>

              {/* Customer Information */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2">
                  <div className={cn(
                    "p-6 rounded-lg border",
                    theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                  )}>
                    <div className="flex items-center gap-4 mb-6">
                      <div className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center",
                        theme === 'dark' ? "bg-blue-600/20" : "bg-blue-100"
                      )}>
                        <User className={cn(
                          "w-8 h-8",
                          theme === 'dark' ? "text-blue-400" : "text-blue-600"
                        )} />
                      </div>
                      <div className="flex-1">
                        <h2 className={cn(
                          "text-2xl font-bold",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          {selectedCustomer.fullName || `${(selectedCustomer as any).firstName || ''} ${(selectedCustomer as any).lastName || ''}`.trim()}
                        </h2>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Cliente desde {new Date(selectedCustomer.createdAt).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleEditCustomer}
                          className={cn(
                            "px-4 py-2 text-white",
                            theme === 'dark'
                              ? "bg-blue-600 hover:bg-blue-700"
                              : "bg-blue-600 hover:bg-blue-700"
                          )}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Editar Cliente
                        </Button>
                        <Button
                          onClick={handleShowHistory}
                          className={cn(
                            "text-white border-0 hover:opacity-90 transition-opacity duration-200",
                            theme === 'dark'
                              ? "bg-blue-600 hover:bg-blue-700"
                              : "bg-[#cc0a46] hover:bg-[#b0093d]"
                          )}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Ver Historial
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedCustomer.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className={cn(
                            "w-5 h-5",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )} />
                          <div>
                            <p className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Teléfono
                            </p>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {selectedCustomer.phone}
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedCustomer.email && (
                        <div className="flex items-center gap-3">
                          <Mail className={cn(
                            "w-5 h-5",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )} />
                          <div>
                            <p className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Correo Electrónico
                            </p>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {selectedCustomer.email}
                            </p>
                          </div>
                        </div>
                      )}

                      {selectedCustomer.address?.country && (
                        <div className="flex items-center gap-3">
                          <Globe className={cn(
                            "w-5 h-5",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )} />
                          <div>
                            <p className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              País
                            </p>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {selectedCustomer.address?.country}
                            </p>
                          </div>
                        </div>
                      )}

                      {(selectedCustomer.address?.street || selectedCustomer.address) && (
                        <div className="flex items-center gap-3">
                          <Home className={cn(
                            "w-5 h-5",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )} />
                          <div>
                            <p className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Dirección
                            </p>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {removeLeadingZeros(selectedCustomer.address?.street || '')}
                              {selectedCustomer.address?.apartment && ` ${removeLeadingZeros(selectedCustomer.address.apartment)}`}
                              {selectedCustomer.address?.city && `, ${selectedCustomer.address?.city}`}
                              {selectedCustomer.address?.state && `, ${selectedCustomer.address?.state}`}
                              {selectedCustomer.address?.zipCode && ` ${selectedCustomer.address?.zipCode}`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="h-full">
                  <div className={cn(
                    "p-6 rounded-lg border h-full",
                    theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                  )}>
                    <h3 className={cn(
                      "font-semibold mb-4",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Estadísticas Rápidas
                    </h3>
                    <div className="space-y-3 flex flex-col justify-center h-full">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Órdenes Totales
                        </span>
                        <span className={cn(
                          "font-semibold",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          0
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Total Comprado
                        </span>
                        <span className={cn(
                          "font-semibold",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          $0.00
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Última Actividad
                        </span>
                        <span className={cn(
                          "text-sm font-medium",
                          theme === 'dark' ? "text-blue-400" : "text-blue-600"
                        )}>
                          Hoy
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs for detailed information */}
              <div className={cn(
                "border-b border-gray-200 dark:border-gray-700 mb-6"
              )}>
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('orders')}
                    className={cn(
                      "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                      activeTab === 'orders'
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                  >
                    Órdenes
                  </button>
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={cn(
                      "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                      activeTab === 'notes'
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                  >
                    Notas de Atención al Cliente
                  </button>
                  <button
                    onClick={() => setActiveTab('transactions')}
                    className={cn(
                      "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                      activeTab === 'transactions'
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    )}
                  >
                    Historial de Transacciones
                  </button>
                </nav>
              </div>

              {/* Content Area */}
              <div className={cn(
                "p-6 rounded-lg border",
                theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}>
                {/* Orders Tab Content */}
                {activeTab === 'orders' && (
                  <div>
                    <div className="mb-6">
                      <h3 className={cn(
                        "text-lg font-semibold",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        Órdenes del Cliente
                      </h3>
                    </div>

                    {customerOrders.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className={cn(
                              "border-b",
                              theme === 'dark' ? "border-gray-700" : "border-gray-200"
                            )}>
                              <th className={cn(
                                "text-left py-3 px-4 font-medium text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Número de Orden
                              </th>
                              <th className={cn(
                                "text-left py-3 px-4 font-medium text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Fecha
                              </th>
                              <th className={cn(
                                "text-left py-3 px-4 font-medium text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Monto
                              </th>
                              <th className={cn(
                                "text-left py-3 px-4 font-medium text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Estado
                              </th>
                              <th className={cn(
                                "text-left py-3 px-4 font-medium text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerOrders.map((order) => (
                              <tr key={order.id} className={cn(
                                "border-b hover:bg-opacity-50 transition-colors",
                                theme === 'dark'
                                  ? "border-gray-700 hover:bg-gray-700/50"
                                  : "border-gray-100 hover:bg-gray-50"
                              )}>
                                <td className={cn(
                                  "py-3 px-4 font-medium",
                                  theme === 'dark' ? "text-white" : "text-gray-900"
                                )}>
                                  {order.orderNumber}
                                </td>
                                <td className={cn(
                                  "py-3 px-4 text-sm",
                                  theme === 'dark' ? "text-gray-300" : "text-gray-600"
                                )}>
                                  {new Date(order.createdAt).toLocaleDateString('es-ES')}
                                </td>
                                <td className={cn(
                                  "py-3 px-4 font-medium",
                                  theme === 'dark' ? "text-white" : "text-gray-900"
                                )}>
                                  ${order.amount.toFixed(2)}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={cn(
                                    "inline-flex px-2 py-1 text-xs font-medium rounded-full",
                                    order.status === 'completed'
                                      ? "bg-green-100 text-green-800"
                                      : order.status === 'pending'
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                  )}>
                                    {order.status === 'completed' ? 'Completada' :
                                     order.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm">
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Package className={cn(
                          "w-16 h-16 mx-auto mb-4",
                          theme === 'dark' ? "text-gray-600" : "text-gray-400"
                        )} />
                        <p className={cn(
                          "text-lg font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          No hay órdenes registradas
                        </p>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-500" : "text-gray-500"
                        )}>
                          Este cliente aún no tiene órdenes en el sistema
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes Tab Content */}
                {activeTab === 'notes' && (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className={cn(
                        "text-lg font-semibold",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        Notas de Atención al Cliente
                      </h3>
                      <Button
                        onClick={() => setShowNoteForm(true)}
                        className={cn(
                          "px-4 py-2 text-white",
                          theme === 'dark'
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "bg-[#cc0a46] hover:bg-[#b0093d]"
                        )}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Nota
                      </Button>
                    </div>

                    {/* Note Creation Form */}
                    {showNoteForm && (
                      <div className={cn(
                        "mb-6 p-4 rounded-lg border",
                        theme === 'dark' ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
                      )}>
                        <div className="space-y-4">
                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Nota
                            </label>
                            <textarea
                              value={newNote.note}
                              onChange={(e) => setNewNote({ ...newNote, note: e.target.value })}
                              className={cn(
                                "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none",
                                theme === 'dark'
                                  ? "bg-gray-700 border-gray-600 text-white"
                                  : "bg-white border-gray-300 text-gray-900"
                              )}
                              rows={4}
                              placeholder="Escribe aquí la nota de atención al cliente..."
                            />
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Departamentos
                            </label>
                            <DepartmentPill
                              departments={newNote.departments}
                              onDepartmentsChange={(departments) => setNewNote({ ...newNote, departments })}
                              placeholder="Seleccionar departamentos relacionados..."
                            />
                          </div>

                          <div>
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Prioridad
                            </label>
                            <select
                              value={newNote.priority}
                              onChange={(e) => setNewNote({ ...newNote, priority: e.target.value as any })}
                              className={cn(
                                "w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                                theme === 'dark'
                                  ? "bg-gray-700 border-gray-600 text-white"
                                  : "bg-white border-gray-300 text-gray-900"
                              )}
                            >
                              <option value="low">Baja</option>
                              <option value="medium">Media</option>
                              <option value="high">Alta</option>
                              <option value="urgent">Urgente</option>
                            </select>
                          </div>

                          <div className="flex gap-3 justify-end">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setShowNoteForm(false)
                                setNewNote({ note: '', priority: 'medium', departments: [] })
                                // No need to clear error anymore
                              }}
                              className={cn(
                                theme === 'dark' ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                              )}
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={handleCreateNote}
                              className={cn(
                                "px-4 py-2 text-white",
                                theme === 'dark'
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : "bg-[#cc0a46] hover:bg-[#b0093d]"
                              )}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Crear Nota
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {customerNotes.length > 0 ? (
                      <div className="space-y-4">
                        {customerNotes.map((note) => (
                          <div key={note.id} className={cn(
                            "p-4 rounded-lg border",
                            theme === 'dark' ? "bg-gray-700/50 border-gray-600" : "bg-gray-50 border-gray-200"
                          )}>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center",
                                  theme === 'dark' ? "bg-blue-600/20" : "bg-blue-100"
                                )}>
                                  <MessageSquare className={cn(
                                    "w-4 h-4",
                                    theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                  )} />
                                </div>
                                <div>
                                  <p className={cn(
                                    "font-medium text-sm",
                                    theme === 'dark' ? "text-white" : "text-gray-900"
                                  )}>
                                    {note.createdBy}
                                  </p>
                                  <p className={cn(
                                    "text-xs",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                  )}>
                                    {new Date(note.createdAt).toLocaleDateString('es-ES', {
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                              <span className={cn(
                                "inline-flex px-2 py-1 text-xs font-medium rounded-full border",
                                getPriorityColor(note.priority)
                              )}>
                                {getPriorityLabel(note.priority)}
                              </span>
                            </div>
                            <p className={cn(
                              "text-sm leading-relaxed",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {note.note}
                            </p>

                            {/* Departments */}
                            {note.departments && note.departments.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {note.departments.map((department, index) => (
                                  <span
                                    key={index}
                                    className={cn(
                                      "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                                      theme === 'dark'
                                        ? "bg-purple-900/50 text-purple-300 border border-purple-700/50"
                                        : "bg-purple-100 text-purple-800 border border-purple-200"
                                    )}
                                  >
                                    {department}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <MessageSquare className={cn(
                          "w-16 h-16 mx-auto mb-4",
                          theme === 'dark' ? "text-gray-600" : "text-gray-400"
                        )} />
                        <p className={cn(
                          "text-lg font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          No hay notas registradas
                        </p>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-500" : "text-gray-500"
                        )}>
                          No se han agregado notas de atención al cliente para este usuario
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Transactions Tab Content */}
                {activeTab === 'transactions' && (
                  <div>
                    <div className="mb-6">
                      <h3 className={cn(
                        "text-lg font-semibold",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        Historial de Transacciones
                      </h3>
                    </div>

                    {getSampleTransactions(selectedCustomer.id).length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className={cn(
                              "border-b",
                              theme === 'dark' ? "border-gray-700" : "border-gray-200"
                            )}>
                              <th className={cn(
                                "text-left py-3 px-4 font-medium text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Fecha
                              </th>
                              <th className={cn(
                                "text-left py-3 px-4 font-medium text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Tipo
                              </th>
                              <th className={cn(
                                "text-left py-3 px-4 font-medium text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Descripción
                              </th>
                              <th className={cn(
                                "text-left py-3 px-4 font-medium text-sm",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Monto
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSampleTransactions(selectedCustomer.id).map((transaction) => (
                              <tr key={transaction.id} className={cn(
                                "border-b hover:bg-opacity-50 transition-colors",
                                theme === 'dark'
                                  ? "border-gray-700 hover:bg-gray-700/50"
                                  : "border-gray-100 hover:bg-gray-50"
                              )}>
                                <td className={cn(
                                  "py-3 px-4 text-sm",
                                  theme === 'dark' ? "text-gray-300" : "text-gray-600"
                                )}>
                                  {new Date(transaction.createdAt).toLocaleDateString('es-ES')}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={cn(
                                    "inline-flex px-2 py-1 text-xs font-medium rounded-full",
                                    transaction.type === 'payment'
                                      ? "bg-green-100 text-green-800"
                                      : transaction.type === 'credit'
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-orange-100 text-orange-800"
                                  )}>
                                    {transaction.type === 'payment' ? 'Pago' :
                                     transaction.type === 'credit' ? 'Crédito' : 'Reembolso'}
                                  </span>
                                </td>
                                <td className={cn(
                                  "py-3 px-4 text-sm",
                                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                )}>
                                  {transaction.description}
                                </td>
                                <td className={cn(
                                  "py-3 px-4 font-medium",
                                  transaction.type === 'payment'
                                    ? "text-green-600"
                                    : transaction.type === 'credit'
                                    ? "text-blue-600"
                                    : "text-orange-600"
                                )}>
                                  {transaction.type === 'payment' ? '-' : '+'}
                                  ${transaction.amount.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <DollarSign className={cn(
                          "w-16 h-16 mx-auto mb-4",
                          theme === 'dark' ? "text-gray-600" : "text-gray-400"
                        )} />
                        <p className={cn(
                          "text-lg font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          No hay transacciones registradas
                        </p>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-500" : "text-gray-500"
                        )}>
                          Este cliente aún no tiene transacciones en el sistema
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Edit Customer Modal */}
        <AnimatePresence>
          {showEditForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowEditForm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={cn(
                  "w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg p-6",
                  theme === 'dark' ? "bg-gray-800" : "bg-white"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn(
                    "text-xl font-semibold",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Editar Cliente
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEditForm(false)}
                    className={cn(
                      theme === 'dark' ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Apellido
                    </label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Tipo de ID
                    </label>
                    <select
                      value={editForm.idType}
                      onChange={(e) => setEditForm({...editForm, idType: e.target.value})}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    >
                      <option value="">Seleccionar...</option>
                      <option value="Carnet de Identidad">Carnet de Identidad</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="Licencia de Conducir">Licencia de Conducir</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Número de ID
                    </label>
                    <input
                      type="text"
                      value={editForm.idNumber}
                      onChange={(e) => setEditForm({...editForm, idNumber: e.target.value})}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>

  
                  <div className="md:col-span-2">
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      <MapPin className="inline w-4 h-4 mr-1" />
                      Dirección (Calle/Avenida)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={editForm.streetAddress}
                        onChange={handleStreetAddressChange}
                        onFocus={() => setShowAddressSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
                        placeholder="Ej: Calle 123, Avenida Principal"
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                          theme === 'dark'
                            ? "bg-gray-700 border-gray-600 text-white"
                            : "bg-white border-gray-300 text-gray-900"
                        )}
                      />

                      {/* Indicador de carga */}
                      {isLoadingAddress && (
                        <div className="absolute right-3 top-2.5">
                          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        </div>
                      )}

                      {/* Lista de sugerencias de autocompletado */}
                      {showAddressSuggestions && addressSuggestions.length > 0 && (
                        <div className={cn(
                          "absolute z-10 w-full mt-1 rounded-lg border shadow-lg max-h-60 overflow-y-auto",
                          theme === 'dark'
                            ? "bg-gray-800 border-gray-600"
                            : "bg-white border-gray-300"
                        )}>
                          {addressSuggestions.map((suggestion: any, index: number) => (
                            <button
                              key={index}
                              onClick={() => selectAddressSuggestion(suggestion)}
                              className={cn(
                                "w-full text-left px-4 py-3 hover:bg-opacity-10 transition-colors border-b last:border-b-0 text-sm",
                                theme === 'dark'
                                  ? "hover:bg-gray-700 border-gray-700 text-gray-300"
                                  : "hover:bg-blue-50 border-gray-200 text-gray-700"
                              )}
                            >
                              <div className="font-medium">{suggestion.display_name}</div>
                              <div className={cn(
                                "text-xs mt-1",
                                theme === 'dark' ? "text-gray-400" : "text-gray-500"
                              )}>
                                {suggestion.address.street && (
                                  <span>{suggestion.address.street}</span>
                                )}
                                {suggestion.address.city && (
                                  <span>, {suggestion.address.city}</span>
                                )}
                                {suggestion.address.state && (
                                  <span>, {suggestion.address.state}</span>
                                )}
                                {suggestion.address.postalCode && (
                                  <span>, CP {suggestion.address.postalCode}</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      <Building2 className="inline w-4 h-4 mr-1" />
                      Estado/Provincia
                    </label>
                    <input
                      type="text"
                      value={editForm.state}
                      onChange={(e) => setEditForm({...editForm, state: e.target.value})}
                      placeholder="Ej: La Habana, Florida, Madrid"
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      <Home className="inline w-4 h-4 mr-1" />
                      Ciudad/Municipio
                    </label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                      placeholder="Ej: La Habana, Miami, Barcelona"
                      className={cn(
                        "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? "bg-gray-700 border-gray-600 text-white"
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Código Postal
                      </label>
                      <input
                        type="text"
                        value={editForm.postalCode}
                        onChange={(e) => setEditForm({...editForm, postalCode: e.target.value})}
                        placeholder="Ej: 10400, 33101, 08001"
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                          theme === 'dark'
                            ? "bg-gray-700 border-gray-600 text-white"
                            : "bg-white border-gray-300 text-gray-900"
                        )}
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        <Globe className="inline w-4 h-4 mr-1" />
                        País
                      </label>
                      <input
                        type="text"
                        value={editForm.country}
                        onChange={(e) => setEditForm({...editForm, country: e.target.value})}
                        placeholder="Ej: Estados Unidos, Cuba, España"
                        className={cn(
                          "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                          theme === 'dark'
                            ? "bg-gray-700 border-gray-600 text-white"
                            : "bg-white border-gray-300 text-gray-900"
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setShowEditForm(false)}
                    className={cn(
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleUpdateCustomer}
                    className={cn(
                      "px-4 py-2 text-white",
                      theme === 'dark'
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    )}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Guardar Cambios
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Change History Modal */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowHistory(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={cn(
                  "w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-lg p-6",
                  theme === 'dark' ? "bg-gray-800" : "bg-white"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn(
                    "text-xl font-semibold",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Historial de Cambios del Cliente
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHistory(false)}
                    className={cn(
                      theme === 'dark' ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {changeHistory.length > 0 ? (
                  <div className="space-y-3">
                    {changeHistory.map((change) => (
                      <div
                        key={change.id}
                        className={cn(
                          "p-4 rounded-lg border",
                          theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-1 text-xs font-medium rounded",
                              change.changeType === 'update'
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            )}>
                              {change.changeType === 'update' ? 'Actualización' : 'Creación'}
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-gray-200" : "text-gray-800"
                            )}>
                              {change.fieldName}
                            </span>
                          </div>
                          <span className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-400" : "text-gray-500"
                          )}>
                            {new Date(change.changedAt).toLocaleString('es-ES')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-400" : "text-gray-500"
                          )}>
                            Por: {change.changedByName || change.changedBy}
                          </span>
                        </div>
                        {change.oldValue !== change.newValue && (
                          <div className="flex items-center gap-3 text-sm">
                            {change.oldValue && (
                              <span className={cn(
                                "px-2 py-1 rounded line-through",
                                theme === 'dark' ? "bg-red-900/20 text-red-400" : "bg-red-100 text-red-700"
                              )}>
                                {change.oldValue}
                              </span>
                            )}
                            {change.newValue && (
                              <span className={cn(
                                "px-2 py-1 rounded",
                                theme === 'dark' ? "bg-green-900/20 text-green-400" : "bg-green-100 text-green-700"
                              )}>
                                {change.newValue}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className={cn(
                      "w-16 h-16 mx-auto mb-4",
                      theme === 'dark' ? "text-gray-600" : "text-gray-400"
                    )} />
                    <p className={cn(
                      "text-lg font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      No hay historial de cambios
                    </p>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-500" : "text-gray-500"
                    )}>
                      Este cliente aún no ha tenido cambios registrados
                    </p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification popup for global error/success messages */}
        <NotificationPopup />
      </div>
    </DashboardLayout>
    </Fragment>
  )
}