'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Package, Clock, User, CheckCircle,
  AlertTriangle, X, ChevronRight, Search, Printer,
  Calendar, FileText, Scale, Trash2, ChevronDown, ChevronUp
} from 'lucide-react'
import { PrintDocumentModal } from '@/components/print/PrintDocumentModal'

// Format quantity - show decimals only if not integer
function formatQty(value: number): string {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(3).replace(/\.?0+$/, '')
}

// Format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value)
}

interface OperationLine {
  id: number
  productId: number
  productName: string
  productSku: string
  variantId: number | null
  variantName: string | null
  quantity: number
  reason: string | null
  unitCost: number
}

interface OperationSummary {
  id: number
  operationNumber: string
  operationType: 'adjustment' | 'scrap'
  status: string
  warehouse: { id: number; name: string; code: string } | null
  notes: string | null
  internalNotes: string | null
  linesCount: number
  totalQuantity: number
  totalValue: number
  createdByName: string | null
  completedByName: string | null
  createdAt: string
  completedAt: string | null
  lines: OperationLine[]
}

interface AdjustmentsHistoryViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
  initialOperationId?: number | null
  onSelectOperation?: (operationId: number) => void
}

const ADJUSTMENT_REASONS: Record<string, string> = {
  physical_count: 'Conteo Fisico',
  system_error: 'Error de Sistema',
  theft_loss: 'Robo / Perdida',
  other: 'Otro Motivo'
}

const SCRAP_REASONS: Record<string, string> = {
  damaged: 'Producto Danado',
  expired: 'Producto Vencido',
  defective: 'Producto Defectuoso',
  other: 'Otro Motivo'
}

export default function AdjustmentsHistoryView({
  warehouseId,
  warehouseName,
  onBack,
  initialOperationId,
  onSelectOperation
}: AdjustmentsHistoryViewProps) {
  const [operations, setOperations] = useState<OperationSummary[]>([])
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printOp, setPrintOp] = useState<OperationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'adjustment' | 'scrap'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedOperationId, setExpandedOperationId] = useState<number | null>(initialOperationId || null)

  // Stats
  const [stats, setStats] = useState({
    adjustment: { draft: 0, done: 0, cancelled: 0, totalQty: 0, totalValue: 0 },
    scrap: { draft: 0, confirmed: 0, in_progress: 0, done: 0, cancelled: 0, totalQty: 0, totalValue: 0 }
  })

  // Fetch operations list
  const fetchOperations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        warehouseId: warehouseId.toString(),
        type: filter,
        limit: '50'
      })

      const response = await fetch(`/api/market/warehouse-operations/adjustments-history?${params}`)
      const data = await response.json()

      if (data.success) {
        setOperations(data.data.operations)
        setStats(data.data.stats)
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

  useEffect(() => {
    fetchOperations()
  }, [fetchOperations])

  const handleToggleExpand = (operationId: number) => {
    const newId = expandedOperationId === operationId ? null : operationId
    setExpandedOperationId(newId)
    if (onSelectOperation) {
      onSelectOperation(newId || 0)
    }
  }

  // Print operation report
  const handlePrint = (op: OperationSummary) => {
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

    const reasonMap = op.operationType === 'scrap' ? SCRAP_REASONS : ADJUSTMENT_REASONS

    const linesHtml = op.lines.map(line => `
      <tr>
        <td>
          <div class="product-name">${line.productName}</div>
          ${line.variantName ? `<div class="variant-name">Variante: ${line.variantName}</div>` : ''}
          <div class="sku">SKU: ${line.productSku}</div>
        </td>
        <td class="text-center">${formatQty(line.quantity)}</td>
        <td class="text-center">${formatCurrency(line.unitCost)}</td>
        <td class="text-center">${formatCurrency(line.quantity * line.unitCost)}</td>
        <td class="text-center">${line.reason ? (reasonMap[line.reason] || line.reason) : '-'}</td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Historial de ${op.operationType === 'scrap' ? 'Scrap' : 'Ajuste'} - ${op.operationNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #111827; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
          .logo { font-size: 24px; font-weight: bold; color: ${op.operationType === 'scrap' ? '#dc2626' : '#d97706'}; margin-bottom: 5px; }
          .doc-title { font-size: 18px; color: #374151; margin-bottom: 15px; }
          .doc-number { font-size: 28px; font-weight: bold; color: #111827; font-family: monospace; background: #f3f4f6; padding: 10px 20px; border-radius: 8px; display: inline-block; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 10px; }
          .status-done { background: #d1fae5; color: #059669; }
          .status-draft { background: #fef3c7; color: #d97706; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { background: #f9fafb; padding: 15px; border-radius: 8px; }
          .info-box h3 { font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
          .info-box p { font-size: 14px; font-weight: 600; color: #111827; }
          .summary-box { background: linear-gradient(135deg, ${op.operationType === 'scrap' ? '#dc2626' : '#d97706'} 0%, ${op.operationType === 'scrap' ? '#ef4444' : '#f59e0b'} 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 25px; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
          .summary-item { text-align: center; }
          .summary-item .label { font-size: 11px; opacity: 0.9; margin-bottom: 3px; }
          .summary-item .value { font-size: 22px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f3f4f6; padding: 12px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; }
          td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; }
          .text-center { text-align: center; }
          .product-name { font-weight: 600; color: #111827; }
          .variant-name { font-size: 12px; color: ${op.operationType === 'scrap' ? '#dc2626' : '#d97706'}; }
          .sku { font-size: 11px; color: #6b7280; }
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
          <div class="doc-title">Historial de ${op.operationType === 'scrap' ? 'Scrap / Merma' : 'Ajuste de Inventario'}</div>
          <div class="doc-number">${op.operationNumber}</div>
          <div>
            <span class="status ${op.status === 'done' || op.status === 'completed' ? 'status-done' : 'status-draft'}">
              ${op.status === 'done' || op.status === 'completed' ? 'Completado' : op.status === 'draft' ? 'Borrador' : op.status}
            </span>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-box">
            <h3>Almacen</h3>
            <p>${op.warehouse?.name || warehouseName} ${op.warehouse?.code ? `(${op.warehouse.code})` : ''}</p>
          </div>
          <div class="info-box">
            <h3>Fecha de Creacion</h3>
            <p>${formatDate(op.createdAt)}</p>
          </div>
          <div class="info-box">
            <h3>Creado por</h3>
            <p>${op.createdByName || 'N/A'}</p>
          </div>
          <div class="info-box">
            <h3>Completado por</h3>
            <p>${op.completedByName || 'N/A'}</p>
          </div>
        </div>

        <div class="summary-box">
          <div class="summary-grid">
            <div class="summary-item">
              <div class="label">Total Productos</div>
              <div class="value">${op.linesCount}</div>
            </div>
            <div class="summary-item">
              <div class="label">Total Unidades</div>
              <div class="value">${formatQty(op.totalQuantity)}</div>
            </div>
            <div class="summary-item">
              <div class="label">Valor Total</div>
              <div class="value">${formatCurrency(op.totalValue)}</div>
            </div>
          </div>
        </div>

        ${op.notes ? `
          <div class="notes">
            <h4>Notas</h4>
            <p>${op.notes}</p>
          </div>
        ` : ''}

        <table>
          <thead>
            <tr>
              <th style="width: 40%;">Producto</th>
              <th class="text-center">Cantidad</th>
              <th class="text-center">Costo Unit.</th>
              <th class="text-center">Valor</th>
              <th class="text-center">Motivo</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
          </tbody>
        </table>

        <div class="footer">
          <p>Documento generado automaticamente por LogiRapid</p>
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

  // Filter operations by search term
  const filteredOperations = operations.filter(op => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      op.operationNumber.toLowerCase().includes(term) ||
      op.notes?.toLowerCase().includes(term) ||
      op.lines.some(l => l.productName.toLowerCase().includes(term))
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-amber-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Historial de Ajustes y Scrap
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

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Ajustes</span>
            </div>
            <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
              {stats.adjustment.done}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-300">
              {formatQty(stats.adjustment.totalQty)} unidades
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-red-800 dark:text-red-200">Scrap</span>
            </div>
            <p className="text-2xl font-bold text-red-900 dark:text-red-100">
              {stats.scrap.done}
            </p>
            <p className="text-xs text-red-600 dark:text-red-300">
              {formatQty(stats.scrap.totalQty)} unidades
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Valor Ajustes</span>
            </div>
            <p className="text-xl font-bold text-amber-900 dark:text-amber-100">
              {formatCurrency(stats.adjustment.totalValue)}
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-red-800 dark:text-red-200">Valor Scrap</span>
            </div>
            <p className="text-xl font-bold text-red-900 dark:text-red-100">
              {formatCurrency(stats.scrap.totalValue)}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por numero, notas o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'adjustment', 'scrap'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? f === 'adjustment' ? 'bg-amber-600 text-white' :
                      f === 'scrap' ? 'bg-red-600 text-white' :
                      'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'adjustment' ? 'Ajustes' : 'Scrap'}
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

        {/* Operations List */}
        {filteredOperations.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No hay operaciones
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No se encontraron resultados para tu busqueda' : 'Las operaciones apareceran aqui'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOperations.map((op, index) => (
              <motion.div
                key={op.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden"
              >
                {/* Operation Header */}
                <button
                  onClick={() => handleToggleExpand(op.id)}
                  className="w-full p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    {/* Type Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                      op.operationType === 'scrap'
                        ? 'bg-red-100 dark:bg-red-900/50'
                        : 'bg-amber-100 dark:bg-amber-900/50'
                    }`}>
                      {op.operationType === 'scrap' ? (
                        <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                      ) : (
                        <Scale className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {op.operationNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          op.operationType === 'scrap'
                            ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                            : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                        }`}>
                          {op.operationType === 'scrap' ? 'Scrap' : 'Ajuste'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          op.status === 'done' || op.status === 'completed'
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                        }`}>
                          {op.status === 'done' || op.status === 'completed' ? 'Completado' :
                           op.status === 'draft' ? 'Borrador' : op.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          {op.linesCount} productos
                        </span>
                        <span>
                          {formatQty(op.totalQuantity)} unidades
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          {formatCurrency(op.totalValue)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(op.createdAt).toLocaleDateString('es-ES', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Expand Arrow */}
                    {expandedOperationId === op.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedOperationId === op.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-200 dark:border-gray-600 p-4 space-y-4">
                        {/* Info Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Creado por:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{op.createdByName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Completado por:</span>
                            <p className="font-medium text-gray-900 dark:text-white">{op.completedByName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Fecha completado:</span>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {op.completedAt ? new Date(op.completedAt).toLocaleDateString('es-ES', {
                                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              }) : 'N/A'}
                            </p>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setPrintOp(op); setShowPrintModal(true)
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
                            >
                              <Printer className="w-4 h-4" />
                              Imprimir
                            </button>
                          </div>
                        </div>

                        {/* Notes */}
                        {op.notes && (
                          <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                              <strong>Notas:</strong> {op.notes}
                            </p>
                          </div>
                        )}

                        {/* Products Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-700">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cantidad</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Costo Unit.</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Motivo</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                              {op.lines.map((line) => {
                                const reasonMap = op.operationType === 'scrap' ? SCRAP_REASONS : ADJUSTMENT_REASONS
                                return (
                                  <tr key={line.id}>
                                    <td className="px-3 py-2">
                                      <div className="font-medium text-gray-900 dark:text-white">{line.productName}</div>
                                      {line.variantName && (
                                        <div className={`text-xs ${op.operationType === 'scrap' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                          {line.variantName}
                                        </div>
                                      )}
                                      <div className="text-xs text-gray-500">{line.productSku}</div>
                                    </td>
                                    <td className="px-3 py-2 text-center font-medium text-gray-900 dark:text-white">
                                      {formatQty(line.quantity)}
                                    </td>
                                    <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                                      {formatCurrency(line.unitCost)}
                                    </td>
                                    <td className="px-3 py-2 text-center font-medium text-gray-900 dark:text-white">
                                      {formatCurrency(line.quantity * line.unitCost)}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span className={`px-2 py-0.5 rounded text-xs ${
                                        op.operationType === 'scrap'
                                          ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                                          : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                                      }`}>
                                        {line.reason ? (reasonMap[line.reason] || line.reason) : '-'}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
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
      {printOp && (
        <PrintDocumentModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          documentType="warehouse_operation"
          documentData={{
            operationType: printOp.operationType,
            operationNumber: printOp.operationNumber,
            warehouse: { id: warehouseId, name: '', code: '' },
            products: printOp.lines?.map((l: any) => ({ productId: l.productId, name: l.productName || l.name, sku: l.sku || '', quantity: l.quantityPlanned || l.quantity })) || [],
            scrapReason: (printOp as any).scrapReason || null,
            adjustmentReason: (printOp as any).adjustmentReason || null,
            notes: printOp.notes,
            createdAt: printOp.createdAt
          }}
          documentTitle={`${printOp.operationType === 'scrap' ? 'Merma' : 'Ajuste'} ${printOp.operationNumber}`}
          sourceType="warehouse_operation"
          sourceId={printOp.id}
          warehouseId={warehouseId}
        />
      )}
    </div>
  )
}
