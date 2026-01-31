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
  const [printServices, setPrintServices] = useState<Array<{ id: number; serviceName: string; printers: Array<{ id: number; printerName: string; isOnline: boolean; isDefault: boolean; printerType: string }> }>>([])
  const [selectedPrinter, setSelectedPrinter] = useState<{ serviceId: number; printerId: number } | null>(null)
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
                currency: p.currency
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
          // Asegurarnos de que los datos de pago incluyan amountTendered y changeAmount
          const orderData = {
            ...data.data,
            terminalName: data.data.terminalName,
            payments: data.data.payments.map((p: { method: string; amount: number; currency: string; amountTendered?: number | null; changeAmount?: number | null }) => ({
              method: p.method,
              amount: p.amount,
              currency: p.currency,
              amountTendered: p.amountTendered ?? null,
              changeAmount: p.changeAmount ?? null
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

  // Fetch print services for silent printing
  // IMPORTANT: Filters by terminal's configured print service (defaultPrintServiceId)
  // and only shows printers that support 'pos_receipt' document type
  const fetchPrintServices = async (): Promise<{ services: typeof printServices; thermalPrinters: Array<{ serviceId: number; printer: { id: number; printerName: string; isOnline: boolean; isDefault: boolean; printerType: string; supportedDocumentTypes?: string[] } }> }> => {
    try {
      console.log('[Receipt] Fetching print services...')
      console.log('[Receipt] Terminal defaultPrintServiceId:', defaultPrintServiceId)

      const response = await fetch('/api/print/services')

      if (!response.ok) {
        console.error('[Receipt] API error:', response.status, response.statusText)
        return { services: [], thermalPrinters: [] }
      }

      const data = await response.json()

      if (data.success && data.data?.services) {
        let allServices = data.data.services
        console.log('[Receipt] Total services from API:', allServices.length)

        // FILTER BY TERMINAL'S CONFIGURED PRINT SERVICE
        if (defaultPrintServiceId) {
          console.log('[Receipt] Filtering by terminal print service ID:', defaultPrintServiceId)
          allServices = allServices.filter((s: { id: number }) => s.id === defaultPrintServiceId)
          console.log('[Receipt] Services after filtering by terminal config:', allServices.length)
        }

        // Log each service for debugging
        allServices.forEach((s: { id: number; serviceCode: string; serviceName: string; status: string; printers?: Array<{ printerName: string; printerType: string; isOnline: boolean; supportedDocumentTypes?: string[] }> }) => {
          console.log(`[Receipt] Service: ${s.serviceCode} (${s.serviceName}) ID:${s.id} - Status: ${s.status} - Printers: ${s.printers?.length || 0}`)
          s.printers?.forEach(p => {
            console.log(`  - Printer: ${p.printerName} | Type: ${p.printerType} | Online: ${p.isOnline} | Supports: ${p.supportedDocumentTypes?.join(', ') || 'all'}`)
          })
        })

        // Accept active, pending, or offline services (offline is just heartbeat indicator)
        const activeServices = allServices.filter(
          (s: { status: string; printers?: unknown[] }) =>
            (s.status === 'active' || s.status === 'pending' || s.status === 'offline') &&
            s.printers && s.printers.length > 0
        )
        console.log('[Receipt] Active services with printers:', activeServices.length)

        // Filter printers that support pos_receipt document type
        // A printer supports pos_receipt if:
        // 1. supportedDocumentTypes includes 'pos_receipt', OR
        // 2. supportedDocumentTypes is empty/undefined (supports all types), OR
        // 3. printerType is thermal/receipt type
        const supportsReceipt = (p: { printerType: string; printerName: string; supportedDocumentTypes?: string[] }) => {
          // If printer has supportedDocumentTypes configured, check if pos_receipt is included
          if (p.supportedDocumentTypes && p.supportedDocumentTypes.length > 0) {
            return p.supportedDocumentTypes.includes('pos_receipt')
          }
          // If no supportedDocumentTypes, check by type (thermal printers)
          const thermalTypes = ['thermal_80mm', 'thermal_58mm', 'pos', 'receipt', 'thermal']
          const type = (p.printerType || '').toLowerCase()
          const name = (p.printerName || '').toLowerCase()
          if (thermalTypes.includes(type)) return true
          if (name.includes('tm-t') || name.includes('tm-m') || name.includes('tsp') ||
              name.includes('receipt') || name.includes('ticket') || name.includes('thermal') ||
              name.includes('termica') || name.includes('pos')) return true
          return false
        }

        const servicesWithReceiptPrinters = activeServices.map((service: { id: number; serviceName: string; serviceCode: string; printers: Array<{ id: number; printerName: string; isOnline: boolean; isDefault: boolean; printerType: string; supportedDocumentTypes?: string[] }> }) => ({
          ...service,
          printers: service.printers.filter(supportsReceipt)
        })).filter((s: { printers: unknown[] }) => s.printers.length > 0)

        console.log('[Receipt] Services with receipt printers:', servicesWithReceiptPrinters.length)

        setPrintServices(servicesWithReceiptPrinters)

        // Collect all receipt printers
        const thermalPrinters: Array<{ serviceId: number; printer: { id: number; printerName: string; isOnline: boolean; isDefault: boolean; printerType: string; supportedDocumentTypes?: string[] } }> = []
        for (const service of servicesWithReceiptPrinters) {
          for (const printer of service.printers) {
            console.log('[Receipt] Found receipt printer:', printer.printerName, 'service:', service.serviceName)
            thermalPrinters.push({ serviceId: service.id, printer })
          }
        }

        // Auto-select first receipt printer
        if (thermalPrinters.length > 0) {
          console.log('[Receipt] Auto-selecting printer:', thermalPrinters[0].printer.printerName)
          setSelectedPrinter({ serviceId: thermalPrinters[0].serviceId, printerId: thermalPrinters[0].printer.id })
        } else {
          console.log('[Receipt] NO receipt printers found for terminal! Check terminal print service configuration.')
        }

        console.log('[Receipt] Total receipt printers found:', thermalPrinters.length)
        return { services: servicesWithReceiptPrinters, thermalPrinters }
      }
      console.log('[Receipt] No services found in response or API failed:', data.error)
      return { services: [], thermalPrinters: [] }
    } catch (err) {
      console.error('[Receipt] Error fetching print services:', err)
      return { services: [], thermalPrinters: [] }
    }
  }

  // Print with silent service
  const printWithService = async () => {
    if (!order || !selectedPrinter) return

    setPrintingWithService(true)
    try {
      // IMPORTANTE: El generador espera 'items' con 'name' y 'price'
      const response = await fetch('/api/print/jobs', {
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
              changeAmount: p.changeAmount ?? undefined
            })),
            thankYouMessage: '¡Gracias por su compra!'
          },
          copies,
          printServiceId: selectedPrinter.serviceId,
          printerId: selectedPrinter.printerId,
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

  // Open print modal or use browser print if offline
  const handlePrint = async () => {
    console.log('[Receipt] handlePrint called, isOfflineOrder:', isOfflineOrder)

    if (isOfflineOrder) {
      // For offline orders, use browser print
      console.log('[Receipt] Offline order, using browser print')
      printReceipt()
      return
    }

    // For online orders, try to use print service
    console.log('[Receipt] Online order, fetching print services...')
    const { thermalPrinters } = await fetchPrintServices()
    console.log('[Receipt] Found', thermalPrinters.length, 'thermal printers')

    // Si hay exactamente una impresora térmica, imprimir silenciosamente
    if (thermalPrinters.length === 1) {
      console.log('[Receipt] Solo una impresora térmica, imprimiendo silenciosamente')
      setSelectedPrinter({ serviceId: thermalPrinters[0].serviceId, printerId: thermalPrinters[0].printer.id })
      // Imprimir directamente
      setPrintingWithService(true)
      try {
        // IMPORTANTE: El generador espera 'items' con 'name' y 'price', no 'lines' con 'productName' y 'unitPrice'
        const printPayload = {
          documentType: 'pos_receipt',
          documentData: {
            receiptNumber: order?.orderNumber,
            orderNumber: order?.orderNumber, // Para código de barras
            companyName: 'LogiRapid',
            terminalName: order?.terminalName, // Nombre del terminal
            date: new Date(order?.createdAt || new Date()).toLocaleDateString('es-ES'),
            time: new Date(order?.createdAt || new Date()).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            cashierName: order?.createdByName,
            customerName: order?.customerName,
            items: order?.lines.map(l => ({
              name: l.productName,
              quantity: l.quantity,
              price: l.unitPrice,
              originalPrice: l.originalPrice,
              total: l.total
            })),
            subtotal: order?.subtotal,
            discount: order?.discountAmount,
            total: order?.totalAmount,
            // Tasa de cambio
            exchangeRate: exchangeRate,
            exchangeCurrency: 'CUP',
            totalInLocalCurrency: calcOrderTotalCUP(order?.lines || []),
            // Pagos con detalle de efectivo
            payments: order?.payments.map(p => ({
              method: p.method === 'cash' ? 'Efectivo' :
                      p.method === 'card' ? 'Tarjeta' :
                      p.method === 'transfer' ? 'Transferencia' :
                      p.method === 'credit' ? 'Crédito' : p.method,
              amount: p.amount,
              currency: p.currency,
              amountTendered: p.amountTendered ?? undefined,
              changeAmount: p.changeAmount ?? undefined
            })),
            thankYouMessage: '¡Gracias por su compra!'
          },
          copies: 1,
          printServiceId: thermalPrinters[0].serviceId,
          printerId: thermalPrinters[0].printer.id,
          sourceType: 'pos_order',
          sourceId: order?.id || 0
        }
        console.log('[Receipt] Sending print job:', printPayload)

        const response = await fetch('/api/print/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(printPayload)
        })

        const data = await response.json()
        console.log('[Receipt] Print job response:', data)

        if (data.success) {
          console.log('[Receipt] Impresión silenciosa exitosa')
          alert('Recibo enviado a imprimir')
        } else {
          console.error('[Receipt] Error en impresión silenciosa:', data.error)
          alert('Error al enviar a imprimir: ' + data.error)
          // Fallback to browser print
          printReceipt()
        }
      } catch (err) {
        console.error('[Receipt] Error imprimiendo:', err)
        alert('Error de conexión al imprimir')
        printReceipt()
      } finally {
        setPrintingWithService(false)
      }
    } else if (thermalPrinters.length > 1) {
      // Más de una impresora, mostrar modal para seleccionar
      console.log('[Receipt] Múltiples impresoras, mostrando modal')
      setShowPrintModal(true)
    } else {
      // No hay impresoras térmicas, usar navegador
      console.log('[Receipt] No hay impresoras térmicas, usando navegador')
      printReceipt()
    }
  }

  // Auto-print silently when order loads (if autoPrint=true)
  useEffect(() => {
    console.log('[Receipt] Auto-print check:', { order: !!order, hasAutoprinted, autoPrint, isClient, defaultPrintServiceId })
    if (!order || hasAutoprinted || !autoPrint || !isClient) return

    const triggerAutoPrint = async () => {
      setHasAutoprinted(true)
      console.log('[Receipt] Auto-print triggered for order:', order.orderNumber)
      console.log('[Receipt] Using terminal print service ID:', defaultPrintServiceId)

      try {
        // Fetch print services
        console.log('[Receipt] Fetching print services for auto-print...')
        const response = await fetch('/api/print/services')
        const data = await response.json()

        if (data.success && data.data?.services) {
          let allServices = data.data.services

          // FILTER BY TERMINAL'S CONFIGURED PRINT SERVICE
          if (defaultPrintServiceId) {
            console.log('[Receipt] Auto-print: Filtering by terminal print service ID:', defaultPrintServiceId)
            allServices = allServices.filter((s: { id: number }) => s.id === defaultPrintServiceId)
            console.log('[Receipt] Auto-print: Services after filtering:', allServices.length)
          }

          // Accept active, pending, or offline services
          const activeServices = allServices.filter(
            (s: { status: string; printers?: unknown[] }) =>
              (s.status === 'active' || s.status === 'pending' || s.status === 'offline') &&
              s.printers && s.printers.length > 0
          )
          console.log('[Receipt] Auto-print active services:', activeServices.length)

          // Find first printer that supports pos_receipt
          const supportsReceipt = (p: { printerType: string; printerName: string; supportedDocumentTypes?: string[] }) => {
            if (p.supportedDocumentTypes && p.supportedDocumentTypes.length > 0) {
              return p.supportedDocumentTypes.includes('pos_receipt')
            }
            const thermalTypes = ['thermal_80mm', 'thermal_58mm', 'pos', 'receipt', 'thermal']
            const type = (p.printerType || '').toLowerCase()
            const name = (p.printerName || '').toLowerCase()
            if (thermalTypes.includes(type)) return true
            if (name.includes('tm-t') || name.includes('tm-m') || name.includes('tsp') ||
                name.includes('receipt') || name.includes('ticket') || name.includes('thermal') ||
                name.includes('termica') || name.includes('pos')) return true
            return false
          }

          let receiptPrinter = null
          let serviceId = null

          for (const service of activeServices) {
            console.log('[Receipt] Checking service:', service.serviceName, 'ID:', service.id, 'printers:', service.printers?.length)
            for (const p of service.printers) {
              console.log(`[Receipt]   Printer: ${p.printerName} | Type: "${p.printerType}" | supportsReceipt: ${supportsReceipt(p)}`)
            }
            const printer = service.printers.find(supportsReceipt)
            if (printer) {
              receiptPrinter = printer
              serviceId = service.id
              console.log('[Receipt] Found receipt printer:', printer.printerName)
              break
            }
          }

          if (receiptPrinter && serviceId) {
            console.log('[Receipt] Auto-printing to:', receiptPrinter.printerName)

            // Send print job silently
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
                  changeAmount: p.changeAmount ?? undefined
                })),
                thankYouMessage: '¡Gracias por su compra!'
              },
              copies: 1,
              printServiceId: serviceId,
              printerId: receiptPrinter.id,
              sourceType: 'pos_order',
              sourceId: order.id || 0
            }
            console.log('[Receipt] Auto-print payload:', printPayload)

            const printResponse = await fetch('/api/print/jobs', {
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
          } else {
            console.log('[Receipt] No receipt printer available for auto-print. Check terminal print service configuration.')
          }
        } else {
          console.log('[Receipt] No services in response for auto-print')
        }
      } catch (err) {
        console.error('[Receipt] Auto-print error:', err)
      }
    }

    // Small delay to ensure everything is loaded (including terminal print config)
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
    line += `\n  Cambio: ${p.currency === 'CUP' ? `${formatCUP(p.changeAmount)} CUP` : `$${p.changeAmount.toFixed(2)} USD`}`
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
                    {/* Cambio - con símbolo de moneda */}
                    {payment.changeAmount && payment.changeAmount > 0 && (
                      <div className={`flex justify-between text-sm font-medium text-green-500`}>
                        <span className="ml-4">Cambio:</span>
                        <span>
                          {payment.currency === 'CUP'
                            ? `${formatCUP(payment.changeAmount)} CUP`
                            : `$${payment.changeAmount.toFixed(2)} USD`}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p className={`text-center ${tc.textMuted} mt-6`}>
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
              {printServices.length === 0 ? (
                <div className="text-center py-4">
                  <p className={`${tc.textMuted} mb-4`}>No hay servicio de impresión disponible</p>
                  <button
                    onClick={() => { setShowPrintModal(false); printReceipt(); }}
                    className={`px-4 py-2 rounded-lg ${tc.button}`}
                  >
                    Usar impresión del navegador
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className={`block text-sm font-medium ${tc.textMuted} mb-2`}>Impresora</label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {printServices.map(service => (
                        service.printers.map(printer => (
                          <button
                            key={`${service.id}-${printer.id}`}
                            onClick={() => setSelectedPrinter({ serviceId: service.id, printerId: printer.id })}
                            className={`w-full p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                              selectedPrinter?.printerId === printer.id
                                ? 'border-blue-500 bg-blue-900/20'
                                : `${tc.border} ${tc.button}`
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <PrinterIcon />
                              <div>
                                <p className="font-medium">{printer.printerName}</p>
                                <p className={`text-xs ${tc.textMuted}`}>
                                  {printer.printerType === 'thermal_80mm' ? 'Térmica 80mm' : 'Estándar'}
                                </p>
                              </div>
                            </div>
                            {printer.isOnline ? (
                              <span className="text-xs text-green-400">Online</span>
                            ) : (
                              <span className={`text-xs ${tc.textMuted}`}>Offline</span>
                            )}
                          </button>
                        ))
                      ))}
                    </div>
                  </div>

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
                </>
              )}
            </div>

            {printServices.length > 0 && (
              <div className={`px-6 py-4 border-t ${tc.border} flex gap-3`}>
                <button
                  onClick={() => { setShowPrintModal(false); printReceipt(); }}
                  className={`flex-1 py-3 rounded-xl font-medium ${tc.button}`}
                >
                  Navegador
                </button>
                <button
                  onClick={printWithService}
                  disabled={printingWithService || !selectedPrinter}
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
            )}
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
