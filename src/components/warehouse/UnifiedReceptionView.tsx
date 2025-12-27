'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  Loader2,
  CheckCircle,
  Search,
  Calendar,
  AlertTriangle,
  Check,
  X,
  Barcode,
  Truck,
  ShoppingCart,
  Plus,
  Minus,
  Circle,
  History,
  Eye,
  ChevronRight,
  Printer
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'

interface Supplier {
  id: number
  code: string
  name: string
}

interface OrderLine {
  lineId: number
  productId: number
  productName: string
  sku: string
  barcode: string | null
  quantityOrdered: number
  quantityReceived: number
  quantityPending: number
  unitCost: number
}

interface DetectedOrder {
  orderType: 'consignment' | 'purchase'
  orderId: number
  orderNumber: string
  supplier: Supplier
  warehouseId: number
  lines: OrderLine[]
}

interface ReceivedLine {
  lineId: number
  productId: number
  quantityReceived: number
  lotNumber: string
  expirationDate: string
}

interface ReceptionHistoryItem {
  id: number
  order_number: string
  order_type: 'consignment' | 'purchase'
  status: string
  received_at: string
  supplier_code: string
  supplier_name: string
  received_by_name: string | null
  total_units: string
  total_lines: string
}

interface OrderDetail {
  orderType: string
  order: {
    id: number
    orderNumber: string
    status: string
    receivedAt: string
    createdAt: string
    supplier: Supplier
    warehouse: { name: string; code: string }
    receivedBy: string | null
  }
  lines: {
    lineId: number
    productId: number
    productName: string
    sku: string
    barcode: string | null
    quantityOrdered: number
    quantityReceived: number
    lotNumber: string | null
    expirationDate: string | null
    unitCost: number
  }[]
  totals: {
    totalOrdered: number
    totalReceived: number
    totalLines: number
  }
}

interface SupplierConflict {
  productId: number
  productName: string
  existingSupplier: {
    id: number
    code: string
    name: string
    unitCost: number
    stockAvailable: number
  }
  message: string
}

interface UnifiedReceptionViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
  onComplete: (data: {
    orderType: string
    orderNumber: string
    unitsReceived: number
  }) => void
  onNavigateToReturns?: () => void
}

type ValidationStatus = 'pending' | 'partial' | 'complete' | 'excess'

function getValidationStatus(received: number, expected: number): ValidationStatus {
  if (received === 0) return 'pending'
  if (received < expected) return 'partial'
  if (received === expected) return 'complete'
  return 'excess'
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
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

export default function UnifiedReceptionView({
  warehouseId,
  warehouseName,
  onBack,
  onComplete,
  onNavigateToReturns
}: UnifiedReceptionViewProps) {
  const { theme } = useTheme()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const productSearchRef = useRef<HTMLInputElement>(null)

  // States
  const [searchCode, setSearchCode] = useState('')
  const [productSearchCode, setProductSearchCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedOrder, setDetectedOrder] = useState<DetectedOrder | null>(null)
  const [receivedLines, setReceivedLines] = useState<Map<number, ReceivedLine>>(new Map())
  const [processing, setProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successData, setSuccessData] = useState<{ orderNumber: string; unitsReceived: number } | null>(null)
  const [expandedLineId, setExpandedLineId] = useState<number | null>(null)

  // History states
  const [showHistory, setShowHistory] = useState(false)
  const [historyType, setHistoryType] = useState<'consignment' | 'purchase' | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState<ReceptionHistoryItem[]>([])
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [orderDetailLoading, setOrderDetailLoading] = useState(false)

  // Supplier conflict state
  const [supplierConflict, setSupplierConflict] = useState<SupplierConflict | null>(null)

  // Print states
  const [printing, setPrinting] = useState(false)
  const [lastReceptionData, setLastReceptionData] = useState<{
    orderType: string
    orderId: number
    orderNumber: string
    supplier: Supplier
    warehouse: { id: number; name: string; code: string }
    linesProcessed: number
    unitsReceived: number
    receivedAt: string
  } | null>(null)

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current && !detectedOrder && !showHistory) {
      searchInputRef.current.focus()
    }
  }, [detectedOrder, showHistory])

  // Focus product search when order is loaded
  useEffect(() => {
    if (productSearchRef.current && detectedOrder) {
      productSearchRef.current.focus()
    }
  }, [detectedOrder])

  // Handle barcode scan for order or product
  const handleBarcodeScan = useCallback((code: string) => {
    if (showHistory) return
    if (!detectedOrder) {
      setSearchCode(code)
      detectOrder(code)
    } else {
      incrementProductByBarcode(code)
    }
  }, [detectedOrder, showHistory])

  useBarcodeScan({
    onScan: handleBarcodeScan,
    minLength: 5,
    maxTimeBetweenKeys: 50
  })

  // Generate lot number
  const generateLotNumber = (supplierCode: string, index: number): string => {
    const today = new Date()
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '').slice(2)
    const seq = (index + 1).toString().padStart(2, '0')
    return `${supplierCode}${dateStr}${seq}`
  }

  // Detect order from code
  const detectOrder = async (code: string) => {
    if (!code.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/market/warehouses/${warehouseId}/detect-order?code=${encodeURIComponent(code.trim())}`
      )
      const data = await response.json()

      if (data.success) {
        const order: DetectedOrder = data.data
        setDetectedOrder(order)

        const initialLines = new Map<number, ReceivedLine>()
        order.lines.forEach((line, index) => {
          initialLines.set(line.lineId, {
            lineId: line.lineId,
            productId: line.productId,
            quantityReceived: 0,
            lotNumber: generateLotNumber(order.supplier.code, index),
            expirationDate: ''
          })
        })
        setReceivedLines(initialLines)
      } else {
        setError(data.error || 'Orden no encontrada')
      }
    } catch (err) {
      console.error('Error detecting order:', err)
      setError('Error al buscar orden')
    } finally {
      setLoading(false)
    }
  }

  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    detectOrder(searchCode)
  }

  // Fetch history
  const fetchHistory = async (type: 'consignment' | 'purchase') => {
    setHistoryType(type)
    setShowHistory(true)
    setHistoryLoading(true)
    setSelectedOrder(null)

    try {
      const response = await fetch(
        `/api/market/warehouses/${warehouseId}/reception-history?type=${type}&limit=50`
      )
      const data = await response.json()

      if (data.success) {
        setHistoryItems(data.data.receptions)
      } else {
        setError(data.error || 'Error al cargar historial')
      }
    } catch (err) {
      console.error('Error fetching history:', err)
      setError('Error de conexión')
    } finally {
      setHistoryLoading(false)
    }
  }

  // Fetch order detail
  const fetchOrderDetail = async (orderId: number, orderType: string) => {
    setOrderDetailLoading(true)

    try {
      const response = await fetch(
        `/api/market/warehouses/${warehouseId}/reception-history/${orderId}?type=${orderType}`
      )
      const data = await response.json()

      if (data.success) {
        setSelectedOrder(data.data)
      } else {
        setError(data.error || 'Error al cargar detalles')
      }
    } catch (err) {
      console.error('Error fetching order detail:', err)
      setError('Error de conexión')
    } finally {
      setOrderDetailLoading(false)
    }
  }

  // Increment product by barcode scan
  const incrementProductByBarcode = (barcode: string) => {
    if (!detectedOrder) return

    const line = detectedOrder.lines.find(l =>
      l.barcode === barcode || l.sku === barcode
    )

    if (line) {
      incrementLineQuantity(line.lineId)
      setProductSearchCode('')
      setError(null)
    } else {
      setError(`Producto no encontrado: ${barcode}`)
      setTimeout(() => setError(null), 2000)
    }
  }

  // Increment line quantity
  const incrementLineQuantity = (lineId: number) => {
    const current = receivedLines.get(lineId)
    if (current) {
      const line = detectedOrder?.lines.find(l => l.lineId === lineId)
      const maxQty = (line?.quantityPending || 0) + 5
      if (current.quantityReceived < maxQty) {
        setReceivedLines(new Map(receivedLines.set(lineId, {
          ...current,
          quantityReceived: current.quantityReceived + 1
        })))
      }
    }
  }

  // Decrement line quantity
  const decrementLineQuantity = (lineId: number) => {
    const current = receivedLines.get(lineId)
    if (current && current.quantityReceived > 0) {
      setReceivedLines(new Map(receivedLines.set(lineId, {
        ...current,
        quantityReceived: current.quantityReceived - 1
      })))
    }
  }

  // Update line quantity directly
  const updateLineQuantity = (lineId: number, quantity: number) => {
    const current = receivedLines.get(lineId)
    if (current) {
      const line = detectedOrder?.lines.find(l => l.lineId === lineId)
      const maxQty = (line?.quantityPending || 0) + 5
      setReceivedLines(new Map(receivedLines.set(lineId, {
        ...current,
        quantityReceived: Math.max(0, Math.min(quantity, maxQty))
      })))
    }
  }

  // Update line lot number
  const updateLineLot = (lineId: number, lotNumber: string) => {
    const current = receivedLines.get(lineId)
    if (current) {
      setReceivedLines(new Map(receivedLines.set(lineId, {
        ...current,
        lotNumber: lotNumber.toUpperCase()
      })))
    }
  }

  // Update line expiration date
  const updateLineExpiration = (lineId: number, expirationDate: string) => {
    const current = receivedLines.get(lineId)
    if (current) {
      setReceivedLines(new Map(receivedLines.set(lineId, {
        ...current,
        expirationDate
      })))
    }
  }

  // Process reception
  const handleProcessReception = async () => {
    if (!detectedOrder) return

    const lines = Array.from(receivedLines.values()).filter(l => l.quantityReceived > 0)

    if (lines.length === 0) {
      setError('Debe recibir al menos un producto')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/unified-receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: detectedOrder.orderType,
          orderId: detectedOrder.orderId,
          lines
        })
      })

      const data = await response.json()

      if (data.success) {
        // Store reception data for reprinting
        setLastReceptionData(data.data)

        // Send initial print job
        await sendPrintJob(data.data)

        setSuccessData({
          orderNumber: data.data.orderNumber,
          unitsReceived: data.data.unitsReceived
        })
        setShowSuccess(true)
      } else if (data.error === 'supplier_conflict' && data.conflict) {
        // Mostrar modal de conflicto de proveedor
        setSupplierConflict(data.conflict)
      } else {
        setError(data.error || 'Error al procesar recepcion')
      }
    } catch (err) {
      console.error('Error processing reception:', err)
      setError('Error de conexion')
    } finally {
      setProcessing(false)
    }
  }

  // Send print job
  const sendPrintJob = async (receptionData: {
    orderType: string
    orderId: number
    orderNumber: string
    supplier: Supplier
    warehouse: { id: number; name: string; code: string }
    linesProcessed: number
    unitsReceived: number
    receivedAt: string
  }) => {
    try {
      const productLines = Array.from(receivedLines.values())
        .filter(l => l.quantityReceived > 0)
        .map(l => {
          const line = detectedOrder?.lines.find(ol => ol.lineId === l.lineId)
          return {
            productId: l.productId,
            productName: line?.productName || '',
            sku: line?.sku || '',
            barcode: line?.barcode || '',
            quantity: l.quantityReceived,
            lotNumber: l.lotNumber,
            expirationDate: l.expirationDate || null
          }
        })

      await fetch('/api/print/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: 'unified_reception',
          documentData: {
            orderType: receptionData.orderType,
            orderNumber: receptionData.orderNumber,
            supplier: receptionData.supplier,
            warehouse: receptionData.warehouse,
            products: productLines,
            totalProducts: receptionData.linesProcessed,
            totalUnits: receptionData.unitsReceived,
            receivedAt: receptionData.receivedAt
          },
          copies: 1,
          sourceType: receptionData.orderType === 'consignment' ? 'consignment_order' : 'purchase_order',
          sourceId: receptionData.orderId,
          warehouseId: receptionData.warehouse.id
        })
      })
    } catch (err) {
      console.error('Error sending print job:', err)
    }
  }

  // Reprint reception
  const handleReprint = async () => {
    if (!lastReceptionData) return

    setPrinting(true)
    try {
      await sendPrintJob(lastReceptionData)
    } finally {
      setPrinting(false)
    }
  }

  // Handle success close
  const handleSuccessClose = () => {
    if (successData) {
      onComplete({
        orderType: detectedOrder?.orderType || '',
        orderNumber: successData.orderNumber,
        unitsReceived: successData.unitsReceived
      })
    }
    setShowSuccess(false)
    setDetectedOrder(null)
    setSearchCode('')
    setSuccessData(null)
  }

  // Cancel and go back
  const handleCancel = () => {
    if (detectedOrder && receivedLines.size > 0) {
      const hasReceived = Array.from(receivedLines.values()).some(l => l.quantityReceived > 0)
      if (hasReceived) {
        if (confirm('Hay productos contados. ¿Desea cancelar la recepcion?')) {
          setDetectedOrder(null)
          setReceivedLines(new Map())
          setSearchCode('')
        }
        return
      }
    }

    if (detectedOrder) {
      setDetectedOrder(null)
      setReceivedLines(new Map())
      setSearchCode('')
    } else {
      onBack()
    }
  }

  // Calculate totals
  const totalToReceive = Array.from(receivedLines.values()).reduce(
    (sum, l) => sum + l.quantityReceived, 0
  )
  const totalExpected = detectedOrder?.lines.reduce((sum, l) => sum + l.quantityPending, 0) || 0
  const completedProducts = detectedOrder?.lines.filter(line => {
    const received = receivedLines.get(line.lineId)
    return received && received.quantityReceived >= line.quantityPending
  }).length || 0
  const totalProducts = detectedOrder?.lines.length || 0
  const progressPercent = totalExpected > 0 ? Math.round((totalToReceive / totalExpected) * 100) : 0

  // Supplier Conflict Modal
  if (supplierConflict) {
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
            className="w-20 h-20 mx-auto mb-6 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center"
          >
            <AlertTriangle className="w-10 h-10 text-orange-600" />
          </motion.div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Conflicto de Proveedor
          </h2>
          <p className="text-gray-500 mb-4">
            {supplierConflict.productName}
          </p>
          <div className={cn(
            'p-4 rounded-xl mb-6 text-left',
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
          )}>
            <p className="text-sm text-gray-500 mb-2">Proveedor actual:</p>
            <p className="font-bold text-gray-900 dark:text-white">
              {supplierConflict.existingSupplier.name}
            </p>
            <p className="text-sm text-gray-500">
              Codigo: {supplierConflict.existingSupplier.code}
            </p>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Stock disponible:</span>
                <span className="font-bold text-orange-600">
                  {supplierConflict.existingSupplier.stockAvailable} uds
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-sm text-gray-500">Precio de costo:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${supplierConflict.existingSupplier.unitCost.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Debe devolver todo el stock de este producto antes de consignar con otro proveedor.
          </p>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSupplierConflict(null)}
              className={cn(
                'flex-1 py-3 rounded-xl font-medium transition-colors',
                theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              )}
            >
              Cerrar
            </motion.button>
            {onNavigateToReturns && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSupplierConflict(null)
                  onNavigateToReturns()
                }}
                className="flex-1 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-medium"
              >
                Ir a Devoluciones
              </motion.button>
            )}
          </div>
        </motion.div>
      </div>
    )
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
            {successData.orderNumber}
          </p>
          <p className="text-3xl font-bold text-emerald-600 mb-6">
            {successData.unitsReceived} unidades
          </p>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleReprint}
              disabled={printing}
              className={cn(
                'flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2',
                theme === 'dark'
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
                printing && 'opacity-50 cursor-not-allowed'
              )}
            >
              {printing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Printer className="w-5 h-5" />
              )}
              Imprimir
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSuccessClose}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium"
            >
              Continuar
            </motion.button>
          </div>
        </motion.div>
      </div>
    )
  }

  // History View
  if (showHistory) {
    return (
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (selectedOrder) {
                setSelectedOrder(null)
              } else {
                setShowHistory(false)
                setHistoryItems([])
              }
            }}
            className={cn(
              'p-2 rounded-lg transition-colors',
              theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {selectedOrder ? selectedOrder.order.orderNumber : (
                historyType === 'consignment' ? 'Consignaciones Recibidas' : 'Compras Recibidas'
              )}
            </h2>
            <p className="text-sm text-gray-500">
              {selectedOrder ? (
                `${selectedOrder.order.supplier.name} - ${formatDate(selectedOrder.order.receivedAt)}`
              ) : warehouseName}
            </p>
          </div>
        </div>

        {/* Order Detail View */}
        {selectedOrder ? (
          <div className="space-y-4">
            {/* Order Info */}
            <div className={cn(
              'p-4 rounded-xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Proveedor</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedOrder.order.supplier.name}
                  </p>
                  <p className="text-sm text-gray-500">{selectedOrder.order.supplier.code}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Estado</p>
                  <span className={cn(
                    'inline-block px-2 py-1 rounded-full text-xs font-medium',
                    selectedOrder.order.status === 'received' || selectedOrder.order.status === 'recibido'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  )}>
                    {selectedOrder.order.status === 'received' || selectedOrder.order.status === 'recibido' ? 'Completo' : 'Parcial'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Recibido por</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedOrder.order.receivedBy || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Almacén</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedOrder.order.warehouse.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-3 gap-3">
              <div className={cn(
                'p-3 rounded-xl text-center',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
              )}>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedOrder.totals.totalLines}
                </p>
                <p className="text-xs text-gray-500">Productos</p>
              </div>
              <div className={cn(
                'p-3 rounded-xl text-center',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
              )}>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedOrder.totals.totalOrdered}
                </p>
                <p className="text-xs text-gray-500">Ordenados</p>
              </div>
              <div className={cn(
                'p-3 rounded-xl text-center',
                theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
              )}>
                <p className="text-2xl font-bold text-emerald-600">
                  {selectedOrder.totals.totalReceived}
                </p>
                <p className="text-xs text-gray-500">Recibidos</p>
              </div>
            </div>

            {/* Product Lines */}
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 dark:text-white">Productos Recibidos</h3>
              {selectedOrder.lines.map(line => (
                <div
                  key={line.lineId}
                  className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {line.productName}
                      </p>
                      <p className="text-xs text-gray-500">SKU: {line.sku}</p>
                      {line.lotNumber && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Lote: {line.lotNumber}
                        </p>
                      )}
                      {line.expirationDate && (
                        <p className="text-xs text-gray-500">
                          Vence: {new Date(line.expirationDate).toLocaleDateString('es-ES')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-600">
                        {line.quantityReceived}
                      </p>
                      <p className="text-xs text-gray-500">
                        de {line.quantityOrdered}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // History List
          <div className="space-y-2">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : historyItems.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">No hay recepciones registradas</p>
              </div>
            ) : (
              historyItems.map(item => (
                <motion.button
                  key={`${item.order_type}-${item.id}`}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => fetchOrderDetail(item.id, item.order_type)}
                  className={cn(
                    'w-full p-4 rounded-xl text-left transition-colors',
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-750'
                      : 'bg-white border border-gray-200 hover:border-gray-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.order_number}
                        </p>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs',
                          item.status === 'received' || item.status === 'recibido'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}>
                          {item.status === 'received' || item.status === 'recibido' ? 'Completo' : 'Parcial'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">
                        {item.supplier_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(item.received_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {item.total_units}
                        </p>
                        <p className="text-xs text-gray-500">unidades</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </motion.button>
              ))
            )}
          </div>
        )}

        {orderDetailLoading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className={cn(
              'p-6 rounded-xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}>
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Cargando detalles...</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Order Detail View with Counting Interface
  if (detectedOrder) {
    return (
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCancel}
              className={cn(
                'p-2 rounded-lg transition-colors',
                theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {detectedOrder.orderNumber}
                </h2>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  detectedOrder.orderType === 'consignment'
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                )}>
                  {detectedOrder.orderType === 'consignment' ? (
                    <><Truck className="w-3 h-3 inline mr-1" />Consignacion</>
                  ) : (
                    <><ShoppingCart className="w-3 h-3 inline mr-1" />Compra</>
                  )}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {detectedOrder.supplier.name} ({detectedOrder.supplier.code})
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className={cn(
          'p-4 rounded-xl',
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progreso de Recepcion
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {completedProducts}/{totalProducts} productos ({progressPercent}%)
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, progressPercent)}%` }}
              className={cn(
                'h-full rounded-full transition-all duration-300',
                progressPercent >= 100 ? 'bg-emerald-500' :
                progressPercent > 0 ? 'bg-blue-500' : 'bg-gray-300'
              )}
            />
          </div>
        </div>

        {/* Product Search/Scan Field */}
        <div className="relative">
          <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            ref={productSearchRef}
            type="text"
            value={productSearchCode}
            onChange={(e) => setProductSearchCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && productSearchCode) {
                incrementProductByBarcode(productSearchCode)
              }
            }}
            placeholder="Escanear codigo de producto para contar..."
            className={cn(
              'w-full pl-12 pr-4 py-3 rounded-xl border text-sm',
              'focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
            )}
          />
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {error}
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product Cards */}
        <div className="space-y-3">
          {detectedOrder.lines.map(line => {
            const receivedData = receivedLines.get(line.lineId)
            const quantityReceived = receivedData?.quantityReceived || 0
            const status = getValidationStatus(quantityReceived, line.quantityPending)
            const isExpanded = expandedLineId === line.lineId

            let bgColor = theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            let borderColor = theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            let statusIcon = <Circle className="w-5 h-5 text-gray-400" />

            if (status === 'complete') {
              bgColor = theme === 'dark' ? 'bg-emerald-900/20' : 'bg-emerald-50'
              borderColor = 'border-emerald-500'
              statusIcon = <Check className="w-5 h-5 text-emerald-600" />
            } else if (status === 'excess') {
              bgColor = theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'
              borderColor = 'border-amber-500'
              statusIcon = <AlertTriangle className="w-5 h-5 text-amber-600" />
            } else if (status === 'partial') {
              bgColor = theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
              borderColor = 'border-blue-500'
              statusIcon = <Circle className="w-5 h-5 text-blue-500 fill-blue-200" />
            }

            return (
              <motion.div
                key={line.lineId}
                layout
                className={cn(
                  'rounded-xl border transition-all',
                  bgColor,
                  borderColor
                )}
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedLineId(isExpanded ? null : line.lineId)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {statusIcon}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {line.productName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>SKU: {line.sku}</span>
                        {line.barcode && (
                          <>
                            <span>|</span>
                            <span className="flex items-center gap-1">
                              <Barcode className="w-3 h-3" />
                              {line.barcode}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => decrementLineQuantity(line.lineId)}
                        disabled={quantityReceived === 0}
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                          quantityReceived === 0
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        )}
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <div className="text-center min-w-[90px]">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-2xl font-bold text-gray-900 dark:text-white">
                            {quantityReceived}
                          </span>
                          <span className="text-lg text-gray-400">/</span>
                          <span className="text-lg text-gray-500">{line.quantityPending}</span>
                        </div>
                        {quantityReceived !== line.quantityPending && quantityReceived > 0 && (
                          <span className={cn(
                            'text-xs font-medium',
                            quantityReceived > line.quantityPending
                              ? 'text-amber-600'
                              : 'text-blue-600'
                          )}>
                            {quantityReceived > line.quantityPending
                              ? `+${quantityReceived - line.quantityPending}`
                              : `${quantityReceived - line.quantityPending}`}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => incrementLineQuantity(line.lineId)}
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                          'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400',
                          'hover:bg-emerald-200 dark:hover:bg-emerald-800/50'
                        )}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          status === 'complete' ? 'bg-emerald-500' :
                          status === 'excess' ? 'bg-amber-500' :
                          status === 'partial' ? 'bg-blue-500' : 'bg-gray-300'
                        )}
                        style={{ width: `${Math.min(100, (quantityReceived / line.quantityPending) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className={cn(
                        'px-4 pb-4 pt-2 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Numero de Lote</label>
                            <input
                              type="text"
                              value={receivedData?.lotNumber || ''}
                              onChange={(e) => updateLineLot(line.lineId, e.target.value)}
                              placeholder="Ej: ABC241227-01"
                              className={cn(
                                'w-full px-3 py-2 rounded-lg border font-mono text-sm',
                                theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'
                              )}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Fecha Vencimiento <span className="text-gray-400">(opcional)</span>
                            </label>
                            <input
                              type="date"
                              value={receivedData?.expirationDate || ''}
                              onChange={(e) => updateLineExpiration(line.lineId, e.target.value)}
                              className={cn(
                                'w-full px-3 py-2 rounded-lg border',
                                theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'
                              )}
                            />
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="block text-xs text-gray-500 mb-1">Cantidad manual</label>
                          <input
                            type="number"
                            value={quantityReceived}
                            onChange={(e) => updateLineQuantity(line.lineId, parseInt(e.target.value) || 0)}
                            min={0}
                            className={cn(
                              'w-full px-3 py-2 rounded-lg border text-center font-bold',
                              theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'
                            )}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* Summary & Action */}
        <div className={cn(
          'p-4 rounded-xl sticky bottom-4',
          theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-lg'
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Contado</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalToReceive} <span className="text-lg text-gray-400">/ {totalExpected}</span> unidades
              </p>
            </div>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCancel}
                disabled={processing}
                className={cn(
                  'px-4 py-3 rounded-xl transition-colors font-medium',
                  theme === 'dark'
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                )}
              >
                Cancelar
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleProcessReception}
                disabled={processing || totalToReceive === 0}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-medium',
                  'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg',
                  (processing || totalToReceive === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:from-emerald-600 hover:to-emerald-700'
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
      </div>
    )
  }

  // Search View
  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          className={cn(
            'p-2 rounded-lg transition-colors',
            theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          )}
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Recepcion de Orden
          </h2>
          <p className="text-sm text-gray-500">{warehouseName}</p>
        </div>
      </div>

      {/* Search Card */}
      <div className={cn(
        'p-6 rounded-2xl border',
        theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="text-center mb-6">
          <div className={cn(
            'w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center',
            theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-100'
          )}>
            <Package className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Escanear o Buscar Orden
          </h3>
          <p className="text-sm text-gray-500">
            Escanee el codigo de barras de la orden o ingrese el numero manualmente
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              placeholder="CONS-2025-0001 o PUR-2025-0001"
              className={cn(
                'w-full pl-12 pr-4 py-4 rounded-xl border text-lg font-mono',
                'focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
              )}
              autoFocus
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                {error}
                <button type="button" onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || !searchCode.trim()}
            className={cn(
              'w-full py-4 rounded-xl font-medium transition-all',
              'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
              (loading || !searchCode.trim()) ? 'opacity-50 cursor-not-allowed' : 'hover:from-emerald-600 hover:to-emerald-700'
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Buscando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Search className="w-5 h-5" />
                Buscar Orden
              </span>
            )}
          </motion.button>
        </form>

        {/* History Buttons */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 text-center mb-4">
            Ver historial de recepciones:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fetchHistory('consignment')}
              className={cn(
                'p-4 rounded-xl text-center transition-colors cursor-pointer',
                theme === 'dark'
                  ? 'bg-teal-900/20 hover:bg-teal-900/40'
                  : 'bg-teal-50 hover:bg-teal-100'
              )}
            >
              <Truck className="w-6 h-6 mx-auto mb-2 text-teal-600" />
              <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
                Consignaciones
              </p>
              <p className="text-xs text-gray-500 mt-1">Ver recibidas</p>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fetchHistory('purchase')}
              className={cn(
                'p-4 rounded-xl text-center transition-colors cursor-pointer',
                theme === 'dark'
                  ? 'bg-blue-900/20 hover:bg-blue-900/40'
                  : 'bg-blue-50 hover:bg-blue-100'
              )}
            >
              <ShoppingCart className="w-6 h-6 mx-auto mb-2 text-blue-600" />
              <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                Compras
              </p>
              <p className="text-xs text-gray-500 mt-1">Ver recibidas</p>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}
