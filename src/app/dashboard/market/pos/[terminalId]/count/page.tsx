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
  Warehouse,
  Camera
} from 'lucide-react'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'
import CameraBarcodeScanner from '@/components/barcode-scanner/CameraBarcodeScanner'

// Theme type for dynamic styling
type Theme = 'dark' | 'light'

// Get theme from localStorage (safe for offline)
const getThemeFromStorage = (): Theme => {
  if (typeof window === 'undefined') return 'dark'
  try {
    return (localStorage.getItem('theme') as Theme) || 'dark'
  } catch {
    return 'dark'
  }
}

// Theme-aware styles
const themeStyles = {
  dark: {
    bg: 'bg-gray-900',
    bgAlt: 'bg-gray-800',
    bgCard: 'bg-gray-800',
    text: 'text-white',
    textMuted: 'text-gray-400',
    border: 'border-gray-700',
    input: 'bg-gray-700 border-gray-600',
    inputAlt: 'bg-gray-900 border-gray-700',
    button: 'bg-gray-700 hover:bg-gray-600',
  },
  light: {
    bg: 'bg-gray-100',
    bgAlt: 'bg-white',
    bgCard: 'bg-white',
    text: 'text-gray-900',
    textMuted: 'text-gray-600',
    border: 'border-gray-300',
    input: 'bg-white border-gray-300',
    inputAlt: 'bg-gray-50 border-gray-300',
    button: 'bg-gray-200 hover:bg-gray-300',
  }
}

const getThemeClasses = (theme: Theme) => themeStyles[theme]

interface ProductVariant {
  id: number
  name: string
  sku: string
  barcode: string | null
  imageUrl: string | null
  costPrice: number
  sellingPrice: number
  stock: number
}

interface Product {
  id: number
  name: string
  sku: string
  barcode: string
  sellingPrice: number
  stock: number
  imageUrl: string | null
  variants?: ProductVariant[]
}

interface CountedProduct {
  productId: number
  variantId: number | null
  variantName: string | null
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
  const mobileSearchRef = useRef<HTMLInputElement>(null)

  // State
  const [isOnline, setIsOnline] = useState(true)
  const [theme, setTheme] = useState<Theme>('dark')
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
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // Modal for pending products
  const [showPendingModal, setShowPendingModal] = useState(false)

  // Camera scanner state (mobile only)
  const [showCameraScanner, setShowCameraScanner] = useState(false)

  // Auto-save timer ref
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')

  // Online status and theme
  useEffect(() => {
    setIsOnline(navigator.onLine)
    setTheme(getThemeFromStorage())

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    // Listen for theme changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue) {
        setTheme(e.newValue as Theme)
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('storage', handleStorageChange)
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
            const productsArray = Array.isArray(productsData.data.products) ? productsData.data.products : []
            setProducts(productsArray.map((p: {
              id: number
              name: string
              sku?: string
              barcode?: string
              price?: number
              sellingPrice?: number
              stock?: number
              imageUrl?: string
              hasVariants?: boolean
              variants?: Array<{
                id: number
                name: string
                sku: string
                barcode: string | null
                imageUrl: string | null
                costPrice?: number
                sellingPrice?: number
                price?: number
                stock: number
              }>
            }) => ({
              id: p.id,
              name: p.name || 'Sin nombre',
              sku: p.sku || '',
              barcode: p.barcode || '',
              sellingPrice: p.price || p.sellingPrice || 0,
              stock: p.stock || 0,
              imageUrl: p.imageUrl || null,
              variants: p.variants?.map(v => ({
                id: v.id,
                name: v.name,
                sku: v.sku,
                barcode: v.barcode,
                imageUrl: v.imageUrl,
                costPrice: v.costPrice || 0,
                sellingPrice: v.sellingPrice || v.price || 0,
                stock: v.stock || 0
              }))
            })))
          }
        }

        // Load existing count if any
        const countRes = await fetch(`/api/market/pos/inventory-count?sessionId=${openSession.id}`)
        const countData = await countRes.json()
        if (countData.success && countData.data && countData.data.lines) {
          const loadedProducts = countData.data.lines.map((l: {
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
          }))
          setCountedProducts(loadedProducts)
          lastSavedRef.current = JSON.stringify(loadedProducts)
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

  // Auto-focus search input (desktop only - don't open keyboard on mobile)
  useEffect(() => {
    if (!loading && !selectedProduct) {
      const isMobile = window.innerWidth < 1024
      // Only auto-focus on desktop to support keyboard barcode scanners
      if (!isMobile && searchInputRef.current) {
        searchInputRef.current.focus()
      }
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
    if (!session) return

    const currentState = JSON.stringify(countedProducts)

    // Don't save if nothing changed
    if (currentState === lastSavedRef.current) return

    // Don't save empty array if we never had anything (initial state)
    if (countedProducts.length === 0 && lastSavedRef.current === '') return

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
  }, [])

  // Handle barcode scan - auto select product for counting
  const handleBarcodeScan = useCallback((barcode: string) => {
    const lowerBarcode = barcode.toLowerCase()

    // First search in products
    let product = products.find(p =>
      p.barcode?.toLowerCase() === lowerBarcode ||
      p.sku?.toLowerCase() === lowerBarcode
    )

    // If not found, search in variants
    let foundVariant: ProductVariant | null = null
    if (!product) {
      for (const p of products) {
        if (p.variants) {
          const variant = p.variants.find(v =>
            v.barcode?.toLowerCase() === lowerBarcode ||
            v.sku?.toLowerCase() === lowerBarcode
          )
          if (variant) {
            product = p
            foundVariant = variant
            break
          }
        }
      }
    }

    if (product) {
      setSelectedProduct(product)
      setSelectedVariant(foundVariant)
      setSearch('')
      setNumpadValue('')
    } else {
      setError(`Producto no encontrado: ${barcode}`)
      setTimeout(() => setError(null), 3000)
    }
  }, [products])

  // Barcode scanner detection hook - works with physical scanners (keyboard emulation)
  useBarcodeScan({
    onScan: handleBarcodeScan,
    onError: (error) => console.warn('Barcode scan:', error),
    minLength: 3,
    maxTimeBetweenKeys: 100, // Increased for slower physical scanners on phones
    enabled: !loading && !selectedProduct
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
          const variantId = selectedVariant?.id || null

          const existingIndex = countedProducts.findIndex(p =>
            p.productId === selectedProduct.id && p.variantId === variantId
          )

          if (existingIndex >= 0) {
            const updated = [...countedProducts]
            updated[existingIndex] = {
              ...updated[existingIndex],
              countedQuantity: quantity
            }
            setCountedProducts(updated)
          } else {
            const productName = selectedVariant
              ? `${selectedProduct.name} - ${selectedVariant.name}`
              : selectedProduct.name
            const productSku = selectedVariant?.sku || selectedProduct.sku
            const productBarcode = selectedVariant?.barcode || selectedProduct.barcode
            const expectedStock = selectedVariant?.stock ?? selectedProduct.stock

            // Use variant image/price if available, otherwise fallback to product
            const productImage = selectedVariant?.imageUrl || selectedProduct.imageUrl
            const unitPrice = selectedVariant?.sellingPrice ?? selectedProduct.sellingPrice

            setCountedProducts(prev => [{
              productId: selectedProduct.id,
              variantId: variantId,
              variantName: selectedVariant?.name || null,
              productName: productName,
              productSku: productSku,
              productBarcode: productBarcode,
              productImage: productImage,
              unitPrice: unitPrice,
              countedQuantity: quantity,
              expectedQuantity: expectedStock
            }, ...prev])
          }

          setSelectedProduct(null)
          setSelectedVariant(null)
          setNumpadValue('')
          setEditingIndex(null)
          // Don't auto-focus search on mobile to avoid opening keyboard
        }
      }
    } else if (key === '.' && !numpadValue.includes('.')) {
      setNumpadValue(prev => prev + '.')
    } else if (key !== '.') {
      setNumpadValue(prev => prev.length < 10 ? prev + key : prev)
    }
  }, [selectedProduct, selectedVariant, numpadValue, countedProducts])

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
          setSelectedVariant(null)
          setNumpadValue('')
          setEditingIndex(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedProduct, handleNumpad])

  // Remove counted product
  const removeCountedProduct = useCallback(async (index: number) => {
    const productToRemove = countedProducts[index]

    if (selectedProduct && productToRemove && selectedProduct.id === productToRemove.productId) {
      setSelectedProduct(null)
      setNumpadValue('')
      setEditingIndex(null)
    }

    const newProducts = countedProducts.filter((_, i) => i !== index)
    setCountedProducts(newProducts)

    // Save immediately after deletion
    if (session) {
      try {
        const response = await fetch('/api/market/pos/inventory-count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.id,
            warehouseId: session.warehouseId,
            lines: newProducts,
            action: 'save'
          })
        })
        const data = await response.json()
        if (data.success) {
          lastSavedRef.current = JSON.stringify(newProducts)
          console.log('[Delete] Producto eliminado y guardado')
        }
      } catch (err) {
        console.error('[Delete] Error al guardar:', err)
      }
    }
  }, [countedProducts, selectedProduct, session])

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

  // Theme classes
  const tc = getThemeClasses(theme)

  // Loading state
  if (loading) {
    const loadingBg = getThemeFromStorage() === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
    const loadingText = getThemeFromStorage() === 'dark' ? 'text-gray-400' : 'text-gray-600'
    return (
      <div className={`min-h-screen flex items-center justify-center ${loadingBg}`}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className={loadingText}>Cargando datos...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !terminal) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tc.bg} ${tc.text} p-4`}>
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
    <div className={`h-screen h-[100dvh] flex flex-col overflow-hidden ${tc.bg} ${tc.text}`}>
      {/* CSS to prevent iOS zoom on input focus and fix tall screen layouts */}
      <style jsx global>{`
        /* Prevent iOS zoom on input focus */
        @supports (-webkit-touch-callout: none) {
          input, select, textarea {
            font-size: 16px !important;
          }
        }
        /* Prevent double-tap zoom */
        * {
          touch-action: manipulation;
        }
        /* Ensure numpad buttons don't trigger zoom */
        .numpad-btn {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        /* Fix for tall screens like Galaxy A26 */
        @supports (height: 100dvh) {
          .count-container {
            height: 100dvh;
          }
        }
      `}</style>

      {/* Header - Fixed at top, never scrolls */}
      <header className={`${tc.bgAlt} border-b ${tc.border} fixed top-0 left-0 right-0 z-40`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* Mobile Header - Compact for tall screens like Galaxy A26 */}
        <div className="lg:hidden flex items-center h-[56px] sm:h-[64px] px-1.5 sm:px-2">
          {/* Back button */}
          <motion.button
            onClick={goBack}
            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl hover:bg-gray-700/50 active:bg-gray-700 transition-colors flex-shrink-0"
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </motion.button>

          {/* Warehouse info - hidden on very small screens */}
          <div className="hidden xs:flex items-center gap-1 min-w-0 px-1">
            <Warehouse className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <span className="text-xs truncate max-w-[60px] sm:max-w-[80px] text-gray-300">{session?.warehouseName}</span>
          </div>

          {/* Search input */}
          <div className="flex-1 relative mx-1.5 sm:mx-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            <input
              ref={mobileSearchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className={`w-full pl-8 sm:pl-10 pr-2 py-2 sm:py-2.5 ${tc.inputAlt} rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 border border-gray-600`}
              disabled={!!selectedProduct}
            />
          </div>

          {/* Camera scanner button */}
          <motion.button
            onClick={() => setShowCameraScanner(true)}
            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl hover:bg-gray-700/50 active:bg-gray-700 transition-colors flex-shrink-0"
            whileTap={{ scale: 0.95 }}
            title="Escanear con cámara"
          >
            <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
          </motion.button>

          {/* Status indicator */}
          <div className="w-8 sm:w-10 flex items-center justify-center flex-shrink-0">
            {isOnline ? (
              <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
            )}
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <motion.button
              onClick={goBack}
              className="p-2.5 hover:bg-gray-700 rounded-xl transition-colors bg-gray-700/30 active:scale-95"
              whileTap={{ scale: 0.95 }}
            >
              <ChevronLeft className="w-6 h-6" />
            </motion.button>
            <div className="min-w-0">
              <h1 className="font-semibold text-lg">Conteo de Inventario</h1>
              <div className="flex items-center gap-1.5 text-sm text-gray-400">
                <Warehouse className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{session?.warehouseName}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-yellow-500" />
            )}
          </div>
        </div>

        {/* Mobile search results dropdown */}
        {search && filteredProducts.length > 0 && !selectedProduct && (
          <div className="lg:hidden absolute left-0 right-0 top-full z-50 bg-gray-800 border-b border-gray-700 shadow-2xl overflow-hidden max-h-[50vh] overflow-auto">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => selectProduct(product)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700 active:bg-gray-600 transition-colors border-b border-gray-700/50 last:border-0 touch-manipulation"
              >
                <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gray-700">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="font-medium truncate text-sm sm:text-base">{product.name}</p>
                  <p className="text-xs sm:text-sm text-gray-400 truncate">{product.sku || product.barcode || 'Sin codigo'}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Spacer for fixed header - includes safe area */}
      <div className="flex-shrink-0 h-[56px] sm:h-[64px] lg:h-[73px]" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }} />

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

      {/* Main content - dynamic padding for footer */}
      <div className="flex-1 flex overflow-hidden" style={{ paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>
        {/* Desktop: Left panel - Counted products (only visible on desktop) */}
        <div className="hidden lg:flex w-[340px] xl:w-[400px] 2xl:w-[450px] border-r border-gray-700 flex-col bg-gray-850 relative">
          {/* Desktop search */}
          <div className="p-3 border-b border-gray-700 relative">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar o escanear..."
                className={`w-full pl-9 pr-8 py-2.5 ${tc.inputAlt} rounded-lg text-base focus:outline-none focus:border-blue-500 placeholder-gray-500`}
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

          <div className="flex-1 overflow-auto p-3 space-y-2 overscroll-contain">
            <AnimatePresence>
              {countedProducts.map((item, index) => (
                <motion.div
                  key={`desktop-${item.productId}-${index}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-gray-800 rounded-xl p-4"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gray-700">
                      {item.productImage ? (
                        <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.productName}</p>
                      <p className="text-xs text-gray-400 truncate">{item.productSku || 'Sin codigo'}</p>
                      <p className="text-2xl font-bold text-blue-400 mt-1">{item.countedQuantity}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => editCountedProduct(index)} className="p-2.5 hover:bg-gray-700 rounded-xl text-blue-400">
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button onClick={() => removeCountedProduct(index)} className="p-2.5 hover:bg-gray-700 rounded-xl text-red-400">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {countedProducts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-gray-400">No hay productos contados</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile & Desktop: Main panel */}
        <div className="flex flex-1 flex-col">
          {/* When product is selected: show numpad */}
          {selectedProduct && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col p-2 sm:p-3 lg:p-6 xl:p-8 max-w-2xl mx-auto w-full overflow-auto"
            >
              {/* Product info - compact on mobile */}
              <div className="bg-gray-800 rounded-xl p-2.5 sm:p-3 lg:p-5 mb-2 sm:mb-3 lg:mb-5 flex-shrink-0">
                <div className="flex gap-3 lg:gap-6">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 lg:w-28 lg:h-28 flex-shrink-0 rounded-xl overflow-hidden bg-gray-700">
                    {/* Show variant image if selected, otherwise product image */}
                    {(selectedVariant?.imageUrl || selectedProduct.imageUrl) ? (
                      <img
                        src={selectedVariant?.imageUrl || selectedProduct.imageUrl || ''}
                        alt={selectedVariant?.name || selectedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg lg:text-xl font-semibold truncate">
                          {selectedVariant ? `${selectedProduct.name} - ${selectedVariant.name}` : selectedProduct.name}
                        </h3>
                        <p className="text-gray-400 text-xs sm:text-sm truncate">
                          {selectedVariant?.sku || selectedProduct.sku || selectedVariant?.barcode || selectedProduct.barcode || 'Sin codigo'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 sm:mt-1">
                          Stock: {selectedVariant?.stock ?? selectedProduct.stock}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedProduct(null)
                          setSelectedVariant(null)
                          setNumpadValue('')
                          setEditingIndex(null)
                        }}
                        className="p-1.5 sm:p-2 hover:bg-gray-700 rounded-lg flex-shrink-0 ml-1"
                      >
                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Variant selector - compact on mobile */}
                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-700">
                    <p className="text-[10px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">Variante:</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {selectedProduct.variants.map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() => setSelectedVariant(variant)}
                          className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all ${
                            selectedVariant?.id === variant.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          }`}
                        >
                          {variant.imageUrl && (
                            <img
                              src={variant.imageUrl}
                              alt={variant.name}
                              className="w-5 h-5 sm:w-6 sm:h-6 rounded object-cover"
                            />
                          )}
                          <span className="text-xs sm:text-sm font-medium">{variant.name}</span>
                          <span className="text-[10px] sm:text-xs opacity-70">({variant.stock})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quantity display - compact on mobile */}
              <div className="bg-gray-800 rounded-xl p-3 sm:p-4 lg:p-6 mb-2 sm:mb-3 lg:mb-5 text-center flex-shrink-0">
                <p className="text-[10px] sm:text-xs lg:text-base text-gray-400 mb-1 sm:mb-2 lg:mb-3">CANTIDAD CONTADA</p>
                <div className="text-3xl sm:text-4xl lg:text-6xl font-bold text-blue-400 font-mono">
                  {numpadValue || '0'}
                </div>
              </div>

              {/* Numpad - optimized for tall mobile screens */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:gap-3 max-w-lg mx-auto w-full flex-shrink-0">
                {['7', '8', '9', 'C', '4', '5', '6', 'DEL', '1', '2', '3', 'ENTER', '.', '0', '00', ''].map((key) => {
                  if (key === '') return <div key="empty" />

                  let bgColor = 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500'
                  if (key === 'C') bgColor = 'bg-red-600 hover:bg-red-500 active:bg-red-400'
                  else if (key === 'DEL') bgColor = 'bg-amber-600 hover:bg-amber-500 active:bg-amber-400'
                  else if (key === 'ENTER') bgColor = 'bg-blue-600 hover:bg-blue-500 active:bg-blue-400'

                  return (
                    <button
                      key={key}
                      onClick={() => handleNumpad(key)}
                      className={`${bgColor} text-white py-2.5 sm:py-3 lg:py-5 rounded-xl text-base sm:text-lg lg:text-2xl font-bold transition-all active:scale-95 flex items-center justify-center touch-manipulation`}
                    >
                      {key === 'DEL' ? <Delete className="w-4 h-4 sm:w-5 sm:h-5 lg:w-7 lg:h-7" /> :
                       key === 'ENTER' ? <CornerDownLeft className="w-4 h-4 sm:w-5 sm:h-5 lg:w-7 lg:h-7" /> : key}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* When no product selected: show list of counted products (mobile) or empty state (desktop) */}
          {!selectedProduct && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile: Show counted products list */}
              <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
                {countedProducts.length > 0 ? (
                  <>
                    <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                      <h2 className="font-semibold flex items-center gap-2">
                        <ClipboardList className="w-5 h-5" />
                        Productos Contados
                      </h2>
                      <span className="text-sm bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-medium">
                        {countedProducts.length}
                      </span>
                    </div>
                    <div className="flex-1 overflow-auto p-3 space-y-2 overscroll-contain">
                      <AnimatePresence>
                        {countedProducts.map((item, index) => (
                          <motion.div
                            key={`mobile-${item.productId}-${index}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-gray-800 rounded-xl p-3"
                          >
                            <div className="flex gap-3">
                              <div className="w-14 h-14 flex-shrink-0 rounded-xl overflow-hidden bg-gray-700">
                                {item.productImage ? (
                                  <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-6 h-6 text-gray-500" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate text-sm">{item.productName}</p>
                                <p className="text-xs text-gray-400 truncate">{item.productSku || 'Sin codigo'}</p>
                                <p className="text-xl font-bold text-blue-400 mt-0.5">{item.countedQuantity}</p>
                              </div>
                              <div className="flex flex-col gap-1 flex-shrink-0">
                                <button onClick={() => editCountedProduct(index)} className="p-2 hover:bg-gray-700 rounded-lg text-blue-400 touch-manipulation">
                                  <Edit3 className="w-5 h-5" />
                                </button>
                                <button onClick={() => removeCountedProduct(index)} className="p-2 hover:bg-gray-700 rounded-lg text-red-400 touch-manipulation">
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center">
                      <Package className="w-20 h-20 mx-auto mb-4 opacity-20 text-gray-500" />
                      <p className="text-lg font-medium text-gray-400">Escanea o busca un producto</p>
                      <p className="text-sm mt-2 text-gray-500 max-w-xs mx-auto">Usa el buscador o el escáner de cámara para agregar productos</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop: Empty state (list is in left panel) */}
              <div className="hidden lg:flex flex-1 items-center justify-center p-4">
                <div className="text-center">
                  <Package className="w-20 h-20 mx-auto mb-4 opacity-20 text-gray-500" />
                  <p className="text-lg font-medium text-gray-400">Selecciona un producto</p>
                  <p className="text-sm mt-2 text-gray-500 max-w-xs mx-auto">Busca o escanea un producto para ingresar la cantidad</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Fixed at bottom, compact on mobile for tall screens */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-gray-800 border-t border-gray-700" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {/* Progress bar - clickable to show pending products */}
        <div className="px-3 sm:px-4 lg:px-6 pt-2 pb-1.5 sm:pt-2.5 sm:pb-2">
          <div className="lg:max-w-4xl lg:mx-auto">
            <button
              onClick={() => setShowPendingModal(true)}
              className="w-full h-5 sm:h-6 bg-gray-700 rounded-full overflow-hidden relative group cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all active:scale-[0.99] touch-manipulation"
              title={`${countingProgress.remaining} productos pendientes - Toca para ver`}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${countingProgress.percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full ${countingProgress.isComplete ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-blue-600 to-blue-400'}`}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white drop-shadow-md">
                {countingProgress.percentage}% ({countingProgress.remaining} pendientes)
              </span>
            </button>
          </div>
        </div>

        <div className="px-3 sm:px-4 lg:px-6 pb-2 sm:pb-3">
          <div className="flex flex-row items-center justify-between gap-2 lg:max-w-4xl lg:mx-auto">
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6 text-gray-400" />
              <span className="text-xs sm:text-sm lg:text-base">
                <span className="font-bold text-sm sm:text-base lg:text-2xl">{countingProgress.counted}</span>
                <span className="text-gray-400 ml-0.5 text-[10px] sm:text-xs lg:text-lg">/ {countingProgress.total}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-4">
              <button
                onClick={saveCount}
                disabled={saving || countedProducts.length === 0}
                className="px-2.5 sm:px-3 lg:px-5 py-2 sm:py-2.5 lg:py-3 bg-gray-700 rounded-xl font-medium hover:bg-gray-600 active:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm lg:text-base touch-manipulation active:scale-[0.98]"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 animate-spin" /> : <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />}
                <span className="hidden sm:inline">Guardar</span>
              </button>

              <button
                onClick={goToReport}
                disabled={saving || countedProducts.length === 0}
                className="px-3 sm:px-4 lg:px-8 py-2 sm:py-2.5 lg:py-3 bg-blue-600 rounded-xl font-semibold hover:bg-blue-500 active:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm lg:text-lg shadow-lg shadow-blue-600/20 touch-manipulation active:scale-[0.98]"
              >
                <span>Reporte</span>
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-6 lg:h-6" />
              </button>
            </div>
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
              className="bg-gray-800 w-full sm:w-[500px] lg:w-[600px] sm:max-w-[90vw] max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden"
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
                    <p className="font-medium text-green-400">Todos los productos contados!</p>
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
                          <p className="text-xs text-gray-400 truncate">{product.sku || product.barcode || 'Sin codigo'}</p>
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

      {/* Camera Barcode Scanner - Mobile */}
      <CameraBarcodeScanner
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleBarcodeScan}
        onError={(error) => {
          console.warn('Camera scan error:', error)
          setError(error)
          setTimeout(() => setError(null), 3000)
        }}
      />
    </div>
  )
}
