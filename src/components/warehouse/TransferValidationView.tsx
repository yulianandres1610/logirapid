'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ArrowRight, Package, Check, AlertTriangle,
  ScanBarcode, CheckCircle, XCircle, MessageSquare,
  Printer, Calendar, Plus, Minus, Circle, Tag
} from 'lucide-react'
import { useBarcodeScan } from '@/hooks/useBarcodeScan'

// Format quantity - show decimals only if not integer
function formatQty(value: number): string {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(2)
}

// Compare two numbers with tolerance for floating point precision
function areEqual(a: number, b: number, tolerance: number = 0.001): boolean {
  return Math.abs(a - b) < tolerance
}

// Check if quantity is complete (with tolerance)
function isQuantityComplete(validated: number, expected: number): boolean {
  return validated >= expected - 0.001
}

interface TransferLine {
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
  const [expandedLineId, setExpandedLineId] = useState<number | null>(null)
  const [completedData, setCompletedData] = useState<{
    operationNumber: string
    sourceWarehouseName: string
    destinationWarehouseName: string
    totalProducts: number
    totalExpected: number
    totalReceived: number
    hasDiscrepancies: boolean
    completedAt: string
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
    // Find product by barcode or SKU (including variant info)
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
    const displayName = line.variantName ? `${line.productName} - ${line.variantName}` : line.productName
    if (newQuantity === line.quantityExpected) {
      setScanFeedback({ type: 'success', message: `${displayName} - Completo!` })
    } else if (newQuantity > line.quantityExpected) {
      setScanFeedback({ type: 'error', message: `${displayName} - Excede cantidad esperada` })
    } else {
      setScanFeedback({ type: 'success', message: `${displayName} - ${formatQty(newQuantity)}/${formatQty(line.quantityExpected)}` })
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

  // Handle direct quantity setting (for decimal input)
  const handleSetQuantity = async (lineId: number, quantity: number) => {
    const line = lines.find(l => l.lineId === lineId)
    if (!line) return

    // Allow up to expected + 5 extra
    const maxQty = line.quantityExpected + 5
    const newQuantity = Math.max(0, Math.min(quantity, maxQty))

    setLines(prev => prev.map(l =>
      l.lineId === lineId
        ? { ...l, quantityValidated: newQuantity, isComplete: isQuantityComplete(newQuantity, l.quantityExpected) }
        : l
    ))
    await saveValidation([{ lineId, quantityValidated: newQuantity }])
  }

  // Handle complete reception
  const handleCompleteClick = () => {
    // Use tolerance-based comparison for floating point precision
    const hasDiscrepancies = lines.some(l => !areEqual(l.quantityValidated, l.quantityExpected))
    if (hasDiscrepancies) {
      setShowDiscrepancyModal(true)
    } else {
      completeReception()
    }
  }

  // Get lines with discrepancies for the modal
  const discrepancyLines = lines.filter(l => !areEqual(l.quantityValidated, l.quantityExpected))

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
          destinationWarehouseName: operation?.destinationWarehouse?.name || 'Destino',
          totalProducts: data.data.totalProducts,
          totalExpected: data.data.totalExpected,
          totalReceived: data.data.totalReceived,
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

  // Print transfer report
  const handlePrintReport = () => {
    if (!completedData) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const currentDate = new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const productsHtml = lines.map(line => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <div style="font-weight: 600; color: #111827;">${line.productName}</div>
          ${line.variantName ? `<div style="font-size: 12px; color: #7c3aed; font-weight: 500;">Variante: ${line.variantName}</div>` : ''}
          <div style="font-size: 12px; color: #6b7280;">SKU: ${line.sku}</div>
          ${line.barcode ? `
            <div style="margin-top: 8px;">
              <svg id="barcode-${line.lineId}"></svg>
            </div>
          ` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 500;">${formatQty(line.quantityExpected)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: ${line.quantityValidated >= line.quantityExpected ? '#059669' : '#dc2626'};">${formatQty(line.quantityValidated)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${line.quantityValidated >= line.quantityExpected
            ? '<span style="color: #059669;">✓</span>'
            : `<span style="color: #dc2626;">${formatQty(line.quantityValidated - line.quantityExpected)}</span>`}
        </td>
      </tr>
    `).join('')

    const barcodeScripts = lines
      .filter(l => l.barcode)
      .map(line => `JsBarcode("#barcode-${line.lineId}", "${line.barcode}", { format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 10 });`)
      .join('\n')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Recepción de Transferencia - ${completedData.operationNumber}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #111827; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
          .logo { font-size: 24px; font-weight: bold; color: #7c3aed; margin-bottom: 5px; }
          .doc-title { font-size: 18px; color: #374151; margin-bottom: 15px; }
          .doc-number { font-size: 28px; font-weight: bold; color: #111827; font-family: monospace; background: #f3f4f6; padding: 10px 20px; border-radius: 8px; display: inline-block; }
          .date { font-size: 14px; color: #6b7280; margin-top: 15px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-box { background: #f9fafb; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb; }
          .info-box h3 { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
          .info-box p { font-size: 16px; font-weight: 600; color: #111827; }
          .summary-box { background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: white; padding: 25px 30px; border-radius: 12px; margin-bottom: 30px; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 25px; }
          .summary-item { text-align: center; }
          .summary-item .label { font-size: 12px; opacity: 0.9; margin-bottom: 5px; }
          .summary-item .value { font-size: 28px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f3f4f6; padding: 14px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; }
          th:not(:first-child) { text-align: center; }
          .footer { text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
          .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; }
          .status-success { background: #d1fae5; color: #059669; }
          .status-warning { background: #fef3c7; color: #d97706; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">LogiRapid</div>
          <div class="doc-title">Recepción de Transferencia</div>
          <div class="doc-number">${completedData.operationNumber}</div>
          <div class="date">
            <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            ${currentDate}
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Almacén Origen</h3>
            <p>${completedData.sourceWarehouseName}</p>
          </div>
          <div class="info-box">
            <h3>Almacén Destino</h3>
            <p>${completedData.destinationWarehouseName}</p>
          </div>
        </div>

        <div class="summary-box">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="label">Total Productos</div>
              <div class="value">${completedData.totalProducts}</div>
            </div>
            <div class="summary-item">
              <div class="label">Unidades Esperadas</div>
              <div class="value">${completedData.totalExpected}</div>
            </div>
            <div class="summary-item">
              <div class="label">Unidades Recibidas</div>
              <div class="value">${completedData.totalReceived}</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <span class="status-badge ${completedData.hasDiscrepancies ? 'status-warning' : 'status-success'}">
            ${completedData.hasDiscrepancies ? '⚠ Recepción con Discrepancias' : '✓ Recepción Completa'}
          </span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50%;">Producto / Código</th>
              <th>Esperado</th>
              <th>Recibido</th>
              <th>Diferencia</th>
            </tr>
          </thead>
          <tbody>
            ${productsHtml}
          </tbody>
        </table>

        <div class="footer">
          <p>Documento generado automáticamente por LogiRapid</p>
          <p style="margin-top: 5px;">${currentDate}</p>
        </div>

        <script>
          ${barcodeScripts}
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando validación...</p>
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
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progreso de Validación
              </span>
              <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                {progress.progressPercent}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
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
        <div className="px-6 py-3 bg-purple-50 dark:bg-purple-900/30 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <ScanBarcode className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span className="text-sm text-purple-700 dark:text-purple-300">
            Escanea productos para validar automáticamente
          </span>
          {saving && (
            <span className="ml-auto text-xs text-purple-500 dark:text-purple-400 animate-pulse">
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

            // Determine status and colors
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
              borderColor = 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800'
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
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {statusIcon}
                    </div>

                    {/* Product Info */}
                    <div className="flex-grow min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">{line.productName}</h4>
                      {line.variantName && (
                        <p className="text-sm text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {line.variantName}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {line.sku}</p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {/* Decrement Button */}
                      {line.quantityValidated > 0 && (
                        <button
                          onClick={() => handleDecrement(line.lineId)}
                          className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center text-gray-600 dark:text-gray-300 transition-colors"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                      )}

                      {/* Quantity Display */}
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

                      {/* Increment Button */}
                      <button
                        onClick={() => handleIncrement(line.lineId)}
                        className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 hover:bg-purple-200 dark:hover:bg-purple-800/50 flex items-center justify-center text-purple-600 dark:text-purple-400 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
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

                {/* Expanded Section - Manual Quantity Input */}
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
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-center text-xl font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

              {/* List of products with discrepancies */}
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
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                  onClick={() => completeReception(discrepancyNotes)}
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
              {/* Success Icon */}
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Transferencia Recibida
              </h3>
              <p className="text-gray-500 mb-4">
                La mercancía ha sido validada y agregada al inventario
              </p>

              {/* Date */}
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

              {/* Document Number */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 mb-6">
                <p className="text-sm text-gray-500 mb-1">Número de Documento</p>
                <p className="text-2xl font-bold text-purple-700 font-mono">
                  {completedData.operationNumber}
                </p>
              </div>

              {/* Summary - wider */}
              <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left">
                <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Resumen de Recepción
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block mb-1">Origen</span>
                    <span className="font-semibold text-gray-800">{completedData.sourceWarehouseName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Destino</span>
                    <span className="font-semibold text-gray-800">{completedData.destinationWarehouseName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Total Productos</span>
                    <span className="font-semibold text-gray-800">{completedData.totalProducts}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-1">Unidades Recibidas</span>
                    <span className="font-semibold text-green-600">
                      {formatQty(completedData.totalReceived)} / {formatQty(completedData.totalExpected)}
                    </span>
                  </div>
                </div>
                {completedData.hasDiscrepancies && (
                  <div className="flex items-center gap-2 text-amber-600 mt-4 pt-3 border-t border-gray-200">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm">Recepción con discrepancias registradas</span>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handlePrintReport}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Imprimir
                </button>
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
