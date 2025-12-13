'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Phone,
  User,
  Calendar,
  DollarSign,
  Truck,
  Search,
  Filter,
  ChevronDown,
  Eye,
  Play,
  Check,
  X,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

interface Order {
  id: number
  orderNumber: string
  status: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  recipientProvince: string
  recipientMunicipality: string
  recipientIdNumber: string
  senderName: string
  senderPhone: string
  receiveAmount: number
  receiveCurrency: string
  estimatedDelivery: string
  createdAt: string
  confirmedAt: string | null
  deliveredAt: string | null
}

interface Stats {
  pending: number
  confirmed: number
  inDelivery: number
  delivered: number
  cancelled: number
  total: number
}

export default function BrokerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [selectedStatus])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedStatus) params.append('status', selectedStatus)
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/broker/orders?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrders(data.data.orders || [])
          setStats(data.data.stats)
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (orderId: number, action: string) => {
    setActionLoading(orderId)
    try {
      const response = await fetch('/api/broker/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          fetchOrders()
          setSelectedOrder(null)
        } else {
          alert(data.error || 'Error al procesar la accion')
        }
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al procesar la accion')
    } finally {
      setActionLoading(null)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'CUP') {
      return `${amount.toLocaleString()} CUP`
    }
    return `$${amount.toFixed(2)} ${currency}`
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

  const getAvailableActions = (status: string) => {
    const actions: Record<string, { action: string, label: string, icon: any, color: string }[]> = {
      pending: [
        { action: 'accept', label: 'Aceptar', icon: Check, color: 'bg-blue-600 hover:bg-blue-700' },
        { action: 'cancel', label: 'Rechazar', icon: X, color: 'bg-red-600 hover:bg-red-700' }
      ],
      confirmed: [
        { action: 'start_delivery', label: 'Iniciar Entrega', icon: Truck, color: 'bg-purple-600 hover:bg-purple-700' },
        { action: 'cancel', label: 'Cancelar', icon: X, color: 'bg-red-600 hover:bg-red-700' }
      ],
      in_delivery: [
        { action: 'complete', label: 'Marcar Entregada', icon: CheckCircle, color: 'bg-green-600 hover:bg-green-700' },
        { action: 'cancel', label: 'Cancelar', icon: X, color: 'bg-red-600 hover:bg-red-700' }
      ]
    }
    return actions[status] || []
  }

  const filteredOrders = orders.filter(order => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      order.orderNumber.toLowerCase().includes(search) ||
      order.recipientName.toLowerCase().includes(search) ||
      order.recipientPhone.includes(search)
    )
  })

  const statusTabs = [
    { value: '', label: 'Todas', count: stats?.total || 0 },
    { value: 'pending', label: 'Pendientes', count: stats?.pending || 0 },
    { value: 'confirmed', label: 'Confirmadas', count: stats?.confirmed || 0 },
    { value: 'in_delivery', label: 'En Entrega', count: stats?.inDelivery || 0 },
    { value: 'delivered', label: 'Entregadas', count: stats?.delivered || 0 }
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Ordenes de Remesas
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gestiona las entregas asignadas a tu zona
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

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              selectedStatus === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {tab.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              selectedStatus === tab.value
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por numero de orden, nombre o telefono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-xl"></div>
          ))}
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map((order, index) => {
            const statusConfig = getStatusConfig(order.status)
            const StatusIcon = statusConfig.icon
            const actions = getAvailableActions(order.status)

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Order Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {order.orderNumber}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.bg} ${statusConfig.text}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900 dark:text-white">
                        {formatCurrency(order.receiveAmount, order.receiveCurrency)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Entrega: {order.estimatedDelivery}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order Body */}
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Recipient Info */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Destinatario
                      </h4>
                      <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{order.recipientName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{order.recipientPhone}</span>
                      </div>
                      <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p>{order.recipientAddress}</p>
                          <p className="text-sm">{order.recipientMunicipality}, {order.recipientProvince}</p>
                        </div>
                      </div>
                      {order.recipientIdNumber && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          CI: {order.recipientIdNumber}
                        </p>
                      )}
                    </div>

                    {/* Sender Info & Dates */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Remitente
                      </h4>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>{order.senderName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{order.senderPhone}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>Creada: {new Date(order.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {actions.length > 0 && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      {actions.map(({ action, label, icon: Icon, color }) => (
                        <button
                          key={action}
                          onClick={() => handleAction(order.id, action)}
                          disabled={actionLoading === order.id}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors ${color} disabled:opacity-50`}
                        >
                          {actionLoading === order.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-12 text-center"
        >
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No hay ordenes
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {selectedStatus
              ? `No hay ordenes ${statusTabs.find(t => t.value === selectedStatus)?.label.toLowerCase()}`
              : 'No tienes ordenes asignadas en este momento'}
          </p>
        </motion.div>
      )}
    </div>
  )
}
