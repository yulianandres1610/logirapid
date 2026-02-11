'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Building2,
  Calendar,
  User,
  ChevronRight,
  Plus,
  Minus,
  ArrowLeft,
  Layers,
  DollarSign
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Image from 'next/image'

interface PendingSupplierReturnsViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
  onComplete: (data: { totalUnits: number; supplierName: string; returnNumber: string }) => void
}

interface PendingReturn {
  id: number
  returnNumber: string
  orderNumber: string
  orderId: number
  supplier: {
    id: number
    code: string
    name: string
  }
  status: string
  totalItems: number
  totalUnits: number
  totalValue: number
  reason: string
  reasonLabel: string
  notes: string | null
  createdAt: string
  createdByName: string
  lines: ReturnLine[]
}

interface ReturnLine {
  id: number
  orderLineId: number
  product: {
    id: number
    name: string
    sku: string
    barcode: string | null
    imageUrl: string | null
  }
  variantId: number | null
  variantName: string | null
  variantSku: string | null
  quantityToReturn: number
  unitCost: number
}

interface ValidationLine {
  lineId: number
  quantityToReturn: number
  quantityValidated: number
  productName: string
  unitCost: number
}

export default function PendingSupplierReturnsView({
  warehouseId,
  warehouseName,
  onBack,
  onComplete
}: PendingSupplierReturnsViewProps) {
  // List state
  const [pendingReturns, setPendingReturns] = useState<PendingReturn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Validation state
  const [selectedReturn, setSelectedReturn] = useState<PendingReturn | null>(null)
  const [validationLines, setValidationLines] = useState<ValidationLine[]>([])
  const [validationNotes, setValidationNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch pending returns
  const fetchPendingReturns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/pending-returns`)
      const data = await response.json()
      if (data.success) {
        setPendingReturns(data.data.pendingReturns)
      } else {
        setError(data.error || 'Error al cargar devoluciones')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [warehouseId])

  useEffect(() => {
    fetchPendingReturns()
  }, [fetchPendingReturns])

  // Select return for validation
  const handleSelectReturn = (returnItem: PendingReturn) => {
    setSelectedReturn(returnItem)
    setValidationLines(returnItem.lines.map(line => ({
      lineId: line.id,
      quantityToReturn: line.quantityToReturn,
      quantityValidated: line.quantityToReturn, // Default to requested quantity
      productName: line.variantName
        ? `${line.product.name} - ${line.variantName}`
        : line.product.name,
      unitCost: line.unitCost
    })))
    setValidationNotes('')
    setError(null)
  }

  // Update validated quantity
  const updateValidatedQuantity = (lineId: number, delta: number) => {
    setValidationLines(prev => prev.map(line => {
      if (line.lineId === lineId) {
        const newQty = Math.max(0, Math.min(line.quantityValidated + delta, line.quantityToReturn))
        return { ...line, quantityValidated: newQty }
      }
      return line
    }))
  }

  const setValidatedQuantity = (lineId: number, quantity: number) => {
    setValidationLines(prev => prev.map(line => {
      if (line.lineId === lineId) {
        const newQty = Math.max(0, Math.min(quantity, line.quantityToReturn))
        return { ...line, quantityValidated: newQty }
      }
      return line
    }))
  }

  // Calculate totals
  const totalValidated = validationLines.reduce((sum, l) => sum + l.quantityValidated, 0)
  const totalValueValidated = validationLines.reduce((sum, l) => sum + (l.quantityValidated * l.unitCost), 0)

  // Submit validation
  const handleSubmitValidation = async () => {
    if (!selectedReturn || submitting) return

    const linesToValidate = validationLines.filter(l => l.quantityValidated > 0)
    if (linesToValidate.length === 0) {
      setError('Debe validar al menos un producto')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/market/warehouses/${warehouseId}/pending-returns/${selectedReturn.id}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lines: linesToValidate.map(l => ({
              lineId: l.lineId,
              quantityValidated: l.quantityValidated
            })),
            notes: validationNotes || undefined
          })
        }
      )

      const data = await response.json()

      if (data.success) {
        onComplete({
          totalUnits: data.data.totalUnits,
          supplierName: selectedReturn.supplier.name,
          returnNumber: data.data.returnNumber
        })
        setSelectedReturn(null)
        fetchPendingReturns()
      } else {
        setError(data.error || 'Error al completar devolución')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  // Back from validation view
  const handleBackFromValidation = () => {
    setSelectedReturn(null)
    setValidationLines([])
    setValidationNotes('')
    setError(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    )
  }

  // Validation View
  if (selectedReturn) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackFromValidation}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center flex-1">
              <p className="text-sm text-white/80">Procesar Devolución</p>
              <p className="text-xl font-bold">{selectedReturn.returnNumber}</p>
            </div>
            <div className="w-9" />
          </div>
        </div>

        {/* Return Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Proveedor</p>
              <p className="font-medium text-gray-900 dark:text-white">{selectedReturn.supplier.name}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Orden</p>
              <p className="font-medium text-gray-900 dark:text-white">{selectedReturn.orderNumber}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Motivo</p>
              <p className="font-medium text-gray-900 dark:text-white">{selectedReturn.reasonLabel}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Solicitado por</p>
              <p className="font-medium text-gray-900 dark:text-white">{selectedReturn.createdByName}</p>
            </div>
          </div>
          {selectedReturn.notes && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                <strong>Notas:</strong> {selectedReturn.notes}
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-500" />
            </button>
          </div>
        )}

        {/* Products to Validate */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Productos a Validar
          </h3>

          <div className="space-y-3">
            {validationLines.map((line) => {
              const originalLine = selectedReturn.lines.find(l => l.id === line.lineId)
              return (
                <div
                  key={line.lineId}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                >
                  <div className="flex items-start gap-4">
                    {/* Product Image */}
                    <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-200 dark:bg-gray-600">
                      {originalLine?.product.imageUrl ? (
                        <Image
                          src={originalLine.product.imageUrl}
                          alt={line.productName}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {line.productName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        SKU: {originalLine?.variantSku || originalLine?.product.sku}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          Solicitado: {line.quantityToReturn}
                        </span>
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          ${line.unitCost.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Validation Controls */}
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Validado</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateValidatedQuantity(line.lineId, -1)}
                          disabled={line.quantityValidated <= 0}
                          className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={line.quantityToReturn}
                          value={line.quantityValidated}
                          onChange={(e) => setValidatedQuantity(line.lineId, parseInt(e.target.value) || 0)}
                          className="w-16 text-center font-bold text-lg rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white py-1"
                        />
                        <button
                          onClick={() => updateValidatedQuantity(line.lineId, 1)}
                          disabled={line.quantityValidated >= line.quantityToReturn}
                          className="p-2 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notas de Validación (opcional)
          </label>
          <textarea
            value={validationNotes}
            onChange={(e) => setValidationNotes(e.target.value)}
            placeholder="Agregar observaciones sobre la validación..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Summary & Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Progreso: <strong>{totalValidated}</strong> / {selectedReturn.totalUnits} unidades
              </p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                Valor a devolver: ${totalValueValidated.toFixed(2)}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmitValidation}
              disabled={totalValidated === 0 || submitting}
              className={`px-6 py-3 rounded-xl font-medium text-white flex items-center gap-2 transition-all ${
                totalValidated > 0 && !submitting
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600'
                  : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Completar Devolución
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    )
  }

  // List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              Devoluciones a Proveedor Pendientes
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {warehouseName}
            </p>
          </div>
          <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-sm font-medium">
            {pendingReturns.length} pendientes
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* List */}
      {pendingReturns.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
            No hay devoluciones pendientes
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Las solicitudes de devolución aparecerán aquí cuando se creen desde consignaciones
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {pendingReturns.map((returnItem) => (
              <motion.div
                key={returnItem.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                onClick={() => handleSelectReturn(returnItem)}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-lg text-sm font-mono font-medium">
                        {returnItem.returnNumber}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Orden: {returnItem.orderNumber}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {returnItem.supplier.name}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({returnItem.supplier.code})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        {returnItem.totalUnits} unidades
                      </span>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        ${returnItem.totalValue.toFixed(2)}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {returnItem.reasonLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(returnItem.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {returnItem.createdByName}
                      </span>
                    </div>
                  </div>

                  <div className="ml-4">
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                      <ChevronRight className="w-5 h-5 text-orange-500" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Back Button */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
        >
          Volver a operaciones
        </button>
      </div>
    </div>
  )
}
