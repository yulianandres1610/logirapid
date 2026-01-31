'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Edit,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Image as ImageIcon,
  TrendingUp,
  Barcode,
  Printer,
  Trash2
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { PrintLabelModal } from '@/components/print/PrintLabelModal'
import { useMarketExchangeRates } from '@/hooks/useMarketExchangeRates'
import { ProductImage } from '@/components/market/ProductImage'

interface Product {
  id: number
  name: string
  description: string
  imageUrl: string | null
  category: string | null
  costPrice: number
  sellingPrice: number
  currency: string
  sku: string
  barcode: string
  supplierName: string | null
  supplierContact: string | null
  supplierReference: string | null
  quantityOnHand: number
  quantityExpected: number
  minimumStock: number
  isActive: boolean
  unitOfMeasure: string
  createdAt: string
  updatedAt: string
  matchedVariant?: {
    id: number
    name: string
    barcode: string
    sku: string
  }
}

interface Stats {
  total: number
  inStock: number
  lowStock: number
  outOfStock: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// Currency symbols
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CUP: '$',
  EUR: '€',
  MLC: '$'
}

export default function MarketInventoryPage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0 })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [stockFilter, setStockFilter] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [printProduct, setPrintProduct] = useState<Product | null>(null)

  // Check if user is admin
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  // Exchange rates for multi-currency display
  // USD_CUP = ElToque (tasa única de referencia)
  const { USD_CUP, USD_MLC } = useMarketExchangeRates()

  useEffect(() => {
    fetchProducts()
  }, [pagination.page, selectedCategory, stockFilter])

  // Auto-refresh every 30 seconds to keep stock updated
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProducts(true) // silent refresh
    }, 30000)
    return () => clearInterval(interval)
  }, [pagination.page, selectedCategory, stockFilter, search])

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (pagination.page === 1) {
        fetchProducts()
      } else {
        setPagination(p => ({ ...p, page: 1 }))
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const fetchProducts = async (silent = false) => {
    if (!silent) {
      setLoading(true)
    } else {
      setIsRefreshing(true)
    }
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })
      if (search) params.set('search', search)
      if (selectedCategory) params.set('category', selectedCategory)
      if (stockFilter) params.set('filter', stockFilter)

      const response = await fetch(`/api/market/products?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setProducts(data.data.products)
          setCategories(data.data.categories)
          setStats(data.data.stats)
          setPagination(data.data.pagination)
          setLastUpdated(new Date())
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      if (!silent) {
        setLoading(false)
      } else {
        setIsRefreshing(false)
      }
    }
  }

  const handleManualRefresh = () => {
    fetchProducts(true)
  }

  const getStockStatus = (product: Product) => {
    if (product.quantityOnHand === 0) {
      return { color: 'red', label: 'Sin Stock', icon: AlertCircle }
    }
    if (product.quantityOnHand <= product.minimumStock) {
      return { color: 'amber', label: 'Stock Bajo', icon: AlertTriangle }
    }
    return { color: 'green', label: 'En Stock', icon: CheckCircle }
  }

  const getMargin = (product: Product) => {
    if (product.costPrice === 0) return 0
    return Math.round(((product.sellingPrice - product.costPrice) / product.costPrice) * 100)
  }

  // Delete product function
  const handleDeleteProduct = async () => {
    if (!deleteProduct) return

    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(`/api/market/products/${deleteProduct.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Remove from local state
        setProducts(prev => prev.filter(p => p.id !== deleteProduct.id))
        // Update stats
        setStats(prev => ({
          ...prev,
          total: prev.total - 1,
          inStock: deleteProduct.quantityOnHand > deleteProduct.minimumStock ? prev.inStock - 1 : prev.inStock,
          lowStock: deleteProduct.quantityOnHand <= deleteProduct.minimumStock && deleteProduct.quantityOnHand > 0 ? prev.lowStock - 1 : prev.lowStock,
          outOfStock: deleteProduct.quantityOnHand === 0 ? prev.outOfStock - 1 : prev.outOfStock
        }))
        setDeleteProduct(null)
      } else {
        // Show error message
        setDeleteError(data.error || 'Error al eliminar el producto')
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      setDeleteError('Error de conexión. Intente nuevamente.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards - Estilo Pickup Orders */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Total Productos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => setStockFilter(null)}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  stockFilter === null && 'ring-2 ring-blue-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-blue-900/30 border border-blue-800/50'
                          : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                      )}>
                        <Package className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Total Productos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.total}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      <span className={cn(
                        'text-xs font-medium',
                        theme === 'dark' ? 'text-gray-500' : 'text-black'
                      )}>En inventario</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* En Stock */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setStockFilter(stockFilter === 'in-stock' ? null : 'in-stock')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  stockFilter === 'in-stock' && 'ring-2 ring-emerald-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-emerald-900/30 border border-emerald-800/50'
                          : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                      )}>
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>En Stock</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.inStock}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                        <span className={cn(
                          'text-xs font-medium',
                          theme === 'dark' ? 'text-gray-500' : 'text-black'
                        )}>Disponibles</span>
                      </div>
                      <span className={cn(
                        'text-xs font-bold',
                        theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                      )}>
                        {stats.total > 0 ? Math.round((stats.inStock / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.inStock / stats.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Stock Bajo */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => setStockFilter(stockFilter === 'low-stock' ? null : 'low-stock')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  stockFilter === 'low-stock' && 'ring-2 ring-amber-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-amber-900/30 border border-amber-800/50'
                          : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                      )}>
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Stock Bajo</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.lowStock}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                        <span className={cn(
                          'text-xs font-medium',
                          theme === 'dark' ? 'text-gray-500' : 'text-black'
                        )}>Requieren atención</span>
                      </div>
                      <span className={cn(
                        'text-xs font-bold',
                        theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                      )}>
                        {stats.total > 0 ? Math.round((stats.lowStock / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-amber-100 dark:bg-amber-900/30 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-amber-400 to-orange-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.lowStock / stats.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Sin Stock */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => setStockFilter(stockFilter === 'out-of-stock' ? null : 'out-of-stock')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  stockFilter === 'out-of-stock' && 'ring-2 ring-red-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-rose-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-red-900/30 border border-red-800/50'
                          : 'bg-gradient-to-br from-red-50 to-rose-100 border border-red-200'
                      )}>
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Sin Stock</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.outOfStock}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                        <span className={cn(
                          'text-xs font-medium',
                          theme === 'dark' ? 'text-gray-500' : 'text-black'
                        )}>Agotados</span>
                      </div>
                      <span className={cn(
                        'text-xs font-bold',
                        theme === 'dark' ? 'text-red-400' : 'text-red-600'
                      )}>
                        {stats.total > 0 ? Math.round((stats.outOfStock / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-red-100 dark:bg-red-900/30 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-red-400 to-rose-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.outOfStock / stats.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                'p-4 rounded-2xl border shadow-xl',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, SKU o código de barras..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                    )}
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Todas las categorías</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Clear Filters */}
                {(search || selectedCategory || stockFilter) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSearch('')
                      setSelectedCategory(null)
                      setStockFilter(null)
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    <X className="w-4 h-4" />
                    Limpiar
                  </motion.button>
                )}

                {/* Refresh with last update indicator */}
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      Actualizado: {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualRefresh}
                    disabled={loading || isRefreshing}
                    title="Actualizar inventario"
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      isRefreshing && 'opacity-75'
                    )}
                  >
                    <RefreshCw className={cn('w-4 h-4', (loading || isRefreshing) && 'animate-spin')} />
                  </motion.button>
                </div>

                {/* Nuevo Producto */}
                <Link href="/dashboard/market/inventory/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-lg shadow-emerald-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Producto
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Products Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={cn(
                      'border-b',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Código de Barras</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Venta</th>
                      <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Margen</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={9} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-xl" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mt-2" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : products.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center">
                          <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay productos</p>
                          <Link href="/dashboard/market/inventory/create">
                            <button className="mt-3 text-sm text-emerald-500 hover:text-emerald-600">
                              Crear primer producto
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      products.map((product, index) => {
                        const status = getStockStatus(product)
                        const margin = getMargin(product)
                        const symbol = CURRENCY_SYMBOLS[product.currency] || '$'

                        return (
                          <motion.tr
                            key={product.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            onClick={() => router.push(`/dashboard/market/inventory/${product.id}`)}
                            className={cn(
                              'group transition-colors cursor-pointer',
                              theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                            )}
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <ProductImage
                                  src={product.imageUrl}
                                  alt={product.name}
                                  size="md"
                                  theme={theme}
                                />
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                                  {product.category && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{product.category}</p>
                                  )}
                                  {product.matchedVariant && (
                                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                                      📦 Variante: {product.matchedVariant.name} ({product.matchedVariant.barcode || product.matchedVariant.sku})
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">{product.sku}</span>
                            </td>
                            <td className="py-4 px-4">
                              {product.barcode ? (
                                <div className="flex items-center gap-2">
                                  <Barcode className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">{product.barcode}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">Sin código</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div>
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                  {symbol}{product.costPrice.toFixed(2)}
                                </span>
                                <div className="text-[10px] mt-0.5 space-y-0">
                                  <p className="text-orange-600">${Math.round(product.costPrice * USD_CUP).toLocaleString('es-ES')} CUP <span className="text-gray-400">(ElToque)</span></p>
                                  <p className="text-purple-600">${(product.costPrice * USD_MLC).toFixed(2)} MLC</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {symbol}{product.sellingPrice.toFixed(2)}
                                </span>
                                <div className="text-[10px] mt-0.5 space-y-0">
                                  <p className="text-green-600 font-medium">${Math.round(product.sellingPrice * USD_CUP).toLocaleString('es-ES')} CUP</p>
                                  <p className="text-purple-600 font-medium">${(product.sellingPrice * USD_MLC).toFixed(2)} MLC</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <TrendingUp className={cn(
                                  'w-4 h-4',
                                  margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'
                                )} />
                                <span className={cn(
                                  'text-sm font-bold',
                                  margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'
                                )}>
                                  {margin}%
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {Number(product.quantityOnHand) % 1 === 0
                                  ? product.quantityOnHand
                                  : Number(product.quantityOnHand).toFixed(2)}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium',
                                status.color === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                                status.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                status.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              )}>
                                <status.icon className="w-3.5 h-3.5" />
                                {status.label}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); setPrintProduct(product); }}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Imprimir etiqueta"
                                >
                                  <Printer className="w-4 h-4 text-gray-500" />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/market/inventory/${product.id}/edit`); }}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Editar producto"
                                >
                                  <Edit className="w-4 h-4 text-amber-500" />
                                </motion.button>
                                {isAdmin && (
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => { e.stopPropagation(); setDeleteProduct(product); }}
                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Eliminar producto"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </motion.button>
                                )}
                              </div>
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
                  theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                      disabled={pagination.page === 1}
                      className={cn(
                        'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </motion.button>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className={cn(
                        'p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                        theme === 'dark'
                          ? 'hover:bg-gray-700 text-gray-300'
                          : 'hover:bg-gray-200 text-gray-600'
                      )}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Product Detail Modal */}
            <AnimatePresence>
              {selectedProduct && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                  onClick={() => setSelectedProduct(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', duration: 0.3 }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'w-full max-w-lg rounded-2xl p-6 shadow-2xl',
                      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                    )}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <ProductImage
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        size="xl"
                        theme={theme}
                        containerClassName="shadow-lg"
                      />
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedProduct.name}</h3>
                        {selectedProduct.category && (
                          <p className="text-sm text-gray-500">{selectedProduct.category}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">SKU: {selectedProduct.sku}</p>
                      </div>
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    {/* Barcode Section */}
                    {selectedProduct.barcode && (
                      <div className={cn(
                        'p-4 rounded-xl mb-4 flex items-center justify-between',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}>
                        <div className="flex items-center gap-3">
                          <Barcode className="w-6 h-6 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Código de Barras EAN-13</p>
                            <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">{selectedProduct.barcode}</p>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => selectedProduct && setPrintProduct(selectedProduct)}
                          className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          )}
                        >
                          <Printer className="w-4 h-4" />
                          Imprimir
                        </motion.button>
                      </div>
                    )}

                    {selectedProduct.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{selectedProduct.description}</p>
                    )}

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}>
                        <p className="text-xs text-gray-500 mb-1">Precio de Costo</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {CURRENCY_SYMBOLS[selectedProduct.currency] || '$'}{selectedProduct.costPrice.toFixed(2)}
                        </p>
                        <div className="text-xs mt-1 space-y-0.5">
                          <p className="text-blue-600">${Math.round(selectedProduct.costPrice * USD_CUP).toLocaleString('es-ES')} CUP</p>
                          <p className="text-purple-600">${(selectedProduct.costPrice * USD_MLC).toFixed(2)} MLC</p>
                        </div>
                      </div>
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}>
                        <p className="text-xs text-gray-500 mb-1">Precio de Venta</p>
                        <p className="text-xl font-bold text-emerald-600">
                          {CURRENCY_SYMBOLS[selectedProduct.currency] || '$'}{selectedProduct.sellingPrice.toFixed(2)}
                        </p>
                        <div className="text-xs mt-1 space-y-0.5">
                          <p className="text-green-600 font-medium">${Math.round(selectedProduct.sellingPrice * USD_CUP).toLocaleString('es-ES')} CUP</p>
                          <p className="text-purple-600 font-medium">${(selectedProduct.sellingPrice * USD_MLC).toFixed(2)} MLC</p>
                        </div>
                      </div>
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}>
                        <p className="text-xs text-gray-500 mb-1">Stock Actual</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {Number(selectedProduct.quantityOnHand) % 1 === 0
                            ? selectedProduct.quantityOnHand
                            : Number(selectedProduct.quantityOnHand).toFixed(2)}
                        </p>
                      </div>
                      <div className={cn(
                        'p-4 rounded-xl',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}>
                        <p className="text-xs text-gray-500 mb-1">Stock Mínimo</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          {Number(selectedProduct.minimumStock) % 1 === 0
                            ? selectedProduct.minimumStock
                            : Number(selectedProduct.minimumStock).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {selectedProduct.supplierName && (
                      <div className={cn(
                        'p-4 rounded-xl mb-4',
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}>
                        <p className="text-xs text-gray-500 mb-1">Proveedor</p>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedProduct.supplierName}</p>
                        {selectedProduct.supplierContact && (
                          <p className="text-sm text-gray-500">{selectedProduct.supplierContact}</p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Link href={`/dashboard/market/inventory/${selectedProduct.id}/edit`} className="flex-1">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all font-medium shadow-lg shadow-emerald-500/25"
                        >
                          Editar Producto
                        </motion.button>
                      </Link>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedProduct(null)}
                        className={cn(
                          'px-6 py-2.5 rounded-xl transition-colors font-medium',
                          theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        Cerrar
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
              {deleteProduct && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                  onClick={() => !deleting && setDeleteProduct(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', duration: 0.3 }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'w-full max-w-md rounded-2xl p-6 shadow-2xl',
                      theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                    )}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/30">
                        <Trash2 className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Eliminar Producto</h3>
                        <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
                      </div>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl mb-4',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3">
                        <ProductImage
                          src={deleteProduct.imageUrl}
                          alt={deleteProduct.name}
                          size="sm"
                          theme={theme}
                        />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{deleteProduct.name}</p>
                          <p className="text-sm text-gray-500">SKU: {deleteProduct.sku}</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      ¿Estás seguro de que deseas eliminar este producto? Se eliminará permanentemente del inventario.
                    </p>

                    {deleteError && (
                      <div className={cn(
                        'p-3 rounded-lg mb-4 text-sm flex items-center gap-2',
                        theme === 'dark'
                          ? 'bg-red-900/30 text-red-300 border border-red-800'
                          : 'bg-red-50 text-red-600 border border-red-200'
                      )}>
                        <X className="w-4 h-4 flex-shrink-0" />
                        {deleteError}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setDeleteProduct(null); setDeleteError(null); }}
                        disabled={deleting}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl transition-colors font-medium',
                          theme === 'dark'
                            ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                          deleting && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        Cancelar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleDeleteProduct}
                        disabled={deleting}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-medium shadow-lg shadow-red-500/25 transition-all',
                          deleting ? 'opacity-70 cursor-not-allowed' : 'hover:from-red-600 hover:to-red-700'
                        )}
                      >
                        {deleting ? (
                          <span className="flex items-center justify-center gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Eliminando...
                          </span>
                        ) : (
                          'Eliminar'
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Print Label Modal */}
        {printProduct && (
          <PrintLabelModal
            isOpen={!!printProduct}
            onClose={() => setPrintProduct(null)}
            productData={{
              productName: printProduct.name,
              sku: printProduct.sku,
              barcode: printProduct.barcode || printProduct.sku,
              price: printProduct.sellingPrice,
              currency: printProduct.currency,
              unitOfMeasure: printProduct.unitOfMeasure,
              category: printProduct.category || undefined,
              description: printProduct.description || undefined
            }}
            onPrintSuccess={(jobNumber) => {
              console.log('Print job created:', jobNumber)
              setPrintProduct(null)
            }}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  )
}
