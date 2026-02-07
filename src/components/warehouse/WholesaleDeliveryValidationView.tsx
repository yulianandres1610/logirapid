'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Loader2,
  CheckCircle,
  Calendar,
  User,
  X,
  Check,
  AlertTriangle,
  Barcode,
  Plus,
  Minus,
  Circle,
  Building2,
  FileText,
  MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'

function formatQty(value: number): string {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(2)
}

function areEqual(a: number, b: number, tolerance: number = 0.001): boolean {
  return Math.abs(a - b) < tolerance
}

type ValidationStatus = 'pending' | 'partial' | 'complete' | 'excess'

function getValidationStatus(validated: number, expected: number): ValidationStatus {
  if (validated === 0) return 'pending'
  if (validated < expected - 0.001) return 'partial'
  if (validated >= expected - 0.001 && validated <= expected + 0.001) return 'complete'
  return 'excess'
}

interface DeliveryLine {
  lineId: number
  productId: number
  variantId: number | null
  productName: string
  variantName: string | null
  sku: string
  barcode?: string | null
  quantityExpected: number
  quantityValidated: number
}

interface DeliveryOperation {
  id: number
  operationNumber: string
  invoiceNumber: string
  invoiceId: number
  sourceWarehouse: {
    id: number
    name: string
    code: string
  }
  customer: {
    id: number
    name: string
    code: string
  }
  createdAt: string
  createdBy?: string
}

interface WholesaleDeliveryValidationViewProps {
  warehouseId: number
  operationId: number
  onClose: () => void
  onComplete: () => void
}

export default function WholesaleDeliveryValidationView({
  warehouseId,
  operationId,
  onClose,
  onComplete
}: WholesaleDeliveryValidationViewProps) {
  const { theme } = useTheme()
  const productSearchRef = useRef<HTMLInputElement>(null)

  const [operation, setOperation] = useState<DeliveryOperation | null>(null)
  const [lines, setLines] = useState<DeliveryLine[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productSearchCode, setProductSearchCode] = useState('')
  const [expandedLineId, setExpandedLineId] = useState<number | null>(null)
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false)
  const [discrepancyNotes, setDiscrepancyNotes] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [successData, setSuccessData] = useState<{
    invoiceNumber: string
    customerName: string
    totalDelivered: number
    hasDiscrepancies: boolean
  } | null>(null)

  // Fetch validation data
  const fetchValidationData = useCallback(async () => {
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/wholesale-deliveries/${operationId}/validate`)
      const data = await response.json()

      if (data.success) {
        setOperation(data.data.operation)
        setLines(data.data.lines)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al cargar datos de validacion')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [warehouseId, operationId])

  useEffect(() => {
    fetchValidationData()
  }, [fetchValidationData])

  // Focus product search when loaded
  useEffect(() => {
    if (productSearchRef.current && !loading) {
      productSearchRef.current.focus()
    }
  }, [loading])

  // Increment product by barcode
  const incrementProductByBarcode = useCallback((barcode: string) => {
    const line = lines.find(l =>
      l.barcode === barcode ||
      l.sku === barcode ||
      l.sku?.toLowerCase() === barcode.toLowerCase()
    )

    if (line) {
      const maxQty = line.quantityExpected + 5
      const newQuantity = Math.min(line.quantityValidated + 1, maxQty)

      setLines(prev => prev.map(l =>
        l.lineId === line.lineId ? { ...l, quantityValidated: newQuantity } : l
      ))
      saveValidation([{ lineId: line.lineId, quantityValidated: newQuantity }])
      setProductSearchCode('')
      setError(null)
    } else {
      setError(`Producto no encontrado: ${barcode}`)
      setTimeout(() => setError(null), 2000)
    }
  }, [lines])

  // Handle barcode scan
  useBarcodeScan({
    onScan: incrementProductByBarcode,
    minLength: 5,
    maxTimeBetweenKeys: 50
  })

  // Save validation to server
  const saveValidation = async (updates: { lineId: number; quantityValidated: number }[]) => {
    setSaving(true)
    try {
      await fetch(`/api/market/warehouses/${warehouseId}/wholesale-deliveries/${operationId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: updates })
      })
    } catch (err) {
      console.error('Error saving validation:', err)
    } finally {
      setSaving(false)
    }
  }

  // Increment line quantity
  const incrementLineQuantity = (lineId: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    const maxQty = line.quantityExpected + 5
    const newQuantity = Math.min(line.quantityValidated + 1, maxQty)

    setLines(prev => prev.map(l =>
      l.lineId === lineId ? { ...l, quantityValidated: newQuantity } : l
    ))
    saveValidation([{ lineId, quantityValidated: newQuantity }])
  }

  // Decrement line quantity
  const decrementLineQuantity = (lineId: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line || line.quantityValidated <= 0) return

    const newQuantity = line.quantityValidated - 1

    setLines(prev => prev.map(l =>
      l.lineId === lineId ? { ...l, quantityValidated: newQuantity } : l
    ))
    saveValidation([{ lineId, quantityValidated: newQuantity }])
  }

  // Update line quantity directly
  const updateLineQuantity = (lineId: number, quantity: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    const maxQty = line.quantityExpected + 5
    const newQuantity = Math.max(0, Math.min(quantity, maxQty))

    setLines(prev => prev.map(l =>
      l.lineId === lineId ? { ...l, quantityValidated: newQuantity } : l
    ))
    saveValidation([{ lineId, quantityValidated: newQuantity }])
  }

  // Deliver all - set all lines to their expected quantity
  const deliverAll = () => {
    const updates: { lineId: number; quantityValidated: number }[] = []

    setLines(prev => prev.map(l => {
      updates.push({ lineId: l.lineId, quantityValidated: l.quantityExpected })
      return { ...l, quantityValidated: l.quantityExpected }
    }))

    saveValidation(updates)
  }

  // Handle complete click
  const handleCompleteClick = () => {
    const hasDiscrepancies = lines.some(l => !areEqual(l.quantityValidated, l.quantityExpected))
    if (hasDiscrepancies) {
      setShowDiscrepancyModal(true)
    } else {
      completeDelivery()
    }
  }

  // Complete delivery
  const completeDelivery = async (notes?: string) => {
    setCompleting(true)
    setShowDiscrepancyModal(false)
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/wholesale-deliveries/${operationId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discrepancyNotes: notes || discrepancyNotes })
      })
      const data = await response.json()

      if (data.success) {
        setSuccessData({
          invoiceNumber: data.data.invoiceNumber,
          customerName: data.data.customerName,
          totalDelivered: data.data.totalDelivered,
          hasDiscrepancies: data.data.hasDiscrepancies
        })
        setShowSuccess(true)
      } else {
        setError(data.error)
        if (data.requiresNote) {
          setShowDiscrepancyModal(true)
        }
      }
    } catch (err) {
      setError('Error al completar entrega')
      console.error(err)
    } finally {
      setCompleting(false)
    }
  }

  // Handle success close
  const handleSuccessClose = () => {
    setShowSuccess(false)
    onComplete()
  }

  // Cancel
  const handleCancel = () => {
    const hasValidated = lines.some(l => l.quantityValidated > 0)
    if (hasValidated) {
      if (confirm('Hay productos validados. Desea cancelar la entrega?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }

  // Calculate totals
  const totalToDeliver = lines.reduce((sum, l) => sum + l.quantityValidated, 0)
  const totalExpected = lines.reduce((sum, l) => sum + l.quantityExpected, 0)
  const completedProducts = lines.filter(l => getValidationStatus(l.quantityValidated, l.quantityExpected) === 'complete').length
  const totalProducts = lines.length
  const progressPercent = totalExpected > 0 ? Math.round((totalToDeliver / totalExpected) * 100) : 0

  // Discrepancy lines
  const discrepancyLines = lines.filter(l => !areEqual(l.quantityValidated, l.quantityExpected))

  // Loading state
  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px]">
        <div className={cn(
          'text-center p-8 rounded-2xl',
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}>
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Cargando datos de entrega...</p>
        </div>
      </div>
    )
  }

  // Success Modal
  if (showSuccess && successData) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px]">
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
            Entrega Completada
          </h2>
          <p className="text-gray-500 mb-2">
            Factura {successData.invoiceNumber}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Cliente: {successData.customerName}
          </p>
          <p className="text-3xl font-bold text-emerald-600 mb-2">
            {formatQty(successData.totalDelivered)} unidades
          </p>
          {successData.hasDiscrepancies && (
            <p className="text-sm text-amber-600 flex items-center justify-center gap-1 mb-4">
              <AlertTriangle className="w-4 h-4" />
              Entrega con discrepancias registradas
            </p>
          )}
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

  // Main Validation View
  return (
    <div className="p-4 space-y-4">
      {/* Header Info */}
      {operation && (
        <div className={cn(
          'p-4 rounded-xl',
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
        )}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Operacion</p>
              <p className="font-mono font-bold text-gray-900 dark:text-white">{operation.operationNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Factura</p>
              <p className="font-medium text-emerald-600 dark:text-emerald-400">{operation.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cliente</p>
              <p className="font-medium text-gray-900 dark:text-white">{operation.customer.name}</p>
              <p className="text-sm text-gray-500">{operation.customer.code}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Almacen</p>
              <p className="font-medium text-gray-900 dark:text-white">{operation.sourceWarehouse.name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className={cn(
        'p-4 rounded-xl',
        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
      )}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progreso de Entrega
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

      {/* Product Search/Scan Field (Optional) */}
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
          placeholder="Escanear codigo de producto (opcional)..."
          className={cn(
            'w-full pl-12 pr-4 py-3 rounded-xl border text-sm',
            'focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
              : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
          )}
        />
        {saving && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-emerald-500 animate-pulse">
            Guardando...
          </span>
        )}
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
        {lines.map(line => {
          const status = getValidationStatus(line.quantityValidated, line.quantityExpected)
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
                    {line.variantName && (
                      <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                        Variante: {line.variantName}
                      </p>
                    )}
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
                      disabled={line.quantityValidated === 0}
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                        line.quantityValidated === 0
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      )}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    <div className="text-center min-w-[90px]">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {formatQty(line.quantityValidated)}
                        </span>
                        <span className="text-lg text-gray-400">/</span>
                        <span className="text-lg text-gray-500">{formatQty(line.quantityExpected)}</span>
                      </div>
                      {!areEqual(line.quantityValidated, line.quantityExpected) && line.quantityValidated > 0 && (
                        <span className={cn(
                          'text-xs font-medium',
                          line.quantityValidated > line.quantityExpected
                            ? 'text-amber-600'
                            : 'text-blue-600'
                        )}>
                          {line.quantityValidated > line.quantityExpected
                            ? `+${formatQty(line.quantityValidated - line.quantityExpected)}`
                            : formatQty(line.quantityValidated - line.quantityExpected)}
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
                      style={{ width: `${Math.min(100, (line.quantityValidated / line.quantityExpected) * 100)}%` }}
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
                      <label className="block text-xs text-gray-500 mb-1">Cantidad manual</label>
                      <input
                        type="number"
                        value={line.quantityValidated}
                        onChange={(e) => updateLineQuantity(line.lineId, parseFloat(e.target.value) || 0)}
                        min={0}
                        step="any"
                        className={cn(
                          'w-full px-3 py-2 rounded-lg border text-center font-bold',
                          theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'
                        )}
                      />
                      <p className="text-xs text-gray-400 mt-1 text-center">
                        Esperado: {formatQty(line.quantityExpected)} | Max: {formatQty(line.quantityExpected + 5)}
                      </p>
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
            <p className="text-sm text-gray-500">Total a Entregar</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatQty(totalToDeliver)} <span className="text-lg text-gray-400">/ {formatQty(totalExpected)}</span> unidades
            </p>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCancel}
              disabled={completing}
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
              onClick={deliverAll}
              disabled={completing || totalToDeliver >= totalExpected}
              className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-xl transition-all font-medium',
                theme === 'dark'
                  ? 'bg-blue-900/50 text-blue-300 hover:bg-blue-900/70'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                (completing || totalToDeliver >= totalExpected) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Package className="w-5 h-5" />
              Entregar Todo
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCompleteClick}
              disabled={completing || totalToDeliver === 0}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-medium text-white shadow-lg',
                'bg-gradient-to-r from-emerald-500 to-emerald-600',
                (completing || totalToDeliver === 0)
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:from-emerald-600 hover:to-emerald-700'
              )}
            >
              {completing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Confirmar Entrega
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Discrepancy Notes Modal */}
      <AnimatePresence>
        {showDiscrepancyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                'rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">Discrepancia Detectada</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {discrepancyLines.length} producto(s) con diferencias
                  </p>
                </div>
              </div>

              <div className={cn(
                'mb-4 p-3 rounded-xl space-y-2 max-h-40 overflow-y-auto',
                theme === 'dark' ? 'bg-amber-900/20' : 'bg-amber-50'
              )}>
                {discrepancyLines.map(line => {
                  const diff = line.quantityValidated - line.quantityExpected
                  return (
                    <div key={line.lineId} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-800 dark:text-gray-200 truncate block">
                          {line.productName}
                        </span>
                        {line.variantName && (
                          <span className="text-purple-600 dark:text-purple-400 text-xs">
                            {line.variantName}
                          </span>
                        )}
                      </div>
                      <div className="text-right ml-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatQty(line.quantityValidated)}/{formatQty(line.quantityExpected)}
                        </span>
                        <span className={`ml-2 font-bold ${diff > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                          ({diff > 0 ? '+' : ''}{formatQty(diff)})
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Explique las diferencias (obligatorio)
                </label>
                <textarea
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  placeholder="Ej: Faltaron 2 unidades del producto X debido a..."
                  className={cn(
                    'w-full px-4 py-3 border rounded-xl resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  )}
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDiscrepancyModal(false)}
                  className={cn(
                    'flex-1 px-4 py-3 border rounded-xl transition-colors',
                    theme === 'dark'
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  )}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => completeDelivery(discrepancyNotes)}
                  disabled={!discrepancyNotes.trim()}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-xl font-semibold transition-all',
                    discrepancyNotes.trim()
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  )}
                >
                  Confirmar con Nota
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
