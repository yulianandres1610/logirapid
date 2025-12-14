'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  Package,
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MapPin,
  Bell,
  ArrowRight,
  Banknote,
  Users,
  Truck,
  AlertTriangle,
  RefreshCw,
  Activity,
  Calendar,
  ChevronRight,
  Zap,
  Target,
  Timer,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  BarChart3,
  PieChart
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
  cancelled: number
  total: number
  pendingAmount?: number
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

interface CashDeliverySummary {
  pending: number
  receiving: number
  validating: number
  completed: number
}

interface CashDelivery {
  id: number
  order_number: string
  delivery_user_name: string
  currency: string
  total_amount: number
  status: string
  deadline_date: string
}

export default function BrokerDashboardPage() {
  const { user } = useAuth()
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [cashDeliverySummary, setCashDeliverySummary] = useState<CashDeliverySummary | null>(null)
  const [urgentCashDeliveries, setUrgentCashDeliveries] = useState<CashDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDashboardData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchDashboardData(true), 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      // Fetch all data in parallel
      const [walletRes, ordersRes, cashRes] = await Promise.all([
        fetch('/api/broker/wallet'),
        fetch('/api/broker/orders?limit=10'),
        fetch('/api/broker/cash-deliveries?includeCompleted=false')
      ])

      // Process wallet data
      if (walletRes.ok) {
        const data = await walletRes.json()
        if (data.success) {
          setWalletData(data.data)
        }
      }

      // Process orders data
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        if (ordersData.success) {
          setStats(ordersData.data.stats)
          setRecentOrders(ordersData.data.orders || [])
        }
      }

      // Process cash deliveries data
      if (cashRes.ok) {
        const cashData = await cashRes.json()
        if (cashData.success) {
          setCashDeliverySummary(cashData.data.summary)
          // Get urgent deliveries (validating or pending_reception status)
          const urgent = (cashData.data.deliveries || [])
            .filter((d: CashDelivery) => ['validating', 'pending_reception', 'in_transit'].includes(d.status))
            .slice(0, 3)
          setUrgentCashDeliveries(urgent)
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
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
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: Clock, label: 'Pendiente' },
      confirmed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: CheckCircle, label: 'Confirmada' },
      in_delivery: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: Truck, label: 'En Entrega' },
      delivered: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: CheckCircle, label: 'Entregada' },
      cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: AlertTriangle, label: 'Cancelada' }
    }
    return configs[status] || configs.pending
  }

  // Calculate metrics
  const pendingCount = stats?.pending || 0
  const activeCount = (stats?.confirmed || 0) + (stats?.inDelivery || 0)
  const deliveredCount = stats?.delivered || 0
  const totalOrders = stats?.total || 0
  const completionRate = totalOrders > 0 ? Math.round((deliveredCount / totalOrders) * 100) : 0

  // Check for alerts
  const hasLowBalance = (walletData?.walletBalance || 0) < 100
  const hasUrgentCashDeliveries = urgentCashDeliveries.length > 0
  const hasPendingOrders = pendingCount > 0
  const totalAlerts = (hasLowBalance ? 1 : 0) + (hasUrgentCashDeliveries ? 1 : 0) + (hasPendingOrders ? 1 : 0)

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3"></div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Dashboard
                </h1>
                {totalAlerts > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full"
                  >
                    {totalAlerts}
                  </motion.span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-gray-500 dark:text-gray-400">
                  {walletData?.companyName || 'Broker'}
                </p>
                {walletData?.municipality && walletData?.province && (
                  <span className="flex items-center gap-1 text-sm text-gray-400 dark:text-gray-500">
                    <MapPin className="w-3 h-3" />
                    {walletData.municipality}, {walletData.province}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => fetchDashboardData()}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors text-gray-700 dark:text-gray-300"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>

          {/* Main Grid - Wallet & Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Wallet Hero Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 relative overflow-hidden"
            >
              <div className={`rounded-2xl p-6 ${hasLowBalance ? 'bg-gradient-to-br from-orange-500 to-red-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'} text-white shadow-xl`}>
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

                <div className="relative">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-white/20 backdrop-blur">
                        <Wallet className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-white/80 text-sm">Balance Disponible</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/20">
                            {walletData?.currency || 'USD'}
                          </span>
                          {walletData?.isActive ? (
                            <span className="text-xs text-green-200 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></span>
                              Activo
                            </span>
                          ) : (
                            <span className="text-xs text-red-200">Inactivo</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {hasLowBalance && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Balance Bajo</span>
                      </div>
                    )}
                  </div>

                  {/* Balance */}
                  <div className="mb-6">
                    <p className="text-5xl font-bold tracking-tight">
                      {walletData?.walletBalanceFormatted || '$0.00'}
                    </p>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white/10 backdrop-blur rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowDownLeft className="w-4 h-4 text-green-300" />
                        <span className="text-white/70 text-xs">Depositos</span>
                      </div>
                      <p className="text-lg font-semibold">
                        ${(walletData?.stats?.totalDeposits || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUpRight className="w-4 h-4 text-orange-300" />
                        <span className="text-white/70 text-xs">Retiros</span>
                      </div>
                      <p className="text-lg font-semibold">
                        ${(walletData?.stats?.totalWithdrawals || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-blue-300" />
                        <span className="text-white/70 text-xs">Transacciones</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {walletData?.stats?.totalTransactions || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Alerts Panel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-gray-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Alertas</h3>
                  </div>
                  {totalAlerts > 0 && (
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium">
                      {totalAlerts} activa{totalAlerts > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {hasLowBalance && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-start gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800"
                    >
                      <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/40">
                        <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-orange-800 dark:text-orange-200 text-sm">Balance bajo</p>
                        <p className="text-xs text-orange-600 dark:text-orange-400">Recarga tu wallet para continuar operando</p>
                      </div>
                    </motion.div>
                  )}

                  {hasPendingOrders && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-start gap-3 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
                    >
                      <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/40">
                        <Package className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-yellow-800 dark:text-yellow-200 text-sm">{pendingCount} orden{pendingCount > 1 ? 'es' : ''} pendiente{pendingCount > 1 ? 's' : ''}</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">Esperando confirmacion</p>
                      </div>
                      <Link href="/dashboard/broker/orders" className="shrink-0">
                        <ChevronRight className="w-5 h-5 text-yellow-500" />
                      </Link>
                    </motion.div>
                  )}

                  {hasUrgentCashDeliveries && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-start gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                    >
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                        <Banknote className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-purple-800 dark:text-purple-200 text-sm">Efectivo por recibir</p>
                        <p className="text-xs text-purple-600 dark:text-purple-400">{urgentCashDeliveries.length} entrega{urgentCashDeliveries.length > 1 ? 's' : ''} pendiente{urgentCashDeliveries.length > 1 ? 's' : ''}</p>
                      </div>
                      <Link href="/dashboard/broker/cash-deliveries" className="shrink-0">
                        <ChevronRight className="w-5 h-5 text-purple-500" />
                      </Link>
                    </motion.div>
                  )}

                  {totalAlerts === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-8 text-center"
                    >
                      <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Todo en orden</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">No hay alertas activas</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Pending */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                {pendingCount > 0 && (
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{pendingCount}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pendientes</p>
            </motion.div>

            {/* In Process */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                {activeCount > 0 && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                )}
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeCount}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">En Proceso</p>
            </motion.div>

            {/* Delivered */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{deliveredCount}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Entregadas</p>
            </motion.div>

            {/* Completion Rate */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{completionRate}%</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Completadas</p>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/broker/orders">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white cursor-pointer shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Ordenes de Remesas</h3>
                    <p className="text-blue-100 text-sm mt-1">Gestionar entregas</p>
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded-full bg-white/20">
                        <Zap className="w-3 h-3" /> {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <Package className="w-12 h-12 text-blue-200" />
                </div>
              </motion.div>
            </Link>

            <Link href="/dashboard/broker/cash-deliveries">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white cursor-pointer shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Entregas de Efectivo</h3>
                    <p className="text-purple-100 text-sm mt-1">Recibir cash</p>
                    {(cashDeliverySummary?.pending || 0) + (cashDeliverySummary?.receiving || 0) + (cashDeliverySummary?.validating || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded-full bg-white/20">
                        <Zap className="w-3 h-3" /> {(cashDeliverySummary?.pending || 0) + (cashDeliverySummary?.receiving || 0) + (cashDeliverySummary?.validating || 0)} activa{((cashDeliverySummary?.pending || 0) + (cashDeliverySummary?.receiving || 0) + (cashDeliverySummary?.validating || 0)) > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <Banknote className="w-12 h-12 text-purple-200" />
                </div>
              </motion.div>
            </Link>

            <Link href="/dashboard/broker/wallet">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white cursor-pointer shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Mi Wallet</h3>
                    <p className="text-emerald-100 text-sm mt-1">Balance y movimientos</p>
                    <span className="inline-flex items-center gap-1 mt-2 text-xs px-2 py-1 rounded-full bg-white/20">
                      {walletData?.walletBalanceFormatted || '$0.00'}
                    </span>
                  </div>
                  <Wallet className="w-12 h-12 text-emerald-200" />
                </div>
              </motion.div>
            </Link>
          </div>

          {/* Recent Orders & Cash Deliveries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">Ordenes Recientes</h2>
                </div>
                <Link
                  href="/dashboard/broker/orders"
                  className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 font-medium"
                >
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {recentOrders.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[400px] overflow-y-auto">
                  {recentOrders.slice(0, 5).map((order, index) => {
                    const statusConfig = getStatusConfig(order.status)
                    const StatusIcon = statusConfig.icon

                    return (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + index * 0.05 }}
                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 dark:text-white text-sm">
                                {order.orderNumber}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusConfig.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                              <span className="truncate">{order.recipientName}</span>
                              <span className="flex items-center gap-1 shrink-0">
                                <MapPin className="w-3 h-3" />
                                {order.recipientMunicipality}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                              {formatCurrency(order.receiveAmount, order.receiveCurrency)}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(order.createdAt).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short'
                              })}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No hay ordenes recientes</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Las nuevas ordenes apareceran aqui</p>
                </div>
              )}
            </motion.div>

            {/* Pending Cash Deliveries */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-gray-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-white">Entregas Pendientes</h2>
                </div>
                <Link
                  href="/dashboard/broker/cash-deliveries"
                  className="text-purple-600 hover:text-purple-700 text-sm flex items-center gap-1 font-medium"
                >
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Cash Delivery Summary */}
              <div className="grid grid-cols-4 gap-2 p-4 bg-gray-50 dark:bg-gray-700/50">
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {cashDeliverySummary?.pending || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pendientes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {cashDeliverySummary?.receiving || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Recibiendo</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {cashDeliverySummary?.validating || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Validando</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {cashDeliverySummary?.completed || 0}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Completadas</p>
                </div>
              </div>

              {urgentCashDeliveries.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {urgentCashDeliveries.map((delivery, index) => {
                    const isValidating = delivery.status === 'validating'
                    const isUrgent = delivery.status === 'pending_reception'

                    return (
                      <motion.div
                        key={delivery.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.55 + index * 0.05 }}
                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 dark:text-white text-sm">
                                {delivery.order_number}
                              </span>
                              {isValidating && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                                  <Zap className="w-3 h-3" /> OTP
                                </span>
                              )}
                              {isUrgent && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                  Recibiendo
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {delivery.delivery_user_name}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                              {delivery.currency} ${parseFloat(String(delivery.total_amount)).toLocaleString()}
                            </p>
                            <Link
                              href="/dashboard/broker/cash-deliveries"
                              className={`inline-flex items-center gap-1 text-xs font-medium mt-1 ${
                                isValidating
                                  ? 'text-orange-600 hover:text-orange-700'
                                  : 'text-purple-600 hover:text-purple-700'
                              }`}
                            >
                              {isValidating ? 'Validar' : 'Recibir'} <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <Banknote className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No hay entregas pendientes</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Las entregas de efectivo apareceran aqui</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
