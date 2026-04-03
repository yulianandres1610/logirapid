'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { DollarSign, ShoppingCart, TrendingUp, Users, X, Receipt, Clock, CreditCard, ExternalLink, RefreshCw, Banknote, Smartphone, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { ReportFilters } from '@/components/market/reports/ReportFilters'
import { ReportSummaryCards } from '@/components/market/reports/ReportSummaryCards'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']

interface SalesData {
  filters: any
  summary: {
    totalSales: number
    totalOrders: number
    averageTicket: number
    daysWithSales: number
    comparison: {
      previousPeriodSales: number
      percentChange: number
    }
  }
  byPeriod: Array<{ date: string; sales: number; orders: number }>
  byProduct: Array<{
    productId: number
    productName: string
    quantity: number
    sales: number
    percentage: number
  }>
  byCategory: Array<{
    categoryName: string
    sales: number
    quantity: number
    percentage: number
  }>
  byTerminal: Array<{
    terminalId: number
    terminalName: string
    sales: number
    orders: number
    averageTicket: number
  }>
  byPaymentMethod: Array<{
    paymentMethod: string
    currency: string
    orders: number
    amount: number
  }>
  byHour: Array<{ hour: number; orders: number; sales: number }>
}

interface OrderDetail {
  id: number
  orderNumber: string
  totalAmount: number
  status: string
  createdAt: string
  terminalName: string
  payments: Array<{ method: string; currency: string; amount: number }>
  lines: Array<{ productName: string; quantity: number; unitPrice: number; total: number }>
}

interface RealtimeData {
  date: string
  lastUpdated: string
  grandTotal: {
    orders: number
    sales: number
  }
  currencyTotals: {
    USD: { cash: number; card: number; transfer: number; credit: number; total: number }
    CUP: { cash: number; card: number; transfer: number; credit: number; total: number }
  }
  paymentTotals: Array<{ method: string; currency: string; orders: number; amount: number }>
  terminals: Array<{
    terminalId: number
    terminalName: string
    terminalCode: string
    totalOrders: number
    totalSales: number
    byPaymentMethod: Array<{ method: string; currency: string; orders: number; amount: number }>
  }>
}

export default function SalesReportPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const reportRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trend' | 'products' | 'categories' | 'terminals' | 'hours' | 'payments' | 'realtime'>('trend')

  // Realtime data
  const [realtimeData, setRealtimeData] = useState<RealtimeData | null>(null)
  const [realtimeLoading, setRealtimeLoading] = useState(false)
  const [realtimeDate, setRealtimeDate] = useState(() => new Date().toISOString().split('T')[0])
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Order details modal
  const [showOrdersModal, setShowOrdersModal] = useState(false)
  const [selectedDateOrders, setSelectedDateOrders] = useState<OrderDetail[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState('')

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day')
  const [selectedTerminalId, setSelectedTerminalId] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, period, selectedTerminalId])

  // Fetch realtime data
  const fetchRealtimeData = useCallback(async () => {
    setRealtimeLoading(true)
    try {
      const response = await fetch(`/api/market/reports/sales/realtime?date=${realtimeDate}`)
      const result = await response.json()
      if (result.success) {
        setRealtimeData(result.data)
      }
    } catch (error) {
      console.error('Error fetching realtime data:', error)
    } finally {
      setRealtimeLoading(false)
    }
  }, [realtimeDate])

  // Fetch realtime when tab is active or date changes
  useEffect(() => {
    if (activeTab === 'realtime') {
      fetchRealtimeData()
    }
  }, [activeTab, realtimeDate, fetchRealtimeData])

  // Auto-refresh every 30 seconds when on realtime tab
  useEffect(() => {
    if (activeTab !== 'realtime' || !autoRefresh) return

    const interval = setInterval(() => {
      fetchRealtimeData()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [activeTab, autoRefresh, fetchRealtimeData])

  // Handler for clicking on a chart bar/point
  const handleChartClick = useCallback(async (dateStr: string) => {
    setOrdersLoading(true)
    setShowOrdersModal(true)
    setSelectedPeriodLabel(dateStr)

    try {
      const params = new URLSearchParams({
        date: dateStr,
        period,
        ...(selectedTerminalId && { terminalId: String(selectedTerminalId) })
      })

      const response = await fetch(`/api/market/reports/sales/orders?${params}`)
      const result = await response.json()

      if (result.success) {
        setSelectedDateOrders(result.data.orders)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setOrdersLoading(false)
    }
  }, [period, selectedTerminalId])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        period,
        ...(selectedTerminalId && { terminalId: String(selectedTerminalId) })
      })

      const response = await fetch(`/api/market/reports/sales?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching sales report:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const tabs = [
    { id: 'trend', label: 'Tendencia' },
    { id: 'products', label: 'Por Producto' },
    { id: 'categories', label: 'Por Categoría' },
    { id: 'terminals', label: 'Por Terminal' },
    { id: 'hours', label: 'Por Hora' },
    { id: 'payments', label: 'Por Método de Pago', icon: CreditCard },
    { id: 'realtime', label: 'Tiempo Real', icon: Zap }
  ]

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      'cash': 'Efectivo',
      'efectivo': 'Efectivo',
      'card': 'Tarjeta',
      'tarjeta': 'Tarjeta',
      'transfer': 'Transferencia',
      'transferencia': 'Transferencia',
      'credit': 'Crédito',
      'credito': 'Crédito'
    }
    return methods[method.toLowerCase()] || method
  }

  const getPaymentMethodIcon = (method: string) => {
    const icons: Record<string, React.ReactNode> = {
      'cash': <Banknote className="w-4 h-4" />,
      'efectivo': <Banknote className="w-4 h-4" />,
      'card': <CreditCard className="w-4 h-4" />,
      'tarjeta': <CreditCard className="w-4 h-4" />,
      'transfer': <Smartphone className="w-4 h-4" />,
      'transferencia': <Smartphone className="w-4 h-4" />,
      'credit': <Users className="w-4 h-4" />,
      'credito': <Users className="w-4 h-4" />
    }
    return icons[method.toLowerCase()] || <DollarSign className="w-4 h-4" />
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        {loading && !data ? (
          <div className="p-6">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
              <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                ))}
              </div>
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            </div>
          </div>
        ) : (
        <div className="p-6" ref={reportRef}>
          <ReportFilters
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            period={period}
            onPeriodChange={setPeriod}
            showPeriodSelector
            terminals={data?.byTerminal.map(t => ({ id: t.terminalId, name: t.terminalName })) || []}
            selectedTerminalId={selectedTerminalId}
            onTerminalChange={setSelectedTerminalId}
            showTerminalSelector
            onRefresh={fetchData}
            isLoading={loading}
            reportRef={reportRef}
            reportTitle="Reporte de Ventas"
          />

      {data && (
        <>
          <div className="mt-6">
            <ReportSummaryCards
              cards={[
                {
                  title: 'Ventas Totales',
                  value: formatCurrency(data.summary.totalSales),
                  icon: DollarSign,
                  change: data.summary.comparison.percentChange,
                  changeLabel: 'vs período anterior',
                  color: 'blue'
                },
                {
                  title: 'Órdenes',
                  value: data.summary.totalOrders,
                  icon: ShoppingCart,
                  subtitle: `${data.summary.daysWithSales} días con ventas`,
                  color: 'green'
                },
                {
                  title: 'Ticket Promedio',
                  value: formatCurrency(data.summary.averageTicket),
                  icon: TrendingUp,
                  color: 'purple'
                },
                {
                  title: 'Período Anterior',
                  value: formatCurrency(data.summary.comparison.previousPeriodSales),
                  icon: Users,
                  color: 'gray'
                }
              ]}
            />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? tab.id === 'realtime'
                      ? 'text-green-600 border-b-2 border-green-600'
                      : 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.id === 'realtime' && <Zap className="w-4 h-4" />}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            {activeTab === 'trend' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Ventas por {period === 'day' ? 'Día' : period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Año'}
                  <span className="text-sm font-normal text-gray-500 ml-2">(Click para ver detalles)</span>
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={data.byPeriod}
                    onClick={(e) => {
                      if (e && e.activePayload && e.activePayload[0]) {
                        handleChartClick(e.activePayload[0].payload.date)
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: 'inherit' }}
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        borderRadius: '8px',
                        border: '1px solid #374151',
                        color: '#f3f4f6',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                      }}
                      itemStyle={{ color: '#f3f4f6' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="sales" name="Ventas" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'products' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Top Productos</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.byProduct.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis type="number" stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <YAxis dataKey="productName" type="category" stroke="#6B7280" fontSize={11} width={150} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'var(--tooltip-bg, #1f2937)',
                          borderRadius: '8px',
                          border: '1px solid var(--tooltip-border, #374151)',
                          color: 'var(--tooltip-text, #f3f4f6)'
                        }}
                        itemStyle={{ color: '#f3f4f6' }}
                      />
                      <Bar dataKey="sales" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Ventas</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byProduct.slice(0, 10).map((product, i) => (
                          <TableRow key={product.productId || i}>
                            <TableCell className="font-medium">{product.productName}</TableCell>
                            <TableCell className="text-right">{product.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(product.sales)}</TableCell>
                            <TableCell className="text-right">{product.percentage}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Ventas por Categoría</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.byCategory}
                        dataKey="sales"
                        nameKey="categoryName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ categoryName, percentage }) => `${categoryName} (${percentage}%)`}
                      >
                        {data.byCategory.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'var(--tooltip-bg, #1f2937)',
                          borderRadius: '8px',
                          border: '1px solid var(--tooltip-border, #374151)',
                          color: 'var(--tooltip-text, #f3f4f6)'
                        }}
                        itemStyle={{ color: '#f3f4f6' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-right">Ventas</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byCategory.map((cat, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">
                              <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              {cat.categoryName}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(cat.sales)}</TableCell>
                            <TableCell className="text-right">{cat.percentage}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'terminals' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Rendimiento por Terminal</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.byTerminal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="terminalName" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        borderRadius: '8px',
                        border: '1px solid #374151',
                        color: '#f3f4f6',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                      }}
                      itemStyle={{ color: '#f3f4f6' }}
                    />
                    <Legend />
                    <Bar dataKey="sales" name="Ventas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Terminal</TableHead>
                        <TableHead className="text-right">Órdenes</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead className="text-right">Ticket Prom.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byTerminal.map((terminal) => (
                        <TableRow key={terminal.terminalId}>
                          <TableCell className="font-medium">{terminal.terminalName}</TableCell>
                          <TableCell className="text-right">{terminal.orders}</TableCell>
                          <TableCell className="text-right">{formatCurrency(terminal.sales)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(terminal.averageTicket)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {activeTab === 'hours' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Ventas por Hora del Día</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.byHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="hour" stroke="#6B7280" fontSize={12} tickFormatter={(h) => `${h}:00`} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === 'sales' ? formatCurrency(value) : value
                      }
                      labelFormatter={(h) => `${h}:00 - ${h}:59`}
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        borderRadius: '8px',
                        border: '1px solid #374151',
                        color: '#f3f4f6',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
                      }}
                      itemStyle={{ color: '#f3f4f6' }}
                    />
                    <Legend />
                    <Bar dataKey="sales" name="Ventas" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="orders" name="Órdenes" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'payments' && data && (
              <div className="space-y-6">
                {/* Payment Methods Summary - by currency */}
                {(() => {
                  const methods = data.byPaymentMethod || []
                  const totalOrders = methods.reduce((s, m) => s + parseInt(String(m.orders)), 0)
                  // Group totals by currency
                  const byCurrency: Record<string, { amount: number; orders: number }> = {}
                  methods.forEach(m => {
                    const cur = m.currency || 'USD'
                    if (!byCurrency[cur]) byCurrency[cur] = { amount: 0, orders: 0 }
                    byCurrency[cur].amount += parseFloat(String(m.amount))
                    byCurrency[cur].orders += parseInt(String(m.orders))
                  })
                  const currencies = Object.entries(byCurrency).sort((a, b) => b[1].amount - a[1].amount)

                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Total by each currency */}
                      {currencies.map(([cur, data]) => (
                        <div key={cur} className={cn('p-4 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                          <p className="text-xs text-gray-500 uppercase">Total {cur}</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {cur === 'CUP'
                              ? `${Math.round(data.amount).toLocaleString('es-ES')} CUP`
                              : `$${data.amount.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">{data.orders} transacciones</p>
                        </div>
                      ))}
                      {/* Total transactions */}
                      <div className={cn('p-4 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                        <p className="text-xs text-gray-500 uppercase">Total Transacciones</p>
                        <p className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{totalOrders}</p>
                      </div>
                      {/* Ticket promedio by currency */}
                      {currencies.map(([cur, data]) => (
                        <div key={`avg-${cur}`} className={cn('p-4 rounded-xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                          <p className="text-xs text-gray-500 uppercase">Ticket Prom. {cur}</p>
                          <p className={cn('text-xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                            {data.orders > 0
                              ? cur === 'CUP'
                                ? `${Math.round(data.amount / data.orders).toLocaleString('es-ES')} CUP`
                                : `$${(data.amount / data.orders).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`
                              : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Pie Chart + Table side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pie Chart */}
                  <div className={cn('p-5 rounded-2xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                    <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Distribución por Método de Pago
                    </h3>
                    {(() => {
                      const methods = data.byPaymentMethod || []
                      const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#eab308']
                      // Group by method (combine currencies)
                      const grouped = methods.reduce((acc, m) => {
                        const key = formatPaymentMethod(m.paymentMethod)
                        if (!acc[key]) acc[key] = { name: key, value: 0, orders: 0 }
                        acc[key].value += parseFloat(String(m.amount))
                        acc[key].orders += parseInt(String(m.orders))
                        return acc
                      }, {} as Record<string, { name: string; value: number; orders: number }>)
                      const pieData = Object.values(grouped).sort((a, b) => b.value - a.value)
                      const total = pieData.reduce((s, d) => s + d.value, 0)

                      return pieData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                                dataKey="value" nameKey="name" paddingAngle={3}>
                                {pieData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => formatCurrency(v)} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                          {/* Percentage labels */}
                          <div className="mt-4 space-y-2">
                            {pieData.map((d, i) => (
                              <div key={d.name} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                  <span className={cn('text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>{d.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-bold" style={{ color: COLORS[i % COLORS.length] }}>
                                    {total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%
                                  </span>
                                  <span className={cn('text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>{formatCurrency(d.value)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-500 text-center py-12">No hay datos de pagos para el periodo</p>
                      )
                    })()}
                  </div>

                  {/* Table */}
                  <div className={cn('p-5 rounded-2xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                    <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      Detalle por Método y Moneda
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className={cn('border-b', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')}>
                            <th className="text-left py-3 px-2 text-gray-500 font-medium">Método</th>
                            <th className="text-left py-3 px-2 text-gray-500 font-medium">Moneda</th>
                            <th className="text-right py-3 px-2 text-gray-500 font-medium">Órdenes</th>
                            <th className="text-right py-3 px-2 text-gray-500 font-medium">Monto</th>
                            <th className="text-right py-3 px-2 text-gray-500 font-medium">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const methods = data.byPaymentMethod || []
                            const total = methods.reduce((s, m) => s + parseFloat(String(m.amount)), 0)
                            return methods.length > 0 ? methods.map((m, i) => {
                              const amount = parseFloat(String(m.amount))
                              const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : '0'
                              return (
                                <tr key={i} className={cn('border-b', theme === 'dark' ? 'border-gray-700/50' : 'border-gray-100')}>
                                  <td className="py-3 px-2">
                                    <div className="flex items-center gap-2">
                                      {getPaymentMethodIcon(m.paymentMethod)}
                                      <span className={cn('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                        {formatPaymentMethod(m.paymentMethod)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-2">
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                      {m.currency}
                                    </span>
                                  </td>
                                  <td className="py-3 px-2 text-right font-medium text-gray-900 dark:text-white">{m.orders}</td>
                                  <td className="py-3 px-2 text-right font-bold text-orange-600">{formatCurrency(amount)}</td>
                                  <td className="py-3 px-2 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-xs text-gray-500 w-10 text-right">{pct}%</span>
                                    </div>
                                  </td>
                                </tr>
                              )
                            }) : (
                              <tr><td colSpan={5} className="text-center py-8 text-gray-500">No hay datos</td></tr>
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Bar Chart - Amount by method */}
                <div className={cn('p-5 rounded-2xl border', theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                  <h3 className={cn('font-semibold mb-4', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Comparativa de Montos
                  </h3>
                  {(() => {
                    const methods = data.byPaymentMethod || []
                    const barData = methods.map(m => ({
                      name: `${formatPaymentMethod(m.paymentMethod)} (${m.currency})`,
                      monto: parseFloat(String(m.amount)),
                      ordenes: parseInt(String(m.orders))
                    }))
                    return barData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={barData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#E5E7EB'} />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} />
                          <Bar dataKey="monto" name="Monto" fill="#f97316" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : null
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'realtime' && (
              <div className="space-y-6">
                {/* Header with date picker and refresh */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Zap className="w-6 h-6 text-green-500" />
                    <div>
                      <h3 className="text-lg font-semibold">Ventas en Tiempo Real</h3>
                      <p className="text-sm text-gray-500">
                        Por terminal y método de pago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      value={realtimeDate}
                      onChange={(e) => setRealtimeDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={() => setAutoRefresh(!autoRefresh)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                        autoRefresh
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                      Auto
                    </button>
                    <button
                      onClick={fetchRealtimeData}
                      disabled={realtimeLoading}
                      className="px-3 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${realtimeLoading ? 'animate-spin' : ''}`} />
                      Actualizar
                    </button>
                  </div>
                </div>

                {realtimeLoading && !realtimeData ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
                  </div>
                ) : realtimeData ? (
                  <>
                    {/* Last updated */}
                    <p className="text-xs text-gray-400 text-right">
                      Última actualización: {new Date(realtimeData.lastUpdated).toLocaleTimeString('es')}
                    </p>

                    {/* Grand Totals */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                        <p className="text-sm opacity-80">Total del Día</p>
                        <p className="text-2xl font-bold">{formatCurrency(realtimeData.grandTotal.sales)}</p>
                        <p className="text-sm opacity-80">{realtimeData.grandTotal.orders} órdenes</p>
                      </div>
                      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                        <p className="text-sm opacity-80">Efectivo USD</p>
                        <p className="text-2xl font-bold">{formatCurrency(realtimeData.currencyTotals.USD.cash)}</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                        <p className="text-sm opacity-80">Transferencias USD</p>
                        <p className="text-2xl font-bold">{formatCurrency(realtimeData.currencyTotals.USD.transfer)}</p>
                      </div>
                      <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
                        <p className="text-sm opacity-80">Efectivo CUP</p>
                        <p className="text-2xl font-bold">{realtimeData.currencyTotals.CUP.cash.toLocaleString()} CUP</p>
                      </div>
                    </div>

                    {/* Payment Method Totals */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-gray-500" />
                        Resumen por Método de Pago
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {realtimeData.paymentTotals.map((payment, i) => (
                          <div
                            key={i}
                            className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {getPaymentMethodIcon(payment.method)}
                              <span className="text-sm font-medium">
                                {formatPaymentMethod(payment.method)}
                              </span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
                                {payment.currency}
                              </span>
                            </div>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                              {payment.currency === 'CUP'
                                ? `${payment.amount.toLocaleString()} CUP`
                                : formatCurrency(payment.amount)}
                            </p>
                            <p className="text-xs text-gray-500">{payment.orders} órdenes</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Terminals Table */}
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-gray-500" />
                        Ventas por Terminal
                      </h4>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Terminal</TableHead>
                              <TableHead className="text-right">Órdenes</TableHead>
                              <TableHead className="text-right">Total USD</TableHead>
                              <TableHead className="text-center">Efectivo USD</TableHead>
                              <TableHead className="text-center">Transfer USD</TableHead>
                              <TableHead className="text-center">Tarjeta USD</TableHead>
                              <TableHead className="text-center">Efectivo CUP</TableHead>
                              <TableHead className="text-center">Transfer CUP</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {realtimeData.terminals.map((terminal) => {
                              // Group payment methods by type and currency
                              const getAmount = (method: string, currency: string) => {
                                const payment = terminal.byPaymentMethod.find(
                                  p => (p.method === method || p.method === method.toLowerCase()) && p.currency === currency
                                )
                                return payment?.amount || 0
                              }

                              return (
                                <TableRow key={terminal.terminalId}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{terminal.terminalName}</p>
                                      <p className="text-xs text-gray-500">{terminal.terminalCode}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {terminal.totalOrders}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                                    {formatCurrency(terminal.totalSales)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={getAmount('cash', 'USD') > 0 ? 'font-medium' : 'text-gray-400'}>
                                      {formatCurrency(getAmount('cash', 'USD'))}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={getAmount('transfer', 'USD') > 0 ? 'font-medium text-purple-600 dark:text-purple-400' : 'text-gray-400'}>
                                      {formatCurrency(getAmount('transfer', 'USD'))}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={getAmount('card', 'USD') > 0 ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-400'}>
                                      {formatCurrency(getAmount('card', 'USD'))}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={getAmount('cash', 'CUP') > 0 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-gray-400'}>
                                      {getAmount('cash', 'CUP').toLocaleString()} CUP
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={getAmount('transfer', 'CUP') > 0 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-gray-400'}>
                                      {getAmount('transfer', 'CUP').toLocaleString()} CUP
                                    </span>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                            {/* Totals row */}
                            <TableRow className="bg-gray-50 dark:bg-gray-900/50 font-bold">
                              <TableCell>TOTAL</TableCell>
                              <TableCell className="text-right">{realtimeData.grandTotal.orders}</TableCell>
                              <TableCell className="text-right text-green-600 dark:text-green-400">
                                {formatCurrency(realtimeData.grandTotal.sales)}
                              </TableCell>
                              <TableCell className="text-center">
                                {formatCurrency(realtimeData.currencyTotals.USD.cash)}
                              </TableCell>
                              <TableCell className="text-center text-purple-600 dark:text-purple-400">
                                {formatCurrency(realtimeData.currencyTotals.USD.transfer)}
                              </TableCell>
                              <TableCell className="text-center text-blue-600 dark:text-blue-400">
                                {formatCurrency(realtimeData.currencyTotals.USD.card)}
                              </TableCell>
                              <TableCell className="text-center text-amber-600 dark:text-amber-400">
                                {realtimeData.currencyTotals.CUP.cash.toLocaleString()} CUP
                              </TableCell>
                              <TableCell className="text-center text-amber-600 dark:text-amber-400">
                                {realtimeData.currencyTotals.CUP.transfer.toLocaleString()} CUP
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No hay datos disponibles</p>
                    <button
                      onClick={fetchRealtimeData}
                      className="mt-3 px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                    >
                      Cargar datos
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
        </div>
        )}

        {/* Orders Detail Modal */}
        <AnimatePresence>
          {showOrdersModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowOrdersModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-gray-800"
              >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600">
                  <div className="flex items-center gap-3 text-white">
                    <Receipt className="w-6 h-6" />
                    <div>
                      <h3 className="font-semibold text-lg">Órdenes del {selectedPeriodLabel}</h3>
                      <p className="text-sm text-blue-100">
                        {ordersLoading ? 'Cargando...' : `${selectedDateOrders.length} órdenes encontradas`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowOrdersModal(false)}
                    className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {ordersLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
                    </div>
                  ) : selectedDateOrders.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No hay órdenes para este período</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedDateOrders.map((order) => (
                        <div
                          key={order.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                          onClick={() => {
                            setShowOrdersModal(false)
                            router.push(`/dashboard/market/pos/orders/${order.id}`)
                          }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">{order.orderNumber}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  order.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                  order.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                                }`}>
                                  {order.status === 'paid' ? 'Pagado' : order.status === 'completed' ? 'Completado' : order.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                                <span className="mx-1">•</span>
                                {order.terminalName}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                                {formatCurrency(order.totalAmount)}
                              </p>
                              <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                                <CreditCard className="w-3 h-3" />
                                {order.payments.map((p, i) => (
                                  <span key={i}>
                                    {i > 0 && ', '}
                                    {p.method === 'cash' ? 'Efectivo' : p.method === 'card' ? 'Tarjeta' : p.method === 'transfer' ? 'Transferencia' : p.method}
                                    {p.currency !== 'USD' && ` (${p.currency})`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Products Preview */}
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex flex-wrap gap-2">
                              {order.lines.slice(0, 3).map((line, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm"
                                >
                                  {line.quantity}x {line.productName}
                                </span>
                              ))}
                              {order.lines.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-500">
                                  +{order.lines.length - 3} más
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Click hint */}
                          <div className="mt-3 flex items-center justify-end text-xs text-blue-500">
                            <span>Ver detalles</span>
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      {!ordersLoading && selectedDateOrders.length > 0 && (
                        <>
                          Total: <span className="font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(selectedDateOrders.reduce((sum, o) => sum + o.totalAmount, 0))}
                          </span>
                        </>
                      )}
                    </p>
                    <button
                      onClick={() => setShowOrdersModal(false)}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
