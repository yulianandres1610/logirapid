'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  User,
  Building2,
  Calendar,
  DollarSign,
  Truck,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  X
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface Order {
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
  deliveredByName: string | null
  estimatedDelivery: string
  createdAt: string
  confirmedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  paymentMethod: string
  paymentReference: string
}

interface Stats {
  total: number
  pending: number
  confirmed: number
  inDelivery: number
  delivered: number
  cancelled: number
  totalRevenue: number
  totalDelivered: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminBrokerOrdersPage() {
  const { theme } = useTheme()
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchOrders()
  }, [selectedStatus, currentPage])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', currentPage.toString())
      params.append('limit', '20')
      if (selectedStatus) params.append('status', selectedStatus)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/admin/brokers/orders?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrders(data.data.orders || [])
          setStats(data.data.stats)
          setPagination(data.data.pagination)
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchOrders()
  }

  const formatCurrency = (amount: number, currency?: string) => {
    if (currency === 'CUP') {
      return `${amount.toLocaleString()} CUP`
    }
    return `$${amount.toFixed(2)}${currency ? ` ${currency}` : ''}`
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string, text: string, icon: any, label: string }> = {
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', icon: Clock, label: 'Pendiente' },
      confirmed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', icon: CheckCircle, label: 'Confirmada' },
      in_delivery: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', icon: Truck, label: 'En Entrega' },
      delivered: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', icon: CheckCircle, label: 'Entregada' },
      cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', icon: XCircle, label: 'Cancelada' }
    }
    return configs[status] || configs.pending
  }

  const statusTabs = [
    { value: '', label: 'Todas', count: stats?.total || 0 },
    { value: 'pending', label: 'Pendientes', count: stats?.pending || 0 },
    { value: 'confirmed', label: 'Confirmadas', count: stats?.confirmed || 0 },
    { value: 'in_delivery', label: 'En Entrega', count: stats?.inDelivery || 0 },
    { value: 'delivered', label: 'Entregadas', count: stats?.delivered || 0 },
    { value: 'cancelled', label: 'Canceladas', count: stats?.cancelled || 0 }
  ]

  const filteredOrders = orders.filter(order => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      order.orderNumber.toLowerCase().includes(search) ||
      order.recipientName.toLowerCase().includes(search) ||
      order.senderName.toLowerCase().includes(search) ||
      order.brokerCompanyName?.toLowerCase().includes(search) ||
      order.sellingCompanyName?.toLowerCase().includes(search)
    )
  })

  return (
    <DashboardLayout>
      <div className="min-h-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className={cn(
              "text-2xl font-bold",
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Todas las Órdenes de Cupones Familiares
            </h1>
            <p className={cn(
              "mt-1",
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            )}>
              Vista general de todas las órdenes del sistema
            </p>
          </div>
          <Link
            href="/dashboard/admin/brokers"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-all",
              theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-100 shadow-sm'
            )}
          >
            <Building2 className="w-4 h-4" />
            Ver Brokers
          </Link>
        </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-5",
              theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Total Órdenes</p>
                <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.total}</p>
                <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Registradas</p>
              </div>
              <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-50')}>
                <Package className="w-6 h-6 text-blue-500" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-5",
              theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Pendientes</p>
                <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.pending}</p>
                <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Por procesar</p>
              </div>
              <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-50')}>
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-5",
              theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Entregadas</p>
                <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{stats.delivered}</p>
                <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>Completadas</p>
              </div>
              <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-50')}>
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              "relative overflow-hidden rounded-2xl p-5",
              theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Total Entregado</p>
                <p className={cn("text-3xl font-bold mt-1", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatCurrency(stats.totalDelivered)}</p>
                <p className={cn("text-xs mt-2", theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>En remesas</p>
              </div>
              <div className={cn("p-3 rounded-xl", theme === 'dark' ? 'bg-purple-500/20' : 'bg-purple-50')}>
                <DollarSign className="w-6 h-6 text-purple-500" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-purple-400" />
          </motion.div>
        </div>
      )}

      {/* Status Tabs */}
      <div className={cn("flex p-1 rounded-xl", theme === 'dark' ? 'bg-white/5' : 'bg-gray-100')}>
        {statusTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => {
              setSelectedStatus(tab.value)
              setCurrentPage(1)
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              selectedStatus === tab.value
                ? 'bg-blue-600 text-white shadow-sm'
                : theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {tab.label}
            <span className={cn(
              "ml-2 px-2 py-0.5 rounded-full text-xs",
              selectedStatus === tab.value
                ? 'bg-blue-500 text-white'
                : theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por numero, nombre, broker o agencia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className={cn(
              "w-full pl-10 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors",
              theme === 'dark'
                ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500'
                : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400'
            )}
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          Buscar
        </button>
        <button
          onClick={fetchOrders}
          className={cn(
            "px-4 py-3 rounded-xl transition-colors",
            theme === 'dark' ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200'
          )}
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={cn("animate-pulse h-24 rounded-xl", theme === 'dark' ? 'bg-white/5' : 'bg-gray-200')}></div>
          ))}
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className={cn(
          "rounded-2xl overflow-hidden",
          theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
        )}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={cn(theme === 'dark' ? 'bg-white/5' : 'bg-gray-50')}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Orden
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Destinatario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Broker
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Agencia
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Monto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody className={cn("divide-y", theme === 'dark' ? 'divide-white/10' : 'divide-gray-100')}>
                {filteredOrders.map((order, index) => {
                  const statusConfig = getStatusConfig(order.status)
                  const StatusIcon = statusConfig.icon

                  return (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn("transition-colors", theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50')}
                    >
                      <td className="px-4 py-4">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {order.orderNumber}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {order.recipientName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {order.recipientMunicipality}, {order.recipientProvince}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-gray-700 dark:text-gray-300">
                          {order.brokerCompanyName || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-gray-700 dark:text-gray-300">
                          {order.sellingCompanyName || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(order.receiveAmount, order.receiveCurrency)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Cobrado: {formatCurrency(order.totalCharged, order.sendCurrency)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${statusConfig.bg} ${statusConfig.text}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {new Date(order.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(order.createdAt).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className={cn("p-4 border-t flex items-center justify-between", theme === 'dark' ? 'border-white/10' : 'border-gray-100')}>
              <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Mostrando {((currentPage - 1) * pagination.limit) + 1} - {Math.min(currentPage * pagination.limit, pagination.total)} de {pagination.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={cn("px-3 py-1 rounded-lg disabled:opacity-50", theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100')}
                >
                  Anterior
                </button>
                <span className={cn("px-3 py-1", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  {currentPage} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className={cn("px-3 py-1 rounded-lg disabled:opacity-50", theme === 'dark' ? 'bg-white/10 text-white' : 'bg-gray-100')}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn("rounded-2xl p-12 text-center", theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm')}
        >
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No se encontraron ordenes
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm || selectedStatus
              ? 'Intenta con otros filtros de búsqueda'
              : 'No hay órdenes de cupones familiares en el sistema'}
          </p>
        </motion.div>
      )}
      </div>
    </DashboardLayout>
  )
}
