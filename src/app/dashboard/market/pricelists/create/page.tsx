'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Tag,
  Package,
  Settings,
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Trash2,
  Search,
  DollarSign,
  Percent
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'info' | 'products' | 'settings'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 'info', title: 'Información', description: 'Datos básicos', icon: Tag },
  { id: 'products', title: 'Productos', description: 'Precios especiales', icon: Package },
  { id: 'settings', title: 'Configuración', description: 'Vigencia', icon: Settings }
]

interface Product {
  id: number
  name: string
  sku: string
  sellingPrice: number
}

interface PricelistItem {
  productId: number
  productName: string
  productSku: string
  basePrice: number
  priceType: 'fixed' | 'discount_percent' | 'discount_amount'
  fixedPrice: number | null
  discountPercent: number | null
  discountAmount: number | null
  minQuantity: number
}

export default function CreatePricelistPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('info')
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)

  // Products state
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productSearch, setProductSearch] = useState('')
  const [items, setItems] = useState<PricelistItem[]>([])

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/market/products?limit=1000')
        const data = await response.json()
        if (data.success) {
          setProducts(data.data.products.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || '',
            sellingPrice: p.sellingPrice || 0
          })))
        }
      } catch (err) {
        console.error('Error fetching products:', err)
      } finally {
        setLoadingProducts(false)
      }
    }
    fetchProducts()
  }, [])

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'info') {
      if (!name.trim()) newErrors.name = 'El nombre es requerido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const addProduct = (product: Product) => {
    if (items.some(i => i.productId === product.id)) return

    setItems(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      basePrice: product.sellingPrice,
      priceType: 'fixed',
      fixedPrice: product.sellingPrice,
      discountPercent: null,
      discountAmount: null,
      minQuantity: 1
    }])
  }

  const removeProduct = (productId: number) => {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  const updateItem = (productId: number, updates: Partial<PricelistItem>) => {
    setItems(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, ...updates }
        : item
    ))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setErrors({})

    try {
      const response = await fetch('/api/market/pricelists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code: code || null,
          currency,
          validFrom: validFrom || null,
          validUntil: validUntil || null,
          isActive,
          isDefault,
          items: items.map(item => ({
            productId: item.productId,
            priceType: item.priceType,
            fixedPrice: item.priceType === 'fixed' ? item.fixedPrice : null,
            discountPercent: item.priceType === 'discount_percent' ? item.discountPercent : null,
            discountAmount: item.priceType === 'discount_amount' ? item.discountAmount : null,
            minQuantity: item.minQuantity
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push('/dashboard/market/pricelists')
      } else {
        setErrors({ submit: data.error || 'Error al crear lista de precios' })
      }
    } catch (err) {
      setErrors({ submit: 'Error de conexión' })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredProducts = products.filter(p =>
    !items.some(i => i.productId === p.id) &&
    (p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
     p.sku?.toLowerCase().includes(productSearch.toLowerCase()))
  )

  return (
    <ProtectedRoute>
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
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                            currentStep === step.id && 'shadow-lg shadow-blue-500/50'
                          )}
                        >
                          {currentStepIndex > index ? (
                            <Check className="w-7 h-7 text-white" />
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
                      </div>
                    </div>

                    {index < STEPS.length - 1 && (
                      <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 relative">
                        <div className={cn(
                          "absolute inset-0 rounded-full",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                        <motion.div
                          initial={false}
                          animate={{ scaleX: currentStepIndex > index ? 1 : 0 }}
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
                  ? 'bg-gray-800/95 border-gray-700/50'
                  : 'bg-white border-gray-200'
              )}
            >
              <AnimatePresence mode="wait">
                {/* Step 1: Info */}
                {currentStep === 'info' && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Tag className="w-5 h-5 text-white" />
                      </div>
                      Información de la Lista
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Nombre *
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ej: Lista Mayorista, Precios VIP"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            errors.name
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 focus:ring-blue-500/20'
                          )}
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Código (opcional)
                        </label>
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          placeholder="Ej: VIP, MAYORISTA"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Moneda
                        </label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 focus:ring-blue-500/20'
                          )}
                        >
                          <option value="USD">USD - Dólar</option>
                          <option value="CUP">CUP - Peso Cubano</option>
                          <option value="MLC">MLC - Moneda Libremente Convertible</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Products */}
                {currentStep === 'products' && (
                  <motion.div
                    key="products"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      Precios Especiales
                    </h2>

                    {/* Loading Products */}
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="ml-3 text-gray-500">Cargando productos...</span>
                      </div>
                    ) : products.length === 0 ? (
                      <div className={cn(
                        'text-center py-8 rounded-xl border-2 border-dashed',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <p className={cn('font-medium mb-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          No hay productos registrados
                        </p>
                        <p className="text-sm text-gray-500">
                          Primero debes crear productos en el inventario
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Search Products */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Buscar productos para agregar..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className={cn(
                              'w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 focus:ring-blue-500/20'
                            )}
                          />
                        </div>

                        {/* Available Products - Show all when no search, or filtered results */}
                        <div className={cn(
                          'max-h-48 overflow-y-auto rounded-xl border divide-y',
                          theme === 'dark' ? 'border-gray-700 divide-gray-700 bg-gray-900/30' : 'border-gray-200 divide-gray-200 bg-gray-50'
                        )}>
                          {filteredProducts.length > 0 ? (
                            filteredProducts.slice(0, productSearch ? 10 : 50).map(product => (
                              <motion.button
                                key={product.id}
                                onClick={() => addProduct(product)}
                                whileHover={{ scale: 1.01 }}
                                className={cn(
                                  'w-full flex items-center justify-between p-3 text-left transition-colors',
                                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-white'
                                )}
                              >
                                <div>
                                  <p className={cn(
                                    'font-medium',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-gray-500">{product.sku}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium">${product.sellingPrice.toFixed(2)}</span>
                                  <Plus className="w-5 h-5 text-blue-500" />
                                </div>
                              </motion.button>
                            ))
                          ) : (
                            <p className="p-4 text-center text-gray-500">
                              {productSearch ? 'No se encontraron productos' : 'Todos los productos ya han sido agregados'}
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {/* Selected Products */}
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500">{items.length} producto(s) agregado(s)</p>

                      {items.length === 0 ? (
                        <div className={cn(
                          'text-center py-8 rounded-xl border-2 border-dashed',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <Package className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                          <p className="text-gray-500">Busca y agrega productos para definir precios especiales</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {items.map(item => (
                            <motion.div
                              key={item.productId}
                              layout
                              className={cn(
                                'p-4 rounded-xl border',
                                theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                              )}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className={cn(
                                    'font-medium',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {item.productName}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Precio base: ${item.basePrice.toFixed(2)}
                                  </p>
                                </div>
                                <button
                                  onClick={() => removeProduct(item.productId)}
                                  className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                                  <select
                                    value={item.priceType}
                                    onChange={(e) => updateItem(item.productId, { priceType: e.target.value as any })}
                                    className={cn(
                                      'w-full px-2 py-1.5 rounded-lg border text-sm',
                                      theme === 'dark'
                                        ? 'bg-gray-800 border-gray-600 text-white'
                                        : 'bg-white border-gray-200'
                                    )}
                                  >
                                    <option value="fixed">Precio Fijo</option>
                                    <option value="discount_percent">% Descuento</option>
                                    <option value="discount_amount">$ Descuento</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">
                                    {item.priceType === 'fixed' ? 'Precio' :
                                     item.priceType === 'discount_percent' ? '% Desc.' : '$ Desc.'}
                                  </label>
                                  <div className="relative">
                                    {item.priceType === 'fixed' ? (
                                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    ) : item.priceType === 'discount_percent' ? (
                                      <Percent className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    ) : (
                                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    )}
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={
                                        item.priceType === 'fixed' ? item.fixedPrice || '' :
                                        item.priceType === 'discount_percent' ? item.discountPercent || '' :
                                        item.discountAmount || ''
                                      }
                                      onChange={(e) => {
                                        const val = e.target.value ? parseFloat(e.target.value) : null
                                        if (item.priceType === 'fixed') {
                                          updateItem(item.productId, { fixedPrice: val })
                                        } else if (item.priceType === 'discount_percent') {
                                          updateItem(item.productId, { discountPercent: val })
                                        } else {
                                          updateItem(item.productId, { discountAmount: val })
                                        }
                                      }}
                                      className={cn(
                                        'w-full pl-7 pr-2 py-1.5 rounded-lg border text-sm',
                                        theme === 'dark'
                                          ? 'bg-gray-800 border-gray-600 text-white'
                                          : 'bg-white border-gray-200'
                                      )}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Cant. Mín.</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.minQuantity}
                                    onChange={(e) => updateItem(item.productId, { minQuantity: parseInt(e.target.value) || 1 })}
                                    className={cn(
                                      'w-full px-2 py-1.5 rounded-lg border text-sm',
                                      theme === 'dark'
                                        ? 'bg-gray-800 border-gray-600 text-white'
                                        : 'bg-white border-gray-200'
                                    )}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Settings */}
                {currentStep === 'settings' && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-white" />
                      </div>
                      Configuración
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Válido desde
                        </label>
                        <input
                          type="date"
                          value={validFrom}
                          onChange={(e) => setValidFrom(e.target.value)}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 focus:ring-blue-500/20'
                          )}
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Válido hasta
                        </label>
                        <input
                          type="date"
                          value={validUntil}
                          onChange={(e) => setValidUntil(e.target.value)}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 focus:ring-blue-500/20'
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <motion.label
                        whileHover={{ scale: 1.01 }}
                        className={cn(
                          'flex items-center justify-between p-5 rounded-xl cursor-pointer transition-all border',
                          isActive
                            ? theme === 'dark' ? 'bg-green-900/20 border-green-500' : 'bg-green-50 border-green-500'
                            : theme === 'dark' ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <div>
                          <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            Lista Activa
                          </p>
                          <p className="text-sm text-gray-500">
                            Solo las listas activas se aplican a los productos
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          className="w-5 h-5 rounded accent-green-500"
                        />
                      </motion.label>

                      <motion.label
                        whileHover={{ scale: 1.01 }}
                        className={cn(
                          'flex items-center justify-between p-5 rounded-xl cursor-pointer transition-all border',
                          isDefault
                            ? theme === 'dark' ? 'bg-amber-900/20 border-amber-500' : 'bg-amber-50 border-amber-500'
                            : theme === 'dark' ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <div>
                          <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            Lista por Defecto
                          </p>
                          <p className="text-sm text-gray-500">
                            Se usará como lista principal cuando no haya otra asignada
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isDefault}
                          onChange={(e) => setIsDefault(e.target.checked)}
                          className="w-5 h-5 rounded accent-amber-500"
                        />
                      </motion.label>
                    </div>

                    {errors.submit && (
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark'
                          ? 'bg-red-900/20 border-red-800 text-red-300'
                          : 'bg-red-50 border-red-200 text-red-700'
                      )}>
                        {errors.submit}
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
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </motion.button>

              {currentStep === 'settings' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Crear Lista
                    </>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToNextStep}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-blue-500 text-white shadow-lg"
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
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
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-md rounded-2xl shadow-2xl border p-6",
                      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className={cn(
                      'text-lg font-bold mb-2',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      ¿Cancelar creación?
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Se perderá toda la información ingresada.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowCancelModal(false)}
                        className={cn(
                          'flex-1 px-4 py-2 rounded-xl font-medium',
                          theme === 'dark'
                            ? 'bg-gray-700 text-white hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                        )}
                      >
                        Continuar
                      </button>
                      <button
                        onClick={() => router.push('/dashboard/market/pricelists')}
                        className="flex-1 px-4 py-2 rounded-xl font-medium bg-red-500 text-white hover:bg-red-600"
                      >
                        Cancelar
                      </button>
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
