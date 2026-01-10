'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { Percent, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { ReportFilters } from '@/components/market/reports/ReportFilters'
import { ReportSummaryCards } from '@/components/market/reports/ReportSummaryCards'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

interface MarginsData {
  summary: {
    totalRevenue: number
    totalCost: number
    grossProfit: number
    averageMargin: number
    productCount: number
    lowMarginCount: number
    highMarginCount: number
  }
  byProduct: Array<{
    productId: number
    productName: string
    category: string
    costPrice: number
    sellingPrice: number
    quantitySold: number
    totalRevenue: number
    totalCost: number
    grossProfit: number
    marginPercent: number
  }>
  byCategory: Array<{
    categoryName: string
    totalRevenue: number
    totalCost: number
    grossProfit: number
    marginPercent: number
    productCount: number
  }>
  trend: Array<{
    month: string
    revenue: number
    cost: number
    profit: number
    marginPercent: number
  }>
  alerts: {
    lowMargin: Array<{ productId: number; productName: string; marginPercent: number; quantitySold: number }>
    highMargin: Array<{ productId: number; productName: string; marginPercent: number; quantitySold: number }>
  }
}

export default function MarginsReportPage() {
  const reportRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<MarginsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'trend' | 'alerts'>('products')

  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchData()
  }, [startDate, endDate])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      const response = await fetch(`/api/market/reports/margins?${params}`)
      const result = await response.json()
      if (result.success) setData(result.data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getMarginColor = (margin: number) => {
    if (margin < 10) return 'text-red-600'
    if (margin < 20) return 'text-yellow-600'
    if (margin > 40) return 'text-blue-600'
    return 'text-green-600'
  }

  const tabs = [
    { id: 'products', label: 'Por Producto' },
    { id: 'categories', label: 'Por Categoría' },
    { id: 'trend', label: 'Tendencia' },
    { id: 'alerts', label: 'Alertas' }
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
        </div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6" ref={reportRef}>
          <ReportFilters
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onRefresh={fetchData}
            isLoading={loading}
            reportRef={reportRef}
            reportTitle="Reporte de Márgenes"
          />

      {data && (
        <>
          <div className="mt-6">
            <ReportSummaryCards
              cards={[
                {
                  title: 'Ingresos',
                  value: formatCurrency(data.summary.totalRevenue),
                  icon: DollarSign,
                  color: 'blue'
                },
                {
                  title: 'Costos',
                  value: formatCurrency(data.summary.totalCost),
                  icon: TrendingDown,
                  color: 'red'
                },
                {
                  title: 'Ganancia Bruta',
                  value: formatCurrency(data.summary.grossProfit),
                  icon: TrendingUp,
                  color: 'green'
                },
                {
                  title: 'Margen Promedio',
                  value: `${data.summary.averageMargin.toFixed(1)}%`,
                  subtitle: `${data.summary.productCount} productos vendidos`,
                  icon: Percent,
                  color: 'purple'
                }
              ]}
            />
          </div>

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

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            {activeTab === 'products' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Margen por Producto</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Vendido</TableHead>
                        <TableHead className="text-right">Ganancia</TableHead>
                        <TableHead className="text-right">Margen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byProduct.slice(0, 30).map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.category}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.sellingPrice)}</TableCell>
                          <TableCell className="text-right">{item.quantitySold}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.grossProfit)}</TableCell>
                          <TableCell className={`text-right font-medium ${getMarginColor(item.marginPercent)}`}>
                            {item.marginPercent.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Distribución por Categoría</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.byCategory}
                        dataKey="grossProfit"
                        nameKey="categoryName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ categoryName, marginPercent }) => `${categoryName} (${marginPercent.toFixed(0)}%)`}
                      >
                        {data.byCategory.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Ganancia</TableHead>
                        <TableHead className="text-right">Margen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byCategory.map((cat, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            {cat.categoryName}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(cat.grossProfit)}</TableCell>
                          <TableCell className={`text-right font-medium ${getMarginColor(cat.marginPercent)}`}>
                            {cat.marginPercent.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {activeTab === 'trend' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Tendencia de Márgenes (12 meses)</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={data.trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                    <YAxis yAxisId="left" stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#8B5CF6" fontSize={12} tickFormatter={(v) => `${v}%`} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="profit" name="Ganancia" stroke="#10B981" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="marginPercent" name="Margen %" stroke="#8B5CF6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-600">
                    <TrendingDown className="w-5 h-5" />
                    Margen Bajo (&lt;15%)
                  </h3>
                  {data.alerts.lowMargin.length === 0 ? (
                    <p className="text-gray-500">No hay productos con margen bajo</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Margen</TableHead>
                          <TableHead className="text-right">Vendido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.alerts.lowMargin.map((item) => (
                          <TableRow key={item.productId}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">{item.marginPercent}%</TableCell>
                            <TableCell className="text-right">{item.quantitySold}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-600">
                    <TrendingUp className="w-5 h-5" />
                    Margen Alto (&gt;40%)
                  </h3>
                  {data.alerts.highMargin.length === 0 ? (
                    <p className="text-gray-500">No hay productos con margen alto</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Margen</TableHead>
                          <TableHead className="text-right">Vendido</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.alerts.highMargin.map((item) => (
                          <TableRow key={item.productId}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell className="text-right text-blue-600 font-medium">{item.marginPercent}%</TableCell>
                            <TableCell className="text-right">{item.quantitySold}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
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
