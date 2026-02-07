'use client'

import { useState, useEffect, useCallback } from 'react'
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
  ScanBarcode,
  XCircle,
  Plus,
  Minus,
  Tag,
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

function isQuantityComplete(validated: number, expected: number): boolean {
  return validated >= expected - 0.001
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
  isComplete?: boolean
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

interface Progress {
  totalLines: number
  completedLines: number
  totalExpected: number
  totalValidated: number
  progressPercent: number
  isAllValidated: boolean
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
  const [operation, setOperation] = useState<DeliveryOperation | null>(null)
  const [lines, setLines] = useState<DeliveryLine[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false)
  const [discrepancyNotes, setDiscrepancyNotes] = useState('')
  const [lastScannedProduct, setLastScannedProduct] = useState<string | null>(null)
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successData, setSuccessData] = useState<{
    operationNumber: string
    invoiceNumber: string
    customerName: string
    warehouseName: string
    totalProducts: number
    totalExpected: number
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
        setProgress(data.data.progress)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al cargar datos de validación')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [warehouseId, operationId])

  useEffect(() => {
    fetchValidationData()
  }, [fetchValidationData])

  // Handle barcode scan
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    const line = lines.find(l =>
      l.barcode === barcode ||
      l.sku === barcode ||
      l.sku?.toLowerCase() === barcode.toLowerCase()
    )

    if (!line) {
      setScanFeedback({ type: 'error', message: `Producto no encontrado: ${barcode}` })
      setTimeout(() => setScanFeedback(null), 2000)
      return
    }

    const newQuantity = line.quantityValidated + 1
    setLastScannedProduct(line.productName)

    setLines(prev => prev.map(l =>
      l.lineId === line.lineId
        ? { ...l, quantityValidated: newQuantity, isComplete: newQuantity >= l.quantityExpected }
        : l
    ))

    const displayName = line.variantName ? `${line.productName} - ${line.variantName}` : line.productName
    if (newQuantity === line.quantityExpected) {
      setScanFeedback({ type: 'success', message: `${displayName} - Completo!` })
    } else if (newQuantity > line.quantityExpected) {
      setScanFeedback({ type: 'error', message: `${displayName} - Excede cantidad esperada` })
    } else {
      setScanFeedback({ type: 'success', message: `${displayName} - ${formatQty(newQuantity)}/${formatQty(line.quantityExpected)}` })
    }
    setTimeout(() => setScanFeedback(null), 1500)

    await saveValidation([{ lineId: line.lineId, quantityValidated: newQuantity }])
  }, [lines])

  useBarcodeScan({
    onScan: handleBarcodeScan,
    enabled: !loading && !completing && !showDiscrepancyModal
  })

  const saveValidation = async (updates: { lineId: number; quantityValidated: number }[]) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/wholesale-deliveries/${operationId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: updates })
      })
      const data = await response.json()

      if (data.success) {
        setProgress(data.data.progress)
      }
    } catch (err) {
      console.error('Error saving validation:', err)
    } finally {
      setSaving(false)
    }
  }

  const updateLineQuantity = async (lineId: number, quantity: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    const maxQty = line.quantityExpected + 5
    const newQuantity = Math.max(0, Math.min(quantity, maxQty))

    setLines(prev => prev.map(l =>
      l.lineId === lineId
        ? { ...l, quantityValidated: newQuantity, isComplete: isQuantityComplete(newQuantity, l.quantityExpected) }
        : l
    ))
    await saveValidation([{ lineId, quantityValidated: newQuantity }])
  }

  const handleIncrement = async (lineId: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return
    await updateLineQuantity(lineId, line.quantityValidated + 1)
  }

  const handleDecrement = async (lineId: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line || line.quantityValidated <= 0) return
    await updateLineQuantity(lineId, line.quantityValidated - 1)
  }

  const handleCompleteLine = async (lineId: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return
    await updateLineQuantity(lineId, line.quantityExpected)
  }

  const handleCompleteClick = () => {
    const hasDiscrepancies = lines.some(l => !areEqual(l.quantityValidated, l.quantityExpected))
    if (hasDiscrepancies) {
      setShowDiscrepancyModal(true)
    } else {
      completeDelivery()
    }
  }

  const discrepancyLines = lines.filter(l => !areEqual(l.quantityValidated, l.quantityExpected))

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
          operationNumber: data.data.operationNumber,
          invoiceNumber: data.data.invoiceNumber,
          customerName: data.data.customerName,
          warehouseName: data.data.warehouseName,
          totalProducts: data.data.totalProducts,
          totalExpected: data.data.totalExpected,
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

  const handleSuccessClose = () => {
    setShowSuccess(false)
    onComplete()
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
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

  // Main View
  const totalToDeliver = lines.reduce((sum, l) => sum + l.quantityValidated, 0)

  return (
    <div className="p-4 space-y-4">
      {/* Header Card */}
      {operation && (
        <div className={cn(
          'p-5 rounded-2xl border',
          theme === 'dark'
            ? 'bg-gradient-to-r from-emerald-900/50 to-green-900/50 border-emerald-700'
            : 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200'
        )}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold',
                theme === 'dark' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
              )}>
                <Package className="w-6 h-6" />
              </div>
              <div>
                <p className="font-mono font-bold text-gray-900 dark:text-white">{operation.operationNumber}</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Factura: {operation.invoiceNumber}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Cliente</p>
                <p className="font-semibold text-gray-900 dark:text-white">{operation.customer.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Almacén</p>
                <p className="font-semibold text-gray-900 dark:text-white">{operation.sourceWarehouse.name}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700/50">
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(operation.createdAt)}
            </div>
            <span className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            )}>
              Pendiente Validación
            </span>
          </div>
        </div>
      )}

      {/* Scan Feedback */}
      <AnimatePresence>
        {scanFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'p-4 rounded-xl flex items-center gap-3',
              scanFeedback.type === 'success'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            )}
          >
            {scanFeedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{scanFeedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanner Hint */}
      <div className={cn(
        'p-3 rounded-xl flex items-center gap-3',
        theme === 'dark' ? 'bg-emerald-900/20 border border-emerald-800' : 'bg-emerald-50 border border-emerald-200'
      )}>
        <ScanBarcode className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm text-emerald-700 dark:text-emerald-300">
          Escanea productos para validar automáticamente
        </span>
        {saving && (
          <span className="ml-auto text-xs text-emerald-500 dark:text-emerald-400 animate-pulse">
            Guardando...
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className={cn(
          'p-4 rounded-xl flex items-center gap-3',
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
        )}>
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {progress && (
        <div className={cn(
          'p-4 rounded-xl',
          theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-gray-50 border border-gray-200'
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progreso: {progress.completedLines} de {progress.totalLines} productos
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {progress.progressPercent}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-500 to-green-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress.progressPercent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Products List */}
      <div className="space-y-3">
        {lines.map(line => {
          const isComplete = isQuantityComplete(line.quantityValidated, line.quantityExpected)
          const hasExcess = line.quantityValidated > line.quantityExpected + 0.001
          const hasDiscrepancy = !areEqual(line.quantityValidated, line.quantityExpected) && line.quantityValidated > 0

          return (
            <motion.div
              key={line.lineId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-4 rounded-xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200',
                isComplete && !hasExcess && 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/20',
                hasExcess && 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{line.productName}</p>
                    {isComplete && !hasExcess && (
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    )}
                    {hasExcess && (
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                  {line.variantName && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {line.variantName}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">SKU: {line.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Esperado:</p>
                  <p className="font-bold text-gray-900 dark:text-white">{formatQty(line.quantityExpected)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* Quantity Controls */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cantidad Validada</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDecrement(line.lineId)}
                      disabled={line.quantityValidated <= 0}
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                        line.quantityValidated > 0
                          ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      )}
                    >
                      <Minus className="w-5 h-5" />
                    </button>

                    <input
                      type="number"
                      value={line.quantityValidated}
                      onChange={(e) => updateLineQuantity(line.lineId, parseFloat(e.target.value) || 0)}
                      min={0}
                      step="any"
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg border text-center font-bold text-lg',
                        theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200',
                        hasDiscrepancy && 'border-amber-500'
                      )}
                    />

                    <button
                      onClick={() => handleIncrement(line.lineId)}
                      className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>

                    {!isComplete && (
                      <button
                        onClick={() => handleCompleteLine(line.lineId)}
                        className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors flex items-center gap-1"
                        title="Completar cantidad"
                      >
                        <Check className="w-4 h-4" />
                        Completo
                      </button>
                    )}
                  </div>
                  {hasDiscrepancy && (
                    <p className={cn(
                      'text-xs mt-1 font-medium',
                      hasExcess ? 'text-amber-600' : 'text-blue-600'
                    )}>
                      Diferencia: {line.quantityValidated > line.quantityExpected ? '+' : ''}{formatQty(line.quantityValidated - line.quantityExpected)}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
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
            <p className="text-sm text-gray-500">Total a Entregar</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatQty(totalToDeliver)} unidades</p>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
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
              onClick={handleCompleteClick}
              disabled={completing || totalToDeliver === 0}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl transition-all font-medium',
                'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg',
                (completing || totalToDeliver === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:from-emerald-600 hover:to-green-700'
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
                  Completar Entrega
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
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs">
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
