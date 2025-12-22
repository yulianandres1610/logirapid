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
  Filter,
  RefreshCw
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

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

  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [processing, setProcessing] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch counts
  const fetchCounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(
        `/api/market/pos/inventory-counts?status=${statusFilter}&page=${pagination.page}&limit=${pagination.limit}`
      )
      const data = await res.json()

      if (data.success) {
        setCounts(data.data.counts)
        setPagination(data.data.pagination)
      } else {
        setError(data.error || 'Error al cargar conteos')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, pagination.page, pagination.limit])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

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

  const getStatusBadge = (status: string) => {
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
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Pendiente Aprobación
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
                  <p className="text-sm text-gray-500">Aprobar conteos y ajustar inventario</p>
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

            {/* Filters */}
            <div className={cn(
              'p-4 rounded-xl border',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="text-sm text-gray-500 mr-2">Filtrar:</span>
                {[
                  { value: 'all', label: 'Todos' },
                  { value: 'completed', label: 'Pendientes' },
                  { value: 'approved', label: 'Aprobados' },
                  { value: 'rejected', label: 'Rechazados' },
                  { value: 'in_progress', label: 'En Progreso' }
                ].map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => {
                      setStatusFilter(filter.value)
                      setPagination(prev => ({ ...prev, page: 1 }))
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                      statusFilter === filter.value
                        ? 'bg-blue-500 text-white'
                        : theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600'
                        : 'bg-gray-100 hover:bg-gray-200'
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : counts.length === 0 ? (
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
                {/* Counts List */}
                <div className="space-y-3">
                  {counts.map((count, index) => (
                    <motion.div
                      key={count.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        'rounded-xl p-4 border',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700'
                          : 'bg-white border-gray-200'
                      )}
                    >
                      {/* Header */}
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-lg">{count.countNumber}</span>
                            {getStatusBadge(count.status)}
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

                        {/* Actions for completed counts */}
                        {count.status === 'completed' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAction(count.id, 'reject')}
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
                              onClick={() => handleAction(count.id, 'approve')}
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
                      {count.status === 'approved' && count.approvedByName && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                          Aprobado por {count.approvedByName} el {count.approvedAt ? formatDate(count.approvedAt) : 'N/A'}
                        </div>
                      )}
                    </motion.div>
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
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
