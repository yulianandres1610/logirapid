'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Loader2,
  CheckCircle,
  Barcode,
  Calendar,
  User,
  X,
  Check,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Supplier {
  id: number
  code: string
  name: string
}

interface PendingOrder {
  id: number
  orderNumber: string
  supplier: Supplier
  status: string
  totalItems: number
  totalUnits: number
  totalCost: number
  consignmentDate: string
  createdAt: string
}

interface ProductInfo {
  id: number
  name: string
  sku: string
  barcode: string | null
}

interface OrderLine {
  id: number
  product: ProductInfo
  quantityOrdered: number
  quantityReceived: number
  unitCost: number
  unitPrice: number
  lotNumber: string | null
  expirationDate: string | null
}

interface OrderDetail {
  id: number
  orderNumber: string
  supplier: Supplier
  lines: OrderLine[]
}

interface ConsignmentReceptionViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
  onComplete: () => void
}

export default function ConsignmentReceptionView({
  warehouseId,
  warehouseName,
  onBack,
  onComplete
}: ConsignmentReceptionViewProps) {
  const { theme } = useTheme()
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(false)
  const [receivedLines, setReceivedLines] = useState<Map<number, { quantity: number; lotNumber: string; expirationDate: string }>>(new Map())
  const [processing, setProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successData, setSuccessData] = useState<{ orderNumber: string; unitsReceived: number } | null>(null)

  useEffect(() => {
    fetchPendingOrders()
  }, [warehouseId])

  const fetchPendingOrders = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/consignments?status=pending`)
      const data = await response.json()
      if (data.success) {
        setPendingOrders(data.data.orders)
      }
    } catch (error) {
      console.error('Error fetching pending orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectOrder = async (order: PendingOrder) => {
    setLoadingOrder(true)
    try {
      const response = await fetch(`/api/consignments/orders/${order.id}`)
      const data = await response.json()
      if (data.success) {
        setSelectedOrder(data.data)
        // Initialize received lines with ordered quantities
        const initialLines = new Map<number, { quantity: number; lotNumber: string; expirationDate: string }>()
        for (const line of data.data.lines) {
          const lotNumber = generateLotNumber(data.data.supplier.code)
          initialLines.set(line.id, {
            quantity: line.quantityOrdered,
            lotNumber,
            expirationDate: ''
          })
        }
        setReceivedLines(initialLines)
      }
    } catch (error) {
      console.error('Error loading order:', error)
    } finally {
      setLoadingOrder(false)
    }
  }

  const generateLotNumber = (supplierCode: string): string => {
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '').slice(2) // YYMMDD
    const seq = Math.floor(Math.random() * 99 + 1).toString().padStart(2, '0')
    return `${supplierCode}${dateStr}${seq}`
  }

  const updateLineQuantity = (lineId: number, quantity: number) => {
    const current = receivedLines.get(lineId)
    if (current) {
      setReceivedLines(new Map(receivedLines.set(lineId, { ...current, quantity: Math.max(0, quantity) })))
    }
  }

  const updateLineLot = (lineId: number, lotNumber: string) => {
    const current = receivedLines.get(lineId)
    if (current) {
      setReceivedLines(new Map(receivedLines.set(lineId, { ...current, lotNumber })))
    }
  }

  const updateLineExpiration = (lineId: number, expirationDate: string) => {
    const current = receivedLines.get(lineId)
    if (current) {
      setReceivedLines(new Map(receivedLines.set(lineId, { ...current, expirationDate })))
    }
  }

  const handleProcessReception = async () => {
    if (!selectedOrder) return

    const lines = Array.from(receivedLines.entries())
      .filter(([, data]) => data.quantity > 0)
      .map(([lineId, data]) => ({
        lineId,
        quantityReceived: data.quantity,
        lotNumber: data.lotNumber,
        expirationDate: data.expirationDate || undefined
      }))

    if (lines.length === 0) {
      return
    }

    setProcessing(true)
    try {
      const response = await fetch(`/api/consignments/orders/${selectedOrder.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines })
      })

      const data = await response.json()
      if (data.success) {
        setSuccessData({
          orderNumber: data.data.orderNumber,
          unitsReceived: data.data.unitsReceived
        })
        setShowSuccess(true)
        // Refresh pending orders
        fetchPendingOrders()
      }
    } catch (error) {
      console.error('Error processing reception:', error)
    } finally {
      setProcessing(false)
    }
  }

  const handleSuccessClose = () => {
    setShowSuccess(false)
    setSelectedOrder(null)
    setSuccessData(null)
    if (pendingOrders.length <= 1) {
      onComplete()
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // Success Modal
  if (showSuccess && successData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'text-center p-8 rounded-2xl max-w-md w-full',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 mx-auto mb-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center"
          >
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </motion.div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Recepcion Completada
          </h2>
          <p className="text-gray-500 mb-4">
            Orden {successData.orderNumber}
          </p>
          <p className="text-3xl font-bold text-emerald-600 mb-6">
            {successData.unitsReceived} unidades
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSuccessClose}
            className="w-full py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium"
          >
            Continuar
          </motion.button>
        </motion.div>
      </div>
    )
  }

  // Order Detail View
  if (selectedOrder) {
    const totalToReceive = Array.from(receivedLines.values()).reduce((sum, l) => sum + l.quantity, 0)

    return (
      <div className="p-4 space-y-4">
        {/* Lines */}
        <div className="space-y-3">
          {selectedOrder.lines.map(line => {
            const receivedData = receivedLines.get(line.id)
            const hasDiscrepancy = receivedData && receivedData.quantity !== line.quantityOrdered

            return (
              <div
                key={line.id}
                className={cn(
                  'p-4 rounded-xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{line.product.name}</p>
                    <p className="text-xs text-gray-500">SKU: {line.product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Ordenado:</p>
                    <p className="font-bold text-gray-900 dark:text-white">{line.quantityOrdered}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Quantity */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cantidad Recibida</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={receivedData?.quantity || 0}
                        onChange={(e) => updateLineQuantity(line.id, parseInt(e.target.value) || 0)}
                        min={0}
                        className={cn(
                          'w-full px-3 py-2 rounded-lg border text-center',
                          theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200',
                          hasDiscrepancy && 'border-amber-500'
                        )}
                      />
                      {hasDiscrepancy && (
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Lot Number */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Numero de Lote</label>
                    <input
                      type="text"
                      value={receivedData?.lotNumber || ''}
                      onChange={(e) => updateLineLot(line.id, e.target.value.toUpperCase())}
                      placeholder={generateLotNumber(selectedOrder.supplier.code)}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border font-mono',
                        theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'
                      )}
                    />
                  </div>

                  {/* Expiration */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fecha Vencimiento</label>
                    <input
                      type="date"
                      value={receivedData?.expirationDate || ''}
                      onChange={(e) => updateLineExpiration(line.id, e.target.value)}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border',
                        theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'
                      )}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary & Action */}
        <div className={cn(
          'p-4 rounded-xl sticky bottom-4',
          theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
        )}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Total a Recibir</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalToReceive} unidades</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleProcessReception}
              disabled={processing || totalToReceive === 0}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-medium',
                'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg',
                processing || totalToReceive === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:from-emerald-600 hover:to-emerald-700'
              )}
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Confirmar Recepcion
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    )
  }

  // Orders List View
  return (
    <div className="p-4 space-y-4">
      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : pendingOrders.length === 0 ? (
        <div className={cn(
          'text-center py-12 rounded-2xl',
          theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
        )}>
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
          <p className="text-gray-500">No hay consignaciones pendientes</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="mt-4 text-sm text-blue-500 hover:text-blue-600"
          >
            Volver a operaciones
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendingOrders.map((order, index) => (
            <motion.button
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => selectOrder(order)}
              disabled={loadingOrder}
              className={cn(
                'p-5 rounded-2xl border text-left transition-all',
                theme === 'dark'
                  ? 'bg-gray-800/50 border-gray-700 hover:border-teal-500'
                  : 'bg-white border-gray-200 hover:border-teal-500',
                loadingOrder && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                    theme === 'dark' ? 'bg-teal-900/30 text-teal-400' : 'bg-teal-100 text-teal-600'
                  )}>
                    {order.supplier.code}
                  </div>
                  <div>
                    <p className="font-mono font-bold text-gray-900 dark:text-white">{order.orderNumber}</p>
                    <p className="text-sm text-gray-500">{order.supplier.name}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={cn(
                  'p-2 rounded-lg',
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                )}>
                  <p className="text-xs text-gray-500">Items</p>
                  <p className="font-bold text-gray-900 dark:text-white">{order.totalItems}</p>
                </div>
                <div className={cn(
                  'p-2 rounded-lg',
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                )}>
                  <p className="text-xs text-gray-500">Unidades</p>
                  <p className="font-bold text-gray-900 dark:text-white">{order.totalUnits}</p>
                </div>
                <div className={cn(
                  'p-2 rounded-lg',
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                )}>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="font-bold text-teal-600">{formatCurrency(order.totalCost)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(order.consignmentDate)}
                </div>
                <span className={cn(
                  'px-2 py-1 rounded-full text-xs font-medium',
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                )}>
                  Pendiente
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}
