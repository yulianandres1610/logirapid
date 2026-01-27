'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardCheck,
  Loader2,
  TrendingDown,
  TrendingUp,
  Calendar,
  User,
  Warehouse,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Package,
  Eye,
  Trash2,
  Minus
} from 'lucide-react'
import Image from 'next/image'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

// Roles con permisos de administrador para eliminar conteos
const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']

interface AuditCountLine {
  productId: number
  variantId: number | null
  productName: string
  productSku: string
  productBarcode: string
  productImage: string | null
  costPrice: number
  sellingPrice: number
  systemQuantity: number
  countedQuantity: number
  difference: number
  differenceValueCost: number
  differenceValueSale: number
}

interface AuditCount {
  id: number
  countNumber: string
  warehouseId: number
  warehouseName: string
  status: 'in_progress' | 'completed'
  totalProducts: number
  productsWithDifferences: number
  totalShortageValue: number
  totalExcessValue: number
  totalStockAtCost: number
  totalStockAtSale: number
  countedByEmail: string
  countedByName: string
  startedAt: string
  completedAt: string | null
  lines?: AuditCountLine[]
}

export default function AuditsPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState<AuditCount[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // User role state for permissions
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

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [warehouseFilter, setWarehouseFilter] = useState<string>('')
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([])

  // Detail modal
  const [selectedCount, setSelectedCount] = useState<AuditCount | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    totalCounts: 0,
    totalShortage: 0,
    totalExcess: 0,
    withDifferences: 0
  })

  const fetchCounts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)
    setError(null)

    try {
      let url = '/api/audit/counts?limit=50'
      if (statusFilter) url += `&status=${statusFilter}`
      if (warehouseFilter) url += `&warehouseId=${warehouseFilter}`

      const res = await fetch(url)
      const data = await res.json()

      if (data.success) {
        const fetchedCounts = data.data.counts || []
        setCounts(fetchedCounts)

        // Extract unique warehouses
        const uniqueWarehouses = new Map<number, string>()
        for (const c of fetchedCounts) {
          if (!uniqueWarehouses.has(c.warehouseId)) {
            uniqueWarehouses.set(c.warehouseId, c.warehouseName)
          }
        }
        setWarehouses(Array.from(uniqueWarehouses, ([id, name]) => ({ id, name })))

        // Calculate stats
        setStats({
          totalCounts: fetchedCounts.length,
          totalShortage: fetchedCounts.reduce((sum: number, c: AuditCount) => sum + c.totalShortageValue, 0),
          totalExcess: fetchedCounts.reduce((sum: number, c: AuditCount) => sum + c.totalExcessValue, 0),
          withDifferences: fetchedCounts.filter((c: AuditCount) => c.productsWithDifferences > 0).length
        })

        setLastUpdated(new Date())
      } else {
        setError(data.error || 'Error al cargar conteos')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }, [statusFilter, warehouseFilter])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  const fetchDetail = useCallback(async (countId: number) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/audit/counts?countId=${countId}`)
      const data = await res.json()
      if (data.success) {
        setSelectedCount(data.data)
        setShowDetail(true)
      }
    } catch {
      // silent
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const deleteCount = async (countId: number, e: React.MouseEvent) => {
    e.stopPropagation()

    // Verificar permisos de administrador
    if (!isAdmin) {
      showNotification('error', 'Acceso denegado', 'Solo los administradores pueden eliminar conteos de auditoría')
      return
    }

    if (!confirm('¿Eliminar este conteo de auditoría? Esta acción no se puede deshacer.')) return

    try {
      const res = await fetch(`/api/audit/counts?countId=${countId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showNotification('success', 'Conteo eliminado', 'El conteo de auditoría ha sido eliminado')
        fetchCounts(true)
      } else {
        showNotification('error', 'Error', data.error || 'Error al eliminar conteo')
      }
    } catch {
      showNotification('error', 'Error de conexión', 'No se pudo eliminar el conteo')
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
  }

  const clearFilters = () => {
    setStatusFilter('')
    setWarehouseFilter('')
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
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Conteos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-purple-900/30 border border-purple-800/50'
                          : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                      )}>
                        <ClipboardCheck className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Total Conteos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.totalCounts}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>auditorías realizadas</span>
                  </div>
                </div>
              </motion.div>

              {/* Faltantes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-red-900/30 border border-red-800/50'
                          : 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200'
                      )}>
                        <TrendingDown className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Faltantes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{formatCurrency(stats.totalShortage)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>valor total en faltantes</span>
                  </div>
                </div>
              </motion.div>

              {/* Sobrantes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-emerald-900/30 border border-emerald-800/50'
                          : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                      )}>
                        <TrendingUp className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Sobrantes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{formatCurrency(stats.totalExcess)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>valor total en sobrantes</span>
                  </div>
                </div>
              </motion.div>

              {/* Con Diferencias */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-amber-900/30 border border-amber-800/50'
                          : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                      )}>
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Con Diferencias</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.withDifferences}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>
                      {stats.totalCounts > 0
                        ? `${Math.round((stats.withDifferences / stats.totalCounts) * 100)}% con discrepancias`
                        : '0% con discrepancias'
                      }
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'p-4 rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                  )}
                >
                  <option value="">Todos los estados</option>
                  <option value="completed">Completados</option>
                  <option value="in_progress">En progreso</option>
                </select>

                {/* Warehouse Filter */}
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-purple-500 focus:ring-purple-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                  )}
                >
                  <option value="">Todos los almacenes</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>

                {/* Clear Filters */}
                {(statusFilter || warehouseFilter) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={clearFilters}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <X className="w-4 h-4" />
                    Limpiar
                  </motion.button>
                )}

                {/* Refresh */}
                <div className="flex items-center gap-2 ml-auto">
                  {lastUpdated && (
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fetchCounts(true)}
                    disabled={loading || isRefreshing}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      isRefreshing && 'opacity-75'
                    )}
                  >
                    <RefreshCw className={cn('w-4 h-4', (loading || isRefreshing) && 'animate-spin')} />
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
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
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Almacén</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Contado por</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Inicio</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Fin</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Productos</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Faltantes</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Sobrantes</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={10} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : error ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center">
                          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                          <p className="text-red-500">{error}</p>
                          <button
                            onClick={() => fetchCounts()}
                            className="mt-3 text-sm text-purple-500 hover:text-purple-600"
                          >
                            Reintentar
                          </button>
                        </td>
                      </tr>
                    ) : counts.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center">
                          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay conteos de auditoría</p>
                        </td>
                      </tr>
                    ) : (
                      counts.map((count, index) => (
                        <motion.tr
                          key={count.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            'group transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="py-4 px-4">
                            <span className={cn(
                              'text-sm font-semibold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {count.countNumber}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Warehouse className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {count.warehouseName}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {count.countedByName}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {formatDate(count.startedAt)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {count.completedAt ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {formatDate(count.completedAt)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                              theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                            )}>
                              <Package className="w-3 h-3" />
                              {count.totalProducts}
                              {count.productsWithDifferences > 0 && (
                                <span className="text-amber-500 ml-1">({count.productsWithDifferences} dif)</span>
                              )}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            {count.totalShortageValue > 0 ? (
                              <span className="text-sm font-bold text-red-500">
                                {formatCurrency(count.totalShortageValue)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            {count.totalExcessValue > 0 ? (
                              <span className="text-sm font-bold text-green-500">
                                {formatCurrency(count.totalExcessValue)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            {count.status === 'completed' ? (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                              )}>
                                <CheckCircle2 className="w-3 h-3" />
                                Completado
                              </span>
                            ) : (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                              )}>
                                <Clock className="w-3 h-3" />
                                En progreso
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => fetchDetail(count.id)}
                                disabled={loadingDetail}
                                className="p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                                title="Ver detalle"
                              >
                                {loadingDetail ? (
                                  <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                                ) : (
                                  <Eye className="w-4 h-4 text-purple-500" />
                                )}
                              </motion.button>
                              {/* Solo admins pueden eliminar */}
                              {isAdmin && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => deleteCount(count.id, e)}
                                  className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </motion.button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>

          {/* Detail Modal */}
          <AnimatePresence>
            {showDetail && selectedCount && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={() => setShowDetail(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className={cn(
                    'w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-2xl border shadow-2xl',
                    theme === 'dark'
                      ? 'bg-gray-900 border-gray-700'
                      : 'bg-white border-gray-200'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className={cn(
                    'flex items-center justify-between p-6 border-b',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div>
                      <h2 className={cn(
                        'text-xl font-bold',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {selectedCount.countNumber}
                      </h2>
                      <div className={cn(
                        'flex flex-wrap items-center gap-4 mt-1 text-sm',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        <span className="flex items-center gap-1">
                          <Warehouse className="w-4 h-4" />
                          {selectedCount.warehouseName}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {selectedCount.countedByName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDate(selectedCount.startedAt)}
                        </span>
                        {selectedCount.completedAt && (
                          <span className="flex items-center gap-1 text-green-500">
                            <CheckCircle2 className="w-4 h-4" />
                            {formatDate(selectedCount.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDetail(false)}
                      className={cn(
                        'p-2 rounded-lg transition-colors',
                        theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
                      )}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Summary Cards */}
                  <div className={cn(
                    'grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50')}>
                      <p className="text-xs text-gray-500">Stock a Costo</p>
                      <p className={cn('font-bold text-lg mt-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(selectedCount.totalStockAtCost)}
                      </p>
                    </div>
                    <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50')}>
                      <p className="text-xs text-gray-500">Stock a Venta</p>
                      <p className={cn('font-bold text-lg mt-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        {formatCurrency(selectedCount.totalStockAtSale)}
                      </p>
                    </div>
                    <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50')}>
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" /> Faltantes
                      </p>
                      <p className="font-bold text-lg mt-1 text-red-500">
                        {formatCurrency(selectedCount.totalShortageValue)}
                      </p>
                    </div>
                    <div className={cn('p-3 rounded-xl', theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50')}>
                      <p className="text-xs text-green-500 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Sobrantes
                      </p>
                      <p className="font-bold text-lg mt-1 text-green-500">
                        {formatCurrency(selectedCount.totalExcessValue)}
                      </p>
                    </div>
                  </div>

                  {/* Products Table */}
                  <div className="overflow-y-auto max-h-[45vh]">
                    <table className="w-full">
                      <thead className={cn(
                        'sticky top-0',
                        theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      )}>
                        <tr className={cn(
                          'border-b',
                          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                        )}>
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Producto</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">P. Costo</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">P. Venta</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Sistema</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Contado</th>
                          <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Diferencia</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Valor Dif.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedCount.lines?.map((line, idx) => (
                          <tr
                            key={idx}
                            className={cn(
                              'transition-colors',
                              theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50',
                              line.difference !== 0 && (
                                line.difference > 0
                                  ? 'bg-red-500/5'
                                  : 'bg-green-500/5'
                              )
                            )}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {/* Product Image */}
                                <div className={cn(
                                  'w-10 h-10 rounded-lg overflow-hidden shrink-0',
                                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                )}>
                                  {line.productImage ? (
                                    <Image
                                      src={line.productImage}
                                      alt={line.productName}
                                      width={40}
                                      height={40}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="w-4 h-4 text-gray-400" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className={cn(
                                    'text-sm font-medium truncate max-w-[180px]',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>{line.productName}</p>
                                  {line.productSku && (
                                    <p className="text-xs text-gray-500 font-mono">SKU: {line.productSku}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-300">
                              {formatCurrency(line.costPrice)}
                            </td>
                            <td className="py-3 px-4 text-right text-sm text-gray-600 dark:text-gray-300">
                              {formatCurrency(line.sellingPrice)}
                            </td>
                            <td className={cn(
                              'py-3 px-4 text-right text-sm font-medium',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              {line.systemQuantity}
                            </td>
                            <td className={cn(
                              'py-3 px-4 text-right text-sm font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {line.countedQuantity}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold',
                                line.difference > 0
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : line.difference < 0
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                              )}>
                                {line.difference > 0 && <TrendingDown className="w-3 h-3" />}
                                {line.difference < 0 && <TrendingUp className="w-3 h-3" />}
                                {line.difference === 0 && <Minus className="w-3 h-3" />}
                                {line.difference > 0 ? `-${line.difference}` :
                                 line.difference < 0 ? `+${Math.abs(line.difference)}` :
                                 '0'}
                              </span>
                            </td>
                            <td className={cn(
                              'py-3 px-4 text-right text-sm font-medium',
                              line.differenceValueCost > 0 ? 'text-red-500' :
                              line.differenceValueCost < 0 ? 'text-green-500' :
                              'text-gray-400'
                            )}>
                              {line.differenceValueCost !== 0
                                ? formatCurrency(Math.abs(line.differenceValueCost))
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Modal Footer */}
                  <div className={cn(
                    'flex items-center justify-between p-4 border-t',
                    theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                  )}>
                    <span className="text-sm text-gray-500">
                      {selectedCount.lines?.length || 0} productos contados
                    </span>
                    <div className="flex items-center gap-4 text-sm">
                      {selectedCount.totalShortageValue > 0 && (
                        <span className="text-red-500 font-medium">
                          Faltantes: {formatCurrency(selectedCount.totalShortageValue)}
                        </span>
                      )}
                      {selectedCount.totalExcessValue > 0 && (
                        <span className="text-green-500 font-medium">
                          Sobrantes: {formatCurrency(selectedCount.totalExcessValue)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
