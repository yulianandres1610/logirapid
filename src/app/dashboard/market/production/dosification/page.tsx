'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Plus,
  Search,
  Scale,
  TrendingUp,
  Clock,
  CheckCircle,
  Calendar,
  Eye,
  Trash2,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  PackageCheck,
  AlertTriangle,
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ProductionOrder {
  id: number
  orderNumber: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  sourceProduct: {
    id: number
    name: string
    sku: string | null
    imageUrl: string | null
  }
  targetProduct: {
    id: number
    name: string
    sku: string | null
    imageUrl: string | null
  }
  sourceWarehouse: string
  targetWarehouse: string
  sourceWeight: number
  targetQuantity: number
  targetPortionWeight: number
  expectedTotalWeight: number
  wasteSurplus: {
    kg: number
    type: 'waste' | 'surplus' | 'exact'
  }
  actualQuantity: number | null
  actualWasteSurplus: number | null
  materialsCost: number
  laborCost: number
  totalCost: number
  costPerUnit: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  createdByName: string
  notes: string | null
}

interface Stats {
  total: { count: number; value: number }
  thisMonth: { count: number; value: number }
  pending: { count: number }
  inProgress: { count: number }
  completed: { count: number }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30', icon: Clock },
  in_progress: { label: 'En Proceso', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: Play },
  completed: { label: 'Completada', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: X }
}

export default function DosificationPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [stats, setStats] = useState<Stats>({
    total: { count: 0, value: 0 },
    thisMonth: { count: 0, value: 0 },
    pending: { count: 0 },
    inProgress: { count: 0 },
    completed: { count: 0 }
  })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [pagination.page, selectedStatus, startDate, endDate])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (pagination.page === 1) {
        fetchOrders()
      } else {
        setPagination(p => ({ ...p, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchOrders = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      if (search) params.set('search', search)
      if (selectedStatus) params.set('status', selectedStatus)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const response = await fetch(`/api/market/production/orders?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrders(data.data.orders)
          setPagination(data.data.pagination)
          setStats(data.data.stats)
          setLastUpdated(new Date())
        }
      }
    } catch (error) {
      console.error('Error fetching production orders:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const handleManualRefresh = () => fetchOrders(true)

  const deleteOrder = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Cancelar esta orden de producción?')) return

    try {
      const response = await fetch(`/api/market/production/orders/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchOrders()
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatWeight = (kg: number) => {
    return kg.toFixed(3) + ' kg'
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
              {/* Total Producido */}
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-emerald-900/30 border border-emerald-800/50'
                          : 'bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200'
                      )}>
                        <Package className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Total Producido</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{formatCurrency(stats.total.value)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{stats.total.count} órdenes</span>
                  </div>
                </div>
              </motion.div>

              {/* Este Mes */}
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-blue-900/30 border border-blue-800/50'
                          : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                      )}>
                        <TrendingUp className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Este Mes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{formatCurrency(stats.thisMonth.value)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{stats.thisMonth.count} órdenes</span>
                  </div>
                </div>
              </motion.div>

              {/* Pendientes */}
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
                        <Clock className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Pendientes</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.pending.count + stats.inProgress.count}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>{stats.pending.count} por iniciar, {stats.inProgress.count} en proceso</span>
                  </div>
                </div>
              </motion.div>

              {/* Completadas */}
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
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-green-900/30 border border-green-800/50'
                          : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200'
                      )}>
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Completadas</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.completed.count}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>
                      {stats.total.count > 0
                        ? `${Math.round((stats.completed.count / stats.total.count) * 100)}% completado`
                        : '0% completado'
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
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por número de orden o producto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                    )}
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={selectedStatus || ''}
                  onChange={(e) => setSelectedStatus(e.target.value || null)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                  )}
                >
                  <option value="">Todos los estados</option>
                  <option value="pending">Pendiente</option>
                  <option value="in_progress">En Proceso</option>
                  <option value="completed">Completada</option>
                  <option value="cancelled">Cancelada</option>
                </select>

                {/* Date Range */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-400 hidden sm:block" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={cn(
                      'px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all w-[140px]',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                    )}
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={cn(
                      'px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all w-[140px]',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                    )}
                  />
                </div>

                {/* Clear Filters */}
                {(search || selectedStatus || startDate || endDate) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSearch('')
                      setSelectedStatus(null)
                      setStartDate('')
                      setEndDate('')
                    }}
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
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualRefresh}
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

                {/* New Order Button */}
                <Link href="/dashboard/market/production/dosification/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Orden
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Orders Table */}
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
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider"># Orden</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Producto Fuente</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Producto Final</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Peso / Porciones</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Merma/Sobrante</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Costo/Unidad</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
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
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center">
                          <Scale className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay órdenes de producción</p>
                          <Link href="/dashboard/market/production/dosification/create">
                            <button className="mt-3 text-sm text-emerald-500 hover:text-emerald-600">
                              Crear primera orden
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      orders.map((order, index) => {
                        const statusConfig = STATUS_CONFIG[order.status]
                        const StatusIcon = statusConfig.icon

                        return (
                          <motion.tr
                            key={order.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            onClick={() => router.push(`/dashboard/market/production/dosification/${order.id}`)}
                            className={cn(
                              'group transition-colors cursor-pointer',
                              theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="py-4 px-4">
                              <span className={cn(
                                'font-mono text-sm font-medium',
                                theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                              )}>
                                {order.orderNumber}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                {order.sourceProduct.imageUrl ? (
                                  <img
                                    src={order.sourceProduct.imageUrl}
                                    alt={order.sourceProduct.name}
                                    className="w-10 h-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className={cn(
                                    'w-10 h-10 rounded-lg flex items-center justify-center',
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    <Package className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                                <div>
                                  <p className={cn(
                                    'text-sm font-medium truncate max-w-[150px]',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {order.sourceProduct.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatWeight(order.sourceWeight)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <ArrowRight className={cn(
                                'w-4 h-4',
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                              )} />
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                {order.targetProduct.imageUrl ? (
                                  <img
                                    src={order.targetProduct.imageUrl}
                                    alt={order.targetProduct.name}
                                    className="w-10 h-10 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div className={cn(
                                    'w-10 h-10 rounded-lg flex items-center justify-center',
                                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                                  )}>
                                    <PackageCheck className="w-5 h-5 text-gray-400" />
                                  </div>
                                )}
                                <div>
                                  <p className={cn(
                                    'text-sm font-medium truncate max-w-[150px]',
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {order.targetProduct.name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {order.actualQuantity ?? order.targetQuantity} × {formatWeight(order.targetPortionWeight)}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <p className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {formatWeight(order.sourceWeight)}
                              </p>
                              <p className="text-xs text-gray-500">
                                → {order.actualQuantity ?? order.targetQuantity} porciones
                              </p>
                            </td>
                            <td className="py-4 px-4 text-right">
                              {order.wasteSurplus.type === 'exact' ? (
                                <span className="text-xs text-gray-500">Exacto</span>
                              ) : (
                                <span className={cn(
                                  'inline-flex items-center gap-1 text-sm font-medium',
                                  order.wasteSurplus.type === 'surplus' ? 'text-green-600' : 'text-red-600'
                                )}>
                                  {order.wasteSurplus.type === 'waste' && <AlertTriangle className="w-3 h-3" />}
                                  {order.wasteSurplus.type === 'surplus' ? '+' : '-'}
                                  {Math.abs(order.wasteSurplus.kg).toFixed(3)} kg
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <span className="text-sm font-bold text-emerald-600">
                                {formatCurrency(order.costPerUnit)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                statusConfig.bgColor,
                                statusConfig.color
                              )}>
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="text-sm text-gray-500">
                                {formatDate(order.createdAt)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Link href={`/dashboard/market/production/dosification/${order.id}`}>
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                    title="Ver detalle"
                                  >
                                    <Eye className="w-4 h-4 text-blue-500" />
                                  </motion.button>
                                </Link>
                                {['pending', 'in_progress'].includes(order.status) && (
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => deleteOrder(order.id, e)}
                                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                    title="Cancelar"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </motion.button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })
                    )}
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
                      onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
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
                      onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
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
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
