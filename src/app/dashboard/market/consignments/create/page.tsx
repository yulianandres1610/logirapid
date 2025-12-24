'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Store,
  Package,
  Calendar,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  Plus,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  TrendingUp,
  Send
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'market' | 'products' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'market', title: 'Mercado', description: 'Seleccionar receptor', icon: Store },
  { id: 'products', title: 'Productos', description: 'Agregar con precios', icon: Package },
  { id: 'review', title: 'Revisar', description: 'Confirmar envío', icon: Check }
]

interface Market {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  logoUrl: string | null
  totalConsignments: number
  pendingBalance: number
}

interface Warehouse {
  id: number
  name: string
  address: string | null
}

interface Product {
  id: number
  name: string
  sku: string
  barcode: string | null
  imageUrl: string | null
  costPrice: number
  sellingPrice: number
  quantityOnHand: number
}

interface ConsignmentLine {
  productId: number
  product: Product
  quantity: number
  providerCost: number
  providerPrice: number
  suggestedRetailPrice: number
  subtotal: number
}

export default function CreateConsignmentPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('market')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Step 1: Market
  const [marketSearch, setMarketSearch] = useState('')
  const [marketResults, setMarketResults] = useState<Market[]>([])
  const [searchingMarket, setSearchingMarket] = useState(false)
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)

  // Warehouses
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)

  // Step 2: Products
  const [consignmentLines, setConsignmentLines] = useState<ConsignmentLine[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [searchingProducts, setSearchingProducts] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)

  // Step 3: Review
  const [scheduledDate, setScheduledDate] = useState('')
  const [notes, setNotes] = useState('')

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Load warehouses on mount
  useEffect(() => {
    const loadWarehouses = async () => {
      setLoadingWarehouses(true)
      try {
        const response = await fetch('/api/market/warehouses')
        const data = await response.json()
        if (data.success && data.data?.warehouses) {
          const warehouseList = data.data.warehouses.map((w: { id: number; name: string; address: string | null }) => ({
            id: w.id,
            name: w.name,
            address: w.address
          }))
          setWarehouses(warehouseList)
          if (warehouseList.length > 0) {
            setSelectedWarehouse(warehouseList[0])
          }
        }
      } catch (error) {
        console.error('Error loading warehouses:', error)
      } finally {
        setLoadingWarehouses(false)
      }
    }
    loadWarehouses()
  }, [])

  // Search markets with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (marketSearch.length >= 2) {
        setSearchingMarket(true)
        try {
          const response = await fetch(`/api/consignments/partners/search?q=${encodeURIComponent(marketSearch)}&limit=10`)
          const data = await response.json()
          if (data.success) {
            setMarketResults(data.data.markets || [])
          }
        } catch (error) {
          console.error('Error searching markets:', error)
        } finally {
          setSearchingMarket(false)
        }
      } else {
        setMarketResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [marketSearch])

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProductResults([])
      return
    }
    setSearchingProducts(true)
    try {
      const warehouseParam = selectedWarehouse ? `&warehouseId=${selectedWarehouse.id}` : ''
      const response = await fetch(`/api/market/products?search=${encodeURIComponent(query)}&limit=20${warehouseParam}`)
      const data = await response.json()
      if (data.success) {
        setProductResults(data.data.products || [])
      }
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setSearchingProducts(false)
    }
  }, [selectedWarehouse])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch) {
        searchProducts(productSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, searchProducts])

  // Add product to consignment
  const addProductToConsignment = (product: Product) => {
    const existing = consignmentLines.find(l => l.productId === product.id)
    if (existing) {
      setConsignmentLines(prev => prev.map(l =>
        l.productId === product.id
          ? {
              ...l,
              quantity: l.quantity + 1,
              subtotal: (l.quantity + 1) * l.providerPrice
            }
          : l
      ))
    } else {
      // Default provider price = selling price (what we sell to them)
      // Suggested retail = selling price * 1.3 (30% margin for them)
      const providerPrice = product.sellingPrice
      const suggestedRetailPrice = Math.round(providerPrice * 1.3 * 100) / 100

      setConsignmentLines(prev => [...prev, {
        productId: product.id,
        product,
        quantity: 1,
        providerCost: product.costPrice,
        providerPrice: providerPrice,
        suggestedRetailPrice: suggestedRetailPrice,
        subtotal: providerPrice
      }])
    }
    setProductSearch('')
    setProductResults([])
    setShowProductModal(false)
  }

  // Update line quantity
  const updateLineQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return
    setConsignmentLines(prev => prev.map(l =>
      l.productId === productId
        ? { ...l, quantity, subtotal: quantity * l.providerPrice }
        : l
    ))
  }

  // Update line price
  const updateLinePrice = (productId: number, field: 'providerPrice' | 'suggestedRetailPrice', value: number) => {
    if (value < 0) return
    setConsignmentLines(prev => prev.map(l => {
      if (l.productId !== productId) return l
      const updated = { ...l, [field]: value }
      if (field === 'providerPrice') {
        updated.subtotal = l.quantity * value
      }
      return updated
    }))
  }

  // Remove line
  const removeLine = (productId: number) => {
    setConsignmentLines(prev => prev.filter(l => l.productId !== productId))
  }

  // Calculate totals
  const subtotal = consignmentLines.reduce((sum, l) => sum + l.subtotal, 0)
  const totalUnits = consignmentLines.reduce((sum, l) => sum + l.quantity, 0)

  // Calculate margin
  const calculateMargin = (cost: number, price: number): string => {
    if (cost <= 0) return '0.0'
    return ((price - cost) / cost * 100).toFixed(1)
  }

  // Validate step
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}
    switch (step) {
      case 'market':
        if (!selectedMarket) newErrors.market = 'Selecciona un mercado receptor'
        if (!selectedWarehouse) newErrors.warehouse = 'Selecciona un almacén de origen'
        break
      case 'products':
        if (consignmentLines.length === 0) newErrors.products = 'Agrega al menos un producto'
        break
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Navigate steps
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

  // Submit consignment
  const handleSubmit = async (submitForApproval: boolean) => {
    if (!validateStep('products')) return
    setLoading(true)
    try {
      const response = await fetch('/api/consignments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverCompanyId: selectedMarket!.id,
          providerWarehouseId: selectedWarehouse!.id,
          scheduledDeliveryDate: scheduledDate || null,
          providerNotes: notes || null,
          submitForApproval,
          items: consignmentLines.map(l => ({
            productId: l.productId,
            quantity: l.quantity,
            providerCost: l.providerCost,
            providerPrice: l.providerPrice,
            suggestedRetailPrice: l.suggestedRetailPrice
          }))
        })
      })
      const data = await response.json()
      if (data.success) {
        router.push('/dashboard/market/consignments')
      } else {
        setErrors({ submit: data.error || 'Error al crear la consignación' })
      }
    } catch (error) {
      console.error('Error creating consignment:', error)
      setErrors({ submit: 'Error al crear la consignación' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']}>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
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
                href="/dashboard/market/consignments"
                className={cn(
                  "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a consignaciones
              </Link>
              <h1 className={cn(
                "text-2xl sm:text-3xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Nueva Consignación
              </h1>
            </div>

            {/* Progress Indicator */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div className="relative w-14 h-14">
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
                                ? 'rgba(139, 92, 246, 0.5)'
                                : 'rgba(124, 58, 237, 0.5)'
                            }}
                          />
                        )}

                        <motion.div
                          initial={false}
                          animate={{
                            scale: currentStep === step.id ? 1.1 : 1,
                            backgroundColor: currentStep === step.id
                              ? theme === 'dark' ? '#8B5CF6' : '#7C3AED'
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
                                ? 'shadow-lg shadow-purple-500/50'
                                : 'shadow-lg shadow-purple-400/50'
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
                            ? theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
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
                "rounded-2xl border p-6 sm:p-8 shadow-lg",
                theme === 'dark'
                  ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
                  : 'bg-white border-gray-200 backdrop-blur-sm'
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                {/* Step 1: Market */}
                {currentStep === 'market' && (
                  <motion.div
                    key="market"
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <Store className="w-5 h-5 text-white" />
                      </div>
                      Seleccionar Mercado Receptor
                    </h2>

                    {/* Warehouse Selector */}
                    <div>
                      <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Almacén de Origen
                      </label>
                      {loadingWarehouses ? (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Cargando almacenes...
                        </div>
                      ) : (
                        <select
                          value={selectedWarehouse?.id || ''}
                          onChange={(e) => {
                            const wh = warehouses.find(w => w.id === parseInt(e.target.value))
                            setSelectedWarehouse(wh || null)
                          }}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white'
                              : 'bg-gray-50 border-gray-200 text-gray-900'
                          )}
                        >
                          {warehouses.map(wh => (
                            <option key={wh.id} value={wh.id}>{wh.name}</option>
                          ))}
                        </select>
                      )}
                      {errors.warehouse && <p className="text-red-500 text-sm mt-1">{errors.warehouse}</p>}
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Buscar Mercado por Teléfono o Nombre
                      </label>
                      <div className={cn(
                        'flex items-center gap-3 p-4 rounded-xl border-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 focus-within:border-purple-500'
                          : 'bg-gray-50 border-gray-200 focus-within:border-purple-500'
                      )}>
                        <Search className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                        <input
                          type="text"
                          placeholder="Buscar por teléfono, nombre o email..."
                          value={marketSearch}
                          onChange={(e) => setMarketSearch(e.target.value)}
                          className={cn(
                            'flex-1 bg-transparent outline-none text-lg',
                            theme === 'dark' ? 'text-white placeholder:text-gray-500' : 'text-gray-900 placeholder:text-gray-400'
                          )}
                        />
                        {searchingMarket && <Loader2 className="w-5 h-5 animate-spin text-purple-500" />}
                      </div>

                      {/* Search Results */}
                      {marketSearch.length >= 2 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'absolute z-10 w-full mt-2 rounded-xl border shadow-xl overflow-hidden',
                            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                          )}
                        >
                          {marketResults.length > 0 ? (
                            <div className="max-h-64 overflow-y-auto">
                              {marketResults.map((market) => (
                                <motion.button
                                  key={market.id}
                                  whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(249, 250, 251, 1)' }}
                                  onClick={() => { setSelectedMarket(market); setMarketSearch(''); setMarketResults([]) }}
                                  className={cn('w-full p-4 flex items-start gap-3 text-left border-b last:border-b-0', theme === 'dark' ? 'border-gray-700' : 'border-gray-100')}
                                >
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                    <Store className="w-5 h-5 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{market.name}</span>
                                      {market.totalConsignments > 0 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                                          {market.totalConsignments} consignaciones
                                        </span>
                                      )}
                                    </div>
                                    <div className={cn('flex items-center gap-4 text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                      {market.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{market.phone}</span>}
                                      {market.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{market.city}</span>}
                                    </div>
                                    {(market.pendingBalance || 0) > 0 && (
                                      <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                                        <DollarSign className="w-3 h-3" />
                                        Saldo pendiente: ${(market.pendingBalance || 0).toFixed(2)}
                                      </p>
                                    )}
                                  </div>
                                </motion.button>
                              ))}
                            </div>
                          ) : !searchingMarket && (
                            <div className="p-4 text-center">
                              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No se encontraron mercados</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {/* Selected Market Card */}
                    {selectedMarket && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          'p-6 rounded-xl border-2',
                          theme === 'dark' ? 'bg-green-900/20 border-green-500/50' : 'bg-green-50 border-green-200'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                              <Store className="w-7 h-7 text-white" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedMarket.name}</h3>
                              </div>
                              {selectedMarket.phone && <p className={cn('flex items-center gap-2 text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}><Phone className="w-4 h-4" />{selectedMarket.phone}</p>}
                              {selectedMarket.address && <p className={cn('flex items-center gap-2 text-sm mt-1', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}><MapPin className="w-4 h-4" />{selectedMarket.address}</p>}
                            </div>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setSelectedMarket(null)}
                            className={cn('px-4 py-2 rounded-lg text-sm font-medium', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-white hover:bg-gray-50 text-gray-700 shadow-sm')}
                          >
                            Cambiar
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {errors.market && <p className="text-red-500 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{errors.market}</p>}
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
                    <div className="flex items-center justify-between">
                      <h2 className={cn(
                        "text-xl font-bold flex items-center gap-3",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        Productos a Consignar
                      </h2>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowProductModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium shadow-lg"
                      >
                        <Plus className="w-5 h-5" />Agregar
                      </motion.button>
                    </div>

                    {consignmentLines.length === 0 ? (
                      <div className={cn(
                        'text-center py-16 rounded-xl border-2 border-dashed',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
                      )}>
                        <Package className={cn('w-16 h-16 mx-auto mb-4', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                        <p className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>No hay productos agregados</p>
                        <p className={cn('text-sm mb-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>Haz clic en &quot;Agregar&quot; para comenzar</p>
                      </div>
                    ) : (
                      <div className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className={cn(theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50')}>
                              <tr>
                                <th className={cn('px-4 py-3 text-left text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Producto</th>
                                <th className={cn('px-4 py-3 text-center text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Cant.</th>
                                <th className={cn('px-4 py-3 text-center text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Mi Costo</th>
                                <th className={cn('px-4 py-3 text-center text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>P. Venta</th>
                                <th className={cn('px-4 py-3 text-center text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Mi Margen</th>
                                <th className={cn('px-4 py-3 text-center text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>P. Sugerido</th>
                                <th className={cn('px-4 py-3 text-right text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Subtotal</th>
                                <th className="px-4 py-3 w-12"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {consignmentLines.map((line, index) => (
                                <motion.tr
                                  key={line.productId}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: index * 0.05 }}
                                  className={cn('border-t', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}
                                >
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                      {line.product.imageUrl ? (
                                        <img src={line.product.imageUrl} alt={line.product.name} className="w-10 h-10 rounded-lg object-cover" />
                                      ) : (
                                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                          <Package className="w-5 h-5 text-gray-400" />
                                        </div>
                                      )}
                                      <div>
                                        <p className={cn('font-medium text-sm', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{line.product.name}</p>
                                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>SKU: {line.product.sku}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => updateLineQuantity(line.productId, line.quantity - 1)}
                                        className={cn('w-6 h-6 rounded flex items-center justify-center text-xs', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
                                      >-</button>
                                      <input
                                        type="number"
                                        value={line.quantity}
                                        onChange={(e) => updateLineQuantity(line.productId, parseInt(e.target.value) || 1)}
                                        className={cn('w-12 text-center rounded py-1 border text-sm', theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-200')}
                                      />
                                      <button
                                        onClick={() => updateLineQuantity(line.productId, line.quantity + 1)}
                                        className={cn('w-6 h-6 rounded flex items-center justify-center text-xs', theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
                                      >+</button>
                                    </div>
                                  </td>
                                  <td className={cn('px-4 py-4 text-center text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                    ${line.providerCost.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center justify-center">
                                      <span className={cn('text-sm mr-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={line.providerPrice}
                                        onChange={(e) => updateLinePrice(line.productId, 'providerPrice', parseFloat(e.target.value) || 0)}
                                        className={cn('w-16 text-center rounded py-1 border text-sm', theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-200')}
                                      />
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={cn(
                                      'text-sm font-medium flex items-center justify-center gap-1',
                                      parseFloat(calculateMargin(line.providerCost, line.providerPrice)) >= 20
                                        ? 'text-green-500'
                                        : parseFloat(calculateMargin(line.providerCost, line.providerPrice)) >= 10
                                          ? 'text-amber-500'
                                          : 'text-red-500'
                                    )}>
                                      <TrendingUp className="w-3 h-3" />
                                      {calculateMargin(line.providerCost, line.providerPrice)}%
                                    </span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center justify-center">
                                      <span className={cn('text-sm mr-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={line.suggestedRetailPrice}
                                        onChange={(e) => updateLinePrice(line.productId, 'suggestedRetailPrice', parseFloat(e.target.value) || 0)}
                                        className={cn('w-16 text-center rounded py-1 border text-sm', theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-900 border-gray-200')}
                                      />
                                    </div>
                                  </td>
                                  <td className={cn('px-4 py-4 text-right font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                    ${line.subtotal.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-4">
                                    <button onClick={() => removeLine(line.productId)} className="p-2 rounded-lg text-red-500 hover:bg-red-500/10">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className={cn('p-4 border-t', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                          <div className="flex justify-end">
                            <div className="w-64 space-y-2">
                              <div className="flex justify-between">
                                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Productos:</span>
                                <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{consignmentLines.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Unidades:</span>
                                <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{totalUnits}</span>
                              </div>
                              <div className={cn('flex justify-between pt-2 border-t font-bold text-lg', theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-900')}>
                                <span>Total:</span>
                                <span>${subtotal.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {errors.products && <p className="text-red-500 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{errors.products}</p>}
                  </motion.div>
                )}

                {/* Step 3: Review */}
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
                      Resumen de la Consignación
                    </h2>

                    {/* Market & Warehouse Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={cn('p-5 rounded-xl border', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                        <h3 className={cn('font-medium mb-3 flex items-center gap-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          <Store className="w-4 h-4" />Mercado Receptor
                        </h3>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                            <Store className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedMarket?.name}</p>
                            {selectedMarket?.phone && (
                              <p className={cn('text-sm flex items-center gap-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                <Phone className="w-3 h-3" />{selectedMarket.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={cn('p-5 rounded-xl border', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                        <h3 className={cn('font-medium mb-3 flex items-center gap-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          <MapPin className="w-4 h-4" />Almacén de Origen
                        </h3>
                        <p className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{selectedWarehouse?.name}</p>
                        {selectedWarehouse?.address && (
                          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>{selectedWarehouse.address}</p>
                        )}
                      </div>
                    </div>

                    {/* Delivery Date */}
                    <div>
                      <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        <Calendar className="w-4 h-4 inline mr-1" />Fecha de Entrega Programada (opcional)
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className={cn('w-full px-4 py-3 rounded-xl border', theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className={cn('block text-sm font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        <FileText className="w-4 h-4 inline mr-1" />Notas para el Receptor (opcional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Instrucciones especiales, condiciones, etc..."
                        rows={3}
                        className={cn('w-full px-4 py-3 rounded-xl border resize-none', theme === 'dark' ? 'bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400')}
                      />
                    </div>

                    {/* Products Summary */}
                    <div className={cn('rounded-xl border overflow-hidden', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                      <div className={cn('px-5 py-3 border-b', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                        <h3 className={cn('font-medium flex items-center gap-2', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          <Package className="w-4 h-4" />Productos ({consignmentLines.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
                        {consignmentLines.map((line) => (
                          <div key={line.productId} className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {line.product.imageUrl ? (
                                <img src={line.product.imageUrl} alt={line.product.name} className="w-10 h-10 rounded-lg object-cover" />
                              ) : (
                                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{line.product.name}</p>
                                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                  x{line.quantity} @ ${line.providerPrice.toFixed(2)}
                                </p>
                              </div>
                            </div>
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              ${line.subtotal.toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className={cn('p-4 border-t', theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                        <div className="flex justify-end">
                          <div className="w-64 space-y-2">
                            <div className="flex justify-between">
                              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Total productos:</span>
                              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{consignmentLines.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Total unidades:</span>
                              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>{totalUnits}</span>
                            </div>
                            <div className={cn('flex justify-between pt-2 border-t font-bold text-lg', theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-gray-900')}>
                              <span>Total:</span>
                              <span className="text-green-500">${subtotal.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {errors.submit && (
                      <div className={cn('p-4 rounded-xl flex items-center gap-3', 'bg-red-500/10 border border-red-500/30')}>
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <p className="text-red-500">{errors.submit}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goToPrevStep}
                disabled={currentStepIndex === 0}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white shadow-lg'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900 shadow-md'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </motion.button>

              {currentStep === 'review' ? (
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSubmit(false)}
                    disabled={loading}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    )}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Guardar Borrador</>
                    )}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSubmit(true)}
                    disabled={loading}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/30'
                        : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-lg shadow-purple-400/30',
                      'text-white'
                    )}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <><Send className="w-5 h-5" />Enviar para Aprobación</>
                    )}
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToNextStep}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    theme === 'dark'
                      ? 'bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/30'
                      : 'bg-purple-500 hover:bg-purple-600 shadow-lg shadow-purple-400/30',
                    'text-white'
                  )}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Product Search Modal */}
          <AnimatePresence>
            {showProductModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={() => setShowProductModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn('w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}
                >
                  <div className={cn('p-4 border-b flex items-center justify-between', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                    <h3 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>Buscar Producto</h3>
                    <button onClick={() => setShowProductModal(false)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-4">
                    <div className={cn('flex items-center gap-3 p-3 rounded-lg border', theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-200')}>
                      <Search className="w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, SKU o código de barras..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        autoFocus
                        className={cn('flex-1 bg-transparent outline-none', theme === 'dark' ? 'text-white' : 'text-gray-900')}
                      />
                      {searchingProducts && <Loader2 className="w-5 h-5 animate-spin text-purple-500" />}
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {productResults.length > 0 ? (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {productResults.map((product) => (
                          <motion.button
                            key={product.id}
                            whileHover={{ backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.5)' : 'rgba(249, 250, 251, 1)' }}
                            onClick={() => addProductToConsignment(product)}
                            className="w-full p-4 flex items-center gap-4 text-left"
                          >
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-14 h-14 rounded-lg object-cover" />
                            ) : (
                              <div className={cn('w-14 h-14 rounded-lg flex items-center justify-center', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200')}>
                                <Package className="w-7 h-7 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{product.name}</p>
                              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                SKU: {product.sku}{product.barcode && ` • ${product.barcode}`}
                              </p>
                              <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                Stock: {product.quantityOnHand} unidades
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={cn('font-bold text-lg', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                ${(product.sellingPrice || 0).toFixed(2)}
                              </p>
                              <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Precio venta</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    ) : productSearch.length >= 2 && !searchingProducts ? (
                      <div className="p-8 text-center">
                        <Package className={cn('w-12 h-12 mx-auto mb-3', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>No se encontraron productos</p>
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <Search className={cn('w-12 h-12 mx-auto mb-3', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Escribe para buscar productos</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cancel Modal */}
          <AnimatePresence>
            {showCancelModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowCancelModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-md rounded-2xl shadow-2xl border",
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6 pb-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                          theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                        )}>
                          <X className={cn(
                            "w-6 h-6",
                            theme === 'dark' ? 'text-red-400' : 'text-red-600'
                          )} />
                        </div>
                        <div className="flex-1">
                          <h3 className={cn(
                            "text-xl font-bold mb-2",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            ¿Cancelar consignación?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Los datos ingresados se perderán y no podrás recuperarlos.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      "flex gap-3 p-6 pt-4 border-t",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCancelModal(false)}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        )}
                      >
                        Continuar editando
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/dashboard/market/consignments')}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500 hover:bg-red-600'
                        )}
                      >
                        Sí, cancelar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
