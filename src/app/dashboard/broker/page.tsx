'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Truck,
  AlertTriangle,
  RefreshCw,
  Activity,
  ChevronRight,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles
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

// Mini Donut Chart Component
function DonutChart({ percentage, size = 80, strokeWidth = 8, color = '#10b981' }: {
  percentage: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-gray-900 dark:text-white">{percentage}%</span>
      </div>
    </div>
  )
}

// Mini Bar Chart Component
function MiniBarChart({ data, maxValue }: { data: { label: string; value: number; color: string }[]; maxValue: number }) {
  return (
    <div className="flex items-end gap-2 h-16">
      {data.map((item, index) => {
        const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0
        return (
          <motion.div
            key={item.label}
            className="flex-1 flex flex-col items-center gap-1"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            transition={{ delay: index * 0.1 }}
          >
            <motion.div
              className="w-full rounded-t-md"
              style={{ backgroundColor: item.color }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(height, 8)}%` }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            />
            <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">
              {item.label}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}

// Progress Ring for Stats
function ProgressRing({ value, max, color, icon: Icon }: {
  value: number
  max: number
  color: string
  icon: any
}) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0

  return (
    <div className="relative w-12 h-12">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-gray-200 dark:text-gray-700"
        />
        <motion.circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={125.6}
          initial={{ strokeDashoffset: 125.6 }}
          animate={{ strokeDashoffset: 125.6 - (125.6 * percentage) / 100 }}
          transition={{ duration: 1 }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
    </div>
  )
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
    const interval = setInterval(() => fetchDashboardData(true), 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const [walletRes, ordersRes, cashRes] = await Promise.all([
        fetch('/api/broker/wallet'),
        fetch('/api/broker/orders?limit=10'),
        fetch('/api/broker/cash-deliveries?includeCompleted=false')
      ])

      if (walletRes.ok) {
        const data = await walletRes.json()
        if (data.success) setWalletData(data.data)
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        if (ordersData.success) {
          setStats(ordersData.data.stats)
          setRecentOrders(ordersData.data.orders || [])
        }
      }

      if (cashRes.ok) {
        const cashData = await cashRes.json()
        if (cashData.success) {
          setCashDeliverySummary(cashData.data.summary)
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
    if (currency === 'CUP') return `${amount.toLocaleString()} CUP`
    return `$${amount.toFixed(2)} ${currency}`
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { bg: string, text: string, icon: any, label: string }> = {
      pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', icon: Clock, label: 'Pendiente' },
      confirmed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: CheckCircle, label: 'Confirmada' },
      in_delivery: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', icon: Truck, label: 'En Entrega' },
      delivered: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle, label: 'Entregada' },
      cancelled: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', icon: AlertTriangle, label: 'Cancelada' }
    }
    return configs[status] || configs.pending
  }

  // Calculate metrics
  const pendingCount = stats?.pending || 0
  const confirmedCount = stats?.confirmed || 0
  const inDeliveryCount = stats?.inDelivery || 0
  const deliveredCount = stats?.delivered || 0
  const totalOrders = stats?.total || 0
  const completionRate = totalOrders > 0 ? Math.round((deliveredCount / totalOrders) * 100) : 0

  // Chart data
  const orderChartData = [
    { label: 'Pend', value: pendingCount, color: '#f59e0b' },
    { label: 'Conf', value: confirmedCount, color: '#3b82f6' },
    { label: 'Entreg', value: inDeliveryCount, color: '#8b5cf6' },
    { label: 'Comp', value: deliveredCount, color: '#10b981' },
  ]
  const maxOrderValue = Math.max(...orderChartData.map(d => d.value), 1)

  // Alerts
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
                <div className="lg:col-span-2 h-56 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                <div className="h-56 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-36 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
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
        <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 min-h-screen">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                {totalAlerts > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-gradient-to-r from-rose-500 to-pink-500 rounded-full shadow-lg shadow-rose-500/30"
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

            <motion.button
              onClick={() => fetchDashboardData()}
              disabled={refreshing}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all text-gray-700 dark:text-gray-300 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </motion.button>
          </div>

          {/* Main Grid - Wallet & Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Wallet Hero Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2"
            >
              <div className={`relative overflow-hidden rounded-3xl p-6 shadow-2xl ${
                hasLowBalance
                  ? 'bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600'
                  : 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500'
              } text-white`}>
                {/* Glassmorphism decorations */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-56 h-56 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-white/5 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />

                {/* Sparkle effects */}
                <motion.div
                  className="absolute top-4 right-20"
                  animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="w-4 h-4 text-white/60" />
                </motion.div>
                <motion.div
                  className="absolute bottom-8 right-32"
                  animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.3, 1] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                >
                  <Sparkles className="w-3 h-3 text-white/40" />
                </motion.div>

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/20">
                        <Wallet className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-white/70 text-sm font-medium">Balance Disponible</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm font-medium">
                            {walletData?.currency || 'USD'}
                          </span>
                          {walletData?.isActive ? (
                            <span className="text-xs flex items-center gap-1.5 text-emerald-200">
                              <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></span>
                              Activo
                            </span>
                          ) : (
                            <span className="text-xs text-rose-200">Inactivo</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {hasLowBalance && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/20 backdrop-blur-sm border border-white/20"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Balance Bajo</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Balance */}
                  <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <p className="text-6xl font-bold tracking-tight drop-shadow-lg">
                      {walletData?.walletBalanceFormatted || '$0.00'}
                    </p>
                  </motion.div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: ArrowDownLeft, label: 'Depositos', value: walletData?.stats?.totalDeposits || 0, iconColor: 'text-emerald-300' },
                      { icon: ArrowUpRight, label: 'Retiros', value: walletData?.stats?.totalWithdrawals || 0, iconColor: 'text-rose-300' },
                      { icon: Activity, label: 'Transacciones', value: walletData?.stats?.totalTransactions || 0, iconColor: 'text-blue-300', isCount: true },
                    ].map((stat, index) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                          <span className="text-white/60 text-xs font-medium">{stat.label}</span>
                        </div>
                        <p className="text-xl font-bold">
                          {stat.isCount ? stat.value : `$${stat.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Performance Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
                    <Target className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Rendimiento</h3>
                </div>
              </div>

              <div className="p-5 space-y-6">
                {/* Completion Rate Donut */}
                <div className="flex items-center justify-center">
                  <DonutChart
                    percentage={completionRate}
                    size={100}
                    strokeWidth={10}
                    color={completionRate >= 80 ? '#10b981' : completionRate >= 50 ? '#3b82f6' : '#f59e0b'}
                  />
                </div>
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  Tasa de Completadas
                </p>

                {/* Mini Bar Chart */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Distribución de Órdenes</p>
                  <MiniBarChart data={orderChartData} maxValue={maxOrderValue} />
                </div>

                {/* Stats Mini Grid */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-center p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalOrders}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{deliveredCount}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Completadas</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Alerts Section */}
          <AnimatePresence>
            {totalAlerts > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                {hasLowBalance && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 border border-rose-200 dark:border-rose-800"
                  >
                    <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 shadow-lg shadow-rose-500/30">
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-rose-800 dark:text-rose-200">Balance bajo</p>
                      <p className="text-sm text-rose-600 dark:text-rose-400">Recarga tu wallet</p>
                    </div>
                  </motion.div>
                )}

                {hasPendingOrders && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800"
                  >
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 shadow-lg shadow-amber-500/30">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-amber-800 dark:text-amber-200">{pendingCount} orden{pendingCount > 1 ? 'es' : ''}</p>
                      <p className="text-sm text-amber-600 dark:text-amber-400">Esperando confirmación</p>
                    </div>
                    <Link href="/dashboard/broker/orders">
                      <ChevronRight className="w-5 h-5 text-amber-500" />
                    </Link>
                  </motion.div>
                )}

                {hasUrgentCashDeliveries && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800"
                  >
                    <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/30">
                      <Banknote className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-violet-800 dark:text-violet-200">Efectivo pendiente</p>
                      <p className="text-sm text-violet-600 dark:text-violet-400">{urgentCashDeliveries.length} entrega{urgentCashDeliveries.length > 1 ? 's' : ''}</p>
                    </div>
                    <Link href="/dashboard/broker/cash-deliveries">
                      <ChevronRight className="w-5 h-5 text-violet-500" />
                    </Link>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Pendientes', value: pendingCount, icon: Clock, color: 'amber', gradient: 'from-amber-500 to-yellow-500' },
              { label: 'En Proceso', value: confirmedCount + inDeliveryCount, icon: Truck, color: 'blue', gradient: 'from-blue-500 to-cyan-500' },
              { label: 'Entregadas', value: deliveredCount, icon: CheckCircle, color: 'emerald', gradient: 'from-emerald-500 to-teal-500' },
              { label: 'Efectivo', value: (cashDeliverySummary?.pending || 0) + (cashDeliverySummary?.receiving || 0), icon: Banknote, color: 'violet', gradient: 'from-violet-500 to-purple-500' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 overflow-hidden"
              >
                {/* Hover gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                    {stat.value > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`w-2.5 h-2.5 rounded-full bg-${stat.color}-500 animate-pulse shadow-lg shadow-${stat.color}-500/50`}
                      />
                    )}
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { href: '/dashboard/broker/orders', title: 'Órdenes de Remesas', subtitle: 'Gestionar entregas', icon: Package, gradient: 'from-blue-500 via-blue-600 to-cyan-500', badge: pendingCount > 0 ? `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}` : null },
              { href: '/dashboard/broker/cash-deliveries', title: 'Entregas de Efectivo', subtitle: 'Recibir cash', icon: Banknote, gradient: 'from-violet-500 via-purple-500 to-fuchsia-500', badge: ((cashDeliverySummary?.pending || 0) + (cashDeliverySummary?.receiving || 0) + (cashDeliverySummary?.validating || 0)) > 0 ? `${(cashDeliverySummary?.pending || 0) + (cashDeliverySummary?.receiving || 0) + (cashDeliverySummary?.validating || 0)} activa${((cashDeliverySummary?.pending || 0) + (cashDeliverySummary?.receiving || 0) + (cashDeliverySummary?.validating || 0)) > 1 ? 's' : ''}` : null },
              { href: '/dashboard/broker/wallet', title: 'Mi Wallet', subtitle: 'Balance y movimientos', icon: Wallet, gradient: 'from-emerald-500 via-teal-500 to-cyan-500', badge: walletData?.walletBalanceFormatted || '$0.00' },
            ].map((action, index) => (
              <Link key={action.href} href={action.href}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative overflow-hidden bg-gradient-to-br ${action.gradient} rounded-2xl p-6 text-white cursor-pointer shadow-xl hover:shadow-2xl transition-all duration-300`}
                >
                  {/* Glassmorphism decorations */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />

                  <div className="relative flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{action.title}</h3>
                      <p className="text-white/70 text-sm mt-1">{action.subtitle}</p>
                      {action.badge && (
                        <span className="inline-flex items-center gap-1.5 mt-3 text-xs px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm font-medium">
                          <Zap className="w-3 h-3" /> {action.badge}
                        </span>
                      )}
                    </div>
                    <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm">
                      <action.icon className="w-8 h-8" />
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>

          {/* Recent Orders & Cash Deliveries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
                    <Package className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Órdenes Recientes</h2>
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
                              {new Date(order.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No hay órdenes recientes</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Las nuevas órdenes aparecerán aquí</p>
                </div>
              )}
            </motion.div>

            {/* Pending Cash Deliveries */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500">
                    <Banknote className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Entregas de Efectivo</h2>
                </div>
                <Link
                  href="/dashboard/broker/cash-deliveries"
                  className="text-violet-600 hover:text-violet-700 text-sm flex items-center gap-1 font-medium"
                >
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Cash Delivery Summary */}
              <div className="grid grid-cols-4 gap-2 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-700/30">
                {[
                  { label: 'Pendientes', value: cashDeliverySummary?.pending || 0, color: 'text-amber-600 dark:text-amber-400' },
                  { label: 'Recibiendo', value: cashDeliverySummary?.receiving || 0, color: 'text-blue-600 dark:text-blue-400' },
                  { label: 'Validando', value: cashDeliverySummary?.validating || 0, color: 'text-violet-600 dark:text-violet-400' },
                  { label: 'Completadas', value: cashDeliverySummary?.completed || 0, color: 'text-emerald-600 dark:text-emerald-400' },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                  </div>
                ))}
              </div>

              {urgentCashDeliveries.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {urgentCashDeliveries.map((delivery, index) => {
                    const isValidating = delivery.status === 'validating'
                    const isReceiving = delivery.status === 'pending_reception'

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
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                                  <Zap className="w-3 h-3" /> OTP
                                </span>
                              )}
                              {isReceiving && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
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
                                isValidating ? 'text-violet-600 hover:text-violet-700' : 'text-blue-600 hover:text-blue-700'
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
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Banknote className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No hay entregas pendientes</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Las entregas aparecerán aquí</p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
