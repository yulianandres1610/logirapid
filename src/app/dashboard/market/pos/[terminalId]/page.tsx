'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Monitor,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  DollarSign,
  CreditCard,
  Banknote,
  Smartphone,
  User,
  LogOut,
  Maximize,
  Minimize,
  Wifi,
  WifiOff,
  Package,
  Tag,
  Percent,
  Delete,
  CornerDownLeft,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Receipt,
  Printer,
  ChevronLeft
} from 'lucide-react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import {
  saveProducts,
  saveCategories,
  getProducts as getCachedProducts,
  getCategories as getCachedCategories,
  getUnsyncedOrders
} from '@/lib/pos-db'
import { usePOSOffline } from '@/hooks/usePOSOffline'

interface Product {
  id: number
  name: string
  description: string
  sku: string
  barcode: string
  categoryId: number
  unit: string
  basePrice: number
  price: number
  costPrice: number
  taxRate: number
  imageUrl: string | null
  stock: number
  trackInventory: boolean
}

interface Category {
  id: number
  name: string
  parentId: number | null
  icon: string | null
  color: string | null
}

interface CartItem {
  product: Product
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  total: number
}

interface Session {
  id: number
  sessionCode: string
  openedAt: string
  openingCash: { usd: number; cup: number; mlc: number }
}

interface Terminal {
  id: number
  name: string
  warehouseId: number
  warehouseName: string
  allowPriceEdit: boolean
  allowDiscount: boolean
  maxDiscountPercent: number
  requireCustomer: boolean
  defaultCurrency: string
  acceptedCurrencies: string[]
}

type NumpadMode = 'quantity' | 'price' | 'discount'

export default function POSTerminalPage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const terminalId = params.terminalId as string

  // Data state
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [terminal, setTerminal] = useState<Terminal | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCartIndex, setSelectedCartIndex] = useState<number | null>(null)

  // UI state
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [numpadMode, setNumpadMode] = useState<NumpadMode>('quantity')
  const [numpadValue, setNumpadValue] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showCloseSessionModal, setShowCloseSessionModal] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [paymentCurrency, setPaymentCurrency] = useState<string>('USD')
  const [amountTendered, setAmountTendered] = useState<string>('')

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true)
    setIsOnline(navigator.onLine)
  }, [])

  // Fetch terminal, session and products (with offline support)
  useEffect(() => {
    if (!isClient) return

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Check if online
        if (navigator.onLine) {
          // ONLINE: Fetch from API and cache
          const productsRes = await fetch(`/api/market/pos/products?terminalId=${terminalId}`)
          const productsData = await productsRes.json()

          if (!productsData.success) {
            throw new Error(productsData.error || 'Error loading products')
          }

          setProducts(productsData.data.products)
          setCategories(productsData.data.categories)
          setTerminal(productsData.data.terminal)

          // Cache products, categories and terminal for offline use
          try {
            await saveProducts(productsData.data.products)
            await saveCategories(productsData.data.categories)
            // Cache terminal info
            localStorage.setItem(`pos_terminal_${terminalId}`, JSON.stringify(productsData.data.terminal))
            console.log('[POS] Products, categories and terminal cached for offline use')
          } catch (cacheError) {
            console.error('[POS] Error caching products:', cacheError)
          }

          // Check for open session
          const sessionsRes = await fetch(`/api/market/pos/sessions?terminalId=${terminalId}&status=open`)
          const sessionsData = await sessionsRes.json()

          if (sessionsData.success && sessionsData.data.sessions.length > 0) {
            const openSession = sessionsData.data.sessions[0]
            setSession({
              id: openSession.id,
              sessionCode: openSession.sessionCode,
              openedAt: openSession.openedAt,
              openingCash: openSession.openingCash
            })
            setPaymentCurrency(productsData.data.terminal?.defaultCurrency || 'USD')
          } else {
            // No open session, redirect back
            router.push('/dashboard/market/pos')
          }
        } else {
          // OFFLINE: Load from cache
          console.log('[POS] Offline mode - loading from cache')

          try {
            const cachedProducts = await getCachedProducts()
            const cachedCategories = await getCachedCategories()

            if (cachedProducts.length > 0) {
              // Convert cached format to Product format
              setProducts(cachedProducts.map(p => ({
                id: p.id,
                name: p.name,
                description: '',
                sku: p.sku,
                barcode: p.barcode,
                categoryId: p.categoryId,
                unit: 'unit',
                basePrice: p.price,
                price: p.price,
                costPrice: 0,
                taxRate: 0,
                imageUrl: p.imageUrl,
                stock: p.stock,
                trackInventory: p.trackInventory
              })))
              setCategories(cachedCategories.map(c => ({
                id: c.id,
                name: c.name,
                parentId: c.parentId,
                icon: null,
                color: null
              })))

              // Load terminal from localStorage
              const cachedTerminal = localStorage.getItem(`pos_terminal_${terminalId}`)
              if (cachedTerminal) {
                try {
                  setTerminal(JSON.parse(cachedTerminal))
                } catch {
                  // Use default terminal config
                  setTerminal({
                    id: parseInt(terminalId),
                    name: 'Terminal Offline',
                    warehouseId: 0,
                    warehouseName: '',
                    allowPriceEdit: false,
                    allowDiscount: true,
                    maxDiscountPercent: 100,
                    requireCustomer: false,
                    defaultCurrency: 'USD',
                    acceptedCurrencies: ['USD', 'CUP', 'MLC']
                  })
                }
              } else {
                // Use default terminal config for offline
                setTerminal({
                  id: parseInt(terminalId),
                  name: 'Terminal Offline',
                  warehouseId: 0,
                  warehouseName: '',
                  allowPriceEdit: false,
                  allowDiscount: true,
                  maxDiscountPercent: 100,
                  requireCustomer: false,
                  defaultCurrency: 'USD',
                  acceptedCurrencies: ['USD', 'CUP', 'MLC']
                })
              }

              // Load session from localStorage
              const cachedSession = localStorage.getItem('pos_session')
              if (cachedSession) {
                try {
                  setSession(JSON.parse(cachedSession))
                } catch {
                  // Create offline session
                  const offlineSession: Session = {
                    id: Date.now(),
                    sessionCode: `OFFLINE-${Date.now().toString(36).toUpperCase()}`,
                    openedAt: new Date().toISOString(),
                    openingCash: { usd: 0, cup: 0, mlc: 0 }
                  }
                  setSession(offlineSession)
                  localStorage.setItem('pos_session', JSON.stringify(offlineSession))
                }
              } else {
                // Create offline session if none exists
                const offlineSession: Session = {
                  id: Date.now(),
                  sessionCode: `OFFLINE-${Date.now().toString(36).toUpperCase()}`,
                  openedAt: new Date().toISOString(),
                  openingCash: { usd: 0, cup: 0, mlc: 0 }
                }
                setSession(offlineSession)
                localStorage.setItem('pos_session', JSON.stringify(offlineSession))
              }

              console.log('[POS] Offline mode ready with', cachedProducts.length, 'products')
            } else {
              setError('No hay productos en caché. Conéctate a internet primero para cargar productos.')
            }
          } catch (cacheError) {
            console.error('[POS] Error loading from cache:', cacheError)
            setError('Error al cargar datos offline.')
          }
        }

      } catch (err) {
        console.error('[POS] Error fetching data:', err)

        // Try loading from cache on error
        try {
          const cachedProducts = await getCachedProducts()
          const cachedCategories = await getCachedCategories()

          if (cachedProducts.length > 0) {
            setProducts(cachedProducts.map(p => ({
              id: p.id,
              name: p.name,
              description: '',
              sku: p.sku,
              barcode: p.barcode,
              categoryId: p.categoryId,
              unit: 'unit',
              basePrice: p.price,
              price: p.price,
              costPrice: 0,
              taxRate: 0,
              imageUrl: p.imageUrl,
              stock: p.stock,
              trackInventory: p.trackInventory
            })))
            setCategories(cachedCategories.map(c => ({
              id: c.id,
              name: c.name,
              parentId: c.parentId,
              icon: null,
              color: null
            })))

            // Load terminal
            const cachedTerminal = localStorage.getItem(`pos_terminal_${terminalId}`)
            if (cachedTerminal) {
              setTerminal(JSON.parse(cachedTerminal))
            } else {
              setTerminal({
                id: parseInt(terminalId),
                name: 'Terminal Offline',
                warehouseId: 0,
                warehouseName: '',
                allowPriceEdit: false,
                allowDiscount: true,
                maxDiscountPercent: 100,
                requireCustomer: false,
                defaultCurrency: 'USD',
                acceptedCurrencies: ['USD', 'CUP', 'MLC']
              })
            }

            // Load session
            const cachedSession = localStorage.getItem('pos_session')
            if (cachedSession) {
              setSession(JSON.parse(cachedSession))
            } else {
              const offlineSession: Session = {
                id: Date.now(),
                sessionCode: `OFFLINE-${Date.now().toString(36).toUpperCase()}`,
                openedAt: new Date().toISOString(),
                openingCash: { usd: 0, cup: 0, mlc: 0 }
              }
              setSession(offlineSession)
              localStorage.setItem('pos_session', JSON.stringify(offlineSession))
            }

            console.log('[POS] Loaded from cache after error')
            setError(null) // Clear error since we loaded from cache
          } else {
            setError('No hay productos en caché. Conéctate a internet primero.')
          }
        } catch {
          setError('Error al cargar el POS. Verifica tu conexión.')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [terminalId, router, isClient])

  // Cache session info when it changes
  useEffect(() => {
    if (session) {
      localStorage.setItem('pos_session', JSON.stringify(session))
    }
  }, [session])

  // Restore cart from URL params (when returning from payment page)
  useEffect(() => {
    const restoreCartData = searchParams.get('restoreCart')
    if (restoreCartData && products.length > 0) {
      try {
        const cartItems = JSON.parse(decodeURIComponent(restoreCartData))
        const restoredCart: CartItem[] = []

        for (const item of cartItems) {
          const product = products.find(p => p.id === item.productId)
          if (product) {
            restoredCart.push({
              product,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              discountAmount: item.discountAmount,
              total: item.total
            })
          }
        }

        if (restoredCart.length > 0) {
          setCart(restoredCart)
          // Clear the URL params to avoid restoring again on refresh
          router.replace(`/dashboard/market/pos/${terminalId}`, { scroll: false })
        }
      } catch (e) {
        console.error('Error restoring cart:', e)
      }
    }
  }, [searchParams, products, terminalId, router])

  // Online status and pending orders
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      // Try to sync when back online
      syncPendingOrders()
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    // Load pending orders count
    loadPendingOrdersCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load pending orders count from IndexedDB
  const loadPendingOrdersCount = async () => {
    try {
      const unsyncedOrders = await getUnsyncedOrders()
      const sessionOrders = session ? unsyncedOrders.filter(o => o.sessionId === session.id) : unsyncedOrders
      setPendingOrdersCount(sessionOrders.length)
    } catch (e) {
      console.error('[POS] Error loading pending orders count:', e)
    }
  }

  // Sync pending orders to server
  const syncPendingOrders = async () => {
    if (!isOnline || !session || isSyncing) return

    setIsSyncing(true)
    try {
      const unsyncedOrders = await getUnsyncedOrders()
      const sessionOrders = unsyncedOrders.filter(o => o.sessionId === session.id)

      if (sessionOrders.length === 0) {
        setIsSyncing(false)
        return
      }

      console.log(`[POS] Syncing ${sessionOrders.length} pending orders...`)

      const response = await fetch('/api/market/pos/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          orders: sessionOrders
        })
      })

      const data = await response.json()

      if (data.success) {
        console.log('[POS] Sync completed:', data.data)
        // Reload pending count after sync
        loadPendingOrdersCount()
      }
    } catch (e) {
      console.error('[POS] Error syncing orders:', e)
    } finally {
      setIsSyncing(false)
    }
  }

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  // Filter products
  const filteredProducts = useMemo(() => {
    let filtered = products

    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.sku?.toLowerCase().includes(searchLower) ||
        p.barcode?.toLowerCase().includes(searchLower)
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter(p => p.categoryId === selectedCategory)
    }

    return filtered
  }, [products, search, selectedCategory])

  // Cart calculations
  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const discounts = cart.reduce((sum, item) => sum + item.discountAmount, 0)
    const total = cart.reduce((sum, item) => sum + item.total, 0)
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
    return { subtotal, discounts, total, itemCount }
  }, [cart])

  // Add product to cart
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id)

      if (existingIndex >= 0) {
        const updated = [...prev]
        const item = updated[existingIndex]
        item.quantity += 1
        item.total = (item.quantity * item.unitPrice) - item.discountAmount
        setSelectedCartIndex(existingIndex)
        return updated
      } else {
        const newItem: CartItem = {
          product,
          quantity: 1,
          unitPrice: product.price,
          discountPercent: 0,
          discountAmount: 0,
          total: product.price
        }
        setSelectedCartIndex(prev.length)
        return [...prev, newItem]
      }
    })
    setNumpadValue('')
    setNumpadMode('quantity')
  }, [])

  // Update cart item
  const updateCartItem = useCallback((index: number, updates: Partial<CartItem>) => {
    setCart(prev => {
      const updated = [...prev]
      const item = { ...updated[index], ...updates }

      // Recalculate totals
      if (item.discountPercent > 0) {
        item.discountAmount = (item.quantity * item.unitPrice) * (item.discountPercent / 100)
      }
      item.total = (item.quantity * item.unitPrice) - item.discountAmount

      updated[index] = item
      return updated
    })
  }, [])

  // Remove from cart
  const removeFromCart = useCallback((index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
    setSelectedCartIndex(null)
  }, [])

  // Clear cart
  const clearCart = useCallback(() => {
    setCart([])
    setSelectedCartIndex(null)
    setNumpadValue('')
  }, [])

  // Numpad handler
  const handleNumpad = useCallback((key: string) => {
    if (key === 'C') {
      setNumpadValue('')
      return
    }

    if (key === 'DEL') {
      setNumpadValue(prev => prev.slice(0, -1))
      return
    }

    if (key === 'ENTER') {
      if (selectedCartIndex !== null && numpadValue) {
        const value = parseFloat(numpadValue)
        if (!isNaN(value) && value >= 0) {
          switch (numpadMode) {
            case 'quantity':
              updateCartItem(selectedCartIndex, { quantity: Math.max(1, value) })
              break
            case 'price':
              if (terminal?.allowPriceEdit) {
                updateCartItem(selectedCartIndex, { unitPrice: value })
              }
              break
            case 'discount':
              if (terminal?.allowDiscount) {
                const maxDiscount = terminal.maxDiscountPercent || 100
                updateCartItem(selectedCartIndex, { discountPercent: Math.min(value, maxDiscount) })
              }
              break
          }
        }
        setNumpadValue('')
      }
      return
    }

    // Validate input
    if (key === '.' && numpadValue.includes('.')) return
    if (numpadValue.length >= 10) return

    setNumpadValue(prev => prev + key)
  }, [selectedCartIndex, numpadValue, numpadMode, terminal, updateCartItem])

  // Process payment
  const processPayment = async () => {
    if (cart.length === 0 || !session) return

    setProcessingPayment(true)
    try {
      const tenderedAmount = parseFloat(amountTendered) || cartTotals.total
      const changeAmount = Math.max(0, tenderedAmount - cartTotals.total)

      const orderData = {
        sessionId: session.id,
        terminalId: parseInt(terminalId),
        warehouseId: terminal?.warehouseId,
        currency: paymentCurrency,
        lines: cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          productSku: item.product.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount
        })),
        payments: [{
          method: paymentMethod,
          amount: cartTotals.total,
          currency: paymentCurrency,
          amountTendered: paymentMethod === 'cash' ? tenderedAmount : null,
          changeAmount: paymentMethod === 'cash' ? changeAmount : null
        }]
      }

      const response = await fetch('/api/market/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      const data = await response.json()

      if (data.success) {
        // Clear cart and close modal
        clearCart()
        setShowPaymentModal(false)
        setAmountTendered('')
        // TODO: Print receipt option
      } else {
        alert(data.error || 'Error al procesar pago')
      }
    } catch (error) {
      console.error('Error processing payment:', error)
      alert('Error de conexión')
    } finally {
      setProcessingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
      )}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-500">Cargando punto de venta...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
      )}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/market/pos')}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'h-screen flex flex-col overflow-hidden',
      theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
    )}>
      {/* Header */}
      <header className={cn(
        'flex items-center justify-between px-4 py-3 border-b shadow-sm',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/market/pos')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
            )}>
              <Monitor className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{terminal?.name}</h1>
              <p className="text-xs text-gray-500">
                Sesión: {session?.sessionCode}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Online Status */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
            isOnline
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          )}>
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {isOnline ? 'Online' : 'Offline'}
            {isSyncing && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>

          {/* Pending Orders Badge */}
          {pendingOrdersCount > 0 && (
            <button
              onClick={syncPendingOrders}
              disabled={!isOnline || isSyncing}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all',
                isOnline
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 cursor-not-allowed'
              )}
            >
              <Clock className="w-4 h-4" />
              {pendingOrdersCount} pendiente{pendingOrdersCount !== 1 ? 's' : ''}
              {isOnline && !isSyncing && <span className="text-xs">(Sincronizar)</span>}
            </button>
          )}

          {/* Time */}
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-mono">
              {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* User */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-500" />
            <span className="text-sm">{user?.email?.split('@')[0]}</span>
          </div>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>

          {/* Close Session */}
          <button
            onClick={() => setShowCloseSessionModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Caja
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Cart */}
        <div className={cn(
          'w-[400px] flex flex-col border-r',
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        )}>
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <ShoppingCart className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">Carrito vacío</p>
                <p className="text-sm">Selecciona productos para agregar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item, index) => (
                  <motion.div
                    key={item.product.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => setSelectedCartIndex(index)}
                    className={cn(
                      'p-3 rounded-xl cursor-pointer transition-all',
                      selectedCartIndex === index
                        ? theme === 'dark'
                          ? 'bg-blue-900/30 border-2 border-blue-500'
                          : 'bg-blue-50 border-2 border-blue-500'
                        : theme === 'dark'
                        ? 'bg-gray-700/50 hover:bg-gray-700'
                        : 'bg-gray-50 hover:bg-gray-100'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.quantity} x ${item.unitPrice.toFixed(2)}
                        </p>
                        {item.discountPercent > 0 && (
                          <p className="text-xs text-green-500">
                            -{item.discountPercent}% (-${item.discountAmount.toFixed(2)})
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${item.total.toFixed(2)}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromCart(index) }}
                          className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded mt-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick quantity buttons */}
                    {selectedCartIndex === index && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (item.quantity > 1) {
                              updateCartItem(index, { quantity: item.quantity - 1 })
                            }
                          }}
                          className="p-2 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="flex-1 text-center font-bold text-lg">{item.quantity}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateCartItem(index, { quantity: item.quantity + 1 })
                          }}
                          className="p-2 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Numpad */}
          <div className={cn(
            'p-4 border-t',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            {/* Mode selector */}
            <div className="flex gap-2 mb-3">
              {[
                { mode: 'quantity' as NumpadMode, label: 'Cant.', icon: Package },
                { mode: 'price' as NumpadMode, label: 'Precio', icon: DollarSign, disabled: !terminal?.allowPriceEdit },
                { mode: 'discount' as NumpadMode, label: 'Desc.', icon: Percent, disabled: !terminal?.allowDiscount }
              ].map(({ mode, label, icon: Icon, disabled }) => (
                <button
                  key={mode}
                  disabled={disabled}
                  onClick={() => { setNumpadMode(mode); setNumpadValue('') }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium transition-all',
                    numpadMode === mode
                      ? 'bg-blue-500 text-white'
                      : disabled
                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 cursor-not-allowed'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Display */}
            <div className={cn(
              'px-4 py-3 rounded-xl mb-3 text-right text-2xl font-mono font-bold',
              theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
            )}>
              {numpadValue || '0'}
              {numpadMode === 'discount' && '%'}
              {numpadMode === 'price' && numpadValue && '$'}
            </div>

            {/* Numpad grid */}
            <div className="grid grid-cols-4 gap-2">
              {['7', '8', '9', 'C', '4', '5', '6', 'DEL', '1', '2', '3', 'ENTER', '.', '0', '00', ''].map((key, i) => {
                if (key === '') return <div key={i} />
                const isAction = ['C', 'DEL', 'ENTER'].includes(key)
                return (
                  <button
                    key={key}
                    onClick={() => handleNumpad(key)}
                    className={cn(
                      'py-4 rounded-xl font-bold text-lg transition-all active:scale-95',
                      key === 'ENTER'
                        ? 'bg-blue-500 text-white hover:bg-blue-600 row-span-1'
                        : key === 'C'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : key === 'DEL'
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600'
                        : 'bg-gray-200 hover:bg-gray-300'
                    )}
                  >
                    {key === 'DEL' ? <Delete className="w-5 h-5 mx-auto" /> :
                     key === 'ENTER' ? <CornerDownLeft className="w-5 h-5 mx-auto" /> : key}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cart Totals & Pay */}
          <div className={cn(
            'p-4 border-t',
            theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
          )}>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal ({cartTotals.itemCount} items)</span>
                <span>${cartTotals.subtotal.toFixed(2)}</span>
              </div>
              {cartTotals.discounts > 0 && (
                <div className="flex justify-between text-sm text-green-500">
                  <span>Descuentos</span>
                  <span>-${cartTotals.discounts.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-200 dark:border-gray-600">
                <span>Total</span>
                <span>${cartTotals.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className={cn(
                  'flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all',
                  cart.length === 0
                    ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 cursor-not-allowed'
                    : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                )}
              >
                <Trash2 className="w-5 h-5" />
                Vaciar
              </button>
              <button
                onClick={() => {
                  if (cart.length === 0 || !session) return
                  // Prepare cart data for payment page
                  const cartData = cart.map(item => ({
                    productId: item.product.id,
                    productName: item.product.name,
                    productSku: item.product.sku,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountPercent: item.discountPercent,
                    discountAmount: item.discountAmount,
                    total: item.total
                  }))
                  const params = new URLSearchParams({
                    cart: encodeURIComponent(JSON.stringify(cartData)),
                    sessionId: session.id.toString(),
                    warehouseId: terminal?.warehouseId?.toString() || ''
                  })
                  router.push(`/dashboard/market/pos/${terminalId}/payment?${params.toString()}`)
                }}
                disabled={cart.length === 0}
                className={cn(
                  'flex-[2] py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg',
                  cart.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-green-500/25'
                )}
              >
                <CreditCard className="w-5 h-5" />
                Cobrar ${cartTotals.total.toFixed(2)}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Products */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search & Categories */}
          <div className={cn(
            'p-4 border-b',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto o escanear código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all text-lg',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                    : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                )}
              />
            </div>

            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-all',
                  selectedCategory === null
                    ? 'bg-blue-500 text-white'
                    : theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                Todos
              </button>
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    'px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-all',
                    selectedCategory === category.id
                      ? 'bg-blue-500 text-white'
                      : theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Package className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">No hay productos</p>
                <p className="text-sm">Intenta con otra búsqueda</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {filteredProducts.map(product => (
                  <motion.button
                    key={product.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => addToCart(product)}
                    disabled={product.trackInventory && product.stock <= 0}
                    className={cn(
                      'relative p-4 rounded-xl text-left transition-all border',
                      product.trackInventory && product.stock <= 0
                        ? 'opacity-50 cursor-not-allowed'
                        : '',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700 hover:border-blue-500'
                        : 'bg-white border-gray-200 hover:border-blue-500 shadow-sm hover:shadow-md'
                    )}
                  >
                    {/* Product image or placeholder */}
                    <div className={cn(
                      'w-full aspect-square rounded-lg mb-3 flex items-center justify-center overflow-hidden',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-12 h-12 text-gray-400" />
                      )}
                    </div>

                    {/* Product info */}
                    <h3 className="font-medium text-sm line-clamp-2 mb-1">
                      {product.name}
                    </h3>
                    <p className="text-lg font-bold text-blue-500">
                      ${product.price.toFixed(2)}
                    </p>

                    {/* Stock indicator */}
                    {product.trackInventory && (
                      <p className={cn(
                        'text-xs mt-1',
                        product.stock <= 5
                          ? 'text-amber-500'
                          : 'text-gray-500'
                      )}>
                        Stock: {product.stock}
                      </p>
                    )}

                    {/* Out of stock overlay */}
                    {product.trackInventory && product.stock <= 0 && (
                      <div className="absolute inset-0 bg-gray-900/50 rounded-xl flex items-center justify-center">
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          Agotado
                        </span>
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !processingPayment && setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full max-w-lg rounded-2xl p-6 shadow-2xl',
                theme === 'dark' ? 'bg-gray-900' : 'bg-white'
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Cobrar ${cartTotals.total.toFixed(2)}</h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={processingPayment}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Payment Methods */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">Método de Pago</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: 'Efectivo', icon: Banknote },
                    { id: 'card', label: 'Tarjeta', icon: CreditCard },
                    { id: 'transfer', label: 'Transf.', icon: Smartphone },
                    { id: 'credit', label: 'Crédito', icon: User }
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setPaymentMethod(id)}
                      className={cn(
                        'py-3 rounded-xl flex flex-col items-center gap-1 transition-all',
                        paymentMethod === id
                          ? 'bg-blue-500 text-white'
                          : theme === 'dark'
                          ? 'bg-gray-800 hover:bg-gray-700'
                          : 'bg-gray-100 hover:bg-gray-200'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-3">Moneda</label>
                <div className="flex gap-2">
                  {(terminal?.acceptedCurrencies || ['USD', 'CUP', 'MLC']).map(currency => (
                    <button
                      key={currency}
                      onClick={() => setPaymentCurrency(currency)}
                      className={cn(
                        'flex-1 py-3 rounded-xl font-medium transition-all',
                        paymentCurrency === currency
                          ? 'bg-blue-500 text-white'
                          : theme === 'dark'
                          ? 'bg-gray-800 hover:bg-gray-700'
                          : 'bg-gray-100 hover:bg-gray-200'
                      )}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Tendered (for cash) */}
              {paymentMethod === 'cash' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-3">Monto Recibido</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    placeholder={cartTotals.total.toFixed(2)}
                    className={cn(
                      'w-full px-4 py-3 rounded-xl border text-xl font-mono focus:outline-none focus:ring-2',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700 focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />

                  {/* Quick amounts */}
                  <div className="flex gap-2 mt-2">
                    {[cartTotals.total, 20, 50, 100].map(amount => (
                      <button
                        key={amount}
                        onClick={() => setAmountTendered(amount.toString())}
                        className={cn(
                          'flex-1 py-2 rounded-lg text-sm font-medium',
                          theme === 'dark'
                            ? 'bg-gray-800 hover:bg-gray-700'
                            : 'bg-gray-100 hover:bg-gray-200'
                        )}
                      >
                        ${amount.toFixed(2)}
                      </button>
                    ))}
                  </div>

                  {/* Change */}
                  {amountTendered && parseFloat(amountTendered) > cartTotals.total && (
                    <div className={cn(
                      'mt-4 p-4 rounded-xl',
                      theme === 'dark' ? 'bg-green-900/30' : 'bg-green-50'
                    )}>
                      <p className="text-sm text-green-600 dark:text-green-400">Cambio</p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        ${(parseFloat(amountTendered) - cartTotals.total).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={processingPayment}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium',
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={processPayment}
                  disabled={processingPayment || (paymentMethod === 'cash' && parseFloat(amountTendered || '0') < cartTotals.total && amountTendered !== '')}
                  className={cn(
                    'flex-[2] py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg',
                    'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-green-500/25',
                    processingPayment && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Confirmar Pago
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close Session Modal */}
      <AnimatePresence>
        {showCloseSessionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                'w-full max-w-md rounded-2xl p-6 shadow-2xl',
                theme === 'dark' ? 'bg-gray-900' : 'bg-white'
              )}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                  <LogOut className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Cerrar Sesión de Caja</h3>
                  <p className="text-sm text-gray-500">{session?.sessionCode}</p>
                </div>
              </div>

              {cart.length > 0 && (
                <div className={cn(
                  'p-4 rounded-xl mb-4',
                  theme === 'dark' ? 'bg-amber-900/30 border border-amber-800' : 'bg-amber-50 border border-amber-200'
                )}>
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-medium">
                      Tienes {cart.length} productos en el carrito. Se perderán al cerrar.
                    </p>
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Para cerrar la caja necesitarás hacer el arqueo de efectivo. ¿Deseas continuar?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCloseSessionModal(false)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl font-medium',
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => router.push(`/dashboard/market/pos/${terminalId}/close`)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium shadow-lg shadow-red-500/25 hover:from-red-600 hover:to-red-700"
                >
                  Cerrar Caja
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
