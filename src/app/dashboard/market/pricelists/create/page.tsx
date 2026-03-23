'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Tag,
  Package,
  Plus,
  X,
  ArrowLeft,
  Loader2,
  Trash2,
  Search,
  DollarSign,
  Percent,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Save,
  AlertCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  name: string
  sku: string
  sellingPrice: number
  imageUrl?: string
  category?: string
}

interface PriceTier {
  id: string
  minQuantity: number
  priceType: 'fixed' | 'discount_percent' | 'discount_amount'
  value: number
}

interface SelectedProduct {
  productId: number
  productName: string
  productSku: string
  basePrice: number
  imageUrl?: string
  tiers: PriceTier[]
  expanded: boolean
}

export default function CreatePricelistPage() {
  const { theme } = useTheme()
  const router = useRouter()

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
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/market/products?limit=1000')
      const data = await response.json()
      if (data.success) {
        setProducts(data.data.products.map((p: Product & { imageUrl?: string }) => ({
          id: p.id,
          name: p.name,
          sku: p.sku || '',
          sellingPrice: p.sellingPrice || 0,
          imageUrl: p.imageUrl,
          category: p.category
        })))
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoadingProducts(false)
    }
  }

  const addProduct = (product: Product) => {
    // Check if already added
    if (selectedProducts.some(p => p.productId === product.id)) {
      return
    }

    setSelectedProducts(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      basePrice: product.sellingPrice,
      imageUrl: product.imageUrl,
      tiers: [{
        id: `${product.id}-1`,
        minQuantity: 1,
        priceType: 'fixed',
        value: product.sellingPrice
      }],
      expanded: true
    }])
  }

  const removeProduct = (productId: number) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId))
  }

  const toggleProductExpanded = (productId: number) => {
    setSelectedProducts(prev => prev.map(p =>
      p.productId === productId ? { ...p, expanded: !p.expanded } : p
    ))
  }

  const addTier = (productId: number) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.productId !== productId) return p
      const maxQty = Math.max(...p.tiers.map(t => t.minQuantity), 0)
      const newTier: PriceTier = {
        id: `${productId}-${Date.now()}`,
        minQuantity: maxQty + 5,
        priceType: 'fixed',
        value: p.basePrice
      }
      return { ...p, tiers: [...p.tiers, newTier], expanded: true }
    }))
  }

  const removeTier = (productId: number, tierId: string) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.productId !== productId) return p
      // Don't allow removing the last tier
      if (p.tiers.length <= 1) return p
      return { ...p, tiers: p.tiers.filter(t => t.id !== tierId) }
    }))
  }

  const updateTier = (productId: number, tierId: string, updates: Partial<PriceTier>) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.productId !== productId) return p
      return {
        ...p,
        tiers: p.tiers.map(t => t.id === tierId ? { ...t, ...updates } : t)
      }
    }))
  }

  const calculateFinalPrice = (basePrice: number, tier: PriceTier): number => {
    switch (tier.priceType) {
      case 'fixed':
        return tier.value
      case 'discount_percent':
        return basePrice * (1 - tier.value / 100)
      case 'discount_amount':
        return Math.max(0, basePrice - tier.value)
      default:
        return basePrice
    }
  }

  const calculateSavings = (basePrice: number, tier: PriceTier): number => {
    const finalPrice = calculateFinalPrice(basePrice, tier)
    return ((basePrice - finalPrice) / basePrice) * 100
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('El nombre de la lista es requerido')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      // Convert selectedProducts to items format expected by API
      const items = selectedProducts.flatMap(p =>
        p.tiers.map(tier => ({
          productId: p.productId,
          priceType: tier.priceType,
          fixedPrice: tier.priceType === 'fixed' ? tier.value : null,
          discountPercent: tier.priceType === 'discount_percent' ? tier.value : null,
          discountAmount: tier.priceType === 'discount_amount' ? tier.value : null,
          minQuantity: tier.minQuantity
        }))
      )

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
          items
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push('/dashboard/market/pricelists')
      } else {
        setError(data.error || 'Error al crear lista de precios')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredProducts = useMemo(() => {
    const search = productSearch.toLowerCase()
    return products.filter(p =>
      !selectedProducts.some(sp => sp.productId === p.id) &&
      (p.name.toLowerCase().includes(search) ||
       p.sku?.toLowerCase().includes(search))
    )
  }, [products, productSearch, selectedProducts])

  const totalItems = selectedProducts.reduce((sum, p) => sum + p.tiers.length, 0)

  return (
    <div className={cn(
      "min-h-screen",
      theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      {/* Header */}
      <div className={cn(
        "sticky top-0 z-20 border-b px-4 sm:px-6 py-4",
        theme === 'dark' ? 'bg-gray-900/95 border-gray-800 backdrop-blur-sm' : 'bg-white/95 border-gray-200 backdrop-blur-sm'
      )}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/market/pricelists')}
              className={cn(
                'p-2 rounded-xl transition-colors',
                theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={cn(
                "text-xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Nueva Lista de Precios
              </h1>
              <p className="text-sm text-gray-500">
                {selectedProducts.length} productos, {totalItems} precios configurados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                showSettings
                  ? theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                  : theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              <Tag className="w-4 h-4" />
              Configuración
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={submitting || !name.trim()}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-xl font-medium transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25'
              )}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar Lista
            </motion.button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-7xl mx-auto px-4 sm:px-6 pt-4"
          >
            <div className={cn(
              'flex items-center gap-3 p-4 rounded-xl border',
              theme === 'dark'
                ? 'bg-red-900/20 border-red-800 text-red-300'
                : 'bg-red-50 border-red-200 text-red-700'
            )}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError('')} className="ml-auto">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={cn(
              'border-b',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-800' : 'bg-white border-gray-200'
            )}>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Nombre de la Lista *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: Lista Mayorista"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Código
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="MAYORISTA"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

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
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:ring-blue-500/20'
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
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-900 border-gray-700 text-white focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 focus:ring-blue-500/20'
                      )}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded accent-green-500"
                    />
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Lista Activa
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="w-4 h-4 rounded accent-amber-500"
                    />
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Lista por Defecto
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Available Products */}
          <div className={cn(
            'rounded-2xl border overflow-hidden h-fit lg:sticky lg:top-24',
            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
          )}>
            <div className={cn(
              'px-4 py-3 border-b',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
            )}>
              <h2 className={cn(
                'font-semibold flex items-center gap-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Package className="w-5 h-5 text-blue-500" />
                Productos Disponibles
              </h2>
            </div>

            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className={cn(
                    'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all text-sm',
                    theme === 'dark'
                      ? 'bg-gray-900 border-gray-700 text-white focus:ring-blue-500/20'
                      : 'bg-gray-50 border-gray-200 focus:ring-blue-500/20'
                  )}
                />
              </div>

              {loadingProducts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">
                        {productSearch ? 'No se encontraron productos' : 'Todos los productos han sido agregados'}
                      </p>
                    </div>
                  ) : (
                    filteredProducts.slice(0, 50).map(product => (
                      <motion.button
                        key={product.id}
                        onClick={() => addProduct(product)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border',
                          theme === 'dark'
                            ? 'border-gray-700 hover:border-blue-500 hover:bg-blue-900/20'
                            : 'border-gray-100 hover:border-blue-500 hover:bg-blue-50'
                        )}
                      >
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <Package className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'font-medium text-sm truncate',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {product.name}
                          </p>
                          <p className="text-xs text-gray-500">{product.sku}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-green-600">${product.sellingPrice.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}</p>
                          <p className="text-xs text-blue-500 flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Agregar
                          </p>
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Selected Products with Pricing */}
          <div className="space-y-4">
            <div className={cn(
              'rounded-2xl border overflow-hidden',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <div className={cn(
                'px-4 py-3 border-b',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
              )}>
                <h2 className={cn(
                  'font-semibold flex items-center gap-2',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Tag className="w-5 h-5 text-green-500" />
                  Productos con Precios Especiales
                  <span className={cn(
                    'ml-2 px-2 py-0.5 rounded-full text-xs',
                    theme === 'dark' ? 'bg-green-900/50 text-green-300' : 'bg-green-100 text-green-700'
                  )}>
                    {selectedProducts.length}
                  </span>
                </h2>
              </div>

              <div className="p-4">
                {selectedProducts.length === 0 ? (
                  <div className={cn(
                    'text-center py-12 rounded-xl border-2 border-dashed',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <Tag className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className={cn('font-medium mb-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Sin productos agregados
                    </p>
                    <p className="text-sm text-gray-500">
                      Selecciona productos de la izquierda para configurar precios especiales
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedProducts.map(product => (
                      <motion.div
                        key={product.productId}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={cn(
                          'rounded-xl border overflow-hidden',
                          theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50'
                        )}
                      >
                        {/* Product Header */}
                        <div
                          onClick={() => toggleProductExpanded(product.productId)}
                          className={cn(
                            'flex items-center gap-3 p-4 cursor-pointer transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100'
                          )}
                        >
                          <div className={cn(
                            'w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0',
                            theme === 'dark' ? 'bg-gray-700' : 'bg-white'
                          )}>
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <Package className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'font-semibold truncate',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {product.productName}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{product.productSku}</span>
                              <span>•</span>
                              <span>Precio base: ${product.basePrice.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}</span>
                              <span>•</span>
                              <span className="text-blue-500">{product.tiers.length} precio(s)</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeProduct(product.productId)
                              }}
                              className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            {product.expanded ? (
                              <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Tiers */}
                        <AnimatePresence>
                          {product.expanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className={cn(
                                'px-4 pb-4 pt-2 space-y-3 border-t',
                                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                              )}>
                                {/* Tiers */}
                                {product.tiers
                                  .sort((a, b) => a.minQuantity - b.minQuantity)
                                  .map((tier, tierIndex) => {
                                    const finalPrice = calculateFinalPrice(product.basePrice, tier)
                                    const savings = calculateSavings(product.basePrice, tier)

                                    return (
                                      <div
                                        key={tier.id}
                                        className={cn(
                                          'p-3 rounded-xl',
                                          theme === 'dark' ? 'bg-gray-900/50' : 'bg-white'
                                        )}
                                      >
                                        <div className="flex items-center gap-2 mb-3">
                                          <Layers className="w-4 h-4 text-blue-500" />
                                          <span className={cn(
                                            'text-xs font-medium',
                                            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                                          )}>
                                            Escalón {tierIndex + 1}
                                          </span>
                                          {product.tiers.length > 1 && (
                                            <button
                                              onClick={() => removeTier(product.productId, tier.id)}
                                              className="ml-auto p-1 text-red-400 hover:text-red-500 rounded"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>

                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                          {/* Min Quantity */}
                                          <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">
                                              Cantidad Mínima
                                            </label>
                                            <input
                                              type="number"
                                              min="1"
                                              value={tier.minQuantity}
                                              onChange={(e) => updateTier(product.productId, tier.id, {
                                                minQuantity: parseInt(e.target.value) || 1
                                              })}
                                              className={cn(
                                                'w-full px-3 py-2 rounded-lg border text-sm font-medium',
                                                theme === 'dark'
                                                  ? 'bg-gray-800 border-gray-700 text-white'
                                                  : 'bg-gray-50 border-gray-200'
                                              )}
                                            />
                                          </div>

                                          {/* Price Type */}
                                          <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">
                                              Tipo de Precio
                                            </label>
                                            <select
                                              value={tier.priceType}
                                              onChange={(e) => {
                                                const newType = e.target.value as PriceTier['priceType']
                                                updateTier(product.productId, tier.id, {
                                                  priceType: newType,
                                                  value: newType === 'fixed' ? product.basePrice : 10
                                                })
                                              }}
                                              className={cn(
                                                'w-full px-3 py-2 rounded-lg border text-sm',
                                                theme === 'dark'
                                                  ? 'bg-gray-800 border-gray-700 text-white'
                                                  : 'bg-gray-50 border-gray-200'
                                              )}
                                            >
                                              <option value="fixed">Precio Fijo</option>
                                              <option value="discount_percent">% Descuento</option>
                                              <option value="discount_amount">$ Descuento</option>
                                            </select>
                                          </div>

                                          {/* Value */}
                                          <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">
                                              {tier.priceType === 'fixed' ? 'Precio ($)' :
                                               tier.priceType === 'discount_percent' ? 'Descuento (%)' : 'Descuento ($)'}
                                            </label>
                                            <div className="relative">
                                              <input
                                                type="number"
                                                step="any"
                                                min="0"
                                                max={tier.priceType === 'discount_percent' ? '100' : undefined}
                                                value={tier.value}
                                                onChange={(e) => updateTier(product.productId, tier.id, {
                                                  value: e.target.value === '' ? 0 : parseFloat(e.target.value)
                                                })}
                                                className={cn(
                                                  'w-full px-3 py-2 rounded-lg border text-sm font-medium',
                                                  theme === 'dark'
                                                    ? 'bg-gray-800 border-gray-700 text-white'
                                                    : 'bg-gray-50 border-gray-200'
                                                )}
                                              />
                                              {tier.priceType !== 'fixed' && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                  {tier.priceType === 'discount_percent' ? (
                                                    <Percent className="w-4 h-4 text-gray-400" />
                                                  ) : (
                                                    <DollarSign className="w-4 h-4 text-gray-400" />
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Result Preview */}
                                          <div>
                                            <label className="text-[10px] text-gray-500 block mb-1">
                                              Precio Final
                                            </label>
                                            <div className={cn(
                                              'px-3 py-2 rounded-lg text-sm font-bold',
                                              savings > 0
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                                            )}>
                                              ${finalPrice.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}
                                              {savings > 0 && (
                                                <span className="text-xs font-normal ml-1">
                                                  (-{savings.toFixed(0)}%)
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}

                                {/* Add Tier Button */}
                                <button
                                  onClick={() => addTier(product.productId)}
                                  className={cn(
                                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border-2 border-dashed',
                                    theme === 'dark'
                                      ? 'border-gray-700 text-gray-400 hover:border-blue-500 hover:text-blue-400'
                                      : 'border-gray-200 text-gray-500 hover:border-blue-500 hover:text-blue-600'
                                  )}
                                >
                                  <Plus className="w-4 h-4" />
                                  Agregar escalón por cantidad
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
