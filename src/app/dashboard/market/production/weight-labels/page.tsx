'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Scale,
  Search,
  Printer,
  Package,
  RefreshCw,
  Minus,
  Plus,
  Delete,
  CheckCircle,
  AlertCircle,
  Settings,
  History,
  X,
  DollarSign,
  ArrowLeft
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface WeightProduct {
  id: number
  name: string
  sku: string
  barcode: string
  category: string
  imageUrl: string | null
  sellingPrice: number
  unitOfMeasure: string
  weightBarcodePrefix: string | null
  isWeightProduct: boolean
}

interface GeneratedLabel {
  barcode: string
  productName: string
  weight: string
  priceCUP: number
  priceUSD: number
  printJobId: number
}

export default function WeightLabelsPage() {
  const { theme } = useTheme()
  const [products, setProducts] = useState<WeightProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<WeightProduct | null>(null)
  const [weight, setWeight] = useState('')
  const [copies, setCopies] = useState(1)
  const [search, setSearch] = useState('')
  const [exchangeRate, setExchangeRate] = useState(380)
  const [printing, setPrinting] = useState(false)
  const [lastLabel, setLastLabel] = useState<GeneratedLabel | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showPrefixModal, setShowPrefixModal] = useState(false)
  const [prefixInput, setPrefixInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Fetch products
  const fetchProducts = useCallback(async (searchTerm = '') => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/market/production/weight-products?${params}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data.products || [])
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch exchange rate
  const fetchExchangeRate = useCallback(async () => {
    try {
      const response = await fetch('/api/agency-rates/current')
      const data = await response.json()
      if (data.success && data.data?.exchangeRate) {
        setExchangeRate(data.data.exchangeRate)
      }
    } catch (err) {
      console.error('Error fetching exchange rate:', err)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchExchangeRate()
  }, [fetchProducts, fetchExchangeRate])

  // Handle search
  const handleSearch = () => {
    fetchProducts(search)
  }

  // Handle numpad input
  const handleNumpadPress = (key: string) => {
    if (key === 'backspace') {
      setWeight(prev => prev.slice(0, -1))
    } else if (key === 'clear') {
      setWeight('')
    } else if (key === '.') {
      if (!weight.includes('.')) {
        setWeight(prev => prev + '.')
      }
    } else {
      // Limit to 3 decimal places
      const parts = weight.split('.')
      if (parts.length === 2 && parts[1].length >= 3) return
      // Limit to reasonable weight (99.999 max)
      const newWeight = weight + key
      if (parseFloat(newWeight) <= 99.999) {
        setWeight(newWeight)
      }
    }
  }

  // Calculate price
  const weightNum = parseFloat(weight) || 0
  const pricePerKg = selectedProduct?.sellingPrice || 0
  const priceUSD = weightNum * pricePerKg
  const priceCUP = Math.round(priceUSD * exchangeRate)

  // Generate barcode preview
  const generateBarcodePreview = () => {
    if (!selectedProduct?.weightBarcodePrefix || !weight) return null
    const prefix = selectedProduct.weightBarcodePrefix.padStart(5, '0')
    const weightInt = Math.round(weightNum * 1000)
    const weightStr = weightInt.toString().padStart(5, '0')
    return `2${prefix}${weightStr}X` // X = check digit placeholder
  }

  // Handle print
  const handlePrint = async () => {
    if (!selectedProduct || !weightNum) return

    if (!selectedProduct.weightBarcodePrefix) {
      setShowPrefixModal(true)
      return
    }

    try {
      setPrinting(true)
      setError(null)

      const response = await fetch('/api/market/production/weight-labels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          weightKg: weightNum,
          copies
        })
      })

      const data = await response.json()

      if (data.success) {
        setLastLabel(data.data)
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 3000)
        // Reset for next label
        setWeight('')
      } else {
        setError(data.error || 'Error al imprimir')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setPrinting(false)
    }
  }

  // Handle prefix save
  const handleSavePrefix = async () => {
    if (!selectedProduct || !prefixInput) return

    try {
      const response = await fetch('/api/market/production/weight-products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          weightBarcodePrefix: prefixInput,
          isWeightProduct: true
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update local product
        setSelectedProduct(prev => prev ? { ...prev, weightBarcodePrefix: prefixInput } : null)
        setProducts(prev => prev.map(p =>
          p.id === selectedProduct.id ? { ...p, weightBarcodePrefix: prefixInput } : p
        ))
        setShowPrefixModal(false)
        setPrefixInput('')
      } else {
        setError(data.error || 'Error al guardar')
      }
    } catch (err) {
      setError('Error de conexión')
    }
  }

  const barcodePreview = generateBarcodePreview()

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER', 'MARKET_COMERCIAL', 'MARKET_ALMACENERO']}>
      <DashboardLayout>
        <div className="min-h-screen p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/market/production"
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  theme === 'dark'
                    ? 'hover:bg-gray-800 text-gray-400'
                    : 'hover:bg-gray-100 text-gray-600'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className={cn(
                  "text-2xl font-bold flex items-center gap-3",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Scale className="w-8 h-8 text-purple-500" />
                  Etiquetas de Peso
                </h1>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Imprime etiquetas con peso y código de barra embebido
                </p>
              </div>
            </div>

            <div className={cn(
              "px-4 py-2 rounded-lg border",
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              <span className={cn(
                "text-sm",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Tasa:
              </span>
              <span className={cn(
                "ml-2 font-bold",
                theme === 'dark' ? 'text-green-400' : 'text-green-600'
              )}>
                {exchangeRate.toLocaleString()} CUP
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Product Selection */}
            <div className={cn(
              "rounded-2xl border shadow-xl overflow-hidden",
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}>
              {/* Search */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className={cn(
                      "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )} />
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className={cn(
                        "w-full pl-10 pr-4 py-3 rounded-xl border transition-all text-lg",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                      )}
                    />
                  </div>
                  <button
                    onClick={() => fetchProducts(search)}
                    className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Products Grid */}
              <div className="p-4 h-[500px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Package className={cn(
                      "w-16 h-16 mb-4",
                      theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                    )} />
                    <p className={cn(
                      "text-lg font-medium",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      No hay productos de peso
                    </p>
                    <p className={cn(
                      "text-sm mt-1",
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>
                      Agrega productos con unidad kg, lb o g
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {products.map((product) => (
                      <motion.button
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "p-4 rounded-xl border text-left transition-all relative overflow-hidden",
                          selectedProduct?.id === product.id
                            ? theme === 'dark'
                              ? 'bg-purple-900/30 border-purple-500 ring-2 ring-purple-500'
                              : 'bg-purple-50 border-purple-500 ring-2 ring-purple-500'
                            : theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                        )}
                      >
                        {/* No prefix indicator */}
                        {!product.weightBarcodePrefix && (
                          <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                        )}

                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-20 object-cover rounded-lg mb-2"
                          />
                        ) : (
                          <div className={cn(
                            "w-full h-20 rounded-lg mb-2 flex items-center justify-center",
                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                          )}>
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}

                        <p className={cn(
                          "font-medium text-sm truncate",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {product.name}
                        </p>

                        <div className="flex items-center justify-between mt-1">
                          <span className={cn(
                            "text-xs",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            ${(product.sellingPrice || 0).toFixed(2)}/{product.unitOfMeasure || 'kg'}
                          </span>
                          <span className={cn(
                            "text-xs font-medium",
                            theme === 'dark' ? 'text-green-400' : 'text-green-600'
                          )}>
                            {Math.round((product.sellingPrice || 0) * exchangeRate).toLocaleString()} CUP
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Weight Input & Preview */}
            <div className={cn(
              "rounded-2xl border shadow-xl overflow-hidden",
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}>
              {selectedProduct ? (
                <div className="p-6">
                  {/* Selected Product Info */}
                  <div className={cn(
                    "p-4 rounded-xl mb-4",
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                  )}>
                    <div className="flex items-center gap-4">
                      {selectedProduct.imageUrl ? (
                        <img
                          src={selectedProduct.imageUrl}
                          alt={selectedProduct.name}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className={cn(
                          "w-16 h-16 rounded-lg flex items-center justify-center",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )}>
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className={cn(
                          "font-bold text-lg",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {selectedProduct.name}
                        </h3>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          ${(selectedProduct.sellingPrice || 0).toFixed(2)} / {selectedProduct.unitOfMeasure || 'kg'}
                        </p>
                      </div>
                      {!selectedProduct.weightBarcodePrefix && (
                        <button
                          onClick={() => setShowPrefixModal(true)}
                          className="p-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                          title="Configurar prefijo de código"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Weight Input Display */}
                  <div className={cn(
                    "p-6 rounded-xl mb-4 text-center",
                    theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                  )}>
                    <p className={cn(
                      "text-sm mb-2",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      PESO (kg)
                    </p>
                    <div className={cn(
                      "text-5xl font-bold tracking-wider",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {weight || '0.000'}
                    </div>
                  </div>

                  {/* Numpad */}
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'].map((key) => (
                      <motion.button
                        key={key}
                        onClick={() => handleNumpadPress(key)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          "p-4 rounded-xl text-2xl font-bold transition-all",
                          key === 'backspace'
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-700 hover:bg-gray-600 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        )}
                      >
                        {key === 'backspace' ? <Delete className="w-6 h-6 mx-auto" /> : key}
                      </motion.button>
                    ))}
                  </div>

                  {/* Price Preview */}
                  <div className={cn(
                    "p-6 rounded-xl mb-4",
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-green-900/50 to-emerald-900/50 border border-green-700'
                      : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                  )}>
                    <div className="text-center">
                      <p className={cn(
                        "text-sm mb-1",
                        theme === 'dark' ? 'text-green-300' : 'text-green-700'
                      )}>
                        PRECIO
                      </p>
                      <div className={cn(
                        "text-4xl font-bold",
                        theme === 'dark' ? 'text-green-400' : 'text-green-600'
                      )}>
                        {priceCUP.toLocaleString()} CUP
                      </div>
                    </div>
                  </div>

                  {/* Barcode Preview */}
                  {barcodePreview && (
                    <div className={cn(
                      "p-4 rounded-xl mb-4 text-center",
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
                    )}>
                      <p className={cn(
                        "text-xs mb-2",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        CÓDIGO DE BARRA
                      </p>
                      <div className="flex justify-center mb-2">
                        <div className={cn(
                          "px-4 py-2 rounded font-mono text-lg tracking-widest",
                          theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'
                        )}>
                          {barcodePreview}
                        </div>
                      </div>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                      )}>
                        EAN-13 con peso embebido
                      </p>
                    </div>
                  )}

                  {/* Copies Selector */}
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <button
                      onClick={() => setCopies(Math.max(1, copies - 1))}
                      className={cn(
                        "p-3 rounded-xl transition-all",
                        theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      )}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="text-center">
                      <p className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        Copias
                      </p>
                      <span className={cn(
                        "text-2xl font-bold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {copies}
                      </span>
                    </div>
                    <button
                      onClick={() => setCopies(Math.min(10, copies + 1))}
                      className={cn(
                        "p-3 rounded-xl transition-all",
                        theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      )}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="p-4 mb-4 rounded-xl bg-red-500/20 border border-red-500 text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      {error}
                    </div>
                  )}

                  {/* Print Button */}
                  <motion.button
                    onClick={handlePrint}
                    disabled={!weightNum || printing || !selectedProduct.weightBarcodePrefix}
                    whileHover={{ scale: weightNum && !printing ? 1.02 : 1 }}
                    whileTap={{ scale: weightNum && !printing ? 0.98 : 1 }}
                    className={cn(
                      "w-full py-5 rounded-xl text-xl font-bold transition-all flex items-center justify-center gap-3",
                      !weightNum || printing || !selectedProduct.weightBarcodePrefix
                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg shadow-purple-500/25'
                    )}
                  >
                    {printing ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <Printer className="w-6 h-6" />
                    )}
                    {printing ? 'Imprimiendo...' : `IMPRIMIR ETIQUETA (${copies})`}
                  </motion.button>

                  {!selectedProduct.weightBarcodePrefix && (
                    <p className={cn(
                      "text-center text-sm mt-3",
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                    )}>
                      Configure primero el prefijo de código de barra
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Scale className={cn(
                    "w-20 h-20 mb-6",
                    theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                  )} />
                  <p className={cn(
                    "text-xl font-medium",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Selecciona un producto
                  </p>
                  <p className={cn(
                    "text-sm mt-2",
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                  )}>
                    Elige un producto de peso para generar su etiqueta
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Success Toast */}
          <AnimatePresence>
            {showSuccess && lastLabel && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-6 right-6 p-4 bg-green-500 text-white rounded-xl shadow-2xl flex items-center gap-3"
              >
                <CheckCircle className="w-6 h-6" />
                <div>
                  <p className="font-bold">Etiqueta enviada a imprimir</p>
                  <p className="text-sm opacity-90">
                    {lastLabel.productName} - {lastLabel.weight}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Prefix Configuration Modal */}
          <AnimatePresence>
            {showPrefixModal && selectedProduct && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setShowPrefixModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "w-full max-w-md p-6 rounded-2xl shadow-2xl",
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className={cn(
                      "text-xl font-bold",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Configurar Prefijo de Código
                    </h3>
                    <button
                      onClick={() => setShowPrefixModal(false)}
                      className={cn(
                        "p-2 rounded-lg",
                        theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                      )}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <p className={cn(
                    "text-sm mb-4",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Ingresa un código único de 5 dígitos para <strong>{selectedProduct.name}</strong>. Este código se usará para identificar el producto en el código de barra de peso.
                  </p>

                  <div className="mb-4">
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Prefijo de Producto (5 dígitos)
                    </label>
                    <input
                      type="text"
                      value={prefixInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').substring(0, 5)
                        setPrefixInput(val)
                      }}
                      placeholder="00001"
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border text-center text-2xl font-mono tracking-widest",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-gray-50 border-gray-200 text-gray-900'
                      )}
                    />
                  </div>

                  <div className={cn(
                    "p-4 rounded-xl mb-6",
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                  )}>
                    <p className={cn(
                      "text-xs mb-2",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Formato de código resultante:
                    </p>
                    <p className={cn(
                      "font-mono text-lg",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      2{prefixInput.padStart(5, '0')}WWWWWC
                    </p>
                    <p className={cn(
                      "text-xs mt-2",
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>
                      2 = Prefijo peso | {prefixInput.padStart(5, '0')} = Producto | WWWWW = Peso | C = Check
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowPrefixModal(false)}
                      className={cn(
                        "flex-1 py-3 rounded-xl transition-all",
                        theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      )}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSavePrefix}
                      disabled={prefixInput.length !== 5}
                      className={cn(
                        "flex-1 py-3 rounded-xl transition-all font-bold",
                        prefixInput.length !== 5
                          ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      )}
                    >
                      Guardar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
