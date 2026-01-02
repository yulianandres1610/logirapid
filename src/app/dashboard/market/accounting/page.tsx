'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Calculator,
  RefreshCw,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  Users,
  ArrowRight,
  FileCheck,
  BarChart3,
  PieChart
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface DashboardData {
  period: {
    type: string
    startDate: string
    endDate: string
  }
  summary: {
    totalSales: number
    posSales: number
    posOrderCount: number
    orderSales: number
    onlineOrderCount: number
    totalExpenses: number
    expenseCount: number
    totalPayroll: number
    pendingPayroll: number
    totalCOGS: number
    grossProfit: number
    netProfit: number
    profitMargin: number
  }
  employees: {
    activeCount: number
    terminatedCount: number
  }
  pendingRequests: {
    count: number
    amount: number
  }
  expensesByCategory: Array<{
    categoryName: string
    accountingType: string
    total: number
  }>
  allTimeExpenses?: {
    total: number
    count: number
    firstDate: string
    lastDate: string
  }
  topEmployees: Array<{
    employeeCode: string
    name: string
    orderCount: number
    totalSales: number
  }>
  charts: {
    dailySales: Array<{ date: string; sales: number }>
    dailyExpenses: Array<{ date: string; expenses: number }>
  }
}

// Animated number component
function AnimatedNumber({ value, decimals = 0, prefix = '' }: { value: number; decimals?: number; prefix?: string }) {
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

  return <span className="tabular-nums">{prefix}{formatted}</span>
}

// Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  delay = 0,
  trend,
  href
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'cyan' | 'emerald'
  delay?: number
  trend?: 'up' | 'down'
  href?: string
}) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    purple: 'from-purple-500 to-purple-600',
    red: 'from-red-500 to-red-600',
    cyan: 'from-cyan-500 to-cyan-600'
  }

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colors[color]} p-5 text-white shadow-lg ${href ? 'hover:scale-[1.02] cursor-pointer transition-transform' : ''}`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-green-200' : 'text-red-200'}`}>
              {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          )}
        </div>
        <p className="text-3xl font-bold mb-1">
          {typeof value === 'number' ? <AnimatedNumber value={value} prefix="$" /> : value}
        </p>
        <p className="text-sm font-medium text-white/90">{title}</p>
        {subtitle && <p className="text-xs text-white/70 mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  )

  return href ? <Link href={href}>{content}</Link> : content
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
      className="h-full"
    >
      <Link href={href} className="block h-full">
        <div className={`relative group h-full p-4 rounded-2xl bg-gradient-to-br ${color} text-white hover:scale-[1.02] transition-all cursor-pointer shadow-lg flex items-center gap-3`}>
          {badge !== undefined && badge > 0 && (
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
              {badge}
            </div>
          )}
          <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{title}</p>
            <p className="text-xs text-white/80 truncate">{description}</p>
          </div>
          <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform flex-shrink-0" />
        </div>
      </Link>
    </motion.div>
  )
}

export default function AccountingDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')

  useEffect(() => {
    fetchDashboardData()
  }, [period])

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const response = await fetch(`/api/market/accounting/dashboard?period=${period}`)
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

  const periodLabels = {
    week: 'Esta Semana',
    month: 'Este Mes',
    year: 'Este Año'
  }

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
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Calculator className="w-8 h-8 text-blue-600" />
                Contabilidad
              </h1>
              <p className="text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                {periodLabels[period]} - Conciliación de ventas y gastos
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                {(['week', 'month', 'year'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      period === p
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </motion.div>

          {/* Summary Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Ventas Totales"
              value={data?.summary?.totalSales || 0}
              subtitle={`${(data?.summary?.posOrderCount || 0) + (data?.summary?.onlineOrderCount || 0)} órdenes`}
              icon={DollarSign}
              color="blue"
              delay={0}
            />
            <MetricCard
              title="Gastos"
              value={(data?.summary?.totalExpenses || 0) > 0
                ? (data?.summary?.totalExpenses || 0)
                : (data?.allTimeExpenses?.total || 0)}
              subtitle={(data?.summary?.expenseCount || 0) > 0
                ? `${data?.summary?.expenseCount || 0} registros`
                : (data?.allTimeExpenses?.count || 0) > 0
                  ? `${data?.allTimeExpenses?.count} total (fuera del período)`
                  : 'Sin registros'}
              icon={Receipt}
              color="red"
              delay={0.1}
              href="/dashboard/market/accounting/expenses"
            />
            <MetricCard
              title="Nómina"
              value={data?.summary?.totalPayroll || 0}
              subtitle={data?.summary?.pendingPayroll ? `$${data.summary.pendingPayroll.toLocaleString()} pendiente` : 'Todo pagado'}
              icon={Users}
              color="purple"
              delay={0.2}
              href="/dashboard/market/accounting/payroll"
            />
            <MetricCard
              title="Ganancia Neta"
              value={data?.summary?.netProfit || 0}
              subtitle={`${data?.summary?.profitMargin || 0}% margen`}
              icon={TrendingUp}
              color={data?.summary?.netProfit && data.summary.netProfit >= 0 ? 'emerald' : 'red'}
              delay={0.3}
              trend={data?.summary?.netProfit && data.summary.netProfit >= 0 ? 'up' : 'down'}
            />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAction
              title="Registrar Gasto"
              description="Nuevo gasto con IA"
              icon={Receipt}
              href="/dashboard/market/accounting/expenses"
              color="from-orange-500 to-orange-600"
              delay={0.1}
            />
            <QuickAction
              title="Crear Nómina"
              description="Calcular pagos"
              icon={Wallet}
              href="/dashboard/market/accounting/payroll"
              color="from-purple-500 to-purple-600"
              delay={0.15}
            />
            <QuickAction
              title="Gestionar Empleados"
              description={`${data?.employees?.activeCount || 0} activos`}
              icon={Users}
              href="/dashboard/market/accounting/employees"
              color="from-blue-500 to-blue-600"
              delay={0.2}
            />
            <QuickAction
              title="Solicitudes"
              description="Revisar pagos"
              icon={FileCheck}
              href="/dashboard/market/accounting/requests"
              color="from-emerald-500 to-emerald-600"
              badge={data?.pendingRequests?.count}
              delay={0.25}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Expenses by Category */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                    <PieChart className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Gastos por Categoría</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Distribución del período</p>
                  </div>
                </div>
                <Link
                  href="/dashboard/market/accounting/expenses"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  Ver todos <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {data?.expensesByCategory && data.expensesByCategory.length > 0 ? (
                  data.expensesByCategory.slice(0, 6).map((cat, idx) => {
                    const maxTotal = Math.max(...data.expensesByCategory.map(c => c.total))
                    const percentage = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0
                    const typeColors: Record<string, string> = {
                      cogs: 'bg-blue-500',
                      opex: 'bg-amber-500',
                      capex: 'bg-purple-500'
                    }
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-24 text-sm text-gray-600 dark:text-gray-400 truncate">
                          {cat.categoryName}
                        </div>
                        <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ delay: 0.4 + idx * 0.05, duration: 0.5 }}
                            className={`h-full ${typeColors[cat.accountingType] || 'bg-gray-500'} rounded-full`}
                          />
                        </div>
                        <div className="w-20 text-right text-sm font-semibold text-gray-900 dark:text-white">
                          ${cat.total.toLocaleString()}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No hay gastos registrados en este período
                  </div>
                )}
              </div>
            </motion.div>

            {/* Top Employees */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Top Vendedores</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Por ventas POS</p>
                </div>
              </div>
              <div className="space-y-4">
                {data?.topEmployees && data.topEmployees.length > 0 ? (
                  data.topEmployees.map((emp, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{emp.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{emp.orderCount} órdenes</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-white">
                          ${emp.totalSales.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                    No hay ventas en este período
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Pending Payment Requests */}
          {data?.pendingRequests && data.pendingRequests.count > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                    <FileCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {data.pendingRequests.count} Solicitudes Pendientes
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total: ${data.pendingRequests.amount.toLocaleString()} en solicitudes de pago
                    </p>
                  </div>
                </div>
                <Link
                  href="/dashboard/market/accounting/requests"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  Revisar
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
          )}

          {/* Summary Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6"
          >
            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Resumen del Período</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  ${(data?.summary?.posSales || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ventas POS</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${(data?.summary?.orderSales || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ventas Online</p>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  ${(data?.summary?.totalCOGS || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Costo Mercancía</p>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  ${(data?.summary?.grossProfit || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ganancia Bruta</p>
              </div>
              <div className={`text-center p-4 rounded-xl ${
                (data?.summary?.netProfit || 0) >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                <p className={`text-2xl font-bold ${
                  (data?.summary?.netProfit || 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  ${Math.abs(data?.summary?.netProfit || 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {(data?.summary?.netProfit || 0) >= 0 ? 'Ganancia Neta' : 'Pérdida Neta'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
