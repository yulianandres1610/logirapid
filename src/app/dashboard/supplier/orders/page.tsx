'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Package,
  Loader2,
  Warehouse,
  Calendar
} from 'lucide-react'

interface Order {
  id: number
  orderNumber: string
  warehouse: {
    id: number
    name: string
    code: string
  }
  status: string
  totalItems: number
  totalUnits: number
  totalCost: number
  totalSold: number
  totalPaid: number
  consignmentDate: string
  receivedAt: string | null
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pendiente', color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  received: { label: 'Recibida', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  selling: { label: 'En Venta', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  paid: { label: 'Pagada', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  returned: { label: 'Devuelta', color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  liquidated: { label: 'Liquidada', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-700' }
}

export default function SupplierOrdersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })

  useEffect(() => {
    fetchOrders()
  }, [filter])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/supplier/orders?status=${filter}`)
      const data = await response.json()

      if (data.success) {
        setOrders(data.data.orders)
        setPagination(data.data.pagination)
      } else if (response.status === 401) {
        router.push('/supplier/login')
      }
    } catch {
      console.error('Error fetching orders')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header - Responsive */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4 md:px-8 md:py-6 lg:px-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-teal-100 dark:bg-teal-900/30 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Mis Ordenes</h1>
              <p className="text-sm text-gray-500">{pagination.total} ordenes en total</p>
            </div>
          </div>

          {/* Filters - Desktop inline */}
          <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 rounded-xl p-1 md:w-auto">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'active', label: 'Activas' },
              { key: 'completed', label: 'Completadas' }
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as typeof filter)}
                className={`flex-1 md:flex-none py-2 px-4 md:px-6 rounded-lg font-medium transition-all ${
                  filter === f.key
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Orders List */}
      <main className="px-4 py-6 md:px-8 lg:px-12 pb-24 md:pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay ordenes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {orders.map((order, index) => {
              const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
              const progress = order.totalCost > 0 ? (order.totalSold / order.totalCost) * 100 : 0

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-mono font-bold text-lg md:text-xl text-gray-900 dark:text-white">
                        {order.orderNumber}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <Warehouse className="w-4 h-4" />
                        {order.warehouse.name}
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Progress bar for active orders */}
                  {['received', 'selling'].includes(order.status) && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-500">Progreso de venta</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(progress, 100)}%` }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                      <p className="text-[10px] md:text-xs text-gray-500 mb-1">Consignado</p>
                      <p className="font-bold text-sm md:text-base text-gray-900 dark:text-white truncate">
                        {formatCurrency(order.totalCost)}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                      <p className="text-[10px] md:text-xs text-gray-500 mb-1">Vendido</p>
                      <p className="font-bold text-sm md:text-base text-green-600 truncate">
                        {formatCurrency(order.totalSold)}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
                      <p className="text-[10px] md:text-xs text-gray-500 mb-1">Pagado</p>
                      <p className="font-bold text-sm md:text-base text-blue-600 truncate">
                        {formatCurrency(order.totalPaid)}
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-1.5 text-xs md:text-sm text-gray-500">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(order.consignmentDate)}
                    </div>
                    <div className="text-xs md:text-sm text-gray-500">
                      {order.totalUnits} uds • {order.totalItems} items
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
