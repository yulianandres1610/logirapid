'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  History,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Warehouse,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  Package,
  Eye,
  AlertTriangle,
  Trash2,
  Settings,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingDown,
  BarChart3,
  ArrowLeft,
  X
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

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

interface Operation {
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
  createdByName: string
  completedByName: string | null
  createdAt: string
  completedAt: string | null
  lines: OperationLine[]
}

interface Stats {
  adjustment: { draft: number; done: number; cancelled: number; totalQty: number; totalValue: number }
  scrap: { draft: number; confirmed: number; in_progress: number; done: number; cancelled: number; totalQty: number; totalValue: number }
}

interface ReasonDistribution {
  reason: string
  count: number
  totalQty: number
}

interface FilterWarehouse {
  id: number
  name: string
  code: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: FileText },
  confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: CheckCircle },
  in_progress: { label: 'En Proceso', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  done: { label: 'Completado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: XCircle }
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  damaged: { label: 'Dañado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  expired: { label: 'Vencido', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  defective: { label: 'Defectuoso', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  physical_count: { label: 'Conteo Físico', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  system_error: { label: 'Error Sistema', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  theft_loss: { label: 'Robo/Pérdida', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  other: { label: 'Otro', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' }
}

export default function AdjustmentsHistoryPage() {
  const { theme } = useTheme()
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [operations, setOperations] = useState<Operation[]>([])
  const [stats, setStats] = useState<Stats>({
    adjustment: { draft: 0, done: 0, cancelled: 0, totalQty: 0, totalValue: 0 },
    scrap: { draft: 0, confirmed: 0, in_progress: 0, done: 0, cancelled: 0, totalQty: 0, totalValue: 0 }
  })
  const [reasonDistribution, setReasonDistribution] = useState<ReasonDistribution[]>([])
  const [warehouses, setWarehouses] = useState<FilterWarehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [expandedOperations, setExpandedOperations] = useState<Set<number>>(new Set())
  const [detailModal, setDetailModal] = useState<Operation | null>(null)

  // Check if user has admin access
  const allowedRoles = ['SUPER_ADMIN', 'ADMIN']
  const hasAccess = user && allowedRoles.includes(user.role)

  useEffect(() => {
    if (!authLoading && user && !allowedRoles.includes(user.role)) {
      router.push('/dashboard/market/warehouses')
    }
  }, [user, authLoading, router])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (warehouseFilter !== 'all') params.set('warehouseId', warehouseFilter)
      if (search) params.set('search', search)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const response = await fetch(`/api/market/warehouse-operations/adjustments-history?${params}`)
      const data = await response.json()

      if (data.success) {
        setOperations(data.data.operations)
        setStats(data.data.stats)
        setReasonDistribution(data.data.reasonDistribution || [])
        setWarehouses(data.data.warehouses || [])
      }
    } catch (error) {
      console.error('Error fetching adjustments history:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [typeFilter, statusFilter, warehouseFilter, search, dateFrom, dateTo])

  const toggleExpand = (id: number) => {
    setExpandedOperations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const totalAdjustments = stats.adjustment.draft + stats.adjustment.done + stats.adjustment.cancelled
  const totalScrap = stats.scrap.draft + stats.scrap.confirmed + stats.scrap.in_progress + stats.scrap.done + stats.scrap.cancelled
  const totalValue = stats.adjustment.totalValue + stats.scrap.totalValue

  const statCards = [
    {
      title: 'Total Operaciones',
      value: totalAdjustments + totalScrap,
      icon: History,
      gradient: 'from-blue-400 to-blue-600',
      iconBg: theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100',
      textColor: theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
    },
    {
      title: 'Ajustes',
      value: totalAdjustments,
      icon: Settings,
      gradient: 'from-purple-400 to-purple-600',
      iconBg: theme === 'dark' ? 'bg-purple-900/50' : 'bg-purple-100',
      textColor: theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
    },
    {
      title: 'Scrap/Mermas',
      value: totalScrap,
      icon: Trash2,
      gradient: 'from-red-400 to-red-600',
      iconBg: theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100',
      textColor: theme === 'dark' ? 'text-red-400' : 'text-red-600'
    },
    {
      title: 'Valor Total',
      value: `$${totalValue.toFixed(2)}`,
      icon: DollarSign,
      gradient: 'from-amber-400 to-amber-600',
      iconBg: theme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100',
      textColor: theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
    }
  ]

  // Show loading while checking access
  if (authLoading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  // If no access, the useEffect will redirect, but just in case show nothing
  if (!hasAccess) {
    return null
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen p-4 lg:p-6",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link href="/dashboard/market/warehouses">
                  <motion.button
                    whileHover={{ scale: 1.02, x: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'p-2.5 rounded-xl transition-colors',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    )}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </motion.button>
                </Link>
                <div>
                  <h1 className={cn(
                    "text-2xl sm:text-3xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Historial de Ajustes y Scrap
                  </h1>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Registro histórico de todos los ajustes de inventario y mermas
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fetchHistory()}
                disabled={loading}
                className={cn(
                  "p-2.5 rounded-xl transition-all",
                  theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
                )}
              >
                <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
              </motion.button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'relative overflow-hidden',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                    'rounded-2xl border shadow-xl'
                  )}
                >
                  <div className={cn("absolute top-0 left-0 w-full h-1 bg-gradient-to-r", stat.gradient)} />

                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn(
                          "text-sm font-medium",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          {stat.title}
                        </p>
                        <p className={cn(
                          "text-2xl sm:text-3xl font-bold mt-1",
                          stat.textColor
                        )}>
                          {stat.value}
                        </p>
                      </div>
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        stat.iconBg
                      )}>
                        <stat.icon className={cn("w-6 h-6", stat.textColor)} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Reason Distribution */}
            {reasonDistribution.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={cn(
                  'rounded-2xl border p-5',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className={cn(
                    "w-5 h-5",
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  )} />
                  <h3 className={cn(
                    "font-semibold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Motivos de Scrap
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {reasonDistribution.map((item) => {
                    const reasonConfig = REASON_LABELS[item.reason] || REASON_LABELS.other
                    return (
                      <div
                        key={item.reason}
                        className={cn(
                          'p-3 rounded-xl',
                          theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                        )}
                      >
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          reasonConfig.color
                        )}>
                          {reasonConfig.label}
                        </span>
                        <p className={cn(
                          'text-xl font-bold mt-2',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {item.count}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.totalQty} unidades
                        </p>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Filters */}
            <div className={cn(
              "flex flex-col gap-4 p-4 rounded-2xl border",
              theme === 'dark'
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5",
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por número de operación o motivo..."
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className={cn(
                    "w-5 h-5 flex-shrink-0",
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )} />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className={cn(
                      'px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all text-sm',
                      theme === 'dark'
                        ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  >
                    <option value="all">Todos los tipos</option>
                    <option value="adjustment">Ajustes</option>
                    <option value="scrap">Scrap/Mermas</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={cn(
                      'px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all text-sm',
                      theme === 'dark'
                        ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  >
                    <option value="all">Todos los estados</option>
                    <option value="draft">Borrador</option>
                    <option value="confirmed">Confirmado</option>
                    <option value="in_progress">En Proceso</option>
                    <option value="done">Completado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>

                  {warehouses.length > 0 && (
                    <select
                      value={warehouseFilter}
                      onChange={(e) => setWarehouseFilter(e.target.value)}
                      className={cn(
                        'px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all text-sm',
                        theme === 'dark'
                          ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    >
                      <option value="all">Todos los almacenes</option>
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Calendar className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )} />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={cn(
                    'px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 transition-all text-sm',
                    theme === 'dark'
                      ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                  placeholder="Desde"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={cn(
                    'px-3 py-2 rounded-xl border focus:outline-none focus:ring-2 transition-all text-sm',
                    theme === 'dark'
                      ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                  placeholder="Hasta"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo('') }}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    Limpiar fechas
                  </button>
                )}
              </div>
            </div>

            {/* Operations List */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className={cn(
                  "w-8 h-8 animate-spin",
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                )} />
              </div>
            ) : operations.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "text-center py-16 rounded-2xl border",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}
              >
                <History className={cn(
                  "w-16 h-16 mx-auto mb-4",
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                )} />
                <h3 className={cn(
                  "text-lg font-semibold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  No hay registros
                </h3>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                )}>
                  No se encontraron ajustes o mermas con los filtros seleccionados
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {operations.map((operation, index) => {
                  const statusConfig = STATUS_CONFIG[operation.status] || STATUS_CONFIG.draft
                  const StatusIcon = statusConfig.icon
                  const isExpanded = expandedOperations.has(operation.id)
                  const isAdjustment = operation.operationType === 'adjustment'

                  return (
                    <motion.div
                      key={operation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        'rounded-2xl border shadow-lg overflow-hidden',
                        theme === 'dark'
                          ? 'bg-gray-800 border-gray-700'
                          : 'bg-white border-gray-200'
                      )}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                              isAdjustment
                                ? theme === 'dark' ? 'bg-purple-900/50' : 'bg-purple-100'
                                : theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100'
                            )}>
                              {isAdjustment ? (
                                <Settings className={cn(
                                  "w-6 h-6",
                                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                                )} />
                              ) : (
                                <Trash2 className={cn(
                                  "w-6 h-6",
                                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                                )} />
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <h3 className={cn(
                                  "font-bold font-mono",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {operation.operationNumber}
                                </h3>
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full font-medium",
                                  isAdjustment
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                )}>
                                  {isAdjustment ? 'Ajuste' : 'Scrap'}
                                </span>
                                <span className={cn(
                                  "text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1",
                                  statusConfig.color
                                )}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusConfig.label}
                                </span>
                              </div>

                              {operation.warehouse && (
                                <div className={cn(
                                  "flex items-center gap-2 mt-2 text-sm",
                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                )}>
                                  <Warehouse className="w-4 h-4 text-blue-500" />
                                  <span>Almacén:</span>
                                  <span className="font-medium">{operation.warehouse.name}</span>
                                </div>
                              )}

                              {operation.notes && (
                                <div className={cn(
                                  "mt-2 text-sm italic",
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                )}>
                                  Motivo: {operation.notes.length > 60 ? operation.notes.slice(0, 60) + '...' : operation.notes}
                                </div>
                              )}

                              <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                                <span className={cn(
                                  "flex items-center gap-1",
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                )}>
                                  <Package className="w-3 h-3" />
                                  {operation.linesCount} productos
                                </span>
                                <span className={cn(
                                  "flex items-center gap-1",
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                )}>
                                  <TrendingDown className="w-3 h-3" />
                                  {operation.totalQuantity} unidades
                                </span>
                                <span className={cn(
                                  "flex items-center gap-1",
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                )}>
                                  <Calendar className="w-3 h-3" />
                                  {new Date(operation.createdAt).toLocaleDateString('es-ES')}
                                </span>
                                <span className={cn(
                                  "flex items-center gap-1",
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                )}>
                                  por {operation.createdByName}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className={cn(
                                "text-xl font-bold",
                                isAdjustment
                                  ? theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                                  : theme === 'dark' ? 'text-red-400' : 'text-red-600'
                              )}>
                                ${operation.totalValue.toFixed(2)}
                              </div>
                              <p className="text-xs text-gray-500">
                                valor
                              </p>
                            </div>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => toggleExpand(operation.id)}
                              className={cn(
                                "p-2 rounded-xl transition-all",
                                theme === 'dark'
                                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                              )}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5" />
                              ) : (
                                <ChevronDown className="w-5 h-5" />
                              )}
                            </motion.button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && operation.lines.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className={cn(
                              'border-t p-4',
                              theme === 'dark' ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                            )}>
                              <h4 className={cn(
                                'text-sm font-semibold mb-3',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                Productos Afectados
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className={cn(
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                    )}>
                                      <th className="text-left py-2 px-3 font-medium">Producto</th>
                                      <th className="text-left py-2 px-3 font-medium">SKU</th>
                                      <th className="text-right py-2 px-3 font-medium">Cantidad</th>
                                      <th className="text-right py-2 px-3 font-medium">Costo U.</th>
                                      <th className="text-right py-2 px-3 font-medium">Total</th>
                                      {!isAdjustment && (
                                        <th className="text-left py-2 px-3 font-medium">Motivo</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className={cn(
                                    'divide-y',
                                    theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'
                                  )}>
                                    {operation.lines.map((line) => {
                                      const reasonConfig = line.reason ? (REASON_LABELS[line.reason] || REASON_LABELS.other) : null
                                      return (
                                        <tr key={line.id} className={cn(
                                          'transition-colors',
                                          theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-white'
                                        )}>
                                          <td className="py-2 px-3">
                                            <p className={cn(
                                              'font-medium',
                                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                                            )}>
                                              {line.productName}
                                            </p>
                                            {line.variantName && (
                                              <p className="text-xs text-gray-500">{line.variantName}</p>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 font-mono text-gray-500">
                                            {line.productSku}
                                          </td>
                                          <td className={cn(
                                            'py-2 px-3 text-right font-bold',
                                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                                          )}>
                                            {line.quantity}
                                          </td>
                                          <td className="py-2 px-3 text-right text-gray-500">
                                            ${line.unitCost.toFixed(2)}
                                          </td>
                                          <td className={cn(
                                            'py-2 px-3 text-right font-semibold',
                                            theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                                          )}>
                                            ${(line.quantity * line.unitCost).toFixed(2)}
                                          </td>
                                          {!isAdjustment && (
                                            <td className="py-2 px-3">
                                              {reasonConfig ? (
                                                <span className={cn(
                                                  'text-xs px-2 py-0.5 rounded-full font-medium',
                                                  reasonConfig.color
                                                )}>
                                                  {reasonConfig.label}
                                                </span>
                                              ) : (
                                                <span className="text-gray-400">-</span>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>

                              {operation.internalNotes && (
                                <div className={cn(
                                  'mt-4 p-3 rounded-xl text-sm',
                                  theme === 'dark' ? 'bg-gray-800' : 'bg-white border border-gray-200'
                                )}>
                                  <p className="text-xs text-gray-500 mb-1">Notas internas:</p>
                                  <p className={cn(
                                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                  )}>
                                    {operation.internalNotes}
                                  </p>
                                </div>
                              )}

                              {operation.completedAt && (
                                <div className="mt-3 text-xs text-gray-500">
                                  Completado el {new Date(operation.completedAt).toLocaleDateString('es-ES', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                  {operation.completedByName && ` por ${operation.completedByName}`}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
