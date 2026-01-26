'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { DollarSign, ShoppingCart, TrendingUp, Users, X, Receipt, Clock, CreditCard, ExternalLink } from 'lucide-react'
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

export default function SalesReportPage() {
  const router = useRouter()
  const reportRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trend' | 'products' | 'categories' | 'terminals' | 'hours'>('trend')

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
    { id: 'hours', label: 'Por Hora' }
  ]

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
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
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
                      labelStyle={{ color: '#111827' }}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}
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
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
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
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
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
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
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
                    />
                    <Legend />
                    <Bar dataKey="sales" name="Ventas" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="orders" name="Órdenes" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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
