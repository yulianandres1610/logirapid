'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Package,
  DollarSign,
  AlertTriangle,
  XCircle,
  Eye,
  X,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Filter,
  Loader2
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface StockReportViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
}

interface Product {
  productId: number
  variantId: number | null
  name: string
  sku: string
  barcode: string
  category: string
  imageUrl: string | null
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
  costPrice: number
  sellingPrice: number
  totalCostValue: number
  totalSellingValue: number
  minimumStock: number
}

interface Summary {
  totalProducts: number
  totalUnits: number
  totalValue: number
  totalSellingValue: number
  inStock: number
  lowStock: number
  outOfStock: number
}

interface Movement {
  id: number
  date: string
  type: string
  typeLabel: string
  quantity: number
  stockBefore: number
  stockAfter: number
  reference: string | null
  fromWarehouse: string | null
  toWarehouse: string | null
  user: string
  notes: string | null
}

interface MovementModalData {
  product: { id: number; name: string; sku: string; barcode: string }
  currentStock: number
  movements: Movement[]
}

export default function StockReportView({ warehouseId, warehouseName, onBack }: StockReportViewProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data
  const [summary, setSummary] = useState<Summary | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })

  // Filters
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [stockFilter, setStockFilter] = useState('all')

  // Movement modal
  const [movementModal, setMovementModal] = useState<{ show: boolean; productId: number; variantId: number | null } | null>(null)
  const [movementData, setMovementData] = useState<MovementModalData | null>(null)
  const [loadingMovements, setLoadingMovements] = useState(false)

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch stock report
  const fetchReport = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })

      if (debouncedSearch) params.append('search', debouncedSearch)
      if (selectedCategory) params.append('category', selectedCategory)
      if (stockFilter !== 'all') params.append('stockFilter', stockFilter)

      const response = await fetch(`/api/market/warehouses/${warehouseId}/stock-report?${params}`)
      const data = await response.json()

      if (data.success) {
        setSummary(data.data.summary)
        setProducts(data.data.products)
        setCategories(data.data.categories || [])
        setPagination(data.data.pagination)
      } else {
        setError(data.error || 'Error al cargar reporte')
      }
    } catch (err) {
      setError('Error de conexión')
      console.error('Error fetching stock report:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [warehouseId, pagination.page, pagination.limit, debouncedSearch, selectedCategory, stockFilter])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  // Reset page when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [debouncedSearch, selectedCategory, stockFilter])

  // Fetch movements for a product
  const fetchMovements = async (productId: number, variantId: number | null) => {
    setLoadingMovements(true)
    try {
      const params = new URLSearchParams({ productId: productId.toString() })
      if (variantId) params.append('variantId', variantId.toString())

      const response = await fetch(`/api/market/warehouses/${warehouseId}/product-movements?${params}`)
      const data = await response.json()

      if (data.success) {
        setMovementData(data.data)
      }
    } catch (err) {
      console.error('Error fetching movements:', err)
    } finally {
      setLoadingMovements(false)
    }
  }

  const openMovementModal = (product: Product) => {
    setMovementModal({ show: true, productId: product.productId, variantId: product.variantId })
    fetchMovements(product.productId, product.variantId)
  }

  const closeMovementModal = () => {
    setMovementModal(null)
    setMovementData(null)
  }

  // Export to CSV
  const exportToCSV = () => {
    if (!products.length) return

    const headers = ['Producto', 'SKU', 'Codigo', 'Categoria', 'Stock', 'Reservado', 'Disponible', 'Costo Unit', 'Precio Venta', 'Valor Costo', 'Valor Venta']
    const rows = products.map(p => [
      p.name,
      p.sku,
      p.barcode,
      p.category,
      p.quantityOnHand,
      p.quantityReserved,
      p.quantityAvailable,
      p.costPrice.toFixed(2),
      p.sellingPrice.toFixed(2),
      p.totalCostValue.toFixed(2),
      p.totalSellingValue.toFixed(2)
    ])

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-stock-${warehouseName}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getStockBadge = (product: Product) => {
    if (product.quantityOnHand === 0) {
      return { label: 'Sin Stock', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
    }
    if (product.quantityOnHand <= product.minimumStock) {
      return { label: 'Stock Bajo', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
    }
    return { label: 'En Stock', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">Cargando reporte...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <XCircle className="w-12 h-12 text-red-500" />
        <p className="text-gray-600 dark:text-gray-300">{error}</p>
        <button
          onClick={() => fetchReport()}
          className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={cn(
              'p-2 rounded-lg border transition-colors',
              theme === 'dark'
                ? 'border-gray-700 hover:bg-gray-800'
                : 'border-gray-200 hover:bg-gray-100'
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Reporte de Stock
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{warehouseName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReport(true)}
            disabled={refreshing}
            className={cn(
              'p-2 rounded-lg border transition-colors',
              theme === 'dark'
                ? 'border-gray-700 hover:bg-gray-800'
                : 'border-gray-200 hover:bg-gray-100'
            )}
          >
            <RefreshCw className={cn('w-5 h-5', refreshing && 'animate-spin')} />
          </button>
          <button
            onClick={exportToCSV}
            disabled={!products.length}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-4 rounded-xl border',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary.totalProducts.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Productos</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={cn(
              'p-4 rounded-xl border',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${summary.totalValue.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Valor (Costo)</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'p-4 rounded-xl border',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary.lowStock}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Stock Bajo</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={cn(
              'p-4 rounded-xl border',
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {summary.outOfStock}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sin Stock</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className={cn(
        'flex flex-wrap gap-3 p-4 rounded-xl border',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2 rounded-lg border text-sm',
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              )}
            />
          </div>
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className={cn(
            'px-3 py-2 rounded-lg border text-sm min-w-[150px]',
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          )}
        >
          <option value="">Todas las categorías</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className={cn(
            'px-3 py-2 rounded-lg border text-sm min-w-[150px]',
            theme === 'dark'
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-white border-gray-300 text-gray-900'
          )}
        >
          <option value="all">Todo el stock</option>
          <option value="in-stock">En stock</option>
          <option value="low-stock">Stock bajo</option>
          <option value="out-of-stock">Sin stock</option>
        </select>
      </div>

      {/* Products Table */}
      <div className={cn(
        'rounded-xl border overflow-hidden',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className={theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Producto
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  SKU
                </th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Stock
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Costo
                </th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Valor Total
                </th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Estado
                </th>
                <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">

                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                products.map((product, index) => {
                  const badge = getStockBadge(product)
                  return (
                    <motion.tr
                      key={`${product.productId}-${product.variantId || 'base'}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        'transition-colors',
                        theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                      )}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {product.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {product.category}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-gray-600 dark:text-gray-300">
                          {product.sku || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {product.quantityOnHand}
                        </span>
                        {product.quantityReserved > 0 && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
                            ({product.quantityReserved} res.)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          ${product.costPrice.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-green-600 dark:text-green-400">
                          ${product.totalCostValue.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', badge.color)}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => openMovementModal(product)}
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            theme === 'dark'
                              ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                              : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                          )}
                          title="Ver movimientos"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className={cn(
            'flex items-center justify-between px-4 py-3 border-t',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
          )}>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className={cn(
                  'p-2 rounded-lg transition-colors disabled:opacity-50',
                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                )}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className={cn(
                  'p-2 rounded-lg transition-colors disabled:opacity-50',
                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                )}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Movements Modal */}
      <AnimatePresence>
        {movementModal?.show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={closeMovementModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              {/* Modal Header */}
              <div className={cn(
                'px-6 py-4 border-b flex items-center justify-between',
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                    Movimientos
                  </h3>
                  {movementData && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {movementData.product.name} ({movementData.product.sku})
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {movementData && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Stock Actual</p>
                      <p className="font-bold text-xl text-indigo-600 dark:text-indigo-400">
                        {movementData.currentStock}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={closeMovementModal}
                    className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {loadingMovements ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  </div>
                ) : movementData?.movements.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    No hay movimientos registrados
                  </div>
                ) : (
                  <div className="space-y-2">
                    {movementData?.movements.map((mov) => (
                      <div
                        key={mov.id}
                        className={cn(
                          'p-3 rounded-xl border',
                          theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center',
                              mov.quantity > 0
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : mov.quantity < 0
                                  ? 'bg-red-100 dark:bg-red-900/30'
                                  : 'bg-gray-100 dark:bg-gray-700'
                            )}>
                              {mov.quantity > 0 ? (
                                <ArrowUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                              ) : mov.quantity < 0 ? (
                                <ArrowDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                              ) : (
                                <Minus className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white text-sm">
                                {mov.typeLabel}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(mov.date).toLocaleString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                                {mov.user && ` • ${mov.user}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              'font-bold',
                              mov.quantity > 0
                                ? 'text-green-600 dark:text-green-400'
                                : mov.quantity < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-600 dark:text-gray-400'
                            )}>
                              {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {mov.stockBefore} → {mov.stockAfter}
                            </p>
                          </div>
                        </div>
                        {(mov.reference || mov.notes) && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            {mov.reference && (
                              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                                Ref: {mov.reference}
                              </p>
                            )}
                            {mov.notes && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {mov.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
