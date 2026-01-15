'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  MapPin,
  Package,
  CreditCard,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Phone,
  Mail,
  Home,
  Key,
  FileText,
  Plane,
  Ship,
  Trash2,
  DollarSign,
  AlertCircle,
  Loader2,
  Edit2
} from 'lucide-react'

// Types
interface Customer {
  id?: number
  firstName: string
  lastName: string
  phone: string
  email?: string
}

interface USAddress {
  street: string
  apartment?: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface CubaAddress {
  street: string
  number?: string
  reparto?: string
  floor?: string
  provinceId?: number
  provinceName?: string
  municipalityId?: number
  municipalityName?: string
  deliveryInstructions?: string
}

interface SenderData extends Customer {
  address?: USAddress
  entryPin?: string
  entryInstructions?: string
  latitude?: number
  longitude?: number
  addressId?: number
}

interface RecipientData extends Customer {
  address?: CubaAddress
  addressId?: number
}

interface CartProduct {
  productId: number
  productCode: string
  productName: string
  quantity: number
  weightLbs: number
  unitPrice: number
  subtotal: number
}

interface CatalogProduct {
  id: number
  code: string
  name: string
  precio_publico: number
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

interface CustomerAddress {
  id: number
  street: string
  apartment?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  number?: string
  reparto?: string
  floor?: string
  provinceId?: number
  provinceName?: string
  municipalityId?: number
  municipalityName?: string
  deliveryInstructions?: string
  isPrimary?: boolean
  addressType?: string
}

type Step = 'sender' | 'recipient' | 'products' | 'payment' | 'confirmation'

const STEPS: { id: Step; label: string; icon: typeof User }[] = [
  { id: 'sender', label: 'Remitente', icon: User },
  { id: 'recipient', label: 'Destinatario', icon: MapPin },
  { id: 'products', label: 'Productos', icon: Package },
  { id: 'payment', label: 'Pago', icon: CreditCard },
  { id: 'confirmation', label: 'Listo', icon: CheckCircle }
]

export default function NewOrderWizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('sender')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Sender state
  const [sender, setSender] = useState<SenderData | null>(null)
  const [senderSearch, setSenderSearch] = useState('')
  const [senderSearching, setSenderSearching] = useState(false)
  const [senderResults, setSenderResults] = useState<any[]>([])
  const [senderAddresses, setSenderAddresses] = useState<CustomerAddress[]>([])
  const [showSenderForm, setShowSenderForm] = useState(false)
  const [loadingSenderAddresses, setLoadingSenderAddresses] = useState(false)
  const [selectedSenderCustomer, setSelectedSenderCustomer] = useState<any>(null)
  const [newSender, setNewSender] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    entryPin: '',
    entryInstructions: '',
    street: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: ''
  })

  // Recipient state
  const [recipient, setRecipient] = useState<RecipientData | null>(null)
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientSearching, setRecipientSearching] = useState(false)
  const [recipientResults, setRecipientResults] = useState<any[]>([])
  const [recipientAddresses, setRecipientAddresses] = useState<CustomerAddress[]>([])
  const [showRecipientForm, setShowRecipientForm] = useState(false)
  const [loadingRecipientAddresses, setLoadingRecipientAddresses] = useState(false)
  const [selectedRecipientCustomer, setSelectedRecipientCustomer] = useState<any>(null)
  const [showRecipientAddressForm, setShowRecipientAddressForm] = useState(false)
  const [newRecipient, setNewRecipient] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    street: '',
    number: '',
    reparto: '',
    floor: '',
    provinceId: null as number | null,
    provinceName: '',
    municipalityId: null as number | null,
    municipalityName: '',
    deliveryInstructions: ''
  })

  // Products state
  const [shippingType, setShippingType] = useState<'air' | 'maritime'>('air')
  const [products, setProducts] = useState<CartProduct[]>([])
  const [empaqueCode, setEmpaqueCode] = useState('')
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])
  const [productSearch, setProductSearch] = useState('')

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'terminal' | 'cash' | 'zelle' | null>(null)
  const [cashReceived, setCashReceived] = useState('')
  const [zelleReference, setZelleReference] = useState('')

  // Location data
  const [provinces, setProvinces] = useState<Province[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])

  const [createdOrder, setCreatedOrder] = useState<{ orderId: number; orderNumber: string } | null>(null)

  // Fetch catalog products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products?category=paqueteria&active=true', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
        if (response.status === 401) {
          window.location.href = '/driver/login'
          return
        }
        const data = await response.json()
        if (data.success) {
          setCatalogProducts(data.data?.products || data.data || [])
        }
      } catch (err) {
        console.error('Error fetching products:', err)
      }
    }
    fetchProducts()
  }, [])

  // Fetch provinces and municipalities
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/apacargo/municipalities?includeStates=true', {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        })
        const data = await response.json()
        if (data.success) {
          setProvinces(data.data?.states || [])
          setMunicipalities(data.data?.municipalities || [])
        }
      } catch (err) {
        console.error('Error fetching locations:', err)
      }
    }
    fetchLocations()
  }, [])

  const totalAmount = products.reduce((sum, p) => sum + p.subtotal, 0)
  const changeAmount = cashReceived ? Math.max(0, parseFloat(cashReceived) - totalAmount) : 0
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const filteredMunicipalities = municipalities.filter(
    m => m.stateId === newRecipient.provinceId
  )

  const filteredProducts = catalogProducts.filter(p =>
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code?.toLowerCase().includes(productSearch.toLowerCase())
  )

  // Search sender by phone
  const searchSender = async () => {
    if (!senderSearch.trim()) return
    setSenderSearching(true)
    setSenderResults([])
    try {
      const response = await fetch(`/api/customers?search=${senderSearch}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (data.success) {
        const results = data.data || []
        setSenderResults(results)
        if (results.length === 0) {
          setShowSenderForm(true)
          setNewSender(prev => ({ ...prev, phone: senderSearch }))
        }
      }
    } catch (err) {
      console.error('Error searching sender:', err)
    } finally {
      setSenderSearching(false)
    }
  }

  // Select sender and load addresses
  const selectSenderCustomer = async (customer: any) => {
    setSelectedSenderCustomer(customer)
    setLoadingSenderAddresses(true)
    try {
      const response = await fetch(`/api/customer-addresses?customerId=${customer.id}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (data.success && data.data?.length > 0) {
        setSenderAddresses(data.data)
        if (data.data.length === 1) {
          selectSenderAddress(customer, data.data[0])
        }
      } else {
        // No addresses, use customer data directly
        const senderData: SenderData = {
          ...customer,
          address: {
            street: customer.address || '',
            city: customer.city || '',
            state: customer.state || '',
            zipCode: customer.zipCode || customer.zipcode || '',
            apartment: customer.apartment || '',
            country: 'US'
          }
        }
        setSender(senderData)
        setSenderResults([])
        setSelectedSenderCustomer(null)
      }
    } catch (err) {
      console.error('Error loading addresses:', err)
      setSender(customer)
      setSenderResults([])
    } finally {
      setLoadingSenderAddresses(false)
    }
  }

  const selectSenderAddress = (customer: any, address: CustomerAddress) => {
    const senderData: SenderData = {
      ...customer,
      addressId: address.id,
      address: {
        street: address.street || '',
        apartment: address.apartment || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.zipCode || '',
        country: address.country || 'US'
      },
      entryPin: (address as any).entryPin,
      entryInstructions: (address as any).entryInstructions
    }
    setSender(senderData)
    setSenderAddresses([])
    setSenderResults([])
    setSelectedSenderCustomer(null)
  }

  // Create new sender
  const createSender = async () => {
    if (!newSender.firstName || !newSender.phone || !newSender.street) {
      setError('Nombre, telefono y direccion son requeridos')
      return
    }
    setIsLoading(true)
    try {
      const fullAddress = `${newSender.street}${newSender.apartment ? ', ' + newSender.apartment : ''}, ${newSender.city}, ${newSender.state} ${newSender.zipCode}`
      const response = await fetch('/api/customers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newSender.firstName,
          lastName: newSender.lastName,
          phone: newSender.phone,
          email: newSender.email,
          address: fullAddress,
          city: newSender.city,
          state: newSender.state,
          zipCode: newSender.zipCode
        })
      })
      const data = await response.json()
      if (data.success) {
        // Save address
        await fetch('/api/customer-addresses', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: data.data.id,
            street: newSender.street,
            apartment: newSender.apartment,
            city: newSender.city,
            state: newSender.state,
            zipCode: newSender.zipCode,
            country: 'US',
            addressType: 'usa',
            entryPin: newSender.entryPin,
            entryInstructions: newSender.entryInstructions,
            isPrimary: true
          })
        })
        setSender({
          ...data.data,
          address: {
            street: newSender.street,
            apartment: newSender.apartment,
            city: newSender.city,
            state: newSender.state,
            zipCode: newSender.zipCode,
            country: 'US'
          },
          entryPin: newSender.entryPin,
          entryInstructions: newSender.entryInstructions
        })
        setShowSenderForm(false)
      } else {
        setError(data.error || 'Error al crear remitente')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  // Search recipient by phone
  const searchRecipient = async () => {
    if (!recipientSearch.trim()) return
    setRecipientSearching(true)
    setRecipientResults([])
    try {
      const response = await fetch(`/api/customers?search=${recipientSearch}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (data.success) {
        const results = data.data || []
        setRecipientResults(results)
        if (results.length === 0) {
          setShowRecipientForm(true)
          setNewRecipient(prev => ({ ...prev, phone: recipientSearch }))
        }
      }
    } catch (err) {
      console.error('Error searching recipient:', err)
    } finally {
      setRecipientSearching(false)
    }
  }

  // Select recipient and load Cuba addresses
  const selectRecipientCustomer = async (customer: any) => {
    setSelectedRecipientCustomer(customer)
    setLoadingRecipientAddresses(true)
    try {
      const response = await fetch(`/api/customer-addresses?customerId=${customer.id}&addressType=cuba`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()
      if (data.success && data.data?.length > 0) {
        setRecipientAddresses(data.data)
        if (data.data.length === 1) {
          selectRecipientAddress(customer, data.data[0])
        }
      } else {
        // No Cuba addresses, show form to add one
        setShowRecipientAddressForm(true)
      }
    } catch (err) {
      console.error('Error loading addresses:', err)
      setShowRecipientAddressForm(true)
    } finally {
      setLoadingRecipientAddresses(false)
    }
  }

  const selectRecipientAddress = (customer: any, address: CustomerAddress) => {
    const recipientData: RecipientData = {
      ...customer,
      addressId: address.id,
      address: {
        street: address.street || '',
        number: address.number,
        reparto: address.reparto,
        floor: address.floor,
        provinceId: address.provinceId,
        provinceName: address.provinceName,
        municipalityId: address.municipalityId,
        municipalityName: address.municipalityName,
        deliveryInstructions: address.deliveryInstructions
      }
    }
    setRecipient(recipientData)
    setRecipientAddresses([])
    setRecipientResults([])
    setSelectedRecipientCustomer(null)
    setShowRecipientAddressForm(false)
  }

  // Create new recipient address for existing customer
  const createRecipientAddress = async () => {
    if (!selectedRecipientCustomer) return
    if (!newRecipient.street || !newRecipient.provinceId || !newRecipient.municipalityId) {
      setError('Calle, provincia y municipio son requeridos')
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch('/api/customer-addresses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedRecipientCustomer.id,
          street: newRecipient.street,
          number: newRecipient.number,
          reparto: newRecipient.reparto,
          floor: newRecipient.floor,
          provinceId: newRecipient.provinceId,
          provinceName: newRecipient.provinceName,
          municipalityId: newRecipient.municipalityId,
          municipalityName: newRecipient.municipalityName,
          deliveryInstructions: newRecipient.deliveryInstructions,
          addressType: 'cuba',
          country: 'Cuba',
          isPrimary: true
        })
      })
      const data = await response.json()
      if (data.success) {
        selectRecipientAddress(selectedRecipientCustomer, data.data)
      } else {
        setError(data.error || 'Error al crear direccion')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  // Create new recipient
  const createRecipient = async () => {
    if (!newRecipient.firstName || !newRecipient.phone || !newRecipient.street || !newRecipient.provinceId) {
      setError('Nombre, telefono, calle y provincia son requeridos')
      return
    }
    setIsLoading(true)
    try {
      const province = provinces.find(p => p.id === newRecipient.provinceId)
      const municipality = municipalities.find(m => m.id === newRecipient.municipalityId)

      const response = await fetch('/api/customers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newRecipient.firstName,
          lastName: newRecipient.lastName,
          phone: newRecipient.phone,
          email: newRecipient.email,
          country: 'CU'
        })
      })
      const data = await response.json()
      if (data.success) {
        // Save Cuba address
        const addrResponse = await fetch('/api/customer-addresses', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: data.data.id,
            street: newRecipient.street,
            number: newRecipient.number,
            reparto: newRecipient.reparto,
            floor: newRecipient.floor,
            provinceId: newRecipient.provinceId,
            provinceName: province?.name || '',
            municipalityId: newRecipient.municipalityId,
            municipalityName: municipality?.name || '',
            deliveryInstructions: newRecipient.deliveryInstructions,
            addressType: 'cuba',
            country: 'Cuba',
            isPrimary: true
          })
        })
        const addrData = await addrResponse.json()

        setRecipient({
          ...data.data,
          addressId: addrData.data?.id,
          address: {
            street: newRecipient.street,
            number: newRecipient.number,
            reparto: newRecipient.reparto,
            floor: newRecipient.floor,
            provinceId: newRecipient.provinceId,
            provinceName: province?.name,
            municipalityId: newRecipient.municipalityId,
            municipalityName: municipality?.name,
            deliveryInstructions: newRecipient.deliveryInstructions
          }
        })
        setShowRecipientForm(false)
      } else {
        setError(data.error || 'Error al crear destinatario')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 'sender':
        return !!sender
      case 'recipient':
        return !!recipient
      case 'products':
        return products.length > 0
      case 'payment':
        if (!paymentMethod) return false
        if (paymentMethod === 'cash' && (!cashReceived || parseFloat(cashReceived) < totalAmount)) return false
        if (paymentMethod === 'zelle' && !zelleReference) return false
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (!canProceed()) {
      setError('Completa todos los campos requeridos')
      return
    }
    setError('')
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      if (STEPS[nextIndex].id === 'confirmation') {
        handleCreateOrder()
      } else {
        setCurrentStep(STEPS[nextIndex].id)
      }
    }
  }

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    } else {
      router.back()
    }
  }

  const addProductToCart = (product: CatalogProduct) => {
    const existing = products.find(p => p.productId === product.id)
    if (existing) {
      setProducts(products.map(p =>
        p.productId === product.id
          ? { ...p, quantity: p.quantity + 1, subtotal: (p.quantity + 1) * p.unitPrice }
          : p
      ))
    } else {
      setProducts([...products, {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        quantity: 1,
        weightLbs: 0,
        unitPrice: product.precio_publico,
        subtotal: product.precio_publico
      }])
    }
  }

  const removeProductFromCart = (productId: number) => {
    setProducts(products.filter(p => p.productId !== productId))
  }

  const handleCreateOrder = async () => {
    if (!sender || !recipient) return
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/driver-app/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: {
            id: sender.id,
            firstName: sender.firstName,
            lastName: sender.lastName,
            phone: sender.phone,
            email: sender.email,
            street: sender.address?.street,
            city: sender.address?.city,
            state: sender.address?.state,
            zipCode: sender.address?.zipCode,
            latitude: sender.latitude,
            longitude: sender.longitude,
            entryPin: sender.entryPin,
            entryInstructions: sender.entryInstructions
          },
          recipient: {
            id: recipient.id,
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            phone: recipient.phone,
            street: recipient.address?.street,
            number: recipient.address?.number,
            reparto: recipient.address?.reparto,
            floor: recipient.address?.floor,
            provinceId: recipient.address?.provinceId,
            provinceName: recipient.address?.provinceName,
            municipalityId: recipient.address?.municipalityId,
            municipalityName: recipient.address?.municipalityName,
            deliveryInstructions: recipient.address?.deliveryInstructions
          },
          shippingType,
          products,
          empaqueCode,
          totalAmount,
          payment: paymentMethod ? {
            method: paymentMethod,
            amount: totalAmount,
            reference: paymentMethod === 'zelle' ? zelleReference : undefined,
            amountReceived: paymentMethod === 'cash' ? parseFloat(cashReceived) : undefined,
            changeGiven: paymentMethod === 'cash' ? changeAmount : undefined
          } : null
        })
      })

      const data = await response.json()

      if (data.success) {
        setCreatedOrder({
          orderId: data.data.orderId,
          orderNumber: data.data.orderNumber
        })
        setCurrentStep('confirmation')
      } else {
        setError(data.error || 'Error al crear orden')
      }
    } catch (err) {
      console.error('Error creating order:', err)
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  const buildCubaAddress = (addr: CubaAddress) => {
    const parts = []
    if (addr.street) parts.push(addr.street)
    if (addr.number) parts.push(`#${addr.number}`)
    if (addr.floor) parts.push(addr.floor)
    if (addr.reparto) parts.push(addr.reparto)
    if (addr.municipalityName) parts.push(addr.municipalityName)
    if (addr.provinceName) parts.push(addr.provinceName)
    parts.push('Cuba')
    return parts.join(', ')
  }

  return (
    <div className="pb-24">
      {/* Progress Bar */}
      <div className="px-4 pt-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          {STEPS.slice(0, -1).map((step, index) => {
            const isActive = index === currentStepIndex
            const isCompleted = index < currentStepIndex

            return (
              <div key={step.id} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${isCompleted ? 'bg-green-500 text-white' :
                    isActive ? 'bg-exa-primary text-white' :
                    'bg-gray-700 text-gray-400'}
                `}>
                  {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                </div>
                {index < STEPS.length - 2 && (
                  <div className={`w-8 sm:w-12 h-1 mx-1 rounded ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
        <p className="text-center text-white font-medium">
          {STEPS[currentStepIndex]?.label}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 mb-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="px-4"
        >
          {/* SENDER STEP */}
          {currentStep === 'sender' && (
            <div className="space-y-4">
              {!sender ? (
                <>
                  {/* Search */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="tel"
                        value={senderSearch}
                        onChange={(e) => setSenderSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchSender()}
                        placeholder="Buscar por telefono..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                      />
                    </div>
                    <button
                      onClick={searchSender}
                      disabled={senderSearching}
                      className="px-4 bg-exa-primary text-white rounded-xl flex items-center gap-2"
                    >
                      {senderSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Results */}
                  {senderResults.length > 0 && !selectedSenderCustomer && (
                    <div className="space-y-2">
                      {senderResults.map(customer => (
                        <button
                          key={customer.id}
                          onClick={() => selectSenderCustomer(customer)}
                          className="w-full p-4 bg-gray-800/50 border border-gray-700 rounded-xl text-left hover:border-gray-600 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{customer.firstName} {customer.lastName}</p>
                              <p className="text-gray-400 text-sm">{customer.phone}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Address Selection */}
                  {selectedSenderCustomer && senderAddresses.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-gray-400 text-sm">Selecciona una direccion:</p>
                      {loadingSenderAddresses ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin text-exa-primary" />
                        </div>
                      ) : (
                        senderAddresses.map(addr => (
                          <button
                            key={addr.id}
                            onClick={() => selectSenderAddress(selectedSenderCustomer, addr)}
                            className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-left hover:border-exa-primary transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                              <div>
                                <p className="text-white text-sm">{addr.street}{addr.apartment && `, ${addr.apartment}`}</p>
                                <p className="text-gray-400 text-xs">{addr.city}, {addr.state} {addr.zipCode}</p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                      <button
                        onClick={() => {
                          setSelectedSenderCustomer(null)
                          setSenderAddresses([])
                        }}
                        className="w-full py-2 text-gray-400 text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Create Form */}
                  {showSenderForm && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-4">
                      <p className="text-white font-medium">Nuevo Remitente</p>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={newSender.firstName}
                          onChange={(e) => setNewSender({ ...newSender, firstName: e.target.value })}
                          placeholder="Nombre *"
                          className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                        />
                        <input
                          value={newSender.lastName}
                          onChange={(e) => setNewSender({ ...newSender, lastName: e.target.value })}
                          placeholder="Apellido"
                          className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                        />
                      </div>
                      <input
                        value={newSender.phone}
                        onChange={(e) => setNewSender({ ...newSender, phone: e.target.value })}
                        placeholder="Telefono *"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                      />
                      <input
                        value={newSender.street}
                        onChange={(e) => setNewSender({ ...newSender, street: e.target.value })}
                        placeholder="Direccion *"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={newSender.city}
                          onChange={(e) => setNewSender({ ...newSender, city: e.target.value })}
                          placeholder="Ciudad"
                          className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                        />
                        <input
                          value={newSender.zipCode}
                          onChange={(e) => setNewSender({ ...newSender, zipCode: e.target.value })}
                          placeholder="Zip Code"
                          className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                        />
                      </div>
                      <input
                        value={newSender.entryPin}
                        onChange={(e) => setNewSender({ ...newSender, entryPin: e.target.value })}
                        placeholder="PIN de entrada"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowSenderForm(false)}
                          className="flex-1 py-2.5 bg-gray-700 text-white rounded-xl"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={createSender}
                          disabled={isLoading}
                          className="flex-1 py-2.5 bg-green-600 text-white rounded-xl flex items-center justify-center gap-2"
                        >
                          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                          Crear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Create New Button */}
                  {!showSenderForm && senderResults.length === 0 && !senderSearching && (
                    <button
                      onClick={() => setShowSenderForm(true)}
                      className="w-full py-3 border-2 border-dashed border-gray-600 rounded-xl text-gray-400 flex items-center justify-center gap-2 hover:border-gray-500"
                    >
                      <Plus className="w-5 h-5" />
                      Crear nuevo remitente
                    </button>
                  )}
                </>
              ) : (
                /* Selected Sender */
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">{sender.firstName} {sender.lastName}</p>
                        <p className="text-gray-400 text-sm">{sender.phone}</p>
                        {sender.address && (
                          <p className="text-gray-400 text-xs mt-1">
                            {sender.address.street}, {sender.address.city}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSender(null)}
                      className="text-gray-400 text-sm"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RECIPIENT STEP */}
          {currentStep === 'recipient' && (
            <div className="space-y-4">
              {!recipient ? (
                <>
                  {/* Search */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="tel"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchRecipient()}
                        placeholder="Buscar por telefono..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                      />
                    </div>
                    <button
                      onClick={searchRecipient}
                      disabled={recipientSearching}
                      className="px-4 bg-exa-primary text-white rounded-xl flex items-center gap-2"
                    >
                      {recipientSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Results */}
                  {recipientResults.length > 0 && !selectedRecipientCustomer && (
                    <div className="space-y-2">
                      {recipientResults.map(customer => (
                        <button
                          key={customer.id}
                          onClick={() => selectRecipientCustomer(customer)}
                          className="w-full p-4 bg-gray-800/50 border border-gray-700 rounded-xl text-left hover:border-gray-600 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{customer.firstName} {customer.lastName}</p>
                              <p className="text-gray-400 text-sm">{customer.phone}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Cuba Address Selection */}
                  {selectedRecipientCustomer && (recipientAddresses.length > 0 || showRecipientAddressForm) && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-medium">
                          {selectedRecipientCustomer.firstName} {selectedRecipientCustomer.lastName}
                        </p>
                        <button
                          onClick={() => {
                            setSelectedRecipientCustomer(null)
                            setRecipientAddresses([])
                            setShowRecipientAddressForm(false)
                          }}
                          className="text-gray-400 text-sm"
                        >
                          Cancelar
                        </button>
                      </div>

                      {loadingRecipientAddresses ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin text-exa-primary" />
                        </div>
                      ) : !showRecipientAddressForm ? (
                        <>
                          <p className="text-gray-400 text-sm">Direcciones en Cuba:</p>
                          {recipientAddresses.map(addr => (
                            <button
                              key={addr.id}
                              onClick={() => selectRecipientAddress(selectedRecipientCustomer, addr)}
                              className="w-full p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-left hover:border-purple-500 transition-colors"
                            >
                              <p className="text-white text-sm">{buildCubaAddress(addr as any)}</p>
                            </button>
                          ))}
                          <button
                            onClick={() => setShowRecipientAddressForm(true)}
                            className="w-full py-2 border border-dashed border-gray-600 rounded-xl text-gray-400 text-sm flex items-center justify-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Agregar direccion
                          </button>
                        </>
                      ) : (
                        /* New Cuba Address Form */
                        <div className="space-y-3">
                          <input
                            value={newRecipient.street}
                            onChange={(e) => setNewRecipient({ ...newRecipient, street: e.target.value })}
                            placeholder="Calle *"
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              value={newRecipient.number}
                              onChange={(e) => setNewRecipient({ ...newRecipient, number: e.target.value })}
                              placeholder="Numero"
                              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                            />
                            <input
                              value={newRecipient.reparto}
                              onChange={(e) => setNewRecipient({ ...newRecipient, reparto: e.target.value })}
                              placeholder="Reparto"
                              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <select
                              value={newRecipient.provinceId || ''}
                              onChange={(e) => {
                                const id = parseInt(e.target.value)
                                const prov = provinces.find(p => p.id === id)
                                setNewRecipient({
                                  ...newRecipient,
                                  provinceId: id,
                                  provinceName: prov?.name || '',
                                  municipalityId: null,
                                  municipalityName: ''
                                })
                              }}
                              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white focus:border-exa-primary outline-none"
                            >
                              <option value="">Provincia *</option>
                              {provinces.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                            <select
                              value={newRecipient.municipalityId || ''}
                              onChange={(e) => {
                                const id = parseInt(e.target.value)
                                const mun = municipalities.find(m => m.id === id)
                                setNewRecipient({
                                  ...newRecipient,
                                  municipalityId: id,
                                  municipalityName: mun?.name || ''
                                })
                              }}
                              disabled={!newRecipient.provinceId}
                              className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white focus:border-exa-primary outline-none disabled:opacity-50"
                            >
                              <option value="">Municipio *</option>
                              {filteredMunicipalities.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={createRecipientAddress}
                            disabled={isLoading}
                            className="w-full py-2.5 bg-green-600 text-white rounded-xl flex items-center justify-center gap-2"
                          >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Guardar Direccion
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Create New Recipient Form */}
                  {showRecipientForm && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
                      <p className="text-white font-medium">Nuevo Destinatario</p>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={newRecipient.firstName}
                          onChange={(e) => setNewRecipient({ ...newRecipient, firstName: e.target.value })}
                          placeholder="Nombre *"
                          className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                        />
                        <input
                          value={newRecipient.lastName}
                          onChange={(e) => setNewRecipient({ ...newRecipient, lastName: e.target.value })}
                          placeholder="Apellido"
                          className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                        />
                      </div>
                      <input
                        value={newRecipient.phone}
                        onChange={(e) => setNewRecipient({ ...newRecipient, phone: e.target.value })}
                        placeholder="Telefono *"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                      />
                      <input
                        value={newRecipient.street}
                        onChange={(e) => setNewRecipient({ ...newRecipient, street: e.target.value })}
                        placeholder="Calle *"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={newRecipient.number}
                          onChange={(e) => setNewRecipient({ ...newRecipient, number: e.target.value })}
                          placeholder="Numero"
                          className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                        />
                        <input
                          value={newRecipient.reparto}
                          onChange={(e) => setNewRecipient({ ...newRecipient, reparto: e.target.value })}
                          placeholder="Reparto"
                          className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={newRecipient.provinceId || ''}
                          onChange={(e) => {
                            const id = parseInt(e.target.value)
                            const prov = provinces.find(p => p.id === id)
                            setNewRecipient({
                              ...newRecipient,
                              provinceId: id,
                              provinceName: prov?.name || '',
                              municipalityId: null,
                              municipalityName: ''
                            })
                          }}
                          className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white focus:border-exa-primary outline-none"
                        >
                          <option value="">Provincia *</option>
                          {provinces.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <select
                          value={newRecipient.municipalityId || ''}
                          onChange={(e) => {
                            const id = parseInt(e.target.value)
                            const mun = municipalities.find(m => m.id === id)
                            setNewRecipient({
                              ...newRecipient,
                              municipalityId: id,
                              municipalityName: mun?.name || ''
                            })
                          }}
                          disabled={!newRecipient.provinceId}
                          className="bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white focus:border-exa-primary outline-none disabled:opacity-50"
                        >
                          <option value="">Municipio *</option>
                          {filteredMunicipalities.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowRecipientForm(false)}
                          className="flex-1 py-2.5 bg-gray-700 text-white rounded-xl"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={createRecipient}
                          disabled={isLoading}
                          className="flex-1 py-2.5 bg-green-600 text-white rounded-xl flex items-center justify-center gap-2"
                        >
                          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                          Crear
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Create New Button */}
                  {!showRecipientForm && recipientResults.length === 0 && !recipientSearching && !selectedRecipientCustomer && (
                    <button
                      onClick={() => setShowRecipientForm(true)}
                      className="w-full py-3 border-2 border-dashed border-gray-600 rounded-xl text-gray-400 flex items-center justify-center gap-2 hover:border-gray-500"
                    >
                      <Plus className="w-5 h-5" />
                      Crear nuevo destinatario
                    </button>
                  )}
                </>
              ) : (
                /* Selected Recipient */
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">{recipient.firstName} {recipient.lastName}</p>
                        <p className="text-gray-400 text-sm">{recipient.phone}</p>
                        {recipient.address && (
                          <p className="text-gray-400 text-xs mt-1">{buildCubaAddress(recipient.address)}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setRecipient(null)}
                      className="text-gray-400 text-sm"
                    >
                      Cambiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PRODUCTS STEP */}
          {currentStep === 'products' && (
            <div className="space-y-4">
              {/* Shipping Type */}
              <div className="flex bg-gray-800 rounded-xl p-1">
                <button
                  onClick={() => setShippingType('air')}
                  className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                    shippingType === 'air' ? 'bg-exa-primary text-white' : 'text-gray-400'
                  }`}
                >
                  <Plane className="w-4 h-4" />
                  Aereo
                </button>
                <button
                  onClick={() => setShippingType('maritime')}
                  className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                    shippingType === 'maritime' ? 'bg-blue-500 text-white' : 'text-gray-400'
                  }`}
                >
                  <Ship className="w-4 h-4" />
                  Maritimo
                </button>
              </div>

              {/* Empaque Code */}
              <input
                type="text"
                value={empaqueCode}
                onChange={(e) => setEmpaqueCode(e.target.value.toUpperCase())}
                placeholder="Codigo Empaque (EMP-2025-0001)"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono placeholder-gray-500 focus:border-exa-primary outline-none"
              />

              {/* Cart */}
              {products.length > 0 && (
                <div className="bg-gray-800/50 rounded-xl p-3 space-y-2">
                  {products.map(p => (
                    <div key={p.productId} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{p.productName}</p>
                        <p className="text-gray-500 text-xs">x{p.quantity} - ${p.unitPrice.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">${p.subtotal.toFixed(2)}</span>
                        <button onClick={() => removeProductFromCart(p.productId)} className="p-1 text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-700 flex justify-between">
                    <span className="text-gray-400">Total</span>
                    <span className="text-white font-bold">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Product Search */}
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
              />

              {/* Product Grid */}
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {filteredProducts.slice(0, 20).map(p => (
                  <button
                    key={p.id}
                    onClick={() => addProductToCart(p)}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-2 text-left hover:border-gray-600 transition-colors"
                  >
                    <p className="text-white text-sm truncate">{p.name}</p>
                    <p className="text-exa-primary font-semibold">${p.precio_publico?.toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PAYMENT STEP */}
          {currentStep === 'payment' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Total a Cobrar</span>
                  <span className="text-exa-primary font-bold text-xl">${totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3">
                <button
                  onClick={() => setPaymentMethod('terminal')}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                    paymentMethod === 'terminal' ? 'bg-exa-primary/10 border-exa-primary/50' : 'bg-gray-800/50 border-gray-700/50'
                  }`}
                >
                  <CreditCard className={`w-5 h-5 ${paymentMethod === 'terminal' ? 'text-exa-primary' : 'text-gray-400'}`} />
                  <span className={paymentMethod === 'terminal' ? 'text-white' : 'text-gray-300'}>Terminal Square</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                    paymentMethod === 'cash' ? 'bg-green-500/10 border-green-500/50' : 'bg-gray-800/50 border-gray-700/50'
                  }`}
                >
                  <DollarSign className={`w-5 h-5 ${paymentMethod === 'cash' ? 'text-green-500' : 'text-gray-400'}`} />
                  <span className={paymentMethod === 'cash' ? 'text-white' : 'text-gray-300'}>Efectivo</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('zelle')}
                  className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                    paymentMethod === 'zelle' ? 'bg-purple-500/10 border-purple-500/50' : 'bg-gray-800/50 border-gray-700/50'
                  }`}
                >
                  <Phone className={`w-5 h-5 ${paymentMethod === 'zelle' ? 'text-purple-500' : 'text-gray-400'}`} />
                  <span className={paymentMethod === 'zelle' ? 'text-white' : 'text-gray-300'}>Zelle</span>
                </button>
              </div>

              {/* Cash Input */}
              {paymentMethod === 'cash' && (
                <div className="space-y-3">
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="Monto recibido"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-xl font-semibold focus:border-green-500 outline-none"
                    step="0.01"
                  />
                  {parseFloat(cashReceived) >= totalAmount && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex justify-between">
                      <span className="text-gray-400">Cambio</span>
                      <span className="text-green-400 font-bold">${changeAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Zelle Input */}
              {paymentMethod === 'zelle' && (
                <input
                  type="text"
                  value={zelleReference}
                  onChange={(e) => setZelleReference(e.target.value)}
                  placeholder="Referencia Zelle"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                />
              )}
            </div>
          )}

          {/* CONFIRMATION STEP */}
          {currentStep === 'confirmation' && createdOrder && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-white font-bold text-2xl mb-2">Orden Creada</h2>
              <p className="text-exa-primary font-mono text-xl mb-6">{createdOrder.orderNumber}</p>

              <div className="space-y-3">
                <button
                  onClick={() => router.push(`/driver/orders/${createdOrder.orderId}`)}
                  className="w-full py-3 bg-gray-800 text-white font-medium rounded-xl"
                >
                  Ver Orden
                </button>
                <button
                  onClick={() => {
                    setSender(null)
                    setRecipient(null)
                    setProducts([])
                    setPaymentMethod(null)
                    setCreatedOrder(null)
                    setCurrentStep('sender')
                  }}
                  className="w-full py-3 bg-exa-primary text-white font-medium rounded-xl"
                >
                  Nueva Orden
                </button>
                <button
                  onClick={() => router.push('/driver/routes')}
                  className="w-full py-3 text-gray-400"
                >
                  Volver a Rutas
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      {currentStep !== 'confirmation' && (
        <div className="fixed bottom-20 left-0 right-0 px-4 py-3 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800">
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-gray-800 text-white font-medium rounded-xl flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              disabled={!canProceed() || isLoading}
              className="flex-1 py-3 bg-exa-primary text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creando...</span>
                </>
              ) : currentStepIndex === STEPS.length - 2 ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Crear Orden</span>
                </>
              ) : (
                <>
                  <span>Siguiente</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
