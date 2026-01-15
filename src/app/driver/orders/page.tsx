'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Package,
  Plus,
  Search,
  Filter,
  User,
  MapPin,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'

interface Order {
  id: number
  orderNumber: string
  status: string
  senderName: string
  senderPhone: string
  senderCity: string
  recipientName: string
  recipientCity: string
  totalAmount: number
  createdAt: string
  paymentStatus: string
}

type FilterType = 'all' | 'pending' | 'completed'

export default function DriverOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchOrders = async () => {
    setIsLoading(true)
    setError('')
    try {
      // Get today's date
      const today = new Date().toISOString().split('T')[0]
      const response = await fetch(`/api/driver-app/orders?date=${today}`)
      const data = await response.json()

      if (data.success) {
        setOrders(data.data || [])
      } else {
        setError(data.error || 'Error al cargar ordenes')
      }
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const filteredOrders = orders.filter(order => {
    // Filter by status
    if (filter === 'pending') {
      const pendingStatuses = ['pending', 'pendiente', 'en_proceso', 'en_reparto']
      if (!pendingStatuses.includes(order.status?.toLowerCase())) return false
    }
    if (filter === 'completed') {
      const completedStatuses = ['completada', 'completed', 'pagada', 'entregada']
      if (!completedStatuses.includes(order.status?.toLowerCase())) return false
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        order.orderNumber?.toLowerCase().includes(query) ||
        order.senderName?.toLowerCase().includes(query) ||
        order.recipientName?.toLowerCase().includes(query)
      )
    }

    return true
  })

  const getStatusConfig = (status: string, paymentStatus: string) => {
    const isPaid = paymentStatus === 'pagada' || paymentStatus === 'paid'

    if (isPaid || status?.toLowerCase() === 'completada' || status?.toLowerCase() === 'completed') {
      return {
        label: 'Completada',
        color: 'bg-green-500/20 text-green-400',
        icon: CheckCircle
      }
    }
    if (status?.toLowerCase() === 'en_reparto' || status?.toLowerCase() === 'in_transit') {
      return {
        label: 'En Reparto',
        color: 'bg-yellow-500/20 text-yellow-400',
        icon: Clock
      }
    }
    return {
      label: 'Pendiente',
      color: 'bg-gray-500/20 text-gray-400',
      icon: Clock
    }
  }

  const handleOrderClick = (order: Order) => {
    router.push(`/driver/orders/${order.id}`)
  }

  const handleNewOrder = () => {
    router.push('/driver/orders/new')
  }

  return (
    <div className="pb-20">
      {/* Search and Filter Header */}
      <div className="px-4 pt-4 pb-2 sticky top-14 z-30 bg-gray-900/95 backdrop-blur-lg">
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar orden..."
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:border-exa-primary focus:ring-1 focus:ring-exa-primary transition-all outline-none"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'Todas' },
            { id: 'pending', label: 'Pendientes' },
            { id: 'completed', label: 'Completadas' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as FilterType)}
              className={`
                flex-1 py-2 rounded-xl text-sm font-medium transition-all
                ${filter === tab.id
                  ? 'bg-exa-primary/20 text-exa-primary border border-exa-primary/30'
                  : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:text-white'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 border-4 border-exa-primary/30 border-t-exa-primary rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Cargando ordenes...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-3 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredOrders.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">
              {searchQuery ? 'Sin resultados' : 'Sin ordenes'}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {searchQuery
                ? 'No se encontraron ordenes con ese criterio'
                : 'No tienes ordenes para hoy'}
            </p>
            <button
              onClick={handleNewOrder}
              className="px-4 py-2 bg-exa-primary/20 text-exa-primary rounded-lg hover:bg-exa-primary/30 transition-colors"
            >
              Crear Nueva Orden
            </button>
          </div>
        )}

        {/* Orders List */}
        {!isLoading && !error && filteredOrders.length > 0 && (
          <div className="space-y-3">
            {filteredOrders.map((order, index) => {
              const statusConfig = getStatusConfig(order.status, order.paymentStatus)
              const StatusIcon = statusConfig.icon

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleOrderClick(order)}
                  className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-all active:scale-[0.98]"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-semibold">{order.orderNumber}</h3>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString('es', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${statusConfig.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{statusConfig.label}</span>
                    </div>
                  </div>

                  {/* Sender/Recipient */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{order.senderName}</p>
                        <p className="text-gray-500 text-xs">{order.senderCity}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                        <MapPin className="w-3.5 h-3.5 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">{order.recipientName}</p>
                        <p className="text-gray-500 text-xs">{order.recipientCity}</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                    {order.totalAmount ? (
                      <p className="text-exa-primary font-semibold">
                        ${order.totalAmount.toFixed(2)}
                      </p>
                    ) : (
                      <p className="text-gray-500 text-sm">Sin monto</p>
                    )}
                    <div className="flex items-center gap-1 text-gray-400">
                      <span className="text-sm">Ver Detalles</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* FAB - New Order */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={handleNewOrder}
        className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-r from-exa-primary to-exa-secondary rounded-full shadow-lg shadow-exa-primary/30 flex items-center justify-center z-40"
      >
        <Plus className="w-6 h-6 text-white" />
      </motion.button>
    </div>
  )
}
