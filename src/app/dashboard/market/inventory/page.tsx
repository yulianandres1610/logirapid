'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  MoreVertical,
  Edit,
  Trash2,
  RefreshCw,
  Boxes,
  ChevronLeft,
  ChevronRight,
  X,
  Image as ImageIcon,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

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
  createdAt: string
  updatedAt: string
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
  CUP: '₱',
  EUR: '€',
  MLC: '$'
}

export default function MarketInventoryPage() {
  const { theme } = useTheme()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, inStock: 0, lowStock: 0, outOfStock: 0 })
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [stockFilter, setStockFilter] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [pagination.page, selectedCategory, stockFilter])

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

  const fetchProducts = async () => {
    setLoading(true)
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
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
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

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Boxes className="w-8 h-8 text-emerald-500" />
                Inventario
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Gestiona los productos de tu mercado
              </p>
            </div>
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
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Productos', value: stats.total, color: 'blue', icon: Package },
              { label: 'En Stock', value: stats.inStock, color: 'green', icon: CheckCircle },
              { label: 'Stock Bajo', value: stats.lowStock, color: 'amber', icon: AlertTriangle },
              { label: 'Sin Stock', value: stats.outOfStock, color: 'red', icon: AlertCircle }
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  if (stat.label === 'Stock Bajo') setStockFilter(stockFilter === 'low-stock' ? null : 'low-stock')
                  else if (stat.label === 'Sin Stock') setStockFilter(stockFilter === 'out-of-stock' ? null : 'out-of-stock')
                  else if (stat.label === 'En Stock') setStockFilter(stockFilter === 'in-stock' ? null : 'in-stock')
                  else setStockFilter(null)
                }}
                className={cn(
                  'p-4 rounded-xl border cursor-pointer transition-all',
                  stockFilter === 'low-stock' && stat.label === 'Stock Bajo' ? 'ring-2 ring-amber-500' :
                  stockFilter === 'out-of-stock' && stat.label === 'Sin Stock' ? 'ring-2 ring-red-500' :
                  stockFilter === 'in-stock' && stat.label === 'En Stock' ? 'ring-2 ring-green-500' : '',
                  theme === 'dark'
                    ? 'bg-[#1e1e2f] border-gray-700/50 hover:border-gray-600'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    stat.color === 'blue' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
                    stat.color === 'green' && 'bg-green-100 dark:bg-green-900/30 text-green-600',
                    stat.color === 'amber' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
                    stat.color === 'red' && 'bg-red-100 dark:bg-red-900/30 text-red-600'
                  )}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              'p-4 rounded-xl border',
              theme === 'dark'
                ? 'bg-[#1e1e2f] border-gray-700/50'
                : 'bg-white border-gray-200'
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
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
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
                    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                )}
              >
                <option value="">Todas las categorías</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Clear Filters */}
              {(search || selectedCategory || stockFilter) && (
                <button
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
                </button>
              )}

              {/* Refresh */}
              <button
                onClick={fetchProducts}
                disabled={loading}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </button>
            </div>
          </motion.div>

          {/* Products Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              'rounded-xl border overflow-hidden',
              theme === 'dark'
                ? 'bg-[#1e1e2f] border-gray-700/50'
                : 'bg-white border-gray-200'
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={cn(
                    'border-b',
                    theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                  )}>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Costo</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Venta</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Margen</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={8} className="py-4 px-4">
                          <div className="animate-pulse flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
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
                      <td colSpan={8} className="py-12 text-center">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className="text-gray-500 dark:text-gray-400">No hay productos</p>
                        <Link href="/dashboard/market/inventory/create">
                          <button className="mt-3 text-sm text-blue-500 hover:text-blue-600">
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
                          className={cn(
                            'group transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center',
                                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                              )}>
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <ImageIcon className="w-6 h-6 text-gray-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                                {product.category && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{product.category}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">{product.sku}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm text-gray-600 dark:text-gray-300">
                              {symbol}{product.costPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {symbol}{product.sellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={cn(
                              'text-sm font-medium',
                              margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'
                            )}>
                              {margin}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {product.quantityOnHand}
                            </span>
                            {product.quantityExpected > 0 && (
                              <span className="text-xs text-blue-500 ml-1">(+{product.quantityExpected})</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                              status.color === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                              status.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              status.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}>
                              <status.icon className="w-3 h-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedProduct(product)}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-gray-500" />
                              </button>
                              <Link href={`/dashboard/market/inventory/${product.id}/edit`}>
                                <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                  <Edit className="w-4 h-4 text-gray-500" />
                                </button>
                              </Link>
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
                  <button
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
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
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
                  </button>
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
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setSelectedProduct(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'w-full max-w-lg rounded-2xl p-6',
                    theme === 'dark' ? 'bg-[#1e1e2f]' : 'bg-white'
                  )}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={cn(
                      'w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center',
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                    )}>
                      {selectedProduct.imageUrl ? (
                        <img
                          src={selectedProduct.imageUrl}
                          alt={selectedProduct.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
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

                  {selectedProduct.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{selectedProduct.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500">Precio de Costo</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">
                        {CURRENCY_SYMBOLS[selectedProduct.currency] || '$'}{selectedProduct.costPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500">Precio de Venta</p>
                      <p className="text-lg font-bold text-green-600">
                        {CURRENCY_SYMBOLS[selectedProduct.currency] || '$'}{selectedProduct.sellingPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500">Stock Actual</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedProduct.quantityOnHand}</p>
                    </div>
                    <div className={cn(
                      'p-3 rounded-xl',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    )}>
                      <p className="text-xs text-gray-500">Stock Mínimo</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedProduct.minimumStock}</p>
                    </div>
                  </div>

                  {selectedProduct.supplierName && (
                    <div className={cn(
                      'p-3 rounded-xl mb-4',
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
                      <button className="w-full py-2.5 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium">
                        Editar Producto
                      </button>
                    </Link>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      className={cn(
                        'px-6 py-2.5 rounded-xl transition-colors font-medium',
                        theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      Cerrar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
