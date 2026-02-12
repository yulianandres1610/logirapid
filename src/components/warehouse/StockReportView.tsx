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
  Loader2,
  Tag,
  Boxes,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface StockReportViewProps {
  warehouseId: number
  warehouseName: string
  onBack: () => void
}

interface OtherWarehouseStock {
  warehouseId: number
  warehouseName: string
  quantity: number
}

interface Product {
  productId: number
  variantId: number | null
  productName: string
  variantName: string | null
  name: string
  sku: string
  barcode: string
  category: string
  imageUrl: string | null
  unitOfMeasure: string
  quantityOnHand: number
  quantityReserved: number
  quantityAvailable: number
  costPrice: number
  sellingPrice: number
  totalCostValue: number
  totalSellingValue: number
  minimumStock: number
  otherWarehouses: OtherWarehouseStock[]
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

    const headers = ['Producto', 'Variante', 'SKU', 'Codigo', 'Categoria', 'Unidad', 'Stock', 'Reservado', 'Disponible', 'Costo Unit', 'Precio Venta', 'Valor Costo', 'Valor Venta']
    const rows = products.map(p => [
      p.productName,
      p.variantName || '',
      p.sku,
      p.barcode,
      p.category,
      p.unitOfMeasure,
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
    link.download = `inventario-${warehouseName}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getStockStatus = (product: Product) => {
    if (product.quantityOnHand === 0) {
      return {
        label: 'Sin Stock',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800'
      }
    }
    if (product.quantityOnHand <= product.minimumStock) {
      return {
        label: 'Stock Bajo',
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
        borderColor: 'border-amber-200 dark:border-amber-800'
      }
    }
    return {
      label: 'En Stock',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800'
    }
  }

  const formatQuantity = (value: number) => {
    return Number(value) % 1 === 0 ? value : Number(value).toFixed(2)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">Cargando inventario...</p>
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
              'p-2 rounded-xl border transition-all hover:scale-105',
              theme === 'dark'
                ? 'border-gray-700 hover:bg-gray-800 hover:border-gray-600'
                : 'border-gray-200 hover:bg-gray-100 hover:border-gray-300'
            )}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Informe de Inventario
              </h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{warehouseName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReport(true)}
            disabled={refreshing}
            className={cn(
              'p-2.5 rounded-xl border transition-all hover:scale-105',
              theme === 'dark'
                ? 'border-gray-700 hover:bg-gray-800'
                : 'border-gray-200 hover:bg-gray-100'
            )}
            title="Actualizar"
          >
            <RefreshCw className={cn('w-5 h-5', refreshing && 'animate-spin')} />
          </button>
          <button
            onClick={exportToCSV}
            disabled={!products.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 transition-all hover:scale-105 shadow-lg shadow-indigo-500/25"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-4 rounded-2xl border-2 transition-all hover:scale-[1.02]',
              theme === 'dark'
                ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-700/50'
                : 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20">
                <Boxes className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {summary.totalProducts}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Productos</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={cn(
              'p-4 rounded-2xl border-2 transition-all hover:scale-[1.02]',
              theme === 'dark'
                ? 'bg-gradient-to-br from-green-900/30 to-green-800/20 border-green-700/50'
                : 'bg-gradient-to-br from-green-50 to-green-100/50 border-green-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-green-500/20">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${summary.totalValue.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Valor Total</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'p-4 rounded-2xl border-2 transition-all hover:scale-[1.02]',
              theme === 'dark'
                ? 'bg-gradient-to-br from-amber-900/30 to-amber-800/20 border-amber-700/50'
                : 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {summary.lowStock}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Stock Bajo</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={cn(
              'p-4 rounded-2xl border-2 transition-all hover:scale-[1.02]',
              theme === 'dark'
                ? 'bg-gradient-to-br from-red-900/30 to-red-800/20 border-red-700/50'
                : 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-200'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/20">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {summary.outOfStock}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Sin Stock</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Search and Filters */}
      <div className={cn(
        'p-4 rounded-2xl border',
        theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
      )}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar producto, variante, SKU o codigo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-all',
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-indigo-500'
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:bg-white'
                )}
              />
            </div>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={cn(
              'px-4 py-2.5 rounded-xl border text-sm min-w-[160px] transition-all',
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-gray-50 border-gray-200 text-gray-900'
            )}
          >
            <option value="">Todas las categorias</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className={cn(
              'px-4 py-2.5 rounded-xl border text-sm min-w-[140px] transition-all',
              theme === 'dark'
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-gray-50 border-gray-200 text-gray-900'
            )}
          >
            <option value="all">Todo</option>
            <option value="in-stock">En stock</option>
            <option value="low-stock">Stock bajo</option>
            <option value="out-of-stock">Sin stock</option>
          </select>
        </div>
      </div>

      {/* Products List - Card Design */}
      <div className="space-y-3">
        {products.length === 0 ? (
          <div className={cn(
            'p-12 rounded-2xl border text-center',
            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
          )}>
            <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No se encontraron productos</p>
          </div>
        ) : (
          products.map((product, index) => {
            const status = getStockStatus(product)
            return (
              <motion.div
                key={`${product.productId}-${product.variantId || 'base'}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={cn(
                  'p-4 rounded-2xl border-2 transition-all hover:shadow-lg',
                  status.bgColor,
                  status.borderColor
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Image */}
                  <div className="flex-shrink-0">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.productName}
                        className="w-16 h-16 rounded-xl object-cover shadow-md"
                      />
                    ) : (
                      <div className={cn(
                        'w-16 h-16 rounded-xl flex items-center justify-center',
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )}>
                        <Package className="w-7 h-7 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    {/* Product Name */}
                    <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">
                      {product.productName}
                    </h3>

                    {/* Variant Name */}
                    {product.variantName && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          {product.variantName}
                        </span>
                      </div>
                    )}

                    {/* Category & SKU */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded-lg text-xs font-medium',
                        theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
                      )}>
                        {product.category}
                      </span>
                      {product.sku && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          SKU: {product.sku}
                        </span>
                      )}
                      {product.barcode && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          Cod: {product.barcode}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock & Price */}
                  <div className="flex-shrink-0 text-right">
                    <div className={cn('text-2xl font-bold', status.color)}>
                      {formatQuantity(product.quantityOnHand)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {product.unitOfMeasure}
                    </div>
                    {product.quantityReserved > 0 && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        {formatQuantity(product.quantityReserved)} reservado
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => openMovementModal(product)}
                      className={cn(
                        'p-2.5 rounded-xl transition-all hover:scale-110',
                        theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-white hover:bg-gray-100 text-gray-600 shadow-sm'
                      )}
                      title="Ver movimientos"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Row - Prices */}
                <div className={cn(
                  'mt-3 pt-3 border-t flex items-center justify-between',
                  theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200/50'
                )}>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Costo:</span>
                      <span className="ml-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        ${product.costPrice.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Precio:</span>
                      <span className="ml-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                        ${product.sellingPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      ${product.totalCostValue.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Other Warehouses Stock */}
                {product.otherWarehouses && product.otherWarehouses.length > 0 && (
                  <div className={cn(
                    'mt-3 pt-3 border-t',
                    theme === 'dark' ? 'border-gray-700/50' : 'border-gray-200/50'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <Boxes className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Stock en otros almacenes:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {product.otherWarehouses.map((wh) => (
                        <div
                          key={wh.warehouseId}
                          className={cn(
                            'px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5',
                            theme === 'dark'
                              ? 'bg-indigo-900/30 border border-indigo-700/50'
                              : 'bg-indigo-50 border border-indigo-200'
                          )}
                        >
                          <span className="text-gray-600 dark:text-gray-300">{wh.warehouseName}:</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {formatQuantity(wh.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className={cn(
          'flex items-center justify-between px-4 py-3 rounded-2xl border',
          theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
        )}>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className={cn(
                'p-2 rounded-xl transition-all disabled:opacity-50',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 min-w-[60px] text-center">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className={cn(
                'p-2 rounded-xl transition-all disabled:opacity-50',
                theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
            >
              {/* Modal Header */}
              <div className={cn(
                'px-6 py-4 border-b flex items-center justify-between',
                theme === 'dark' ? 'border-gray-700 bg-gray-900/50' : 'border-gray-100 bg-gray-50'
              )}>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                    Historial de Movimientos
                  </h3>
                  {movementData && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {movementData.product.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {movementData && (
                    <div className={cn(
                      'px-4 py-2 rounded-xl',
                      theme === 'dark' ? 'bg-indigo-900/30' : 'bg-indigo-50'
                    )}>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Stock Actual</p>
                      <p className="font-bold text-xl text-indigo-600 dark:text-indigo-400">
                        {formatQuantity(movementData.currentStock)}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={closeMovementModal}
                    className={cn(
                      'p-2 rounded-xl transition-colors',
                      theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                    )}
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
                  <div className="text-center py-12">
                    <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No hay movimientos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {movementData?.movements.map((mov) => (
                      <div
                        key={mov.id}
                        className={cn(
                          'p-4 rounded-2xl border transition-all hover:shadow-md',
                          theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-10 h-10 rounded-xl flex items-center justify-center',
                              mov.quantity > 0
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : mov.quantity < 0
                                  ? 'bg-red-100 dark:bg-red-900/30'
                                  : 'bg-gray-100 dark:bg-gray-700'
                            )}>
                              {mov.quantity > 0 ? (
                                <ArrowUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                              ) : mov.quantity < 0 ? (
                                <ArrowDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                              ) : (
                                <Minus className="w-5 h-5 text-gray-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {mov.typeLabel}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(mov.date).toLocaleString('es-ES', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                                {mov.user && ` • ${mov.user}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              'text-xl font-bold',
                              mov.quantity > 0
                                ? 'text-green-600 dark:text-green-400'
                                : mov.quantity < 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-600 dark:text-gray-400'
                            )}>
                              {mov.quantity > 0 ? '+' : ''}{formatQuantity(mov.quantity)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatQuantity(mov.stockBefore)} → {formatQuantity(mov.stockAfter)}
                            </p>
                          </div>
                        </div>
                        {(mov.reference || mov.notes) && (
                          <div className={cn(
                            'mt-3 pt-3 border-t',
                            theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                          )}>
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
