'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Eye,
  Check,
  X,
  Package,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Warehouse,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  History,
  Zap
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface CountLine {
  id: number
  productId: number
  productName: string
  productSku: string
  productBarcode: string
  unitPrice: number
  expectedQuantity: number
  countedQuantity: number
  difference: number
  differenceValue: number
}

interface InventoryCount {
  id: number
  countNumber: string
  status: 'in_progress' | 'completed' | 'approved' | 'rejected'
  totalProducts: number
  productsWithDifferences: number
  totalDifferenceValue: number
  notes: string | null
  createdAt: string
  completedAt: string | null
  approvedAt: string | null
  autoApproved: boolean
  warehouseName: string
  sessionCode: string
  terminalName: string
  countedByName: string
  approvedByName: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function InventoryCountsPage() {
  const router = useRouter()
  const { theme } = useTheme()

  // Tab state
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')

  // Data states
  const [loading, setLoading] = useState(true)
  const [pendingCounts, setPendingCounts] = useState<InventoryCount[]>([])
  const [historyCounts, setHistoryCounts] = useState<InventoryCount[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // Modal state
  const [selectedCount, setSelectedCount] = useState<InventoryCount | null>(null)
  const [countLines, setCountLines] = useState<CountLine[]>([])
  const [loadingLines, setLoadingLines] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Action states
  const [processing, setProcessing] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch counts
  const fetchCounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch pending counts (require approval)
      const pendingRes = await fetch(
        `/api/market/pos/inventory-counts?requiresApproval=true&page=1&limit=50`
      )
      const pendingData = await pendingRes.json()

      // Fetch history (all counts)
      const historyRes = await fetch(
        `/api/market/pos/inventory-counts?status=all&page=${pagination.page}&limit=${pagination.limit}`
      )
      const historyData = await historyRes.json()

      if (pendingData.success) {
        setPendingCounts(pendingData.data.counts)
      }
      if (historyData.success) {
        setHistoryCounts(historyData.data.counts)
        setPagination(historyData.data.pagination)
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // Fetch count lines for detail modal
  const fetchCountLines = async (countId: number) => {
    try {
      setLoadingLines(true)
      const res = await fetch(`/api/market/pos/inventory-count?countId=${countId}&status=any`)
      const data = await res.json()

      if (data.success && data.data) {
        setCountLines(data.data.lines || [])
      }
    } catch (err) {
      console.error('Error fetching count lines:', err)
    } finally {
      setLoadingLines(false)
    }
  }

  // Open detail modal
  const openDetailModal = (count: InventoryCount) => {
    setSelectedCount(count)
    setShowDetailModal(true)
    fetchCountLines(count.id)
  }

  // Handle approve/reject
  const handleAction = async (countId: number, action: 'approve' | 'reject') => {
    try {
      setProcessing(countId)
      setError(null)

      const res = await fetch('/api/market/pos/inventory-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countId, action })
      })

      const data = await res.json()

      if (data.success) {
        setSuccessMessage(data.message)
        setTimeout(() => setSuccessMessage(null), 3000)
        fetchCounts()
      } else {
        setError(data.error || 'Error al procesar conteo')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setProcessing(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string, autoApproved?: boolean) => {
    if (status === 'approved' && autoApproved) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-full">
          <Zap className="w-3 h-3" />
          Auto-aprobado
        </span>
      )
    }

    switch (status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs rounded-full">
            <Clock className="w-3 h-3" />
            En Progreso
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Requiere Aprobación
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-600 dark:text-green-400 text-xs rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Aprobado
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-full">
            <XCircle className="w-3 h-3" />
            Rechazado
          </span>
        )
      default:
        return null
    }
  }

  // Count Card Component
  const CountCard = ({ count, showActions, clickable }: {
    count: InventoryCount
    showActions: boolean
    clickable?: boolean
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={clickable ? () => openDetailModal(count) : undefined}
      className={cn(
        'rounded-xl p-4 border transition-all',
        theme === 'dark'
          ? 'bg-gray-800 border-gray-700'
          : 'bg-white border-gray-200',
        clickable && 'cursor-pointer hover:border-blue-500 hover:shadow-lg'
      )}
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-lg">{count.countNumber}</span>
            {getStatusBadge(count.status, count.autoApproved)}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(count.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Warehouse className="w-3 h-3" />
              {count.warehouseName || 'N/A'}
            </span>
            {count.terminalName && (
              <span className="flex items-center gap-1">
                Terminal: {count.terminalName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {count.countedByName || 'N/A'}
            </span>
          </div>
        </div>

        {/* Actions for completed counts that need approval */}
        {showActions && count.status === 'completed' && (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleAction(count.id, 'reject')
              }}
              disabled={processing === count.id}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all',
                'bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30'
              )}
            >
              {processing === count.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              Rechazar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleAction(count.id, 'approve')
              }}
              disabled={processing === count.id}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all',
                'bg-green-500 text-white hover:bg-green-600'
              )}
            >
              {processing === count.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Aprobar y Ajustar
            </button>
          </div>
        )}

        {/* View button for history */}
        {clickable && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              openDetailModal(count)
            }}
            className={cn(
              'px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all',
              theme === 'dark'
                ? 'bg-gray-700 hover:bg-gray-600'
                : 'bg-gray-100 hover:bg-gray-200'
            )}
          >
            <Eye className="w-4 h-4" />
            Ver Detalle
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className={cn(
          'rounded-lg p-3 text-center',
          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
        )}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Package className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{count.totalProducts}</p>
          <p className="text-xs text-gray-500">Productos</p>
        </div>
        <div className={cn(
          'rounded-lg p-3 text-center',
          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
        )}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <AlertTriangle className={cn(
              'w-4 h-4',
              count.productsWithDifferences > 0 ? 'text-amber-500' : 'text-green-500'
            )} />
          </div>
          <p className={cn(
            'text-2xl font-bold',
            count.productsWithDifferences > 0 ? 'text-amber-500' : 'text-green-500'
          )}>
            {count.productsWithDifferences}
          </p>
          <p className="text-xs text-gray-500">Diferencias</p>
        </div>
        <div className={cn(
          'rounded-lg p-3 text-center',
          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
        )}>
          <div className="flex items-center justify-center gap-1 mb-1">
            {count.totalDifferenceValue >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
          </div>
          <p className={cn(
            'text-2xl font-bold',
            count.totalDifferenceValue > 0 ? 'text-green-500' :
            count.totalDifferenceValue < 0 ? 'text-red-500' : 'text-gray-500'
          )}>
            ${Math.abs(count.totalDifferenceValue).toFixed(0)}
          </p>
          <p className="text-xs text-gray-500">Valor Dif.</p>
        </div>
      </div>

      {/* Approved info */}
      {count.status === 'approved' && count.approvedByName && !count.autoApproved && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
          Aprobado por {count.approvedByName} el {count.approvedAt ? formatDate(count.approvedAt) : 'N/A'}
        </div>
      )}
    </motion.div>
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'p-3 rounded-xl',
                  theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
                )}>
                  <ClipboardList className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Conteos de Inventario</h1>
                  <p className="text-sm text-gray-500">Gestionar conteos y ajustar inventario</p>
                </div>
              </div>
              <button
                onClick={fetchCounts}
                disabled={loading}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all',
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                Actualizar
              </button>
            </div>

            {/* Success Message */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 flex items-center gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <p className="text-green-700 dark:text-green-300">{successMessage}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-center gap-3"
                >
                  <XCircle className="w-5 h-5 text-red-500" />
                  <p className="text-red-700 dark:text-red-300">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tabs */}
            <div className={cn(
              'p-1 rounded-xl border flex',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <button
                onClick={() => setActiveTab('pending')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
                  activeTab === 'pending'
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                    : theme === 'dark'
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <AlertTriangle className="w-4 h-4" />
                Requieren Aprobación
                {pendingCounts.length > 0 && (
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-bold',
                    activeTab === 'pending' ? 'bg-white/20' : 'bg-amber-500 text-white'
                  )}>
                    {pendingCounts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
                  activeTab === 'history'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : theme === 'dark'
                    ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                )}
              >
                <History className="w-4 h-4" />
                Historial de Conteos
              </button>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : activeTab === 'pending' ? (
              // Pending Approval Tab
              pendingCounts.length === 0 ? (
                <div className={cn(
                  'text-center py-12 rounded-xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
                  <p className="text-lg text-gray-500">Sin conteos pendientes</p>
                  <p className="text-sm text-gray-400">Todos los conteos con diferencias han sido revisados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingCounts.map((count) => (
                    <CountCard
                      key={count.id}
                      count={count}
                      showActions={true}
                    />
                  ))}
                </div>
              )
            ) : (
              // History Tab
              historyCounts.length === 0 ? (
                <div className={cn(
                  'text-center py-12 rounded-xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <ClipboardList className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg text-gray-500">No hay conteos</p>
                  <p className="text-sm text-gray-400">Los conteos de inventario aparecerán aquí</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {historyCounts.map((count) => (
                      <CountCard
                        key={count.id}
                        count={count}
                        showActions={count.status === 'completed' && count.productsWithDifferences > 0}
                        clickable={true}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={pagination.page === 1}
                        className={cn(
                          'p-2 rounded-lg transition-all',
                          pagination.page === 1
                            ? 'opacity-50 cursor-not-allowed'
                            : theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600'
                            : 'bg-gray-200 hover:bg-gray-300'
                        )}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm">
                        Página {pagination.page} de {pagination.totalPages}
                      </span>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={pagination.page === pagination.totalPages}
                        className={cn(
                          'p-2 rounded-lg transition-all',
                          pagination.page === pagination.totalPages
                            ? 'opacity-50 cursor-not-allowed'
                            : theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600'
                            : 'bg-gray-200 hover:bg-gray-300'
                        )}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </>
              )
            )}
          </motion.div>
        </div>

        {/* Detail Modal */}
        <AnimatePresence>
          {showDetailModal && selectedCount && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowDetailModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className={cn(
                  'max-w-3xl w-full max-h-[90vh] overflow-auto rounded-2xl p-6',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold">{selectedCount.countNumber}</h2>
                      {getStatusBadge(selectedCount.status, selectedCount.autoApproved)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(selectedCount.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Warehouse className="w-4 h-4" />
                        {selectedCount.warehouseName}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {selectedCount.countedByName}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className={cn(
                      'p-2 rounded-lg transition-all',
                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    )}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className={cn(
                    'rounded-lg p-4 text-center',
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                  )}>
                    <Package className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                    <p className="text-2xl font-bold">{selectedCount.totalProducts}</p>
                    <p className="text-xs text-gray-500">Productos Contados</p>
                  </div>
                  <div className={cn(
                    'rounded-lg p-4 text-center',
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                  )}>
                    <AlertTriangle className={cn(
                      'w-5 h-5 mx-auto mb-2',
                      selectedCount.productsWithDifferences > 0 ? 'text-amber-500' : 'text-green-500'
                    )} />
                    <p className={cn(
                      'text-2xl font-bold',
                      selectedCount.productsWithDifferences > 0 ? 'text-amber-500' : 'text-green-500'
                    )}>
                      {selectedCount.productsWithDifferences}
                    </p>
                    <p className="text-xs text-gray-500">Con Diferencias</p>
                  </div>
                  <div className={cn(
                    'rounded-lg p-4 text-center',
                    theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                  )}>
                    {selectedCount.totalDifferenceValue >= 0 ? (
                      <TrendingUp className="w-5 h-5 mx-auto mb-2 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 mx-auto mb-2 text-red-500" />
                    )}
                    <p className={cn(
                      'text-2xl font-bold',
                      selectedCount.totalDifferenceValue > 0 ? 'text-green-500' :
                      selectedCount.totalDifferenceValue < 0 ? 'text-red-500' : ''
                    )}>
                      ${Math.abs(selectedCount.totalDifferenceValue).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">Valor Diferencia</p>
                  </div>
                </div>

                {/* Products List */}
                <div>
                  <h3 className="font-semibold mb-3">Detalle de Productos</h3>
                  {loadingLines ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  ) : countLines.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">No hay productos en este conteo</p>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {countLines.map((line) => (
                        <div
                          key={line.id}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg',
                            theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50',
                            line.difference !== 0 && (
                              line.difference > 0
                                ? 'border-l-4 border-green-500'
                                : 'border-l-4 border-red-500'
                            )
                          )}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{line.productName}</p>
                            <p className="text-xs text-gray-500">
                              SKU: {line.productSku} | Precio: ${line.unitPrice.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="text-center">
                                <p className="text-gray-500 text-xs">Sistema</p>
                                <p className="font-mono">{line.expectedQuantity}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-gray-500 text-xs">Contado</p>
                                <p className="font-mono">{line.countedQuantity}</p>
                              </div>
                              <div className="text-center min-w-[60px]">
                                <p className="text-gray-500 text-xs">Dif.</p>
                                <p className={cn(
                                  'font-mono font-bold',
                                  line.difference > 0 ? 'text-green-500' :
                                  line.difference < 0 ? 'text-red-500' : ''
                                )}>
                                  {line.difference > 0 ? '+' : ''}{line.difference}
                                </p>
                              </div>
                              <div className="text-center min-w-[80px]">
                                <p className="text-gray-500 text-xs">Valor</p>
                                <p className={cn(
                                  'font-mono',
                                  line.differenceValue > 0 ? 'text-green-500' :
                                  line.differenceValue < 0 ? 'text-red-500' : ''
                                )}>
                                  ${line.differenceValue.toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Approval Info */}
                {selectedCount.status === 'approved' && selectedCount.approvedByName && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500">
                    {selectedCount.autoApproved ? (
                      <span className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-500" />
                        Auto-aprobado (sin diferencias) el {selectedCount.approvedAt ? formatDate(selectedCount.approvedAt) : 'N/A'}
                      </span>
                    ) : (
                      <span>
                        Aprobado por {selectedCount.approvedByName} el {selectedCount.approvedAt ? formatDate(selectedCount.approvedAt) : 'N/A'}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
