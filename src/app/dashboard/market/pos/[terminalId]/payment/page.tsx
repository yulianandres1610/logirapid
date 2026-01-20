'use client'

import React, { useState, useEffect, useMemo, Suspense, Component, ReactNode } from 'react'
import { useRouter, useParams } from 'next/navigation'

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
    input: 'bg-gray-700 border-gray-600',
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

class PaymentErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[Payment ErrorBoundary] Error:', error, errorInfo)
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

// Generate offline ID
const getOfflineId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// IndexedDB constants
const DB_NAME = 'market_pos_db'
const DB_VERSION = 1
const PENDING_ORDERS_STORE = 'pending_orders'

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

// Save pending order to IndexedDB
const saveOrderToIndexedDB = async (order: PendingOrderData): Promise<void> => {
  if (typeof window === 'undefined') return

  try {
    const db = await openPOSDB()
    const tx = db.transaction(PENDING_ORDERS_STORE, 'readwrite')
    const store = tx.objectStore(PENDING_ORDERS_STORE)

    store.put(order)

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    db.close()
    console.log('[Payment] Order saved to IndexedDB:', order.offlineId)
  } catch (error) {
    console.error('[Payment] Error saving to IndexedDB:', error)
    throw error
  }
}

// Interfaces
interface CartItem {
  productId: number
  productName: string
  productSku: string
  quantity: number
  unitPrice: number
  discountPercent: number
  discountAmount: number
  total: number
}

interface Payment {
  id: string
  method: 'cash' | 'card' | 'transfer' | 'credit'
  currency: 'USD' | 'CUP' | 'MLC'
  amount: number
  amountInUSD: number
}

interface PendingOrderData {
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
    productSku: string
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
    reference?: string
  }>
  total: number
  createdAt: string
  synced: boolean
}

interface ExchangeRates {
  CUP: number       // ElToque (para costo)
  CUP_BCC: number   // BCC Banco Central (para venta)
  MLC: number
}

// Default exchange rates (actualizadas desde API externa)
const DEFAULT_RATES: ExchangeRates = {
  CUP: 440,
  CUP_BCC: 411,  // Tasa BCC para venta
  MLC: 1.11
}

// Simple SVG icons inline
const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
)

const CashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
)

const CardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
)

const TransferIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
)

const CreditIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const LoaderIcon = () => (
  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
)

const WifiIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
  </svg>
)

const WifiOffIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
  </svg>
)

const AlertIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const BigLoaderIcon = () => (
  <svg className="w-12 h-12 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
)

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Efectivo', Icon: CashIcon, offlineEnabled: true },
  { id: 'card', label: 'Tarjeta', Icon: CardIcon, offlineEnabled: false },
  { id: 'transfer', label: 'Transferencia', Icon: TransferIcon, offlineEnabled: true },
  { id: 'credit', label: 'Crédito', Icon: CreditIcon, offlineEnabled: true }
]

const CURRENCIES = [
  { id: 'USD', label: 'USD', symbol: '$' },
  { id: 'CUP', label: 'CUP', symbol: '$' },
  { id: 'MLC', label: 'MLC', symbol: '€' }
]

function PaymentContent() {
  const router = useRouter()
  const params = useParams()
  const terminalId = params.terminalId as string

  // State
  const [isClient, setIsClient] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [theme, setTheme] = useState<Theme>('dark')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [warehouseId, setWarehouseId] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'card' | 'transfer' | 'credit'>('cash')
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'CUP' | 'MLC'>('USD')
  const [amount, setAmount] = useState('')
  const [changeCurrency, setChangeCurrency] = useState<'USD' | 'CUP'>('USD')
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_RATES)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<string[]>(['cash', 'card', 'transfer', 'credit'])
  const [allowedCurrencies, setAllowedCurrencies] = useState<string[]>(['USD', 'CUP', 'MLC'])

  // Initialize client-side
  useEffect(() => {
    setIsClient(true)
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)
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

  // Load cart data from localStorage
  useEffect(() => {
    if (!isClient) return

    try {
      const paymentDataStr = localStorage.getItem('pos_payment_data')
      if (paymentDataStr) {
        const paymentData = JSON.parse(paymentDataStr)
        const isDataFresh = paymentData.timestamp && (Date.now() - paymentData.timestamp) < 3600000

        if (paymentData.cart && Array.isArray(paymentData.cart) && paymentData.cart.length > 0 && isDataFresh) {
          setCart(paymentData.cart)
          setSessionId(paymentData.sessionId?.toString() || null)
          setWarehouseId(paymentData.warehouseId?.toString() || null)
          setError(null)
          console.log('[Payment] Loaded cart from localStorage:', paymentData.cart.length, 'items')
        } else {
          setError('Datos del carrito expirados o inválidos')
        }
      } else {
        setError('No hay datos del carrito')
      }
    } catch (e) {
      console.error('[Payment] Error loading cart:', e)
      setError('Error al cargar datos del carrito')
    }
  }, [isClient])

  // Load terminal configuration (payment methods & currencies)
  useEffect(() => {
    if (!isClient || !terminalId) return

    const loadTerminalConfig = async () => {
      try {
        // Try to get from localStorage cache first
        const cachedConfig = localStorage.getItem(`pos_terminal_config_${terminalId}`)
        if (cachedConfig) {
          const config = JSON.parse(cachedConfig)
          if (Array.isArray(config.paymentMethods) && config.paymentMethods.length > 0) {
            setAllowedPaymentMethods(config.paymentMethods)
            // Set initial method to first allowed method
            const firstAllowed = config.paymentMethods[0] as 'cash' | 'card' | 'transfer' | 'credit'
            setSelectedMethod(firstAllowed)
          }
          if (Array.isArray(config.acceptedCurrencies) && config.acceptedCurrencies.length > 0) {
            setAllowedCurrencies(config.acceptedCurrencies)
            if (config.defaultCurrency) {
              setSelectedCurrency(config.defaultCurrency as 'USD' | 'CUP' | 'MLC')
            }
          }
        }

        // If online, fetch fresh config
        if (navigator.onLine) {
          const response = await fetch(`/api/market/pos/terminals/${terminalId}`)
          const data = await response.json()
          if (data.success && data.data) {
            const terminal = data.data
            if (Array.isArray(terminal.paymentMethods) && terminal.paymentMethods.length > 0) {
              setAllowedPaymentMethods(terminal.paymentMethods)
              // Set initial method to first allowed method if current is not allowed
              if (!terminal.paymentMethods.includes(selectedMethod)) {
                setSelectedMethod(terminal.paymentMethods[0] as 'cash' | 'card' | 'transfer' | 'credit')
              }
            }
            if (Array.isArray(terminal.acceptedCurrencies) && terminal.acceptedCurrencies.length > 0) {
              setAllowedCurrencies(terminal.acceptedCurrencies)
              if (terminal.defaultCurrency && !terminal.acceptedCurrencies.includes(selectedCurrency)) {
                setSelectedCurrency(terminal.defaultCurrency as 'USD' | 'CUP' | 'MLC')
              }
            }
            // Cache the config
            localStorage.setItem(`pos_terminal_config_${terminalId}`, JSON.stringify({
              paymentMethods: terminal.paymentMethods,
              acceptedCurrencies: terminal.acceptedCurrencies,
              defaultCurrency: terminal.defaultCurrency
            }))
          }
        }
      } catch (e) {
        console.error('[Payment] Error loading terminal config:', e)
      }
    }

    loadTerminalConfig()
  }, [isClient, terminalId])

  // Load exchange rates
  useEffect(() => {
    if (!isClient) return

    // Try to get cached rates first
    try {
      const cachedRates = localStorage.getItem('pos_exchange_rates')
      if (cachedRates) {
        setRates(JSON.parse(cachedRates))
      }
    } catch {
      // Use defaults
    }

    // If online, fetch fresh rates from external API
    if (navigator.onLine) {
      fetch('/api/market/pos/exchange-rates')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.rates) {
            const newRates = {
              CUP: data.rates.CUP || DEFAULT_RATES.CUP,
              CUP_BCC: data.rates.CUP_BCC || DEFAULT_RATES.CUP_BCC,
              MLC: data.rates.MLC || DEFAULT_RATES.MLC
            }
            setRates(newRates)
            localStorage.setItem('pos_exchange_rates', JSON.stringify(newRates))
            console.log('[Payment] Rates updated:', newRates, 'Source:', data.source || 'unknown')
          }
        })
        .catch(e => console.error('[Payment] Error fetching rates:', e))
    }
  }, [isClient])

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const discount = cart.reduce((sum, item) => sum + item.discountAmount, 0)
    const total = subtotal - discount
    return { subtotal, discount, total }
  }, [cart])

  // Calculate total paid in USD
  const totalPaidUSD = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amountInUSD, 0)
  }, [payments])

  // Saldo pendiente (sin redondear para mostrar valor exacto)
  const remainingUSD = totals.total - totalPaidUSD
  // Tolerancia de 1 centavo para diferencias de conversión CUP/MLC
  const isFullyPaid = remainingUSD <= 0.01

  // Calculate change - valor exacto sin redondear
  const changeAmount = useMemo(() => {
    if (remainingUSD < -0.01) {
      const changeUSD = Math.abs(remainingUSD)
      if (changeCurrency === 'CUP') {
        return changeUSD * rates.CUP_BCC  // Usar tasa BCC para venta
      }
      return changeUSD
    }
    return 0
  }, [remainingUSD, changeCurrency, rates])

  // Convert amount to USD (usando tasa BCC para venta)
  const convertToUSD = (amount: number, currency: 'USD' | 'CUP' | 'MLC'): number => {
    switch (currency) {
      case 'CUP': return amount / rates.CUP_BCC  // Usar tasa BCC para venta
      case 'MLC': return amount / rates.MLC
      default: return amount
    }
  }

  // Add payment
  const addPayment = () => {
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return

    const amountInUSD = convertToUSD(numAmount, selectedCurrency)

    const newPayment: Payment = {
      id: Date.now().toString(),
      method: selectedMethod,
      currency: selectedCurrency,
      amount: numAmount,
      amountInUSD
    }

    setPayments([...payments, newPayment])
    setAmount('')
  }

  // Remove payment
  const removePayment = (id: string) => {
    setPayments(payments.filter(p => p.id !== id))
  }

  // Set exact amount - valor exacto (usando tasa BCC para venta)
  const setExactAmount = () => {
    if (remainingUSD > 0.01) {
      let exactAmount = remainingUSD
      if (selectedCurrency === 'CUP') {
        exactAmount = remainingUSD * rates.CUP_BCC  // Usar tasa BCC para venta
      } else if (selectedCurrency === 'MLC') {
        exactAmount = remainingUSD * rates.MLC
      }
      // Mostrar con 2 decimales para USD/MLC, entero para CUP
      if (selectedCurrency === 'CUP') {
        setAmount(String(Math.round(exactAmount)))
      } else {
        setAmount(exactAmount.toFixed(2))
      }
    }
  }

  // Process payment
  const processPayment = async () => {
    if (!isFullyPaid || !sessionId) return

    setProcessing(true)
    setError(null)

    try {
      const orderLines = cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount
      }))

      const orderPayments = payments.map(p => ({
        method: p.method,
        amount: p.amountInUSD,
        currency: p.currency,
        amountTendered: p.method === 'cash' ? p.amount : null,
        changeAmount: changeAmount > 0 ? (changeCurrency === 'USD' ? changeAmount : changeAmount / rates.CUP_BCC) : null
      }))

      // OFFLINE MODE: Save to IndexedDB
      if (!isOnline) {
        console.log('[Payment] Offline mode - saving locally')

        const offlineId = getOfflineId()
        const offlineOrder: PendingOrderData = {
          offlineId,
          terminalId: parseInt(terminalId),
          sessionId: parseInt(sessionId),
          warehouseId: warehouseId ? parseInt(warehouseId) : null,
          customerId: null,
          customerName: null,
          currency: 'USD',
          lines: orderLines,
          payments: orderPayments,
          total: totals.total,
          createdAt: new Date().toISOString(),
          synced: false
        }

        await saveOrderToIndexedDB(offlineOrder)

        const offlineOrderNumber = `OFFLINE-${Date.now().toString(36).toUpperCase()}`
        router.push(`/dashboard/market/pos/${terminalId}/receipt?offlineId=${offlineId}&orderNumber=${offlineOrderNumber}&offline=true&autoPrint=true`)
        return
      }

      // ONLINE MODE: Send to API
      const orderData = {
        sessionId: parseInt(sessionId),
        terminalId: parseInt(terminalId),
        warehouseId: warehouseId ? parseInt(warehouseId) : null,
        currency: 'USD',
        lines: orderLines,
        payments: orderPayments
      }

      const response = await fetch('/api/market/pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      const data = await response.json()

      if (data.success) {
        router.push(`/dashboard/market/pos/${terminalId}/receipt?orderId=${data.data.id}&orderNumber=${data.data.orderNumber}&autoPrint=true`)
      } else {
        setError(data.error || 'Error al procesar pago')
      }
    } catch (e) {
      console.error('[Payment] Error:', e)

      // If failed and offline, save locally
      if (!navigator.onLine) {
        try {
          const offlineId = getOfflineId()
          const offlineOrder: PendingOrderData = {
            offlineId,
            terminalId: parseInt(terminalId),
            sessionId: parseInt(sessionId),
            warehouseId: warehouseId ? parseInt(warehouseId) : null,
            customerId: null,
            customerName: null,
            currency: 'USD',
            lines: cart.map(item => ({
              productId: item.productId,
              productName: item.productName,
              productSku: item.productSku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountPercent: item.discountPercent,
              discountAmount: item.discountAmount
            })),
            payments: payments.map(p => ({
              method: p.method,
              amount: p.amountInUSD,
              currency: p.currency,
              amountTendered: p.method === 'cash' ? p.amount : null,
              changeAmount: null
            })),
            total: totals.total,
            createdAt: new Date().toISOString(),
            synced: false
          }

          await saveOrderToIndexedDB(offlineOrder)

          const offlineOrderNumber = `OFFLINE-${Date.now().toString(36).toUpperCase()}`
          router.push(`/dashboard/market/pos/${terminalId}/receipt?offlineId=${offlineId}&orderNumber=${offlineOrderNumber}&offline=true&autoPrint=true`)
          return
        } catch {
          setError('Error de conexión')
        }
      } else {
        setError('Error de conexión')
      }
    } finally {
      setProcessing(false)
    }
  }

  // Format currency - USD y MLC con 2 decimales, CUP entero
  const formatCurrency = (amount: number, currency: 'USD' | 'CUP' | 'MLC' = 'USD') => {
    const symbol = CURRENCIES.find(c => c.id === currency)?.symbol || '$'
    if (currency === 'CUP') {
      // CUP se muestra como entero (los valores son grandes)
      return `${symbol}${Math.round(amount).toLocaleString('es-ES')}`
    }
    // USD y MLC con 2 decimales
    return `${symbol}${amount.toFixed(2)}`
  }

  // Numpad handler
  const handleNumpad = (key: string) => {
    if (key === 'C') {
      setAmount('')
    } else if (key === '.' && !amount.includes('.')) {
      setAmount(amount + '.')
    } else if (key !== '.') {
      setAmount(amount + key)
    }
  }

  // Navigate back to POS
  const goBackToPOS = () => {
    if (cart.length > 0) {
      const paymentData = {
        cart: cart,
        sessionId: sessionId ? parseInt(sessionId) : null,
        warehouseId: warehouseId ? parseInt(warehouseId) : null,
        terminalId: parseInt(terminalId),
        timestamp: Date.now()
      }
      localStorage.setItem('pos_payment_data', JSON.stringify(paymentData))
    }
    router.push(`/dashboard/market/pos/${terminalId}?restoreFromPayment=true`)
  }

  // Show loading
  if (!isClient) {
    const loadingBg = getThemeFromStorage() === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
    return (
      <div className={`min-h-screen flex items-center justify-center ${loadingBg}`}>
        <BigLoaderIcon />
      </div>
    )
  }

  // Theme classes
  const tc = getThemeClasses(theme)

  // Error with no cart
  if (error && cart.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${tc.bg} ${tc.text}`}>
        <div className="text-center">
          <AlertIcon />
          <p className="text-red-500 mb-4 mt-4">{error}</p>
          <button
            onClick={() => router.push(`/dashboard/market/pos/${terminalId}`)}
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
      {/* Header */}
      <header className={`flex items-center justify-between px-4 py-3 border-b ${tc.bgAlt} ${tc.border}`}>
        <button
          onClick={goBackToPOS}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-200"
        >
          <BackIcon />
          <span>Volver al POS</span>
        </button>
        <h1 className="text-lg font-semibold">Cobrar</h1>
        <div className="w-24 flex items-center justify-end">
          {isOnline ? (
            <div className="flex items-center gap-1 text-green-500">
              <WifiIcon />
              <span className="text-xs">Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-500">
              <WifiOffIcon />
              <span className="text-xs">Offline</span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Order Summary */}
          <div className="space-y-4">
            {/* Order Summary Card */}
            <div className={`rounded-xl p-4 shadow-sm ${tc.bgCard}`}>
              <h2 className="text-lg font-semibold mb-4">Resumen de Orden</h2>
              <div className="space-y-2 max-h-48 overflow-auto">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="truncate flex-1">
                      {item.productName} x{item.quantity}
                    </span>
                    <span className="ml-2">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
              <div className={`mt-4 pt-4 border-t ${tc.border} space-y-2`}>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                {totals.discount > 0 && (
                  <div className="flex justify-between text-green-500">
                    <span>Descuento:</span>
                    <span>-{formatCurrency(totals.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>

            {/* Payments List */}
            <div className={`rounded-xl p-4 shadow-sm ${tc.bgCard}`}>
              <h2 className="text-lg font-semibold mb-4">Pagos Realizados</h2>

              {payments.length === 0 ? (
                <p className={`${tc.textMuted} text-center py-4`}>No hay pagos agregados</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => {
                    const method = PAYMENT_METHODS.find(m => m.id === payment.method)
                    const MethodIcon = method?.Icon || CashIcon
                    return (
                      <div
                        key={payment.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${tc.button}`}
                      >
                        <div className="flex items-center gap-3">
                          <MethodIcon />
                          <div>
                            <p className="font-medium">{method?.label}</p>
                            <p className={`text-sm ${tc.textMuted}`}>
                              {formatCurrency(payment.amount, payment.currency)}
                              {payment.currency !== 'USD' && (
                                <span className="ml-1">(≈{formatCurrency(payment.amountInUSD)})</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removePayment(payment.id)}
                          className="p-2 text-red-500 hover:bg-red-900/30 rounded-lg"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className={`mt-4 pt-4 border-t ${tc.border} space-y-2`}>
                <div className="flex justify-between">
                  <span>Total pagado:</span>
                  <span className="font-semibold">{formatCurrency(totalPaidUSD)}</span>
                </div>
                <div className={`flex justify-between font-bold ${remainingUSD > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  <span>{remainingUSD > 0 ? 'Pendiente:' : 'Cambio:'}</span>
                  <span>
                    {remainingUSD > 0
                      ? formatCurrency(remainingUSD)
                      : formatCurrency(changeAmount, changeCurrency)
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Add Payment */}
          <div className="space-y-4">
            <div className={`rounded-xl p-4 shadow-sm ${tc.bgCard}`}>
              <h2 className="text-lg font-semibold mb-4">Agregar Pago</h2>

              {/* Offline Warning */}
              {!isOnline && (
                <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
                  <WifiOffIcon />
                  <div className="text-sm">
                    <span className="font-medium text-yellow-500">Modo Offline</span>
                    <span className={`${tc.textMuted} ml-2`}>Efectivo, transferencia y crédito disponibles.</span>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              <div className="mb-4">
                <label className={`text-sm ${tc.textMuted} mb-2 block`}>Método de Pago</label>
                <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${Math.min(allowedPaymentMethods.length, 4)}, 1fr)` }}>
                  {PAYMENT_METHODS.filter(m => allowedPaymentMethods.includes(m.id)).map((method) => {
                    const MethodIcon = method.Icon
                    const isDisabled = !isOnline && !method.offlineEnabled
                    return (
                      <button
                        key={method.id}
                        onClick={() => !isDisabled && setSelectedMethod(method.id as Payment['method'])}
                        disabled={isDisabled}
                        className={`p-3 rounded-lg flex flex-col items-center gap-1 transition-all ${
                          isDisabled
                            ? `${tc.button} text-gray-500 cursor-not-allowed opacity-50`
                            : selectedMethod === method.id
                              ? 'bg-blue-500 text-white'
                              : tc.button
                        }`}
                      >
                        <MethodIcon />
                        <span className="text-xs">{method.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Currency */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-sm ${tc.textMuted}`}>Moneda</label>
                  <span className={`text-xs ${tc.textMuted}`}>
                    1 USD = {rates.CUP_BCC} CUP | {rates.MLC.toFixed(2)} MLC
                  </span>
                </div>
                <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${Math.min(allowedCurrencies.length, 3)}, 1fr)` }}>
                  {CURRENCIES.filter(c => allowedCurrencies.includes(c.id)).map((currency) => (
                    <button
                      key={currency.id}
                      onClick={() => setSelectedCurrency(currency.id as Payment['currency'])}
                      className={`p-3 rounded-lg font-medium transition-all ${
                        selectedCurrency === currency.id
                          ? 'bg-blue-500 text-white'
                          : tc.button
                      }`}
                    >
                      {currency.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className={`text-sm ${tc.textMuted} mb-2 block`}>Monto</label>
                <div className={`relative rounded-lg ${tc.input}`}>
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-2xl ${tc.textMuted}`}>
                    {CURRENCIES.find(c => c.id === selectedCurrency)?.symbol}
                  </span>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    className={`w-full pl-10 pr-4 py-4 text-3xl font-bold text-right bg-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${tc.text}`}
                  />
                </div>
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {remainingUSD > 0 && (
                  <button
                    onClick={setExactAmount}
                    className="p-2 rounded-lg text-sm font-medium bg-green-600 text-white"
                  >
                    Exacto
                  </button>
                )}
                {selectedCurrency === 'USD' && [5, 10, 20, 50].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className={`p-2 rounded-lg text-sm font-medium ${tc.button}`}
                  >
                    ${val}
                  </button>
                ))}
                {selectedCurrency === 'CUP' && [1000, 2000, 5000, 10000].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className={`p-2 rounded-lg text-sm font-medium ${tc.button}`}
                  >
                    ${val.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Numpad */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '.'].map((key) => (
                  <button
                    key={key}
                    onClick={() => handleNumpad(key)}
                    className={`p-4 rounded-lg text-xl font-bold transition-all active:scale-95 ${
                      key === 'C'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : tc.button
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>

              {/* Add Payment Button */}
              <button
                onClick={addPayment}
                disabled={!amount || parseFloat(amount) <= 0}
                className={`w-full p-4 rounded-lg flex items-center justify-center gap-2 font-semibold transition-all ${
                  amount && parseFloat(amount) > 0
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : `${tc.button} ${tc.textMuted} cursor-not-allowed`
                }`}
              >
                <PlusIcon />
                Agregar Pago
              </button>
            </div>

            {/* Change Currency */}
            {remainingUSD < -0.01 && (
              <div className={`rounded-xl p-4 shadow-sm ${tc.bgCard}`}>
                <h3 className="font-semibold mb-3">Devolver cambio en:</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setChangeCurrency('USD')}
                    className={`p-3 rounded-lg font-medium ${
                      changeCurrency === 'USD' ? 'bg-blue-500 text-white' : tc.button
                    }`}
                  >
                    USD ({formatCurrency(Math.abs(remainingUSD))})
                  </button>
                  <button
                    onClick={() => setChangeCurrency('CUP')}
                    className={`p-3 rounded-lg font-medium ${
                      changeCurrency === 'CUP' ? 'bg-blue-500 text-white' : tc.button
                    }`}
                  >
                    CUP ({formatCurrency(Math.abs(remainingUSD) * rates.CUP_BCC, 'CUP')})
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-lg bg-red-900/30 text-red-400 flex items-center gap-2">
                <AlertIcon />
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={`p-4 border-t ${tc.bgAlt} ${tc.border}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={goBackToPOS}
            className={`px-6 py-3 rounded-lg font-medium ${tc.button}`}
          >
            Cancelar Venta
          </button>

          <button
            onClick={processPayment}
            disabled={!isFullyPaid || processing}
            className={`px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
              isFullyPaid && !processing
                ? 'bg-green-500 text-white hover:bg-green-600'
                : `${tc.button} ${tc.textMuted} cursor-not-allowed opacity-70`
            }`}
          >
            {processing ? (
              <>
                <LoaderIcon />
                Procesando...
              </>
            ) : (
              <>
                <CheckIcon />
                Confirmar Pago - {formatCurrency(totals.total)}
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  )
}

// Loading fallback - uses dark:bg-gray-900 for theme support
function LoadingFallback() {
  const theme = getThemeFromStorage()
  const bgClass = theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
  return (
    <div className={`min-h-screen flex items-center justify-center ${bgClass}`}>
      <BigLoaderIcon />
    </div>
  )
}

// Wrapper that extracts terminalId for error boundary
function PaymentPageWithErrorBoundary() {
  const params = useParams()
  const terminalId = (params.terminalId as string) || '1'

  return (
    <PaymentErrorBoundary terminalId={terminalId}>
      <Suspense fallback={<LoadingFallback />}>
        <PaymentContent />
      </Suspense>
    </PaymentErrorBoundary>
  )
}

// Main page export
export default function PaymentPage() {
  // Use client-side only rendering to avoid hydration issues
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <LoadingFallback />
  }

  return <PaymentPageWithErrorBoundary />
}
