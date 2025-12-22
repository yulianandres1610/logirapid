'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'

// ============================================
// INLINE EVERYTHING FOR OFFLINE SUPPORT
// No external imports that could fail offline
// ============================================

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
  discountAmount: number
  total: number
}

interface Payment {
  method: string
  amount: number
  currency: string
}

interface Order {
  id: number
  orderNumber: string
  customerName: string | null
  subtotal: number
  discountAmount: number
  totalAmount: number
  currency: string
  status: string
  createdAt: string
  createdByName: string
  lines: OrderLine[]
  payments: Payment[]
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

function ReceiptContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const terminalId = params.terminalId as string
  const orderId = searchParams.get('orderId')
  const orderNumber = searchParams.get('orderNumber')
  const offlineId = searchParams.get('offlineId')
  const isOfflineOrder = searchParams.get('offline') === 'true'

  // State
  const [isClient, setIsClient] = useState(false)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize on client
  useEffect(() => {
    setIsClient(true)
  }, [])

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
          setOrder(data.data)
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

  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
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

  // Print receipt
  const printReceipt = () => {
    if (!order) return

    const receiptContent = `
================================
       RECIBO DE VENTA
================================
Fecha: ${formatDate(order.createdAt)}
Ticket: ${order.orderNumber}
Cajero: ${order.createdByName}
${order.customerName ? `Cliente: ${order.customerName}` : ''}
--------------------------------
${order.lines.map(line =>
`${line.productName}
  ${line.quantity} x ${formatCurrency(line.unitPrice)} = ${formatCurrency(line.total)}`
).join('\n')}
--------------------------------
Subtotal:    ${formatCurrency(order.subtotal)}
${order.discountAmount > 0 ? `Descuento:  -${formatCurrency(order.discountAmount)}` : ''}
--------------------------------
TOTAL:       ${formatCurrency(order.totalAmount)}
--------------------------------
Pagos:
${order.payments.map(p =>
`  ${getPaymentMethodLabel(p.method)}: ${formatCurrency(p.amount)} ${p.currency}`
).join('\n')}
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <LoaderIcon />
      </div>
    )
  }

  // Show error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
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
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      {/* Success Header */}
      <div className="py-8 text-center">
        <CheckIcon />
        <h1 className="text-2xl font-bold mb-2">Pago Completado</h1>
        <p className="text-gray-400">Orden #{order?.orderNumber}</p>

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
          <div className="rounded-xl shadow-lg overflow-hidden bg-gray-800">
            <div className="p-6 font-mono text-sm">
              <div className="text-center mb-4">
                <p className="font-bold text-lg">RECIBO DE VENTA</p>
                <p className="text-gray-400">{formatDate(order?.createdAt || '')}</p>
              </div>

              <div className="flex justify-between mb-2">
                <span>Ticket:</span>
                <span className="font-bold">{order?.orderNumber}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span>Cajero:</span>
                <span>{order?.createdByName}</span>
              </div>

              <div className="border-t border-b border-gray-700 py-4 my-4 space-y-2">
                {order?.lines.map((line, idx) => (
                  <div key={idx}>
                    <p className="font-medium">{line.productName}</p>
                    <div className="flex justify-between text-gray-400">
                      <span>{line.quantity} x {formatCurrency(line.unitPrice)}</span>
                      <span>{formatCurrency(line.total)}</span>
                    </div>
                  </div>
                ))}
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
                <div className="flex justify-between text-xl font-bold pt-2">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(order?.totalAmount || 0)}</span>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4 mt-4">
                <p className="text-gray-400 mb-2">Pagos:</p>
                {order?.payments.map((payment, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{getPaymentMethodLabel(payment.method)}:</span>
                    <span>{formatCurrency(payment.amount)} {payment.currency}</span>
                  </div>
                ))}
              </div>

              <p className="text-center text-gray-400 mt-6">
                Gracias por su compra!
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={printReceipt}
              className="p-4 rounded-xl flex items-center justify-center gap-2 font-medium shadow-lg bg-gray-800 hover:bg-gray-700"
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
    </div>
  )
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <LoaderIcon />
    </div>
  )
}

// Main page with Suspense wrapper
export default function ReceiptPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReceiptContent />
    </Suspense>
  )
}
