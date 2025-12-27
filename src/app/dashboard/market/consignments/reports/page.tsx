'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Package,
  DollarSign,
  Users,
  TrendingUp,
  Warehouse,
  Clock,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCcw,
  BarChart3
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface DashboardData {
  kpis: {
    inventoryValue: number
    inventoryUnits: number
    productCount: number
    pendingPayments: number
    supplierCount: number
    totalConsigned: number
    totalSold: number
    totalPaid: number
  }
  orders: {
    pending: number
    received: number
    selling: number
    total: number
  }
  salesTrend: Array<{ date: string; amount: number }>
  topSuppliers: Array<{
    id: number
    code: string
    name: string
    totalSold: number
    totalConsigned: number
    orderCount: number
  }>
  topProducts: Array<{
    id: number
    name: string
    sku: string
    unitsSold: number
    totalValue: number
    stockAvailable: number
  }>
  salesBySupplier: Array<{ code: string; name: string; value: number }>
}

export default function ConsignmentReportsPage() {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/consignments/analytics/dashboard')
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch {
      console.error('Error fetching analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('es-US').format(value)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">Error al cargar datos</p>
      </div>
    )
  }

  const profitMargin = data.kpis.totalSold > 0
    ? ((data.kpis.totalSold - data.kpis.totalConsigned) / data.kpis.totalSold * 100)
    : 0

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reportes de Consignacion
          </h1>
          <p className="text-gray-500 mt-1">
            Dashboard con KPIs y estadisticas
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchData}
          className={cn(
            'p-2 rounded-xl transition-colors',
            theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
          )}
        >
          <RefreshCcw className="w-5 h-5 text-gray-500" />
        </motion.button>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Inventory Value */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-xl flex items-center justify-center">
              <Warehouse className="w-6 h-6 text-teal-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Valor en Consignacion</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(data.kpis.inventoryValue)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {formatNumber(data.kpis.inventoryUnits)} unidades • {data.kpis.productCount} productos
          </p>
        </motion.div>

        {/* Pending Payments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-amber-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Pendiente a Proveedores</p>
          <p className="text-2xl font-bold text-amber-600">
            {formatCurrency(data.kpis.pendingPayments)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {data.kpis.supplierCount} proveedores activos
          </p>
        </motion.div>

        {/* Total Sold */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Total Vendido</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(data.kpis.totalSold)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            de {formatCurrency(data.kpis.totalConsigned)} consignados
          </p>
        </motion.div>

        {/* Total Paid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">Total Pagado</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(data.kpis.totalPaid)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            a proveedores
          </p>
        </motion.div>
      </div>

      {/* Orders Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={cn(
          'p-5 rounded-2xl mb-6',
          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        )}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Estado de Ordenes
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
            <Clock className="w-6 h-6 text-amber-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-amber-600">{data.orders.pending}</p>
            <p className="text-sm text-gray-500">Pendientes</p>
          </div>
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <Package className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-blue-600">{data.orders.received}</p>
            <p className="text-sm text-gray-500">Recibidas</p>
          </div>
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
            <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{data.orders.selling}</p>
            <p className="text-sm text-gray-500">En Venta</p>
          </div>
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <BarChart3 className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.orders.total}</p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suppliers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Top Proveedores
          </h2>
          <div className="space-y-3">
            {data.topSuppliers.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Sin datos</p>
            ) : (
              data.topSuppliers.map((supplier, index) => (
                <div
                  key={supplier.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm',
                      index === 0 ? 'bg-amber-100 text-amber-600' :
                      index === 1 ? 'bg-gray-200 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-gray-500'
                    )}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{supplier.name}</p>
                      <p className="text-xs text-gray-500">{supplier.code} • {supplier.orderCount} ordenes</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(supplier.totalSold)}</p>
                    <p className="text-xs text-gray-500">de {formatCurrency(supplier.totalConsigned)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className={cn(
            'p-5 rounded-2xl',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Top Productos
          </h2>
          <div className="space-y-3">
            {data.topProducts.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Sin datos</p>
            ) : (
              data.topProducts.slice(0, 5).map((product, index) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm',
                      index === 0 ? 'bg-amber-100 text-amber-600' :
                      index === 1 ? 'bg-gray-200 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-gray-500'
                    )}>
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white line-clamp-1">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white">{formatNumber(product.unitsSold)} uds</p>
                    <p className="text-xs text-gray-500">{product.stockAvailable} disponibles</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Sales Trend */}
      {data.salesTrend.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className={cn(
            'p-5 rounded-2xl mt-6',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Ventas Ultimos 30 Dias
          </h2>
          <div className="h-48 flex items-end gap-1">
            {data.salesTrend.map((day, index) => {
              const maxAmount = Math.max(...data.salesTrend.map(d => d.amount))
              const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0

              return (
                <div
                  key={index}
                  className="flex-1 group relative"
                >
                  <div
                    className="bg-gradient-to-t from-teal-500 to-cyan-400 rounded-t transition-all group-hover:from-teal-600 group-hover:to-cyan-500"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {formatCurrency(day.amount)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Sales by Supplier Distribution */}
      {data.salesBySupplier.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className={cn(
            'p-5 rounded-2xl mt-6',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Distribucion de Ventas por Proveedor
          </h2>
          <div className="space-y-3">
            {data.salesBySupplier.map((supplier, index) => {
              const total = data.salesBySupplier.reduce((sum, s) => sum + s.value, 0)
              const percentage = total > 0 ? (supplier.value / total) * 100 : 0
              const colors = [
                'bg-teal-500', 'bg-blue-500', 'bg-purple-500',
                'bg-amber-500', 'bg-rose-500', 'bg-indigo-500'
              ]

              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {supplier.name} ({supplier.code})
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatCurrency(supplier.value)} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, delay: 0.1 * index }}
                      className={cn('h-full rounded-full', colors[index % colors.length])}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
