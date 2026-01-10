'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Receipt, ArrowRight } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { ReportFilters } from '@/components/market/reports/ReportFilters'
import { ReportHeader } from '@/components/market/reports/ReportHeader'
import { ReportSummaryCards } from '@/components/market/reports/ReportSummaryCards'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

interface ExpensesData {
  summary: {
    totalIncome: number
    cogs: number
    grossProfit: number
    totalExpenses: number
    netProfit: number
    profitMargin: number
    orderCount: number
    expenseCount: number
  }
  byCategory: Array<{
    categoryName: string
    accountingType: string
    amount: number
    count: number
    percentage: number
  }>
  byMonth: Array<{
    month: string
    income: number
    expenses: number
    profit: number
  }>
  recentExpenses: Array<{
    id: number
    description: string
    amount: number
    expenseDate: string
    vendorName: string
    categoryName: string
  }>
  breakdown: {
    revenue: number
    cogs: number
    grossProfit: number
    operatingExpenses: number
    netProfit: number
  }
}

export default function ExpensesReportPage() {
  const reportRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<ExpensesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'trend' | 'recent'>('overview')

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
      const response = await fetch(`/api/market/reports/expenses?${params}`)
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

  const tabs = [
    { id: 'overview', label: 'Estado de Resultados' },
    { id: 'categories', label: 'Por Categoría' },
    { id: 'trend', label: 'Tendencia' },
    { id: 'recent', label: 'Gastos Recientes' }
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
          <ReportHeader
            title="Reporte de Gastos"
        subtitle="Estado de resultados e ingresos vs gastos"
        onRefresh={fetchData}
        isLoading={loading}
        reportRef={reportRef}
      />

      <ReportFilters
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {data && (
        <>
          <div className="mt-6">
            <ReportSummaryCards
              cards={[
                {
                  title: 'Ingresos',
                  value: formatCurrency(data.summary.totalIncome),
                  subtitle: `${data.summary.orderCount} órdenes`,
                  icon: DollarSign,
                  color: 'blue'
                },
                {
                  title: 'Gastos Operativos',
                  value: formatCurrency(data.summary.totalExpenses),
                  subtitle: `${data.summary.expenseCount} gastos`,
                  icon: Receipt,
                  color: 'red'
                },
                {
                  title: 'Ganancia Neta',
                  value: formatCurrency(data.summary.netProfit),
                  icon: data.summary.netProfit >= 0 ? TrendingUp : TrendingDown,
                  color: data.summary.netProfit >= 0 ? 'green' : 'red'
                },
                {
                  title: 'Margen Neto',
                  value: `${data.summary.profitMargin.toFixed(1)}%`,
                  icon: TrendingUp,
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
            {activeTab === 'overview' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Estado de Resultados (P&L)</h3>
                <div className="max-w-md mx-auto space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">Ingresos por Ventas</span>
                    <span className="font-semibold text-blue-600">{formatCurrency(data.breakdown.revenue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">(-) Costo de Ventas</span>
                    <span className="font-semibold text-red-600">{formatCurrency(data.breakdown.cogs)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b bg-gray-50 dark:bg-gray-700/50 px-2 rounded">
                    <span className="font-medium">Ganancia Bruta</span>
                    <span className="font-bold text-green-600">{formatCurrency(data.breakdown.grossProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">(-) Gastos Operativos</span>
                    <span className="font-semibold text-red-600">{formatCurrency(data.breakdown.operatingExpenses)}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 px-3 rounded-lg">
                    <span className="font-bold text-lg">Ganancia Neta</span>
                    <span className={`font-bold text-xl ${data.breakdown.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(data.breakdown.netProfit)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Gastos por Categoría</h3>
                  {data.byCategory.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay gastos registrados</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={data.byCategory}
                          dataKey="amount"
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
                  )}
                </div>
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoría</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byCategory.map((cat, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            {cat.categoryName}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(cat.amount)}</TableCell>
                          <TableCell className="text-right">{cat.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {activeTab === 'trend' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Ingresos vs Gastos (12 meses)</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={data.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="income" name="Ingresos" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Gastos" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="profit" name="Ganancia" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'recent' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Gastos Recientes</h3>
                {data.recentExpenses.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay gastos registrados</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentExpenses.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell>{new Date(expense.expenseDate).toLocaleDateString('es')}</TableCell>
                            <TableCell className="font-medium">{expense.description}</TableCell>
                            <TableCell>{expense.vendorName || '-'}</TableCell>
                            <TableCell>{expense.categoryName}</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">{formatCurrency(expense.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
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
