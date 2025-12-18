'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  Package,
  Truck,
  XCircle,
  Eye,
  MoreVertical,
  User,
  Phone,
  MapPin,
  DollarSign,
  AlertTriangle,
  X
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface Order {
  id: number
  orderNumber: string
  customerName: string
  customerPhone: string
  deliveryProvince: string
  deliveryMunicipality: string
  totalAmount: number
  currency: string
  status: string
  estimatedDelivery: string | null
  createdAt: string
  agencyName: string
  lineCount: number
  totalItems: number
}

interface Stats {
  pending: number
  accepted: number
  preparing: number
  ready: number
  inDelivery: number
  delivered: number
  cancelled: number
  totalDeliveredAmount: number
}

const STATUS_CONFIG: { [key: string]: { label: string; color: string; icon: any } } = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  accepted: { label: 'Aceptada', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle },
  preparing: { label: 'Preparando', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: Package },
  ready: { label: 'Lista', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  in_delivery: { label: 'En Reparto', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: Truck },
  delivered: { label: 'Entregada', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', icon: XCircle },
  rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle }
}

export default function MarketOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ pending: 0, accepted: 0, preparing: 0, ready: 0, inDelivery: 0, delivered: 0, cancelled: 0, totalDeliveredAmount: 0 })
  const [activeTab, setActiveTab] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')

  useEffect(() => {
    fetchOrders()
  }, [activeTab])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const statusParam = activeTab !== 'all' ? `&status=${activeTab}` : ''
      const response = await fetch(`/api/market/orders?limit=50${statusParam}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrders(data.data.orders)
          setStats(data.data.stats)
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (orderId: number, action: string, extra?: any) => {
    setActionLoading(true)
    try {
      const response = await fetch(`/api/market/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra })
      })

      const data = await response.json()
      if (data.success) {
        fetchOrders()
        setSelectedOrder(null)
        setShowRejectModal(false)
        setRejectReason('')
        setRejectNotes('')
      } else {
        alert(data.error || 'Error al procesar accion')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar accion')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = () => {
    if (!rejectReason) {
      alert('Seleccione un motivo de rechazo')
      return
    }
    if (selectedOrder) {
      handleAction(selectedOrder.id, 'reject', {
        rejectionReason: rejectReason,
        rejectionNotes: rejectNotes
      })
    }
  }

  const filteredOrders = orders.filter(o =>
    o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.customerPhone.includes(searchTerm)
  )

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const tabs = [
    { id: 'all', label: 'Todas', count: Object.values(stats).reduce((a, b) => typeof b === 'number' ? a + b : a, 0) - stats.totalDeliveredAmount },
    { id: 'pending', label: 'Pendientes', count: stats.pending },
    { id: 'accepted', label: 'Aceptadas', count: stats.accepted },
    { id: 'preparing', label: 'Preparando', count: stats.preparing },
    { id: 'ready', label: 'Listas', count: stats.ready },
    { id: 'delivered', label: 'Entregadas', count: stats.delivered }
  ]

  const rejectionReasons = [
    'Sin stock',
    'Producto no disponible',
    'Error en el pedido',
    'Direccion invalida',
    'Fuera de zona de entrega',
    'Otro'
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Ordenes Recibidas
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Gestiona las ordenes de tus clientes
              </p>
            </div>
            <button
              onClick={fetchOrders}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Preparando</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.preparing}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Listas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.ready}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Vendido</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(stats.totalDeliveredAmount)}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Tabs and Search */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-green-600 dark:bg-green-700 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar ordenes..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-green-600 dark:focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Orders List */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-8 h-8 animate-spin text-green-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Cargando ordenes...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingCart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'No se encontraron ordenes' : 'No hay ordenes registradas'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredOrders.map((order, index) => {
                  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
                  const StatusIcon = statusConfig.icon

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {order.orderNumber}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {order.customerName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {order.customerPhone}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {order.deliveryMunicipality}, {order.deliveryProvince}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                              {order.lineCount} productos ({order.totalItems} items)
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {formatDate(order.createdAt)}
                            </span>
                            {order.agencyName && (
                              <span className="text-gray-500 dark:text-gray-400">
                                via {order.agencyName}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                              {formatCurrency(order.totalAmount)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => router.push(`/dashboard/market/orders/${order.id}`)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="Ver detalles"
                            >
                              <Eye className="w-5 h-5 text-gray-500" />
                            </button>

                            {order.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleAction(order.id, 'accept')}
                                  disabled={actionLoading}
                                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:opacity-90 transition-colors"
                                >
                                  Aceptar
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedOrder(order)
                                    setShowRejectModal(true)
                                  }}
                                  className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}

                            {order.status === 'accepted' && (
                              <button
                                onClick={() => handleAction(order.id, 'prepare')}
                                disabled={actionLoading}
                                className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:opacity-90 transition-colors flex items-center gap-1.5"
                              >
                                <Package className="w-4 h-4" />
                                Preparar
                              </button>
                            )}

                            {order.status === 'preparing' && (
                              <button
                                onClick={() => handleAction(order.id, 'ready')}
                                disabled={actionLoading}
                                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:opacity-90 transition-colors flex items-center gap-1.5"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Marcar Lista
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Reject Modal */}
          <AnimatePresence>
            {showRejectModal && selectedOrder && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowRejectModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md"
                >
                  <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Rechazar Orden
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowRejectModal(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                      Esta accion rechazara la orden <strong>{selectedOrder.orderNumber}</strong> y notificara al cliente.
                    </p>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Motivo del rechazo *
                      </label>
                      <select
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                      >
                        <option value="">Seleccionar motivo...</option>
                        {rejectionReasons.map(reason => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Notas adicionales
                      </label>
                      <textarea
                        value={rejectNotes}
                        onChange={e => setRejectNotes(e.target.value)}
                        placeholder="Detalles adicionales..."
                        rows={3}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent resize-none"
                      />
                    </div>
                  </div>

                  <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                    <button
                      onClick={() => setShowRejectModal(false)}
                      className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={actionLoading || !rejectReason}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:opacity-90 transition-colors font-medium disabled:opacity-50"
                    >
                      {actionLoading ? 'Procesando...' : 'Rechazar Orden'}
                    </button>
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
