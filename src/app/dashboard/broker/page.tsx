'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  Package,
  Clock,
  CheckCircle,
  MapPin,
  ArrowRight,
  Banknote,
  Truck,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Activity,
  Globe,
  XCircle,
  AlertCircle,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Users,
  Sparkles
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface CurrencyBalance {
  currency: string
  available: number
  reserved: number
  totalDeposits: number
  totalWithdrawals: number
}

interface WalletData {
  companyName: string
  walletNumber: string
  walletBalance: number
  currency: string
  province: string
  municipality: string
  isActive: boolean
  currencyBalances: CurrencyBalance[]
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
  rejected: number
  total: number
  pendingAmount: number
  deliveredAmount: number
}

interface ExchangeRate {
  currency: string
  buy: number
  sell: number
  change: number
}

interface DeliveryStats {
  date: string
  fullDate?: string
  count: number
  amount: number
}

interface RecentOrder {
  id: number
  orderNumber: string
  status: string
  recipientName: string
  receiveAmount: number
  receiveCurrency: string
  createdAt: string
}

// Card tier configuration based on balance
type CardTier = 'platinum' | 'gold' | 'diamond'

const getCardTier = (balance: number): CardTier => {
  if (balance >= 100000) return 'diamond'
  if (balance >= 10000) return 'gold'
  return 'platinum'
}

const tierConfig = {
  platinum: {
    name: 'PLATINUM',
    gradient: 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 15%, #a8a8a8 30%, #d0d0d0 50%, #b8b8b8 70%, #e0e0e0 85%, #c8c8c8 100%)',
    textColor: 'text-gray-800',
    glowColor: 'rgba(192, 192, 192, 0.4)',
  },
  gold: {
    name: 'GOLD',
    gradient: 'linear-gradient(135deg, #b8860b 0%, #ffd700 15%, #daa520 30%, #ffec8b 50%, #cd853f 70%, #ffd700 85%, #b8860b 100%)',
    textColor: 'text-amber-900',
    glowColor: 'rgba(255, 215, 0, 0.5)',
  },
  diamond: {
    name: 'DIAMOND',
    gradient: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 20%, #0d0d0d 40%, #3a3a3a 55%, #1a1a1a 70%, #2d2d2d 85%, #0d0d0d 100%)',
    textColor: 'text-gray-100',
    glowColor: 'rgba(255, 255, 255, 0.2)',
  },
}

// Currency configuration
const CURRENCY_CONFIG: Record<string, { name: string; symbol: string; flag: string }> = {
  USD: { name: 'Dólar', symbol: '$', flag: '🇺🇸' },
  CUP: { name: 'Peso Cubano', symbol: '$', flag: '🇨🇺' },
  EUR: { name: 'Euro', symbol: '€', flag: '🇪🇺' },
  MLC: { name: 'MLC', symbol: '$', flag: '💳' }
}

// Animated Counter Component
function AnimatedCounter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const duration = 1500
    const startTime = Date.now()
    const startValue = displayValue

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (value - startValue) * eased

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  if (decimals > 0) {
    return <span className="tabular-nums">{displayValue.toFixed(decimals)}</span>
  }
  return <span className="tabular-nums">{Math.round(displayValue).toLocaleString()}</span>
}

// Premium Wallet Card Component
function WalletCard({
  currency,
  balance,
  walletNumber,
  companyName,
  index
}: {
  currency: string
  balance: CurrencyBalance
  walletNumber?: string
  companyName?: string
  index: number
}) {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD
  const [isHovered, setIsHovered] = useState(false)
  const tier = getCardTier(balance.available)
  const tierStyle = tierConfig[tier]

  const formatWalletNumber = (num: string = '') => {
    const clean = num.replace(/\D/g, '').padEnd(16, '0').slice(0, 16)
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)} ${clean.slice(12, 16)}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateX: -10 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative cursor-pointer group"
      style={{ perspective: '1000px' }}
    >
      <motion.div
        animate={{
          rotateY: isHovered ? 5 : 0,
          scale: isHovered ? 1.02 : 1,
          boxShadow: isHovered
            ? `0 25px 50px -12px ${tierStyle.glowColor}`
            : `0 10px 30px -10px ${tierStyle.glowColor}`
        }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: tierStyle.gradient,
          aspectRatio: '1.6',
          transformStyle: 'preserve-3d'
        }}
      >
        {/* Texture overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />

        {/* Holographic shine */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-30"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.5) 45%, transparent 50%)'
          }}
          animate={{ x: isHovered ? '100%' : '-100%' }}
          transition={{ duration: 0.6 }}
        />

        {/* Diamond sparkles */}
        {tier === 'diamond' && (
          <>
            <div className="absolute top-4 right-12 w-1 h-1 bg-white rounded-full animate-pulse" />
            <div className="absolute top-10 right-6 w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
            <div className="absolute bottom-12 right-20 w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
          </>
        )}

        <div className={`relative z-10 h-full p-4 flex flex-col justify-between ${tierStyle.textColor}`}>
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl backdrop-blur-sm bg-white/10">
                {config.flag}
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest opacity-80">CUBARAPID</p>
                <p className="text-xs font-semibold">{config.name}</p>
              </div>
            </div>
            <div className="px-2 py-1 rounded-lg text-[10px] font-bold tracking-wider bg-black/20 backdrop-blur-sm">
              {tierStyle.name}
            </div>
          </div>

          {/* Wallet Number */}
          <div className="mt-auto">
            <p className="font-mono text-sm tracking-[0.1em] opacity-80 mb-1">
              {formatWalletNumber(walletNumber)}
            </p>
            <p className="text-[10px] opacity-60 truncate">{companyName}</p>
          </div>

          {/* Balance */}
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] opacity-60 uppercase tracking-wider">Disponible</p>
              <p className="text-2xl font-bold tracking-tight">
                {config.symbol}<AnimatedCounter value={balance.available} decimals={currency === 'CUP' ? 0 : 2} />
              </p>
            </div>
            {balance.reserved > 0 && (
              <div className="text-right">
                <p className="text-[10px] opacity-60">Reservado</p>
                <p className="text-sm font-medium opacity-80">
                  {config.symbol}{balance.reserved.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Currency badge */}
        <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-xs font-bold">
          {currency}
        </div>
      </motion.div>
    </motion.div>
  )
}

// Stats Card Component
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  delay,
  subtitle,
  trend
}: {
  title: string
  value: number
  icon: any
  color: string
  delay: number
  subtitle?: string
  trend?: 'up' | 'down'
}) {
  const colorClasses: Record<string, string> = {
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30 text-green-600 dark:text-green-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-600 dark:text-red-400',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-4 border backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">
        <AnimatedCounter value={value} />
      </p>
      <p className="text-sm font-medium mt-1">{title}</p>
      {subtitle && <p className="text-xs opacity-60 mt-0.5">{subtitle}</p>}
    </motion.div>
  )
}

// Exchange Rate Card
function ExchangeRateCard({ rate, index }: { rate: ExchangeRate; index: number }) {
  const config = CURRENCY_CONFIG[rate.currency] || CURRENCY_CONFIG.USD
  const isPositive = rate.change >= 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.1 }}
      className="flex items-center justify-between p-4 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 hover:border-blue-500/50 transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-blue-500/30">
          {config.flag}
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white">{rate.currency}/CUP</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{config.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          <AnimatedCounter value={rate.sell} />
        </p>
        <div className={`flex items-center justify-end gap-1 text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{isPositive ? '+' : ''}{rate.change.toFixed(1)}%</span>
        </div>
      </div>
    </motion.div>
  )
}

// Delivery Chart
function DeliveryChart({ data }: { data: DeliveryStats[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="h-48 flex items-end justify-between gap-2 px-2">
      {data.map((item, index) => {
        const height = (item.count / maxCount) * 100

        return (
          <div key={item.date} className="flex-1 flex flex-col items-center gap-2">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(height, 4)}%` }}
              transition={{ delay: index * 0.1, duration: 0.8, ease: "easeOut" }}
              className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg relative group cursor-pointer min-h-[4px] hover:from-blue-500 hover:to-blue-300 transition-colors"
            >
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10">
                {item.count} entregas
              </div>
            </motion.div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
              {item.date}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Recent Order Item
function RecentOrderItem({ order, index }: { order: RecentOrder; index: number }) {
  const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
    pending: { color: 'text-amber-500 bg-amber-500/10', icon: Clock, label: 'Pendiente' },
    confirmed: { color: 'text-blue-500 bg-blue-500/10', icon: CheckCircle, label: 'Confirmada' },
    in_delivery: { color: 'text-purple-500 bg-purple-500/10', icon: Truck, label: 'En entrega' },
    delivered: { color: 'text-green-500 bg-green-500/10', icon: CheckCircle, label: 'Entregada' },
    cancelled: { color: 'text-red-500 bg-red-500/10', icon: XCircle, label: 'Cancelada' },
    rejected: { color: 'text-red-500 bg-red-500/10', icon: AlertCircle, label: 'Rechazada' },
  }

  const config = statusConfig[order.status] || statusConfig.pending
  const StatusIcon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${config.color}`}>
          <StatusIcon className="w-4 h-4" />
        </div>
        <div>
          <p className="font-medium text-sm text-gray-900 dark:text-white">{order.orderNumber}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{order.recipientName}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-sm text-gray-900 dark:text-white">
          {order.receiveAmount.toLocaleString()} {order.receiveCurrency}
        </p>
        <p className="text-xs text-gray-500">{config.label}</p>
      </div>
    </motion.div>
  )
}

export default function BrokerDashboardPage() {
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats[]>([])
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(() => fetchDashboardData(true), 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const [walletRes, dashboardRes, ratesRes, ordersRes] = await Promise.all([
        fetch('/api/broker/wallet?history=false'),
        fetch('/api/broker/dashboard'),
        fetch('/api/exchange-rates'),
        fetch('/api/broker/orders?limit=5')
      ])

      if (walletRes.ok) {
        const data = await walletRes.json()
        if (data.success) {
          setWalletData(data.data)
        }
      }

      if (dashboardRes.ok) {
        const dashboardData = await dashboardRes.json()
        if (dashboardData.success) {
          setStats(dashboardData.data.orderStats)
          if (dashboardData.data.dailyDeliveries?.length > 0) {
            setDeliveryStats(dashboardData.data.dailyDeliveries)
          }
        }
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        if (ordersData.success) {
          setRecentOrders(ordersData.data.orders.slice(0, 5))
        }
      }

      if (ratesRes.ok) {
        const ratesData = await ratesRes.json()
        if (ratesData.success && ratesData.data) {
          const rates: ExchangeRate[] = []
          if (ratesData.data.usd) {
            rates.push({ currency: 'USD', buy: ratesData.data.usd.buy || 0, sell: ratesData.data.usd.sell || 0, change: ratesData.data.usd.change || 0 })
          }
          if (ratesData.data.eur) {
            rates.push({ currency: 'EUR', buy: ratesData.data.eur.buy || 0, sell: ratesData.data.eur.sell || 0, change: ratesData.data.eur.change || 0 })
          }
          if (ratesData.data.mlc) {
            rates.push({ currency: 'MLC', buy: ratesData.data.mlc.buy || 0, sell: ratesData.data.mlc.sell || 0, change: ratesData.data.mlc.change || 0 })
          }
          setExchangeRates(rates)
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Prepare currency balances
  const displayCurrencies = ['CUP', 'USD', 'EUR']
  const balanceMap = new Map(walletData?.currencyBalances?.map(b => [b.currency, b]) || [])
  const displayBalances = displayCurrencies.map(curr =>
    balanceMap.get(curr) || { currency: curr, available: 0, reserved: 0, totalDeposits: 0, totalWithdrawals: 0 }
  )

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
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
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3"
              >
                <Sparkles className="w-8 h-8 text-blue-500" />
                Dashboard Broker
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1"
              >
                <MapPin className="w-4 h-4" />
                {walletData?.municipality || 'Sin ubicación'}, {walletData?.province || ''}
              </motion.p>
            </div>
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => fetchDashboardData()}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-500/30"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </motion.button>
          </div>

          {/* Wallet Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayBalances.map((balance, index) => (
              <WalletCard
                key={balance.currency}
                currency={balance.currency}
                balance={balance}
                walletNumber={walletData?.walletNumber}
                companyName={walletData?.companyName}
                index={index}
              />
            ))}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <StatCard title="Pendientes" value={stats?.pending || 0} icon={Clock} color="amber" delay={0.2} />
            <StatCard title="Confirmadas" value={stats?.confirmed || 0} icon={CheckCircle} color="blue" delay={0.25} />
            <StatCard title="En Entrega" value={stats?.inDelivery || 0} icon={Truck} color="purple" delay={0.3} />
            <StatCard title="Entregadas" value={stats?.delivered || 0} icon={CheckCircle} color="green" delay={0.35} />
            <StatCard title="Canceladas" value={stats?.cancelled || 0} icon={XCircle} color="red" delay={0.4} />
            <StatCard title="Total" value={stats?.total || 0} icon={Package} color="cyan" delay={0.45} />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Delivery Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Entregas de la Semana
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Últimos 7 días</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    <AnimatedCounter value={stats?.delivered || 0} />
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">total entregas</p>
                </div>
              </div>
              {deliveryStats.length > 0 ? (
                <DeliveryChart data={deliveryStats} />
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin datos de entregas</p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Recent Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-500" />
                  Órdenes Recientes
                </h3>
                <Link href="/dashboard/broker/orders" className="text-blue-500 hover:text-blue-600 text-sm flex items-center gap-1">
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-1">
                {recentOrders.length > 0 ? (
                  recentOrders.map((order, index) => (
                    <RecentOrderItem key={order.id} order={order} index={index} />
                  ))
                ) : (
                  <div className="py-8 text-center text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin órdenes recientes</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Exchange Rates */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-green-500" />
                  Tasas de Cambio
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Precios actualizados</p>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500 animate-pulse" />
                <span className="text-xs text-green-500">En vivo</span>
              </div>
            </div>
            {exchangeRates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {exchangeRates.map((rate, index) => (
                  <ExchangeRateCard key={rate.currency} rate={rate} index={index} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400">
                <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Cargando tasas...</p>
              </div>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <Link href="/dashboard/broker/cash-deliveries">
              <div className="group p-5 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-all cursor-pointer shadow-lg shadow-green-500/30 hover:shadow-green-500/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                      <Banknote className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold">Recibir Efectivo</p>
                      <p className="text-xs text-white/70">Entregas pendientes</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-70 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard/broker/orders">
              <div className="group p-5 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all cursor-pointer shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold">Órdenes</p>
                      <p className="text-xs text-white/70">Gestionar entregas</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-70 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard/broker/wallet">
              <div className="group p-5 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 transition-all cursor-pointer shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                      <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold">Mi Wallet</p>
                      <p className="text-xs text-white/70">Ver movimientos</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-70 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
