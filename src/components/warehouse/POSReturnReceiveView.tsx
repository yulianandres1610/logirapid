'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  ClipboardList,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  DollarSign,
  Trash2,
  Eye,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  User,
  Store
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface POSReturnReceiveViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
  onComplete: (data: { totalUnits: number }) => void
}

type ViewMode = 'select' | 'pending' | 'receive' | 'history'

interface PendingReturn {
  id: number
  returnNumber: string
  posName: string
  createdAt: string
  totalItems: number
  totalUnits: number
  status: string
  customerName?: string
  reason?: string
}

interface ReturnLine {
  id: number
  productId: number
  productName: string
  sku: string
  barcode: string
  quantity: number
  unitPrice: number
  reason: string
}

interface ScrapEntry {
  id: number
  returnNumber: string
  posName: string
  productName: string
  quantity: number
  unitCost: number
  totalValue: number
  condition: string
  reason: string
  scrappedAt: string
  scrappedBy: string
}

interface ScrapSummary {
  totalItems: number
  totalValue: number
  byCondition: Record<string, { count: number; value: number }>
}

const CONDITIONS = [
  { id: 'damaged', label: 'Dañado', color: 'red' },
  { id: 'defective', label: 'Defectuoso', color: 'orange' },
  { id: 'expired', label: 'Vencido', color: 'amber' },
  { id: 'other', label: 'Otro', color: 'gray' }
]

export default function POSReturnReceiveView({
  warehouseId,
  warehouseName,
  onBack,
  onComplete
}: POSReturnReceiveViewProps) {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('select')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Pending returns state
  const [pendingReturns, setPendingReturns] = useState<PendingReturn[]>([])
  const [pendingCount, setPendingCount] = useState(0)

  // Selected return state
  const [selectedReturn, setSelectedReturn] = useState<PendingReturn | null>(null)
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([])
  const [lineConditions, setLineConditions] = useState<Record<number, string>>({})

  // History state
  const [scrapHistory, setScrapHistory] = useState<ScrapEntry[]>([])
  const [scrapSummary, setScrapSummary] = useState<ScrapSummary | null>(null)
  const [historyFilter, setHistoryFilter] = useState<string>('all')
  const [historySearch, setHistorySearch] = useState('')
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null)

  // Fetch pending count on mount
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const response = await fetch(`/api/market/warehouses/${warehouseId}/pos-returns/pending-count`)
        const data = await response.json()
        if (data.success) {
          setPendingCount(data.data.count)
        }
      } catch {
        console.error('Error fetching pending count')
      }
    }
    fetchPendingCount()
  }, [warehouseId])

  // Fetch pending returns
  const fetchPendingReturns = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/pos-returns/pending`)
      const data = await response.json()
      if (data.success) {
        setPendingReturns(data.data.returns)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Error al cargar devoluciones pendientes')
    } finally {
      setLoading(false)
    }
  }, [warehouseId])

  // Fetch return lines
  const fetchReturnLines = useCallback(async (returnId: number) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/pos-returns/${returnId}/lines`)
      const data = await response.json()
      if (data.success) {
        setReturnLines(data.data.lines)
        // Initialize conditions with default 'damaged'
        const initialConditions: Record<number, string> = {}
        data.data.lines.forEach((line: ReturnLine) => {
          initialConditions[line.id] = 'damaged'
        })
        setLineConditions(initialConditions)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Error al cargar líneas de devolución')
    } finally {
      setLoading(false)
    }
  }, [warehouseId])

  // Fetch scrap history
  const fetchScrapHistory = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (historyFilter !== 'all') params.append('condition', historyFilter)
      if (historySearch) params.append('search', historySearch)

      const response = await fetch(`/api/market/warehouses/${warehouseId}/pos-returns/scrap-history?${params}`)
      const data = await response.json()
      if (data.success) {
        setScrapHistory(data.data.entries)
        setScrapSummary(data.data.summary)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Error al cargar historial de scrap')
    } finally {
      setLoading(false)
    }
  }, [warehouseId, historyFilter, historySearch])

  // Handle view mode changes
  useEffect(() => {
    if (viewMode === 'pending') {
      fetchPendingReturns()
    } else if (viewMode === 'history') {
      fetchScrapHistory()
    }
  }, [viewMode, fetchPendingReturns, fetchScrapHistory])

  // Handle select return
  const handleSelectReturn = (returnItem: PendingReturn) => {
    setSelectedReturn(returnItem)
    fetchReturnLines(returnItem.id)
    setViewMode('receive')
  }

  // Handle condition change
  const handleConditionChange = (lineId: number, condition: string) => {
    setLineConditions(prev => ({ ...prev, [lineId]: condition }))
  }

  // Handle confirm receipt
  const handleConfirmReceipt = async () => {
    if (!selectedReturn || returnLines.length === 0 || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/market/warehouses/${warehouseId}/pos-returns/${selectedReturn.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: returnLines.map(line => ({
            lineId: line.id,
            productId: line.productId,
            quantityReceived: line.quantity,
            condition: lineConditions[line.id] || 'damaged'
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        const totalUnits = returnLines.reduce((sum, l) => sum + l.quantity, 0)
        onComplete({ totalUnits })
      } else {
        setError(data.error || 'Error al procesar devolución')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  // Go back handler
  const handleBackClick = () => {
    if (viewMode === 'receive') {
      setSelectedReturn(null)
      setReturnLines([])
      setViewMode('pending')
    } else if (viewMode !== 'select') {
      setViewMode('select')
    } else {
      onBack()
    }
  }

  // Calculate totals
  const totalUnits = returnLines.reduce((sum, l) => sum + l.quantity, 0)
  const totalValue = returnLines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0)

  return (
    <div className="flex flex-col min-h-[60vh] w-full">
      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View: Select */}
      {viewMode === 'select' && (
        <div className="flex items-center justify-center flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Receive Pending */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setViewMode('pending')}
              className="relative flex flex-col items-center p-8 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg hover:shadow-xl transition-all min-h-[200px]"
            >
              {pendingCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg"
                >
                  <span className="text-sm font-bold text-red-600">{pendingCount}</span>
                </motion.div>
              )}
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Recibir Devolución</h3>
              <p className="text-white/80 text-center">
                {pendingCount > 0 ? `${pendingCount} pendientes` : 'Ver devoluciones pendientes'}
              </p>
            </motion.button>

            {/* Scrap History */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setViewMode('history')}
              className="flex flex-col items-center p-8 rounded-2xl bg-gradient-to-br from-gray-500 to-gray-600 text-white shadow-lg hover:shadow-xl transition-all min-h-[200px]"
            >
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <ClipboardList className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Historial de Scrap</h3>
              <p className="text-white/80 text-center">Ver productos dados de baja</p>
            </motion.button>
          </div>
        </div>
      )}

      {/* View: Pending Returns */}
      {viewMode === 'pending' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            </div>
          ) : pendingReturns.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay devoluciones pendientes de recibir</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingReturns.map((returnItem) => (
                <motion.button
                  key={returnItem.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSelectReturn(returnItem)}
                  className="w-full p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-600 hover:border-red-300 dark:hover:border-red-700 rounded-xl text-left transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{returnItem.returnNumber}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Store className="w-3.5 h-3.5" />
                        {returnItem.posName}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium">
                      Pendiente
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      {returnItem.totalItems} productos
                    </span>
                    <span className="text-gray-600 dark:text-gray-300">
                      {returnItem.totalUnits} unidades
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(new Date(returnItem.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                    </span>
                  </div>

                  {returnItem.customerName && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      Cliente: {returnItem.customerName}
                    </p>
                  )}

                  {returnItem.reason && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Motivo: {returnItem.reason}
                    </p>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View: Receive Return */}
      {viewMode === 'receive' && selectedReturn && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Return Info and Lines */}
          <div className="lg:col-span-2 space-y-4">
            {/* Return Header */}
            <div className="bg-gradient-to-r from-red-500 to-rose-500 rounded-xl p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80">Devolución desde</p>
                  <p className="text-xl font-bold">{selectedReturn.posName}</p>
                  <p className="text-sm text-white/80">{selectedReturn.returnNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/80">Fecha</p>
                  <p className="font-medium">{format(new Date(selectedReturn.createdAt), "dd/MM/yyyy", { locale: es })}</p>
                </div>
              </div>
            </div>

            {/* Lines */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Productos a Recibir
              </h3>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                </div>
              ) : (
                <div className="space-y-4">
                  {returnLines.map((line) => (
                    <div
                      key={line.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{line.productName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {line.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900 dark:text-white">{line.quantity}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">unidades</p>
                        </div>
                      </div>

                      {/* Condition Selector */}
                      <div className="mt-3">
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">Condición del producto:</p>
                        <div className="flex flex-wrap gap-2">
                          {CONDITIONS.map(cond => (
                            <button
                              key={cond.id}
                              onClick={() => handleConditionChange(line.id, cond.id)}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                lineConditions[line.id] === cond.id
                                  ? cond.id === 'damaged' ? 'bg-red-500 text-white' :
                                    cond.id === 'defective' ? 'bg-orange-500 text-white' :
                                    cond.id === 'expired' ? 'bg-amber-500 text-white' :
                                    'bg-gray-500 text-white'
                                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                              }`}
                            >
                              {cond.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Summary and Actions */}
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Resumen</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Productos</span>
                  <span className="font-medium text-gray-900 dark:text-white">{returnLines.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total unidades</span>
                  <span className="font-medium text-gray-900 dark:text-white">{totalUnits}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Valor perdido</span>
                    <span className="font-bold text-lg text-red-600 dark:text-red-400">${totalValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Productos a Scrap</p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    Estos productos serán marcados como scrap y no se reintegrarán al inventario.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleBackClick}
                disabled={submitting}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirmReceipt}
                disabled={returnLines.length === 0 || submitting}
                className={`flex-1 px-4 py-3 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all ${
                  returnLines.length > 0 && !submitting
                    ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
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
                    <Trash2 className="w-5 h-5" />
                    Confirmar Scrap
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      )}

      {/* View: Scrap History */}
      {viewMode === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">Filtrar por:</span>
              </div>
              <select
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">Todas las condiciones</option>
                {CONDITIONS.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>

              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          {scrapSummary && (
            <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{scrapSummary.totalItems}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Valor Perdido</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">${scrapSummary.totalValue.toFixed(2)}</p>
                </div>
                {Object.entries(scrapSummary.byCondition).slice(0, 2).map(([condition, data]) => (
                  <div key={condition}>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{condition}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{data.count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
              </div>
            ) : scrapHistory.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay registros de scrap</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scrapHistory.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          entry.condition === 'damaged' ? 'bg-red-100 dark:bg-red-900/30 text-red-600' :
                          entry.condition === 'defective' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' :
                          entry.condition === 'expired' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600'
                        }`}>
                          <Trash2 className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-gray-900 dark:text-white">{entry.productName}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{entry.returnNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium text-gray-900 dark:text-white">{entry.quantity} uds</p>
                          <p className="text-sm text-red-600 dark:text-red-400">${entry.totalValue.toFixed(2)}</p>
                        </div>
                        {expandedEntry === entry.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedEntry === entry.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-4"
                        >
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">POS</p>
                              <p className="font-medium text-gray-900 dark:text-white">{entry.posName}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Condición</p>
                              <p className="font-medium text-gray-900 dark:text-white capitalize">{entry.condition}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Procesado por</p>
                              <p className="font-medium text-gray-900 dark:text-white">{entry.scrappedBy}</p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Fecha</p>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {format(new Date(entry.scrappedAt), "dd/MM/yyyy HH:mm", { locale: es })}
                              </p>
                            </div>
                          </div>
                          {entry.reason && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              <p className="text-sm text-gray-500 dark:text-gray-400">Motivo:</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{entry.reason}</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
