'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { Percent, DollarSign, TrendingUp, TrendingDown, ChevronDown, ChevronRight, ChevronLeft, Package, Loader2, Search, X } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { ReportFilters } from '@/components/market/reports/ReportFilters'
import { ReportSummaryCards } from '@/components/market/reports/ReportSummaryCards'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

interface ProductMargin {
  productId: number
  productName: string
  category: string
  quantitySold: number
  totalRevenue: number
  totalCost: number
  grossProfit: number
  marginPercent: number
  costVariationCount: number
}

interface CostVariation {
  unitCost: number
  label: string
  quantity: number
  revenue: number
  cost: number
  profit: number
  marginPercent: number
  orderCount: number
  channel: 'POS' | 'Mayoreo'
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

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
  byProduct: ProductMargin[]
  pagination: Pagination
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

const CHANNEL_COLORS: Record<string, string> = {
  'POS': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Mayoreo': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
}

export default function MarginsReportPage() {
  const reportRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<MarginsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'trend' | 'alerts'>('products')

  // Pagination state
  const [page, setPage] = useState(1)
  const limit = 25

  // Search state
  const [searchTerm, setSearchTerm] = useState('')

  // Expandable rows state
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [productCostVariations, setProductCostVariations] = useState<Record<number, CostVariation[]>>({})
  const [loadingVariations, setLoadingVariations] = useState<Set<number>>(new Set())

  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const fetchData = useCallback(async (currentPage: number = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        page: currentPage.toString(),
        limit: limit.toString()
      })
      const response = await fetch(`/api/market/reports/margins?${params}`)
      const result = await response.json()
      if (result.success) {
        setData(result.data)
        // Clear expanded products when page changes
        setExpandedProducts(new Set())
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, limit])

  useEffect(() => {
    fetchData(page)
  }, [page, fetchData])

  // Fetch cost variations for a product (lazy loading)
  const fetchCostVariations = async (productId: number) => {
    if (productCostVariations[productId]) return // Already loaded

    setLoadingVariations(prev => new Set(prev).add(productId))
    try {
      const params = new URLSearchParams({
        productId: productId.toString(),
        startDate,
        endDate
      })
      const response = await fetch(`/api/market/reports/margins/lots?${params}`)
      const result = await response.json()
      if (result.success) {
        setProductCostVariations(prev => ({ ...prev, [productId]: result.data.costVariations }))
      }
    } catch (error) {
      console.error('Error fetching cost variations:', error)
    } finally {
      setLoadingVariations(prev => {
        const newSet = new Set(prev)
        newSet.delete(productId)
        return newSet
      })
    }
  }

  const toggleExpand = (productId: number, variationCount: number) => {
    if (variationCount === 0) return // No variations to show

    setExpandedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
        // Fetch cost variations if not already loaded
        fetchCostVariations(productId)
      }
      return newSet
    })
  }

  const handleDateChange = () => {
    setPage(1)
    setProductCostVariations({})
    setExpandedProducts(new Set())
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
    { id: 'categories', label: 'Por Categoria' },
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
            onStartDateChange={(d) => { setStartDate(d); handleDateChange() }}
            onEndDateChange={(d) => { setEndDate(d); handleDateChange() }}
            onRefresh={() => fetchData(page)}
            isLoading={loading}
            reportRef={reportRef}
            reportTitle="Reporte de Margenes"
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <h3 className="text-lg font-semibold">Margen por Producto (Costo Historico)</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar producto..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-8 py-2 w-full sm:w-64 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Los margenes se calculan usando el costo al momento de cada venta, no el costo actual del producto.
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Vendido</TableHead>
                        <TableHead className="text-right">Ingresos</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                        <TableHead className="text-right">Ganancia</TableHead>
                        <TableHead className="text-right">Margen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byProduct
                        .filter(item =>
                          searchTerm === '' ||
                          item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.category.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((item) => {
                        const isExpanded = expandedProducts.has(item.productId)
                        const isLoadingVariation = loadingVariations.has(item.productId)
                        const variations = productCostVariations[item.productId] || []
                        const hasVariations = item.costVariationCount > 1

                        return (
                          <React.Fragment key={item.productId}>
                            <TableRow
                              onClick={() => hasVariations ? toggleExpand(item.productId, item.costVariationCount) : null}
                              className={`${hasVariations ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''} transition-colors`}
                            >
                              <TableCell className="w-8 p-2">
                                {hasVariations && (
                                  isExpanded
                                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {item.productName}
                                  {hasVariations && (
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      <Package className="w-3 h-3" />
                                      {item.costVariationCount} costos
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{item.category}</TableCell>
                              <TableCell className="text-right">{item.quantitySold}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.totalRevenue)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.totalCost)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.grossProfit)}</TableCell>
                              <TableCell className={`text-right font-medium ${getMarginColor(item.marginPercent)}`}>
                                {item.marginPercent.toFixed(1)}%
                              </TableCell>
                            </TableRow>

                            {/* Expanded cost variations */}
                            <AnimatePresence>
                              {isExpanded && (
                                <TableRow>
                                  <TableCell colSpan={8} className="p-0 border-0">
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="bg-gray-50 dark:bg-gray-900/50 px-8 py-4 border-l-4 border-blue-500">
                                        <h4 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
                                          Desglose por Costo de Compra
                                        </h4>
                                        {isLoadingVariation ? (
                                          <div className="flex items-center gap-2 text-gray-500 py-4">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Cargando detalles...
                                          </div>
                                        ) : variations.length === 0 ? (
                                          <p className="text-gray-500 text-sm py-2">No hay variaciones de costo disponibles</p>
                                        ) : (
                                          <Table>
                                            <TableHeader>
                                              <TableRow className="hover:bg-transparent">
                                                <TableHead className="text-xs">Costo Unit.</TableHead>
                                                <TableHead className="text-xs">Canal</TableHead>
                                                <TableHead className="text-xs text-right">Cantidad</TableHead>
                                                <TableHead className="text-xs text-right">Ingresos</TableHead>
                                                <TableHead className="text-xs text-right">Costo Total</TableHead>
                                                <TableHead className="text-xs text-right">Ganancia</TableHead>
                                                <TableHead className="text-xs text-right">Margen</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {variations.map((variation, idx) => (
                                                <TableRow key={idx} className="hover:bg-gray-100 dark:hover:bg-gray-800/50">
                                                  <TableCell className="font-mono text-xs font-semibold">
                                                    {variation.label}
                                                  </TableCell>
                                                  <TableCell>
                                                    <Badge className={`text-xs ${CHANNEL_COLORS[variation.channel]}`}>
                                                      {variation.channel}
                                                    </Badge>
                                                  </TableCell>
                                                  <TableCell className="text-right text-xs">
                                                    {variation.quantity}
                                                  </TableCell>
                                                  <TableCell className="text-right text-xs">
                                                    {formatCurrency(variation.revenue)}
                                                  </TableCell>
                                                  <TableCell className="text-right text-xs">
                                                    {formatCurrency(variation.cost)}
                                                  </TableCell>
                                                  <TableCell className="text-right text-xs">
                                                    {formatCurrency(variation.profit)}
                                                  </TableCell>
                                                  <TableCell className={`text-right text-xs font-medium ${getMarginColor(variation.marginPercent)}`}>
                                                    {variation.marginPercent.toFixed(1)}%
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        )}
                                      </div>
                                    </motion.div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {data.pagination && (
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {((data.pagination.page - 1) * data.pagination.limit) + 1} - {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} de {data.pagination.total} productos
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1 || loading}
                        onClick={() => setPage(p => p - 1)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm px-3">
                        Pagina {page} de {data.pagination.totalPages || 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= (data.pagination.totalPages || 1) || loading}
                        onClick={() => setPage(p => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'categories' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Distribucion por Categoria</h3>
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
                        <TableHead>Categoria</TableHead>
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
                <h3 className="text-lg font-semibold mb-4">Tendencia de Margenes (12 meses)</h3>
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
