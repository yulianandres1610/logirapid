'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Factory,
  Plus,
  Search,
  RefreshCw,
  FileText,
  CheckCircle,
  Package,
  XCircle,
  Eye,
  Clock,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
  Boxes,
  ArrowRight,
  Calendar,
  Warehouse,
  DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface ProductionOrder {
  id: number
  productionNumber: string
  bomId: number
  bomCode: string
  bomName: string
  productName: string
  productImage: string | null
  warehouse: {
    id: number
    name: string
    code: string
  } | null
  quantityToProduce: number
  quantityProduced: number
  totalMaterialCost: number
  unitCost: number
  status: string
  scheduledDate: string | null
  startedAt: string | null
  completedAt: string | null
  createdBy: string
  createdAt: string
}

interface Stats {
  draft: number
  confirmed: number
  materials_out: number
  in_production: number
  completed: number
  cancelled: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; gradient: string }> = {
  draft: { label: 'Borrador', color: 'gray', icon: FileText, gradient: 'from-gray-400 to-gray-600' },
  confirmed: { label: 'Confirmada', color: 'blue', icon: CheckCircle, gradient: 'from-blue-400 to-blue-600' },
  materials_out: { label: 'Mat. Entregados', color: 'amber', icon: Package, gradient: 'from-amber-400 to-orange-600' },
  in_production: { label: 'En Producción', color: 'purple', icon: PlayCircle, gradient: 'from-purple-400 to-purple-600' },
  completed: { label: 'Completada', color: 'emerald', icon: CheckCircle, gradient: 'from-emerald-400 to-green-600' },
  cancelled: { label: 'Cancelada', color: 'red', icon: XCircle, gradient: 'from-red-400 to-rose-600' }
}

export default function ProductionPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ draft: 0, confirmed: 0, materials_out: 0, in_production: 0, completed: 0, cancelled: 0 })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchOrders = useCallback(async (page = 1, status: string | null = null, searchTerm = '') => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })
      if (status) params.append('status', status)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/market/production-orders?${params}`)
      const data = await response.json()

      if (data.success) {
        setOrders(data.data.orders || [])
        setStats(data.data.stats || { draft: 0, confirmed: 0, materials_out: 0, in_production: 0, completed: 0, cancelled: 0 })
        setPagination(data.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Error fetching production orders:', error)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders(1, selectedStatus, search)
  }, [selectedStatus, fetchOrders])

  const handleSearch = () => {
    fetchOrders(1, selectedStatus, search)
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchOrders(pagination.page, selectedStatus, search)
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
    const Icon = config.icon

    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        `bg-gradient-to-r ${config.gradient} text-white`
      )}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MARKET_ADMIN', 'MARKET_MANAGER', 'MARKET_COMERCIAL', 'MARKET_ALMACENERO']}>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen p-6",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className={cn(
                "text-2xl font-bold flex items-center gap-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                <Factory className="w-7 h-7 text-purple-500" />
                Producción
              </h1>
              <p className={cn(
                "text-sm mt-1",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Gestiona la fabricación y empaquetado de productos
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/market/production/bom"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-white hover:bg-gray-100 text-gray-900 border border-gray-200'
                )}
              >
                <BookOpen className="w-4 h-4" />
                <span>Recetas (BOM)</span>
              </Link>

              <Link
                href="/dashboard/market/production/orders/create"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                  "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
                )}
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Orden</span>
              </Link>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {Object.entries(STATUS_CONFIG).map(([status, config]) => {
              const Icon = config.icon
              const count = stats[status as keyof Stats] || 0
              const isActive = selectedStatus === status

              return (
                <motion.button
                  key={status}
                  onClick={() => setSelectedStatus(isActive ? null : status)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "p-4 rounded-xl transition-all text-left",
                    theme === 'dark'
                      ? isActive
                        ? 'bg-gray-700 ring-2 ring-purple-500'
                        : 'bg-gray-800 hover:bg-gray-750'
                      : isActive
                        ? 'bg-white ring-2 ring-purple-500 shadow-md'
                        : 'bg-white hover:bg-gray-50 shadow-sm'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-r ${config.gradient}`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className={cn(
                        "text-xl font-bold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {count}
                      </p>
                      <p className={cn(
                        "text-xs",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        {config.label}
                      </p>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Search and Filters */}
          <div className={cn(
            "p-4 rounded-xl mb-6",
            theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
          )}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )} />
                <input
                  type="text"
                  placeholder="Buscar por número, producto o receta..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className={cn(
                    "w-full pl-10 pr-4 py-2 rounded-lg border transition-all",
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-purple-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-purple-500'
                  )}
                />
              </div>

              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Buscar
              </button>

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={cn(
                  "px-4 py-2 rounded-lg transition-all flex items-center gap-2",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                )}
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                Actualizar
              </button>
            </div>

            {lastUpdated && (
              <p className={cn(
                "text-xs mt-2",
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )}>
                Última actualización: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Orders Table */}
          <div className={cn(
            "rounded-xl overflow-hidden",
            theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow-sm'
          )}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-20">
                <Boxes className={cn(
                  "w-16 h-16 mx-auto mb-4",
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
                )} />
                <h3 className={cn(
                  "text-lg font-medium mb-2",
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  No hay órdenes de producción
                </h3>
                <p className={cn(
                  "text-sm mb-4",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                )}>
                  Crea tu primera orden de producción para comenzar
                </p>
                <Link
                  href="/dashboard/market/production/orders/create"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Orden
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <tr>
                      <th className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Orden
                      </th>
                      <th className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Producto
                      </th>
                      <th className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Almacén
                      </th>
                      <th className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Cantidad
                      </th>
                      <th className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Costo
                      </th>
                      <th className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Estado
                      </th>
                      <th className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Fecha
                      </th>
                      <th className={cn(
                        "px-4 py-3 text-right text-xs font-medium uppercase tracking-wider",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {orders.map((order) => (
                      <motion.tr
                        key={order.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "transition-colors",
                          theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                        )}
                      >
                        <td className="px-4 py-4">
                          <div>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {order.productionNumber}
                            </p>
                            <p className={cn(
                              "text-xs",
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            )}>
                              {order.bomCode}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {order.productImage ? (
                              <img
                                src={order.productImage}
                                alt={order.productName}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                              )}>
                                <Package className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className={cn(
                                "font-medium text-sm",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {order.productName}
                              </p>
                              <p className={cn(
                                "text-xs",
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                {order.bomName}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {order.warehouse ? (
                            <div className="flex items-center gap-2">
                              <Warehouse className="w-4 h-4 text-gray-400" />
                              <span className={cn(
                                "text-sm",
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {order.warehouse.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className={cn(
                              "font-medium",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {order.quantityProduced > 0 ? (
                                <span>
                                  {order.quantityProduced} / {order.quantityToProduce}
                                </span>
                              ) : (
                                order.quantityToProduce
                              )}
                            </p>
                            {order.quantityProduced > 0 && (
                              <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                <div
                                  className="h-full bg-purple-500 rounded-full"
                                  style={{ width: `${Math.min(100, (order.quantityProduced / order.quantityToProduce) * 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p className={cn(
                              "font-medium text-sm",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {formatCurrency(order.totalMaterialCost)}
                            </p>
                            <p className={cn(
                              "text-xs",
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                            )}>
                              {formatCurrency(order.unitCost)}/ud
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              {formatDate(order.scheduledDate || order.createdAt)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Link
                            href={`/dashboard/market/production/orders/${order.id}`}
                            className={cn(
                              "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all",
                              theme === 'dark'
                                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            )}
                          >
                            <Eye className="w-4 h-4" />
                            Ver
                          </Link>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className={cn(
                "flex items-center justify-between px-4 py-3 border-t",
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchOrders(pagination.page - 1, selectedStatus, search)}
                    disabled={pagination.page === 1}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      pagination.page === 1
                        ? 'opacity-50 cursor-not-allowed'
                        : theme === 'dark'
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-100'
                    )}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className={cn(
                    "px-3 py-1 rounded-lg text-sm",
                    theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                  )}>
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => fetchOrders(pagination.page + 1, selectedStatus, search)}
                    disabled={pagination.page === pagination.totalPages}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      pagination.page === pagination.totalPages
                        ? 'opacity-50 cursor-not-allowed'
                        : theme === 'dark'
                          ? 'hover:bg-gray-700'
                          : 'hover:bg-gray-100'
                    )}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
