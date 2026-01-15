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
  AlertCircle
} from 'lucide-react'

// Types
interface Customer {
  id?: number
  firstName: string
  lastName: string
  phone: string
  email?: string
}

interface Address {
  street: string
  number?: string
  apartment?: string
  city?: string
  state?: string
  zipCode?: string
  reparto?: string
  floor?: string
  provinceId?: number
  provinceName?: string
  municipalityId?: number
  municipalityName?: string
}

interface SenderData extends Customer {
  address: Address
  entryPin?: string
  entryInstructions?: string
  latitude?: number
  longitude?: number
}

interface RecipientData extends Customer {
  address: Address
  deliveryInstructions?: string
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

  // Form data
  const [sender, setSender] = useState<SenderData>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: { street: '', city: '', state: '', zipCode: '' }
  })

  const [recipient, setRecipient] = useState<RecipientData>({
    firstName: '',
    lastName: '',
    phone: '',
    address: { street: '' }
  })

  const [shippingType, setShippingType] = useState<'air' | 'maritime'>('air')
  const [products, setProducts] = useState<CartProduct[]>([])
  const [empaqueCode, setEmpaqueCode] = useState('')
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([])

  const [paymentMethod, setPaymentMethod] = useState<'terminal' | 'cash' | 'zelle' | null>(null)
  const [cashReceived, setCashReceived] = useState('')
  const [zelleReference, setZelleReference] = useState('')

  const [provinces, setProvinces] = useState<Province[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])

  const [createdOrder, setCreatedOrder] = useState<{ orderId: number; orderNumber: string } | null>(null)

  // Fetch catalog products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/products?category=paqueteria&active=true')
        const data = await response.json()
        if (data.success) {
          setCatalogProducts(data.data.products || [])
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
        const response = await fetch('/api/apacargo/municipalities?includeStates=true')
        const data = await response.json()
        if (data.success) {
          setProvinces(data.data.states || [])
          setMunicipalities(data.data.municipalities || [])
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

  const canProceed = () => {
    switch (currentStep) {
      case 'sender':
        return sender.firstName && sender.phone && sender.address.street
      case 'recipient':
        return recipient.firstName && recipient.phone && recipient.address.street
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
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/driver-app/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: {
            firstName: sender.firstName,
            lastName: sender.lastName,
            phone: sender.phone,
            email: sender.email,
            street: sender.address.street,
            city: sender.address.city,
            state: sender.address.state,
            zipCode: sender.address.zipCode,
            latitude: sender.latitude,
            longitude: sender.longitude,
            entryPin: sender.entryPin,
            entryInstructions: sender.entryInstructions
          },
          recipient: {
            firstName: recipient.firstName,
            lastName: recipient.lastName,
            phone: recipient.phone,
            street: recipient.address.street,
            number: recipient.address.number,
            reparto: recipient.address.reparto,
            floor: recipient.address.floor,
            provinceId: recipient.address.provinceId,
            provinceName: recipient.address.provinceName,
            municipalityId: recipient.address.municipalityId,
            municipalityName: recipient.address.municipalityName,
            deliveryInstructions: recipient.deliveryInstructions
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

  const filteredMunicipalities = municipalities.filter(
    m => m.stateId === recipient.address.provinceId
  )

  return (
    <div className="pb-24">
      {/* Progress Bar */}
      <div className="px-4 pt-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          {STEPS.slice(0, -1).map((step, index) => {
            const isActive = index === currentStepIndex
            const isCompleted = index < currentStepIndex
            const Icon = step.icon

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
            <AlertCircle className="w-5 h-5 text-red-400" />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Nombre *</label>
                  <input
                    type="text"
                    value={sender.firstName}
                    onChange={(e) => setSender({ ...sender, firstName: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Apellido</label>
                  <input
                    type="text"
                    value={sender.lastName}
                    onChange={(e) => setSender({ ...sender, lastName: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="Perez"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Telefono *</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="tel"
                    value={sender.phone}
                    onChange={(e) => setSender({ ...sender, phone: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="(305) 555-0123"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Direccion *</label>
                <div className="relative">
                  <Home className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={sender.address.street}
                    onChange={(e) => setSender({
                      ...sender,
                      address: { ...sender.address, street: e.target.value }
                    })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="123 Main St"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Ciudad</label>
                  <input
                    type="text"
                    value={sender.address.city || ''}
                    onChange={(e) => setSender({
                      ...sender,
                      address: { ...sender.address, city: e.target.value }
                    })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="Miami"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Zip Code</label>
                  <input
                    type="text"
                    value={sender.address.zipCode || ''}
                    onChange={(e) => setSender({
                      ...sender,
                      address: { ...sender.address, zipCode: e.target.value }
                    })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="33012"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">PIN de Entrada</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={sender.entryPin || ''}
                    onChange={(e) => setSender({ ...sender, entryPin: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="1234"
                  />
                </div>
              </div>
            </div>
          )}

          {/* RECIPIENT STEP */}
          {currentStep === 'recipient' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Nombre *</label>
                  <input
                    type="text"
                    value={recipient.firstName}
                    onChange={(e) => setRecipient({ ...recipient, firstName: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="Maria"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Apellido</label>
                  <input
                    type="text"
                    value={recipient.lastName}
                    onChange={(e) => setRecipient({ ...recipient, lastName: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="Garcia"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Telefono *</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="tel"
                    value={recipient.phone}
                    onChange={(e) => setRecipient({ ...recipient, phone: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="+53 5555 5555"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Calle *</label>
                <input
                  type="text"
                  value={recipient.address.street}
                  onChange={(e) => setRecipient({
                    ...recipient,
                    address: { ...recipient.address, street: e.target.value }
                  })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                  placeholder="Calle 23"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Numero</label>
                  <input
                    type="text"
                    value={recipient.address.number || ''}
                    onChange={(e) => setRecipient({
                      ...recipient,
                      address: { ...recipient.address, number: e.target.value }
                    })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="#123"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Reparto</label>
                  <input
                    type="text"
                    value={recipient.address.reparto || ''}
                    onChange={(e) => setRecipient({
                      ...recipient,
                      address: { ...recipient.address, reparto: e.target.value }
                    })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary outline-none"
                    placeholder="Vedado"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1 block">Provincia *</label>
                <select
                  value={recipient.address.provinceId || ''}
                  onChange={(e) => {
                    const provinceId = parseInt(e.target.value)
                    const province = provinces.find(p => p.id === provinceId)
                    setRecipient({
                      ...recipient,
                      address: {
                        ...recipient.address,
                        provinceId,
                        provinceName: province?.name || '',
                        municipalityId: undefined,
                        municipalityName: ''
                      }
                    })
                  }}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-exa-primary outline-none"
                >
                  <option value="">Seleccionar provincia</option>
                  {provinces.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {recipient.address.provinceId && (
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Municipio *</label>
                  <select
                    value={recipient.address.municipalityId || ''}
                    onChange={(e) => {
                      const municipalityId = parseInt(e.target.value)
                      const municipality = municipalities.find(m => m.id === municipalityId)
                      setRecipient({
                        ...recipient,
                        address: {
                          ...recipient.address,
                          municipalityId,
                          municipalityName: municipality?.name || ''
                        }
                      })
                    }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-exa-primary outline-none"
                  >
                    <option value="">Seleccionar municipio</option>
                    {filteredMunicipalities.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
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
                    shippingType === 'air'
                      ? 'bg-exa-primary text-white'
                      : 'text-gray-400'
                  }`}
                >
                  <Plane className="w-4 h-4" />
                  Aereo
                </button>
                <button
                  onClick={() => setShippingType('maritime')}
                  className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
                    shippingType === 'maritime'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400'
                  }`}
                >
                  <Ship className="w-4 h-4" />
                  Maritimo
                </button>
              </div>

              {/* Empaque Code */}
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Codigo Empaque</label>
                <input
                  type="text"
                  value={empaqueCode}
                  onChange={(e) => setEmpaqueCode(e.target.value.toUpperCase())}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono placeholder-gray-500 focus:border-exa-primary outline-none"
                  placeholder="EMP-2025-0001"
                />
              </div>

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
                        <button
                          onClick={() => removeProductFromCart(p.productId)}
                          className="p-1 text-red-400"
                        >
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

              {/* Product Grid */}
              <div>
                <p className="text-gray-400 text-sm mb-2">Agregar productos</p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {catalogProducts.slice(0, 12).map(p => (
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
                {[
                  { id: 'terminal', label: 'Terminal Square', icon: CreditCard, color: 'exa-primary' },
                  { id: 'cash', label: 'Efectivo', icon: DollarSign, color: 'green-500' },
                  { id: 'zelle', label: 'Zelle', icon: Phone, color: 'purple-500' }
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      paymentMethod === method.id
                        ? `bg-${method.color}/10 border-${method.color}/50`
                        : 'bg-gray-800/50 border-gray-700/50'
                    }`}
                  >
                    <method.icon className={`w-5 h-5 ${
                      paymentMethod === method.id ? `text-${method.color}` : 'text-gray-400'
                    }`} />
                    <span className={paymentMethod === method.id ? 'text-white' : 'text-gray-300'}>
                      {method.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Cash Input */}
              {paymentMethod === 'cash' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-400 text-sm mb-1 block">Monto Recibido</label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-xl font-semibold focus:border-green-500 outline-none"
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
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
                <div>
                  <label className="text-gray-400 text-sm mb-1 block">Referencia Zelle</label>
                  <input
                    type="text"
                    value={zelleReference}
                    onChange={(e) => setZelleReference(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                    placeholder="Z123456789"
                  />
                </div>
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
                    setSender({ firstName: '', lastName: '', phone: '', address: { street: '' } })
                    setRecipient({ firstName: '', lastName: '', phone: '', address: { street: '' } })
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
              className="flex-1 py-3 bg-gradient-to-r from-exa-primary to-exa-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
