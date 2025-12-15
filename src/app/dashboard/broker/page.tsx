'use client'

import { useEffect, useState } from 'react'
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
  TrendingUp,
  TrendingDown,
  Eye,
  Shield,
  Zap,
  Calendar,
  User,
  DollarSign,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

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
  decimals = 0
}: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const spring = useSpring(0, { stiffness: 50, damping: 20 })
  const display = useTransform(spring, (current) => {
    if (decimals > 0) return `${prefix}${current.toFixed(decimals)}${suffix}`
    return `${prefix}${Math.round(current).toLocaleString()}${suffix}`
  })

  useEffect(() => {
    spring.set(value)
  }, [value, spring])

  return <motion.span>{display}</motion.span>
}

// Circular Progress
function CircularProgress({ value, max, size = 120 }: { value: number; max: number; size?: number }) {
  const percentage = max > 0 ? (value / max) * 100 : 0
  const strokeWidth = 10
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          <AnimatedCounter value={value} />
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">de {max}</span>
      </div>
    </div>
  )
}

export default function BrokerDashboardPage() {
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [cashDeliveries, setCashDeliveries] = useState<CashDelivery[]>([])
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
        fetch('/api/broker/orders?limit=5'),
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
          const pending = (cashData.data.deliveries || [])
            .filter((d: CashDelivery) => !['completed', 'cancelled'].includes(d.status))
          setCashDeliveries(pending)
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

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; label: string }> = {
      pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Pendiente' },
      confirmed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Confirmada' },
      in_delivery: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'En Entrega' },
      delivered: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Entregada' },
      validating: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'Validando OTP' },
      pending_reception: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Recibiendo' },
      in_transit: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'En Tránsito' }
    }
    return configs[status] || configs.pending
  }

  // Metrics
  const pendingCount = stats?.pending || 0
  const activeCount = (stats?.confirmed || 0) + (stats?.inDelivery || 0)
  const deliveredCount = stats?.delivered || 0
  const totalOrders = stats?.total || 0
  const completionRate = totalOrders > 0 ? Math.round((deliveredCount / totalOrders) * 100) : 0

  // Alerts
  const hasLowBalance = (walletData?.walletBalance || 0) < 100
  const hasPendingCash = cashDeliveries.length > 0
  const hasPendingOrders = pendingCount > 0

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl lg:col-span-2"></div>
                <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
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
          {/* Hero Wallet Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#cc0a46] to-[#8b0731] dark:from-[#2a5caa] dark:to-[#1a3d6e] p-6 text-white"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-white/20"></div>
              <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-white/10"></div>
            </div>

            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                {/* Left: Balance Info */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-white/70 text-sm font-medium">Balance Disponible</p>
                      <p className="text-3xl lg:text-4xl font-bold">
                        <AnimatedCounter value={walletData?.walletBalance || 0} prefix="$" decimals={2} />
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5 text-white/80">
                      <MapPin className="w-4 h-4" />
                      {walletData?.municipality || 'Sin ubicación'}, {walletData?.province || ''}
                    </span>
                    {walletData?.isActive ? (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/30 text-green-100 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                        Activo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/30 text-red-100 text-xs">
                        Inactivo
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Quick Stats */}
                <div className="flex gap-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-green-300 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs">Depósitos</span>
                    </div>
                    <p className="text-xl font-bold">
                      <AnimatedCounter value={walletData?.stats?.totalDeposits || 0} prefix="$" />
                    </p>
                  </div>
                  <div className="w-px bg-white/20"></div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-red-300 mb-1">
                      <TrendingDown className="w-4 h-4" />
                      <span className="text-xs">Retiros</span>
                    </div>
                    <p className="text-xl font-bold">
                      <AnimatedCounter value={walletData?.stats?.totalWithdrawals || 0} prefix="$" />
                    </p>
                  </div>
                  <div className="w-px bg-white/20"></div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-blue-300 mb-1">
                      <BarChart3 className="w-4 h-4" />
                      <span className="text-xs">Transacciones</span>
                    </div>
                    <p className="text-xl font-bold">
                      <AnimatedCounter value={walletData?.stats?.totalTransactions || 0} />
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 mt-6">
                <Link href="/dashboard/broker/wallet">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all text-sm font-medium">
                    <Eye className="w-4 h-4" />
                    Ver Movimientos
                  </button>
                </Link>
                <button
                  onClick={() => fetchDashboardData()}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all text-sm font-medium"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>
            </div>
          </motion.div>

          {/* Alerts Section */}
          {(hasLowBalance || hasPendingCash || hasPendingOrders) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {hasLowBalance && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                >
                  <div className="p-2.5 rounded-xl bg-red-500">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-800 dark:text-red-200">Balance bajo</p>
                    <p className="text-xs text-red-600 dark:text-red-400">Tu balance está por debajo de $100</p>
                  </div>
                </motion.div>
              )}

              {hasPendingOrders && (
                <Link href="/dashboard/broker/orders">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700 transition-colors cursor-pointer"
                  >
                    <div className="p-2.5 rounded-xl bg-amber-500">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-amber-800 dark:text-amber-200">{pendingCount} órdenes pendientes</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">Esperando tu confirmación</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-amber-500" />
                  </motion.div>
                </Link>
              )}

              {hasPendingCash && (
                <Link href="/dashboard/broker/cash-deliveries">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 hover:border-purple-300 dark:hover:border-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="p-2.5 rounded-xl bg-purple-500">
                      <Banknote className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-purple-800 dark:text-purple-200">{cashDeliveries.length} entregas de efectivo</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400">Pendientes de recibir</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-purple-500" />
                  </motion.div>
                </Link>
              )}
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Orders Overview + Quick Actions */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Stats Grid */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Resumen de Órdenes</h2>
                  <Link href="/dashboard/broker/orders" className="text-sm text-[#cc0a46] dark:text-[#2a5caa] hover:underline flex items-center gap-1">
                    Ver todas <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Pending */}
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Pendientes</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                      <AnimatedCounter value={pendingCount} />
                    </p>
                  </div>

                  {/* Active */}
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">En Proceso</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      <AnimatedCounter value={activeCount} />
                    </p>
                  </div>

                  {/* Delivered */}
                  <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-medium text-green-600 dark:text-green-400">Entregadas</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      <AnimatedCounter value={deliveredCount} />
                    </p>
                  </div>

                  {/* Total */}
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Total</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                      <AnimatedCounter value={totalOrders} />
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Recent Activity */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900 dark:text-white">Actividad Reciente</h2>
                  <Link href="/dashboard/broker/orders" className="text-sm text-[#cc0a46] dark:text-[#2a5caa] hover:underline flex items-center gap-1">
                    Ver todo <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {recentOrders.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {recentOrders.map((order, index) => {
                      const badge = getStatusBadge(order.status)
                      return (
                        <motion.div
                          key={order.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.25 + index * 0.05 }}
                          className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-[#cc0a46]/10 dark:bg-[#2a5caa]/10 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-[#cc0a46] dark:text-[#2a5caa]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                  {order.orderNumber}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <User className="w-3 h-3" />
                                <span className="truncate">{order.recipientName}</span>
                                <span>•</span>
                                <MapPin className="w-3 h-3" />
                                <span>{order.recipientMunicipality}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-gray-900 dark:text-white text-sm">
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
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p className="text-gray-500 dark:text-gray-400">No hay órdenes recientes</p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Right Column: Performance + Cash Deliveries */}
            <div className="space-y-6">
              {/* Performance Ring */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6"
              >
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Rendimiento</h3>
                <div className="flex flex-col items-center">
                  <CircularProgress value={deliveredCount} max={totalOrders || 1} size={140} />
                  <div className="mt-4 text-center">
                    <p className="text-2xl font-bold text-[#cc0a46] dark:text-[#2a5caa]">
                      <AnimatedCounter value={completionRate} suffix="%" />
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Tasa de completadas</p>
                  </div>
                </div>
              </motion.div>

              {/* Cash Deliveries */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-[#cc0a46] dark:text-[#2a5caa]" />
                    <h3 className="font-bold text-gray-900 dark:text-white">Efectivo Pendiente</h3>
                  </div>
                  <Link href="/dashboard/broker/cash-deliveries" className="text-xs text-[#cc0a46] dark:text-[#2a5caa] hover:underline">
                    Ver todo
                  </Link>
                </div>

                {cashDeliveries.length > 0 ? (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {cashDeliveries.slice(0, 3).map((delivery, index) => {
                      const badge = getStatusBadge(delivery.status)
                      const isUrgent = delivery.status === 'validating'
                      return (
                        <Link key={delivery.id} href="/dashboard/broker/cash-deliveries">
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.25 + index * 0.05 }}
                            className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${isUrgent ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-gray-900 dark:text-white text-sm">
                                {delivery.order_number}
                              </span>
                              {isUrgent && (
                                <span className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-medium">
                                  <Shield className="w-3 h-3" />
                                  OTP
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {delivery.delivery_user_name}
                              </span>
                              <span className="font-bold text-[#cc0a46] dark:text-[#2a5caa] text-sm">
                                ${parseFloat(String(delivery.total_amount)).toLocaleString()}
                              </span>
                            </div>
                          </motion.div>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Sin entregas pendientes</p>
                  </div>
                )}

                {cashDeliveries.length > 0 && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50">
                    <Link href="/dashboard/broker/cash-deliveries">
                      <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa] text-white font-semibold hover:opacity-90 transition-all">
                        <Zap className="w-4 h-4" />
                        Recibir Efectivo
                      </button>
                    </Link>
                  </div>
                )}
              </motion.div>

              {/* Quick Links */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="space-y-3"
              >
                <Link href="/dashboard/broker/orders">
                  <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-[#cc0a46] dark:hover:border-[#2a5caa] transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#cc0a46]/10 dark:bg-[#2a5caa]/10">
                          <Package className="w-5 h-5 text-[#cc0a46] dark:text-[#2a5caa]" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">Órdenes de Remesas</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Gestionar entregas</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#cc0a46] dark:group-hover:text-[#2a5caa] transition-colors" />
                    </div>
                  </div>
                </Link>

                <Link href="/dashboard/broker/wallet">
                  <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-[#cc0a46] dark:hover:border-[#2a5caa] transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#cc0a46]/10 dark:bg-[#2a5caa]/10">
                          <Wallet className="w-5 h-5 text-[#cc0a46] dark:text-[#2a5caa]" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">Mi Wallet</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Balance y movimientos</p>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#cc0a46] dark:group-hover:text-[#2a5caa] transition-colors" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
