'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, Box, RotateCcw, DollarSign, Calendar, MapPin, CheckCircle, Clock, XCircle } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import LoadingBox from '@/components/ui/LoadingBox'

interface CustomerStats {
  totalOrders: number
  completedOrders: number
  totalSpent: number
  boxesDelivered: number
  boxesReturned: number
  activeReturns: number
}

interface Order {
  id: number
  orderNumber: string
  orderType: string
  status: string
  createdAt: string
  pickupDate: string
  deliveryDate: string
  totalAmount: number
  pickupAddress: string
  deliveryAddress: string
  services: any
  boxesDelivered: number
  boxesReturned: number
  parentOrderId: number | null
}

interface TransactionHistory {
  customer: {
    id: number
    firstName: string
    lastName: string
    phone: string
    email: string
  }
  transactions: {
    packages: Order[]
    boxDeliveries: Order[]
    returns: Order[]
    other: any[]
  }
  stats: CustomerStats
}

export default function CustomerTransactionHistory({
  customerId,
  companyId
}: {
  customerId: number
  companyId: string
}) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TransactionHistory | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'packages' | 'boxes' | 'returns'>('all')

  useEffect(() => {
    fetchTransactionHistory()
  }, [customerId])

  const fetchTransactionHistory = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}/transaction-history`, {
        headers: {
          'x-company-id': companyId
        }
      })

      const result = await response.json()
      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching transaction history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingBox text="Cargando historial..." size="md" />
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        No se pudo cargar el historial de transacciones
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
      completed: { label: 'Completada', color: 'text-green-600 bg-green-100 dark:bg-green-900/30', icon: CheckCircle },
      delivered: { label: 'Entregada', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30', icon: CheckCircle },
      in_transit: { label: 'En Tránsito', color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30', icon: Clock },
      pending: { label: 'Pendiente', color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30', icon: Clock },
      cancelled: { label: 'Cancelada', color: 'text-red-600 bg-red-100 dark:bg-red-900/30', icon: XCircle }
    }

    const config = statusConfig[status] || statusConfig.pending
    const Icon = config.icon

    return (
      <span className={cn('px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1', config.color)}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  const getOrderTypeIcon = (orderType: string) => {
    switch (orderType) {
      case 'entrega_cajas_vacias':
        return <Box className="w-5 h-5 text-purple-600" />
      case 'retorno':
        return <RotateCcw className="w-5 h-5 text-blue-600" />
      default:
        return <Package className="w-5 h-5 text-gray-600" />
    }
  }

  const allOrders = [
    ...data.transactions.packages,
    ...data.transactions.boxDeliveries,
    ...data.transactions.returns
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const getFilteredOrders = () => {
    switch (activeTab) {
      case 'packages':
        return data.transactions.packages
      case 'boxes':
        return data.transactions.boxDeliveries
      case 'returns':
        return data.transactions.returns
      default:
        return allOrders
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-4 rounded-lg border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-500">Total Órdenes</span>
          </div>
          <p className="text-2xl font-bold">{data.stats.totalOrders}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            'p-4 rounded-lg border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-500">Completadas</span>
          </div>
          <p className="text-2xl font-bold">{data.stats.completedOrders}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            'p-4 rounded-lg border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-500">Total Gastado</span>
          </div>
          <p className="text-2xl font-bold">
            ${data.stats.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            'p-4 rounded-lg border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Box className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-500">Cajas Entregadas</span>
          </div>
          <p className="text-2xl font-bold">{data.stats.boxesDelivered}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={cn(
            'p-4 rounded-lg border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-500">Cajas Retornadas</span>
          </div>
          <p className="text-2xl font-bold">{data.stats.boxesReturned}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={cn(
            'p-4 rounded-lg border',
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-gray-500">Retornos Pendientes</span>
          </div>
          <p className="text-2xl font-bold">{data.stats.activeReturns}</p>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-300 dark:border-gray-600">
        {[
          { id: 'all', label: 'Todas', count: allOrders.length },
          { id: 'packages', label: 'Paquetes', count: data.transactions.packages.length },
          { id: 'boxes', label: 'Entrega Cajas', count: data.transactions.boxDeliveries.length },
          { id: 'returns', label: 'Retornos', count: data.transactions.returns.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'px-4 py-2 font-medium transition-colors',
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {getFilteredOrders().length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No hay transacciones en esta categoría
          </div>
        ) : (
          getFilteredOrders().map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'p-4 rounded-lg border',
                theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getOrderTypeIcon(order.orderType)}
                  <div>
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {getStatusBadge(order.status)}
                  {order.totalAmount > 0 && (
                    <p className="text-sm font-semibold text-green-600 mt-1">
                      ${order.totalAmount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {order.pickupAddress && (
                  <div className="flex items-start gap-1">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Recogida:</p>
                      <p className="text-gray-700 dark:text-gray-300">{order.pickupAddress}</p>
                    </div>
                  </div>
                )}
                {order.deliveryAddress && (
                  <div className="flex items-start gap-1">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Entrega:</p>
                      <p className="text-gray-700 dark:text-gray-300">{order.deliveryAddress}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Info adicional para entregas de cajas y retornos */}
              {(order.orderType === 'entrega_cajas_vacias' || order.orderType === 'retorno') && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-4 text-sm">
                    {order.boxesDelivered > 0 && (
                      <div>
                        <span className="text-gray-500">Cajas entregadas:</span>
                        <span className="ml-2 font-semibold">{order.boxesDelivered}</span>
                      </div>
                    )}
                    {order.boxesReturned > 0 && (
                      <div>
                        <span className="text-gray-500">Cajas retornadas:</span>
                        <span className="ml-2 font-semibold">{order.boxesReturned}</span>
                      </div>
                    )}
                    {order.orderType === 'entrega_cajas_vacias' && order.boxesDelivered > order.boxesReturned && (
                      <div>
                        <span className="text-orange-600">Pendientes:</span>
                        <span className="ml-2 font-semibold text-orange-600">
                          {order.boxesDelivered - order.boxesReturned}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
