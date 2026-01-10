'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line
} from 'recharts'
import { Monitor, DollarSign, ShoppingCart, TrendingUp, Clock } from 'lucide-react'
import { ReportFilters } from '@/components/market/reports/ReportFilters'
import { ReportHeader } from '@/components/market/reports/ReportHeader'
import { ReportSummaryCards } from '@/components/market/reports/ReportSummaryCards'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

interface TerminalsData {
  summary: {
    totalTerminals: number
    activeTerminals: number
    totalSales: number
    totalOrders: number
    averagePerTerminal: number
  }
  byTerminal: Array<{
    terminalId: number
    terminalName: string
    terminalCode: string
    warehouseName: string
    orderCount: number
    totalSales: number
    averageTicket: number
    sessionCount: number
    activeDays: number
    lastSaleAt: string
    comparison: {
      previousPeriodSales: number
      previousPeriodOrders: number
      percentChange: number
    }
    topProducts: Array<{
      productId: number
      productName: string
      quantity: number
      sales: number
    }>
  }>
  byDayOfWeek: Array<{
    dayOfWeek: number
    dayName: string
    terminals: Array<{
      terminalId: number
      terminalName: string
      orderCount: number
      sales: number
    }>
  }>
  byHour: Array<{
    hour: number
    terminals: Array<{
      terminalId: number
      orderCount: number
      sales: number
    }>
  }>
  dailyTrend: Array<{
    date: string
    terminals: Array<{
      terminalId: number
      sales: number
      orders: number
    }>
  }>
}

export default function POSTerminalsReportPage() {
  const reportRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<TerminalsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'dayofweek' | 'hourly'>('overview')

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
      const response = await fetch(`/api/market/reports/pos-terminals?${params}`)
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
    { id: 'overview', label: 'Resumen' },
    { id: 'comparison', label: 'Comparativo' },
    { id: 'dayofweek', label: 'Por Día' },
    { id: 'hourly', label: 'Por Hora' }
  ]

  // Prepare daily trend data for chart
  const dailyTrendChartData = data?.dailyTrend.map(day => {
    const result: any = { date: day.date }
    day.terminals.forEach(t => {
      const terminal = data.byTerminal.find(bt => bt.terminalId === t.terminalId)
      if (terminal) {
        result[terminal.terminalName] = t.sales
      }
    })
    return result
  }) || []

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
    <div className="p-6" ref={reportRef}>
      <ReportHeader
        title="Reporte por Terminal POS"
        subtitle="Rendimiento y comparativo entre terminales"
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
                  title: 'Terminales Activas',
                  value: `${data.summary.activeTerminals} / ${data.summary.totalTerminals}`,
                  icon: Monitor,
                  color: 'blue'
                },
                {
                  title: 'Ventas Totales',
                  value: formatCurrency(data.summary.totalSales),
                  icon: DollarSign,
                  color: 'green'
                },
                {
                  title: 'Órdenes Totales',
                  value: data.summary.totalOrders,
                  icon: ShoppingCart,
                  color: 'purple'
                },
                {
                  title: 'Promedio por Terminal',
                  value: formatCurrency(data.summary.averagePerTerminal),
                  icon: TrendingUp,
                  color: 'yellow'
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
                <h3 className="text-lg font-semibold mb-4">Rendimiento por Terminal</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Terminal</TableHead>
                        <TableHead>Almacén</TableHead>
                        <TableHead className="text-right">Órdenes</TableHead>
                        <TableHead className="text-right">Ventas</TableHead>
                        <TableHead className="text-right">Ticket Prom.</TableHead>
                        <TableHead className="text-right">Sesiones</TableHead>
                        <TableHead className="text-right">Cambio %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byTerminal.map((terminal) => (
                        <TableRow key={terminal.terminalId}>
                          <TableCell>
                            <div className="font-medium">{terminal.terminalName}</div>
                            <div className="text-xs text-gray-500">{terminal.terminalCode}</div>
                          </TableCell>
                          <TableCell>{terminal.warehouseName || '-'}</TableCell>
                          <TableCell className="text-right">{terminal.orderCount}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(terminal.totalSales)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(terminal.averageTicket)}</TableCell>
                          <TableCell className="text-right">{terminal.sessionCount}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-medium ${
                              terminal.comparison.percentChange > 0 ? 'text-green-600' :
                              terminal.comparison.percentChange < 0 ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              {terminal.comparison.percentChange > 0 ? '+' : ''}
                              {terminal.comparison.percentChange.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Top Products by Terminal */}
                <h3 className="text-lg font-semibold mt-8 mb-4">Top Productos por Terminal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.byTerminal.filter(t => t.topProducts.length > 0).map((terminal) => (
                    <div key={terminal.terminalId} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">{terminal.terminalName}</h4>
                      <ul className="space-y-1 text-sm">
                        {terminal.topProducts.slice(0, 5).map((product, i) => (
                          <li key={product.productId} className="flex justify-between">
                            <span className="text-gray-600">{i + 1}. {product.productName}</span>
                            <span className="font-medium">{formatCurrency(product.sales)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'comparison' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Comparativo de Ventas</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={data.byTerminal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="terminalName" stroke="#6B7280" fontSize={12} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="totalSales" name="Ventas Actuales" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="comparison.previousPeriodSales" name="Período Anterior" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                {/* Daily Trend */}
                <h3 className="text-lg font-semibold mt-8 mb-4">Tendencia Diaria</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyTrendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis dataKey="date" stroke="#6B7280" fontSize={10} />
                    <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    {data.byTerminal.map((terminal, i) => (
                      <Line
                        key={terminal.terminalId}
                        type="monotone"
                        dataKey={terminal.terminalName}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'dayofweek' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Ventas por Día de la Semana</h3>
                {data.byDayOfWeek.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay datos suficientes</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Día</TableHead>
                          {data.byTerminal.map(t => (
                            <TableHead key={t.terminalId} className="text-right">{t.terminalName}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.byDayOfWeek.map((day) => (
                          <TableRow key={day.dayOfWeek}>
                            <TableCell className="font-medium">{day.dayName}</TableCell>
                            {data.byTerminal.map(t => {
                              const terminalData = day.terminals.find(dt => dt.terminalId === t.terminalId)
                              return (
                                <TableCell key={t.terminalId} className="text-right">
                                  {terminalData ? formatCurrency(terminalData.sales) : '-'}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'hourly' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Ventas por Hora del Día</h3>
                {data.byHour.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No hay datos suficientes</p>
                ) : (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={data.byHour.map(h => {
                      const result: any = { hour: `${h.hour}:00` }
                      h.terminals.forEach(t => {
                        const terminal = data.byTerminal.find(bt => bt.terminalId === t.terminalId)
                        if (terminal) result[terminal.terminalName] = t.sales
                      })
                      return result
                    })}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                      <XAxis dataKey="hour" stroke="#6B7280" fontSize={12} />
                      <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      {data.byTerminal.map((terminal, i) => (
                        <Bar
                          key={terminal.terminalId}
                          dataKey={terminal.terminalName}
                          fill={COLORS[i % COLORS.length]}
                          stackId="a"
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  )
}
