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
  X,
  Maximize,
  Minimize,
  ArrowLeft,
  Home
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'
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
  const router = useRouter()
  const { USD_CUP, formatCUP, source, loading: ratesLoading } = useMarketExchangeRates()

  const [products, setProducts] = useState<WeightProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<WeightProduct | null>(null)
  const [weight, setWeight] = useState('')
  const [copies, setCopies] = useState(1)
  const [search, setSearch] = useState('')
  const [printing, setPrinting] = useState(false)
  const [lastLabel, setLastLabel] = useState<GeneratedLabel | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showPrefixModal, setShowPrefixModal] = useState(false)
  const [prefixInput, setPrefixInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(true) // Start fullscreen by default
  const [mounted, setMounted] = useState(false)

  // Client-side mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }, [])

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

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

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
  const pricePerKg = parseFloat(String(selectedProduct?.sellingPrice)) || 0
  const priceUSD = weightNum * pricePerKg
  const priceCUP = Math.round(priceUSD * USD_CUP)

  // Generate barcode preview (format: 20PPPPPWWWWWC)
  const generateBarcodePreview = () => {
    if (!selectedProduct?.weightBarcodePrefix || !weight) return null
    const prefix = selectedProduct.weightBarcodePrefix.padStart(5, '0')
    const weightInt = Math.round(weightNum * 1000)
    const weightStr = weightInt.toString().padStart(5, '0')
    return `20${prefix}${weightStr}X` // X = check digit placeholder
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

  if (!mounted) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER', 'MARKET_COMERCIAL', 'MARKET_ALMACENERO']}>
      <div className={cn(
        "h-screen w-screen overflow-hidden flex flex-col",
        "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
      )}>
        {/* Header Bar */}
        <div className="flex-shrink-0 h-14 bg-gray-800/90 backdrop-blur border-b border-gray-700 flex items-center justify-between px-4">
          {/* Left - Navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard/market/production')}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Volver a Producción"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => router.push('/dashboard/market')}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Ir al Dashboard"
            >
              <Home className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-gray-600" />
            <div className="flex items-center gap-2">
              <Scale className="w-6 h-6 text-purple-400" />
              <span className="font-bold text-white text-lg hidden sm:block">Etiquetas de Peso</span>
            </div>
          </div>

          {/* Center - Exchange Rate */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "px-4 py-1.5 rounded-full flex items-center gap-2",
              "bg-green-500/20 border border-green-500/50"
            )}>
              <span className="text-sm text-green-400">Tasa:</span>
              <span className="font-bold text-green-400 text-lg">
                {ratesLoading ? '...' : USD_CUP.toLocaleString()} CUP
              </span>
              {source === 'manual' && (
                <span className="text-xs text-green-300/60">(manual)</span>
              )}
            </div>
          </div>

          {/* Right - Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProducts(search)}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Recargar productos"
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Product Selection */}
          <div className="w-1/2 lg:w-2/5 flex flex-col border-r border-gray-700 bg-gray-800/50">
            {/* Search */}
            <div className="p-3 border-b border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchProducts(search)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-700 border border-gray-600 text-white placeholder-gray-400 text-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-10 h-10 animate-spin text-purple-500" />
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Package className="w-16 h-16 mb-4 text-gray-600" />
                  <p className="text-lg font-medium text-gray-400">No hay productos de peso</p>
                  <p className="text-sm mt-1 text-gray-500">Agrega productos con unidad kg, lb o g</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {products.map((product) => (
                    <motion.button
                      key={product.id}
                      onClick={() => {
                        setSelectedProduct(product)
                        setWeight('')
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all relative",
                        selectedProduct?.id === product.id
                          ? 'bg-purple-900/40 border-purple-500 ring-2 ring-purple-500/50'
                          : 'bg-gray-800/80 border-gray-600 hover:border-gray-500'
                      )}
                    >
                      {/* No prefix indicator */}
                      {!product.weightBarcodePrefix && (
                        <span className="absolute top-2 right-2 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                      )}

                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full aspect-square object-cover rounded-lg mb-2"
                        />
                      ) : (
                        <div className="w-full aspect-square rounded-lg mb-2 flex items-center justify-center bg-gray-700">
                          <Package className="w-10 h-10 text-gray-500" />
                        </div>
                      )}

                      <p className="font-medium text-sm text-white truncate">
                        {product.name}
                      </p>

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-400">
                          ${(parseFloat(String(product.sellingPrice)) || 0).toFixed(2)}/{product.unitOfMeasure || 'kg'}
                        </span>
                        <span className="text-xs font-bold text-green-400">
                          {Math.round((parseFloat(String(product.sellingPrice)) || 0) * USD_CUP).toLocaleString()} CUP
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Weight Input & Preview */}
          <div className="flex-1 flex flex-col bg-gray-900/50">
            {selectedProduct ? (
              <>
                {/* Selected Product Header */}
                <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                  <div className="flex items-center gap-4">
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-14 h-14 object-cover rounded-xl"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-gray-700">
                        <Package className="w-7 h-7 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-xl text-white truncate">
                        {selectedProduct.name}
                      </h3>
                      <p className="text-gray-400">
                        ${(parseFloat(String(selectedProduct.sellingPrice)) || 0).toFixed(2)} / {selectedProduct.unitOfMeasure || 'kg'}
                        <span className="ml-2 text-green-400 font-medium">
                          ({Math.round((parseFloat(String(selectedProduct.sellingPrice)) || 0) * USD_CUP).toLocaleString()} CUP/{selectedProduct.unitOfMeasure || 'kg'})
                        </span>
                      </p>
                    </div>
                    {!selectedProduct.weightBarcodePrefix && (
                      <button
                        onClick={() => setShowPrefixModal(true)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2"
                        title="Configurar prefijo de código"
                      >
                        <Settings className="w-5 h-5" />
                        <span className="hidden sm:inline">Configurar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Main Input Area */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                  {/* Left - Numpad */}
                  <div className="lg:w-1/2 p-4 flex flex-col">
                    {/* Weight Display */}
                    <div className="bg-gray-800 rounded-2xl p-6 mb-4 text-center border border-gray-700">
                      <p className="text-gray-400 text-sm mb-2 uppercase tracking-wider">Peso ({selectedProduct?.unitOfMeasure || 'kg'})</p>
                      <div className="text-6xl font-bold text-white tracking-wider font-mono">
                        {weight || '0.000'}
                      </div>
                    </div>

                    {/* Numpad */}
                    <div className="grid grid-cols-3 gap-2 flex-1">
                      {['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'backspace'].map((key) => (
                        <motion.button
                          key={key}
                          onClick={() => handleNumpadPress(key)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          className={cn(
                            "rounded-xl text-3xl font-bold transition-all flex items-center justify-center min-h-[70px]",
                            key === 'backspace'
                              ? 'bg-red-500/80 hover:bg-red-500 text-white'
                              : 'bg-gray-700 hover:bg-gray-600 text-white'
                          )}
                        >
                          {key === 'backspace' ? <Delete className="w-8 h-8" /> : key}
                        </motion.button>
                      ))}
                    </div>

                    {/* Clear Button */}
                    <button
                      onClick={() => setWeight('')}
                      className="mt-2 py-3 rounded-xl bg-gray-600 hover:bg-gray-500 text-white font-medium transition-colors"
                    >
                      Borrar Todo
                    </button>
                  </div>

                  {/* Right - Preview & Actions */}
                  <div className="lg:w-1/2 p-4 flex flex-col border-t lg:border-t-0 lg:border-l border-gray-700">
                    {/* Price Display */}
                    <div className={cn(
                      "rounded-2xl p-6 text-center mb-4",
                      "bg-gradient-to-br from-green-900/60 to-emerald-900/60 border-2 border-green-500/50"
                    )}>
                      <p className="text-green-300 text-sm mb-1 uppercase tracking-wider">Precio Total</p>
                      <div className="text-5xl font-bold text-green-400">
                        {priceCUP.toLocaleString()}
                      </div>
                      <div className="text-green-300/70 text-lg mt-1">CUP</div>
                    </div>

                    {/* Label Preview (3x2 inches = 76mm x 51mm) */}
                    {barcodePreview ? (
                      <div className="bg-gray-800 rounded-xl p-3 mb-4 border border-gray-700">
                        <p className="text-gray-400 text-xs mb-2 uppercase text-center">Vista Previa Etiqueta (3x2")</p>
                        {/* Label simulation - 3:2 aspect ratio */}
                        <div className="bg-white rounded-lg p-3 mx-auto" style={{ maxWidth: '240px', aspectRatio: '3/2' }}>
                          {/* Product Name - Top */}
                          <p className="font-bold text-black text-sm text-center truncate border-b border-gray-300 pb-1 mb-2">
                            {selectedProduct.name}
                          </p>

                          {/* Barcode - Center */}
                          <div className="flex flex-col items-center justify-center flex-1 py-1">
                            <div className="flex justify-center gap-0.5 mb-1">
                              {Array.from({ length: 35 }).map((_, i) => (
                                <div
                                  key={i}
                                  className="bg-black"
                                  style={{
                                    width: i % 3 === 0 ? '2px' : '1px',
                                    height: '32px'
                                  }}
                                />
                              ))}
                            </div>
                            <p className="font-mono text-xs text-black tracking-wider">
                              {barcodePreview}
                            </p>
                          </div>

                          {/* Price & Weight - Bottom */}
                          <div className="border-t border-gray-300 pt-1 mt-1">
                            <div className="flex justify-between items-center text-[10px]">
                              <div className="text-left">
                                <span className="text-gray-500">{Math.round((parseFloat(String(selectedProduct.sellingPrice)) || 0) * USD_CUP).toLocaleString()} CUP/{selectedProduct.unitOfMeasure || 'kg'}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-gray-500">{weight || '0.000'} {selectedProduct.unitOfMeasure || 'kg'}</span>
                              </div>
                            </div>
                            {/* Total Price - Prominent */}
                            <div className="text-center mt-1 pt-1 border-t border-gray-200">
                              <p className="font-black text-black text-lg">{priceCUP.toLocaleString()} CUP</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-500 text-xs mt-2 text-center">EAN-13 con peso embebido</p>
                      </div>
                    ) : (
                      <div className="bg-gray-800/50 rounded-xl p-4 text-center mb-4 border border-dashed border-gray-600">
                        <p className="text-gray-500 text-sm">
                          {!selectedProduct.weightBarcodePrefix
                            ? 'Configure el prefijo para ver el código'
                            : 'Ingrese el peso para ver el código'}
                        </p>
                      </div>
                    )}

                    {/* Copies Selector */}
                    <div className="flex items-center justify-center gap-6 mb-4 py-3 bg-gray-800 rounded-xl">
                      <button
                        onClick={() => setCopies(Math.max(1, copies - 1))}
                        className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-6 h-6" />
                      </button>
                      <div className="text-center">
                        <p className="text-gray-400 text-xs uppercase">Copias</p>
                        <span className="text-3xl font-bold text-white">{copies}</span>
                      </div>
                      <button
                        onClick={() => setCopies(Math.min(10, copies + 1))}
                        className="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="p-3 mb-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Print Button */}
                    <motion.button
                      onClick={handlePrint}
                      disabled={!weightNum || printing || !selectedProduct.weightBarcodePrefix}
                      whileHover={{ scale: weightNum && !printing && selectedProduct.weightBarcodePrefix ? 1.02 : 1 }}
                      whileTap={{ scale: weightNum && !printing && selectedProduct.weightBarcodePrefix ? 0.98 : 1 }}
                      className={cn(
                        "py-5 rounded-xl text-xl font-bold transition-all flex items-center justify-center gap-3 mt-auto",
                        !weightNum || printing || !selectedProduct.weightBarcodePrefix
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-xl shadow-purple-500/30'
                      )}
                    >
                      {printing ? (
                        <RefreshCw className="w-7 h-7 animate-spin" />
                      ) : (
                        <Printer className="w-7 h-7" />
                      )}
                      {printing ? 'Imprimiendo...' : `IMPRIMIR ${copies > 1 ? `(${copies})` : ''}`}
                    </motion.button>

                    {!selectedProduct.weightBarcodePrefix && (
                      <p className="text-center text-sm mt-3 text-amber-400">
                        Configure primero el prefijo de código de barra
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-32 h-32 rounded-full bg-gray-800 flex items-center justify-center mb-6">
                  <Scale className="w-16 h-16 text-gray-600" />
                </div>
                <p className="text-2xl font-medium text-gray-400">Selecciona un producto</p>
                <p className="text-gray-500 mt-2 max-w-sm">
                  Elige un producto de peso del panel izquierdo para generar su etiqueta con código de barra
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Success Toast */}
        <AnimatePresence>
          {showSuccess && lastLabel && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="fixed bottom-6 right-6 p-5 bg-green-500 text-white rounded-2xl shadow-2xl flex items-center gap-4 z-50"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle className="w-7 h-7" />
              </div>
              <div>
                <p className="font-bold text-lg">Etiqueta enviada</p>
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
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
              onClick={() => setShowPrefixModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg p-6 rounded-2xl shadow-2xl bg-gray-800 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">
                    Configurar Prefijo de Código
                  </h3>
                  <button
                    onClick={() => setShowPrefixModal(false)}
                    className="p-2 rounded-lg hover:bg-gray-700"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <p className="text-gray-400 text-sm mb-4">
                  Ingresa un código único de 5 dígitos para <strong className="text-white">{selectedProduct.name}</strong>. Este código se usará para identificar el producto en el código de barra de peso.
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
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
                    className="w-full px-4 py-4 rounded-xl border bg-gray-700 border-gray-600 text-white text-center text-3xl font-mono tracking-widest focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    autoFocus
                  />
                </div>

                <div className="p-4 rounded-xl bg-gray-700/50 mb-6 border border-gray-600">
                  <p className="text-gray-400 text-xs mb-2">Formato de código resultante:</p>
                  <p className="font-mono text-xl text-white text-center">
                    2<span className="text-purple-400">{prefixInput.padStart(5, '0')}</span><span className="text-green-400">WWWWW</span><span className="text-gray-500">C</span>
                  </p>
                  <div className="flex justify-center gap-4 mt-3 text-xs">
                    <span className="text-gray-400">2 = Peso</span>
                    <span className="text-purple-400">{prefixInput.padStart(5, '0')} = Producto</span>
                    <span className="text-green-400">W = Peso</span>
                    <span className="text-gray-500">C = Check</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPrefixModal(false)}
                    className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSavePrefix}
                    disabled={prefixInput.length !== 5}
                    className={cn(
                      "flex-1 py-3 rounded-xl transition-all font-bold",
                      prefixInput.length !== 5
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
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
    </ProtectedRoute>
  )
}
