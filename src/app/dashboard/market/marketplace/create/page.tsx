'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Warehouse,
  DollarSign,
  FileText,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  Loader2,
  X,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Store,
  ImageIcon,
  Sparkles,
  Wand2,
  Edit3
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'product' | 'warehouse' | 'pricing' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'product', title: 'Producto', description: 'Seleccionar', icon: Package },
  { id: 'warehouse', title: 'Almacen', description: 'Origen', icon: Warehouse },
  { id: 'pricing', title: 'Precio', description: 'Configurar', icon: DollarSign },
  { id: 'review', title: 'Confirmar', description: 'Publicar', icon: Check }
]

interface Product {
  id: number
  name: string
  sku: string
  barcode: string | null
  imageUrl: string | null
  category: string | null
  costPrice: number
  sellingPrice: number
  currency: string
}

interface WarehouseInfo {
  id: number
  code: string
  name: string
  stockOnHand?: number
  stockReserved?: number
  stockAvailable?: number
}

interface PriceCheck {
  averagePrice: number
  minPrice: number
  maxPrice: number
  competitorCount: number
  percentDifference: number
  pricePosition: 'low' | 'average' | 'high'
  alertType: 'none' | 'below_cost' | 'no_margin' | 'low_margin' | 'high_difference' | 'above_market'
  alertMessage: string | null
  suggestedRange: {
    min: number
    max: number
    optimal: number
  }
  margins: {
    proposedMargin: number
    baseMargin: number
    minRecommendedMargin: number
  }
  product: {
    costPrice: number
    sellingPrice: number
  }
}

interface CreatedListing {
  id: number
  listingCode: string
  status: string
  priceAlertTriggered: boolean
  priceAlertReason: string | null
}

export default function CreateMarketplaceListingPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('product')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Step 1: Product
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  // Step 2: Warehouse
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([])
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseInfo | null>(null)
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)

  // Step 3: Pricing
  const [priceMarketplace, setPriceMarketplace] = useState<string>('')
  const [quantityListed, setQuantityListed] = useState<string>('')
  const [marketplaceTitle, setMarketplaceTitle] = useState('')
  const [marketplaceDescription, setMarketplaceDescription] = useState('')
  const [priceCheck, setPriceCheck] = useState<PriceCheck | null>(null)
  const [loadingPriceCheck, setLoadingPriceCheck] = useState(false)
  const [showPriceConfirmation, setShowPriceConfirmation] = useState(false)

  // AI Suggestion states
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{
    title: string
    description: string
  } | null>(null)
  const [showAiSuggestion, setShowAiSuggestion] = useState(false)

  // Step 4: Confirmation
  const [createdListing, setCreatedListing] = useState<CreatedListing | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProducts([])
      return
    }
    setLoadingProducts(true)
    try {
      const response = await fetch(`/api/market/products?search=${encodeURIComponent(query)}&limit=20`)
      const data = await response.json()
      if (data.success) {
        setProducts(data.data.products || [])
      }
    } catch (error) {
      console.error('Error searching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (productSearch) searchProducts(productSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [productSearch, searchProducts])

  // Load warehouses with stock when product is selected
  useEffect(() => {
    if (selectedProduct) {
      const fetchWarehouses = async () => {
        setLoadingWarehouses(true)
        try {
          const response = await fetch(`/api/market/warehouses?productId=${selectedProduct.id}`)
          const data = await response.json()
          if (data.success) {
            setWarehouses(data.data.warehouses || data.data || [])
          }
        } catch (error) {
          console.error('Error loading warehouses:', error)
        } finally {
          setLoadingWarehouses(false)
        }
      }
      fetchWarehouses()
      // Set default price
      setPriceMarketplace(selectedProduct.sellingPrice.toString())
    }
  }, [selectedProduct])

  // Check price when it changes
  useEffect(() => {
    if (selectedProduct && priceMarketplace) {
      const price = parseFloat(priceMarketplace)
      if (isNaN(price) || price <= 0) return

      const checkPrice = async () => {
        setLoadingPriceCheck(true)
        try {
          const response = await fetch(
            `/api/market/marketplace/price-check?productId=${selectedProduct.id}&proposedPrice=${price}`
          )
          const data = await response.json()
          if (data.success) {
            setPriceCheck(data.data)
          }
        } catch (error) {
          console.error('Error checking price:', error)
        } finally {
          setLoadingPriceCheck(false)
        }
      }

      const timer = setTimeout(checkPrice, 500)
      return () => clearTimeout(timer)
    }
  }, [selectedProduct, priceMarketplace])

  // AI Suggestion function
  const fetchAiSuggestion = async () => {
    if (!selectedProduct?.name || selectedProduct.name.trim().length < 2) {
      return
    }

    setAiLoading(true)
    setShowAiSuggestion(false)

    try {
      const response = await fetch('/api/ai/marketplace-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: selectedProduct.name.trim(),
          category: selectedProduct.category,
          currentPrice: priceMarketplace || selectedProduct.sellingPrice
        })
      })

      const data = await response.json()

      if (data.success && data.data) {
        setAiSuggestion({
          title: data.data.title,
          description: data.data.description
        })
        setShowAiSuggestion(true)
      } else {
        console.error('AI Suggestion error:', data.error)
      }
    } catch (error) {
      console.error('AI Suggestion fetch error:', error)
    } finally {
      setAiLoading(false)
    }
  }

  // Apply AI suggestions
  const applyAiTitle = () => {
    if (aiSuggestion?.title) {
      setMarketplaceTitle(aiSuggestion.title)
    }
  }

  const applyAiDescription = () => {
    if (aiSuggestion?.description) {
      setMarketplaceDescription(aiSuggestion.description)
    }
  }

  const applyAllAiSuggestions = () => {
    if (aiSuggestion) {
      setMarketplaceTitle(aiSuggestion.title || marketplaceTitle)
      setMarketplaceDescription(aiSuggestion.description || marketplaceDescription)
    }
  }

  // Validate step
  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}
    switch (step) {
      case 'product':
        if (!selectedProduct) newErrors.product = 'Selecciona un producto'
        break
      case 'warehouse':
        if (!selectedWarehouse) newErrors.warehouse = 'Selecciona un almacen'
        if (selectedWarehouse && (selectedWarehouse.stockAvailable || 0) <= 0) {
          newErrors.warehouse = 'No hay stock disponible en este almacen'
        }
        break
      case 'pricing':
        const price = parseFloat(priceMarketplace)
        const qty = parseInt(quantityListed)
        if (!priceMarketplace || isNaN(price) || price <= 0) {
          newErrors.price = 'Ingresa un precio valido'
        }
        if (!quantityListed || isNaN(qty) || qty <= 0) {
          newErrors.quantity = 'Ingresa una cantidad valida'
        }
        if (selectedWarehouse && qty > (selectedWarehouse.stockAvailable || 0)) {
          newErrors.quantity = `Stock insuficiente. Disponible: ${selectedWarehouse.stockAvailable}`
        }
        break
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Navigate steps
  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      // Check if price alert should show confirmation
      if (currentStep === 'pricing' && priceCheck?.alertType !== 'none') {
        setShowPriceConfirmation(true)
        return
      }
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id)
  }

  const confirmPriceAndContinue = () => {
    setShowPriceConfirmation(false)
    setCurrentStep('review')
  }

  // Submit listing
  const handleSubmitListing = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/market/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct?.id,
          warehouseId: selectedWarehouse?.id,
          priceMarketplace: parseFloat(priceMarketplace),
          quantityListed: parseInt(quantityListed),
          marketplaceTitle: marketplaceTitle || null,
          marketplaceDescription: marketplaceDescription || null
        })
      })

      const data = await response.json()
      if (data.success) {
        setCreatedListing(data.data)
      } else {
        setErrors({ submit: data.error || 'Error al crear publicacion' })
      }
    } catch (error) {
      console.error('Error:', error)
      setErrors({ submit: 'Error de conexion' })
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const getPricePositionInfo = (position: string) => {
    switch (position) {
      case 'low':
        return { icon: TrendingDown, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Precio competitivo' }
      case 'high':
        return { icon: TrendingUp, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Precio alto' }
      default:
        return { icon: Minus, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Precio promedio' }
    }
  }

  return (
    
      
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

            {/* Progress Indicator */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div className="relative w-14 h-14">
                        {/* Pulsing ring for active step */}
                        {currentStep === step.id && !createdListing && (
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
                                ? 'rgba(16, 185, 129, 0.5)'
                                : 'rgba(5, 150, 105, 0.5)'
                            }}
                          />
                        )}

                        <motion.div
                          initial={false}
                          animate={{
                            scale: currentStep === step.id ? 1.1 : 1,
                            backgroundColor: currentStep === step.id
                              ? theme === 'dark' ? '#10B981' : '#059669'
                              : currentStepIndex > index || createdListing
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
                                ? 'shadow-lg shadow-emerald-500/50'
                                : 'shadow-lg shadow-emerald-400/50'
                            ),
                            (currentStepIndex > index || createdListing) && (
                              theme === 'dark'
                                ? 'shadow-md shadow-emerald-500/30'
                                : 'shadow-md shadow-emerald-400/30'
                            )
                          )}
                        >
                          {currentStepIndex > index || createdListing ? (
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
                            ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                            : currentStepIndex > index || createdListing
                              ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
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
                            scaleX: currentStepIndex > index || createdListing ? 1 : 0
                          }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          className={cn(
                            "h-full origin-left rounded-full",
                            theme === 'dark' ? 'bg-emerald-500' : 'bg-emerald-600'
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
                {/* Step 1: Product */}
                {currentStep === 'product' && !createdListing && (
                  <motion.div
                    key="product"
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      Seleccionar Producto
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Busca y selecciona el producto que deseas publicar en el marketplace.
                    </p>

                    {/* Product Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Buscar por nombre, SKU o codigo de barras..."
                        autoFocus
                        className={cn(
                          'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          theme === 'dark'
                            ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                        )}
                      />
                    </div>

                    {/* Search Results */}
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                      </div>
                    ) : products.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                        {products.map(product => (
                          <motion.button
                            key={product.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setSelectedProduct(product)
                              setProductSearch('')
                              setProducts([])
                            }}
                            className={cn(
                              'p-4 rounded-xl border text-left transition-all',
                              selectedProduct?.id === product.id
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                : theme === 'dark'
                                  ? 'border-gray-700 hover:border-gray-600'
                                  : 'border-gray-200 hover:border-gray-300'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.name}
                                  className="w-12 h-12 rounded-lg object-cover"
                                />
                              ) : (
                                <div className={cn(
                                  'w-12 h-12 rounded-lg flex items-center justify-center',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                )}>
                                  <ImageIcon className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                                <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                                <p className="text-sm font-semibold text-emerald-600">{formatCurrency(product.sellingPrice)}</p>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    ) : productSearch.length >= 2 ? (
                      <div className={cn(
                        'text-center py-12 rounded-xl border-2 border-dashed',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>No se encontraron productos</p>
                      </div>
                    ) : null}

                    {/* Selected Product */}
                    {selectedProduct && (
                      <div className={cn(
                        'p-4 rounded-xl border-2 border-emerald-500',
                        theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
                      )}>
                        <div className="flex items-center gap-4">
                          {selectedProduct.imageUrl ? (
                            <img
                              src={selectedProduct.imageUrl}
                              alt={selectedProduct.name}
                              className="w-16 h-16 rounded-xl object-cover"
                            />
                          ) : (
                            <div className={cn(
                              'w-16 h-16 rounded-xl flex items-center justify-center',
                              theme === 'dark' ? 'bg-gray-700' : 'bg-white'
                            )}>
                              <Package className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 dark:text-white">{selectedProduct.name}</p>
                            <div className="flex gap-4 mt-1">
                              <p className="text-xs text-gray-500">SKU: {selectedProduct.sku}</p>
                              {selectedProduct.category && (
                                <p className="text-xs text-gray-500">Categoria: {selectedProduct.category}</p>
                              )}
                            </div>
                            <div className="flex gap-4 mt-2">
                              <span className="text-sm">
                                <span className="text-gray-500">Costo:</span>{' '}
                                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(selectedProduct.costPrice)}</span>
                              </span>
                              <span className="text-sm">
                                <span className="text-gray-500">Venta:</span>{' '}
                                <span className="font-medium text-emerald-600">{formatCurrency(selectedProduct.sellingPrice)}</span>
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedProduct(null)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}

                    {errors.product && (
                      <p className="text-sm text-red-500">{errors.product}</p>
                    )}
                  </motion.div>
                )}

                {/* Step 2: Warehouse */}
                {currentStep === 'warehouse' && !createdListing && (
                  <motion.div
                    key="warehouse"
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
                        <Warehouse className="w-5 h-5 text-white" />
                      </div>
                      Seleccionar Almacen
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Selecciona el almacen de donde se tomara el inventario para esta publicacion.
                    </p>

                    {/* Selected Product Summary */}
                    {selectedProduct && (
                      <div className={cn(
                        'p-3 rounded-xl flex items-center gap-3',
                        theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-100'
                      )}>
                        <Package className="w-5 h-5 text-emerald-500" />
                        <span className="font-medium text-gray-900 dark:text-white">{selectedProduct.name}</span>
                        <span className="text-sm text-gray-500">SKU: {selectedProduct.sku}</span>
                      </div>
                    )}

                    {/* Warehouse Selection */}
                    {loadingWarehouses ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {warehouses.map(warehouse => {
                          const available = (warehouse.stockOnHand || 0) - (warehouse.stockReserved || 0)
                          const hasStock = available > 0

                          return (
                            <motion.button
                              key={warehouse.id}
                              whileHover={{ scale: hasStock ? 1.02 : 1 }}
                              whileTap={{ scale: hasStock ? 0.98 : 1 }}
                              onClick={() => hasStock && setSelectedWarehouse({
                                ...warehouse,
                                stockAvailable: available
                              })}
                              disabled={!hasStock}
                              className={cn(
                                'p-4 rounded-xl border text-left transition-all',
                                !hasStock && 'opacity-50 cursor-not-allowed',
                                selectedWarehouse?.id === warehouse.id
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                  : theme === 'dark'
                                    ? 'border-gray-700 hover:border-gray-600'
                                    : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <div className="flex items-center gap-3 mb-3">
                                <Warehouse className={cn(
                                  'w-5 h-5',
                                  selectedWarehouse?.id === warehouse.id ? 'text-emerald-500' : 'text-gray-400'
                                )} />
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">{warehouse.name}</p>
                                  <p className="text-xs text-gray-500">{warehouse.code}</p>
                                </div>
                              </div>

                              <div className={cn(
                                'grid grid-cols-3 gap-2 p-2 rounded-lg',
                                theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                              )}>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-gray-900 dark:text-white">{warehouse.stockOnHand || 0}</p>
                                  <p className="text-xs text-gray-500">En mano</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-amber-500">{warehouse.stockReserved || 0}</p>
                                  <p className="text-xs text-gray-500">Reservado</p>
                                </div>
                                <div className="text-center">
                                  <p className={cn(
                                    "text-lg font-bold",
                                    hasStock ? 'text-emerald-500' : 'text-red-500'
                                  )}>{available}</p>
                                  <p className="text-xs text-gray-500">Disponible</p>
                                </div>
                              </div>

                              {!hasStock && (
                                <p className="text-xs text-red-500 mt-2 text-center">Sin stock disponible</p>
                              )}
                            </motion.button>
                          )
                        })}

                        {warehouses.length === 0 && (
                          <div className="col-span-2 text-center py-8">
                            <Warehouse className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-gray-500">No hay almacenes disponibles</p>
                          </div>
                        )}
                      </div>
                    )}

                    {errors.warehouse && (
                      <p className="text-sm text-red-500">{errors.warehouse}</p>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Pricing */}
                {currentStep === 'pricing' && !createdListing && (
                  <motion.div
                    key="pricing"
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
                        <DollarSign className="w-5 h-5 text-white" />
                      </div>
                      Configurar Precio y Cantidad
                    </h2>

                    {/* Product & Warehouse Summary */}
                    <div className={cn(
                      'p-4 rounded-xl grid grid-cols-2 gap-4',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-100'
                    )}>
                      <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-xs text-gray-500">Producto</p>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedProduct?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Warehouse className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-xs text-gray-500">Almacen</p>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedWarehouse?.name}</p>
                          <p className="text-xs text-emerald-500">{selectedWarehouse?.stockAvailable} disponibles</p>
                        </div>
                      </div>
                    </div>

                    {/* Price Input */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Precio Marketplace *
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="number"
                            value={priceMarketplace}
                            onChange={(e) => setPriceMarketplace(e.target.value)}
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className={cn(
                              'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all text-lg font-semibold',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                            )}
                          />
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>Costo: {formatCurrency(selectedProduct?.costPrice || 0)}</span>
                          <span>Venta base: {formatCurrency(selectedProduct?.sellingPrice || 0)}</span>
                        </div>
                        {errors.price && (
                          <p className="text-sm text-red-500 mt-1">{errors.price}</p>
                        )}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Cantidad a Publicar *
                        </label>
                        <div className="relative">
                          <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="number"
                            value={quantityListed}
                            onChange={(e) => {
                              const val = e.target.value
                              const num = parseInt(val)
                              const maxStock = selectedWarehouse?.stockAvailable || 0
                              // Allow empty input or valid numbers within range
                              if (val === '' || (num >= 0 && num <= maxStock)) {
                                setQuantityListed(val)
                                if (errors.quantity) {
                                  setErrors(prev => ({ ...prev, quantity: '' }))
                                }
                              } else if (num > maxStock) {
                                setQuantityListed(maxStock.toString())
                                setErrors(prev => ({ ...prev, quantity: `Maximo disponible: ${maxStock} unidades` }))
                              }
                            }}
                            min="1"
                            max={selectedWarehouse?.stockAvailable || 0}
                            placeholder="0"
                            className={cn(
                              'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all text-lg font-semibold',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20',
                              (selectedWarehouse?.stockAvailable || 0) <= 0 && 'opacity-50 cursor-not-allowed'
                            )}
                            disabled={(selectedWarehouse?.stockAvailable || 0) <= 0}
                          />
                        </div>
                        <p className={cn(
                          "text-xs mt-2",
                          (selectedWarehouse?.stockAvailable || 0) <= 0
                            ? 'text-red-500'
                            : 'text-gray-500'
                        )}>
                          {(selectedWarehouse?.stockAvailable || 0) <= 0
                            ? 'Sin stock disponible en este almacen'
                            : `Stock disponible: ${selectedWarehouse?.stockAvailable} unidades`}
                        </p>
                        {errors.quantity && (
                          <p className="text-sm text-red-500 mt-1">{errors.quantity}</p>
                        )}
                      </div>
                    </div>

                    {/* Price Alert Badge */}
                    {priceCheck && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'p-4 rounded-xl border',
                          priceCheck.alertType === 'below_cost' || priceCheck.alertType === 'no_margin'
                            ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                            : priceCheck.alertType === 'low_margin' || priceCheck.alertType === 'high_difference' || priceCheck.alertType === 'above_market'
                              ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800'
                              : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800'
                        )}
                      >
                        {loadingPriceCheck ? (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                          </div>
                        ) : (
                          <>
                            {/* Alert Message */}
                            <div className="flex items-center gap-3 mb-3">
                              {priceCheck.alertType !== 'none' ? (
                                <AlertTriangle className={cn(
                                  'w-5 h-5 flex-shrink-0',
                                  priceCheck.alertType === 'below_cost' || priceCheck.alertType === 'no_margin'
                                    ? 'text-red-500'
                                    : 'text-amber-500'
                                )} />
                              ) : (
                                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                              )}
                              <span className={cn(
                                'font-medium text-sm',
                                priceCheck.alertType === 'below_cost' || priceCheck.alertType === 'no_margin'
                                  ? 'text-red-700 dark:text-red-400'
                                  : priceCheck.alertType === 'low_margin' || priceCheck.alertType === 'high_difference' || priceCheck.alertType === 'above_market'
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-emerald-700 dark:text-emerald-400'
                              )}>
                                {priceCheck.alertMessage || 'Precio competitivo'}
                              </span>
                            </div>

                            {/* Margin Info */}
                            {priceCheck.margins && (
                              <div className={cn(
                                'grid grid-cols-3 gap-2 p-3 rounded-lg mb-3',
                                theme === 'dark' ? 'bg-gray-800/50' : 'bg-white/80'
                              )}>
                                <div className="text-center">
                                  <p className={cn(
                                    "text-lg font-bold",
                                    priceCheck.margins.proposedMargin < 0
                                      ? 'text-red-500'
                                      : priceCheck.margins.proposedMargin < 15
                                        ? 'text-amber-500'
                                        : 'text-emerald-600'
                                  )}>
                                    {priceCheck.margins.proposedMargin.toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-gray-500">Tu Margen</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {priceCheck.margins.baseMargin.toFixed(1)}%
                                  </p>
                                  <p className="text-xs text-gray-500">Margen Base</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-lg font-bold text-blue-500">
                                    {priceCheck.margins.minRecommendedMargin}%
                                  </p>
                                  <p className="text-xs text-gray-500">Recomendado</p>
                                </div>
                              </div>
                            )}

                            {/* Market Comparison */}
                            {priceCheck.competitorCount > 0 && (
                              <div className="grid grid-cols-4 gap-3 text-center mb-3">
                                <div>
                                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(priceCheck.averagePrice)}
                                  </p>
                                  <p className="text-xs text-gray-500">Promedio</p>
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-emerald-600">
                                    {formatCurrency(priceCheck.minPrice)}
                                  </p>
                                  <p className="text-xs text-gray-500">Minimo</p>
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-red-500">
                                    {formatCurrency(priceCheck.maxPrice)}
                                  </p>
                                  <p className="text-xs text-gray-500">Maximo</p>
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {priceCheck.competitorCount}
                                  </p>
                                  <p className="text-xs text-gray-500">Competidores</p>
                                </div>
                              </div>
                            )}

                            {/* Price Position Badge */}
                            {priceCheck.competitorCount > 0 && (
                              <div className="flex items-center justify-center gap-2 mb-3">
                                {(() => {
                                  const info = getPricePositionInfo(priceCheck.pricePosition)
                                  const Icon = info.icon
                                  return (
                                    <span className={cn(
                                      'px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1',
                                      info.bg, info.color
                                    )}>
                                      <Icon className="w-4 h-4" />
                                      {info.label}
                                      {priceCheck.percentDifference !== 0 && (
                                        <span>({priceCheck.percentDifference > 0 ? '+' : ''}{priceCheck.percentDifference.toFixed(1)}%)</span>
                                      )}
                                    </span>
                                  )
                                })()}
                              </div>
                            )}

                            {/* Suggested Optimal Price */}
                            {priceCheck.suggestedRange && priceCheck.alertType !== 'none' && (
                              <div className={cn(
                                'flex items-center justify-between p-3 rounded-lg',
                                theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                              )}>
                                <div>
                                  <p className={cn(
                                    'text-xs font-medium',
                                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                  )}>
                                    Precio Sugerido
                                  </p>
                                  <p className="text-lg font-bold text-blue-600">
                                    {formatCurrency(priceCheck.suggestedRange.optimal)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Rango: {formatCurrency(priceCheck.suggestedRange.min)} - {formatCurrency(priceCheck.suggestedRange.max)}
                                  </p>
                                </div>
                                <motion.button
                                  type="button"
                                  onClick={() => setPriceMarketplace(priceCheck.suggestedRange.optimal.toFixed(2))}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className={cn(
                                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                    theme === 'dark'
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                                  )}
                                >
                                  Aplicar
                                </motion.button>
                              </div>
                            )}
                          </>
                        )}
                      </motion.div>
                    )}

                    {/* Optional Fields with AI */}
                    <div className="space-y-4">
                      {/* Header with AI Button */}
                      <div className="flex items-center justify-between">
                        <h3 className={cn(
                          "text-sm font-medium",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Personalizar Publicacion (opcional)
                        </h3>
                        <motion.button
                          type="button"
                          onClick={fetchAiSuggestion}
                          disabled={aiLoading || !selectedProduct}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            theme === 'dark'
                              ? 'bg-violet-600 hover:bg-violet-700 text-white'
                              : 'bg-violet-500 hover:bg-violet-600 text-white'
                          )}
                        >
                          {aiLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Generando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>Generar con IA</span>
                            </>
                          )}
                        </motion.button>
                      </div>

                      {/* AI Suggestion Panel */}
                      <AnimatePresence>
                        {showAiSuggestion && aiSuggestion && (
                          <motion.div
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className={cn(
                              "p-4 rounded-xl border-2 border-dashed relative overflow-hidden",
                              theme === 'dark'
                                ? 'bg-gradient-to-br from-violet-900/20 to-purple-900/20 border-violet-500/50'
                                : 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-300'
                            )}
                          >
                            {/* Sparkle decoration */}
                            <div className="absolute top-2 right-2">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                              >
                                <Wand2 className={cn(
                                  "w-5 h-5",
                                  theme === 'dark' ? 'text-violet-400' : 'text-violet-500'
                                )} />
                              </motion.div>
                            </div>

                            <div className="flex items-center gap-2 mb-3">
                              <Sparkles className={cn(
                                "w-4 h-4",
                                theme === 'dark' ? 'text-violet-400' : 'text-violet-600'
                              )} />
                              <span className={cn(
                                "text-sm font-semibold",
                                theme === 'dark' ? 'text-violet-300' : 'text-violet-700'
                              )}>
                                Sugerencias de IA
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowAiSuggestion(false)}
                                className={cn(
                                  "ml-auto p-1 rounded-full transition-colors",
                                  theme === 'dark'
                                    ? 'hover:bg-gray-700 text-gray-400'
                                    : 'hover:bg-gray-200 text-gray-500'
                                )}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="space-y-3">
                              {/* Title suggestion */}
                              <div className={cn(
                                "flex items-center justify-between p-3 rounded-lg gap-3",
                                theme === 'dark' ? 'bg-gray-800/50' : 'bg-white/80'
                              )}>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <FileText className={cn(
                                    "w-4 h-4 flex-shrink-0",
                                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                  )} />
                                  <span className={cn(
                                    "text-sm truncate",
                                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                  )}>
                                    <strong>Titulo:</strong> {aiSuggestion.title}
                                  </span>
                                </div>
                                <motion.button
                                  type="button"
                                  onClick={applyAiTitle}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-full transition-colors flex-shrink-0",
                                    marketplaceTitle === aiSuggestion.title
                                      ? theme === 'dark'
                                        ? 'bg-green-900/50 text-green-300'
                                        : 'bg-green-100 text-green-700'
                                      : theme === 'dark'
                                        ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                        : 'bg-violet-500 hover:bg-violet-600 text-white'
                                  )}
                                >
                                  {marketplaceTitle === aiSuggestion.title ? (
                                    <span className="flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Aplicado
                                    </span>
                                  ) : (
                                    'Aplicar'
                                  )}
                                </motion.button>
                              </div>

                              {/* Description suggestion */}
                              <div className={cn(
                                "flex items-start justify-between p-3 rounded-lg gap-3",
                                theme === 'dark' ? 'bg-gray-800/50' : 'bg-white/80'
                              )}>
                                <div className="flex items-start gap-2 flex-1">
                                  <Edit3 className={cn(
                                    "w-4 h-4 mt-0.5 flex-shrink-0",
                                    theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                                  )} />
                                  <span className={cn(
                                    "text-sm",
                                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                  )}>
                                    {aiSuggestion.description}
                                  </span>
                                </div>
                                <motion.button
                                  type="button"
                                  onClick={applyAiDescription}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-full transition-colors flex-shrink-0",
                                    marketplaceDescription === aiSuggestion.description
                                      ? theme === 'dark'
                                        ? 'bg-green-900/50 text-green-300'
                                        : 'bg-green-100 text-green-700'
                                      : theme === 'dark'
                                        ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                        : 'bg-violet-500 hover:bg-violet-600 text-white'
                                  )}
                                >
                                  {marketplaceDescription === aiSuggestion.description ? (
                                    <span className="flex items-center gap-1">
                                      <Check className="w-3 h-3" /> Aplicado
                                    </span>
                                  ) : (
                                    'Aplicar'
                                  )}
                                </motion.button>
                              </div>
                            </div>

                            {/* Apply All Button */}
                            <motion.button
                              type="button"
                              onClick={applyAllAiSuggestions}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                "w-full mt-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2",
                                theme === 'dark'
                                  ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white'
                                  : 'bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white'
                              )}
                            >
                              <Sparkles className="w-4 h-4" />
                              Aplicar Todo
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Title Input */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Titulo Personalizado
                        </label>
                        <input
                          type="text"
                          value={marketplaceTitle}
                          onChange={(e) => setMarketplaceTitle(e.target.value)}
                          placeholder={selectedProduct?.name}
                          maxLength={100}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      {/* Description Input */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Descripcion
                        </label>
                        <textarea
                          value={marketplaceDescription}
                          onChange={(e) => setMarketplaceDescription(e.target.value)}
                          rows={3}
                          placeholder="Descripcion adicional para el marketplace..."
                          maxLength={500}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Review */}
                {currentStep === 'review' && !createdListing && (
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      Revisar y Publicar
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Revisa los detalles de tu publicacion antes de enviarla para aprobacion.
                    </p>

                    {/* Summary Card */}
                    <div className={cn(
                      'rounded-2xl p-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      {/* Product */}
                      <div className={cn(
                        'p-4 rounded-xl mb-4',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                      )}>
                        <div className="flex items-center gap-4">
                          {selectedProduct?.imageUrl ? (
                            <img
                              src={selectedProduct.imageUrl}
                              alt={selectedProduct.name}
                              className="w-20 h-20 rounded-xl object-cover"
                            />
                          ) : (
                            <div className={cn(
                              'w-20 h-20 rounded-xl flex items-center justify-center',
                              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                            )}>
                              <Package className="w-10 h-10 text-gray-400" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-bold text-lg text-gray-900 dark:text-white">
                              {marketplaceTitle || selectedProduct?.name}
                            </p>
                            <p className="text-sm text-gray-500">SKU: {selectedProduct?.sku}</p>
                            {selectedProduct?.category && (
                              <span className={cn(
                                'inline-block px-2 py-0.5 rounded text-xs mt-2',
                                theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                              )}>
                                {selectedProduct.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={cn(
                          'p-4 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <Warehouse className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                          <p className="text-xs text-gray-500">Almacen</p>
                          <p className="font-medium text-gray-900 dark:text-white">{selectedWarehouse?.name}</p>
                        </div>

                        <div className={cn(
                          'p-4 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <Package className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                          <p className="text-xs text-gray-500">Cantidad</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{quantityListed}</p>
                        </div>

                        <div className={cn(
                          'p-4 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <DollarSign className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                          <p className="text-xs text-gray-500">Precio</p>
                          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(parseFloat(priceMarketplace) || 0)}</p>
                        </div>

                        <div className={cn(
                          'p-4 rounded-xl text-center',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <Store className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                          <p className="text-xs text-gray-500">Valor Total</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {formatCurrency((parseFloat(priceMarketplace) || 0) * (parseInt(quantityListed) || 0))}
                          </p>
                        </div>
                      </div>

                      {/* Description */}
                      {marketplaceDescription && (
                        <div className={cn(
                          'p-4 rounded-xl mt-4',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <p className="text-xs text-gray-500 mb-1">Descripcion</p>
                          <p className="text-gray-900 dark:text-white">{marketplaceDescription}</p>
                        </div>
                      )}

                      {/* Price Comparison */}
                      {priceCheck && priceCheck.competitorCount > 0 && (
                        <div className={cn(
                          'p-4 rounded-xl mt-4 flex items-center justify-between',
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <div>
                            <p className="text-xs text-gray-500">Comparacion de precio</p>
                            <p className="text-sm text-gray-900 dark:text-white">
                              Tu precio vs promedio del marketplace ({priceCheck.competitorCount} competidores)
                            </p>
                          </div>
                          {(() => {
                            const info = getPricePositionInfo(priceCheck.pricePosition)
                            const Icon = info.icon
                            return (
                              <span className={cn(
                                'px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1',
                                info.bg, info.color
                              )}>
                                <Icon className="w-4 h-4" />
                                {info.label}
                              </span>
                            )
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Warning */}
                    <div className={cn(
                      'p-4 rounded-xl flex items-start gap-3',
                      theme === 'dark' ? 'bg-amber-900/20 border border-amber-800' : 'bg-amber-50 border border-amber-200'
                    )}>
                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className={cn(
                          'font-medium',
                          theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
                        )}>
                          Pendiente de aprobacion
                        </p>
                        <p className={cn(
                          'text-sm mt-1',
                          theme === 'dark' ? 'text-amber-400/80' : 'text-amber-600'
                        )}>
                          Tu publicacion sera revisada por un administrador antes de aparecer en el marketplace.
                          El stock sera reservado hasta que se apruebe o rechace la solicitud.
                        </p>
                      </div>
                    </div>

                    {errors.submit && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-red-600 text-sm">{errors.submit}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Confirmation */}
                {createdListing && (
                  <motion.div
                    key="confirmation"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring' }}
                      className="w-20 h-20 mx-auto mb-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center"
                    >
                      <CheckCircle className="w-10 h-10 text-emerald-600" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Publicacion Enviada
                    </h2>
                    <p className="text-gray-500 mb-6">
                      Tu solicitud ha sido enviada para revision
                    </p>

                    <div className={cn(
                      'inline-block p-6 rounded-2xl mb-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      <p className="text-sm text-gray-500 mb-1">Codigo de Publicacion</p>
                      <p className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
                        {createdListing.listingCode}
                      </p>
                      <div className="mt-4">
                        <span className={cn(
                          'px-3 py-1 rounded-full text-sm font-medium',
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}>
                          Pendiente de Aprobacion
                        </span>
                      </div>

                      {createdListing.priceAlertTriggered && createdListing.priceAlertReason && (
                        <div className={cn(
                          'mt-4 p-3 rounded-lg text-sm',
                          'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                        )}>
                          <AlertTriangle className="w-4 h-4 inline mr-2" />
                          {createdListing.priceAlertReason}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-center gap-4">
                      <Link href="/dashboard/market/marketplace">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                        >
                          Ver Publicaciones
                          <ArrowRight className="w-5 h-5" />
                        </motion.button>
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons */}
            {!createdListing && (
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
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmitListing}
                    disabled={submitting}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/30'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-400/30',
                      'text-white'
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Enviar a Aprobacion
                      </>
                    )}
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={goToNextStep}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      theme === 'dark'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-400/30',
                      'text-white'
                    )}
                  >
                    Siguiente
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                )}
              </div>
            )}
          </div>

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
                            ¿Cancelar publicacion?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Se perdera toda la informacion ingresada y no podras recuperarla.
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
                        onClick={() => router.push('/dashboard/market/marketplace')}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500 hover:bg-red-600'
                        )}
                      >
                        Si, cancelar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Price Confirmation Modal */}
          <AnimatePresence>
            {showPriceConfirmation && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowPriceConfirmation(false)}
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
                          priceCheck?.alertType === 'below_cost'
                            ? theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                            : theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                        )}>
                          <AlertTriangle className={cn(
                            "w-6 h-6",
                            priceCheck?.alertType === 'below_cost'
                              ? theme === 'dark' ? 'text-red-400' : 'text-red-600'
                              : theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                          )} />
                        </div>
                        <div className="flex-1">
                          <h3 className={cn(
                            "text-xl font-bold mb-2",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            Alerta de Precio
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            {priceCheck?.alertMessage}
                          </p>
                          <p className={cn(
                            "text-sm mt-2",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            ¿Deseas continuar con este precio?
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
                        onClick={() => setShowPriceConfirmation(false)}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        )}
                      >
                        Modificar precio
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={confirmPriceAndContinue}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                          theme === 'dark'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-emerald-500 hover:bg-emerald-600'
                        )}
                      >
                        Continuar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      
    
  )
}
