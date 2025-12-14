'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Wallet,
  Package,
  Clock,
  CheckCircle,
  TrendingUp,
  DollarSign,
  MapPin,
  Bell,
  ArrowRight,
  Banknote,
  Users,
  Truck
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useAuth } from '@/hooks/useAuth'

interface WalletData {
  companyName: string
  walletBalance: number
  walletBalanceFormatted: string
  currency: string
  province: string
  municipality: string
  isActive: boolean
  stats: {
    totalDeposits: number
    totalWithdrawals: number
    totalTransactions: number
  }
}

interface OrderStats {
  pending: number
  confirmed: number
  inDelivery: number
  delivered: number
  total: number
}

interface RecentOrder {
  id: number
  orderNumber: string
  recipientName: string
  recipientProvince: string
  recipientMunicipality: string
  receiveAmount: number
  receiveCurrency: string
  status: string
  createdAt: string
}

export default function BrokerDashboardPage() {
  const { user } = useAuth()
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch wallet data
      const walletRes = await fetch('/api/broker/wallet')
      if (walletRes.ok) {
        const data = await walletRes.json()
        if (data.success) {
          setWalletData(data.data)
        }
      }

      // Fetch orders
      const ordersRes = await fetch('/api/broker/orders?limit=5')
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        if (ordersData.success) {
          setStats(ordersData.data.stats)
          setRecentOrders(ordersData.data.orders || [])
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'CUP') {
      return `${amount.toLocaleString()} CUP`
    }
    return `$${amount.toFixed(2)} ${currency}`
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string, text: string, label: string }> = {
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: 'Pendiente' },
      confirmed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', label: 'Confirmada' },
      in_delivery: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', label: 'En Entrega' },
      delivered: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: 'Entregada' },
      cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: 'Cancelada' }
    }
    const badge = badges[status] || badges.pending
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  const pendingCount = stats?.pending || 0
  const activeCount = (stats?.confirmed || 0) + (stats?.inDelivery || 0)

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dashboard Broker
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {walletData?.companyName || 'Panel de control'}
                {walletData?.municipality && walletData?.province && (
                  <span className="ml-2 text-sm">
                    <MapPin className="w-3 h-3 inline" /> {walletData.municipality}, {walletData.province}
                  </span>
                )}
              </p>
            </div>
            {pendingCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-4 py-2 rounded-full"
              >
                <Bell className="w-4 h-4" />
                <span className="font-medium">{pendingCount} orden{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''}</span>
              </motion.div>
            )}
          </div>

          {/* Main Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Wallet Balance Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-white/20">
                  <Wallet className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">
                  {walletData?.currency || 'USD'}
                </span>
              </div>
              <div>
                <p className="text-green-100 text-sm mb-1">Balance Disponible</p>
                <p className="text-3xl font-bold">
                  {walletData?.walletBalanceFormatted || '$0.00'}
                </p>
              </div>
              <Link href="/dashboard/broker/wallet" className="mt-4 flex items-center gap-1 text-sm text-green-100 hover:text-white transition-colors">
                Ver detalles <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Pending Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Pendientes</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingCount}</p>
              <p className="text-xs text-gray-400 mt-2">Esperando confirmación</p>
            </motion.div>

            {/* Active Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">En Proceso</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeCount}</p>
              <p className="text-xs text-gray-400 mt-2">Confirmadas y en entrega</p>
            </motion.div>

            {/* Completed Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Entregadas</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.delivered || 0}</p>
              <p className="text-xs text-gray-400 mt-2">Completadas exitosamente</p>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/broker/orders">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-5 text-white cursor-pointer shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Ordenes de Remesas</h3>
                    <p className="text-blue-100 text-sm mt-1">Gestionar entregas</p>
                  </div>
                  <Package className="w-10 h-10 text-blue-200" />
                </div>
              </motion.div>
            </Link>

            <Link href="/dashboard/broker/cash-deliveries">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-5 text-white cursor-pointer shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Entregas de Efectivo</h3>
                    <p className="text-purple-100 text-sm mt-1">Recibir cash</p>
                  </div>
                  <Banknote className="w-10 h-10 text-purple-200" />
                </div>
              </motion.div>
            </Link>

            <Link href="/dashboard/broker/wallet">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-5 text-white cursor-pointer shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Mi Wallet</h3>
                    <p className="text-green-100 text-sm mt-1">Ver balance y movimientos</p>
                  </div>
                  <Wallet className="w-10 h-10 text-green-200" />
                </div>
              </motion.div>
            </Link>
          </div>

          {/* Recent Orders */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Ordenes Recientes
              </h2>
              <Link
                href="/dashboard/broker/orders"
                className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
              >
                Ver todas <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {recentOrders.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentOrders.map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {order.orderNumber}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>{order.recipientName}</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {order.recipientMunicipality}, {order.recipientProvince}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(order.receiveAmount, order.receiveCurrency)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(order.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No hay ordenes recientes</p>
                <p className="text-sm text-gray-400 mt-1">Las nuevas ordenes aparecerán aquí</p>
              </div>
            )}
          </motion.div>

          {/* Wallet Stats Summary */}
          {walletData && walletData.stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Depósitos</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      ${walletData.stats.totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <DollarSign className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Retiros</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      ${walletData.stats.totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Transacciones</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      {walletData.stats.totalTransactions}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
