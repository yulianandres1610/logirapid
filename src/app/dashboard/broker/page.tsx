'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import {
  Wallet,
  Package,
  Clock,
  CheckCircle,
  MapPin,
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
  ArrowDownLeft
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

// Animated Counter Component
function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
}) {
  const spring = useSpring(0, {
    stiffness: 50,
    damping: 20,
    duration: duration * 1000
  })

  const display = useTransform(spring, (current) => {
    if (decimals > 0) {
      return `${prefix}${current.toFixed(decimals)}${suffix}`
    }
    return `${prefix}${Math.round(current).toLocaleString()}${suffix}`
  })

  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  return <motion.span>{display}</motion.span>
}

// Donut Chart Component
function DonutChart({ percentage, size = 80, strokeWidth = 8 }: {
  percentage: number
  size?: number
  strokeWidth?: number
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
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          className="stroke-[#cc0a46] dark:stroke-[#2a5caa]"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          <AnimatedCounter value={percentage} suffix="%" />
        </span>
      </div>
    </div>
  )
}

// Mini Bar Chart Component
function MiniBarChart({ data, maxValue }: { data: { label: string; value: number }[]; maxValue: number }) {
  return (
    <div className="flex items-end gap-3 h-20">
      {data.map((item, index) => {
        const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0
        return (
          <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-semibold text-gray-900 dark:text-white">
              {item.value}
            </span>
            <motion.div
              className="w-full rounded-t bg-[#cc0a46] dark:bg-[#2a5caa]"
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(height, 8)}%` }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
            />
            <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">
              {item.label}
            </span>
          </div>
        )
      })}
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
      in_delivery: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: Truck, label: 'En Entrega' },
      delivered: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle, label: 'Entregada' },
      cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: AlertTriangle, label: 'Cancelada' }
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
    { label: 'Pend.', value: pendingCount },
    { label: 'Conf.', value: confirmedCount },
    { label: 'Entreg.', value: inDeliveryCount },
    { label: 'Comp.', value: deliveredCount },
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dashboard
              </h1>
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
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>

          {/* Alerts Row */}
          {totalAlerts > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hasLowBalance && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                >
                  <div className="p-2 rounded-lg bg-[#cc0a46] dark:bg-[#2a5caa]">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-800 dark:text-red-200 text-sm">Balance bajo</p>
                    <p className="text-xs text-red-600 dark:text-red-400">Recarga tu wallet</p>
                  </div>
                </motion.div>
              )}

              {hasPendingOrders && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                >
                  <div className="p-2 rounded-lg bg-[#cc0a46] dark:bg-[#2a5caa]">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">{pendingCount} orden{pendingCount > 1 ? 'es' : ''}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">Esperando confirmación</p>
                  </div>
                  <Link href="/dashboard/broker/orders">
                    <ChevronRight className="w-5 h-5 text-amber-500" />
                  </Link>
                </motion.div>
              )}

              {hasUrgentCashDeliveries && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                >
                  <div className="p-2 rounded-lg bg-[#cc0a46] dark:bg-[#2a5caa]">
                    <Banknote className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-purple-800 dark:text-purple-200 text-sm">Efectivo pendiente</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">{urgentCashDeliveries.length} entrega{urgentCashDeliveries.length > 1 ? 's' : ''}</p>
                  </div>
                  <Link href="/dashboard/broker/cash-deliveries">
                    <ChevronRight className="w-5 h-5 text-purple-500" />
                  </Link>
                </motion.div>
              )}
            </div>
          )}

          {/* Main Stats - All Equal Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Balance Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Balance</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                <AnimatedCounter
                  value={walletData?.walletBalance || 0}
                  prefix="$"
                  decimals={2}
                />
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {walletData?.currency || 'USD'} disponible
              </p>
            </motion.div>

            {/* Pending Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Pendientes</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                <AnimatedCounter value={pendingCount} />
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Por confirmar
              </p>
            </motion.div>

            {/* In Process Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">En Proceso</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                <AnimatedCounter value={confirmedCount + inDeliveryCount} />
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Activas
              </p>
            </motion.div>

            {/* Delivered Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Entregadas</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                <AnimatedCounter value={deliveredCount} />
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Completadas
              </p>
            </motion.div>
          </div>

          {/* Second Row - Wallet Stats & Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Deposits Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <ArrowDownLeft className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Depósitos</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                <AnimatedCounter
                  value={walletData?.stats?.totalDeposits || 0}
                  prefix="$"
                  decimals={0}
                />
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Total acumulado
              </p>
            </motion.div>

            {/* Withdrawals Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <ArrowUpRight className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Retiros</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                <AnimatedCounter
                  value={walletData?.stats?.totalWithdrawals || 0}
                  prefix="$"
                  decimals={0}
                />
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Total acumulado
              </p>
            </motion.div>

            {/* Transactions Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Transacciones</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                <AnimatedCounter value={walletData?.stats?.totalTransactions || 0} />
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Movimientos totales
              </p>
            </motion.div>
          </div>

          {/* Performance & Chart Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Tasa de Completadas</span>
              </div>
              <div className="flex items-center justify-between">
                <DonutChart percentage={completionRate} size={100} strokeWidth={10} />
                <div className="text-right">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Total</p>
                      <p className="font-bold text-gray-900 dark:text-white">
                        <AnimatedCounter value={totalOrders} />
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">Completadas</p>
                      <p className="font-bold text-[#cc0a46] dark:text-[#2a5caa]">
                        <AnimatedCounter value={deliveredCount} />
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Orders Chart Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Distribución de Órdenes</span>
              </div>
              <MiniBarChart data={orderChartData} maxValue={maxOrderValue} />
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/broker/orders">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-[#cc0a46] dark:bg-[#2a5caa] rounded-xl p-5 text-white cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Órdenes de Remesas</h3>
                    <p className="text-white/70 text-sm mt-1">Gestionar entregas</p>
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 mt-3 text-xs px-3 py-1.5 rounded-full bg-white/20 font-medium">
                        <Zap className="w-3 h-3" /> {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <Package className="w-10 h-10 text-white/50" />
                </div>
              </motion.div>
            </Link>

            <Link href="/dashboard/broker/cash-deliveries">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-[#cc0a46] dark:bg-[#2a5caa] rounded-xl p-5 text-white cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Entregas de Efectivo</h3>
                    <p className="text-white/70 text-sm mt-1">Recibir cash</p>
                    {((cashDeliverySummary?.pending || 0) + (cashDeliverySummary?.receiving || 0)) > 0 && (
                      <span className="inline-flex items-center gap-1.5 mt-3 text-xs px-3 py-1.5 rounded-full bg-white/20 font-medium">
                        <Zap className="w-3 h-3" /> {(cashDeliverySummary?.pending || 0) + (cashDeliverySummary?.receiving || 0)} activa{((cashDeliverySummary?.pending || 0) + (cashDeliverySummary?.receiving || 0)) > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <Banknote className="w-10 h-10 text-white/50" />
                </div>
              </motion.div>
            </Link>

            <Link href="/dashboard/broker/wallet">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-[#cc0a46] dark:bg-[#2a5caa] rounded-xl p-5 text-white cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Mi Wallet</h3>
                    <p className="text-white/70 text-sm mt-1">Balance y movimientos</p>
                    <span className="inline-flex items-center gap-1.5 mt-3 text-xs px-3 py-1.5 rounded-full bg-white/20 font-medium">
                      {walletData?.walletBalanceFormatted || '$0.00'}
                    </span>
                  </div>
                  <Wallet className="w-10 h-10 text-white/50" />
                </div>
              </motion.div>
            </Link>
          </div>

          {/* Recent Orders & Cash Deliveries */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#cc0a46] dark:bg-[#2a5caa]">
                    <Package className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Órdenes Recientes</h2>
                </div>
                <Link
                  href="/dashboard/broker/orders"
                  className="text-[#cc0a46] dark:text-[#2a5caa] text-sm flex items-center gap-1 font-medium hover:underline"
                >
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {recentOrders.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[350px] overflow-y-auto">
                  {recentOrders.slice(0, 5).map((order, index) => {
                    const statusConfig = getStatusConfig(order.status)
                    const StatusIcon = statusConfig.icon

                    return (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.65 + index * 0.05 }}
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
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Package className="w-7 h-7 text-gray-400" />
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
              transition={{ delay: 0.65 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#cc0a46] dark:bg-[#2a5caa]">
                    <Banknote className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">Entregas de Efectivo</h2>
                </div>
                <Link
                  href="/dashboard/broker/cash-deliveries"
                  className="text-[#cc0a46] dark:text-[#2a5caa] text-sm flex items-center gap-1 font-medium hover:underline"
                >
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-4 gap-2 p-4 bg-gray-50 dark:bg-gray-700/50">
                {[
                  { label: 'Pend.', value: cashDeliverySummary?.pending || 0 },
                  { label: 'Recib.', value: cashDeliverySummary?.receiving || 0 },
                  { label: 'Valid.', value: cashDeliverySummary?.validating || 0 },
                  { label: 'Comp.', value: cashDeliverySummary?.completed || 0 },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className="text-xl font-bold text-[#cc0a46] dark:text-[#2a5caa]">
                      <AnimatedCounter value={item.value} />
                    </p>
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
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + index * 0.05 }}
                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900 dark:text-white text-sm">
                                {delivery.order_number}
                              </span>
                              {isValidating && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
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
                              className="inline-flex items-center gap-1 text-xs font-medium mt-1 text-[#cc0a46] dark:text-[#2a5caa] hover:underline"
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
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <Banknote className="w-7 h-7 text-gray-400" />
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
