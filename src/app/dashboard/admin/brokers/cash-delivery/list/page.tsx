'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import {
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  AlertCircle,
  Eye,
  Ban,
  ChevronLeft,
  ChevronRight,
  Loader2,
  DollarSign,
  User,
  Building2,
  Calendar,
  RefreshCw,
  Banknote
} from 'lucide-react'

interface CashDeliveryOrder {
  id: number
  order_number: string
  broker_company_name: string
  broker_name: string
  broker_province: string
  delivery_user_name: string
  delivery_user_phone: string
  currency: string
  total_amount: string
  total_bills: number
  deadline_date: string
  status: string
  created_at: string
  completed_at?: string
}

const STATUS_CONFIG: { [key: string]: { label: string; color: string; bgColor: string; icon: any } } = {
  pending: { label: 'Pendiente', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: Clock },
  in_transit: { label: 'En Tránsito', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: Truck },
  pending_reception: { label: 'Recibiendo', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: DollarSign },
  validating: { label: 'Validando OTP', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: AlertCircle },
  completed: { label: 'Completado', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle },
  blocked: { label: 'Bloqueado', color: 'text-red-700 dark:text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: Ban }
}

export default function CashDeliveryListPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [orders, setOrders] = useState<CashDeliveryOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    loadOrders()
  }, [page, statusFilter])

  const loadOrders = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      })
      if (statusFilter) params.append('status', statusFilter)

      const res = await fetch(`/api/admin/cash-delivery?${params}`)
      const data = await res.json()

      if (data.success) {
        setOrders(data.data.orders || [])
        setTotalPages(data.data.pagination?.totalPages || 1)
        setTotalCount(data.data.pagination?.totalCount || 0)
      }
    } catch (error) {
      console.error('Error loading orders:', error)
      showNotification('error', 'Error', 'Error al cargar las órdenes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = async (order: CashDeliveryOrder) => {
    if (!confirm(`¿Cancelar orden ${order.order_number}?`)) return

    try {
      const res = await fetch(`/api/admin/cash-delivery/${order.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelada por administrador' })
      })

      const data = await res.json()
      if (data.success) {
        showNotification('success', 'Orden cancelada', data.message)
        loadOrders()
      } else {
        showNotification('error', 'Error', data.error)
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error al cancelar la orden')
    }
  }

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(search.toLowerCase()) ||
    order.broker_company_name?.toLowerCase().includes(search.toLowerCase()) ||
    order.delivery_user_name?.toLowerCase().includes(search.toLowerCase())
  )

  // Calculate stats
  const stats = {
    pending: orders.filter(o => ['pending', 'in_transit'].includes(o.status)).length,
    inProcess: orders.filter(o => ['pending_reception', 'validating'].includes(o.status)).length,
    completed: orders.filter(o => o.status === 'completed').length,
    total: totalCount
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Total */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                'relative overflow-hidden rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl shadow-sm',
                    theme === 'dark'
                      ? 'bg-blue-900/30 border border-blue-800/50'
                      : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                  )}>
                    <Banknote className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>Total Órdenes</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>{stats.total}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Pendientes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                'relative overflow-hidden rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
              <div className="p-6">
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
                    )}>{stats.pending}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* En Proceso */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                'relative overflow-hidden rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl shadow-sm',
                    theme === 'dark'
                      ? 'bg-purple-900/30 border border-purple-800/50'
                      : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                  )}>
                    <AlertCircle className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>En Proceso</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>{stats.inProcess}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Completadas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                'relative overflow-hidden rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl shadow-sm',
                    theme === 'dark'
                      ? 'bg-emerald-900/30 border border-emerald-800/50'
                      : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                  )}>
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>Completadas</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>{stats.completed}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Filters */}
          <div className={cn(
            'flex flex-col lg:flex-row gap-6 items-center justify-between py-6 px-4 rounded-xl border',
            theme === 'dark'
              ? 'bg-gray-800/50 border-gray-700'
              : 'bg-white border-gray-200'
          )}>
            <div className="flex-1 relative w-full lg:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por número, broker o repartidor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full h-12 pl-10 pr-4 rounded-lg border transition-colors text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                )}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className={cn(
                  'h-12 px-4 rounded-lg border transition-colors text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                )}
              >
                <option value="">Todos los estados</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>

              <button
                onClick={loadOrders}
                className={cn(
                  'flex items-center justify-center gap-2 h-12 px-4 rounded-lg font-medium transition-all',
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                )}
              >
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                Actualizar
              </button>

              <button
                onClick={() => router.push('/dashboard/admin/brokers/cash-delivery')}
                className="flex items-center justify-center gap-2 h-12 px-6 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                Nueva Entrega
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className={cn(
            'rounded-xl border overflow-hidden',
            theme === 'dark'
              ? 'bg-gray-800 border-gray-700'
              : 'bg-white border-gray-200'
          )}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className={cn('h-8 w-8 animate-spin', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className={cn('h-12 w-12 mx-auto mb-4', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
                  No se encontraron órdenes
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    'border-b',
                    theme === 'dark'
                      ? 'bg-gray-900/50 border-gray-700'
                      : 'bg-gray-50 border-gray-200'
                  )}>
                    <tr>
                      <th className={cn('px-4 py-3 text-left text-xs font-medium uppercase tracking-wider', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Orden</th>
                      <th className={cn('px-4 py-3 text-left text-xs font-medium uppercase tracking-wider', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Broker</th>
                      <th className={cn('px-4 py-3 text-left text-xs font-medium uppercase tracking-wider', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Repartidor</th>
                      <th className={cn('px-4 py-3 text-left text-xs font-medium uppercase tracking-wider', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Monto</th>
                      <th className={cn('px-4 py-3 text-left text-xs font-medium uppercase tracking-wider', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Fecha Límite</th>
                      <th className={cn('px-4 py-3 text-left text-xs font-medium uppercase tracking-wider', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Estado</th>
                      <th className={cn('px-4 py-3 text-right text-xs font-medium uppercase tracking-wider', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200')}>
                    {filteredOrders.map(order => {
                      const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
                      const StatusIcon = statusConfig.icon

                      return (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={cn(
                            'transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="px-4 py-4">
                            <p className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {order.order_number}
                            </p>
                            <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                              {new Date(order.created_at).toLocaleDateString('es-ES')}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <Building2 className={cn('h-4 w-4 flex-shrink-0', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                              <div>
                                <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                  {order.broker_company_name || order.broker_name}
                                </p>
                                {order.broker_province && (
                                  <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                    {order.broker_province}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <User className={cn('h-4 w-4 flex-shrink-0', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                              <div>
                                <p className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                  {order.delivery_user_name}
                                </p>
                                <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                                  {order.delivery_user_phone}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className={cn('font-semibold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {order.currency} ${parseFloat(order.total_amount).toLocaleString()}
                            </p>
                            <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                              {order.total_bills} billetes
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <Calendar className={cn('h-4 w-4', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')} />
                              <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
                                {new Date(order.deadline_date + 'T00:00:00').toLocaleDateString('es-ES')}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium',
                              statusConfig.bgColor,
                              statusConfig.color
                            )}>
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => router.push(`/dashboard/admin/brokers/cash-delivery/${order.id}`)}
                                className={cn(
                                  'p-2 rounded-lg transition-colors',
                                  theme === 'dark'
                                    ? 'text-blue-400 hover:bg-blue-900/30'
                                    : 'text-blue-600 hover:bg-blue-50'
                                )}
                                title="Ver detalles"
                              >
                                <Eye className="h-4 w-4" />
                              </motion.button>
                              {['pending', 'in_transit'].includes(order.status) && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleCancel(order)}
                                  className={cn(
                                    'p-2 rounded-lg transition-colors',
                                    theme === 'dark'
                                      ? 'text-red-400 hover:bg-red-900/30'
                                      : 'text-red-600 hover:bg-red-50'
                                  )}
                                  title="Cancelar"
                                >
                                  <XCircle className="h-4 w-4" />
                                </motion.button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={cn(
                'flex items-center justify-between px-4 py-3 border-t',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Página {page} de {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className={cn(
                      'p-2 rounded-lg transition-colors disabled:opacity-50',
                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    )}
                  >
                    <ChevronLeft className={cn('h-4 w-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className={cn(
                      'p-2 rounded-lg transition-colors disabled:opacity-50',
                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    )}
                  >
                    <ChevronRight className={cn('h-4 w-4', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}
