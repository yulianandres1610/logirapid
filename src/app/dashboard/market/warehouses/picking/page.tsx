'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ClipboardList,
  Plus,
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
  PlayCircle,
  Eye,
  ShoppingBag,
  Boxes
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Operation {
  id: number
  operationNumber: string
  operationType: string
  sourceWarehouse: { id: number; name: string; code: string } | null
  destinationWarehouse: { id: number; name: string; code: string } | null
  referenceType: string
  referenceId: number
  status: string
  scheduledDate: string
  startedAt: string
  completedAt: string
  notes: string
  linesCount: number
  totalPlanned: number
  totalDone: number
  createdBy: string
  createdAt: string
}

interface Stats {
  picking: { draft: number; confirmed: number; in_progress: number; done: number; cancelled: number }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: FileText },
  confirmed: { label: 'Asignado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: CheckCircle },
  in_progress: { label: 'En Proceso', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: PlayCircle },
  done: { label: 'Completado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: XCircle }
}

export default function PickingPage() {
  const { theme } = useTheme()
  const [operations, setOperations] = useState<Operation[]>([])
  const [stats, setStats] = useState<Stats>({ picking: { draft: 0, confirmed: 0, in_progress: 0, done: 0, cancelled: 0 } })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const fetchOperations = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('type', 'picking')
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const response = await fetch(`/api/market/warehouse-operations?${params}`)
      const data = await response.json()

      if (data.success) {
        setOperations(data.data.operations)
        setStats(data.data.stats)
      }
    } catch (error) {
      console.error('Error fetching picking operations:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOperations()
  }, [search, statusFilter])

  const pickingStats = stats.picking || { draft: 0, confirmed: 0, in_progress: 0, done: 0, cancelled: 0 }
  const totalPicking = Object.values(pickingStats).reduce((a, b) => a + b, 0)

  const statCards = [
    {
      title: 'Total Picking',
      value: totalPicking,
      icon: ClipboardList,
      gradient: 'from-violet-400 to-violet-600',
      bgGradient: theme === 'dark' ? 'from-violet-900/30 to-violet-800/20' : 'from-violet-50 to-white',
      iconBg: theme === 'dark' ? 'bg-violet-900/50' : 'bg-violet-100',
      textColor: theme === 'dark' ? 'text-violet-400' : 'text-violet-600'
    },
    {
      title: 'Asignados',
      value: pickingStats.confirmed,
      icon: ShoppingBag,
      gradient: 'from-blue-400 to-blue-600',
      bgGradient: theme === 'dark' ? 'from-blue-900/30 to-blue-800/20' : 'from-blue-50 to-white',
      iconBg: theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100',
      textColor: theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
    },
    {
      title: 'En Proceso',
      value: pickingStats.in_progress,
      icon: Boxes,
      gradient: 'from-amber-400 to-amber-600',
      bgGradient: theme === 'dark' ? 'from-amber-900/30 to-amber-800/20' : 'from-amber-50 to-white',
      iconBg: theme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100',
      textColor: theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
    },
    {
      title: 'Completados',
      value: pickingStats.done,
      icon: CheckCircle,
      gradient: 'from-green-400 to-green-600',
      bgGradient: theme === 'dark' ? 'from-green-900/30 to-green-800/20' : 'from-green-50 to-white',
      iconBg: theme === 'dark' ? 'bg-green-900/50' : 'bg-green-100',
      textColor: theme === 'dark' ? 'text-green-400' : 'text-green-600'
    }
  ]

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
              <div>
                <h1 className={cn(
                  "text-2xl sm:text-3xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Preparación de Órdenes
                </h1>
                <p className={cn(
                  "text-sm mt-1",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Picking y preparación de pedidos para envío
                </p>
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchOperations()}
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

                <Link href="/dashboard/market/warehouses/picking/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all",
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white shadow-lg shadow-violet-500/25'
                        : 'bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white shadow-lg shadow-violet-400/25'
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Nuevo Picking</span>
                  </motion.button>
                </Link>
              </div>
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
                          "text-3xl font-bold mt-1",
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

                    <div className={cn(
                      "mt-4 h-1.5 rounded-full overflow-hidden",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                    )}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: totalPicking > 0 ? `${(stat.value / totalPicking) * 100}%` : '0%' }}
                        transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                        className={cn("h-full rounded-full bg-gradient-to-r", stat.gradient)}
                      />
                    </div>
                  </div>

                  <div className="absolute top-3 right-3">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={cn("w-2 h-2 rounded-full bg-gradient-to-r", stat.gradient)}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Filters */}
            <div className={cn(
              "flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border",
              theme === 'dark'
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              <div className="flex-1 relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por número de operación..."
                  className={cn(
                    'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                    theme === 'dark'
                      ? 'bg-gray-900/50 border-gray-600 text-white focus:border-violet-500 focus:ring-violet-500/20'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-violet-500 focus:ring-violet-500/20'
                  )}
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                    theme === 'dark'
                      ? 'bg-gray-900/50 border-gray-600 text-white focus:border-violet-500 focus:ring-violet-500/20'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-violet-500 focus:ring-violet-500/20'
                  )}
                >
                  <option value="all">Todos los estados</option>
                  <option value="draft">Borrador</option>
                  <option value="confirmed">Asignado</option>
                  <option value="in_progress">En Proceso</option>
                  <option value="done">Completado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
            </div>

            {/* Operations List */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className={cn(
                  "w-8 h-8 animate-spin",
                  theme === 'dark' ? 'text-violet-400' : 'text-violet-600'
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
                <ClipboardList className={cn(
                  "w-16 h-16 mx-auto mb-4",
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                )} />
                <h3 className={cn(
                  "text-lg font-semibold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  No hay operaciones de picking
                </h3>
                <p className={cn(
                  "text-sm mb-6",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                )}>
                  Crea tu primera preparación de pedido
                </p>
                <Link href="/dashboard/market/warehouses/picking/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      theme === 'dark'
                        ? 'bg-violet-600 hover:bg-violet-700 text-white'
                        : 'bg-violet-500 hover:bg-violet-600 text-white'
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Picking
                  </motion.button>
                </Link>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {operations.map((operation, index) => {
                  const statusConfig = STATUS_CONFIG[operation.status] || STATUS_CONFIG.draft
                  const StatusIcon = statusConfig.icon
                  const progress = operation.totalPlanned > 0
                    ? Math.round((operation.totalDone / operation.totalPlanned) * 100)
                    : 0

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
                              theme === 'dark' ? 'bg-violet-900/50' : 'bg-violet-100'
                            )}>
                              <ClipboardList className={cn(
                                "w-6 h-6",
                                theme === 'dark' ? 'text-violet-400' : 'text-violet-600'
                              )} />
                            </div>

                            <div>
                              <div className="flex items-center gap-3">
                                <h3 className={cn(
                                  "font-bold font-mono",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {operation.operationNumber}
                                </h3>
                                <span className={cn(
                                  "text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1",
                                  statusConfig.color
                                )}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusConfig.label}
                                </span>
                              </div>

                              {operation.sourceWarehouse && (
                                <div className={cn(
                                  "flex items-center gap-2 mt-2 text-sm",
                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                )}>
                                  <Warehouse className="w-4 h-4 text-violet-500" />
                                  <span>Almacén:</span>
                                  <span className="font-medium">{operation.sourceWarehouse.name}</span>
                                </div>
                              )}

                              {operation.referenceType === 'order' && operation.referenceId && (
                                <div className={cn(
                                  "flex items-center gap-2 mt-1 text-sm",
                                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                )}>
                                  <ShoppingBag className="w-4 h-4 text-amber-500" />
                                  <span>Pedido #{operation.referenceId}</span>
                                </div>
                              )}

                              <div className="flex items-center gap-4 mt-2 text-xs">
                                <span className={cn(
                                  "flex items-center gap-1",
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                )}>
                                  <Package className="w-3 h-3" />
                                  {operation.linesCount} líneas
                                </span>
                                <span className={cn(
                                  "flex items-center gap-1",
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                                )}>
                                  <Calendar className="w-3 h-3" />
                                  {new Date(operation.createdAt).toLocaleDateString('es-ES')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            {operation.totalPlanned > 0 && (
                              <div className="text-center">
                                <div className={cn(
                                  "text-2xl font-bold",
                                  progress === 100
                                    ? 'text-green-600'
                                    : progress > 0
                                      ? 'text-amber-600'
                                      : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                )}>
                                  {progress}%
                                </div>
                                <p className="text-xs text-gray-500">
                                  {operation.totalDone}/{operation.totalPlanned}
                                </p>
                              </div>
                            )}

                            <Link href={`/dashboard/market/warehouses/picking/${operation.id}`}>
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={cn(
                                  "flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all",
                                  theme === 'dark'
                                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                )}
                              >
                                <Eye className="w-4 h-4" />
                                Ver
                              </motion.button>
                            </Link>
                          </div>
                        </div>

                        {operation.totalPlanned > 0 && (
                          <div className={cn(
                            "mt-4 h-1.5 rounded-full overflow-hidden",
                            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                          )}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 0.5 }}
                              className={cn(
                                "h-full rounded-full",
                                progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-amber-500' : 'bg-gray-400'
                              )}
                            />
                          </div>
                        )}
                      </div>
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
