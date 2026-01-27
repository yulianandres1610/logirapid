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
  Zap,
  Trash2,
  ShieldAlert,
  Lock
} from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'

// Roles con permisos de administrador
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MARKET_MANAGER']
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
  const { showNotification } = useNotifications()

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [loading, setLoading] = useState(true)
  const [pendingCounts, setPendingCounts] = useState<InventoryCount[]>([])
  const [historyCounts, setHistoryCounts] = useState<InventoryCount[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const [selectedCount, setSelectedCount] = useState<InventoryCount | null>(null)
  const [countLines, setCountLines] = useState<CountLine[]>([])
  const [loadingLines, setLoadingLines] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [countToDelete, setCountToDelete] = useState<InventoryCount | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [processing, setProcessing] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // User role state
  const [userRole, setUserRole] = useState<string | null>(null)

  // Get user role from cookies
  useEffect(() => {
    try {
      const cookies = document.cookie.split(';')
      const roleCookie = cookies.find(c => c.trim().startsWith('user-role='))
      if (roleCookie) {
        const role = decodeURIComponent(roleCookie.split('=')[1])
        setUserRole(role)
      } else {
        setUserRole('USER')
      }
    } catch (e) {
      console.error('Error reading role cookie:', e)
      setUserRole('USER')
    }
  }, [])

  const isAdmin = userRole && ADMIN_ROLES.includes(userRole)

  const fetchCounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const pendingRes = await fetch(
        `/api/market/pos/inventory-counts?requiresApproval=true&page=1&limit=50`
      )
      const pendingData = await pendingRes.json()

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

  const openDetailModal = (count: InventoryCount) => {
    // Verificar permisos: solo admins pueden ver conteos no terminados
    const isFinished = ['approved', 'rejected'].includes(count.status)
    if (!isFinished && !isAdmin) {
      showNotification('warning', 'Acceso restringido', 'Solo los administradores pueden ver conteos en progreso')
      return
    }
    // Navigate to detail page instead of opening modal
    router.push(`/dashboard/market/pos/inventory-counts/${count.id}`)
  }

  const openDetailModalLegacy = (count: InventoryCount) => {
    setSelectedCount(count)
    setShowDetailModal(true)
    fetchCountLines(count.id)
  }

  const handleDeleteClick = (count: InventoryCount, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click navigation
    setCountToDelete(count)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!countToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/market/pos/inventory-counts?countId=${countToDelete.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        showNotification('success', 'Conteo eliminado', data.message)
        fetchCounts()
      } else {
        showNotification('error', 'Error', data.error || 'Error al eliminar conteo')
      }
    } catch (err) {
      console.error('Error deleting count:', err)
      showNotification('error', 'Error de conexión', 'No se pudo eliminar el conteo')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
      setCountToDelete(null)
    }
  }

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

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string, autoApproved?: boolean, compact?: boolean) => {
    if (status === 'approved' && autoApproved) {
      return (
        <span className={cn(
          'inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full',
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
        )}>
          <Zap className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          {compact ? 'Auto' : 'Auto-aprobado'}
        </span>
      )
    }

    const configs = {
      in_progress: { bg: 'bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400', icon: Clock, label: compact ? 'Prog.' : 'En Progreso' },
      completed: { bg: 'bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', icon: AlertTriangle, label: compact ? 'Pend.' : 'Pendiente' },
      approved: { bg: 'bg-green-500/20', text: 'text-green-600 dark:text-green-400', icon: CheckCircle2, label: 'Aprobado' },
      rejected: { bg: 'bg-red-500/20', text: 'text-red-600 dark:text-red-400', icon: XCircle, label: 'Rechazado' }
    }

    const config = configs[status as keyof typeof configs]
    if (!config) return null

    const Icon = config.icon
    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full',
        config.bg, config.text,
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      )}>
        <Icon className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        {config.label}
      </span>
    )
  }

  // Card for pending approval
  const PendingCard = ({ count }: { count: InventoryCount }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl p-4 border',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold">{count.countNumber}</span>
            {getStatusBadge(count.status, count.autoApproved)}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span>{formatShortDate(count.createdAt)}</span>
            <span>{count.terminalName}</span>
            <span>{count.countedByName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAction(count.id, 'reject')}
            disabled={processing === count.id}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30"
          >
            {processing === count.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Rechazar
          </button>
          <button
            onClick={() => handleAction(count.id, 'approve')}
            disabled={processing === count.id}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-green-500 text-white hover:bg-green-600"
          >
            {processing === count.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Aprobar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className={cn('rounded-lg p-2', theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
          <p className="text-xl font-bold">{count.totalProducts}</p>
          <p className="text-xs text-gray-500">Productos</p>
        </div>
        <div className={cn('rounded-lg p-2', theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
          <p className={cn('text-xl font-bold', count.productsWithDifferences > 0 ? 'text-amber-500' : 'text-green-500')}>
            {count.productsWithDifferences}
          </p>
          <p className="text-xs text-gray-500">Diferencias</p>
        </div>
        <div className={cn('rounded-lg p-2', theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
          <p className={cn('text-xl font-bold', count.totalDifferenceValue < 0 ? 'text-red-500' : count.totalDifferenceValue > 0 ? 'text-green-500' : '')}>
            ${Math.abs(count.totalDifferenceValue).toFixed(0)}
          </p>
          <p className="text-xs text-gray-500">Valor</p>
        </div>
      </div>
    </motion.div>
  )

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-4 md:p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-2.5 rounded-xl', theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50')}>
                  <ClipboardList className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Conteos de Inventario</h1>
                  <p className="text-xs text-gray-500">Gestionar y aprobar conteos</p>
                </div>
              </div>
              <button
                onClick={fetchCounts}
                disabled={loading}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
                  theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                Actualizar
              </button>
            </div>

            {/* Messages */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 flex items-center gap-2 text-sm"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-green-700 dark:text-green-300">{successMessage}</span>
                </motion.div>
              )}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 flex items-center gap-2 text-sm"
                >
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-red-700 dark:text-red-300">{error}</span>
                  <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tabs */}
            <div className={cn(
              'p-1 rounded-lg border flex',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <button
                onClick={() => setActiveTab('pending')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === 'pending'
                    ? 'bg-amber-500 text-white'
                    : theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                <AlertTriangle className="w-4 h-4" />
                Requieren Aprobación
                {pendingCounts.length > 0 && (
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold', activeTab === 'pending' ? 'bg-white/20' : 'bg-amber-500 text-white')}>
                    {pendingCounts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                  activeTab === 'history'
                    ? 'bg-blue-500 text-white'
                    : theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                <History className="w-4 h-4" />
                Historial
              </button>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : activeTab === 'pending' ? (
              pendingCounts.length === 0 ? (
                <div className={cn(
                  'text-center py-12 rounded-xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}>
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400" />
                  <p className="text-gray-500">Sin conteos pendientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingCounts.map(count => <PendingCard key={count.id} count={count} />)}
                </div>
              )
            ) : (
              /* History Table */
              historyCounts.length === 0 ? (
                <div className={cn(
                  'text-center py-12 rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                )}>
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No hay conteos</p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'rounded-2xl border shadow-xl overflow-hidden',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
                  )}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn(
                          'border-b',
                          theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                        )}>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Conteo</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Fecha</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Terminal</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Cajero</th>
                          <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Productos</th>
                          <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Dif.</th>
                          <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                          <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          {isAdmin && (
                            <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Acción</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {historyCounts.map((count, idx) => (
                          <motion.tr
                            key={count.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            onClick={() => openDetailModal(count)}
                            className={cn(
                              'group cursor-pointer transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="py-4 px-4">
                              <span className="font-medium text-gray-900 dark:text-white">{count.countNumber}</span>
                              <span className="sm:hidden block text-xs text-gray-500 mt-0.5">
                                {formatShortDate(count.createdAt)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                              {formatShortDate(count.createdAt)}
                            </td>
                            <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-300 hidden md:table-cell">
                              {count.terminalName || '-'}
                            </td>
                            <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-300 hidden lg:table-cell">
                              {count.countedByName || '-'}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {count.totalProducts}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                                count.productsWithDifferences > 0
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              )}>
                                {count.productsWithDifferences > 0 ? (
                                  <AlertTriangle className="w-3 h-3" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                {count.productsWithDifferences}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className={cn(
                                'text-sm font-medium',
                                count.totalDifferenceValue > 0 ? 'text-green-600' :
                                count.totalDifferenceValue < 0 ? 'text-red-600' : 'text-gray-500'
                              )}>
                                {count.totalDifferenceValue !== 0 && (count.totalDifferenceValue > 0 ? '+' : '-')}
                                ${Math.abs(count.totalDifferenceValue).toFixed(2)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {getStatusBadge(count.status, count.autoApproved, true)}
                            </td>
                            {isAdmin && (
                              <td className="py-4 px-4 text-center">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => handleDeleteClick(count, e)}
                                  className={cn(
                                    'p-2 rounded-lg transition-colors',
                                    'text-red-500 hover:bg-red-500/20'
                                  )}
                                  title="Eliminar conteo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </td>
                            )}
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className={cn(
                      'flex items-center justify-between px-4 py-3 border-t',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <p className="text-sm text-gray-500">
                        Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                      </p>
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                          disabled={pagination.page === 1}
                          className={cn(
                            'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                            theme === 'dark'
                              ? 'hover:bg-gray-700 text-gray-300'
                              : 'hover:bg-gray-200 text-gray-600'
                          )}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </motion.button>
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {pagination.page} / {pagination.totalPages}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                          disabled={pagination.page === pagination.totalPages}
                          className={cn(
                            'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                            theme === 'dark'
                              ? 'hover:bg-gray-700 text-gray-300'
                              : 'hover:bg-gray-200 text-gray-600'
                          )}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </motion.button>
                      </div>
                    </div>
                  )}
                </motion.div>
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
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
              onClick={() => setShowDetailModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className={cn(
                  'max-w-2xl w-full max-h-[85vh] overflow-hidden rounded-2xl flex flex-col',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                {/* Modal Header */}
                <div className={cn(
                  'px-6 py-4 border-b flex-shrink-0',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-bold">{selectedCount.countNumber}</h2>
                        {getStatusBadge(selectedCount.status, selectedCount.autoApproved)}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(selectedCount.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Warehouse className="w-3 h-3" />
                          {selectedCount.warehouseName}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {selectedCount.countedByName}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className={cn('p-1.5 rounded-lg', theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className={cn(
                  'px-6 py-4 border-b grid grid-cols-3 gap-3 flex-shrink-0',
                  theme === 'dark' ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50'
                )}>
                  <div className="text-center">
                    <Package className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-xl font-bold">{selectedCount.totalProducts}</p>
                    <p className="text-[10px] text-gray-500">Productos</p>
                  </div>
                  <div className="text-center">
                    <AlertTriangle className={cn('w-5 h-5 mx-auto mb-1', selectedCount.productsWithDifferences > 0 ? 'text-amber-500' : 'text-green-500')} />
                    <p className={cn('text-xl font-bold', selectedCount.productsWithDifferences > 0 ? 'text-amber-500' : 'text-green-500')}>
                      {selectedCount.productsWithDifferences}
                    </p>
                    <p className="text-[10px] text-gray-500">Diferencias</p>
                  </div>
                  <div className="text-center">
                    {selectedCount.totalDifferenceValue >= 0 ? (
                      <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 mx-auto mb-1 text-red-500" />
                    )}
                    <p className={cn(
                      'text-xl font-bold',
                      selectedCount.totalDifferenceValue > 0 ? 'text-green-500' :
                      selectedCount.totalDifferenceValue < 0 ? 'text-red-500' : ''
                    )}>
                      ${Math.abs(selectedCount.totalDifferenceValue).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-500">Valor</p>
                  </div>
                </div>

                {/* Products Table */}
                <div className="flex-1 overflow-auto px-6 py-4">
                  <h3 className="text-sm font-semibold mb-3">Detalle de Productos</h3>
                  {loadingLines ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  ) : countLines.length === 0 ? (
                    <p className="text-center py-8 text-gray-500 text-sm">No hay productos</p>
                  ) : (
                    <div className={cn(
                      'rounded-lg border overflow-hidden',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'}>
                            <th className="text-left py-2 px-3 font-medium text-xs">Producto</th>
                            <th className="text-center py-2 px-3 font-medium text-xs">Sistema</th>
                            <th className="text-center py-2 px-3 font-medium text-xs">Contado</th>
                            <th className="text-center py-2 px-3 font-medium text-xs">Dif.</th>
                            <th className="text-right py-2 px-3 font-medium text-xs">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {countLines.map((line, idx) => (
                            <tr
                              key={line.id}
                              className={cn(
                                'border-t',
                                theme === 'dark' ? 'border-gray-700' : 'border-gray-100',
                                line.difference !== 0 && (
                                  line.difference > 0
                                    ? 'bg-green-500/5'
                                    : 'bg-red-500/5'
                                )
                              )}
                            >
                              <td className="py-2 px-3">
                                <p className="font-medium text-xs">{line.productName}</p>
                                <p className="text-[10px] text-gray-500">SKU: {line.productSku}</p>
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-xs">
                                {line.expectedQuantity}
                              </td>
                              <td className="py-2 px-3 text-center font-mono text-xs">
                                {line.countedQuantity}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={cn(
                                  'font-mono font-bold text-xs',
                                  line.difference > 0 ? 'text-green-500' :
                                  line.difference < 0 ? 'text-red-500' : 'text-gray-500'
                                )}>
                                  {line.difference > 0 ? '+' : ''}{line.difference}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <span className={cn(
                                  'font-mono text-xs',
                                  line.differenceValue > 0 ? 'text-green-500' :
                                  line.differenceValue < 0 ? 'text-red-500' : 'text-gray-500'
                                )}>
                                  ${line.differenceValue.toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {selectedCount.status === 'approved' && (
                  <div className={cn(
                    'px-6 py-3 border-t text-xs text-gray-500 flex-shrink-0',
                    theme === 'dark' ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50'
                  )}>
                    {selectedCount.autoApproved ? (
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-500" />
                        Auto-aprobado (sin diferencias)
                      </span>
                    ) : (
                      <span>Aprobado por {selectedCount.approvedByName}</span>
                    )}
                    {selectedCount.approvedAt && (
                      <span className="ml-1">• {formatDate(selectedCount.approvedAt)}</span>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteModal && countToDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
              onClick={() => !deleting && setShowDeleteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className={cn(
                  'max-w-md w-full p-6 rounded-2xl',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4',
                  theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                )}>
                  <ShieldAlert className="w-7 h-7 text-red-500" />
                </div>
                <h3 className={cn(
                  'text-xl font-bold text-center mb-2',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Eliminar Conteo
                </h3>
                <p className="text-center text-gray-500 mb-2">
                  ¿Está seguro que desea eliminar el conteo <strong>{countToDelete.countNumber}</strong>?
                </p>
                <p className="text-center text-sm text-gray-400 mb-6">
                  Esta acción no se puede deshacer. Se eliminarán todos los productos contados.
                </p>
                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className={cn(
                      'flex-1 px-4 py-3 rounded-xl font-medium transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      deleting && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    Cancelar
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors text-white',
                      deleting
                        ? 'bg-red-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700'
                    )}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Eliminando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
