'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Send,
  User,
  Phone,
  MapPin,
  DollarSign,
  Calendar,
  Package,
  Truck,
  Building2,
  ArrowRight,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'

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
  recipientAddress: string | null
  senderName: string
  senderPhone: string | null
  sellingCompanyName: string
  brokerCompanyId: number | null
  brokerCompanyName: string | null
  soldByName: string
  estimatedDelivery: string
  createdAt: string
  deliveredAt: string | null
  paymentMethod: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'yellow', icon: Clock },
  confirmed: { label: 'Confirmada', color: 'blue', icon: CheckCircle },
  in_delivery: { label: 'En Entrega', color: 'purple', icon: Truck },
  delivered: { label: 'Entregada', color: 'green', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'red', icon: XCircle },
  rejected: { label: 'Rechazada', color: 'red', icon: AlertCircle }
}

export default function RemittanceOrdersPage() {
  const { theme } = useTheme()
  const [orders, setOrders] = useState<RemittanceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedOrder, setSelectedOrder] = useState<RemittanceOrder | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      if (searchQuery) params.append('search', searchQuery)
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/remittance-orders?${params}`)
      const data = await response.json()

      if (data.success && data.data) {
        setOrders(data.data.orders || [])
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total,
          totalPages: data.data.pagination.totalPages
        }))
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [pagination.page, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (pagination.page === 1) fetchOrders()
      else setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
    const Icon = config.icon
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        config.color === 'yellow' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
        config.color === 'blue' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        config.color === 'purple' && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        config.color === 'green' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        config.color === 'red' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      )}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    )
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'CUP') return `${amount.toLocaleString()} CUP`
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Órdenes de Remesas
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Seguimiento de todas las remesas enviadas
              </p>
            </div>
            <Button
              onClick={() => window.location.href = '/dashboard/agency-admin/remittance'}
              className="bg-exa-primary hover:bg-exa-primary/90 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              Nueva Remesa
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por número, destinatario o remitente..."
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-exa-primary focus:border-transparent",
                  theme === 'dark'
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                    : "bg-white border-gray-200 text-gray-900 placeholder-gray-400"
                )}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn(
                "px-4 py-2.5 rounded-xl border focus:ring-2 focus:ring-exa-primary focus:border-transparent",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-200 text-gray-900"
              )}
            >
              <option value="">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="confirmed">Confirmada</option>
              <option value="in_delivery">En Entrega</option>
              <option value="delivered">Entregada</option>
              <option value="cancelled">Cancelada</option>
              <option value="rejected">Rechazada</option>
            </select>

            <Button variant="outline" onClick={fetchOrders} className="gap-2">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Actualizar
            </Button>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total', value: pagination.total, color: 'blue' },
              { label: 'Pendientes', value: orders.filter(o => o.status === 'pending').length, color: 'yellow' },
              { label: 'En Entrega', value: orders.filter(o => o.status === 'in_delivery').length, color: 'purple' },
              { label: 'Entregadas', value: orders.filter(o => o.status === 'delivered').length, color: 'green' }
            ].map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "p-4 rounded-xl border",
                  theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                )}
              >
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className={cn(
                  "text-2xl font-bold",
                  stat.color === 'blue' && "text-blue-600 dark:text-blue-400",
                  stat.color === 'yellow' && "text-yellow-600 dark:text-yellow-400",
                  stat.color === 'purple' && "text-purple-600 dark:text-purple-400",
                  stat.color === 'green' && "text-green-600 dark:text-green-400"
                )}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Orders List */}
          <div className={cn(
            "rounded-xl border overflow-hidden",
            theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            {loading ? (
              <div className="p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-exa-primary" />
              </div>
            ) : orders.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No hay órdenes de remesas</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Las nuevas órdenes aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {orders.map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      "p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer",
                    )}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono font-semibold text-exa-primary">
                            {order.orderNumber}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <User className="w-4 h-4" />
                            {order.recipientName}
                          </span>
                          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <MapPin className="w-4 h-4" />
                            {order.recipientMunicipality}, {order.recipientProvince}
                          </span>
                          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                            <Calendar className="w-4 h-4" />
                            {formatDate(order.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900 dark:text-white">
                            {formatCurrency(order.receiveAmount, order.receiveCurrency)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Enviado: {formatCurrency(order.sendAmount, order.sendCurrency)}
                          </p>
                        </div>
                        {order.brokerCompanyName ? (
                          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
                              {order.brokerCompanyName}
                            </span>
                          </div>
                        ) : (
                          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm text-yellow-700 dark:text-yellow-400">
                              Sin broker
                            </span>
                          </div>
                        )}
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                Anterior
              </Button>
              <span className="flex items-center px-4 text-sm text-gray-500">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                Siguiente
              </Button>
            </div>
          )}

          {/* Order Detail Modal */}
          <AnimatePresence>
            {selectedOrder && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setSelectedOrder(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto",
                    theme === 'dark' ? "bg-gray-800" : "bg-white"
                  )}
                >
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {selectedOrder.orderNumber}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(selectedOrder.createdAt)}
                        </p>
                      </div>
                      {getStatusBadge(selectedOrder.status)}
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Amounts */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className={cn(
                        "p-4 rounded-xl",
                        theme === 'dark' ? "bg-gray-700" : "bg-gray-50"
                      )}>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Enviado</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(selectedOrder.sendAmount, selectedOrder.sendCurrency)}
                        </p>
                      </div>
                      <div className={cn(
                        "p-4 rounded-xl bg-green-50 dark:bg-green-900/20"
                      )}>
                        <p className="text-sm text-green-600 dark:text-green-400">A recibir</p>
                        <p className="text-xl font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(selectedOrder.receiveAmount, selectedOrder.receiveCurrency)}
                        </p>
                      </div>
                    </div>

                    {/* Recipient */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Destinatario
                      </h4>
                      <div className={cn(
                        "p-4 rounded-xl space-y-2",
                        theme === 'dark' ? "bg-gray-700" : "bg-gray-50"
                      )}>
                        <p className="font-medium">{selectedOrder.recipientName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {selectedOrder.recipientPhone}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {selectedOrder.recipientMunicipality}, {selectedOrder.recipientProvince}
                        </p>
                        {selectedOrder.recipientAddress && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedOrder.recipientAddress}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Sender */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                        Remitente
                      </h4>
                      <div className={cn(
                        "p-4 rounded-xl",
                        theme === 'dark' ? "bg-gray-700" : "bg-gray-50"
                      )}>
                        <p className="font-medium">{selectedOrder.senderName}</p>
                        {selectedOrder.senderPhone && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedOrder.senderPhone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Broker */}
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Broker Asignado
                      </h4>
                      <div className={cn(
                        "p-4 rounded-xl",
                        selectedOrder.brokerCompanyName
                          ? theme === 'dark' ? "bg-gray-700" : "bg-gray-50"
                          : "bg-yellow-50 dark:bg-yellow-900/20"
                      )}>
                        {selectedOrder.brokerCompanyName ? (
                          <p className="font-medium">{selectedOrder.brokerCompanyName}</p>
                        ) : (
                          <p className="text-yellow-700 dark:text-yellow-400">
                            Sin broker asignado - Pendiente de asignación manual
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Comisión de servicio:</span>
                        <span>{formatCurrency(selectedOrder.serviceFee, selectedOrder.sendCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tarifa de entrega:</span>
                        <span>{formatCurrency(selectedOrder.deliveryFee, selectedOrder.sendCurrency)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-600">
                        <span>Total cobrado:</span>
                        <span>{formatCurrency(selectedOrder.totalCharged, selectedOrder.sendCurrency)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setSelectedOrder(null)}
                    >
                      Cerrar
                    </Button>
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
