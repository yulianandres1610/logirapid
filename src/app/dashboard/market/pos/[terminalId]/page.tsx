'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  ChevronLeft,
  ClipboardList,
  Menu,
  ChevronUp,
  ChevronDown,
  Lock,
  Eye,
  EyeOff,
  Info,
  Warehouse,
  MapPin,
  RefreshCw,
  Barcode,
  Scan
} from 'lucide-react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { ProductImage, ProductImageSquare } from '@/components/market/ProductImage'
import {
  saveProducts,
  saveCategories,
  getProducts as getCachedProducts,
  getCategories as getCachedCategories,
  getUnsyncedOrders
} from '@/lib/pos-db'
import { usePOSOffline } from '@/hooks/usePOSOffline'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'
import { VariantSelectorModal, Variant } from '@/components/market/VariantSelectorModal'
import { CashierLoginModal, AuthenticatedEmployee } from '@/components/market/pos/CashierLoginModal'

interface PriceTier {
  minQuantity: number
  priceType: string
  fixedPrice?: number
  discountPercent?: number
  discountAmount?: number
}

interface ProductVariant {
  id: number
  name: string
  sku: string
  barcode: string
  price: number
  stock: number
  totalStock?: number
  imageUrl: string | null
}

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
  totalStockAllWarehouses?: number
  trackInventory: boolean
  hasVariants: boolean
  variants?: ProductVariant[]
  priceTiers?: PriceTier[]
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
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  variantBarcode: string | null
  quantity: number
  unitPrice: number
  originalPrice: number
  pricelistApplied: boolean
  pricelistTierLabel?: string
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

interface WarehouseStock {
  warehouseId: number
  warehouseName: string
  warehouseCode: string
  stock: number
  isCurrentWarehouse: boolean
}

// Convertir a CUP (redondeado a entero - requisito Cuba)
const toCUP = (amountUSD: number, rate: number): number => Math.round(amountUSD * rate)
// Formatear CUP como entero (sin decimales - requisito Cuba)
const formatCUP = (amount: number): string => Math.round(amount).toLocaleString('es-ES')

export default function POSTerminalPage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  // USD_CUP = ElToque (tasa única de referencia)
  const { USD_CUP, USD_MLC } = useMarketExchangeRates()
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
  const [mounted, setMounted] = useState(false)

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
  const [isRefreshingProducts, setIsRefreshingProducts] = useState(false)

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [paymentCurrency, setPaymentCurrency] = useState<string>('USD')
  const [amountTendered, setAmountTendered] = useState<string>('')

  // Mobile responsive state
  const [showMobileCart, setShowMobileCart] = useState(false)

  // Password confirmation modal state (security feature)
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false)
  const [exitPassword, setExitPassword] = useState('')
  const [exitPasswordError, setExitPasswordError] = useState<string | null>(null)
  const [verifyingPassword, setVerifyingPassword] = useState(false)
  const [showExitPassword, setShowExitPassword] = useState(false)
  const [exitDestination, setExitDestination] = useState<string>('/dashboard/market/pos')
  const [exitActionLabel, setExitActionLabel] = useState<string>('Salir del POS')

  // Variant selection modal state
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)

  // Product details modal state
  const [showProductDetailsModal, setShowProductDetailsModal] = useState(false)
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null)
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([])
  const [loadingStocks, setLoadingStocks] = useState(false)

  // Cache for product stock data (reduces API calls)
  const stockCacheRef = useRef<Map<number, { data: WarehouseStock[], timestamp: number }>>(new Map())
  const STOCK_CACHE_TTL = 30000 // 30 seconds

  // Cashier authentication state
  const [authenticatedEmployee, setAuthenticatedEmployee] = useState<AuthenticatedEmployee | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Check for existing authenticated employee on mount
  useEffect(() => {
    const storedEmployee = sessionStorage.getItem(`pos_employee_${terminalId}`)
    console.log('[POS Auth] Checking stored employee for terminal', terminalId, ':', storedEmployee ? 'found' : 'not found')
    if (storedEmployee) {
      try {
        const parsed = JSON.parse(storedEmployee) as AuthenticatedEmployee
        // Validate that the stored data has required fields
        if (parsed && parsed.employeeId && parsed.fullName) {
          setAuthenticatedEmployee(parsed)
          console.log('[POS Auth] Restored employee:', parsed.fullName)
        } else {
          console.log('[POS Auth] Invalid stored data, clearing')
          sessionStorage.removeItem(`pos_employee_${terminalId}`)
        }
      } catch {
        console.log('[POS Auth] Failed to parse stored data, clearing')
        sessionStorage.removeItem(`pos_employee_${terminalId}`)
      }
    }
    setCheckingAuth(false)
  }, [terminalId])

  // Handle successful cashier authentication
  const handleCashierAuthenticated = (employee: AuthenticatedEmployee) => {
    setAuthenticatedEmployee(employee)
    // Store in sessionStorage for persistence
    sessionStorage.setItem(`pos_employee_${terminalId}`, JSON.stringify(employee))
    console.log('[POS] Cashier authenticated:', employee.fullName, employee.employeeCode)
  }

  // Initialize client-side state and fetch data
  useEffect(() => {
    setMounted(true)
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)

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
                trackInventory: p.trackInventory,
                hasVariants: (p as unknown as { hasVariants?: boolean }).hasVariants || false,
                variants: (p as unknown as { variants?: ProductVariant[] }).variants
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
              trackInventory: p.trackInventory,
              hasVariants: (p as unknown as { hasVariants?: boolean }).hasVariants || false,
              variants: (p as unknown as { variants?: ProductVariant[] }).variants
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
  }, [terminalId, router])

  // Cache session info when it changes
  useEffect(() => {
    if (session) {
      localStorage.setItem('pos_session', JSON.stringify(session))
    }
  }, [session])

  // Restore cart from localStorage (when returning from payment page)
  useEffect(() => {
    if (!mounted || products.length === 0) return

    const restoreFromPayment = searchParams.get('restoreFromPayment')
    if (restoreFromPayment === 'true') {
      try {
        const paymentDataStr = localStorage.getItem('pos_payment_data')
        if (paymentDataStr) {
          const paymentData = JSON.parse(paymentDataStr)

          if (paymentData.cart && Array.isArray(paymentData.cart)) {
            const restoredCart: CartItem[] = []

            for (const item of paymentData.cart) {
              const product = products.find(p => p.id === item.productId)
              if (product) {
                restoredCart.push({
                  product,
                  variantId: item.variantId ?? null,
                  variantName: item.variantName ?? null,
                  variantSku: item.variantSku ?? null,
                  variantBarcode: item.variantBarcode ?? null,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  discountPercent: item.discountPercent,
                  discountAmount: item.discountAmount,
                  total: item.total,
                  originalPrice: item.originalPrice ?? item.unitPrice,
                  pricelistApplied: item.pricelistApplied ?? false,
                  pricelistTierLabel: item.pricelistTierLabel
                })
              }
            }

            if (restoredCart.length > 0) {
              setCart(restoredCart)
              console.log('[POS] Restored cart from payment page:', restoredCart.length, 'items')
            }
          }
        }
        // Clear the URL param
        router.replace(`/dashboard/market/pos/${terminalId}`, { scroll: false })
      } catch (e) {
        console.error('[POS] Error restoring cart:', e)
      }
    }
  }, [searchParams, products, terminalId, router, mounted])

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

  // Refresh products from server (force reload)
  const refreshProducts = async () => {
    if (!isOnline || isRefreshingProducts) return

    setIsRefreshingProducts(true)
    try {
      console.log('[POS] Refreshing products from server...')
      const productsRes = await fetch(`/api/market/pos/products?terminalId=${terminalId}`)
      const productsData = await productsRes.json()

      if (productsData.success) {
        setProducts(productsData.data.products)
        setCategories(productsData.data.categories)
        setTerminal(productsData.data.terminal)

        // Update cache
        await saveProducts(productsData.data.products)
        await saveCategories(productsData.data.categories)
        localStorage.setItem(`pos_terminal_${terminalId}`, JSON.stringify(productsData.data.terminal))

        console.log('[POS] Products refreshed:', productsData.data.products.length, 'products')
      } else {
        console.error('[POS] Error refreshing products:', productsData.error)
      }
    } catch (e) {
      console.error('[POS] Error refreshing products:', e)
    } finally {
      setIsRefreshingProducts(false)
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

    if (selectedCategory !== null) {
      // Comparar como números para evitar problemas de tipos string/number
      filtered = filtered.filter(p => Number(p.categoryId) === Number(selectedCategory))
    }

    return filtered
  }, [products, search, selectedCategory])

  // Cart calculations
  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const discounts = cart.reduce((sum, item) => sum + item.discountAmount, 0)
    const total = cart.reduce((sum, item) => sum + item.total, 0)
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
    // Wholesale savings: difference between original price and tier price
    const wholesaleSavings = cart.reduce((sum, item) => {
      if (item.pricelistApplied && item.originalPrice > item.unitPrice) {
        return sum + (item.originalPrice - item.unitPrice) * item.quantity
      }
      return sum
    }, 0)
    // CUP: calcular sin redondeo para mantener precisión
    const totalCUP = cart.reduce((sum, item) => {
      const unitCUP = item.unitPrice * USD_CUP
      const lineCUP = unitCUP * item.quantity
      const discountCUP = item.discountAmount * USD_CUP
      return sum + lineCUP - discountCUP
    }, 0)
    return { subtotal, discounts, total, itemCount, totalCUP, wholesaleSavings }
  }, [cart, USD_CUP])

  // Handle exit confirmation with password
  const handleExitRequest = (destination: string = '/dashboard/market/pos', actionLabel: string = 'Salir del POS') => {
    setExitDestination(destination)
    setExitActionLabel(actionLabel)
    setShowExitConfirmModal(true)
    setShowCloseSessionModal(false) // Close the close session modal if open
    setExitPassword('')
    setExitPasswordError(null)
    setShowExitPassword(false)
  }

  const handleExitConfirm = async () => {
    if (!exitPassword.trim()) {
      setExitPasswordError('Ingresa tu contraseña')
      return
    }

    setVerifyingPassword(true)
    setExitPasswordError(null)

    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: exitPassword })
      })

      const data = await res.json()

      if (data.success) {
        // Password verified, navigate to destination
        setShowExitConfirmModal(false)
        router.push(exitDestination)
      } else {
        setExitPasswordError(data.error || 'Contraseña incorrecta')
      }
    } catch {
      setExitPasswordError('Error al verificar contraseña')
    } finally {
      setVerifyingPassword(false)
    }
  }

  // Evaluate pricelist tier based on quantity
  const applyPricelistTier = useCallback((product: Product, quantity: number, variantPrice?: number): {
    unitPrice: number
    applied: boolean
    tierLabel?: string
  } => {
    const basePrice = variantPrice ?? product.basePrice
    if (!product.priceTiers || product.priceTiers.length === 0) {
      return { unitPrice: variantPrice ?? product.price, applied: false }
    }

    // Sort tiers by min_quantity descending to find the highest applicable tier
    const sortedTiers = [...product.priceTiers].sort((a, b) => b.minQuantity - a.minQuantity)

    // Find the tier with the highest minQuantity that the current quantity meets
    const applicableTier = sortedTiers.find(t => quantity >= t.minQuantity)

    if (!applicableTier) {
      return { unitPrice: variantPrice ?? product.price, applied: false }
    }

    // If only tier is min_quantity=1, it's the base pricelist price (already applied to product.price)
    if (applicableTier.minQuantity <= 1 && sortedTiers.length === 1) {
      return { unitPrice: variantPrice ?? product.price, applied: false }
    }

    let unitPrice = basePrice
    if (applicableTier.priceType === 'fixed' && applicableTier.fixedPrice !== undefined) {
      unitPrice = applicableTier.fixedPrice
    } else if (applicableTier.priceType === 'discount_percent' && applicableTier.discountPercent !== undefined) {
      unitPrice = basePrice * (1 - applicableTier.discountPercent / 100)
    } else if (applicableTier.priceType === 'discount_amount' && applicableTier.discountAmount !== undefined) {
      unitPrice = Math.max(0, basePrice - applicableTier.discountAmount)
    }

    // No redondear - mantener precisión completa para cálculos exactos
    // El redondeo solo se hace al mostrar valores con toFixed(2)
    const applied = applicableTier.minQuantity > 1 && unitPrice < basePrice

    return {
      unitPrice,
      applied,
      tierLabel: applied ? `${applicableTier.minQuantity}+ uds` : undefined
    }
  }, [])

  // Add product to cart (with optional variant)
  const addToCart = useCallback((product: Product, variant: ProductVariant | null = null) => {
    // Get price and stock from variant if provided, otherwise from product
    const price = variant?.price ?? product.price
    const stock = variant?.stock ?? product.stock
    const itemName = variant ? `${product.name} - ${variant.name}` : product.name

    // Validate stock if trackInventory is enabled
    if (product.trackInventory && stock <= 0) {
      const totalOtherStock = variant?.totalStock || product.totalStockAllWarehouses || 0
      const otherStockMsg = totalOtherStock > 0
        ? ` (Hay ${totalOtherStock} en otros almacenes - ver detalles)`
        : ''
      setError(`Sin stock en este almacén: ${itemName}${otherStockMsg}`)
      setTimeout(() => setError(null), 4000)
      return
    }

    setCart(prev => {
      // Find existing item by product.id + variant.id combination
      const existingIndex = prev.findIndex(item =>
        item.product.id === product.id &&
        item.variantId === (variant?.id ?? null)
      )

      if (existingIndex >= 0) {
        const updated = [...prev]
        const item = { ...updated[existingIndex] }
        const newQuantity = item.quantity + 1

        // Validate stock for quantity increase
        if (product.trackInventory && newQuantity > stock) {
          setError(`Stock insuficiente. Disponible: ${stock}`)
          setTimeout(() => setError(null), 3000)
          return prev
        }

        item.quantity = newQuantity

        // Re-evaluate pricelist tier with new quantity
        const tierResult = applyPricelistTier(product, newQuantity, variant?.price)
        item.unitPrice = tierResult.unitPrice
        item.pricelistApplied = tierResult.applied
        item.pricelistTierLabel = tierResult.tierLabel

        // Recalculate discount and total
        if (item.discountPercent > 0) {
          item.discountAmount = (item.quantity * item.unitPrice) * (item.discountPercent / 100)
        }
        item.total = (item.quantity * item.unitPrice) - item.discountAmount

        updated[existingIndex] = item
        setSelectedCartIndex(existingIndex)
        return updated
      } else {
        // Evaluate tier for initial quantity of 1
        const tierResult = applyPricelistTier(product, 1, variant?.price)

        const newItem: CartItem = {
          product,
          variantId: variant?.id ?? null,
          variantName: variant?.name ?? null,
          variantSku: variant?.sku ?? null,
          variantBarcode: variant?.barcode ?? null,
          quantity: 1,
          unitPrice: tierResult.unitPrice,
          originalPrice: variant?.price ?? product.basePrice,
          pricelistApplied: tierResult.applied,
          pricelistTierLabel: tierResult.tierLabel,
          discountPercent: 0,
          discountAmount: 0,
          total: tierResult.unitPrice
        }
        setSelectedCartIndex(prev.length)
        return [...prev, newItem]
      }
    })
    setNumpadValue('')
    setNumpadMode('quantity')
  }, [applyPricelistTier])

  // Handle barcode scan - auto add to cart (like Odoo)
  const handleBarcodeScan = useCallback((barcode: string) => {
    const barcodeLower = barcode.toLowerCase()

    // 1. First search in product variants
    for (const product of products) {
      if (product.hasVariants && product.variants) {
        const variant = product.variants.find(v =>
          v.barcode?.toLowerCase() === barcodeLower ||
          v.sku?.toLowerCase() === barcodeLower
        )
        if (variant) {
          // Found variant - add directly to cart
          addToCart(product, variant)
          setSearch('')
          return
        }
      }
    }

    // 2. Search for product by barcode or SKU
    const product = products.find(p =>
      p.barcode?.toLowerCase() === barcodeLower ||
      p.sku?.toLowerCase() === barcodeLower
    )

    if (product) {
      if (product.hasVariants && product.variants && product.variants.length > 0) {
        // Product has variants - show selection modal
        setSelectedProductForVariant(product)
        setShowVariantModal(true)
      } else {
        // No variants - add directly
        addToCart(product, null)
      }
      setSearch('')
    } else {
      // Show error - product not found
      setError(`Producto no encontrado: ${barcode}`)
      setTimeout(() => setError(null), 3000)
    }
  }, [products, addToCart])

  // Barcode scanner detection hook
  useBarcodeScan({
    onScan: handleBarcodeScan,
    onError: (error) => console.warn('Barcode scan:', error),
    minLength: 3,
    maxTimeBetweenKeys: 50,
    enabled: !showPaymentModal && !showCloseSessionModal && !showVariantModal && !loading
  })

  // Handle product click - show product info modal (description + barcode)
  // Employees must scan the product barcode to add it to cart
  const handleProductClick = useCallback((product: Product) => {
    setSelectedProductForDetails(product)
    setShowProductDetailsModal(true)
  }, [])

  // Handle variant selection from modal
  const handleVariantSelect = useCallback((variant: Variant) => {
    if (selectedProductForVariant) {
      // Convert Variant to ProductVariant
      const productVariant: ProductVariant = {
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        stock: variant.stock,
        imageUrl: variant.imageUrl
      }
      addToCart(selectedProductForVariant, productVariant)
    }
    setShowVariantModal(false)
    setSelectedProductForVariant(null)
  }, [selectedProductForVariant, addToCart])

  // Show product details modal (with caching to reduce API calls)
  const showProductDetails = useCallback(async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent adding to cart
    setSelectedProductForDetails(product)
    setShowProductDetailsModal(true)

    // Check cache first
    const cached = stockCacheRef.current.get(product.id)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < STOCK_CACHE_TTL) {
      // Use cached data
      setWarehouseStocks(cached.data)
      setLoadingStocks(false)
      return
    }

    setLoadingStocks(true)
    setWarehouseStocks([])

    try {
      const res = await fetch(`/api/market/products/${product.id}/stock?currentWarehouseId=${terminal?.warehouseId || ''}`)
      const data = await res.json()

      if (data.success && data.data.warehouses) {
        const stocks = data.data.warehouses.map((w: {
          warehouseId: number
          warehouseName: string
          warehouseCode: string
          quantityOnHand: number
          isCurrentWarehouse: boolean
        }) => ({
          warehouseId: w.warehouseId,
          warehouseName: w.warehouseName,
          warehouseCode: w.warehouseCode,
          stock: w.quantityOnHand,
          isCurrentWarehouse: w.isCurrentWarehouse
        }))

        // Cache the result
        stockCacheRef.current.set(product.id, { data: stocks, timestamp: now })
        setWarehouseStocks(stocks)
      }
    } catch (error) {
      console.error('[POS] Error fetching warehouse stocks:', error)
    } finally {
      setLoadingStocks(false)
    }
  }, [terminal?.warehouseId])

  // Update cart item
  const updateCartItem = useCallback((index: number, updates: Partial<CartItem>) => {
    setCart(prev => {
      const updated = [...prev]
      const currentItem = updated[index]

      // Validate stock if updating quantity
      if (updates.quantity !== undefined && currentItem.product.trackInventory) {
        const variantStock = currentItem.variantId
          ? currentItem.product.variants?.find(v => v.id === currentItem.variantId)?.stock
          : undefined
        const effectiveStock = variantStock ?? currentItem.product.stock
        if (updates.quantity > effectiveStock) {
          setError(`Stock insuficiente. Disponible: ${effectiveStock}`)
          setTimeout(() => setError(null), 3000)
          return prev
        }
        if (updates.quantity < 0) {
          updates.quantity = 0
        }
      }

      const item = { ...currentItem, ...updates }

      // Re-evaluate pricelist tier when quantity changes (unless price was manually set)
      if (updates.quantity !== undefined && !updates.unitPrice) {
        const variantPrice = currentItem.variantId
          ? currentItem.product.variants?.find(v => v.id === currentItem.variantId)?.price
          : undefined
        const tierResult = applyPricelistTier(currentItem.product, item.quantity, variantPrice)
        item.unitPrice = tierResult.unitPrice
        item.pricelistApplied = tierResult.applied
        item.pricelistTierLabel = tierResult.tierLabel
      }

      // If price was manually edited, disable pricelist tier
      if (updates.unitPrice !== undefined) {
        item.pricelistApplied = false
        item.pricelistTierLabel = undefined
      }

      // Recalculate totals
      if (item.discountPercent > 0) {
        item.discountAmount = (item.quantity * item.unitPrice) * (item.discountPercent / 100)
      }
      item.total = (item.quantity * item.unitPrice) - item.discountAmount

      updated[index] = item
      return updated
    })
  }, [applyPricelistTier])

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
        employeeId: authenticatedEmployee?.employeeId,
        currency: paymentCurrency,
        lines: cart.map(item => ({
          productId: item.product.id,
          variantId: item.variantId,
          productName: item.variantName
            ? `${item.product.name} - ${item.variantName}`
            : item.product.name,
          productSku: item.variantSku || item.product.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          originalPrice: item.pricelistApplied ? item.originalPrice : undefined,
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

  // Evitar parpadeo durante hidratación
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gray-800">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-400">Iniciando...</p>
        </div>
      </div>
    )
  }

  // Debug log
  console.log('[POS Render] State:', { mounted, checkingAuth, loading, hasTerminal: !!terminal, hasEmployee: !!authenticatedEmployee })

  // Show loading while checking auth OR loading terminal data
  if (checkingAuth || (loading && !terminal)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gray-800">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-400">
            {checkingAuth ? 'Verificando sesión...' : 'Cargando terminal...'}
          </p>
        </div>
      </div>
    )
  }

  // Show cashier login modal if not authenticated (requires terminal to be loaded)
  if (!authenticatedEmployee && terminal) {
    return (
      <CashierLoginModal
        terminalId={parseInt(terminalId)}
        terminalName={terminal.name}
        onAuthenticated={handleCashierAuthenticated}
        onCancel={() => router.push('/dashboard/market/pos')}
      />
    )
  }

  // Show loading while fetching remaining data (products, etc.)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-gray-800">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          </div>
          <p className="text-sm font-medium text-gray-400">Cargando productos...</p>
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className={cn(
            'w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4',
            theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50'
          )}>
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <p className="text-red-500 mb-4 max-w-sm mx-auto">{error}</p>
          <button
            onClick={() => router.push('/dashboard/market/pos')}
            className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            Volver
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'h-screen flex flex-col overflow-hidden',
        theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
      )}
    >
      {/* Header - Responsive */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className={cn(
        'flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b shadow-sm',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => handleExitRequest()}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Salir del POS (requiere contraseña)"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={cn(
              'p-1.5 sm:p-2 rounded-lg hidden sm:flex',
              theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
            )}>
              <Monitor className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="font-bold text-sm sm:text-lg">{terminal?.name}</h1>
              <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">
                Sesión: {session?.sessionCode}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Authenticated Cashier */}
          {authenticatedEmployee && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm',
              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            )}>
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{authenticatedEmployee.fullName}</span>
              <span className="sm:hidden">{authenticatedEmployee.employeeCode}</span>
              <button
                onClick={() => {
                  sessionStorage.removeItem(`pos_employee_${terminalId}`)
                  setAuthenticatedEmployee(null)
                }}
                className="ml-2 p-2 sm:p-2.5 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors active:scale-95"
                title="Cerrar sesión de cajero"
              >
                <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          )}
          {/* Online Status */}
          <div className={cn(
            'flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm',
            isOnline
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          )}>
            {isOnline ? <Wifi className="w-3 h-3 sm:w-4 sm:h-4" /> : <WifiOff className="w-3 h-3 sm:w-4 sm:h-4" />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
            {isSyncing && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>

          {/* Refresh Products Button */}
          <button
            onClick={refreshProducts}
            disabled={!isOnline || isRefreshingProducts}
            title="Actualizar productos"
            className={cn(
              'flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm transition-all',
              isOnline
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('w-3 h-3 sm:w-4 sm:h-4', isRefreshingProducts && 'animate-spin')} />
            <span className="hidden lg:inline">{isRefreshingProducts ? 'Actualizando...' : 'Actualizar'}</span>
          </button>

          {/* Pending Orders Badge */}
          {pendingOrdersCount > 0 && (
            <button
              onClick={syncPendingOrders}
              disabled={!isOnline || isSyncing}
              className={cn(
                'flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm transition-all',
                isOnline
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 cursor-not-allowed'
              )}
            >
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>{pendingOrdersCount}</span>
              <span className="hidden lg:inline">pendiente{pendingOrdersCount !== 1 ? 's' : ''}</span>
            </button>
          )}

          {/* Time - Hidden on small screens */}
          <div className="hidden md:flex items-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-mono">
              {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Fullscreen - Hidden on mobile */}
          <button
            onClick={toggleFullscreen}
            className="hidden sm:block p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Close Session */}
          <button
            onClick={() => setShowCloseSessionModal(true)}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-xs sm:text-sm"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Cerrar Caja</span>
          </button>
        </div>
      </motion.header>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex-1 flex flex-col lg:flex-row overflow-hidden relative"
      >
        {/* Left Panel - Cart (Desktop) / Bottom Sheet (Mobile) */}
        <div className={cn(
          // Desktop: sidebar
          'lg:w-[320px] xl:w-[380px] lg:flex lg:flex-col lg:border-r',
          // Mobile/Tablet: bottom sheet
          'fixed lg:relative bottom-0 left-0 right-0 lg:bottom-auto lg:left-auto lg:right-auto',
          'z-40 lg:z-auto',
          showMobileCart ? 'h-[70vh]' : 'h-auto',
          'transition-all duration-300',
          theme === 'dark' ? 'bg-gray-800 border-gray-700 lg:border-r' : 'bg-white border-gray-200 lg:border-r'
        )}>
          {/* Mobile Cart Toggle Bar */}
          <button
            onClick={() => setShowMobileCart(!showMobileCart)}
            className={cn(
              'lg:hidden flex items-center justify-between px-4 py-3 border-t',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {cartTotals.itemCount}
                  </span>
                )}
              </div>
              <span className="font-bold text-lg">${cartTotals.total.toFixed(2)} <span className="text-xs text-green-600 font-normal">(${formatCUP(cartTotals.totalCUP)} CUP)</span></span>
            </div>
            {showMobileCart ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </button>

          {/* Cart Items - Only show on desktop or when mobile cart is open */}
          <div className={cn(
            'flex-1 overflow-y-auto p-3 lg:p-4',
            showMobileCart ? 'block' : 'hidden lg:block'
          )}>
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-8">
                <ShoppingCart className="w-12 h-12 lg:w-16 lg:h-16 mb-3 opacity-50" />
                <p className="text-base lg:text-lg">Carrito vacío</p>
                <p className="text-xs lg:text-sm">Selecciona productos</p>
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
                      'p-2 lg:p-3 rounded-xl cursor-pointer transition-all',
                      selectedCartIndex === index
                        ? theme === 'dark'
                          ? 'bg-blue-900/30 border-2 border-blue-500'
                          : 'bg-blue-50 border-2 border-blue-500'
                        : theme === 'dark'
                        ? 'bg-gray-700/50 hover:bg-gray-700'
                        : 'bg-gray-50 hover:bg-gray-100'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs lg:text-sm truncate">
                          {item.variantName
                            ? `${item.product.name} - ${item.variantName}`
                            : item.product.name}
                          {item.pricelistApplied && item.pricelistTierLabel && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                              {item.pricelistTierLabel}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] lg:text-xs text-gray-500">
                          {item.quantity} x{' '}
                          {item.pricelistApplied && item.originalPrice > item.unitPrice ? (
                            <>
                              <span className="line-through text-gray-400">${item.originalPrice.toFixed(2)}</span>
                              {' '}
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">${item.unitPrice.toFixed(2)}</span>
                            </>
                          ) : (
                            <>${item.unitPrice.toFixed(2)}</>
                          )}
                          {item.discountPercent > 0 && (
                            <span className="text-green-500 ml-1">-{item.discountPercent}%</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm lg:text-base">${item.total.toFixed(2)}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromCart(index) }}
                          className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick quantity buttons */}
                    {selectedCartIndex === index && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (item.quantity > 1) {
                              updateCartItem(index, { quantity: item.quantity - 1 })
                            }
                          }}
                          className="p-1.5 lg:p-2 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          <Minus className="w-3 h-3 lg:w-4 lg:h-4" />
                        </button>
                        <span className="flex-1 text-center font-bold text-base lg:text-lg">{item.quantity}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateCartItem(index, { quantity: item.quantity + 1 })
                          }}
                          className="p-1.5 lg:p-2 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                          <Plus className="w-3 h-3 lg:w-4 lg:h-4" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Numpad - Hidden on mobile unless cart is open */}
          <div className={cn(
            'p-2 lg:p-4 border-t',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
            showMobileCart ? 'block' : 'hidden lg:block'
          )}>
            {/* Mode selector */}
            <div className="flex gap-1 lg:gap-2 mb-2 lg:mb-3">
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
                    'flex-1 flex items-center justify-center gap-1 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium transition-all',
                    numpadMode === mode
                      ? 'bg-blue-500 text-white'
                      : disabled
                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 cursor-not-allowed'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  <Icon className="w-3 h-3 lg:w-4 lg:h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Display */}
            <div className={cn(
              'px-3 py-2 lg:px-4 lg:py-3 rounded-xl mb-2 lg:mb-3 text-right text-xl lg:text-2xl font-mono font-bold',
              theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
            )}>
              {numpadValue || '0'}
              {numpadMode === 'discount' && '%'}
              {numpadMode === 'price' && numpadValue && '$'}
            </div>

            {/* Numpad grid */}
            <div className="grid grid-cols-4 gap-1 lg:gap-2">
              {['7', '8', '9', 'C', '4', '5', '6', 'DEL', '1', '2', '3', 'ENTER', '.', '0', '00', ''].map((key, i) => {
                if (key === '') return <div key={i} />
                return (
                  <button
                    key={key}
                    onClick={() => handleNumpad(key)}
                    className={cn(
                      'py-2.5 lg:py-4 rounded-lg lg:rounded-xl font-bold text-sm lg:text-lg transition-all active:scale-95',
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
                    {key === 'DEL' ? <Delete className="w-4 h-4 lg:w-5 lg:h-5 mx-auto" /> :
                     key === 'ENTER' ? <CornerDownLeft className="w-4 h-4 lg:w-5 lg:h-5 mx-auto" /> : key}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cart Totals & Pay - Always visible */}
          <div className={cn(
            'p-2 lg:p-4 border-t',
            theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50',
            showMobileCart ? 'block' : 'hidden lg:block'
          )}>
            <div className="space-y-1 lg:space-y-2 mb-2 lg:mb-4">
              <div className="flex justify-between text-xs lg:text-sm">
                <span className="text-gray-500">Subtotal ({cartTotals.itemCount})</span>
                <span>${cartTotals.subtotal.toFixed(2)}</span>
              </div>
              {cartTotals.wholesaleSavings > 0 && (
                <div className="flex justify-between text-xs lg:text-sm text-emerald-600 dark:text-emerald-400">
                  <span>Precio mayorista</span>
                  <span>-${cartTotals.wholesaleSavings.toFixed(2)}</span>
                </div>
              )}
              {cartTotals.discounts > 0 && (
                <div className="flex justify-between text-xs lg:text-sm text-green-500">
                  <span>Descuentos</span>
                  <span>-${cartTotals.discounts.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg lg:text-xl font-bold pt-1 lg:pt-2 border-t border-gray-200 dark:border-gray-600">
                <span>Total</span>
                <div className="text-right">
                  <span>${cartTotals.total.toFixed(2)}</span>
                  <p className="text-xs lg:text-sm font-normal text-green-600">
                    ${formatCUP(cartTotals.totalCUP)} CUP
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className={cn(
                  'flex-1 py-2 lg:py-3 rounded-lg lg:rounded-xl font-medium flex items-center justify-center gap-1 lg:gap-2 transition-all text-xs lg:text-base',
                  cart.length === 0
                    ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 cursor-not-allowed'
                    : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                )}
              >
                <Trash2 className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden sm:inline">Vaciar</span>
              </button>
              <button
                onClick={() => {
                  if (cart.length === 0 || !session) return
                  const cartData = cart.map(item => ({
                    productId: item.product.id,
                    variantId: item.variantId,
                    variantName: item.variantName,
                    variantSku: item.variantSku,
                    variantBarcode: item.variantBarcode,
                    productName: item.product.name,
                    productSku: item.product.sku,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountPercent: item.discountPercent,
                    discountAmount: item.discountAmount,
                    total: item.total
                  }))
                  const paymentData = {
                    cart: cartData,
                    sessionId: session.id,
                    warehouseId: terminal?.warehouseId || null,
                    terminalId: parseInt(terminalId),
                    timestamp: Date.now()
                  }
                  localStorage.setItem('pos_payment_data', JSON.stringify(paymentData))
                  setShowMobileCart(false)
                  router.push(`/dashboard/market/pos/${terminalId}/payment`)
                }}
                disabled={cart.length === 0}
                className={cn(
                  'flex-[2] py-2 lg:py-3 rounded-lg lg:rounded-xl font-bold flex items-center justify-center gap-1 lg:gap-2 transition-all shadow-lg text-sm lg:text-base',
                  cart.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-green-500/25'
                )}
              >
                <CreditCard className="w-4 h-4 lg:w-5 lg:h-5" />
                <span>${cartTotals.total.toFixed(2)} <span className="text-[10px] lg:text-xs opacity-80">(${formatCUP(cartTotals.totalCUP)} CUP)</span></span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Products */}
        <div className="flex-1 flex flex-col overflow-hidden pb-14 lg:pb-0">
          {/* Search & Categories */}
          <div className={cn(
            'p-2 sm:p-3 lg:p-4 border-b',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            {/* Search */}
            <div className="relative mb-2 lg:mb-4">
              <Search className="absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar o escanear..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full pl-9 lg:pl-12 pr-3 lg:pr-4 py-2 lg:py-3 rounded-lg lg:rounded-xl border focus:outline-none focus:ring-2 transition-all text-sm lg:text-lg',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                    : 'bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20'
                )}
              />
            </div>

            {/* Categories */}
            <div className="flex gap-1.5 lg:gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg lg:rounded-xl whitespace-nowrap text-xs lg:text-sm font-medium transition-all',
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
                    'px-2.5 lg:px-4 py-1.5 lg:py-2 rounded-lg lg:rounded-xl whitespace-nowrap text-xs lg:text-sm font-medium transition-all',
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
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 lg:p-4">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Package className="w-12 h-12 lg:w-16 lg:h-16 mb-3 opacity-50" />
                <p className="text-base lg:text-lg">No hay productos</p>
                <p className="text-xs lg:text-sm">Intenta con otra búsqueda</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5 sm:gap-2 lg:gap-3">
                {filteredProducts.map(product => (
                  <motion.button
                    key={product.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleProductClick(product)}
                    className={cn(
                      'relative p-1.5 sm:p-2 lg:p-3 rounded-lg lg:rounded-xl text-left transition-all border group',
                      product.trackInventory && product.stock <= 0
                        ? 'opacity-60'
                        : '',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700 hover:border-blue-500 active:bg-gray-700'
                        : 'bg-white border-gray-200 hover:border-blue-500 shadow-sm active:shadow-none'
                    )}
                  >
                    {/* Product image or placeholder */}
                    <ProductImageSquare
                      src={product.imageUrl}
                      alt={product.name}
                      theme={theme}
                      className="mb-1.5 lg:mb-2"
                    />

                    {/* Product info */}
                    <h3 className="font-medium text-[10px] sm:text-xs lg:text-sm line-clamp-2 mb-0.5 lg:mb-1 leading-tight">
                      {product.name}
                    </h3>
                    <p className="text-xs sm:text-sm lg:text-base font-bold text-blue-500">
                      ${product.price.toFixed(2)}
                    </p>

                    {/* Precios en otras monedas (tasa ElToque) */}
                    <div className="text-[9px] sm:text-[10px] lg:text-xs text-gray-500 space-y-0">
                      <p className="text-green-600">${formatCUP(product.price * USD_CUP)} CUP</p>
                      <p className="text-purple-600">${(product.price * USD_MLC).toFixed(2)} MLC</p>
                    </div>

                    {/* Info button - always visible for touch devices */}
                    <div
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        showProductDetails(product, e)
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && showProductDetails(product, e as unknown as React.MouseEvent)}
                      className={cn(
                        'absolute top-1 left-1 lg:top-2 lg:left-2 w-6 h-6 lg:w-7 lg:h-7 rounded-full flex items-center justify-center transition-all z-20 cursor-pointer',
                        theme === 'dark'
                          ? 'bg-gray-700/90 hover:bg-blue-600 text-gray-300 hover:text-white'
                          : 'bg-white/95 hover:bg-blue-500 text-gray-600 hover:text-white',
                        'shadow-md border',
                        theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                      )}
                    >
                      <Info className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                    </div>

                    {/* Variants badge */}
                    {product.hasVariants && (
                      <div className="absolute top-1 right-1 lg:top-2 lg:right-2">
                        <span className="bg-purple-500 text-white px-1.5 py-0.5 lg:px-2 lg:py-0.5 rounded-md text-[8px] lg:text-[10px] font-medium">
                          {product.variants?.length || 0} var
                        </span>
                      </div>
                    )}

                    {/* Out of stock overlay */}
                    {product.trackInventory && product.stock <= 0 && (
                      <div className="absolute inset-0 bg-gray-900/60 rounded-lg lg:rounded-xl flex flex-col items-center justify-center p-1">
                        <span className="bg-red-500 text-white px-2 py-0.5 lg:px-3 lg:py-1 rounded-full text-[10px] lg:text-sm font-medium">
                          Sin stock
                        </span>
                        {(product.totalStockAllWarehouses || 0) > 0 && (
                          <span className="mt-1 text-[9px] lg:text-xs text-white/90 text-center">
                            Hay {product.totalStockAllWarehouses} en otros almacenes
                          </span>
                        )}
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Cart Overlay - when cart is expanded */}
        {showMobileCart && (
          <div
            className="lg:hidden fixed inset-0 bg-black/40 z-30"
            onClick={() => setShowMobileCart(false)}
          />
        )}
      </motion.div>

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
                <div>
                  <h3 className="text-2xl font-bold">Cobrar ${cartTotals.total.toFixed(2)}</h3>
                  <p className="text-sm text-green-600 font-normal">${formatCUP(cartTotals.totalCUP)} CUP</p>
                </div>
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
                Selecciona una opción para continuar:
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleExitRequest(`/dashboard/market/pos/${terminalId}/count`, 'Iniciar Conteo')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium shadow-lg shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 flex items-center justify-center gap-2"
                >
                  <ClipboardList className="w-5 h-5" />
                  Iniciar Conteo de Inventario
                </button>
                <button
                  onClick={() => handleExitRequest(`/dashboard/market/pos/${terminalId}/close`, 'Cerrar Sesión')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium shadow-lg shadow-red-500/25 hover:from-red-600 hover:to-red-700 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-5 h-5" />
                  Cerrar Sesión (Arqueo)
                </button>
                <button
                  onClick={() => setShowCloseSessionModal(false)}
                  className={cn(
                    'w-full py-2.5 rounded-xl font-medium',
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Exit Confirmation Modal - Password Required */}
        {showExitConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => !verifyingPassword && setShowExitConfirmModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full max-w-md rounded-2xl p-6',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  'p-3 rounded-xl',
                  theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'
                )}>
                  <Lock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Confirmar Salida</h3>
                  <p className="text-sm text-gray-500">Ingresa tu contraseña para continuar</p>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                Por seguridad, debes confirmar tu identidad antes de salir del punto de venta.
              </p>

              {/* User Info */}
              <div className={cn(
                'flex items-center gap-3 p-3 rounded-xl mb-4',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              )}>
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'
                )}>
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium">{user?.name || user?.email}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
              </div>

              {/* Password Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Contraseña</label>
                <div className="relative">
                  <input
                    type={showExitPassword ? 'text' : 'password'}
                    value={exitPassword}
                    onChange={(e) => setExitPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleExitConfirm()}
                    placeholder="Ingresa tu contraseña"
                    disabled={verifyingPassword}
                    autoFocus
                    className={cn(
                      'w-full px-4 py-3 pr-12 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600'
                        : 'bg-white border-gray-300',
                      exitPasswordError && 'border-red-500 focus:ring-red-500'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowExitPassword(!showExitPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showExitPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {exitPasswordError && (
                  <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {exitPasswordError}
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleExitConfirm}
                  disabled={verifyingPassword || !exitPassword.trim()}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2',
                    verifyingPassword || !exitPassword.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  )}
                >
                  {verifyingPassword ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-5 h-5" />
                      {exitActionLabel}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowExitConfirmModal(false)
                    setExitPassword('')
                    setExitPasswordError(null)
                  }}
                  disabled={verifyingPassword}
                  className={cn(
                    'px-6 py-3 rounded-xl font-medium',
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200',
                    verifyingPassword && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Variant Selector Modal */}
      <VariantSelectorModal
        isOpen={showVariantModal}
        onClose={() => {
          setShowVariantModal(false)
          setSelectedProductForVariant(null)
        }}
        product={selectedProductForVariant ? {
          id: selectedProductForVariant.id,
          name: selectedProductForVariant.name,
          imageUrl: selectedProductForVariant.imageUrl,
          variants: (selectedProductForVariant.variants || []).map(v => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            barcode: v.barcode,
            price: v.price,
            stock: v.stock,
            imageUrl: v.imageUrl
          }))
        } : null}
        onSelect={handleVariantSelect}
        mode="sale"
        currency={paymentCurrency}
        warehouseId={terminal?.warehouseId}
      />

      {/* Product Details Modal */}
      <AnimatePresence>
        {showProductDetailsModal && selectedProductForDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowProductDetailsModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              {/* Header */}
              <div className={cn(
                'px-6 py-4 border-b flex items-center gap-4 flex-shrink-0',
                theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
              )}>
                <ProductImage
                  src={selectedProductForDetails.imageUrl}
                  alt={selectedProductForDetails.name}
                  size="lg"
                  theme={theme}
                  containerClassName="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">
                    {selectedProductForDetails.name}
                  </h3>
                  <p className="text-sm text-gray-500 font-mono">
                    SKU: {selectedProductForDetails.sku || 'N/A'}
                  </p>
                  <p className="text-xl font-bold text-blue-500 mt-1">
                    ${selectedProductForDetails.price.toFixed(2)}
                  </p>
                  {/* Precios en otras monedas (tasa ElToque) */}
                  <div className="flex gap-3 mt-1 text-sm">
                    <span className="text-green-600">${formatCUP(selectedProductForDetails.price * USD_CUP)} CUP</span>
                    <span className="text-purple-600">${(selectedProductForDetails.price * USD_MLC).toFixed(2)} MLC</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowProductDetailsModal(false)}
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Description */}
                {selectedProductForDetails.description ? (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Descripcion
                    </h4>
                    <p className={cn(
                      'text-sm leading-relaxed',
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                    )}>
                      {selectedProductForDetails.description}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Sin descripcion disponible
                    </p>
                  </div>
                )}

                {/* Barcode - Prominent display */}
                <div className={cn(
                  'p-6 rounded-xl text-center border-2 border-dashed',
                  theme === 'dark' ? 'bg-gray-900 border-gray-600' : 'bg-gray-50 border-gray-300'
                )}>
                  <Barcode className="w-10 h-10 mx-auto mb-3 text-blue-500" />
                  <p className="text-xs text-gray-500 mb-2">Codigo de Barras</p>
                  {selectedProductForDetails.barcode ? (
                    <p className="font-mono text-2xl font-bold text-gray-900 dark:text-white tracking-wider">
                      {selectedProductForDetails.barcode}
                    </p>
                  ) : (
                    <p className={cn(
                      'text-sm',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      Sin codigo de barras
                    </p>
                  )}
                </div>

                {/* Scan instruction */}
                <div className={cn(
                  'p-4 rounded-xl flex items-center gap-3',
                  theme === 'dark' ? 'bg-amber-900/30 border border-amber-700' : 'bg-amber-50 border border-amber-200'
                )}>
                  <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <Scan className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={cn(
                      'font-medium text-sm',
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
                    )}>
                      Escanea el codigo de barras
                    </p>
                    <p className={cn(
                      'text-xs',
                      theme === 'dark' ? 'text-amber-500/80' : 'text-amber-600'
                    )}>
                      Para agregar este producto al carrito, escanea el codigo con el lector
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer - Close button only */}
              <div className={cn(
                'px-6 py-4 border-t flex-shrink-0',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <button
                  onClick={() => setShowProductDetailsModal(false)}
                  className={cn(
                    'w-full py-3 font-semibold rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  )}
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
