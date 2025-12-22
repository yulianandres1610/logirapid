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

interface Product {
  id: number
  name: string
  sku: string
  barcode: string
  sellingPrice: number
  stock: number
}

interface CountedProduct {
  productId: number
  productName: string
  productSku: string
  productBarcode: string
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
            const productsArray = Array.isArray(productsData.data) ? productsData.data : []
            setProducts(productsArray.map((p: { id: number; name: string; sku?: string; barcode?: string; price?: number; sellingPrice?: number; stock?: number }) => ({
              id: p.id,
              name: p.name || 'Sin nombre',
              sku: p.sku || '',
              barcode: p.barcode || '',
              sellingPrice: p.price || p.sellingPrice || 0,
              stock: p.stock || 0
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
            unitPrice?: number
            countedQuantity: number
            expectedQuantity?: number
          }) => ({
            productId: l.productId,
            productName: l.productName || 'Producto',
            productSku: l.productSku || '',
            productBarcode: l.productBarcode || '',
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

  // Handle product selection from search
  const selectProduct = useCallback((product: Product) => {
    setSelectedProduct(product)
    setSearch('')
    setNumpadValue('')
  }, [])

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
      <header className="flex items-center justify-between px-3 sm:px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={goBack}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm sm:text-base truncate">
              <span className="hidden sm:inline">{terminal?.name} - </span>Conteo de Inventario
            </h1>
            <p className="text-xs text-gray-400 truncate">
              {session?.warehouseName} | {session?.sessionCode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {isOnline ? (
            <div className="flex items-center gap-1 text-green-500">
              <Wifi className="w-4 h-4" />
              <span className="text-xs hidden sm:inline">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-500">
              <WifiOff className="w-4 h-4" />
              <span className="text-xs hidden sm:inline">Offline</span>
            </div>
          )}

          {/* Mobile toggle button */}
          <button
            onClick={() => setMobileView(mobileView === 'input' ? 'list' : 'input')}
            className="lg:hidden p-2 bg-gray-700 rounded-lg relative"
          >
            <List className="w-5 h-5" />
            {countedProducts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {countedProducts.length}
              </span>
            )}
          </button>
        </div>
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
        <div className={`${mobileView === 'list' ? 'flex' : 'hidden'} lg:flex w-full lg:w-80 xl:w-96 border-r border-gray-700 flex-col bg-gray-850`}>
          <div className="p-3 sm:p-4 border-b border-gray-700">
            <h2 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
              <ClipboardList className="w-5 h-5" />
              Productos Contados ({countedProducts.length})
            </h2>
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
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm sm:text-base">{item.productName}</p>
                      <p className="text-xs text-gray-400 truncate">{item.productSku || item.productBarcode || 'Sin código'}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
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
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-blue-400">
                      {item.countedQuantity}
                    </span>
                    <span className="text-sm text-gray-400">
                      Stock: {item.expectedQuantity}
                    </span>
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

        {/* Right panel - Search and numpad (hidden on mobile when in list view) */}
        <div className={`${mobileView === 'input' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col p-3 sm:p-4`}>
          {/* Search input */}
          <div className="relative mb-3 sm:mb-4">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar o escanear producto..."
              className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 bg-gray-800 rounded-xl text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!!selectedProduct}
            />
          </div>

          {/* Search results */}
          {search && filteredProducts.length > 0 && !selectedProduct && (
            <div className="mb-3 sm:mb-4 bg-gray-800 rounded-xl overflow-hidden max-h-48 sm:max-h-64 overflow-auto">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => selectProduct(product)}
                  className="w-full px-3 sm:px-4 py-3 flex items-center justify-between hover:bg-gray-700 active:bg-gray-600 transition-colors border-b border-gray-700 last:border-0"
                >
                  <div className="text-left min-w-0 flex-1">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-sm text-gray-400 truncate">{product.sku || product.barcode || 'Sin código'}</p>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <p className="text-sm text-gray-400">Stock: {product.stock}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected product - Quantity input */}
          {selectedProduct && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col"
            >
              {/* Product info */}
              <div className="bg-gray-800 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
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
                    className="p-2 hover:bg-gray-700 rounded-lg flex-shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-2 text-sm text-gray-400">
                  Stock en sistema: <span className="text-white font-medium">{selectedProduct.stock}</span>
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
          {!selectedProduct && !search && (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Search className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 opacity-30" />
                <p className="text-base sm:text-lg">Busque o escanee un producto</p>
                <p className="text-sm">para agregar al conteo</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-3 sm:px-4 py-3 bg-gray-800 border-t border-gray-700">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 justify-center sm:justify-start">
            <Package className="w-5 h-5 text-gray-400" />
            <span>
              <span className="font-bold text-lg sm:text-xl">{countedProducts.length}</span>
              <span className="text-gray-400 ml-1 text-sm sm:text-base">productos</span>
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
              disabled={saving || countedProducts.length === 0}
              className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 active:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              Ir al Reporte
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
