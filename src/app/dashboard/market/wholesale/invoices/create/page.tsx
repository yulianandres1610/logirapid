'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Package,
  Settings,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Minus,
  Trash2,
  FileText,
  Building2,
  Tag,
  Percent,
  Calendar,
  ShoppingCart,
  AlertCircle,
  Loader2,
  X,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Hash,
  User
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Customer {
  id: number
  code: string
  businessName: string
  legalName?: string
  taxId?: string
  contactName?: string
  email?: string
  phone?: string
  address?: string
  pricelistId: number | null
  pricelistName: string | null
  creditDays: number
}

interface Product {
  id: number
  name: string
  sku: string
  barcode: string | null
  sellingPrice: number
  costPrice: number
  imageUrl: string | null
  stock: number
}

interface InvoiceLine {
  productId: number
  variantId: number | null
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  originalPrice: number
  discountPercent: number
  discountAmount: number
  subtotal: number
}

interface Warehouse {
  id: number
  name: string
}

interface Pricelist {
  id: number
  name: string
}

const STEPS = [
  { id: 'customer', title: 'Cliente', icon: Users },
  { id: 'products', title: 'Productos', icon: Package },
  { id: 'conditions', title: 'Condiciones', icon: Settings },
  { id: 'confirm', title: 'Confirmación', icon: CheckCircle }
]

export default function CreateInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const preselectedCustomerId = searchParams.get('customerId')

  const [currentStep, setCurrentStep] = useState<string>('customer')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [pricelists, setPricelists] = useState<Pricelist[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)

  // Step 2: Products
  const [productSearch, setProductSearch] = useState('')
  const [lines, setLines] = useState<InvoiceLine[]>([])

  // Step 3: Conditions
  const [dueDate, setDueDate] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    businessName: '',
    legalName: '',
    taxId: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    pricelistId: '',
    creditDays: '0'
  })
  const [savingCustomer, setSavingCustomer] = useState(false)

  useEffect(() => {
    fetchCustomers()
    fetchWarehouses()
    fetchProducts()
    fetchPricelists()
  }, [])

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === parseInt(preselectedCustomerId))
      if (customer) {
        setSelectedCustomer(customer)
      }
    }
  }, [preselectedCustomerId, customers])

  const fetchCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const response = await fetch('/api/market/wholesale/customers?status=active&limit=200')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setCustomers(result.data.customers)
        }
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoadingCustomers(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/market/warehouses')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setWarehouses(result.data.warehouses || result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      const response = await fetch('/api/market/products?limit=500')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setProducts(result.data.products || result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchPricelists = async () => {
    try {
      const response = await fetch('/api/market/pricelists')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setPricelists(result.data.pricelists || result.data || [])
        }
      }
    } catch (error) {
      console.error('Error fetching pricelists:', error)
    }
  }

  const addProduct = (product: Product) => {
    const existingIndex = lines.findIndex(l => l.productId === product.id)
    if (existingIndex >= 0) {
      const newLines = [...lines]
      newLines[existingIndex].quantity += 1
      newLines[existingIndex].subtotal = newLines[existingIndex].quantity * newLines[existingIndex].unitPrice
      setLines(newLines)
    } else {
      setLines([...lines, {
        productId: product.id,
        variantId: null,
        productName: product.name,
        productSku: product.sku || '',
        quantity: 1,
        unitPrice: product.sellingPrice,
        originalPrice: product.sellingPrice,
        discountPercent: 0,
        discountAmount: 0,
        subtotal: product.sellingPrice
      }])
    }
  }

  const updateLineQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return
    const newLines = [...lines]
    newLines[index].quantity = quantity
    newLines[index].subtotal = quantity * newLines[index].unitPrice * (1 - newLines[index].discountPercent / 100)
    setLines(newLines)
  }

  const updateLineDiscount = (index: number, discount: number) => {
    const newLines = [...lines]
    newLines[index].discountPercent = discount
    newLines[index].discountAmount = newLines[index].quantity * newLines[index].unitPrice * discount / 100
    newLines[index].subtotal = newLines[index].quantity * newLines[index].unitPrice - newLines[index].discountAmount
    setLines(newLines)
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
  const globalDiscount = subtotal * discountPercent / 100
  const total = subtotal - globalDiscount

  const validateStep = (step: string): boolean => {
    setError('')

    switch (step) {
      case 'customer':
        if (!selectedCustomer) {
          setError('Debe seleccionar un cliente')
          return false
        }
        return true

      case 'products':
        if (lines.length === 0) {
          setError('Debe agregar al menos un producto')
          return false
        }
        return true

      case 'conditions':
        return true

      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) {
        setCurrentStep(STEPS[nextIndex].id)
      }
    }
  }

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
    setError('')
  }

  const handleSaveCustomer = async () => {
    if (!newCustomer.businessName.trim()) {
      setError('El nombre comercial es requerido')
      return
    }

    setSavingCustomer(true)
    try {
      const response = await fetch('/api/market/wholesale/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: newCustomer.businessName,
          legalName: newCustomer.legalName || null,
          taxId: newCustomer.taxId || null,
          contactName: newCustomer.contactName || null,
          email: newCustomer.email || null,
          phone: newCustomer.phone || null,
          address: newCustomer.address || null,
          city: newCustomer.city || null,
          pricelistId: newCustomer.pricelistId ? parseInt(newCustomer.pricelistId) : null,
          creditDays: parseInt(newCustomer.creditDays) || 0
        })
      })

      const result = await response.json()
      if (result.success) {
        // Add new customer to list and select it
        const created = result.data
        setCustomers(prev => [...prev, created])
        setSelectedCustomer(created)
        setShowCreateCustomerModal(false)
        setNewCustomer({
          businessName: '',
          legalName: '',
          taxId: '',
          contactName: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          pricelistId: '',
          creditDays: '0'
        })
      } else {
        setError(result.error || 'Error al crear cliente')
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      setError('Error de conexión')
    } finally {
      setSavingCustomer(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedCustomer) return
    setSaving(true)

    try {
      const response = await fetch('/api/market/wholesale/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          warehouseId: selectedWarehouse,
          pricelistId: selectedCustomer.pricelistId,
          dueDate: dueDate || null,
          discountPercent,
          notes,
          internalNotes,
          lines: lines.map(l => ({
            productId: l.productId,
            variantId: l.variantId,
            productName: l.productName,
            productSku: l.productSku,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            originalPrice: l.originalPrice,
            discountPercent: l.discountPercent,
            discountAmount: l.discountAmount
          }))
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          router.push(`/dashboard/market/wholesale/invoices/${result.data.id}`)
        }
      }
    } catch (error) {
      console.error('Error creating invoice:', error)
      setError('Error al crear factura')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const filteredCustomers = customers.filter(c =>
    c.businessName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.taxId && c.taxId.toLowerCase().includes(customerSearch.toLowerCase()))
  )

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
    (p.barcode && p.barcode.includes(productSearch))
  )

  return (
    <div className={cn(
      "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      <div className="max-w-5xl xl:max-w-6xl mx-auto space-y-6 sm:space-y-8 relative">
        {/* Close Button */}
        <motion.button
          onClick={() => setShowCancelModal(true)}
          className={cn(
            "absolute -top-2 right-0 sm:right-0 p-2 rounded-full transition-colors z-10",
            theme === 'dark'
              ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              : 'bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-100 shadow-sm'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Header */}
        <div className="text-center">
          <h1 className={cn(
            "text-2xl sm:text-3xl lg:text-4xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Nueva Factura
          </h1>
          <p className={cn(
            "text-sm sm:text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Crea una nueva factura para cliente mayorista
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStepIndex > index

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className="relative w-14 h-14">
                    {/* Pulsing ring for active step */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-green-500"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 0, 0.5]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}
                    <motion.div
                      className={cn(
                        "relative w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                            ? 'bg-green-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-800 text-gray-500'
                              : 'bg-gray-200 text-gray-500'
                      )}
                      animate={{
                        scale: isActive ? 1 : 0.9,
                        backgroundColor: isCompleted
                          ? '#22c55e'
                          : isActive
                            ? '#16a34a'
                            : theme === 'dark'
                              ? '#1f2937'
                              : '#e5e7eb'
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </motion.div>
                  </div>
                  <span className={cn(
                    "text-xs mt-2 hidden sm:block text-center font-medium",
                    isActive
                      ? 'text-green-600'
                      : isCompleted
                        ? 'text-green-600'
                        : theme === 'dark'
                          ? 'text-gray-500'
                          : 'text-gray-400'
                  )}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="relative w-8 sm:w-16 lg:w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-green-500 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: currentStepIndex > index ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700 dark:text-red-400">{error}</span>
              <button onClick={() => setError('')} className="ml-auto">
                <X className="w-4 h-4 text-red-500" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Content */}
        <div className={cn(
          "rounded-2xl shadow-lg p-6",
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}>
          <AnimatePresence mode="wait">
            {/* Step 1: Customer */}
            {currentStep === 'customer' && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Seleccionar Cliente
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreateCustomerModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo Cliente
                  </motion.button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, código o RUC/NIT..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className={cn(
                      "w-full pl-12 pr-4 py-3.5 rounded-xl border focus:outline-none focus:ring-2 transition-all",
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                {/* Customer List */}
                {loadingCustomers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {filteredCustomers.map(customer => (
                      <div
                        key={customer.id}
                        onClick={() => setSelectedCustomer(customer)}
                        className={cn(
                          "p-4 border-2 rounded-xl cursor-pointer transition-all",
                          selectedCustomer?.id === customer.id
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg',
                            selectedCustomer?.id === customer.id
                              ? 'bg-gradient-to-br from-green-500 to-green-600'
                              : 'bg-gradient-to-br from-gray-400 to-gray-500'
                          )}>
                            {customer.businessName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'font-semibold truncate',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>{customer.businessName}</p>
                            <p className="text-sm text-gray-500">{customer.code}</p>
                            {customer.taxId && (
                              <p className="text-xs text-gray-400">RUC: {customer.taxId}</p>
                            )}
                          </div>
                          {selectedCustomer?.id === customer.id && (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        {customer.pricelistName && (
                          <div className="mt-3 flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">{customer.pricelistName}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Warehouse selection */}
                {selectedCustomer && warehouses.length > 0 && (
                  <div className={cn(
                    'p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
                  )}>
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <label className="font-medium text-sm">Almacén de Origen (opcional)</label>
                    </div>
                    <select
                      value={selectedWarehouse || ''}
                      onChange={(e) => setSelectedWarehouse(e.target.value ? parseInt(e.target.value) : null)}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                      )}
                    >
                      <option value="">Sin especificar</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Products */}
            {currentStep === 'products' && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Agregar Productos
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Product Search */}
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar producto por nombre, SKU o código..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className={cn(
                          'w-full pl-12 pr-4 py-3.5 rounded-xl border focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                        )}
                      />
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {loadingProducts ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                        </div>
                      ) : (
                        filteredProducts.slice(0, 30).map(product => (
                          <div
                            key={product.id}
                            onClick={() => addProduct(product)}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                              theme === 'dark'
                                ? 'border-gray-700 hover:bg-gray-700 hover:border-gray-600'
                                : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden',
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                              )}>
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-6 h-6 text-gray-400" />
                                )}
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium text-sm',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>{product.name}</p>
                                <p className="text-xs text-gray-500">{product.sku}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-600">{formatCurrency(product.sellingPrice)}</p>
                              <button className="text-xs text-green-500 hover:text-green-600 font-medium flex items-center gap-1">
                                <Plus className="w-3.5 h-3.5" /> Agregar
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Invoice Lines */}
                  <div className={cn(
                    'p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
                  )}>
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingCart className="w-5 h-5 text-gray-400" />
                      <h3 className="font-semibold">Productos ({lines.length})</h3>
                    </div>
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                      {lines.length === 0 ? (
                        <div className="text-center py-12">
                          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-gray-500">No hay productos agregados</p>
                          <p className="text-sm text-gray-400">Busca y agrega productos</p>
                        </div>
                      ) : (
                        lines.map((line, index) => (
                          <div
                            key={index}
                            className={cn(
                              'p-3 rounded-xl border',
                              theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                            )}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <p className={cn(
                                'font-medium text-sm',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>{line.productName}</p>
                              <button
                                onClick={() => removeLine(index)}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => updateLineQuantity(index, line.quantity - 1)}
                                  className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                  )}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="number"
                                  value={line.quantity}
                                  onChange={(e) => updateLineQuantity(index, parseInt(e.target.value) || 1)}
                                  className={cn(
                                    'w-14 text-center px-2 py-1.5 rounded-lg border text-sm',
                                    theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                                  )}
                                />
                                <button
                                  onClick={() => updateLineQuantity(index, line.quantity + 1)}
                                  className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                                  )}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Percent className="w-3.5 h-3.5 text-gray-400" />
                                <input
                                  type="number"
                                  value={line.discountPercent}
                                  onChange={(e) => updateLineDiscount(index, parseFloat(e.target.value) || 0)}
                                  className={cn(
                                    'w-14 text-center px-2 py-1.5 rounded-lg border text-sm',
                                    theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-300'
                                  )}
                                  min="0"
                                  max="100"
                                />
                              </div>
                              <p className="font-bold text-green-600 ml-auto">
                                {formatCurrency(line.subtotal)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {lines.length > 0 && (
                      <div className={cn(
                        'mt-4 pt-4 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>Subtotal:</span>
                          <span className="text-green-600">{formatCurrency(subtotal)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Conditions */}
            {currentStep === 'conditions' && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Condiciones de la Factura
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Percent className="w-4 h-4 inline mr-2" />
                      Descuento Global
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border pr-12 focus:outline-none focus:ring-2',
                          theme === 'dark'
                            ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                            : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                        )}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Fecha de Vencimiento
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                      )}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Notas para el Cliente
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Condiciones, observaciones..."
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                      )}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FileText className="w-4 h-4 inline mr-2 text-gray-400" />
                      Notas Internas
                      <span className="text-xs text-gray-400 ml-2">(no visibles para el cliente)</span>
                    </label>
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      rows={2}
                      placeholder="Notas internas..."
                      className={cn(
                        'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:border-gray-500 focus:ring-gray-500/20'
                          : 'bg-white border-gray-300 text-gray-900 focus:border-gray-500 focus:ring-gray-500/20'
                      )}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Confirmation */}
            {currentStep === 'confirm' && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Confirmar Factura
                </h2>

                <div className="space-y-6">
                  {/* Customer Summary */}
                  <div className={cn(
                    'rounded-xl p-4',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                  )}>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      Cliente
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-xl">
                        {selectedCustomer?.businessName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-lg text-gray-900 dark:text-white">
                          {selectedCustomer?.businessName}
                        </p>
                        <p className="text-sm text-gray-500">{selectedCustomer?.code}</p>
                        {selectedCustomer?.taxId && (
                          <p className="text-xs text-gray-400">RUC/NIT: {selectedCustomer.taxId}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Products Summary */}
                  <div className={cn(
                    'rounded-xl p-4',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                  )}>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Package className="w-5 h-5 text-green-600" />
                      Productos ({lines.length})
                    </h3>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {lines.map((line, index) => (
                        <div key={index} className={cn(
                          'flex justify-between items-center p-3 rounded-lg',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium',
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                            )}>{line.quantity}</span>
                            <span className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {line.productName}
                            </span>
                          </div>
                          <span className="font-semibold text-green-600">{formatCurrency(line.subtotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className={cn(
                    'rounded-xl p-4',
                    theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
                  )}>
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-green-600" />
                      Resumen
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(subtotal)}</span>
                      </div>
                      {discountPercent > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Descuento ({discountPercent}%)</span>
                          <span>-{formatCurrency(globalDiscount)}</span>
                        </div>
                      )}
                      <div className={cn(
                        'flex justify-between text-xl font-bold pt-3 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <span>Total</span>
                        <span className="text-green-600">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className={cn(
            "flex items-center justify-between mt-8 pt-6 border-t",
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <motion.button
              onClick={prevStep}
              disabled={currentStepIndex === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors",
                currentStepIndex === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-600 hover:bg-gray-100'
              )}
              whileHover={currentStepIndex > 0 ? { scale: 1.02 } : {}}
              whileTap={currentStepIndex > 0 ? { scale: 0.98 } : {}}
            >
              <ArrowLeft className="w-5 h-5" />
              Anterior
            </motion.button>

            {currentStepIndex < STEPS.length - 1 ? (
              <motion.button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Siguiente
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            ) : (
              <motion.button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                whileHover={!saving ? { scale: 1.02 } : {}}
                whileTap={!saving ? { scale: 0.98 } : {}}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Crear Factura
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-2xl p-6 max-w-md w-full shadow-xl",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={cn(
                "text-lg font-bold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                ¿Cancelar factura?
              </h3>
              <p className={cn(
                "mb-6",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Perderás todos los datos ingresados. ¿Estás seguro?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Continuar editando
                </button>
                <button
                  onClick={() => router.push('/dashboard/market/wholesale/invoices')}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                >
                  Sí, cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Customer Modal */}
      <AnimatePresence>
        {showCreateCustomerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateCustomerModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Nuevo Cliente Mayorista
                </h3>
                <button
                  onClick={() => setShowCreateCustomerModal(false)}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Building2 className="w-4 h-4 inline mr-2" />
                    Nombre Comercial *
                  </label>
                  <input
                    type="text"
                    value={newCustomer.businessName}
                    onChange={(e) => setNewCustomer({ ...newCustomer, businessName: e.target.value })}
                    placeholder="Nombre de la empresa"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Razón Social
                  </label>
                  <input
                    type="text"
                    value={newCustomer.legalName}
                    onChange={(e) => setNewCustomer({ ...newCustomer, legalName: e.target.value })}
                    placeholder="Razón social"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Hash className="w-4 h-4 inline mr-2" />
                    RUC/NIT/RFC
                  </label>
                  <input
                    type="text"
                    value={newCustomer.taxId}
                    onChange={(e) => setNewCustomer({ ...newCustomer, taxId: e.target.value })}
                    placeholder="Identificación fiscal"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Contacto
                  </label>
                  <input
                    type="text"
                    value={newCustomer.contactName}
                    onChange={(e) => setNewCustomer({ ...newCustomer, contactName: e.target.value })}
                    placeholder="Nombre del contacto"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Phone className="w-4 h-4 inline mr-2" />
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    placeholder="correo@empresa.com"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    placeholder="Dirección completa"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Tag className="w-4 h-4 inline mr-2" />
                    Lista de Precios
                  </label>
                  <select
                    value={newCustomer.pricelistId}
                    onChange={(e) => setNewCustomer({ ...newCustomer, pricelistId: e.target.value })}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  >
                    <option value="">Sin lista asignada</option>
                    {pricelists.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Días de Crédito
                  </label>
                  <input
                    type="number"
                    value={newCustomer.creditDays}
                    onChange={(e) => setNewCustomer({ ...newCustomer, creditDays: e.target.value })}
                    placeholder="0"
                    min="0"
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-900 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                    )}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowCreateCustomerModal(false)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCustomer}
                  disabled={savingCustomer}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingCustomer ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Crear Cliente
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
