'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { ReportFilters } from '@/components/market/reports/ReportFilters'
import { ReportHeader } from '@/components/market/reports/ReportHeader'
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

export default function SalesReportPage() {
  const reportRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trend' | 'products' | 'categories' | 'terminals' | 'hours'>('trend')

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

  if (loading && !data) {
    return (
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
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6" ref={reportRef}>
          <ReportHeader
        title="Reporte de Ventas"
        subtitle={`${startDate} - ${endDate}`}
        onRefresh={fetchData}
        isLoading={loading}
        reportRef={reportRef}
      />

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
                <h3 className="text-lg font-semibold mb-4">Ventas por {period === 'day' ? 'Día' : period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Año'}</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={data.byPeriod}>
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
      </DashboardLayout>
    </ProtectedRoute>
  )
}
