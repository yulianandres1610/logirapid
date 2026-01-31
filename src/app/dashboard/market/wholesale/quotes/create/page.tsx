'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Package,
  Settings,
  Check,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  X,
  Building2,
  Tag,
  Percent,
  Calendar,
  FileText,
  ShoppingCart,
  CheckCircle,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Customer {
  id: number
  code: string
  businessName: string
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
  profitMargin?: number
}

interface QuoteLine {
  productId: number
  variantId: number | null
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  unitPriceCup: number // Selling price in CUP (BCC rate)
  originalPrice: number
  subtotal: number
  subtotalCup: number // Subtotal in CUP
  costPrice: number
  profitMargin: number
  hasPricelistPrice: boolean
  pricelistDiscountInfo: string | null
}

interface PricelistItem {
  id: number
  productId: number
  categoryId: number | null
  priceType: 'fixed' | 'discount_percent' | 'discount_amount'
  fixedPrice: number | null
  discountPercent: number | null
  discountAmount: number | null
  minQuantity: number
}

interface Warehouse {
  id: number
  name: string
}

type Step = 'customer' | 'products' | 'conditions' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'customer', title: 'Cliente', description: 'Seleccionar', icon: Users },
  { id: 'products', title: 'Productos', description: 'Agregar líneas', icon: Package },
  { id: 'conditions', title: 'Condiciones', description: 'Configurar', icon: Settings },
  { id: 'review', title: 'Confirmar', description: 'Revisar y crear', icon: Check }
]

const STORAGE_KEY = 'wholesale_quote_draft'

// Helper to serialize lines for storage
const serializeLines = (lines: QuoteLine[]) => {
  return lines.map(line => ({
    productId: line.productId,
    variantId: line.variantId,
    productName: line.productName,
    productSku: line.productSku,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    unitPriceCup: line.unitPriceCup,
    originalPrice: line.originalPrice,
    subtotal: line.subtotal,
    subtotalCup: line.subtotalCup,
    costPrice: line.costPrice,
    profitMargin: line.profitMargin,
    hasPricelistPrice: line.hasPricelistPrice,
    pricelistDiscountInfo: line.pricelistDiscountInfo
  }))
}

export default function CreateQuotePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')

  // Read initial step from URL
  const initialStep = searchParams.get('step') as Step | null
  const validSteps = STEPS.map(s => s.id)
  const [currentStep, setCurrentStep] = useState<Step>(
    initialStep && validSteps.includes(initialStep) ? initialStep : 'customer'
  )
  const [saving, setSaving] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Step 1: Customer
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)

  // Step 2: Products
  const [products, setProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [lines, setLines] = useState<QuoteLine[]>([])

  // Step 3: Conditions
  const [validUntil, setValidUntil] = useState('')
  const [discountPercent, setDiscountPercent] = useState(0)
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  // Pricelist state
  const [pricelistItems, setPricelistItems] = useState<PricelistItem[]>([])
  const [loadingPricelist, setLoadingPricelist] = useState(false)

  // Exchange rates
  const [exchangeRateBCC, setExchangeRateBCC] = useState(411) // BCC rate for selling

  const [isRestoring, setIsRestoring] = useState(true)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Update URL with current step and customer
  const updateURL = useCallback((step: string, customerId?: number) => {
    const params = new URLSearchParams()
    params.set('step', step)
    if (customerId) {
      params.set('customerId', customerId.toString())
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router])

  // Save form state to localStorage
  const saveToStorage = useCallback(() => {
    if (isRestoring) return
    const state = {
      customerId: selectedCustomer?.id || null,
      warehouseId: selectedWarehouse,
      lines: serializeLines(lines),
      validUntil,
      discountPercent,
      notes,
      internalNotes,
      timestamp: Date.now()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [selectedCustomer, selectedWarehouse, lines, validUntil, discountPercent, notes, internalNotes, isRestoring])

  // Clear storage after successful save
  const clearStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Restore state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(STORAGE_KEY)
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        // Check if saved state is less than 24 hours old
        if (state.timestamp && Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          if (state.warehouseId) setSelectedWarehouse(state.warehouseId)
          if (state.validUntil) setValidUntil(state.validUntil)
          if (state.discountPercent) setDiscountPercent(state.discountPercent)
          if (state.notes) setNotes(state.notes)
          if (state.internalNotes) setInternalNotes(state.internalNotes)
        } else {
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (e) {
        console.error('Error restoring saved state:', e)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setIsRestoring(false)
  }, [])

  // Restore customer and lines after data is loaded
  useEffect(() => {
    if (isRestoring || customers.length === 0 || products.length === 0) return

    const savedState = localStorage.getItem(STORAGE_KEY)
    if (savedState) {
      try {
        const state = JSON.parse(savedState)
        if (state.timestamp && Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
          // Restore customer if not already set
          if (state.customerId && !selectedCustomer) {
            const customer = customers.find(c => c.id === state.customerId)
            if (customer) {
              setSelectedCustomer(customer)
              if (customer.pricelistId) {
                fetchPricelistItems(customer.pricelistId)
              }
            }
          }
          // Restore lines
          if (state.lines && state.lines.length > 0 && lines.length === 0) {
            const restoredLines = state.lines.map((savedLine: Partial<QuoteLine>) => {
              const product = products.find(p => p.id === savedLine.productId)
              if (product) {
                return {
                  ...savedLine
                } as QuoteLine
              }
              return null
            }).filter(Boolean) as QuoteLine[]
            if (restoredLines.length > 0) {
              setLines(restoredLines)
            }
          }
        }
      } catch (e) {
        console.error('Error restoring customer/lines:', e)
      }
    }
  }, [isRestoring, customers, products, selectedCustomer, lines.length])

  // Save to storage when state changes
  useEffect(() => {
    saveToStorage()
  }, [saveToStorage])

  // Update URL when step changes
  useEffect(() => {
    updateURL(currentStep, selectedCustomer?.id)
  }, [currentStep, selectedCustomer?.id, updateURL])

  useEffect(() => {
    fetchCustomers()
    fetchWarehouses()
    fetchProducts()
    fetchExchangeRates()
  }, [])

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('/api/market/pos/exchange-rates')
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.rates) {
          setExchangeRateBCC(result.rates.CUP || 411)
        }
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error)
    }
  }

  useEffect(() => {
    if (preselectedCustomerId && customers.length > 0) {
      const customer = customers.find(c => c.id === parseInt(preselectedCustomerId))
      if (customer) {
        handleSelectCustomer(customer)
      }
    }
  }, [preselectedCustomerId, customers])

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/market/wholesale/customers?status=active&limit=100')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setCustomers(result.data.customers)
        }
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
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
    try {
      const response = await fetch('/api/market/products?limit=500&includeWarehouseStock=true')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setProducts(result.data.products || result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchPricelistItems = async (pricelistId: number) => {
    setLoadingPricelist(true)
    try {
      const response = await fetch(`/api/market/pricelists/${pricelistId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data.items) {
          setPricelistItems(result.data.items.map((item: {
            id: number
            productId: number
            categoryId: number | null
            priceType: string
            fixedPrice: number | null
            discountPercent: number | null
            discountAmount: number | null
            minQuantity: number
          }) => ({
            id: item.id,
            productId: item.productId,
            categoryId: item.categoryId,
            priceType: item.priceType as 'fixed' | 'discount_percent' | 'discount_amount',
            fixedPrice: item.fixedPrice,
            discountPercent: item.discountPercent,
            discountAmount: item.discountAmount,
            minQuantity: item.minQuantity || 1
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching pricelist items:', error)
    } finally {
      setLoadingPricelist(false)
    }
  }

  // Calculate price from pricelist for a product
  const getPricelistPrice = (productId: number, basePrice: number, quantity: number = 1): { price: number; hasDiscount: boolean; discountInfo: string | null } => {
    const applicableItems = pricelistItems
      .filter(item => item.productId === productId && item.minQuantity <= quantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)

    if (applicableItems.length === 0) {
      return { price: basePrice, hasDiscount: false, discountInfo: null }
    }

    const item = applicableItems[0]

    if (item.priceType === 'fixed' && item.fixedPrice !== null) {
      const discount = ((basePrice - item.fixedPrice) / basePrice) * 100
      return {
        price: item.fixedPrice,
        hasDiscount: true,
        discountInfo: `Precio fijo de lista (-${discount.toFixed(0)}%)`
      }
    } else if (item.priceType === 'discount_percent' && item.discountPercent !== null) {
      const discountedPrice = basePrice * (1 - item.discountPercent / 100)
      return {
        price: discountedPrice,
        hasDiscount: true,
        discountInfo: `${item.discountPercent}% descuento de lista`
      }
    } else if (item.priceType === 'discount_amount' && item.discountAmount !== null) {
      const discountedPrice = Math.max(0, basePrice - item.discountAmount)
      return {
        price: discountedPrice,
        hasDiscount: true,
        discountInfo: `$${item.discountAmount} descuento de lista`
      }
    }

    return { price: basePrice, hasDiscount: false, discountInfo: null }
  }

  // Handle customer selection - also fetch pricelist items
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setPricelistItems([])
    setLines([])
    if (customer.pricelistId) {
      fetchPricelistItems(customer.pricelistId)
    }
  }

  const addProduct = (product: Product) => {
    const existingIndex = lines.findIndex(l => l.productId === product.id)
    if (existingIndex >= 0) {
      const newLines = [...lines]
      newLines[existingIndex].quantity += 1
      newLines[existingIndex].subtotal = newLines[existingIndex].quantity * newLines[existingIndex].unitPrice
      newLines[existingIndex].subtotalCup = newLines[existingIndex].subtotal * exchangeRateBCC
      setLines(newLines)
    } else {
      // Check if there's a pricelist price for this product
      const { price: pricelistPrice, hasDiscount, discountInfo } = getPricelistPrice(
        product.id,
        product.sellingPrice,
        1
      )

      const unitPrice = hasDiscount ? pricelistPrice : product.sellingPrice

      // Calculate profit margin based on actual unit price
      const profitMargin = product.costPrice > 0
        ? ((unitPrice - product.costPrice) / product.costPrice) * 100
        : 0

      setLines([...lines, {
        productId: product.id,
        variantId: null,
        productName: product.name,
        productSku: product.sku || '',
        quantity: 1,
        unitPrice,
        unitPriceCup: unitPrice * exchangeRateBCC,
        originalPrice: product.sellingPrice,
        subtotal: unitPrice,
        subtotalCup: unitPrice * exchangeRateBCC,
        costPrice: product.costPrice,
        profitMargin,
        hasPricelistPrice: hasDiscount,
        pricelistDiscountInfo: discountInfo
      }])
    }
  }

  const updateLineQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return
    const newLines = [...lines]
    newLines[index].quantity = quantity
    newLines[index].subtotal = quantity * newLines[index].unitPrice
    newLines[index].subtotalCup = newLines[index].subtotal * exchangeRateBCC
    setLines(newLines)
  }

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index))
  }

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0)
  const globalDiscount = subtotal * discountPercent / 100
  const total = subtotal - globalDiscount

  const validateStep = (step: Step): boolean => {
    switch (step) {
      case 'customer': return selectedCustomer !== null
      case 'products': return lines.length > 0
      case 'conditions': return true
      default: return true
    }
  }

  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id)
  }

  const handleSubmit = async () => {
    if (!selectedCustomer) return
    setSaving(true)

    try {
      const response = await fetch('/api/market/wholesale/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          warehouseId: selectedWarehouse,
          pricelistId: selectedCustomer.pricelistId,
          validUntil: validUntil || null,
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
            originalPrice: l.originalPrice
          }))
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          clearStorage() // Clear saved draft on success
          router.push(`/dashboard/market/wholesale/quotes/${result.data.id}`)
        }
      }
    } catch (error) {
      console.error('Error creating quote:', error)
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

  const formatCUP = (value: number) => {
    return new Intl.NumberFormat('es-CU', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + ' CUP'
  }

  const filteredCustomers = customers.filter(c =>
    c.businessName.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())) ||
    (p.barcode && p.barcode.includes(productSearch))
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-[#1a2332]' : 'bg-gray-50'
        )}>
          <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8 relative">

            {/* Close Button */}
            <motion.button
              onClick={() => setShowCancelModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "absolute -top-14 -right-2 sm:-top-12 sm:right-0 z-10 w-8 h-8 rounded-full flex items-center justify-center",
                "transition-colors duration-200",
                theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              )}
            >
              <X className="w-4 h-4" />
            </motion.button>

            {/* Header */}
            <div className="text-center mb-4">
              <Link
                href="/dashboard/market/wholesale/quotes"
                className={cn(
                  "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a cotizaciones
              </Link>
              <h1 className={cn(
                "text-2xl sm:text-3xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Nueva Cotización
              </h1>
            </div>

            {/* Progress Indicator */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div className="relative w-14 h-14">
                        {/* Pulsing ring for active step */}
                        {currentStep === step.id && (
                          <motion.div
                            className="absolute inset-0 rounded-full"
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 0, 0.5]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            style={{
                              background: theme === 'dark'
                                ? 'rgba(59, 130, 246, 0.5)'
                                : 'rgba(37, 99, 235, 0.5)'
                            }}
                          />
                        )}

                        <motion.div
                          initial={false}
                          animate={{
                            scale: currentStep === step.id ? 1.1 : 1,
                            backgroundColor: currentStep === step.id
                              ? theme === 'dark' ? '#3B82F6' : '#2563EB'
                              : currentStepIndex > index
                                ? theme === 'dark' ? '#10B981' : '#059669'
                                : theme === 'dark' ? '#374151' : '#E5E7EB'
                          }}
                          transition={{
                            scale: { duration: 0.3 },
                            backgroundColor: { duration: 0.3 }
                          }}
                          whileHover={{ scale: currentStepIndex >= index ? 1.15 : 1.05 }}
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                            "transition-shadow duration-300",
                            currentStep === step.id && (
                              theme === 'dark'
                                ? 'shadow-lg shadow-blue-500/50'
                                : 'shadow-lg shadow-blue-400/50'
                            ),
                            currentStepIndex > index && (
                              theme === 'dark'
                                ? 'shadow-md shadow-green-500/30'
                                : 'shadow-md shadow-green-400/30'
                            )
                          )}
                        >
                          {currentStepIndex > index ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            >
                              <Check className="w-7 h-7 text-white" />
                            </motion.div>
                          ) : (
                            <step.icon className={cn(
                              "w-7 h-7",
                              currentStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )} />
                          )}
                        </motion.div>
                      </div>

                      <div className="mt-3 text-center">
                        <p className={cn(
                          "text-xs sm:text-sm font-semibold",
                          currentStep === step.id
                            ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            : currentStepIndex > index
                              ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                              : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {step.title}
                        </p>
                        <p className={cn(
                          "text-xs hidden sm:block mt-0.5",
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-500'
                        )}>
                          {step.description}
                        </p>
                      </div>
                    </div>

                    {index < STEPS.length - 1 && (
                      <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                        <div className={cn(
                          "absolute inset-0 rounded-full",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                        <motion.div
                          initial={false}
                          animate={{
                            scaleX: currentStepIndex > index ? 1 : 0
                          }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          className={cn(
                            "h-full origin-left rounded-full",
                            theme === 'dark' ? 'bg-green-500' : 'bg-green-600'
                          )}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <motion.div
              className={cn(
                "rounded-2xl p-6 sm:p-8",
                theme === 'dark'
                  ? 'bg-[#1a2332]'
                  : 'bg-white border border-gray-200 shadow-lg'
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                {/* Step 1: Customer */}
                {currentStep === 'customer' && (
                  <motion.div
                    key="customer"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      Seleccionar Cliente Mayorista
                    </h2>

                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar cliente por nombre o código..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className={cn(
                          'w-full pl-12 pr-4 py-3.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-2">
                      {filteredCustomers.map(customer => (
                        <motion.div
                          key={customer.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectCustomer(customer)}
                          className={cn(
                            'p-4 rounded-xl border-2 cursor-pointer transition-all',
                            selectedCustomer?.id === customer.id
                              ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                              : theme === 'dark'
                                ? 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg',
                              selectedCustomer?.id === customer.id
                                ? 'bg-gradient-to-br from-blue-500 to-blue-600'
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
                            </div>
                            {selectedCustomer?.id === customer.id && (
                              <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          {customer.pricelistName && (
                            <div className="mt-3 flex items-center gap-2">
                              <Tag className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-xs text-blue-500 font-medium">{customer.pricelistName}</span>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>

                    {selectedCustomer && (
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                      )}>
                        <div className="flex items-center gap-3 mb-3">
                          <Building2 className="w-5 h-5 text-gray-400" />
                          <h3 className="font-medium">Almacén de Origen (opcional)</h3>
                        </div>
                        <select
                          value={selectedWarehouse || ''}
                          onChange={(e) => setSelectedWarehouse(e.target.value ? parseInt(e.target.value) : null)}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
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
                    key="products"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <h2 className={cn(
                        "text-xl font-bold flex items-center gap-3",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        Agregar Productos
                      </h2>
                      <div className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm',
                        theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                      )}>
                        <DollarSign className="w-4 h-4" />
                        Tasa: $1 = {exchangeRateBCC.toLocaleString()} CUP
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Product Search */}
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Buscar producto..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className={cn(
                              'w-full pl-12 pr-4 py-3.5 rounded-xl border focus:outline-none focus:ring-2',
                              theme === 'dark'
                                ? 'bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                            )}
                          />
                        </div>

                        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                          {filteredProducts.slice(0, 20).map(product => (
                            <motion.div
                              key={product.id}
                              whileHover={{ scale: 1.01 }}
                              className={cn(
                                'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
                                theme === 'dark'
                                  ? 'border-gray-700 hover:bg-gray-800 hover:border-gray-600'
                                  : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                              )}
                              onClick={() => addProduct(product)}
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
                                <button className="text-xs text-purple-500 hover:text-purple-600 font-medium flex items-center gap-1">
                                  <Plus className="w-3.5 h-3.5" /> Agregar
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Quote Lines */}
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
                      )}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-gray-400" />
                            <h3 className="font-semibold">Productos ({lines.length})</h3>
                          </div>
                        </div>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                          {lines.length === 0 ? (
                            <div className="text-center py-12">
                              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                              <p className="text-gray-500">No hay productos agregados</p>
                            </div>
                          ) : (
                            lines.map((line, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                  'p-3 rounded-xl border',
                                  theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-white'
                                )}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className={cn(
                                      'font-medium text-sm',
                                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                                    )}>{line.productName}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {line.hasPricelistPrice ? (
                                        <>
                                          <span className="text-xs text-gray-400 line-through">{formatCurrency(line.originalPrice)}</span>
                                          <span className="text-xs text-green-600 font-medium">{formatCurrency(line.unitPrice)}</span>
                                        </>
                                      ) : (
                                        <span className="text-xs text-green-600 font-medium">{formatCurrency(line.unitPrice)}</span>
                                      )}
                                      <span className="text-xs text-gray-500">| {formatCUP(line.unitPriceCup)}</span>
                                    </div>
                                  </div>
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
                                        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
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
                                  <div className="ml-auto text-right">
                                    <p className="font-bold text-green-600">
                                      {formatCurrency(line.subtotal)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {formatCUP(line.subtotalCup)}
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>

                        {lines.length > 0 && (
                          <div className={cn(
                            'mt-4 pt-4 border-t',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                          )}>
                            <div className="flex justify-between items-center text-lg font-bold">
                              <span>Subtotal USD:</span>
                              <span className="text-green-600">{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm mt-1">
                              <span className="text-gray-500">Subtotal CUP:</span>
                              <span className={cn(
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>{formatCUP(subtotal * exchangeRateBCC)}</span>
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
                    key="conditions"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-white" />
                      </div>
                      Condiciones de la Cotización
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className="flex items-center gap-2 mb-3">
                          <Percent className="w-4 h-4 text-green-600" />
                          <label className="font-medium">Descuento Global</label>
                        </div>
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
                                ? 'bg-gray-800 border-gray-700 text-white focus:border-green-500 focus:ring-green-500/20'
                                : 'bg-white border-gray-300 text-gray-900 focus:border-green-500 focus:ring-green-500/20'
                            )}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                        </div>
                      </div>

                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <label className="font-medium">Válida Hasta</label>
                        </div>
                        <input
                          type="date"
                          value={validUntil}
                          onChange={(e) => setValidUntil(e.target.value)}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      <div className={cn(
                        'md:col-span-2 p-4 rounded-xl border',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-purple-600" />
                          <label className="font-medium">Notas para el Cliente</label>
                        </div>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          placeholder="Condiciones, observaciones..."
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500/20'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                          )}
                        />
                      </div>

                      <div className={cn(
                        'md:col-span-2 p-4 rounded-xl border',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <label className="font-medium">Notas Internas</label>
                        </div>
                        <textarea
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          rows={2}
                          placeholder="Notas internas (no visibles para el cliente)..."
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 resize-none',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-gray-500 focus:ring-gray-500/20'
                              : 'bg-white border-gray-300 text-gray-900 focus:border-gray-500 focus:ring-gray-500/20'
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Review */}
                {currentStep === 'review' && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      Revisar Cotización
                    </h2>

                    {/* Customer Summary */}
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
                    )}>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        Cliente
                      </h3>
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>{selectedCustomer?.businessName}</p>
                      <p className="text-sm text-gray-500">{selectedCustomer?.code}</p>
                    </div>

                    {/* Products Summary */}
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
                    )}>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4 text-purple-500" />
                        Productos ({lines.length})
                      </h3>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {lines.map((line, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{line.quantity}x {line.productName}</span>
                            <span className="font-medium">{formatCurrency(line.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totals */}
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'border-green-900/50 bg-green-900/20' : 'border-green-200 bg-green-50'
                    )}>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal USD:</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Subtotal CUP:</span>
                          <span className={cn(
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                          )}>{formatCUP(subtotal * exchangeRateBCC)}</span>
                        </div>
                        {discountPercent > 0 && (
                          <div className="flex justify-between text-red-500">
                            <span>Descuento ({discountPercent}%):</span>
                            <span>-{formatCurrency(globalDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xl font-bold pt-2 border-t border-green-300 dark:border-green-800">
                          <span>Total USD:</span>
                          <span className="text-green-600">{formatCurrency(total)}</span>
                        </div>
                        <div className="flex justify-between text-lg font-semibold">
                          <span className="text-gray-500">Total CUP:</span>
                          <span className={cn(
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>{formatCUP(total * exchangeRateBCC)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goToPrevStep}
                disabled={currentStepIndex === 0}
                className={cn(
                  "px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all",
                  currentStepIndex === 0
                    ? 'opacity-50 cursor-not-allowed'
                    : theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </motion.button>

              {currentStep === 'review' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white flex items-center gap-2 shadow-lg shadow-green-500/25 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Crear Cotización
                    </>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToNextStep}
                  disabled={!validateStep(currentStep)}
                  className={cn(
                    "px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all",
                    validateStep(currentStep)
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  )}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Cancel Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={() => setShowCancelModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full max-w-md p-6 rounded-2xl shadow-2xl',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <h3 className={cn(
                  'text-xl font-bold mb-4',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  ¿Cancelar cotización?
                </h3>
                <p className="text-gray-500 mb-6">
                  Se perderán todos los datos ingresados. ¿Estás seguro?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className={cn(
                      'flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    )}
                  >
                    Continuar editando
                  </button>
                  <button
                    onClick={() => {
                      clearStorage()
                      router.push('/dashboard/market/wholesale/quotes')
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
                  >
                    Sí, cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
