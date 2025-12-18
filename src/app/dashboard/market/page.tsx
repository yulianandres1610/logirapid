'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Wallet,
  Package,
  Clock,
  CheckCircle,
  MapPin,
  ArrowRight,
  ShoppingCart,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  AlertCircle,
  Calendar,
  Target,
  Bell,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Boxes,
  AlertTriangle,
  Store,
  Truck
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface OrderStats {
  pending: number
  preparing: number
  ready: number
  delivered: number
  thisMonth: number
  totalInvoicedMonth: number
  totalSoldMonth: number
}

interface ProductStats {
  total: number
  inStock: number
  lowStock: number
  outOfStock: number
}

interface OrderByMonth {
  month: string
  monthName: string
  orderCount: number
  totalAmount: number
}

interface RecentOrder {
  id: number
  orderNumber: string
  customerName: string
  totalAmount: number
  currency: string
  status: string
  createdAt: string
}

interface CurrencyBalance {
  currency: string
  availableBalance: number
  reservedBalance: number
  totalDeposits: number
  totalWithdrawals: number
}

interface DashboardData {
  orders: OrderStats
  ordersByMonth: OrderByMonth[]
  recentOrders: RecentOrder[]
  products: ProductStats
  wallet: {
    balances: CurrencyBalance[]
    primaryBalance: number
  }
}

// Currency symbols
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

// Animated number component
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const duration = 1000
    const start = Date.now()
    const startVal = display

    const animate = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(startVal + (value - startVal) * eased)
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }, [value])

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString()

  return <span className="tabular-nums">{prefix}{formatted}{suffix}</span>
}

// Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'blue',
  onClick,
  delay = 0
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'cyan'
  onClick?: () => void
  delay?: number
}) {
  const colors = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/25',
    green: 'from-emerald-500 to-emerald-600 shadow-emerald-500/25',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/25',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/25',
    red: 'from-red-500 to-red-600 shadow-red-500/25',
    cyan: 'from-cyan-500 to-cyan-600 shadow-cyan-500/25'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors[color]} p-5 text-white shadow-lg ${onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
            <Icon className="w-5 h-5" />
          </div>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              trend === 'up' ? 'bg-white/20' : trend === 'down' ? 'bg-red-400/30' : 'bg-white/10'
            }`}>
              {trend === 'up' ? <TrendingUp className="w-3 h-3" /> :
               trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <p className="text-3xl font-bold mb-1">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </p>
        <p className="text-sm font-medium text-white/90">{title}</p>
        {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  )
}

// Alert Card for urgent items
function AlertCard({
  title,
  count,
  description,
  icon: Icon,
  href,
  color = 'amber',
  delay = 0
}: {
  title: string
  count: number
  description: string
  icon: any
  href: string
  color?: 'amber' | 'red' | 'blue' | 'green'
  delay?: number
}) {
  const colors = {
    amber: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50',
    red: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50',
    blue: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50',
    green: 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50'
  }

  const iconColors = {
    amber: 'text-amber-600 bg-amber-100 dark:bg-amber-900/50',
    red: 'text-red-600 bg-red-100 dark:bg-red-900/50',
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/50',
    green: 'text-green-600 bg-green-100 dark:bg-green-900/50'
  }

  if (count === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <Link href={href}>
        <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${colors[color]} hover:scale-[1.01] transition-all cursor-pointer group`}>
          <div className={`p-3 rounded-xl ${iconColors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{count}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{description}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>
    </motion.div>
  )
}

// Balance Card
function BalanceCard({
  currency,
  available,
  reserved,
  delay = 0
}: {
  currency: string
  available: number
  reserved: number
  delay?: number
}) {
  const symbol = CURRENCY_SYMBOLS[currency] || '$'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      className="bg-white dark:bg-[#1e1e2f] rounded-xl p-4 border border-gray-200 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            {currency}
          </div>
          <span className="font-medium text-gray-700 dark:text-gray-300">{currency}</span>
        </div>
        {reserved > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
            {symbol}{reserved.toLocaleString()} reservado
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {symbol}<AnimatedNumber value={available} />
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Disponible</p>
    </motion.div>
  )
}

// Quick Action Button
function QuickAction({
  title,
  description,
  icon: Icon,
  href,
  color,
  badge,
  delay = 0
}: {
  title: string
  description: string
  icon: any
  href: string
  color: string
  badge?: number
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Link href={href}>
        <div className={`relative group p-5 rounded-2xl bg-gradient-to-br ${color} text-white hover:scale-[1.02] transition-all cursor-pointer shadow-lg`}>
          {badge !== undefined && badge > 0 && (
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
              {badge}
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg">{title}</p>
              <p className="text-sm text-white/80">{description}</p>
            </div>
            <ArrowRight className="w-5 h-5 opacity-70 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// Mini Chart for orders by month
function MiniChart({ data }: { data: OrderByMonth[] }) {
  const maxCount = Math.max(...data.map(d => d.orderCount), 1)
  const totalOrders = data.reduce((sum, d) => sum + d.orderCount, 0)
  const totalAmount = data.reduce((sum, d) => sum + d.totalAmount, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-1 h-24">
        {data.map((item, index) => {
          const height = (item.orderCount / maxCount) * 100
          const isLatest = index === data.length - 1

          return (
            <div key={item.month} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="relative w-full">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(height, 8)}%` }}
                  transition={{ delay: index * 0.05, duration: 0.5 }}
                  className={`w-full rounded-t-md transition-colors ${
                    isLatest
                      ? 'bg-gradient-to-t from-blue-600 to-blue-400'
                      : 'bg-gradient-to-t from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-500 group-hover:from-blue-400 group-hover:to-blue-300'
                  }`}
                  style={{ minHeight: '4px' }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10">
                  {item.orderCount} órdenes
                </div>
              </div>
              <span className={`text-[10px] font-medium ${isLatest ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {item.monthName}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Total periodo: </span>
          <span className="font-bold text-gray-900 dark:text-white">{totalOrders} órdenes</span>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Monto: </span>
          <span className="font-bold text-green-600 dark:text-green-400">
            ${totalAmount.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}

// Recent Order Row
function OrderRow({ order, index }: { order: RecentOrder; index: number }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Pendiente' },
    accepted: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Aceptada' },
    preparing: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Preparando' },
    ready: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', label: 'Lista' },
    in_delivery: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', label: 'En entrega' },
    delivered: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Entregada' },
    cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Cancelada' },
    rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Rechazada' }
  }

  const status = statusConfig[order.status] || statusConfig.pending
  const symbol = CURRENCY_SYMBOLS[order.currency] || '$'

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-gray-900 dark:text-white">{order.orderNumber}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
            {status.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{order.customerName}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-sm text-gray-900 dark:text-white">
          {symbol}{order.totalAmount.toLocaleString()}
        </p>
        <p className="text-[10px] text-gray-500">{order.currency}</p>
      </div>
      <Link href={`/dashboard/market/orders/${order.id}`}>
        <Eye className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-500" />
      </Link>
    </motion.div>
  )
}

export default function MarketDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [companyName, setCompanyName] = useState('Mercado')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Buenos días')
    else if (hour < 18) setGreeting('Buenas tardes')
    else setGreeting('Buenas noches')

    // Get company name from cookie
    try {
      const cookies = document.cookie.split(';')
      const companyNameCookie = cookies.find(c => c.trim().startsWith('user-company-name='))
      if (companyNameCookie) {
        setCompanyName(decodeURIComponent(companyNameCookie.split('=')[1]))
      }
    } catch (e) {
      console.error('Error getting company name:', e)
    }

    fetchDashboardData()
    const interval = setInterval(() => fetchDashboardData(true), 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const response = await fetch('/api/market/dashboard')

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Calculate KPIs
  const pendingActions = (data?.orders?.pending || 0) + (data?.orders?.preparing || 0)
  const totalBalance = data?.wallet?.balances?.reduce((sum, b) => sum + b.availableBalance, 0) || 0
  const totalReserved = data?.wallet?.balances?.reduce((sum, b) => sum + b.reservedBalance, 0) || 0
  const stockHealth = data?.products?.total
    ? Math.round((data.products.inStock / data.products.total) * 100)
    : 0

  if (loading) {
    return (
      <ProtectedRoute>
        <DashboardLayout>
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
                <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
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
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {greeting}, <span className="text-blue-600 dark:text-blue-400">{companyName}</span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                <Store className="w-4 h-4" />
                Panel de Mercado
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <Calendar className="w-4 h-4" />
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <button
              onClick={() => fetchDashboardData()}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">Actualizar</span>
            </button>
          </motion.div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Órdenes Pendientes"
              value={pendingActions}
              subtitle="Requieren tu atención"
              icon={Clock}
              color="amber"
              delay={0.1}
            />
            <MetricCard
              title="Facturado Este Mes"
              value={`$${(data?.orders?.totalInvoicedMonth || 0).toLocaleString()}`}
              subtitle={`${data?.orders?.thisMonth || 0} órdenes`}
              icon={DollarSign}
              color="green"
              delay={0.15}
            />
            <MetricCard
              title="Vendido Este Mes"
              value={`$${(data?.orders?.totalSoldMonth || 0).toLocaleString()}`}
              subtitle="Órdenes entregadas"
              icon={ShoppingCart}
              color="purple"
              delay={0.2}
            />
            <MetricCard
              title="Saldo Disponible"
              value={`$${totalBalance.toLocaleString()}`}
              subtitle={totalReserved > 0 ? `$${totalReserved.toLocaleString()} reservado` : 'Todo disponible'}
              icon={Wallet}
              color="blue"
              delay={0.25}
            />
          </div>

          {/* Urgent Actions */}
          {(data?.orders?.pending || 0) + (data?.orders?.preparing || 0) + (data?.orders?.ready || 0) + (data?.products?.lowStock || 0) + (data?.products?.outOfStock || 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl p-4 border border-amber-200 dark:border-amber-800"
            >
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-gray-900 dark:text-white">Acciones Pendientes</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <AlertCard
                  title="Nuevas"
                  count={data?.orders?.pending || 0}
                  description="Órdenes por aceptar"
                  icon={AlertCircle}
                  href="/dashboard/market/orders?status=pending"
                  color="amber"
                  delay={0.35}
                />
                <AlertCard
                  title="En Preparación"
                  count={data?.orders?.preparing || 0}
                  description="Órdenes en proceso"
                  icon={Package}
                  href="/dashboard/market/orders?status=preparing"
                  color="blue"
                  delay={0.4}
                />
                <AlertCard
                  title="Listas"
                  count={data?.orders?.ready || 0}
                  description="Para entregar"
                  icon={CheckCircle}
                  href="/dashboard/market/orders?status=ready"
                  color="green"
                  delay={0.45}
                />
                <AlertCard
                  title="Stock Bajo"
                  count={(data?.products?.lowStock || 0) + (data?.products?.outOfStock || 0)}
                  description="Productos que reponer"
                  icon={AlertTriangle}
                  href="/dashboard/market/inventory?filter=low-stock"
                  color="red"
                  delay={0.5}
                />
              </div>
            </motion.div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <QuickAction
              title="Ver Órdenes"
              description="Gestionar pedidos"
              icon={Package}
              href="/dashboard/market/orders"
              color="from-blue-500 to-blue-600 shadow-blue-500/25"
              badge={pendingActions}
              delay={0.5}
            />
            <QuickAction
              title="Inventario"
              description="Gestionar productos"
              icon={Boxes}
              href="/dashboard/market/inventory"
              color="from-emerald-500 to-emerald-600 shadow-emerald-500/25"
              badge={data?.products?.outOfStock}
              delay={0.55}
            />
            <QuickAction
              title="Mi Wallet"
              description="Ver movimientos"
              icon={Wallet}
              href="/dashboard/market/wallet"
              color="from-purple-500 to-purple-600 shadow-purple-500/25"
              delay={0.6}
            />
            <QuickAction
              title="Entregas"
              description="Crear rutas"
              icon={Truck}
              href="/dashboard/market/deliveries"
              color="from-cyan-500 to-cyan-600 shadow-cyan-500/25"
              delay={0.65}
            />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Performance Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="lg:col-span-2 bg-white dark:bg-[#1e1e2f] rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Órdenes por Mes
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Últimos 6 meses</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    <AnimatedNumber value={data?.orders?.thisMonth || 0} />
                  </p>
                  <p className="text-xs text-gray-500">este mes</p>
                </div>
              </div>
              {data?.ordersByMonth && data.ordersByMonth.length > 0 ? (
                <MiniChart data={data.ordersByMonth} />
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin datos de órdenes</p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Recent Orders */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white dark:bg-[#1e1e2f] rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-500" />
                  Recientes
                </h3>
                <Link href="/dashboard/market/orders" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                  Ver todas <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-1">
                {data?.recentOrders && data.recentOrders.length > 0 ? (
                  data.recentOrders.map((order, i) => (
                    <OrderRow key={order.id} order={order} index={i} />
                  ))
                ) : (
                  <div className="py-8 text-center text-gray-400">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin órdenes recientes</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Wallet Balances */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="bg-white dark:bg-[#1e1e2f] rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <CircleDollarSign className="w-5 h-5 text-green-500" />
                  Saldos por Moneda
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Fondos disponibles</p>
              </div>
              <Link href="/dashboard/market/wallet" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1">
                Ver detalles <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {data?.wallet?.balances?.map((balance, i) => (
                <BalanceCard
                  key={balance.currency}
                  currency={balance.currency}
                  available={balance.availableBalance}
                  reserved={balance.reservedBalance}
                  delay={0.8 + i * 0.05}
                />
              ))}
              {(!data?.wallet?.balances || data.wallet.balances.length === 0) && (
                <div className="col-span-full py-8 text-center text-gray-400">
                  <Wallet className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sin saldos disponibles</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Product & Order Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85 }}
              className="bg-white dark:bg-[#1e1e2f] rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-emerald-500" />
                  Estado del Inventario
                </h3>
                <div className={`text-sm px-3 py-1 rounded-full ${
                  stockHealth >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  stockHealth >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {stockHealth}% en stock
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Productos', value: data?.products?.total || 0, color: 'text-gray-600 bg-gray-50 dark:bg-gray-800' },
                  { label: 'En Stock', value: data?.products?.inStock || 0, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
                  { label: 'Stock Bajo', value: data?.products?.lowStock || 0, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
                  { label: 'Sin Stock', value: data?.products?.outOfStock || 0, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' }
                ].map((stat, i) => (
                  <div key={stat.label} className={`p-3 rounded-xl ${stat.color} text-center`}>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs font-medium opacity-80">{stat.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Order Stats Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-white dark:bg-[#1e1e2f] rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm"
            >
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-purple-500" />
                Resumen de Órdenes
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Pendientes', value: data?.orders?.pending || 0, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
                  { label: 'Preparando', value: data?.orders?.preparing || 0, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
                  { label: 'Listas', value: data?.orders?.ready || 0, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' },
                  { label: 'Entregadas', value: data?.orders?.delivered || 0, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' }
                ].map((stat) => (
                  <div key={stat.label} className={`p-3 rounded-xl ${stat.color} text-center`}>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs font-medium opacity-80">{stat.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
