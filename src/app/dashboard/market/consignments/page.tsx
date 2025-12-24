'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Store,
  Package,
  Plus,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Eye,
  Send,
  Inbox,
  Wallet,
  BarChart3,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'

interface ConsignmentOrder {
  id: number
  orderNumber: string
  status: string
  provider: {
    id: number
    name: string
    phone: string | null
    logoUrl: string | null
  }
  receiver: {
    id: number
    name: string
    phone: string | null
    logoUrl: string | null
  }
  subtotal: number
  totalItems: number
  totalUnits: number
  itemCount: number
  createdAt: string
  isProvider: boolean
  isReceiver: boolean
}

interface Analytics {
  kpis: {
    pendingCollection: { value: number; label: string }
    inTransit: { value: number; orderCount: number; label: string }
    monthSales: { value: number; changePercent: number; label: string }
    monthReturns: { value: number; changePercent: number; label: string }
  }
  summary: {
    activeMarkets: number
    ordersByStatus: Record<string, number>
    pendingPaymentRequests: number
    pendingPaymentAmount: number
  }
}

interface MarketSales {
  id: number
  name: string
  totalSales: number
  percentage: number
  pendingBalance: number
}

interface SalesHistoryPoint {
  date: string
  sales: number
  netSales: number
}

interface TopProduct {
  id: number
  name: string
  sku: string
  totalSold: number
  totalValue: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Borrador', color: 'gray', icon: Clock },
  pending_approval: { label: 'Pendiente Aprobación', color: 'amber', icon: Clock },
  approved: { label: 'Aprobada', color: 'blue', icon: CheckCircle },
  in_transit: { label: 'En Tránsito', color: 'purple', icon: Truck },
  received: { label: 'Recibida', color: 'green', icon: CheckCircle },
  partially_returned: { label: 'Parcialmente Devuelta', color: 'orange', icon: ArrowDownRight },
  completed: { label: 'Completada', color: 'emerald', icon: CheckCircle },
  rejected: { label: 'Rechazada', color: 'red', icon: XCircle },
  cancelled: { label: 'Cancelada', color: 'gray', icon: XCircle }
}

type TabType = 'all' | 'provider' | 'receiver'

const CHART_COLORS = ['#a855f7', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6']

export default function ConsignmentsPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<ConsignmentOrder[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)

  // Analytics state
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [marketSales, setMarketSales] = useState<MarketSales[]>([])
  const [salesHistory, setSalesHistory] = useState<SalesHistoryPoint[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  // Load analytics
  useEffect(() => {
    const loadAnalytics = async () => {
      setAnalyticsLoading(true)
      try {
        const [summaryRes, marketRes, historyRes] = await Promise.all([
          fetch('/api/consignments/analytics/summary'),
          fetch('/api/consignments/analytics/sales-by-market'),
          fetch('/api/consignments/analytics/sales-history?days=30')
        ])

        const [summaryData, marketData, historyData] = await Promise.all([
          summaryRes.json(),
          marketRes.json(),
          historyRes.json()
        ])

        if (summaryData.success) {
          setAnalytics(summaryData.data)
        }
        if (marketData.success) {
          setMarketSales(marketData.data.markets || [])
        }
        if (historyData.success) {
          setSalesHistory(historyData.data.history || [])
          setTopProducts(historyData.data.topProducts || [])
        }
      } catch (error) {
        console.error('Error loading analytics:', error)
      } finally {
        setAnalyticsLoading(false)
      }
    }
    loadAnalytics()
  }, [])

  // Load orders
  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true)
      try {
        const roleParam = activeTab === 'all' ? '' : `role=${activeTab}`
        const statusParam = statusFilter ? `&status=${statusFilter}` : ''
        const response = await fetch(`/api/consignments/orders?${roleParam}${statusParam}`)
        const data = await response.json()
        if (data.success) {
          setOrders(data.data.orders || [])
          // Count pending approvals where I'm the receiver
          const pendingCount = (data.data.orders || []).filter(
            (o: ConsignmentOrder) => o.status === 'pending_approval' && o.isReceiver
          ).length
          setPendingApprovalCount(pendingCount)
        }
      } catch (error) {
        console.error('Error loading orders:', error)
      } finally {
        setLoading(false)
      }
    }
    loadOrders()
  }, [activeTab, statusFilter])

  // Filter by search
  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      order.orderNumber.toLowerCase().includes(query) ||
      order.provider.name.toLowerCase().includes(query) ||
      order.receiver.name.toLowerCase().includes(query)
    )
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatChartDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short'
    })
  }

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft
    const colorClasses: Record<string, string> = {
      gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }
    const Icon = config.icon
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', colorClasses[config.color])}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    )
  }

  // Chart tooltip formatter
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className={cn(
          'px-3 py-2 rounded-lg shadow-lg border',
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        )}>
          <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            {label}
          </p>
          <p className="text-sm text-purple-500 font-bold">
            ${payload[0].value.toFixed(2)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']}>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen py-6 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className={cn(
                  "text-2xl sm:text-3xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Consignaciones
                </h1>
                <p className={cn(
                  "text-sm mt-1",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Gestiona tus consignaciones enviadas y recibidas
                </p>
              </div>
              <div className="flex items-center gap-3">
                {pendingApprovalCount > 0 && (
                  <Link href="/dashboard/market/consignments/pending">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl cursor-pointer',
                        theme === 'dark'
                          ? 'bg-amber-900/30 text-amber-400 border border-amber-500/30'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      )}
                    >
                      <Inbox className="w-5 h-5" />
                      <span className="font-medium">{pendingApprovalCount} pendientes</span>
                      <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  </Link>
                )}
                <Link href="/dashboard/market/consignments/collections">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium',
                      theme === 'dark'
                        ? 'bg-gray-800 text-white border border-gray-700 hover:border-purple-500'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-purple-300'
                    )}
                  >
                    <Wallet className="w-5 h-5" />
                    Cobros
                  </motion.button>
                </Link>
                <Link href="/dashboard/market/consignments/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Consignación
                  </motion.button>
                </Link>
              </div>
            </div>

            {/* KPI Cards */}
            {analyticsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={cn(
                    'p-5 rounded-2xl animate-pulse',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}>
                    <div className="h-4 w-24 bg-gray-300 dark:bg-gray-700 rounded mb-3" />
                    <div className="h-8 w-32 bg-gray-300 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            ) : analytics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Por Cobrar */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'p-5 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {analytics.kpis.pendingCollection.label}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    ${analytics.kpis.pendingCollection.value.toFixed(2)}
                  </p>
                  <Link href="/dashboard/market/consignments/collections" className="text-xs text-purple-500 hover:underline mt-1 inline-block">
                    Ver cobros pendientes
                  </Link>
                </motion.div>

                {/* En Tránsito */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    'p-5 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {analytics.kpis.inTransit.label}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    ${analytics.kpis.inTransit.value.toFixed(2)}
                  </p>
                  <p className={cn('text-xs mt-1', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                    {analytics.kpis.inTransit.orderCount} órdenes
                  </p>
                </motion.div>

                {/* Vendido este Mes */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    'p-5 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {analytics.kpis.monthSales.label}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    ${analytics.kpis.monthSales.value.toFixed(2)}
                  </p>
                  <div className={cn(
                    'flex items-center gap-1 text-xs mt-1',
                    analytics.kpis.monthSales.changePercent >= 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {analytics.kpis.monthSales.changePercent >= 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(analytics.kpis.monthSales.changePercent).toFixed(1)}% vs mes anterior
                  </div>
                </motion.div>

                {/* Devoluciones */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    'p-5 rounded-2xl border',
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      {analytics.kpis.monthReturns.label}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    ${analytics.kpis.monthReturns.value.toFixed(2)}
                  </p>
                  <div className={cn(
                    'flex items-center gap-1 text-xs mt-1',
                    analytics.kpis.monthReturns.changePercent <= 0 ? 'text-green-500' : 'text-red-500'
                  )}>
                    {analytics.kpis.monthReturns.changePercent <= 0 ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : (
                      <TrendingUp className="w-3 h-3" />
                    )}
                    {Math.abs(analytics.kpis.monthReturns.changePercent).toFixed(1)}% vs mes anterior
                  </div>
                </motion.div>
              </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales History Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'p-5 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Ventas Últimos 30 Días
                </h3>
                <div className="h-64">
                  {salesHistory.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesHistory.map(s => ({ ...s, date: formatChartDate(s.date) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                          tickLine={false}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="sales"
                          stroke="#a855f7"
                          strokeWidth={2}
                          dot={{ fill: '#a855f7', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: '#a855f7' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                        No hay datos de ventas aún
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Sales by Market Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  'p-5 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Ventas por Mercado
                </h3>
                <div className="h-64">
                  {marketSales.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={marketSales} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                        <XAxis
                          type="number"
                          tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                          tickLine={false}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12 }}
                          tickLine={false}
                          width={100}
                        />
                        <Tooltip
                          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Ventas']}
                          contentStyle={{
                            backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                            border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="totalSales" radius={[0, 4, 4, 0]}>
                          {marketSales.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className={cn('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                        No hay datos de ventas por mercado
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Top Products */}
            {topProducts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className={cn(
                  'p-5 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                )}
              >
                <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  Productos Más Vendidos
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {topProducts.map((product, index) => (
                    <div
                      key={product.id}
                      className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs flex items-center justify-center font-bold">
                          {index + 1}
                        </span>
                        <span className={cn('text-sm font-medium truncate', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {product.name}
                        </span>
                      </div>
                      <p className={cn('text-xs', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        {product.sku}
                      </p>
                      <p className={cn('text-lg font-bold mt-2', theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>
                        {product.totalSold} vendidos
                      </p>
                      <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                        ${product.totalValue.toFixed(2)} total
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tabs */}
            <div className={cn(
              'flex gap-2 p-1 rounded-xl',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
            )}>
              {[
                { id: 'all', label: 'Todas', icon: Package },
                { id: 'provider', label: 'Enviadas', icon: ArrowUpRight },
                { id: 'receiver', label: 'Recibidas', icon: ArrowDownRight }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
                    activeTab === tab.id
                      ? theme === 'dark'
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-white text-purple-600 shadow-md'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-gray-200'
                        : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className={cn(
                'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border',
                theme === 'dark'
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-200'
              )}>
                <Search className={cn('w-5 h-5', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                <input
                  type="text"
                  placeholder="Buscar por número, mercado..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    'flex-1 bg-transparent outline-none',
                    theme === 'dark' ? 'text-white placeholder:text-gray-500' : 'text-gray-900 placeholder:text-gray-400'
                  )}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={cn(
                  'px-4 py-3 rounded-xl border font-medium',
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-700 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                )}
              >
                <option value="">Todos los estados</option>
                <option value="draft">Borrador</option>
                <option value="pending_approval">Pendiente Aprobación</option>
                <option value="approved">Aprobada</option>
                <option value="in_transit">En Tránsito</option>
                <option value="received">Recibida</option>
                <option value="completed">Completada</option>
                <option value="rejected">Rechazada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>

            {/* Orders List */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className={cn(
                'text-center py-20 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
              )}>
                <Package className={cn('w-16 h-16 mx-auto mb-4', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
                <p className={cn('text-lg font-medium mb-2', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                  No hay consignaciones
                </p>
                <p className={cn('text-sm mb-6', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                  Crea tu primera consignación para comenzar
                </p>
                <Link href="/dashboard/market/consignments/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Nueva Consignación
                  </motion.button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => router.push(`/dashboard/market/consignments/${order.id}`)}
                    className={cn(
                      'p-5 rounded-xl border cursor-pointer transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700 hover:border-purple-500/50'
                        : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-md'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center',
                          order.isProvider
                            ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                            : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                        )}>
                          {order.isProvider ? (
                            <ArrowUpRight className="w-6 h-6 text-white" />
                          ) : (
                            <ArrowDownRight className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className={cn('font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                              {order.orderNumber}
                            </h3>
                            {getStatusBadge(order.status)}
                          </div>
                          <div className={cn('flex items-center gap-2 text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                            {order.isProvider ? (
                              <>
                                <span>Enviada a:</span>
                                <span className="font-medium">{order.receiver.name}</span>
                              </>
                            ) : (
                              <>
                                <span>De:</span>
                                <span className="font-medium">{order.provider.name}</span>
                              </>
                            )}
                          </div>
                          <div className={cn('flex items-center gap-4 mt-2 text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                            <span className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {order.itemCount} productos
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatDate(order.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          ${order.subtotal.toFixed(2)}
                        </p>
                        <p className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          {order.totalUnits} unidades
                        </p>
                      </div>
                    </div>

                    {/* Quick Actions for pending approval */}
                    {order.status === 'pending_approval' && order.isReceiver && (
                      <div className={cn(
                        'flex items-center justify-end gap-2 mt-4 pt-4 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <Link href={`/dashboard/market/consignments/${order.id}`} onClick={(e) => e.stopPropagation()}>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            className={cn(
                              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                              theme === 'dark'
                                ? 'bg-purple-600 text-white'
                                : 'bg-purple-500 text-white'
                            )}
                          >
                            <Eye className="w-4 h-4" />
                            Revisar y Aprobar
                          </motion.button>
                        </Link>
                      </div>
                    )}

                    {/* Quick Actions for draft */}
                    {order.status === 'draft' && order.isProvider && (
                      <div className={cn(
                        'flex items-center justify-end gap-2 mt-4 pt-4 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <Link href={`/dashboard/market/consignments/${order.id}`} onClick={(e) => e.stopPropagation()}>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            className={cn(
                              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                              theme === 'dark'
                                ? 'bg-gray-700 text-white'
                                : 'bg-gray-100 text-gray-700'
                            )}
                          >
                            <Eye className="w-4 h-4" />
                            Editar
                          </motion.button>
                        </Link>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          onClick={async (e) => {
                            e.stopPropagation()
                            const res = await fetch(`/api/consignments/orders/${order.id}/submit`, { method: 'POST' })
                            if (res.ok) {
                              window.location.reload()
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-purple-600 text-white"
                        >
                          <Send className="w-4 h-4" />
                          Enviar
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
