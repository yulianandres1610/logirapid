'use client'

import React, { useState, useEffect, Suspense, Component, ReactNode } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

// ============================================
// INLINE EVERYTHING FOR OFFLINE SUPPORT
// No external imports that could fail offline
// ============================================

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
    button: 'bg-gray-700 hover:bg-gray-600',
  },
  light: {
    bg: 'bg-gray-100',
    bgAlt: 'bg-white',
    bgCard: 'bg-white',
    text: 'text-gray-900',
    textMuted: 'text-gray-600',
    border: 'border-gray-300',
    button: 'bg-gray-200 hover:bg-gray-300',
  }
}

const getThemeClasses = (theme: Theme) => themeStyles[theme]

// Error Boundary for catching any unhandled errors
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: ReactNode
  terminalId: string
}

class ReceiptErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Receipt ErrorBoundary] Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const currentTheme = getThemeFromStorage()
      const bgClass = currentTheme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
      const cardClass = currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'
      const btnClass = currentTheme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
      return (
        <div className={`min-h-screen flex items-center justify-center ${bgClass}`}>
          <div className="text-center max-w-md p-6">
            <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-bold mb-2">Error en la pagina</h2>
            <p className={`${cardClass} mb-4`}>
              {this.state.error?.message || 'Ha ocurrido un error inesperado'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Reintentar
              </button>
              <button
                onClick={() => {
                  window.location.href = `/dashboard/market/pos/${this.props.terminalId}`
                }}
                className={`px-4 py-2 ${btnClass} rounded-lg`}
              >
                Volver al POS
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// IndexedDB constants
const DB_NAME = 'market_pos_db'
const DB_VERSION = 1
const PENDING_ORDERS_STORE = 'pending_orders'

interface PendingOrder {
  offlineId: string
  terminalId: number
  sessionId: number
  warehouseId: number | null
  customerId: number | null
  customerName: string | null
  currency: string
  lines: Array<{
    productId: number
    productName: string
    productSku: string | null
    quantity: number
    unitPrice: number
    discountPercent: number
    discountAmount: number
  }>
  payments: Array<{
    method: string
    amount: number
    currency: string
    amountTendered: number | null
    changeAmount: number | null
    changeCurrency: string | null
  }>
  total: number
  createdAt: string
  synced: boolean
}

// Open IndexedDB directly
const openPOSDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(PENDING_ORDERS_STORE)) {
        const ordersStore = db.createObjectStore(PENDING_ORDERS_STORE, { keyPath: 'offlineId' })
        ordersStore.createIndex('sessionId', 'sessionId', { unique: false })
        ordersStore.createIndex('synced', 'synced', { unique: false })
      }

      if (!db.objectStoreNames.contains('products')) {
        const productsStore = db.createObjectStore('products', { keyPath: 'id' })
        productsStore.createIndex('barcode', 'barcode', { unique: false })
        productsStore.createIndex('categoryId', 'categoryId', { unique: false })
      }

      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('promotions')) {
        db.createObjectStore('promotions', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('sync_status')) {
        db.createObjectStore('sync_status', { keyPath: 'id' })
      }
    }
  })
}

// Get pending orders from IndexedDB
const getPendingOrdersFromDB = async (): Promise<PendingOrder[]> => {
  if (typeof window === 'undefined') return []

  try {
    const db = await openPOSDB()
    const tx = db.transaction(PENDING_ORDERS_STORE, 'readonly')
    const store = tx.objectStore(PENDING_ORDERS_STORE)

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        db.close()
        resolve(request.result as PendingOrder[])
      }
      request.onerror = () => {
        db.close()
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[Receipt] Error reading IndexedDB:', error)
    return []
  }
}

interface OrderLine {
  id: number
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  originalPrice?: number
  discountAmount: number
  total: number
}

interface Payment {
  method: string
  amount: number
  currency: string
  amountTendered?: number | null  // Para efectivo: cuánto entregó el cliente
  changeAmount?: number | null    // Para efectivo: cambio devuelto
  changeCurrency?: string | null  // Para efectivo: moneda del cambio (USD o CUP)
}

interface Order {
  id: number
  orderNumber: string
  customerName: string | null
  terminalName?: string           // Nombre del terminal
  subtotal: number
  discountAmount: number
  totalAmount: number
  currency: string
  status: string
  createdAt: string
  createdByName: string
  lines: OrderLine[]
  payments: Payment[]
  exchangeRate?: number // Tasa USD -> CUP al momento de la venta
}

// Simple SVG icons inline (no lucide-react needed)
const CheckIcon = () => (
  <svg className="w-20 h-20 mx-auto mb-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const PrinterIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
)

const CartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
)

const ClockIcon = () => (
  <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const LoaderIcon = () => (
  <svg className="w-12 h-12 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
)

const AlertIcon = () => (
  <svg className="w-12 h-12 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

// Formatear CUP como entero (sin decimales - requisito Cuba)
const formatCUP = (amount: number): string => Math.round(amount).toLocaleString('es-ES')

function ReceiptContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const terminalId = params.terminalId as string
  const orderId = searchParams.get('orderId')
  const orderNumber = searchParams.get('orderNumber')
  const offlineId = searchParams.get('offlineId')
  const isOfflineOrder = searchParams.get('offline') === 'true'
  const autoPrint = searchParams.get('autoPrint') === 'true'

  // State
  const [isClient, setIsClient] = useState(false)
  const [hasAutoprinted, setHasAutoprinted] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printingWithService, setPrintingWithService] = useState(false)
  const [copies, setCopies] = useState(1)
  const [exchangeRate, setExchangeRate] = useState<number>(411) // Tasa USD -> CUP BCC por defecto
  const [defaultPrintServiceId, setDefaultPrintServiceId] = useState<number | null>(null)

  // Initialize on client and load terminal config
  useEffect(() => {
    setIsClient(true)
    setTheme(getThemeFromStorage())

    // Listen for theme changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme' && e.newValue) {
        setTheme(e.newValue as Theme)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Load terminal print configuration
  useEffect(() => {
    if (!isClient || !terminalId) return

    const loadTerminalPrintConfig = async () => {
      try {
        // Try localStorage cache first
        const cachedConfig = localStorage.getItem(`pos_terminal_config_${terminalId}`)
        if (cachedConfig) {
          const config = JSON.parse(cachedConfig)
          if (config.defaultPrintServiceId) {
            console.log('[Receipt] Loaded defaultPrintServiceId from cache:', config.defaultPrintServiceId)
            setDefaultPrintServiceId(config.defaultPrintServiceId)
            return
          }
        }

        // If not in cache or no print service configured, try API
        if (navigator.onLine) {
          const response = await fetch(`/api/market/pos/terminals/${terminalId}`)
          const data = await response.json()
          if (data.success && data.data?.defaultPrintServiceId) {
            console.log('[Receipt] Loaded defaultPrintServiceId from API:', data.data.defaultPrintServiceId)
            setDefaultPrintServiceId(data.data.defaultPrintServiceId)
          }
        }
      } catch (err) {
        console.error('[Receipt] Error loading terminal print config:', err)
      }
    }

    loadTerminalPrintConfig()
  }, [isClient, terminalId])

  // Theme classes
  const tc = getThemeClasses(theme)

  // Fetch exchange rate
  useEffect(() => {
    if (!isClient) return

    const fetchExchangeRate = async () => {
      try {
        const res = await fetch('/api/market/pos/exchange-rates')
        const data = await res.json()
        // Usar tasa ElToque para recibo de venta
        if (data.success && data.rates?.CUP) {
          setExchangeRate(data.rates.CUP)
        }
      } catch (err) {
        console.log('[Receipt] Using default exchange rate:', err)
      }
    }

    fetchExchangeRate()
  }, [isClient])

  // Fetch order details (online or offline)
  useEffect(() => {
    if (!isClient) return

    const fetchOrder = async () => {
      // OFFLINE ORDER: Load from IndexedDB
      if (isOfflineOrder && offlineId) {
        try {
          console.log('[Receipt] Loading offline order:', offlineId)
          const pendingOrders = await getPendingOrdersFromDB()
          console.log('[Receipt] Found pending orders:', pendingOrders.length)
          const offlineOrder = pendingOrders.find(o => o.offlineId === offlineId)

          if (offlineOrder) {
            // Convert offline order format to Order format
            const convertedOrder: Order = {
              id: 0,
              orderNumber: orderNumber || offlineOrder.offlineId,
              customerName: offlineOrder.customerName,
              subtotal: offlineOrder.lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0),
              discountAmount: offlineOrder.lines.reduce((sum, l) => sum + (l.discountAmount || 0), 0),
              totalAmount: offlineOrder.total,
              currency: offlineOrder.currency,
              status: 'pending_sync',
              createdAt: offlineOrder.createdAt,
              createdByName: 'Usuario',
              lines: offlineOrder.lines.map((l, idx) => ({
                id: idx,
                productName: l.productName,
                productSku: l.productSku || '',
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                discountAmount: l.discountAmount || 0,
                total: (l.quantity * l.unitPrice) - (l.discountAmount || 0)
              })),
              payments: offlineOrder.payments.map(p => ({
                method: p.method,
                amount: p.amount,
                currency: p.currency,
                amountTendered: p.amountTendered ?? null,
                changeAmount: p.changeAmount ?? null,
                changeCurrency: p.changeCurrency ?? null
              }))
            }
            setOrder(convertedOrder)
            console.log('[Receipt] Loaded offline order successfully')
          } else {
            // Even if not found, create a basic order from URL params
            console.log('[Receipt] Order not found in IndexedDB, creating from localStorage')

            // Try to get from localStorage as backup
            const paymentDataStr = localStorage.getItem('pos_payment_data')
            if (paymentDataStr) {
              try {
                const paymentData = JSON.parse(paymentDataStr)
                if (paymentData.cart && Array.isArray(paymentData.cart)) {
                  const backupOrder: Order = {
                    id: 0,
                    orderNumber: orderNumber || offlineId || 'OFFLINE',
                    customerName: null,
                    subtotal: paymentData.cart.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + (item.quantity * item.unitPrice), 0),
                    discountAmount: paymentData.cart.reduce((sum: number, item: { discountAmount?: number }) => sum + (item.discountAmount || 0), 0),
                    totalAmount: paymentData.cart.reduce((sum: number, item: { total: number }) => sum + item.total, 0),
                    currency: 'USD',
                    status: 'pending_sync',
                    createdAt: new Date().toISOString(),
                    createdByName: 'Usuario',
                    lines: paymentData.cart.map((item: { productName: string; productSku?: string; quantity: number; unitPrice: number; discountAmount?: number; total: number }, idx: number) => ({
                      id: idx,
                      productName: item.productName,
                      productSku: item.productSku || '',
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      discountAmount: item.discountAmount || 0,
                      total: item.total
                    })),
                    payments: [{ method: 'cash', amount: paymentData.cart.reduce((sum: number, item: { total: number }) => sum + item.total, 0), currency: 'USD' }]
                  }
                  setOrder(backupOrder)
                  setLoading(false)
                  return
                }
              } catch (e) {
                console.error('[Receipt] Error parsing localStorage:', e)
              }
            }

            setError('Orden offline no encontrada')
          }
        } catch (e) {
          console.error('[Receipt] Error loading offline order:', e)
          setError('Error al cargar orden offline')
        } finally {
          setLoading(false)
        }
        return
      }

      // ONLINE ORDER: Fetch from API
      if (!orderId) {
        setError('ID de orden no especificado')
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/market/pos/orders/${orderId}`)
        const data = await res.json()

        if (data.success) {
          // Asegurarnos de que los datos de pago incluyan amountTendered, changeAmount y changeCurrency
          const orderData = {
            ...data.data,
            terminalName: data.data.terminalName,
            payments: data.data.payments.map((p: { method: string; amount: number; currency: string; amountTendered?: number | null; changeAmount?: number | null; changeCurrency?: string | null }) => ({
              method: p.method,
              amount: p.amount,
              currency: p.currency,
              amountTendered: p.amountTendered ?? null,
              changeAmount: p.changeAmount ?? null,
              changeCurrency: p.changeCurrency ?? null
            }))
          }
          setOrder(orderData)
        } else {
          setError(data.error || 'Error al cargar orden')
        }
      } catch (e) {
        console.error('[Receipt] Error fetching order:', e)
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [isClient, orderId, offlineId, isOfflineOrder, orderNumber])

  // Format currency (sin redondeo para CUP)
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (currency === 'CUP') {
      return `${formatCUP(amount)} CUP`
    }
    return `$${amount.toFixed(2)}`
  }

  // Convert USD to CUP (sin redondeo)
  const toCUP = (amountUSD: number): number => {
    return amountUSD * exchangeRate
  }

  // Calculate total CUP (sin redondeo para precisión exacta)
  const calcOrderTotalCUP = (lines: OrderLine[]): number => {
    return lines.reduce((sum, line) => {
      const unitCUP = line.unitPrice * exchangeRate
      const lineCUP = unitCUP * line.quantity
      const discountCUP = line.discountAmount * exchangeRate
      return sum + lineCUP - discountCUP
    }, 0)
  }

  // Format dual currency (USD with CUP equivalent)
  const formatDualCurrency = (amountUSD: number): string => {
    const cup = toCUP(amountUSD)
    return `$${amountUSD.toFixed(2)} (${formatCUP(cup)} CUP)`
  }

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  // Get payment method label
  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      transfer: 'Transferencia',
      credit: 'Crédito'
    }
    return labels[method] || method
  }

  // Print with service (server resolves printer automatically)
  const printWithService = async () => {
    if (!order) return

    setPrintingWithService(true)
    try {
      // IMPORTANTE: El generador espera 'items' con 'name' y 'price'
      const response = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'pos_receipt',
          documentData: {
            receiptNumber: order.orderNumber,
            orderNumber: order.orderNumber, // Para código de barras
            companyName: 'LogiRapid',
            terminalName: order.terminalName, // Nombre del terminal
            date: new Date(order.createdAt).toLocaleDateString('es-ES'),
            time: new Date(order.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            cashierName: order.createdByName,
            customerName: order.customerName,
            items: order.lines.map(l => ({
              name: l.productName,
              quantity: l.quantity,
              price: l.unitPrice,
              originalPrice: l.originalPrice,
              total: l.total
            })),
            subtotal: order.subtotal,
            discount: order.discountAmount,
            total: order.totalAmount,
            // Tasa de cambio
            exchangeRate: exchangeRate,
            exchangeCurrency: 'CUP',
            totalInLocalCurrency: calcOrderTotalCUP(order.lines),
            // Pagos con detalle de efectivo
            payments: order.payments.map(p => ({
              method: p.method === 'cash' ? 'Efectivo' :
                      p.method === 'card' ? 'Tarjeta' :
                      p.method === 'transfer' ? 'Transferencia' :
                      p.method === 'credit' ? 'Crédito' : p.method,
              amount: p.amount,
              currency: p.currency,
              amountTendered: p.amountTendered ?? undefined,
              changeAmount: p.changeAmount ?? undefined,
              changeCurrency: p.changeCurrency ?? undefined
            })),
            thankYouMessage: '¡Gracias por su compra!'
          },
          copies,
          serviceId: defaultPrintServiceId || null,
          posTerminalId: parseInt(terminalId) || null,
          sourceType: 'pos_order',
          sourceId: order.id || 0
        })
      })

      const data = await response.json()
      if (data.success) {
        setShowPrintModal(false)
        // Show success toast or message
      } else {
        throw new Error(data.error)
      }
    } catch (err) {
      console.error('[Receipt] Error printing with service:', err)
      // Fallback to browser print
      printReceipt()
      setShowPrintModal(false)
    } finally {
      setPrintingWithService(false)
    }
  }

  // Print receipt - use print service for online orders, browser for offline
  const handlePrint = async () => {
    console.log('[Receipt] handlePrint called, isOfflineOrder:', isOfflineOrder)

    if (isOfflineOrder) {
      // For offline orders, use browser print
      console.log('[Receipt] Offline order, using browser print')
      printReceipt()
      return
    }

    // For online orders, send to print service (server resolves printer automatically)
    console.log('[Receipt] Online order, sending to print service...')
    await printWithService()
  }

  // Auto-print silently when order loads (if autoPrint=true)
  // Print services are now resolved automatically by the server via /api/print-jobs
  useEffect(() => {
    console.log('[Receipt] Auto-print check:', { order: !!order, hasAutoprinted, autoPrint, isClient, defaultPrintServiceId })
    if (!order || hasAutoprinted || !autoPrint || !isClient) return

    const triggerAutoPrint = async () => {
      setHasAutoprinted(true)
      console.log('[Receipt] Auto-print triggered for order:', order.orderNumber)

      try {
        const printPayload = {
          documentType: 'pos_receipt',
          documentData: {
            receiptNumber: order.orderNumber,
            orderNumber: order.orderNumber,
            companyName: 'LogiRapid',
            terminalName: order.terminalName,
            date: new Date(order.createdAt).toLocaleDateString('es-ES'),
            time: new Date(order.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            cashierName: order.createdByName,
            customerName: order.customerName,
            items: order.lines.map(l => ({
              name: l.productName,
              quantity: l.quantity,
              price: l.unitPrice,
              originalPrice: l.originalPrice,
              total: l.total
            })),
            subtotal: order.subtotal,
            discount: order.discountAmount,
            total: order.totalAmount,
            exchangeRate: exchangeRate,
            exchangeCurrency: 'CUP',
            totalInLocalCurrency: calcOrderTotalCUP(order.lines),
            payments: order.payments.map(p => ({
              method: p.method === 'cash' ? 'Efectivo' :
                      p.method === 'card' ? 'Tarjeta' :
                      p.method === 'transfer' ? 'Transferencia' :
                      p.method === 'credit' ? 'Crédito' : p.method,
              amount: p.amount,
              currency: p.currency,
              amountTendered: p.amountTendered ?? undefined,
              changeAmount: p.changeAmount ?? undefined,
              changeCurrency: p.changeCurrency ?? undefined
            })),
            thankYouMessage: '¡Gracias por su compra!'
          },
          copies: 1,
          serviceId: defaultPrintServiceId || null,
          posTerminalId: parseInt(terminalId) || null,
          sourceType: 'pos_order',
          sourceId: order.id || 0
        }
        console.log('[Receipt] Auto-print payload:', printPayload)

        const printResponse = await fetch('/api/print-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(printPayload)
        })

        const printData = await printResponse.json()
        console.log('[Receipt] Auto-print response:', printData)

        if (printData.success) {
          console.log('[Receipt] Auto-print job sent successfully:', printData.data?.jobNumber)
        } else {
          console.error('[Receipt] Auto-print failed:', printData.error)
        }
      } catch (err) {
        console.error('[Receipt] Auto-print error:', err)
      }
    }

    // Small delay to ensure everything is loaded
    console.log('[Receipt] Scheduling auto-print in 500ms...')
    const timer = setTimeout(triggerAutoPrint, 500)
    return () => clearTimeout(timer)
  }, [order, hasAutoprinted, autoPrint, isClient, exchangeRate, defaultPrintServiceId])

  // Print receipt (browser fallback)
  const printReceipt = () => {
    if (!order) return

    const totalCUP = calcOrderTotalCUP(order.lines)
    const subtotalCUP = order.lines.reduce((sum, line) => {
      return sum + (line.unitPrice * exchangeRate) * line.quantity
    }, 0)

    const receiptContent = `
================================
       RECIBO DE VENTA
================================
Fecha: ${formatDate(order.createdAt)}
Ticket: ${order.orderNumber}
Cajero: ${order.createdByName}
${order.customerName ? `Cliente: ${order.customerName}` : ''}
--------------------------------
${order.lines.map(line => {
  let text = `${line.productName}\n  ${line.quantity} x $${line.unitPrice.toFixed(2)} = $${line.total.toFixed(2)}`
  if (line.originalPrice && line.originalPrice > line.unitPrice) {
    const savings = (line.originalPrice - line.unitPrice) * line.quantity
    text += `\n  Mayorista (antes $${line.originalPrice.toFixed(2)}, ahorro $${savings.toFixed(2)})`
  }
  return text
}).join('\n')}
--------------------------------
Subtotal:    $${order.subtotal.toFixed(2)}
             ${subtotalCUP.toLocaleString('es-ES')} CUP
${order.discountAmount > 0 ? `Descuento:  -$${order.discountAmount.toFixed(2)}` : ''}
--------------------------------
TOTAL:       $${order.totalAmount.toFixed(2)}
             ${totalCUP.toLocaleString('es-ES')} CUP
--------------------------------
Tasa: 1 USD = ${exchangeRate} CUP
--------------------------------
Pagos:
${order.payments.map(p => {
  let line = `  ${getPaymentMethodLabel(p.method)}: $${p.amount.toFixed(2)}`
  if (p.amountTendered && p.amountTendered > 0) {
    line += `\n  Entregado: ${p.currency === 'CUP' ? `${formatCUP(p.amountTendered)} CUP` : `$${p.amountTendered.toFixed(2)} USD`}`
  }
  if (p.changeAmount && p.changeAmount > 0) {
    // Use changeCurrency (not payment currency) for the change amount
    const chgCurrency = p.changeCurrency || p.currency
    line += `\n  Cambio: ${chgCurrency === 'CUP' ? `${formatCUP(p.changeAmount)} CUP` : `$${p.changeAmount.toFixed(2)} USD`}`
  }
  return line
}).join('\n')}
================================
     Gracias por su compra!
================================
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Recibo ${order.orderNumber}</title>
            <style>
              @page { size: 80mm auto; margin: 0; }
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                padding: 5mm;
                margin: 0;
                width: 70mm;
              }
              pre {
                white-space: pre-wrap;
                margin: 0;
              }
            </style>
          </head>
          <body>
            <pre>${receiptContent}</pre>
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  // Render barcode on receipt preview
  useEffect(() => {
    if (!order || !isClient) return
    const el = document.getElementById('receipt-barcode-svg')
    if (!el) return

    // Dynamically load JsBarcode
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
    script.onload = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).JsBarcode('#receipt-barcode-svg', order.orderNumber, {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: theme === 'dark' ? '#9ca3af' : '#374151'
        })
      } catch (e) {
        console.log('[Receipt] Barcode render error:', e)
      }
    }
    document.head.appendChild(script)
    return () => {
      try { document.head.removeChild(script) } catch {}
    }
  }, [order, isClient, theme])

  // Navigate back to POS
  const newOrder = () => {
    // Clear payment data
    try {
      localStorage.removeItem('pos_payment_data')
    } catch (e) {
      console.error('[Receipt] Error clearing localStorage:', e)
    }
    router.push(`/dashboard/market/pos/${terminalId}`)
  }

  // Show loading
  if (!isClient || loading) {
    const loadingBg = getThemeFromStorage() === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
    return (
      <div className={`min-h-screen flex items-center justify-center ${loadingBg}`}>
        <LoaderIcon />
      </div>
    )
  }

  // Show error
  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tc.bg} ${tc.text}`}>
        <div className="text-center">
          <AlertIcon />
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={newOrder}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Volver al POS
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen flex flex-col ${tc.bg} ${tc.text}`}>
      {/* Success Header */}
      <div className="py-8 text-center">
        <CheckIcon />
        <h1 className="text-2xl font-bold mb-2">Pago Completado</h1>
        <p className={tc.textMuted}>Orden #{order?.orderNumber}</p>

        {/* Offline Order Badge */}
        {isOfflineOrder && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30">
            <ClockIcon />
            <span className="text-sm text-yellow-400">
              Pendiente de sincronizar
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Receipt Preview */}
          <div className={`rounded-xl shadow-lg overflow-hidden ${tc.bgCard}`}>
            <div className="p-6 font-mono text-sm">
              <div className="text-center mb-4">
                <p className="font-bold text-lg">RECIBO DE VENTA</p>
                <p className={tc.textMuted}>{formatDate(order?.createdAt || '')}</p>
              </div>

              <div className="flex justify-between mb-2">
                <span>Ticket:</span>
                <span className="font-bold">{order?.orderNumber}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span>Cajero:</span>
                <span>{order?.createdByName}</span>
              </div>

              <div className={`border-t border-b ${tc.border} py-4 my-4 space-y-2`}>
                {order?.lines.map((line, idx) => {
                  const lineCUP = (line.unitPrice * exchangeRate) * line.quantity
                  const hasWholesale = line.originalPrice && line.originalPrice > line.unitPrice
                  return (
                    <div key={idx}>
                      <div className="flex justify-between">
                        <span className="font-medium truncate flex-1">{line.productName} x{line.quantity}</span>
                        <div className="ml-2 text-right">
                          <span>{formatCurrency(line.total)}</span>
                          <span className="text-xs text-green-500 ml-1">
                            ({formatCUP(lineCUP)} CUP)
                          </span>
                        </div>
                      </div>
                      {hasWholesale && (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 pl-2">
                          Mayorista (antes {formatCurrency(line.originalPrice!)}, ahorro {formatCurrency((line.originalPrice! - line.unitPrice) * line.quantity)})
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(order?.subtotal || 0)}</span>
                </div>
                {(order?.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-green-500">
                    <span>Descuento:</span>
                    <span>-{formatCurrency(order?.discountAmount || 0)}</span>
                  </div>
                )}
                <div className={`flex flex-col pt-2 border-t ${tc.border}`}>
                  <div className="flex justify-between text-xl font-bold">
                    <span>TOTAL:</span>
                    <div className="text-right">
                      <span>{formatCurrency(order?.totalAmount || 0)}</span>
                      <p className="text-sm font-normal text-green-500">
                        {calcOrderTotalCUP(order?.lines || []).toLocaleString('es-ES')} CUP
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Exchange Rate Info */}
              <div className={`text-center text-xs ${tc.textMuted} mt-2`}>
                Tasa: 1 USD = {exchangeRate.toLocaleString('es-ES')} CUP
              </div>

              <div className={`border-t ${tc.border} pt-4 mt-4`}>
                <p className={`${tc.textMuted} mb-2`}>Pagos:</p>
                {order?.payments.map((payment, idx) => (
                  <div key={idx} className="space-y-1">
                    {/* Método de pago - solo $ y número */}
                    <div className="flex justify-between">
                      <span>{getPaymentMethodLabel(payment.method)}:</span>
                      <span>${payment.amount.toFixed(2)}</span>
                    </div>
                    {/* Entregado - con símbolo de moneda */}
                    {payment.amountTendered && payment.amountTendered > 0 && (
                      <div className={`flex justify-between text-sm ${tc.textMuted}`}>
                        <span className="ml-4">Entregado:</span>
                        <span>
                          {payment.currency === 'CUP'
                            ? `${formatCUP(payment.amountTendered)} CUP`
                            : `$${payment.amountTendered.toFixed(2)} USD`}
                        </span>
                      </div>
                    )}
                    {/* Cambio - con símbolo de moneda (usa changeCurrency, no payment.currency) */}
                    {payment.changeAmount && payment.changeAmount > 0 && (
                      <div className={`flex justify-between text-sm font-medium text-green-500`}>
                        <span className="ml-4">Cambio:</span>
                        <span>
                          {(payment.changeCurrency || payment.currency) === 'CUP'
                            ? `${formatCUP(payment.changeAmount)} CUP`
                            : `$${payment.changeAmount.toFixed(2)} USD`}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Barcode for scanning at door */}
              <div className="flex flex-col items-center mt-6 pt-4 border-t border-dashed" style={{ borderColor: theme === 'dark' ? '#374151' : '#d1d5db' }}>
                <svg id="receipt-barcode-svg" className="mb-1"></svg>
                <p className={`text-xs ${tc.textMuted}`}>{order?.orderNumber}</p>
              </div>

              <p className={`text-center ${tc.textMuted} mt-4`}>
                Gracias por su compra!
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handlePrint}
              className={`p-4 rounded-xl flex items-center justify-center gap-2 font-medium shadow-lg ${tc.bgCard} ${tc.button}`}
            >
              <PrinterIcon />
              Imprimir
            </button>

            <button
              onClick={newOrder}
              className="p-4 rounded-xl flex items-center justify-center gap-2 font-medium bg-blue-500 text-white hover:bg-blue-600 shadow-lg"
            >
              <CartIcon />
              Nueva Orden
            </button>
          </div>
        </div>
      </div>

      {/* Print Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowPrintModal(false)}>
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${tc.bgCard}`} onClick={e => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b ${tc.border} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-900/30">
                  <PrinterIcon />
                </div>
                <div>
                  <h3 className="font-semibold">Imprimir Recibo</h3>
                  <p className={`text-xs ${tc.textMuted}`}>#{order?.orderNumber}</p>
                </div>
              </div>
              <button onClick={() => setShowPrintModal(false)} className={`p-2 rounded-lg ${tc.button}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className={`block text-sm font-medium ${tc.textMuted} mb-2`}>Copias</label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    className={`w-10 h-10 rounded-xl ${tc.button} flex items-center justify-center`}
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-xl font-bold">{copies}</span>
                  <button
                    onClick={() => setCopies(Math.min(5, copies + 1))}
                    className={`w-10 h-10 rounded-xl ${tc.button} flex items-center justify-center`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className={`px-6 py-4 border-t ${tc.border} flex gap-3`}>
              <button
                onClick={() => { setShowPrintModal(false); printReceipt(); }}
                className={`flex-1 py-3 rounded-xl font-medium ${tc.button}`}
              >
                Navegador
              </button>
              <button
                onClick={printWithService}
                disabled={printingWithService}
                className="flex-1 py-3 rounded-xl font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {printingWithService ? (
                  <LoaderIcon />
                ) : (
                  <>
                    <PrinterIcon />
                    Imprimir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Loading fallback
function LoadingFallback() {
  const theme = getThemeFromStorage()
  const bgClass = theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
  return (
    <div className={`min-h-screen flex items-center justify-center ${bgClass}`}>
      <LoaderIcon />
    </div>
  )
}

// Wrapper that extracts terminalId for error boundary
function ReceiptPageWithErrorBoundary() {
  const params = useParams()
  const terminalId = (params.terminalId as string) || '1'

  return (
    <ReceiptErrorBoundary terminalId={terminalId}>
      <Suspense fallback={<LoadingFallback />}>
        <ReceiptContent />
      </Suspense>
    </ReceiptErrorBoundary>
  )
}

// Main page export
export default function ReceiptPage() {
  // Use client-side only rendering to avoid hydration issues
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <LoadingFallback />
  }

  return <ReceiptPageWithErrorBoundary />
}
