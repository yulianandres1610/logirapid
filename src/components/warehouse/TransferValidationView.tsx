'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ArrowRight, Package, Check, AlertTriangle,
  ScanBarcode, CheckCircle, XCircle, MessageSquare
} from 'lucide-react'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'
import ValidationProductCard from './ValidationProductCard'

interface TransferLine {
  lineId: number
  productId: number
  productName: string
  sku: string
  barcode?: string
  quantityExpected: number
  quantityValidated: number
  isComplete?: boolean
}

interface TransferOperation {
  id: number
  operationNumber: string
  sourceWarehouse: {
    id: number
    name: string
    code: string
  }
  destinationWarehouse: {
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

interface TransferValidationViewProps {
  warehouseId: number
  operationId: number
  onClose: () => void
  onComplete: () => void
}

export default function TransferValidationView({
  warehouseId,
  operationId,
  onClose,
  onComplete
}: TransferValidationViewProps) {
  const [operation, setOperation] = useState<TransferOperation | null>(null)
  const [lines, setLines] = useState<TransferLine[]>([])
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
  const [completedData, setCompletedData] = useState<{
    operationNumber: string
    sourceWarehouseName: string
    totalProducts: number
    totalExpected: number
    totalReceived: number
    hasDiscrepancies: boolean
  } | null>(null)

  // Fetch validation data
  const fetchValidationData = useCallback(async () => {
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/operations/${operationId}/validate`)
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
    // Find product by barcode or SKU
    const line = lines.find(l =>
      l.barcode === barcode ||
      l.sku === barcode ||
      l.sku.toLowerCase() === barcode.toLowerCase()
    )

    if (!line) {
      setScanFeedback({ type: 'error', message: `Producto no encontrado: ${barcode}` })
      setTimeout(() => setScanFeedback(null), 2000)
      return
    }

    // Increment validated quantity
    const newQuantity = line.quantityValidated + 1
    setLastScannedProduct(line.productName)

    // Update locally first for immediate feedback
    setLines(prev => prev.map(l =>
      l.lineId === line.lineId
        ? { ...l, quantityValidated: newQuantity, isComplete: newQuantity >= l.quantityExpected }
        : l
    ))

    // Show feedback
    if (newQuantity === line.quantityExpected) {
      setScanFeedback({ type: 'success', message: `${line.productName} - Completo!` })
    } else if (newQuantity > line.quantityExpected) {
      setScanFeedback({ type: 'error', message: `${line.productName} - Excede cantidad esperada` })
    } else {
      setScanFeedback({ type: 'success', message: `${line.productName} - ${newQuantity}/${line.quantityExpected}` })
    }
    setTimeout(() => setScanFeedback(null), 1500)

    // Save to server
    await saveValidation([{ lineId: line.lineId, quantityValidated: newQuantity }])
  }, [lines])

  // Enable barcode scanning
  useBarcodeScan({
    onScan: handleBarcodeScan,
    enabled: !loading && !completing && !showDiscrepancyModal
  })

  // Save validation to server
  const saveValidation = async (updates: { lineId: number; quantityValidated: number }[]) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/operations/${operationId}/validate`, {
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

  // Handle manual increment/decrement
  const handleIncrement = async (lineId: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    const newQuantity = line.quantityValidated + 1
    setLines(prev => prev.map(l =>
      l.lineId === lineId
        ? { ...l, quantityValidated: newQuantity, isComplete: newQuantity >= l.quantityExpected }
        : l
    ))
    await saveValidation([{ lineId, quantityValidated: newQuantity }])
  }

  const handleDecrement = async (lineId: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line || line.quantityValidated <= 0) return

    const newQuantity = line.quantityValidated - 1
    setLines(prev => prev.map(l =>
      l.lineId === lineId
        ? { ...l, quantityValidated: newQuantity, isComplete: newQuantity >= l.quantityExpected }
        : l
    ))
    await saveValidation([{ lineId, quantityValidated: newQuantity }])
  }

  // Handle complete reception
  const handleCompleteClick = () => {
    const hasDiscrepancies = lines.some(l => l.quantityValidated !== l.quantityExpected)
    if (hasDiscrepancies) {
      setShowDiscrepancyModal(true)
    } else {
      completeReception()
    }
  }

  const completeReception = async (notes?: string) => {
    setCompleting(true)
    setShowDiscrepancyModal(false)
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/operations/${operationId}/complete-reception`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discrepancyNotes: notes || discrepancyNotes })
      })
      const data = await response.json()

      if (data.success) {
        // Show success modal with summary
        setCompletedData({
          operationNumber: data.data.operationNumber,
          sourceWarehouseName: data.data.sourceWarehouseName,
          totalProducts: data.data.totalProducts,
          totalExpected: data.data.totalExpected,
          totalReceived: data.data.totalReceived,
          hasDiscrepancies: data.data.hasDiscrepancies
        })
        setShowSuccessModal(true)
      } else {
        setError(data.error)
        if (data.requiresNote) {
          setShowDiscrepancyModal(true)
        }
      }
    } catch (err) {
      setError('Error al completar recepción')
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
        <div className="bg-white rounded-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando validación...</p>
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Validar Transferencia</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {operation && (
            <div className="flex items-center gap-4 text-sm">
              <span className="font-mono bg-white/20 px-3 py-1 rounded-lg">
                {operation.operationNumber}
              </span>
              <div className="flex items-center gap-2">
                <span>{operation.sourceWarehouse.name}</span>
                <ArrowRight className="w-4 h-4" />
                <span className="font-semibold">{operation.destinationWarehouse.name}</span>
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
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Progreso de Validación
              </span>
              <span className="text-sm font-bold text-purple-600">
                {progress.progressPercent}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress.progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <span>{progress.completedLines} de {progress.totalLines} productos completos</span>
              <span>{progress.totalValidated} de {progress.totalExpected} unidades</span>
            </div>
          </div>
        )}

        {/* Scanner Hint */}
        <div className="px-6 py-3 bg-purple-50 border-b flex items-center gap-3">
          <ScanBarcode className="w-5 h-5 text-purple-600" />
          <span className="text-sm text-purple-700">
            Escanea productos para validar automáticamente
          </span>
          {saving && (
            <span className="ml-auto text-xs text-purple-500 animate-pulse">
              Guardando...
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Products List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {lines.map((line) => (
            <ValidationProductCard
              key={line.lineId}
              productName={line.productName}
              sku={line.sku}
              quantityExpected={line.quantityExpected}
              quantityValidated={line.quantityValidated}
              isActive={lastScannedProduct === line.productName}
              onIncrement={() => handleIncrement(line.lineId)}
              onDecrement={() => handleDecrement(line.lineId)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-3 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            onClick={handleCompleteClick}
            disabled={completing || (progress?.totalValidated || 0) === 0}
            className={`px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
              (progress?.totalValidated || 0) === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
                Confirmar Recepción
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
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Discrepancia Detectada</h3>
                  <p className="text-sm text-gray-500">
                    Las cantidades no coinciden con lo esperado
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Explique las diferencias (obligatorio)
                </label>
                <textarea
                  value={discrepancyNotes}
                  onChange={(e) => setDiscrepancyNotes(e.target.value)}
                  placeholder="Ej: Faltaron 2 unidades del producto X debido a..."
                  className="w-full px-4 py-3 border rounded-xl resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  rows={4}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDiscrepancyModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => completeReception(discrepancyNotes)}
                  disabled={!discrepancyNotes.trim()}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all ${
                    discrepancyNotes.trim()
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
              className="bg-white rounded-2xl p-8 max-w-md w-full text-center"
            >
              {/* Success Icon */}
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Transferencia Recibida
              </h3>
              <p className="text-gray-500 mb-6">
                La mercancía ha sido validada y agregada al inventario
              </p>

              {/* Document Number */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-gray-500 mb-1">Número de Documento</p>
                <p className="text-xl font-bold text-purple-700 font-mono">
                  {completedData.operationNumber}
                </p>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Resumen de Recepción
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Origen:</span>
                    <span className="font-medium">{completedData.sourceWarehouseName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Productos:</span>
                    <span className="font-medium">{completedData.totalProducts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Unidades recibidas:</span>
                    <span className="font-medium text-green-600">
                      {completedData.totalReceived} de {completedData.totalExpected}
                    </span>
                  </div>
                  {completedData.hasDiscrepancies && (
                    <div className="flex items-center gap-2 text-amber-600 mt-2 pt-2 border-t">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-xs">Recepción con discrepancias registradas</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={handleCloseSuccess}
                className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                Aceptar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
