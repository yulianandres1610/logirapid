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
  Delete
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
        if (!terminalData.success) throw new Error(terminalData.error)
        setTerminal(terminalData.data)

        // Load open session
        const sessionRes = await fetch(`/api/market/pos/sessions?terminalId=${terminalId}&status=open`)
        const sessionData = await sessionRes.json()
        if (!sessionData.success) throw new Error(sessionData.error)

        if (!sessionData.data || sessionData.data.length === 0) {
          throw new Error('No hay sesión abierta para este terminal')
        }

        const openSession = sessionData.data[0]
        setSession({
          id: openSession.id,
          sessionCode: openSession.sessionCode,
          warehouseId: terminalData.data.warehouseId,
          warehouseName: terminalData.data.warehouseName
        })

        // Load products for the warehouse
        const productsRes = await fetch(`/api/market/pos/products?warehouseId=${terminalData.data.warehouseId}`)
        const productsData = await productsRes.json()
        if (productsData.success) {
          setProducts(productsData.data.map((p: { id: number; name: string; sku: string; barcode: string; price: number; stock: number }) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || '',
            barcode: p.barcode || '',
            sellingPrice: p.price || 0,
            stock: p.stock || 0
          })))
        }

        // Load existing count if any
        const countRes = await fetch(`/api/market/pos/inventory-count?sessionId=${openSession.id}`)
        const countData = await countRes.json()
        if (countData.success && countData.data) {
          setCountedProducts(countData.data.lines.map((l: {
            productId: number
            productName: string
            productSku: string
            productBarcode: string
            unitPrice: number
            countedQuantity: number
            expectedQuantity: number
          }) => ({
            productId: l.productId,
            productName: l.productName,
            productSku: l.productSku,
            productBarcode: l.productBarcode,
            unitPrice: l.unitPrice,
            countedQuantity: l.countedQuantity,
            expectedQuantity: l.expectedQuantity
          })))
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar datos')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [terminalId])

  // Auto-focus search input
  useEffect(() => {
    if (!loading && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [loading, selectedProduct])

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!search) return []
    const searchLower = search.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(searchLower) ||
      p.sku?.toLowerCase().includes(searchLower) ||
      p.barcode?.toLowerCase().includes(searchLower)
    ).slice(0, 10)
  }, [products, search])

  // Handle product selection from search
  const selectProduct = useCallback((product: Product) => {
    setSelectedProduct(product)
    setSearch('')
    setNumpadValue('')
    // Focus will go to numpad
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
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
      </div>
    )
  }

  // Error state
  if (error && !terminal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={goBack}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
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
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold">{terminal?.name} - Conteo de Inventario</h1>
            <p className="text-sm text-gray-400">
              Almacén: {session?.warehouseName} | Sesión: {session?.sessionCode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isOnline ? (
            <div className="flex items-center gap-1 text-green-500">
              <Wifi className="w-4 h-4" />
              <span className="text-xs">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-500">
              <WifiOff className="w-4 h-4" />
              <span className="text-xs">Offline</span>
            </div>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/50 border-b border-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Counted products */}
        <div className="w-96 border-r border-gray-700 flex flex-col bg-gray-850">
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
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
                      <p className="font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-gray-400">{item.productSku || item.productBarcode}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => editCountedProduct(index)}
                        className="p-1.5 hover:bg-gray-700 rounded-lg text-blue-400"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeCountedProduct(index)}
                        className="p-1.5 hover:bg-gray-700 rounded-lg text-red-400"
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
        </div>

        {/* Right panel - Search and numpad */}
        <div className="flex-1 flex flex-col p-4">
          {/* Search input */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar o escanear producto..."
              className="w-full pl-12 pr-4 py-4 bg-gray-800 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!!selectedProduct}
            />
          </div>

          {/* Search results */}
          {search && filteredProducts.length > 0 && !selectedProduct && (
            <div className="mb-4 bg-gray-800 rounded-xl overflow-hidden max-h-64 overflow-auto">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => selectProduct(product)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-0"
                >
                  <div className="text-left">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-gray-400">{product.sku || product.barcode}</p>
                  </div>
                  <div className="text-right">
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
              <div className="bg-gray-800 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold">{selectedProduct.name}</h3>
                    <p className="text-gray-400">{selectedProduct.sku || selectedProduct.barcode}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedProduct(null)
                      setNumpadValue('')
                      setEditingIndex(null)
                    }}
                    className="p-2 hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-2 text-sm text-gray-400">
                  Stock en sistema: <span className="text-white font-medium">{selectedProduct.stock}</span>
                </div>
              </div>

              {/* Quantity display */}
              <div className="bg-gray-800 rounded-xl p-4 mb-4 text-center">
                <p className="text-sm text-gray-400 mb-2">CANTIDAD CONTADA</p>
                <div className="text-5xl font-bold text-blue-400 font-mono">
                  {numpadValue || '0'}
                </div>
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
                {['7', '8', '9', 'C', '4', '5', '6', 'DEL', '1', '2', '3', 'ENTER', '.', '0', '00', ''].map((key) => {
                  if (key === '') return <div key="empty" />

                  let bgColor = 'bg-gray-700 hover:bg-gray-600'
                  let textColor = 'text-white'

                  if (key === 'C') {
                    bgColor = 'bg-red-600 hover:bg-red-500'
                  } else if (key === 'DEL') {
                    bgColor = 'bg-amber-600 hover:bg-amber-500'
                  } else if (key === 'ENTER') {
                    bgColor = 'bg-blue-600 hover:bg-blue-500'
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => handleNumpad(key)}
                      className={`${bgColor} ${textColor} py-4 rounded-xl text-xl font-bold transition-all active:scale-95 flex items-center justify-center`}
                    >
                      {key === 'DEL' ? <Delete className="w-6 h-6" /> :
                       key === 'ENTER' ? <CornerDownLeft className="w-6 h-6" /> :
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
                <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Busque o escanee un producto</p>
                <p className="text-sm">para agregar al conteo</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 py-3 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Package className="w-5 h-5 text-gray-400" />
          <span>
            <span className="font-bold text-xl">{countedProducts.length}</span>
            <span className="text-gray-400 ml-1">productos contados</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={saveCount}
            disabled={saving || countedProducts.length === 0}
            className="px-4 py-2 bg-gray-700 rounded-lg font-medium hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar
          </button>

          <button
            onClick={goToReport}
            disabled={saving || countedProducts.length === 0}
            className="px-6 py-2 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Ir al Reporte
            <ChevronLeft className="w-5 h-5 rotate-180" />
          </button>
        </div>
      </footer>
    </div>
  )
}
