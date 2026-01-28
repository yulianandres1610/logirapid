'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Package, Check, AlertTriangle,
  ScanBarcode, CheckCircle, XCircle, MessageSquare,
  Printer, Calendar, Plus, Minus, Circle, Tag,
  Building2, FileText, User
} from 'lucide-react'
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
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [expandedLineId, setExpandedLineId] = useState<number | null>(null)
  const [completedData, setCompletedData] = useState<{
    operationNumber: string
    invoiceNumber: string
    customerName: string
    warehouseName: string
    totalProducts: number
    totalExpected: number
    totalDelivered: number
    hasDiscrepancies: boolean
    completedAt: string
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

  const handleIncrement = async (lineId: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    const newQuantity = line.quantityValidated + 1
    setLines(prev => prev.map(l =>
      l.lineId === lineId
        ? { ...l, quantityValidated: newQuantity, isComplete: isQuantityComplete(newQuantity, l.quantityExpected) }
        : l
    ))
    await saveValidation([{ lineId, quantityValidated: newQuantity }])
  }

  const handleDecrement = async (lineId: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line || line.quantityValidated <= 0) return

    const newQuantity = Math.max(0, line.quantityValidated - 1)
    setLines(prev => prev.map(l =>
      l.lineId === lineId
        ? { ...l, quantityValidated: newQuantity, isComplete: isQuantityComplete(newQuantity, l.quantityExpected) }
        : l
    ))
    await saveValidation([{ lineId, quantityValidated: newQuantity }])
  }

  const handleSetQuantity = async (lineId: number, quantity: number) => {
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

  const handleCompleteLine = async (lineId: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    const newQuantity = line.quantityExpected

    setLines(prev => prev.map(l =>
      l.lineId === lineId
        ? { ...l, quantityValidated: newQuantity, isComplete: true }
        : l
    ))
    await saveValidation([{ lineId, quantityValidated: newQuantity }])
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
        setCompletedData({
          operationNumber: data.data.operationNumber,
          invoiceNumber: data.data.invoiceNumber,
          customerName: data.data.customerName,
          warehouseName: data.data.warehouseName,
          totalProducts: data.data.totalProducts,
          totalExpected: data.data.totalExpected,
          totalDelivered: data.data.totalDelivered,
          hasDiscrepancies: data.data.hasDiscrepancies,
          completedAt: new Date().toISOString()
        })
        setShowSuccessModal(true)
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

  const handleCloseSuccess = () => {
    setShowSuccessModal(false)
    onComplete()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando entrega...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Entrega Mayorista</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {operation && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-4">
                <span className="font-mono bg-white/20 px-3 py-1 rounded-lg">
                  {operation.operationNumber}
                </span>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Factura: {operation.invoiceNumber}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span className="font-semibold">{operation.customer.name}</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <Building2 className="w-4 h-4" />
                  <span>Desde: {operation.sourceWarehouse.name}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scan Feedback */}
        <AnimatePresence>
          {scanFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`p-4 flex items-center gap-3 ${
                scanFeedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
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

        {/* Progress Bar */}
        {progress && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progreso de Entrega
              </span>
              <span className="text-sm font-bold text-green-600 dark:text-green-400">
                {progress.progressPercent}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress.progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{progress.completedLines} de {progress.totalLines} productos completos</span>
              <span>{formatQty(progress.totalValidated)} de {formatQty(progress.totalExpected)} unidades</span>
            </div>
          </div>
        )}

        {/* Scanner Hint */}
        <div className="px-6 py-3 bg-green-50 dark:bg-green-900/30 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <ScanBarcode className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-sm text-green-700 dark:text-green-300">
            Escanea productos para validar automáticamente
          </span>
          {saving && (
            <span className="ml-auto text-xs text-green-500 dark:text-green-400 animate-pulse">
              Guardando...
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Products List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {lines.map((line) => {
            const isComplete = isQuantityComplete(line.quantityValidated, line.quantityExpected)
            const hasExcess = line.quantityValidated > line.quantityExpected + 0.001
            const isPartial = line.quantityValidated > 0 && !isComplete
            const isActive = lastScannedProduct === line.productName
            const isExpanded = expandedLineId === line.lineId
            const difference = line.quantityValidated - line.quantityExpected
            const showDifference = !areEqual(line.quantityValidated, line.quantityExpected) && line.quantityValidated > 0

            let statusIcon = <Circle className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            let bgColor = 'bg-white dark:bg-gray-700'
            let borderColor = 'border-gray-200 dark:border-gray-600'

            if (isComplete && !hasExcess) {
              statusIcon = <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              bgColor = 'bg-green-50 dark:bg-green-900/30'
              borderColor = 'border-green-300 dark:border-green-600'
            } else if (hasExcess) {
              statusIcon = <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              bgColor = 'bg-amber-50 dark:bg-amber-900/30'
              borderColor = 'border-amber-300 dark:border-amber-600'
            } else if (isPartial) {
              statusIcon = <Circle className="w-5 h-5 text-blue-500 dark:text-blue-400 fill-blue-200 dark:fill-blue-800" />
              bgColor = 'bg-blue-50 dark:bg-blue-900/30'
              borderColor = 'border-blue-300 dark:border-blue-600'
            }

            if (isActive) {
              borderColor = 'border-green-500 ring-2 ring-green-200 dark:ring-green-800'
            }

            return (
              <motion.div
                key={line.lineId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${bgColor} ${borderColor} border rounded-xl transition-all duration-200`}
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedLineId(isExpanded ? null : line.lineId)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {statusIcon}
                    </div>

                    <div className="flex-grow min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">{line.productName}</h4>
                      {line.variantName && (
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {line.variantName}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {line.sku}</p>
                    </div>

                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {line.quantityValidated > 0 && (
                        <button
                          onClick={() => handleDecrement(line.lineId)}
                          className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center text-gray-600 dark:text-gray-300 transition-colors"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                      )}

                      {!isComplete && (
                        <button
                          onClick={() => handleCompleteLine(line.lineId)}
                          className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-800/50 flex items-center justify-center text-green-600 dark:text-green-400 transition-colors"
                          title="Completar cantidad"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      )}

                      <div className="text-center min-w-[90px]">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatQty(line.quantityValidated)}</span>
                          <span className="text-lg text-gray-400 dark:text-gray-500">/</span>
                          <span className="text-lg text-gray-600 dark:text-gray-400">{formatQty(line.quantityExpected)}</span>
                        </div>
                        {showDifference && (
                          <span className={`text-xs font-medium ${difference > 0.001 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {difference > 0.001 ? `+${formatQty(difference)}` : formatQty(difference)}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleIncrement(line.lineId)}
                        className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-800/50 flex items-center justify-center text-green-600 dark:text-green-400 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isComplete && !hasExcess ? 'bg-green-500' :
                          hasExcess ? 'bg-amber-500' :
                          line.quantityValidated > 0 ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
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
                      <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                          Cantidad manual (permite decimales)
                        </label>
                        <input
                          type="number"
                          value={line.quantityValidated}
                          onChange={(e) => handleSetQuantity(line.lineId, parseFloat(e.target.value) || 0)}
                          min={0}
                          step="any"
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-center text-xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
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

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={handleCompleteClick}
            disabled={completing || (progress?.totalValidated || 0) === 0}
            className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
              (progress?.totalValidated || 0) === 0
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg'
            }`}
          >
            {completing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Procesando...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Completar Entrega
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Discrepancy Notes Modal */}
      <AnimatePresence>
        {showDiscrepancyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
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

              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl space-y-2 max-h-40 overflow-y-auto">
                {discrepancyLines.map(line => {
                  const diff = line.quantityValidated - line.quantityExpected
                  return (
                    <div key={line.lineId} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-800 dark:text-gray-200 truncate block">
                          {line.productName}
                        </span>
                        {line.variantName && (
                          <span className="text-green-600 dark:text-green-400 text-xs">
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
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDiscrepancyModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => completeDelivery(discrepancyNotes)}
                  disabled={!discrepancyNotes.trim()}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                    discrepancyNotes.trim()
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Confirmar con Nota
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && completedData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-lg w-full text-center"
            >
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Entrega Completada
              </h3>
              <p className="text-gray-500 mb-4">
                Los productos han sido entregados y descontados del inventario
              </p>

              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date().toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 mb-6">
                <p className="text-sm text-gray-500 mb-1">Factura</p>
                <p className="text-2xl font-bold text-green-700 font-mono">
                  {completedData.invoiceNumber}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left">
                <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Resumen de Entrega
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block mb-1">Cliente</span>
                    <span className="font-semibold text-gray-800">{completedData.customerName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Almacén</span>
                    <span className="font-semibold text-gray-800">{completedData.warehouseName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Total Productos</span>
                    <span className="font-semibold text-gray-800">{completedData.totalProducts}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Unidades Entregadas</span>
                    <span className="font-semibold text-green-600">
                      {formatQty(completedData.totalDelivered)} / {formatQty(completedData.totalExpected)}
                    </span>
                  </div>
                </div>
                {completedData.hasDiscrepancies && (
                  <div className="flex items-center gap-2 text-amber-600 mt-4 pt-3 border-t border-gray-200">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">Entrega con discrepancias registradas</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCloseSuccess}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Aceptar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
