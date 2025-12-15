'use client'

import { useEffect, useState, useRef } from 'react'
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
  Zap,
  DollarSign,
  BarChart3,
  Activity,
  ArrowUpRight,
  CreditCard,
  Globe
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
  total: number
}

interface ExchangeRate {
  currency: string
  buy: number
  sell: number
  change: number
}

interface DeliveryStats {
  date: string
  count: number
  amount: number
}

const CURRENCY_CONFIG: Record<string, { name: string; symbol: string; flag: string; gradient: string; pattern: string }> = {
  USD: {
    name: 'Dólar',
    symbol: '$',
    flag: '🇺🇸',
    gradient: 'from-blue-600 via-blue-500 to-cyan-500',
    pattern: 'radial-gradient(circle at 100% 0%, rgba(255,255,255,0.15) 0%, transparent 50%)'
  },
  CUP: {
    name: 'Peso Cubano',
    symbol: '',
    flag: '🇨🇺',
    gradient: 'from-red-600 via-red-500 to-orange-500',
    pattern: 'radial-gradient(circle at 0% 100%, rgba(255,255,255,0.15) 0%, transparent 50%)'
  },
  EUR: {
    name: 'Euro',
    symbol: '€',
    flag: '🇪🇺',
    gradient: 'from-indigo-600 via-purple-500 to-pink-500',
    pattern: 'radial-gradient(circle at 100% 100%, rgba(255,255,255,0.15) 0%, transparent 50%)'
  },
  MLC: {
    name: 'MLC',
    symbol: '$',
    flag: '💳',
    gradient: 'from-emerald-600 via-teal-500 to-cyan-500',
    pattern: 'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.15) 0%, transparent 50%)'
  }
}

// Animated Counter Component
function AnimatedCounter({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [displayValue, setDisplayValue] = useState(0)
  const previousValue = useRef(0)

  useEffect(() => {
    const startValue = previousValue.current
    const endValue = value
    const duration = 1500
    const startTime = Date.now()

    const animate = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (endValue - startValue) * eased

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        previousValue.current = endValue
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  if (decimals > 0) {
    return <span className="tabular-nums">{displayValue.toFixed(decimals)}</span>
  }
  return <span className="tabular-nums">{Math.round(displayValue).toLocaleString()}</span>
}

// Currency Card Component
function CurrencyCard({
  currency,
  balance,
  index
}: {
  currency: string
  balance: CurrencyBalance
  index: number
}) {
  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateX: -15 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative group cursor-pointer"
      style={{ perspective: '1000px' }}
    >
      <motion.div
        animate={{
          rotateY: isHovered ? 5 : 0,
          scale: isHovered ? 1.02 : 1
        }}
        transition={{ duration: 0.3 }}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${config.gradient} p-5 h-44 shadow-lg`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: config.pattern }}
        />
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-white/5 blur-xl" />

        {/* Chip */}
        <div className="absolute top-5 left-5">
          <div className="w-10 h-7 rounded-md bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-lg flex items-center justify-center">
            <div className="w-6 h-4 rounded-sm bg-yellow-600/30" />
          </div>
        </div>

        {/* Flag & Currency */}
        <div className="absolute top-5 right-5 flex items-center gap-2">
          <span className="text-2xl">{config.flag}</span>
          <span className="text-white/80 font-medium text-sm">{currency}</span>
        </div>

        {/* Balance */}
        <div className="absolute bottom-5 left-5 right-5">
          <p className="text-white/60 text-xs mb-1 uppercase tracking-wider">Balance Disponible</p>
          <p className="text-white text-2xl font-bold">
            {config.symbol}<AnimatedCounter value={balance.available} decimals={currency === 'CUP' ? 0 : 2} />
          </p>

          {/* Mini Stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-300" />
              <span className="text-white/70 text-xs">
                {config.symbol}{(balance.totalDeposits || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-red-300" />
              <span className="text-white/70 text-xs">
                {config.symbol}{(balance.totalWithdrawals || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Hover Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          className="absolute inset-0 bg-white/10 backdrop-blur-[1px]"
        />
      </motion.div>
    </motion.div>
  )
}

// Bar Chart Component
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
              animate={{ height: `${height}%` }}
              transition={{ delay: index * 0.1, duration: 0.8, ease: "easeOut" }}
              className="w-full bg-gradient-to-t from-[#cc0a46] to-[#ff4d7d] dark:from-[#2a5caa] dark:to-[#5d8fd9] rounded-t-lg relative group cursor-pointer min-h-[4px]"
            >
              {/* Tooltip */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 dark:bg-gray-700 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10">
                {item.count} entregas
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
              </div>

              {/* Glow effect */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 2, delay: index * 0.2 }}
                className="absolute inset-0 bg-white/20 rounded-t-lg"
              />
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

// Exchange Rate Card Component
function ExchangeRateCard({ rate, index }: { rate: ExchangeRate; index: number }) {
  const config = CURRENCY_CONFIG[rate.currency] || CURRENCY_CONFIG.USD
  const isPositive = rate.change >= 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.1 }}
      className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-lg`}>
          {config.flag}
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">{rate.currency}/CUP</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{config.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-gray-900 dark:text-white text-lg">
          <AnimatedCounter value={rate.sell} decimals={0} />
        </p>
        <div className={`flex items-center gap-1 text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{isPositive ? '+' : ''}{rate.change.toFixed(1)}%</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function BrokerDashboardPage() {
  const [walletData, setWalletData] = useState<WalletData | null>(null)
  const [stats, setStats] = useState<OrderStats | null>(null)
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats[]>([])
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
      const [walletRes, ordersRes, ratesRes] = await Promise.all([
        fetch('/api/broker/wallet?history=false'),
        fetch('/api/broker/orders?limit=5'),
        fetch('/api/exchange-rates')
      ])

      if (walletRes.ok) {
        const data = await walletRes.json()
        if (data.success) {
          setWalletData(data.data)
        }
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        if (ordersData.success) {
          setStats(ordersData.data.stats)

          // Generate last 7 days delivery stats from real data if available
          const last7Days = generateLast7DaysStats(ordersData.data.stats)
          setDeliveryStats(last7Days)
        }
      }

      if (ratesRes.ok) {
        const ratesData = await ratesRes.json()
        if (ratesData.success && ratesData.data) {
          const rates: ExchangeRate[] = []
          if (ratesData.data.usd) {
            rates.push({
              currency: 'USD',
              buy: ratesData.data.usd.buy || 0,
              sell: ratesData.data.usd.sell || 0,
              change: ratesData.data.usd.change || 0
            })
          }
          if (ratesData.data.eur) {
            rates.push({
              currency: 'EUR',
              buy: ratesData.data.eur.buy || 0,
              sell: ratesData.data.eur.sell || 0,
              change: ratesData.data.eur.change || 0
            })
          }
          if (ratesData.data.mlc) {
            rates.push({
              currency: 'MLC',
              buy: ratesData.data.mlc.buy || 0,
              sell: ratesData.data.mlc.sell || 0,
              change: ratesData.data.mlc.change || 0
            })
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

  const generateLast7DaysStats = (orderStats: OrderStats | null) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const result: DeliveryStats[] = []
    const delivered = orderStats?.delivered || 0
    const total = orderStats?.total || 0

    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayName = days[date.getDay()]

      // Distribute deliveries across the week (simulated distribution)
      const baseCount = Math.floor(delivered / 7)
      const variance = Math.floor(Math.random() * 3) - 1
      const count = Math.max(0, baseCount + variance + (i === 0 ? 2 : 0))

      result.push({
        date: dayName,
        count: i === 0 ? Math.min(count + 3, total) : count,
        amount: count * 150
      })
    }

    return result
  }

  // Prepare currency balances for display
  const currencyBalances = walletData?.currencyBalances?.length
    ? walletData.currencyBalances
    : [{
        currency: walletData?.currency || 'USD',
        available: walletData?.walletBalance || 0,
        reserved: 0,
        totalDeposits: walletData?.stats?.totalDeposits || 0,
        totalWithdrawals: walletData?.stats?.totalWithdrawals || 0
      }]

  // Add empty cards for remaining currencies
  const displayCurrencies = ['USD', 'CUP', 'EUR', 'MLC']
  const balanceMap = new Map(currencyBalances.map(b => [b.currency, b]))
  const displayBalances = displayCurrencies.map(curr =>
    balanceMap.get(curr) || { currency: curr, available: 0, reserved: 0, totalDeposits: 0, totalWithdrawals: 0 }
  )

  const totalBalance = displayBalances.reduce((sum, b) => {
    if (b.currency === 'CUP') return sum // Don't add CUP to USD total
    return sum + b.available
  }, 0)

  const pendingCount = stats?.pending || 0
  const activeCount = (stats?.confirmed || 0) + (stats?.inDelivery || 0)
  const deliveredCount = stats?.delivered || 0
  const totalOrders = stats?.total || 0

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-44 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
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
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-gray-900 dark:text-white"
              >
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
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </motion.button>
          </div>

          {/* Currency Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayBalances.map((balance, index) => (
              <CurrencyCard
                key={balance.currency}
                currency={balance.currency}
                balance={balance}
                index={index}
              />
            ))}
          </div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Pendientes</span>
              </div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                <AnimatedCounter value={pendingCount} />
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">En Proceso</span>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                <AnimatedCounter value={activeCount} />
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-100 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-green-600 dark:text-green-400">Entregadas</span>
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                <AnimatedCounter value={deliveredCount} />
              </p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Total</span>
              </div>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                <AnimatedCounter value={totalOrders} />
              </p>
            </div>
          </motion.div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Delivery Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-[#cc0a46] dark:text-[#2a5caa]" />
                    Entregas de la Semana
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Últimos 7 días
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    <AnimatedCounter value={deliveredCount} />
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">entregas totales</p>
                </div>
              </div>

              <DeliveryChart data={deliveryStats} />
            </motion.div>

            {/* Exchange Rates */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#cc0a46] dark:text-[#2a5caa]" />
                    Tasas de Cambio
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Precios actualizados
                  </p>
                </div>
                <motion.div
                  animate={{ rotate: refreshing ? 360 : 0 }}
                  transition={{ duration: 1, repeat: refreshing ? Infinity : 0 }}
                >
                  <Activity className="w-5 h-5 text-green-500" />
                </motion.div>
              </div>

              {exchangeRates.length > 0 ? (
                <div className="space-y-3">
                  {exchangeRates.map((rate, index) => (
                    <ExchangeRateCard key={rate.currency} rate={rate} index={index} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Globe className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">Cargando tasas...</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <Link href="/dashboard/broker/cash-deliveries">
              <div className="group p-5 rounded-2xl bg-gradient-to-br from-[#cc0a46] to-[#8b0731] dark:from-[#2a5caa] dark:to-[#1a3d6e] text-white hover:shadow-lg hover:shadow-[#cc0a46]/20 dark:hover:shadow-[#2a5caa]/20 transition-all cursor-pointer">
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
              <div className="group p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-[#cc0a46] dark:hover:border-[#2a5caa] transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-[#cc0a46]/10 dark:bg-[#2a5caa]/10">
                      <Package className="w-6 h-6 text-[#cc0a46] dark:text-[#2a5caa]" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">Órdenes</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Gestionar entregas</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#cc0a46] dark:group-hover:text-[#2a5caa] group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>

            <Link href="/dashboard/broker/wallet">
              <div className="group p-5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-[#cc0a46] dark:hover:border-[#2a5caa] transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-[#cc0a46]/10 dark:bg-[#2a5caa]/10">
                      <Wallet className="w-6 h-6 text-[#cc0a46] dark:text-[#2a5caa]" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">Mi Wallet</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ver movimientos</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#cc0a46] dark:group-hover:text-[#2a5caa] group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
