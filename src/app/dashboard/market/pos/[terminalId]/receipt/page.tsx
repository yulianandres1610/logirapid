'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle,
  Printer,
  MessageSquare,
  Phone,
  ShoppingCart,
  Home,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  WifiOff,
  Clock
} from 'lucide-react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

// IndexedDB constants - inline to avoid module loading issues offline
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

function ReceiptContent() {
  const { theme } = useTheme()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const terminalId = params.terminalId as string
  const orderId = searchParams.get('orderId')
  const orderNumber = searchParams.get('orderNumber')
  const offlineId = searchParams.get('offlineId')
  const isOfflineOrder = searchParams.get('offline') === 'true'

  // Track if we're on client
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // State
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [sendingReceipt, setSendingReceipt] = useState(false)
  const [receiptSent, setReceiptSent] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Fetch order details (online or offline)
  useEffect(() => {
    const fetchOrder = async () => {
      // OFFLINE ORDER: Load from IndexedDB
      if (isOfflineOrder && offlineId) {
        try {
          const pendingOrders = await getPendingOrdersFromDB()
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
          } else {
            setError('Orden offline no encontrada')
          }
        } catch (e) {
          console.error('Error loading offline order:', e)
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
        console.error('Error fetching order:', e)
        setError('Error de conexión')
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId, offlineId, isOfflineOrder, orderNumber])

  // Format currency
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`
  }

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

  // Send receipt via WhatsApp
  const sendWhatsApp = () => {
    if (!order || !phoneNumber) return

    const message = encodeURIComponent(
      `Recibo de Venta\n` +
      `Ticket: ${order.orderNumber}\n` +
      `Fecha: ${formatDate(order.createdAt)}\n` +
      `Total: ${formatCurrency(order.totalAmount)}\n\n` +
      `Gracias por su compra!`
    )

    // Clean phone number (remove spaces, dashes, etc)
    const cleanPhone = phoneNumber.replace(/\D/g, '')

    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank')
    setReceiptSent(true)
  }

  // Send receipt via SMS (simulate - would need backend integration)
  const sendSMS = async () => {
    if (!order || !phoneNumber) return

    setSendingReceipt(true)

    // Simulate sending SMS
    await new Promise(resolve => setTimeout(resolve, 1500))

    setSendingReceipt(false)
    setReceiptSent(true)

    // In production, you would call an API to send SMS
    // const res = await fetch('/api/sms/send', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     phone: phoneNumber,
    //     message: `Recibo ${order.orderNumber} - Total: ${formatCurrency(order.totalAmount)}`
    //   })
    // })
  }

  // Copy link to clipboard
  const copyReceiptLink = () => {
    const link = `${window.location.origin}/receipt/${orderId}`
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  // Navigate back to POS
  const newOrder = () => {
    router.push(`/dashboard/market/pos/${terminalId}`)
  }

  // Navigate to dashboard
  const goToDashboard = () => {
    router.push('/dashboard/market')
  }

  if (loading) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'
      )}>
        <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
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
            onClick={newOrder}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Volver al POS
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'min-h-screen flex flex-col',
      theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
    )}>
      {/* Success Header */}
      <div className="py-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', duration: 0.5 }}
        >
          <CheckCircle className="w-20 h-20 mx-auto mb-4 text-green-500" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold mb-2"
        >
          Pago Completado
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-500"
        >
          Orden #{order?.orderNumber}
        </motion.p>

        {/* Offline Order Badge */}
        {isOfflineOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/30"
          >
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-yellow-600 dark:text-yellow-400">
              Pendiente de sincronizar
            </span>
          </motion.div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Receipt Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={cn(
              'rounded-xl shadow-lg overflow-hidden',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}
          >
            {/* Receipt Content */}
            <div className="p-6 font-mono text-sm">
              <div className="text-center mb-4">
                <p className="font-bold text-lg">RECIBO DE VENTA</p>
                <p className="text-gray-500">{formatDate(order?.createdAt || '')}</p>
              </div>

              <div className="flex justify-between mb-2">
                <span>Ticket:</span>
                <span className="font-bold">{order?.orderNumber}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span>Cajero:</span>
                <span>{order?.createdByName}</span>
              </div>

              <div className={cn(
                'border-t border-b py-4 my-4 space-y-2',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                {order?.lines.map((line, idx) => (
                  <div key={idx}>
                    <p className="font-medium">{line.productName}</p>
                    <div className="flex justify-between text-gray-500">
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

              <div className={cn(
                'border-t pt-4 mt-4',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <p className="text-gray-500 mb-2">Pagos:</p>
                {order?.payments.map((payment, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{getPaymentMethodLabel(payment.method)}:</span>
                    <span>{formatCurrency(payment.amount)} {payment.currency}</span>
                  </div>
                ))}
              </div>

              <p className="text-center text-gray-500 mt-6">
                Gracias por su compra!
              </p>
            </div>
          </motion.div>

          {/* Send Receipt Options */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={cn(
              'rounded-xl p-6 shadow-lg',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}
          >
            <h2 className="text-lg font-semibold mb-4">Enviar Recibo</h2>

            {/* Offline Warning */}
            {!isOnline && (
              <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
                <WifiOff className="w-5 h-5 text-yellow-500" />
                <span className="text-sm text-yellow-600 dark:text-yellow-400">
                  Sin conexión. El envío de recibos no está disponible.
                </span>
              </div>
            )}

            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-2 block">Teléfono del cliente</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+53 5XXXXXXX"
                  disabled={!isOnline}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
                    !isOnline && 'opacity-50 cursor-not-allowed',
                    theme === 'dark'
                      ? 'bg-gray-700 text-white placeholder-gray-400'
                      : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={sendSMS}
                disabled={!phoneNumber || sendingReceipt || !isOnline}
                className={cn(
                  'p-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all',
                  phoneNumber && !sendingReceipt && isOnline
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                {sendingReceipt ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Phone className="w-5 h-5" />
                )}
                Enviar SMS
              </button>

              <button
                onClick={sendWhatsApp}
                disabled={!phoneNumber || !isOnline}
                className={cn(
                  'p-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all',
                  phoneNumber && isOnline
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                )}
              >
                <MessageSquare className="w-5 h-5" />
                WhatsApp
              </button>
            </div>

            {receiptSent && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 rounded-lg bg-green-100 text-green-700 flex items-center gap-2"
              >
                <Check className="w-5 h-5" />
                Recibo enviado correctamente
              </motion.div>
            )}
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <button
              onClick={printReceipt}
              className={cn(
                'p-4 rounded-xl flex items-center justify-center gap-2 font-medium shadow-lg transition-all',
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700'
                  : 'bg-white hover:bg-gray-50'
              )}
            >
              <Printer className="w-5 h-5" />
              Imprimir
            </button>

            <button
              onClick={copyReceiptLink}
              className={cn(
                'p-4 rounded-xl flex items-center justify-center gap-2 font-medium shadow-lg transition-all',
                theme === 'dark'
                  ? 'bg-gray-800 hover:bg-gray-700'
                  : 'bg-white hover:bg-gray-50'
              )}
            >
              {copiedLink ? (
                <>
                  <Check className="w-5 h-5 text-green-500" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copiar Link
                </>
              )}
            </button>

            <button
              onClick={newOrder}
              className="p-4 rounded-xl flex items-center justify-center gap-2 font-medium bg-blue-500 text-white hover:bg-blue-600 shadow-lg transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              Nueva Orden
            </button>
          </motion.div>

          {/* Back to Dashboard */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center"
          >
            <button
              onClick={goToDashboard}
              className="text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2 mx-auto"
            >
              <Home className="w-4 h-4" />
              Volver al Dashboard
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
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
