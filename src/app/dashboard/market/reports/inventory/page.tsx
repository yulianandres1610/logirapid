'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import {
  Package, AlertTriangle, Clock, DollarSign, TrendingDown, TrendingUp
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { ReportFilters } from '@/components/market/reports/ReportFilters'
import { ReportHeader } from '@/components/market/reports/ReportHeader'
import { ReportSummaryCards } from '@/components/market/reports/ReportSummaryCards'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

interface InventoryData {
  summary: {
    totalProducts: number
    productsInStock: number
    lowStockCount: number
    outOfStockCount: number
    totalValue: number
    expiringCount: number
    expiringValue: number
    expiringUnits: number
    highRotationCount: number
    slowMovingCount: number
  }
  expiring: Array<{
    productId: number
    productName: string
    barcode: string
    lotNumber: string
    expirationDate: string
    daysUntilExpiration: number
    quantity: number
    unitCost: number
    value: number
    sourceType: string
    warehouseName: string
  }>
  rotation: Array<{
    productId: number
    productName: string
    barcode: string
    quantityOnHand: number
    costPrice: number
    totalSold30d: number
    salesVelocity: number
    daysOfStock: number
    totalPurchased30d: number
    purchaseVelocity: number
  }>
  valuation: {
    byWarehouse: Array<{
      warehouseId: number
      warehouseName: string
      productCount: number
      totalUnits: number
      totalValue: number
    }>
    byCategory: Array<{
      categoryName: string
      productCount: number
      totalUnits: number
      totalValue: number
    }>
  }
  lowStock: Array<{
    productId: number
    productName: string
    barcode: string
    quantityOnHand: number
    minimumStock: number
    deficit: number
  }>
  alerts: {
    expiringSoon: number
    alreadyExpired: number
    criticalLowStock: number
  }
}

export default function InventoryReportPage() {
  const reportRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'expiring' | 'rotation' | 'valuation' | 'lowstock'>('expiring')
  const [expiringDays, setExpiringDays] = useState(30)

  useEffect(() => {
    fetchData()
  }, [expiringDays])

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ expiringDays: String(expiringDays) })
      const response = await fetch(`/api/market/reports/inventory?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching inventory report:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) =>
    `$${value.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getExpirationColor = (days: number) => {
    if (days < 0) return 'text-red-600 bg-red-50'
    if (days <= 7) return 'text-orange-600 bg-orange-50'
    if (days <= 15) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  const getRotationColor = (daysOfStock: number) => {
    if (daysOfStock <= 7) return 'text-red-600'
    if (daysOfStock <= 15) return 'text-orange-600'
    if (daysOfStock > 60) return 'text-blue-600'
    return 'text-green-600'
  }

  const tabs = [
    { id: 'expiring', label: 'Por Vencer', icon: Clock },
    { id: 'rotation', label: 'Rotación', icon: TrendingUp },
    { id: 'valuation', label: 'Valorización', icon: DollarSign },
    { id: 'lowstock', label: 'Stock Bajo', icon: AlertTriangle }
  ]

  if (loading && !data) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="grid grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
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
            title="Análisis de Inventario"
        subtitle="Expiración, rotación y valorización de productos"
        onRefresh={fetchData}
        isLoading={loading}
        reportRef={reportRef}
      />

      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">Mostrar productos que vencen en:</span>
          <select
            value={expiringDays}
            onChange={(e) => setExpiringDays(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
          >
            <option value={7}>7 días</option>
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
            <option value={90}>90 días</option>
          </select>
        </div>
      </div>

      {data && (
        <>
          {/* Alerts Banner */}
          {(data.alerts.alreadyExpired > 0 || data.alerts.expiringSoon > 0) && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">Alertas de Inventario:</span>
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                {data.alerts.alreadyExpired > 0 && (
                  <span className="text-red-600">{data.alerts.alreadyExpired} productos ya vencidos</span>
                )}
                {data.alerts.expiringSoon > 0 && (
                  <span className="text-orange-600">{data.alerts.expiringSoon} vencen en 7 días</span>
                )}
                {data.alerts.criticalLowStock > 0 && (
                  <span className="text-yellow-600">{data.alerts.criticalLowStock} con stock crítico (≤5)</span>
                )}
              </div>
            </div>
          )}

          <ReportSummaryCards
            columns={5}
            cards={[
              {
                title: 'Valor Total',
                value: formatCurrency(data.summary.totalValue),
                icon: DollarSign,
                color: 'blue'
              },
              {
                title: 'Productos en Stock',
                value: data.summary.productsInStock,
                subtitle: `de ${data.summary.totalProducts} totales`,
                icon: Package,
                color: 'green'
              },
              {
                title: 'Por Vencer',
                value: data.summary.expiringCount,
                subtitle: formatCurrency(data.summary.expiringValue),
                icon: Clock,
                color: data.summary.expiringCount > 0 ? 'red' : 'gray'
              },
              {
                title: 'Stock Bajo',
                value: data.summary.lowStockCount,
                icon: AlertTriangle,
                color: data.summary.lowStockCount > 0 ? 'yellow' : 'gray'
              },
              {
                title: 'Baja Rotación',
                value: data.summary.slowMovingCount,
                subtitle: '>60 días de stock',
                icon: TrendingDown,
                color: 'purple'
              }
            ]}
          />

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
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
            {activeTab === 'expiring' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Productos Próximos a Vencer ({data.expiring.length})
                </h3>
                {data.expiring.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No hay productos próximos a vencer en los próximos {expiringDays} días
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead>Almacén</TableHead>
                          <TableHead className="text-center">Días</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Origen</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.expiring.map((item, i) => (
                          <TableRow key={`${item.productId}-${item.lotNumber}-${i}`}>
                            <TableCell>
                              <div className="font-medium">{item.productName}</div>
                              <div className="text-xs text-gray-500">{item.barcode}</div>
                            </TableCell>
                            <TableCell>{item.lotNumber}</TableCell>
                            <TableCell>{item.warehouseName}</TableCell>
                            <TableCell className="text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getExpirationColor(item.daysUntilExpiration)}`}>
                                {item.daysUntilExpiration < 0
                                  ? `Vencido hace ${Math.abs(item.daysUntilExpiration)}d`
                                  : `${item.daysUntilExpiration}d`
                                }
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${
                                item.sourceType === 'consignación'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {item.sourceType}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'rotation' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Análisis de Rotación (últimos 30 días)</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Vendido 30d</TableHead>
                        <TableHead className="text-right">Vel. Venta</TableHead>
                        <TableHead className="text-right">Días Stock</TableHead>
                        <TableHead className="text-right">Comprado 30d</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rotation.slice(0, 30).map((item) => (
                        <TableRow key={item.productId}>
                          <TableCell>
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-xs text-gray-500">{item.barcode}</div>
                          </TableCell>
                          <TableCell className="text-right">{item.quantityOnHand}</TableCell>
                          <TableCell className="text-right">{item.totalSold30d}</TableCell>
                          <TableCell className="text-right">{item.salesVelocity}/día</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-medium ${getRotationColor(item.daysOfStock)}`}>
                              {item.daysOfStock >= 999 ? '∞' : `${item.daysOfStock}d`}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{item.totalPurchased30d}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {activeTab === 'valuation' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Valorización del Inventario</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Por Almacén</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={data.valuation.byWarehouse} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                        <XAxis type="number" stroke="#6B7280" fontSize={12} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                        <YAxis dataKey="warehouseName" type="category" stroke="#6B7280" fontSize={11} width={100} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="totalValue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Por Categoría</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={data.valuation.byCategory}
                          dataKey="totalValue"
                          nameKey="categoryName"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ categoryName }) => categoryName}
                        >
                          {data.valuation.byCategory.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'lowstock' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Productos con Stock Bajo ({data.lowStock.length})</h3>
                {data.lowStock.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No hay productos con stock bajo
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Stock Actual</TableHead>
                          <TableHead className="text-right">Mínimo</TableHead>
                          <TableHead className="text-right">Déficit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.lowStock.map((item) => (
                          <TableRow key={item.productId}>
                            <TableCell>
                              <div className="font-medium">{item.productName}</div>
                              <div className="text-xs text-gray-500">{item.barcode}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={item.quantityOnHand <= 5 ? 'text-red-600 font-bold' : ''}>
                                {item.quantityOnHand}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">{item.minimumStock}</TableCell>
                            <TableCell className="text-right text-red-600">-{item.deficit}</TableCell>
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
