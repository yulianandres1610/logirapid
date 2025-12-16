'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Send, Search, Plus, Eye, Trash2, RefreshCw,
  ChevronLeft, ChevronRight, DollarSign, Clock,
  CheckCircle, XCircle, AlertCircle, MapPin, Users,
  Banknote, Building2, Phone, User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import LoadingBox from '@/components/ui/LoadingBox'
import { ProtectedRoute } from '@/components/protected-route'

interface RemittanceOrder {
  id: number
  orderNumber: string
  status: string
  paymentStatus: string
  sendAmount: number
  sendCurrency: string
  receiveAmount: number
  receiveCurrency: string
  totalCharged: number
  serviceFee: number
  deliveryFee: number
  recipientName: string
  recipientPhone: string
  recipientProvince: string
  recipientMunicipality: string
  recipientAddress: string
  senderName: string
  senderPhone: string
  sellingCompanyId: number
  sellingCompanyName: string
  brokerCompanyId: number
  brokerCompanyName: string
  soldByName: string
  estimatedDelivery: string
  createdAt: string
  deliveredAt: string
  paymentMethod: string
}

const STATUSES: Record<string, { label: string; color: string; icon: typeof AlertCircle }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle },
  confirmed: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle },
  in_delivery: { label: 'En Entrega', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Send },
  delivered: { label: 'Entregada', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
  rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
}

const PAYMENT_STATUSES: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  paid: { label: 'Pagado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  refunded: { label: 'Reembolsado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
}

export default function CuponesFamiliaresPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()

  const [orders, setOrders] = useState<RemittanceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const ORDERS_PER_PAGE = 25

  // Fetch orders
  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ORDERS_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter })
      })

      console.log('[Cupones Familiares] Fetching orders with params:', params.toString())

      const response = await fetch(`/api/remittance-orders?${params}`)
      const data = await response.json()

      console.log('[Cupones Familiares] API Response:', data)

      if (response.ok && data.success) {
        const ordersData = data.data?.orders || []
        console.log('[Cupones Familiares] Setting orders:', ordersData.length, ordersData)
        setOrders(ordersData)
        setTotalOrders(data.data?.pagination?.total || 0)
        console.log('[Cupones Familiares] Orders loaded:', ordersData.length)
      } else {
        console.error('[Cupones Familiares] API Error:', data.error)
        showNotification('error', 'Error', data.error || 'No se pudieron cargar las remesas')
      }
    } catch (error) {
      console.error('[Cupones Familiares] Error fetching orders:', error)
      showNotification('error', 'Error', 'No se pudieron cargar las remesas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  useEffect(() => {
    fetchData()
  }, [currentPage, searchTerm, statusFilter])

  // Debug: Log render state
  console.log('[Cupones Familiares] RENDER - loading:', loading, 'orders.length:', orders.length)

  // Calculate statistics
  const stats = {
    total: totalOrders,
    pending: orders.filter(o => o.status === 'pending').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    totalAmount: orders.reduce((sum, o) => sum + (o.sendAmount || 0), 0)
  }

  // Handle view order
  const handleViewOrder = (orderId: number) => {
    router.push(`/dashboard/agency-admin/cupones-familiares/${orderId}`)
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        <div className="min-h-screen p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Total de Remesas */}
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
                      <Send className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Total Remesas</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.total}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Cupones familiares</span>
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
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Pendientes</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.pending}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Por entregar</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Entregadas */}
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
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Entregadas</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.delivered}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Completadas</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Monto Total */}
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
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-purple-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-violet-900/30 border border-violet-800/50'
                        : 'bg-gradient-to-br from-violet-50 to-purple-100 border border-violet-200'
                    )}>
                      <DollarSign className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Monto Total</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>${stats.totalAmount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-violet-400 rounded-full"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>En esta vista</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between py-6 px-4 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar por orden, destinatario o remitente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full h-12 pl-10 pr-4 rounded-lg border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm'
                    : 'bg-white border-gray-300 text-black placeholder-gray-500 text-sm'
                )}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={cn(
                  'w-full sm:w-auto h-12 px-4 rounded-lg border transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-white text-sm'
                    : 'bg-white border-gray-300 text-black text-sm'
                )}
              >
                <option value="all">Todos los estados</option>
                {Object.entries(STATUSES).map(([key, status]) => (
                  <option key={key} value={key}>{status.label}</option>
                ))}
              </select>

              <div className="flex gap-3 w-full sm:w-auto">
                <Button
                  onClick={fetchData}
                  className={cn(
                    'flex-1 sm:flex-none items-center justify-center gap-2 h-12',
                    'bg-blue-600 hover:bg-blue-700 text-white font-medium',
                    'rounded-lg transition-all duration-200',
                    'shadow-sm hover:shadow-md',
                    'dark:bg-blue-700 dark:hover:bg-blue-800'
                  )}
                >
                  <RefreshCw className="w-4 h-4" />
                  Actualizar
                </Button>

                <button
                  onClick={() => router.push('/dashboard/agency-admin/cupones-familiares/create')}
                  className={cn(
                    'flex-1 sm:flex-none justify-center whitespace-nowrap',
                    'rounded-lg text-sm font-medium transition-all duration-200',
                    'h-12 bg-green-600 hover:bg-green-700 text-white',
                    'shadow-sm hover:shadow-md',
                    'dark:bg-green-700 dark:hover:bg-green-800',
                    'flex items-center gap-2 px-6'
                  )}
                >
                  <Plus className="w-4 h-4" />
                  Nueva Remesa
                </button>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className={cn(
            'rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            {loading ? (
              <div className="p-8">
                <LoadingBox size="lg" text="Cargando remesas..." />
              </div>
            ) : orders.length === 0 ? (
              <div className="p-8 text-center">
                <Send className="w-12 h-12 mx-auto text-gray-400" />
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {searchTerm || statusFilter !== 'all' ? 'No se encontraron remesas con los filtros aplicados' : 'No hay remesas registradas'}
                </p>
                <Button
                  onClick={() => router.push('/dashboard/agency-admin/cupones-familiares/create')}
                  className="mt-4 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primera Remesa
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn(
                    'border-b border-gray-200 dark:border-gray-700',
                    theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                  )}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Orden
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Destinatario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Ubicacion
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Remitente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Pago
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {orders.map((order) => {
                      const statusInfo = STATUSES[order.status] || STATUSES.pending
                      const paymentInfo = PAYMENT_STATUSES[order.paymentStatus] || PAYMENT_STATUSES.pending
                      const StatusIcon = statusInfo.icon

                      return (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          {/* Orden */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-base font-bold text-black dark:text-white">
                              {order.orderNumber}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {order.createdAt ? new Date(order.createdAt).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              }) : '-'}
                            </div>
                          </td>

                          {/* Destinatario */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-black dark:text-white">
                                  {order.recipientName}
                                </div>
                                {order.recipientPhone && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                    <Phone className="w-3 h-3" />
                                    {order.recipientPhone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Ubicacion */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-black dark:text-white">
                                  {order.recipientMunicipality}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {order.recipientProvince}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Monto */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="font-bold text-green-600 dark:text-green-400">
                              ${order.sendAmount?.toFixed(2)} {order.sendCurrency}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Total: ${order.totalCharged?.toFixed(2)}
                            </div>
                          </td>

                          {/* Remitente */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-black dark:text-white">
                                  {order.senderName}
                                </div>
                                {order.senderPhone && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {order.senderPhone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Pago */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={cn(
                              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                              paymentInfo.color
                            )}>
                              {paymentInfo.label}
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                              statusInfo.color
                            )}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusInfo.label}
                            </span>
                            {order.estimatedDelivery && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {order.estimatedDelivery}
                              </div>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex gap-1 justify-end">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleViewOrder(order.id)}
                                className={cn(
                                  'p-2 rounded-lg transition-all duration-200',
                                  theme === 'dark'
                                    ? 'text-blue-400 hover:bg-blue-900/30'
                                    : 'text-blue-600 hover:bg-blue-50'
                                )}
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4" />
                              </motion.button>
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
            {totalOrders > ORDERS_PER_PAGE && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'p-4 border-t',
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Mostrando {((currentPage - 1) * ORDERS_PER_PAGE) + 1} a{' '}
                    {Math.min(currentPage * ORDERS_PER_PAGE, totalOrders)} de {totalOrders} remesas
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, Math.ceil(totalOrders / ORDERS_PER_PAGE)) }, (_, i) => {
                        const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE)
                        let pageNum

                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn(
                              'w-8 h-8 p-0',
                              currentPage === pageNum && 'bg-blue-600 hover:bg-blue-700'
                            )}
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalOrders / ORDERS_PER_PAGE)}
                      className="flex items-center gap-1"
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
