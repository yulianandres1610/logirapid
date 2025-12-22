'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  Search,
  Package,
  Wifi,
  WifiOff,
  Trash2,
  Edit3,
  Check,
  X,
  AlertCircle,
  Loader2,
  ClipboardList,
  CornerDownLeft,
  Delete,
  ChevronRight,
  List
} from 'lucide-react'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'

interface Product {
  id: number
  name: string
  sku: string
  barcode: string
  sellingPrice: number
  stock: number
  imageUrl: string | null
}

interface CountedProduct {
  productId: number
  productName: string
  productSku: string
  productBarcode: string
  productImage: string | null
  unitPrice: number
  countedQuantity: number
  expectedQuantity: number
}

interface Session {
  id: number
  sessionCode: string
  warehouseId: number
  warehouseName: string
}

interface Terminal {
  id: number
  name: string
  warehouseId: number
  warehouseName: string
}

export default function InventoryCountPage() {
  const router = useRouter()
  const params = useParams()
  const terminalId = params.terminalId as string
  const searchInputRef = useRef<HTMLInputElement>(null)

  // State
  const [isOnline, setIsOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [countedProducts, setCountedProducts] = useState<CountedProduct[]>([])

  const [search, setSearch] = useState('')
  const [numpadValue, setNumpadValue] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Mobile: toggle between list view and input view
  const [mobileView, setMobileView] = useState<'input' | 'list'>('input')

  // Modal for pending products
  const [showPendingModal, setShowPendingModal] = useState(false)

  // Auto-save timer ref
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')

  // Online status
  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load terminal, session and products
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load terminal info
        const terminalRes = await fetch(`/api/market/pos/terminals/${terminalId}`)
        const terminalData = await terminalRes.json()
        if (!terminalData.success) throw new Error(terminalData.error || 'Error al cargar terminal')

        const terminalInfo = terminalData.data
        if (!terminalInfo) throw new Error('Terminal no encontrado')
        setTerminal(terminalInfo)

        // Load open session
        const sessionRes = await fetch(`/api/market/pos/sessions?terminalId=${terminalId}&status=open`)
        const sessionData = await sessionRes.json()
        if (!sessionData.success) throw new Error(sessionData.error || 'Error al cargar sesión')

        // Handle both array and object with sessions property
        const sessions = sessionData.data?.sessions || sessionData.data || []
        const sessionsArray = Array.isArray(sessions) ? sessions : []

        if (sessionsArray.length === 0) {
          throw new Error('No hay sesión abierta para este terminal')
        }

        const openSession = sessionsArray[0]
        setSession({
          id: openSession.id,
          sessionCode: openSession.sessionCode || `SES-${openSession.id}`,
          warehouseId: terminalInfo.warehouseId || openSession.warehouseId,
          warehouseName: terminalInfo.warehouseName || openSession.warehouseName || 'Almacén'
        })

        // Load products for the warehouse
        const warehouseId = terminalInfo.warehouseId || openSession.warehouseId
        if (warehouseId) {
          const productsRes = await fetch(`/api/market/pos/products?warehouseId=${warehouseId}`)
          const productsData = await productsRes.json()
          if (productsData.success && productsData.data) {
            // La API devuelve { data: { products: [...], categories: [...], ... } }
            const productsArray = Array.isArray(productsData.data.products) ? productsData.data.products : []
            setProducts(productsArray.map((p: { id: number; name: string; sku?: string; barcode?: string; price?: number; sellingPrice?: number; stock?: number; imageUrl?: string }) => ({
              id: p.id,
              name: p.name || 'Sin nombre',
              sku: p.sku || '',
              barcode: p.barcode || '',
              sellingPrice: p.price || p.sellingPrice || 0,
              stock: p.stock || 0,
              imageUrl: p.imageUrl || null
            })))
          }
        }

        // Load existing count if any
        const countRes = await fetch(`/api/market/pos/inventory-count?sessionId=${openSession.id}`)
        const countData = await countRes.json()
        if (countData.success && countData.data && countData.data.lines) {
          setCountedProducts(countData.data.lines.map((l: {
            productId: number
            productName: string
            productSku?: string
            productBarcode?: string
            productImage?: string
            unitPrice?: number
            countedQuantity: number
            expectedQuantity?: number
          }) => ({
            productId: l.productId,
            productName: l.productName || 'Producto',
            productSku: l.productSku || '',
            productBarcode: l.productBarcode || '',
            productImage: l.productImage || null,
            unitPrice: l.unitPrice || 0,
            countedQuantity: l.countedQuantity || 0,
            expectedQuantity: l.expectedQuantity || 0
          })))
        }

      } catch (err) {
        console.error('Error loading data:', err)
        setError(err instanceof Error ? err.message : 'Error al cargar datos')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [terminalId])

  // Auto-focus search input
  useEffect(() => {
    if (!loading && searchInputRef.current && !selectedProduct) {
      searchInputRef.current.focus()
    }
  }, [loading, selectedProduct])

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!search || search.length < 2) return []
    const searchLower = search.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      (p.sku && p.sku.toLowerCase().includes(searchLower)) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchLower))
    ).slice(0, 10)
  }, [products, search])

  // Calculate counting progress
  const countingProgress = useMemo(() => {
    const totalProducts = products.length
    const countedProductIds = new Set(countedProducts.map(cp => cp.productId))
    const countedCount = countedProductIds.size
    const remainingCount = totalProducts - countedCount
    const percentage = totalProducts > 0 ? Math.round((countedCount / totalProducts) * 100) : 0
    const isComplete = remainingCount === 0 && totalProducts > 0

    return {
      total: totalProducts,
      counted: countedCount,
      remaining: remainingCount,
      percentage,
      isComplete
    }
  }, [products, countedProducts])

  // Calculate pending products (not yet counted)
  const pendingProducts = useMemo(() => {
    const countedProductIds = new Set(countedProducts.map(cp => cp.productId))
    return products.filter(p => !countedProductIds.has(p.id))
  }, [products, countedProducts])

  // Auto-save effect - debounced save when countedProducts changes
  useEffect(() => {
    if (!session || countedProducts.length === 0) return

    const currentState = JSON.stringify(countedProducts)

    // Don't save if nothing changed
    if (currentState === lastSavedRef.current) return

    // Clear any pending save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Schedule auto-save after 2 seconds of inactivity
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch('/api/market/pos/inventory-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.id,
            warehouseId: session.warehouseId,
            lines: countedProducts,
            action: 'save'
          })
        })

        const data = await response.json()
        if (data.success) {
          lastSavedRef.current = currentState
          console.log('[AutoSave] Conteo guardado automáticamente')
        }
      } catch (err) {
        console.error('[AutoSave] Error:', err)
      }
    }, 2000)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [session, countedProducts])

  // Handle product selection from search
  const selectProduct = useCallback((product: Product) => {
    setSelectedProduct(product)
    setSearch('')
    setNumpadValue('')
    setMobileView('input')
  }, [])

  // Handle barcode scan - auto select product for counting
  const handleBarcodeScan = useCallback((barcode: string) => {
    // Search for product by exact barcode or SKU match
    const product = products.find(p =>
      p.barcode?.toLowerCase() === barcode.toLowerCase() ||
      p.sku?.toLowerCase() === barcode.toLowerCase()
    )

    if (product) {
      selectProduct(product)
    } else {
      setError(`Producto no encontrado: ${barcode}`)
      setTimeout(() => setError(null), 3000)
    }
  }, [products, selectProduct])

  // Barcode scanner detection hook
  useBarcodeScan({
    onScan: handleBarcodeScan,
    onError: (error) => console.warn('Barcode scan:', error),
    minLength: 3,
    maxTimeBetweenKeys: 50,
    enabled: !loading && !selectedProduct // Disable when product is selected (entering quantity)
  })

  // Handle numpad input
  const handleNumpad = useCallback((key: string) => {
    if (key === 'C') {
      setNumpadValue('')
    } else if (key === 'DEL') {
      setNumpadValue(prev => prev.slice(0, -1))
    } else if (key === 'ENTER') {
      if (selectedProduct && numpadValue) {
        const quantity = parseFloat(numpadValue)
        if (!isNaN(quantity) && quantity >= 0) {
          // Add or update counted product
          const existingIndex = countedProducts.findIndex(p => p.productId === selectedProduct.id)

          if (existingIndex >= 0) {
            // Update existing
            const updated = [...countedProducts]
            updated[existingIndex] = {
              ...updated[existingIndex],
              countedQuantity: quantity
            }
            setCountedProducts(updated)
          } else {
            // Add new
            setCountedProducts(prev => [{
              productId: selectedProduct.id,
              productName: selectedProduct.name,
              productSku: selectedProduct.sku,
              productBarcode: selectedProduct.barcode,
              productImage: selectedProduct.imageUrl,
              unitPrice: selectedProduct.sellingPrice,
              countedQuantity: quantity,
              expectedQuantity: selectedProduct.stock
            }, ...prev])
          }

          setSelectedProduct(null)
          setNumpadValue('')
          setEditingIndex(null)
          // Return focus to search
          setTimeout(() => searchInputRef.current?.focus(), 100)
        }
      }
    } else if (key === '.' && !numpadValue.includes('.')) {
      setNumpadValue(prev => prev + '.')
    } else if (key !== '.') {
      setNumpadValue(prev => prev.length < 10 ? prev + key : prev)
    }
  }, [selectedProduct, numpadValue, countedProducts])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedProduct) {
        if (e.key >= '0' && e.key <= '9') {
          handleNumpad(e.key)
        } else if (e.key === '.') {
          handleNumpad('.')
        } else if (e.key === 'Enter') {
          handleNumpad('ENTER')
        } else if (e.key === 'Backspace') {
          handleNumpad('DEL')
        } else if (e.key === 'Escape') {
          setSelectedProduct(null)
          setNumpadValue('')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedProduct, handleNumpad])

  // Remove counted product
  const removeCountedProduct = useCallback((index: number) => {
    setCountedProducts(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Edit counted product
  const editCountedProduct = useCallback((index: number) => {
    const product = countedProducts[index]
    const fullProduct = products.find(p => p.id === product.productId)
    if (fullProduct) {
      setSelectedProduct(fullProduct)
      setNumpadValue(product.countedQuantity.toString())
      setEditingIndex(index)
      setMobileView('input')
    }
  }, [countedProducts, products])

  // Save count progress
  const saveCount = useCallback(async () => {
    if (!session) return

    try {
      setSaving(true)
      const response = await fetch('/api/market/pos/inventory-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          warehouseId: session.warehouseId,
          lines: countedProducts,
          action: 'save'
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [session, countedProducts])

  // Go to report
  const goToReport = useCallback(async () => {
    if (!session || countedProducts.length === 0) return

    try {
      setSaving(true)
      // Save first
      const response = await fetch('/api/market/pos/inventory-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          warehouseId: session.warehouseId,
          lines: countedProducts,
          action: 'save'
        })
      })

      const data = await response.json()
      if (!data.success) throw new Error(data.error)

      // Navigate to report
      router.push(`/dashboard/market/pos/${terminalId}/count/report`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }, [session, countedProducts, terminalId, router])

  // Go back to POS
  const goBack = useCallback(() => {
    router.push(`/dashboard/market/pos/${terminalId}`)
  }, [router, terminalId])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Cargando datos...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !terminal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={goBack}
            className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 font-medium"
          >
            Volver al POS
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 lg:py-4">
          <div className="flex items-center gap-3 lg:gap-4">
            <motion.button
              onClick={goBack}
              className="p-2.5 hover:bg-gray-700 rounded-xl transition-colors bg-gray-700/50 lg:bg-gray-700/30"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <ChevronLeft className="w-5 h-5 lg:w-6 lg:h-6" />
            </motion.button>
            <div>
              <h1 className="hidden lg:block font-semibold text-lg">Conteo de Inventario</h1>
              <p className="text-sm lg:text-sm text-gray-400">{session?.warehouseName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile search input */}
            <div className="lg:hidden flex-1 relative max-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-blue-500 placeholder-gray-500"
                disabled={!!selectedProduct}
              />
            </div>

            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-yellow-500" />
            )}

            <motion.button
              onClick={() => setMobileView(mobileView === 'input' ? 'list' : 'input')}
              className="lg:hidden p-2.5 bg-gray-700 rounded-xl relative shadow-lg border border-gray-600"
              whileHover={{ scale: 1.05, backgroundColor: '#4B5563' }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <List className="w-5 h-5" />
              {countedProducts.length > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium shadow-md"
                >
                  {countedProducts.length}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>

        {/* Mobile search results dropdown */}
        {search && filteredProducts.length > 0 && !selectedProduct && (
          <div className="lg:hidden absolute left-0 right-0 top-full z-50 mx-3 mt-1 bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden max-h-64 overflow-auto">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => selectProduct(product)}
                className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-700 active:bg-gray-600 transition-colors border-b border-gray-700/50 last:border-0"
              >
                <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-gray-700">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-4 h-4 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="font-medium truncate text-sm">{product.name}</p>
                  <p className="text-xs text-gray-400 truncate">{product.sku || product.barcode || 'Sin código'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-3 sm:px-4 py-2 bg-red-900/50 border-b border-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm flex-1 truncate">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Counted products (hidden on mobile when in input view) */}
        <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 xl:w-96 border-r border-gray-700 flex-col bg-gray-850 relative`}>
          {/* Desktop search - compact above sidebar */}
          <div className="hidden lg:block p-3 border-b border-gray-700 relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar o escanear..."
                className="w-full pl-9 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500"
                disabled={!!selectedProduct}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {/* Desktop search results dropdown */}
            {search && filteredProducts.length > 0 && !selectedProduct && (
              <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-gray-800 rounded-xl border border-gray-700 shadow-2xl overflow-hidden max-h-64 overflow-auto">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => selectProduct(product)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-700 active:bg-gray-600 transition-colors border-b border-gray-700/50 last:border-0"
                  >
                    <div className="w-8 h-8 flex-shrink-0 rounded-md overflow-hidden bg-gray-700">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-3 h-3 text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="font-medium truncate text-sm">{product.name}</p>
                      <p className="text-xs text-gray-500 truncate">{product.sku || product.barcode}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-b border-gray-700 flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <ClipboardList className="w-4 h-4" />
              Contados
            </h2>
            <span className="text-xs bg-gray-700 px-2 py-1 rounded-full">{countedProducts.length}</span>
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-2">
            <AnimatePresence>
              {countedProducts.map((item, index) => (
                <motion.div
                  key={`${item.productId}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-gray-800 rounded-lg p-3"
                >
                  <div className="flex gap-3">
                    {/* Product image */}
                    <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-700">
                      {item.productImage ? (
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm sm:text-base">{item.productName}</p>
                      <p className="text-xs text-gray-400 truncate">{item.productSku || item.productBarcode || 'Sin código'}</p>
                      <p className="text-xl font-bold text-blue-400 mt-1">{item.countedQuantity}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => editCountedProduct(index)}
                        className="p-2 hover:bg-gray-700 rounded-lg text-blue-400 active:bg-gray-600"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeCountedProduct(index)}
                        className="p-2 hover:bg-gray-700 rounded-lg text-red-400 active:bg-gray-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {countedProducts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No hay productos contados</p>
                <p className="text-sm">Escanee o busque un producto</p>
              </div>
            )}
          </div>

          {/* Mobile: button to switch to input */}
          <div className="lg:hidden p-3 border-t border-gray-700">
            <button
              onClick={() => setMobileView('input')}
              className="w-full py-3 bg-blue-600 rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <Search className="w-5 h-5" />
              Agregar Producto
            </button>
          </div>
        </div>

        {/* Right panel - Numpad (hidden on mobile when in list view) */}
        <div className={`${mobileView === 'input' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col p-3 sm:p-4`}>
          {/* Selected product - Quantity input */}
          {selectedProduct && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col"
            >
              {/* Product info */}
              <div className="bg-gray-800 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
                <div className="flex gap-4">
                  {/* Product image */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-700">
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg sm:text-xl font-semibold truncate">{selectedProduct.name}</h3>
                        <p className="text-gray-400 text-sm truncate">{selectedProduct.sku || selectedProduct.barcode || 'Sin código'}</p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProduct(null)
                          setNumpadValue('')
                          setEditingIndex(null)
                        }}
                        className="p-2 hover:bg-gray-700 rounded-lg flex-shrink-0 ml-2"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quantity display */}
              <div className="bg-gray-800 rounded-xl p-4 mb-3 sm:mb-4 text-center">
                <p className="text-xs sm:text-sm text-gray-400 mb-2">CANTIDAD CONTADA</p>
                <div className="text-4xl sm:text-5xl font-bold text-blue-400 font-mono">
                  {numpadValue || '0'}
                </div>
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-4 gap-2 max-w-md mx-auto w-full">
                {['7', '8', '9', 'C', '4', '5', '6', 'DEL', '1', '2', '3', 'ENTER', '.', '0', '00', ''].map((key) => {
                  if (key === '') return <div key="empty" />

                  let bgColor = 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500'
                  let textColor = 'text-white'

                  if (key === 'C') {
                    bgColor = 'bg-red-600 hover:bg-red-500 active:bg-red-400'
                  } else if (key === 'DEL') {
                    bgColor = 'bg-amber-600 hover:bg-amber-500 active:bg-amber-400'
                  } else if (key === 'ENTER') {
                    bgColor = 'bg-blue-600 hover:bg-blue-500 active:bg-blue-400'
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => handleNumpad(key)}
                      className={`${bgColor} ${textColor} py-3 sm:py-4 rounded-xl text-lg sm:text-xl font-bold transition-all active:scale-95 flex items-center justify-center touch-manipulation`}
                    >
                      {key === 'DEL' ? <Delete className="w-5 h-5 sm:w-6 sm:h-6" /> :
                       key === 'ENTER' ? <CornerDownLeft className="w-5 h-5 sm:w-6 sm:h-6" /> :
                       key}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* Empty state when no product selected */}
          {!selectedProduct && (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center px-4">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium text-gray-400">Escanea o busca un producto</p>
                <p className="text-sm mt-1">Usa el buscador de arriba para agregar productos al conteo</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-3 sm:px-4 py-3 bg-gray-800 border-t border-gray-700">
        {/* Progress bar - clickable to show pending products */}
        <div className="mb-3">
          <button
            onClick={() => setShowPendingModal(true)}
            className="w-full h-5 bg-gray-700 rounded-full overflow-hidden relative group cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all"
            title={`${countingProgress.remaining} productos pendientes - Toca para ver`}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${countingProgress.percentage}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full ${countingProgress.isComplete ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-blue-600 to-blue-400'}`}
            />
            {/* Percentage label */}
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
              {countingProgress.percentage}%
            </span>
          </button>
          {countingProgress.remaining > 0 && (
            <p className="text-xs text-center text-gray-500 mt-1">
              Toca la barra para ver los {countingProgress.remaining} productos pendientes
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 justify-center sm:justify-start">
            <Package className="w-5 h-5 text-gray-400" />
            <span>
              <span className="font-bold text-lg sm:text-xl">{countingProgress.counted}</span>
              <span className="text-gray-400 ml-1 text-sm sm:text-base">/ {countingProgress.total} productos</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={saveCount}
              disabled={saving || countedProducts.length === 0}
              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2.5 bg-gray-700 rounded-xl font-medium hover:bg-gray-600 active:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span className="hidden sm:inline">Guardar</span>
            </button>

            <button
              onClick={goToReport}
              disabled={saving || !countingProgress.isComplete}
              title={!countingProgress.isComplete ? `Faltan ${countingProgress.remaining} productos por contar` : ''}
              className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 active:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              Ir al Reporte
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>

      {/* Pending Products Modal */}
      <AnimatePresence>
        {showPendingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPendingModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-gray-800 w-full sm:w-[500px] sm:max-w-[90vw] max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/95 sticky top-0">
                <div>
                  <h3 className="font-semibold text-lg">Productos Pendientes</h3>
                  <p className="text-sm text-gray-400">{pendingProducts.length} productos por contar</p>
                </div>
                <button
                  onClick={() => setShowPendingModal(false)}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="overflow-auto max-h-[60vh] p-2">
                {pendingProducts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Check className="w-12 h-12 mx-auto mb-2 text-green-500" />
                    <p className="font-medium text-green-400">¡Todos los productos contados!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingProducts.map((product) => (
                      <motion.button
                        key={product.id}
                        onClick={() => {
                          selectProduct(product)
                          setShowPendingModal(false)
                        }}
                        className="w-full bg-gray-700/50 hover:bg-gray-700 rounded-xl p-3 flex items-center gap-3 transition-colors text-left"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-600">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-xs text-gray-400 truncate">{product.sku || product.barcode || 'Sin código'}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
