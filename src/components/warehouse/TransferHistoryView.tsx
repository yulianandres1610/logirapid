'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Package, Clock, User, CheckCircle,
  AlertTriangle, X, ChevronRight, Search, Filter, Printer,
  ArrowUpRight, ArrowDownLeft, Calendar, FileText
} from 'lucide-react'

// Format quantity - show decimals only if not integer
function formatQty(value: number): string {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(3).replace(/\.?0+$/, '')
}

interface TransferLine {
  lineId: number
  productId: number
  variantId: number | null
  productName: string
  variantName: string | null
  sku: string
  barcode: string | null
  quantitySent: number
  quantityReceived: number
  difference: number
  isComplete: boolean
  hasDiscrepancy: boolean
}

interface TransferSummary {
  id: number
  operationNumber: string
  status: string
  validationStatus: string
  direction: 'sent' | 'received'
  sourceWarehouse: { id: number; name: string }
  destinationWarehouse: { id: number; name: string }
  createdAt: string
  completedAt: string | null
  createdBy: string
  totalProducts: number
  totalSent: number
  totalReceived: number
  hasDiscrepancies: boolean
}

interface TransferDetail {
  operation: {
    id: number
    operationNumber: string
    status: string
    validationStatus: string
    notes: string | null
    discrepancyNotes: string | null
    createdAt: string
    completedAt: string | null
    createdBy: string
    sourceWarehouse: { id: number; name: string; code: string }
    destinationWarehouse: { id: number; name: string; code: string }
    direction: 'sent' | 'received'
  }
  lines: TransferLine[]
  summary: {
    totalProducts: number
    totalSent: number
    totalReceived: number
    totalDifference: number
    productsWithDiscrepancy: number
    hasDiscrepancies: boolean
  }
}

interface TransferHistoryViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
  initialOperationId?: number | null
  onSelectOperation?: (operationId: number) => void
}

export default function TransferHistoryView({
  warehouseId,
  warehouseName,
  onBack,
  initialOperationId,
  onSelectOperation
}: TransferHistoryViewProps) {
  const [transfers, setTransfers] = useState<TransferSummary[]>([])
  const [selectedTransfer, setSelectedTransfer] = useState<TransferDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch transfer list
  const fetchTransfers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/market/warehouses/${warehouseId}/transfer-history?direction=${filter}`
      )
      const data = await response.json()

      if (data.success) {
        setTransfers(data.data.transfers)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al cargar historial')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [warehouseId, filter])

  // Fetch transfer detail
  const fetchTransferDetail = useCallback(async (operationId: number) => {
    setLoadingDetail(true)
    try {
      const response = await fetch(
        `/api/market/warehouses/${warehouseId}/transfer-history?operationId=${operationId}`
      )
      const data = await response.json()

      if (data.success) {
        setSelectedTransfer(data.data)
        if (onSelectOperation) {
          onSelectOperation(operationId)
        }
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Error al cargar detalle')
      console.error(err)
    } finally {
      setLoadingDetail(false)
    }
  }, [warehouseId, onSelectOperation])

  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers])

  // Load initial operation if provided
  useEffect(() => {
    if (initialOperationId) {
      fetchTransferDetail(initialOperationId)
    }
  }, [initialOperationId, fetchTransferDetail])

  const handleSelectTransfer = (transfer: TransferSummary) => {
    fetchTransferDetail(transfer.id)
  }

  const handleBackToList = () => {
    setSelectedTransfer(null)
    if (onSelectOperation) {
      onSelectOperation(0) // Clear URL param
    }
  }

  // Print transfer report
  const handlePrint = () => {
    if (!selectedTransfer) return

    const { operation, lines, summary } = selectedTransfer
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const now = new Date()
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr)
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const linesHtml = lines.map(line => `
      <tr class="${line.hasDiscrepancy ? 'discrepancy' : ''}">
        <td>
          <div class="product-name">${line.productName}</div>
          ${line.variantName ? `<div class="variant-name">Variante: ${line.variantName}</div>` : ''}
          <div class="sku">SKU: ${line.sku}</div>
        </td>
        <td class="text-center">${formatQty(line.quantitySent)}</td>
        <td class="text-center">${formatQty(line.quantityReceived)}</td>
        <td class="text-center ${line.difference > 0 ? 'positive' : line.difference < 0 ? 'negative' : ''}">
          ${line.difference > 0 ? '+' : ''}${formatQty(line.difference)}
        </td>
        <td class="text-center">
          ${line.isComplete ? '✓' : '⚠'}
        </td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Historial de Transferencia - ${operation.operationNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #111827; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
          .logo { font-size: 24px; font-weight: bold; color: #7c3aed; margin-bottom: 5px; }
          .doc-title { font-size: 18px; color: #374151; margin-bottom: 15px; }
          .doc-number { font-size: 28px; font-weight: bold; color: #111827; font-family: monospace; background: #f3f4f6; padding: 10px 20px; border-radius: 8px; display: inline-block; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 10px; }
          .status-completed { background: #d1fae5; color: #059669; }
          .status-pending { background: #fef3c7; color: #d97706; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { background: #f9fafb; padding: 15px; border-radius: 8px; }
          .info-box h3 { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
          .info-box p { font-size: 14px; font-weight: 600; color: #111827; }
          .summary-box { background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 25px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
          .summary-item { text-align: center; }
          .summary-item .label { font-size: 11px; opacity: 0.9; margin-bottom: 3px; }
          .summary-item .value { font-size: 22px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f3f4f6; padding: 12px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; }
          td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; }
          .text-center { text-align: center; }
          .product-name { font-weight: 600; color: #111827; }
          .variant-name { font-size: 12px; color: #7c3aed; }
          .sku { font-size: 11px; color: #6b7280; }
          .discrepancy { background: #fef3c7; }
          .positive { color: #059669; font-weight: 600; }
          .negative { color: #dc2626; font-weight: 600; }
          .notes { background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .notes h4 { font-size: 12px; color: #92400e; margin-bottom: 5px; }
          .notes p { font-size: 13px; color: #78350f; }
          .footer { text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">LogiRapid</div>
          <div class="doc-title">Historial de Transferencia</div>
          <div class="doc-number">${operation.operationNumber}</div>
          <div>
            <span class="status ${operation.validationStatus === 'validated' ? 'status-completed' : 'status-pending'}">
              ${operation.validationStatus === 'validated' ? 'Completada' : 'Pendiente'}
            </span>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Almacén Origen</h3>
            <p>${operation.sourceWarehouse.name} (${operation.sourceWarehouse.code})</p>
          </div>
          <div class="info-box">
            <h3>Almacén Destino</h3>
            <p>${operation.destinationWarehouse.name} (${operation.destinationWarehouse.code})</p>
          </div>
          <div class="info-box">
            <h3>Fecha de Envío</h3>
            <p>${formatDate(operation.createdAt)}</p>
          </div>
          <div class="info-box">
            <h3>Creado por</h3>
            <p>${operation.createdBy || 'N/A'}</p>
          </div>
        </div>

        <div class="summary-box">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="label">Total Productos</div>
              <div class="value">${summary.totalProducts}</div>
            </div>
            <div class="summary-item">
              <div class="label">Unidades Enviadas</div>
              <div class="value">${formatQty(summary.totalSent)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Unidades Recibidas</div>
              <div class="value">${formatQty(summary.totalReceived)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Diferencia</div>
              <div class="value">${summary.totalDifference >= 0 ? '+' : ''}${formatQty(summary.totalDifference)}</div>
            </div>
          </div>
        </div>

        ${operation.discrepancyNotes ? `
          <div class="notes">
            <h4>Notas de Discrepancia</h4>
            <p>${operation.discrepancyNotes}</p>
          </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th style="width: 40%;">Producto</th>
              <th class="text-center">Enviado</th>
              <th class="text-center">Recibido</th>
              <th class="text-center">Diferencia</th>
              <th class="text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>

        <div class="footer">
          <p>Documento generado automáticamente por LogiRapid</p>
          <p>Impreso el ${now.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  // Filter transfers by search term
  const filteredTransfers = transfers.filter(t => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      t.operationNumber.toLowerCase().includes(term) ||
      t.sourceWarehouse.name.toLowerCase().includes(term) ||
      t.destinationWarehouse.name.toLowerCase().includes(term)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Cargando historial...</span>
      </div>
    )
  }

  // Detail View
  if (selectedTransfer) {
    const { operation, lines, summary } = selectedTransfer

    return (
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver al historial
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/50"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
              operation.direction === 'sent'
                ? 'bg-blue-100 dark:bg-blue-900/50'
                : 'bg-green-100 dark:bg-green-900/50'
            }`}>
              {operation.direction === 'sent' ? (
                <ArrowUpRight className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              ) : (
                <ArrowDownLeft className="w-7 h-7 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {operation.operationNumber}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span>{operation.sourceWarehouse.name}</span>
                <ArrowRight className="w-4 h-4" />
                <span>{operation.destinationWarehouse.name}</span>
              </div>
            </div>
            <div className="ml-auto">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                operation.validationStatus === 'validated'
                  ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                  : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
              }`}>
                {operation.validationStatus === 'validated' ? 'Completada' : 'Pendiente'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Fecha de Envío</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {new Date(operation.createdAt).toLocaleDateString('es-ES', {
                  day: '2-digit', month: 'short', year: 'numeric'
                })}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Creado por</p>
              <p className="font-medium text-gray-900 dark:text-white">{operation.createdBy || 'N/A'}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Productos</p>
              <p className="font-medium text-gray-900 dark:text-white">{summary.totalProducts}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Discrepancias</p>
              <p className={`font-medium ${summary.hasDiscrepancies ? 'text-amber-600' : 'text-green-600'}`}>
                {summary.productsWithDiscrepancy} productos
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 mb-6 text-white">
          <div className="grid grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-sm opacity-90">Total Productos</p>
              <p className="text-3xl font-bold">{summary.totalProducts}</p>
            </div>
            <div className="text-center">
              <p className="text-sm opacity-90">Unidades Enviadas</p>
              <p className="text-3xl font-bold">{formatQty(summary.totalSent)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm opacity-90">Unidades Recibidas</p>
              <p className="text-3xl font-bold">{formatQty(summary.totalReceived)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm opacity-90">Diferencia</p>
              <p className={`text-3xl font-bold ${
                summary.totalDifference > 0 ? 'text-green-300' :
                summary.totalDifference < 0 ? 'text-red-300' : ''
              }`}>
                {summary.totalDifference >= 0 ? '+' : ''}{formatQty(summary.totalDifference)}
              </p>
            </div>
          </div>
        </div>

        {/* Discrepancy Notes */}
        {operation.discrepancyNotes && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-200">Notas de Discrepancia</h4>
                <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">{operation.discrepancyNotes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Detalle de Productos</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Enviado</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Recibido</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Diferencia</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {lines.map((line) => (
                  <tr
                    key={line.lineId}
                    className={line.hasDiscrepancy ? 'bg-amber-50 dark:bg-amber-900/20' : ''}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{line.productName}</div>
                      {line.variantName && (
                        <div className="text-sm text-purple-600 dark:text-purple-400">{line.variantName}</div>
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-400">SKU: {line.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900 dark:text-white">
                      {formatQty(line.quantitySent)}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900 dark:text-white">
                      {formatQty(line.quantityReceived)}
                    </td>
                    <td className={`px-4 py-3 text-center font-bold ${
                      line.difference > 0 ? 'text-green-600 dark:text-green-400' :
                      line.difference < 0 ? 'text-red-600 dark:text-red-400' :
                      'text-gray-500'
                    }`}>
                      {line.difference > 0 ? '+' : ''}{formatQty(line.difference)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {line.isComplete ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6">
          <button
            onClick={handleBackToList}
            className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
          >
            Volver al historial
          </button>
        </div>
      </div>
    )
  }

  // List View
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Historial de Transferencias
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{warehouseName}</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número o almacén..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'sent', 'received'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f === 'all' ? 'Todas' : f === 'sent' ? 'Enviadas' : 'Recibidas'}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Transfer List */}
        {filteredTransfers.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No hay transferencias
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No se encontraron resultados para tu búsqueda' : 'Las transferencias aparecerán aquí'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransfers.map((transfer, index) => (
              <motion.button
                key={transfer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => handleSelectTransfer(transfer)}
                className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4 hover:border-purple-300 dark:hover:border-purple-500 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  {/* Direction Icon */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                    transfer.direction === 'sent'
                      ? 'bg-blue-100 dark:bg-blue-900/50'
                      : 'bg-green-100 dark:bg-green-900/50'
                  }`}>
                    {transfer.direction === 'sent' ? (
                      <ArrowUpRight className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <ArrowDownLeft className="w-6 h-6 text-green-600 dark:text-green-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {transfer.operationNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        transfer.validationStatus === 'validated'
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                          : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                      }`}>
                        {transfer.validationStatus === 'validated' ? 'Completada' : 'Pendiente'}
                      </span>
                      {transfer.hasDiscrepancies && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                          Discrepancia
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>{transfer.sourceWarehouse.name}</span>
                      <ArrowRight className="w-4 h-4" />
                      <span>{transfer.destinationWarehouse.name}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        {transfer.totalProducts} productos
                      </span>
                      <span>
                        {formatQty(transfer.totalSent)} → {formatQty(transfer.totalReceived)} unidades
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(transfer.createdAt).toLocaleDateString('es-ES', {
                          day: '2-digit', month: 'short'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600" />
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onBack}
            className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
          >
            Volver a operaciones
          </button>
        </div>
      </div>

      {/* Loading overlay for detail */}
      {loadingDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-3 text-gray-600 dark:text-gray-400">Cargando detalle...</p>
          </div>
        </div>
      )}
    </div>
  )
}
