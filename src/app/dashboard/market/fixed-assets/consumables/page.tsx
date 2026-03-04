'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Search,
  RefreshCw,
  Plus,
  AlertTriangle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  ArrowRightFromLine,
  ArrowLeftFromLine,
  Filter,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface ConsumableItem {
  id: number
  name: string
  code: string
  description: string
  category: string
  unit: string
  currentStock: number
  minStock: number
  warehouseId: number
  warehouseName: string
  status: string
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Stats {
  totalItems: number
  lowStock: number
  dispatchesThisMonth: number
}

interface Warehouse {
  id: number
  name: string
}

export default function ConsumablesPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [items, setItems] = useState<ConsumableItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [stats, setStats] = useState<Stats>({
    totalItems: 0,
    lowStock: 0,
    dispatchesThisMonth: 0,
  })
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [categories, setCategories] = useState<string[]>([])

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    code: '',
    description: '',
    category: '',
    unit: 'unidad',
    minStock: 0,
    warehouseId: '',
  })

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await fetch('/api/market/warehouses')
      const data = await res.json()
      if (data.success) {
        setWarehouses(data.data?.warehouses || data.data || [])
      }
    } catch {
      console.error('Error fetching warehouses')
    }
  }, [])

  const fetchItems = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })
      if (search) params.set('search', search)
      if (categoryFilter) params.set('category', categoryFilter)
      if (warehouseFilter) params.set('warehouseId', warehouseFilter)

      const res = await fetch(`/api/market/consumables?${params.toString()}`)
      const data = await res.json()

      if (data.success && data.data) {
        const itemsList = data.data.items || []
        setItems(itemsList)
        setPagination(data.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
        setStats(data.data.stats || { totalItems: 0, lowStock: 0, dispatchesThisMonth: 0 })

        // Extract unique categories from items
        const uniqueCategories = Array.from(
          new Set(itemsList.map((item: ConsumableItem) => item.category).filter(Boolean))
        ) as string[]
        setCategories((prev) => {
          const merged = Array.from(new Set([...prev, ...uniqueCategories]))
          return merged.sort()
        })
      }
    } catch {
      showNotification('error', 'Error', 'Error al cargar los consumibles')
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter, warehouseFilter, showNotification])

  useEffect(() => {
    fetchWarehouses()
  }, [fetchWarehouses])

  useEffect(() => {
    fetchItems(1)
  }, [fetchItems])

  const handleSearch = () => {
    fetchItems(1)
  }

  const handleRefresh = () => {
    setSearch('')
    setCategoryFilter('')
    setWarehouseFilter('')
    fetchItems(1)
  }

  const handlePageChange = (newPage: number) => {
    fetchItems(newPage)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Estas seguro de eliminar este item?')) return
    try {
      const res = await fetch(`/api/market/consumables/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showNotification('success', 'Eliminado', 'Item eliminado correctamente')
        fetchItems(pagination.page)
      } else {
        showNotification('error', 'Error', data.error || 'Error al eliminar')
      }
    } catch {
      showNotification('error', 'Error', 'Error al eliminar el item')
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItem.name.trim()) {
      showNotification('error', 'Error', 'El nombre es requerido')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/market/consumables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newItem,
          minStock: Number(newItem.minStock),
          warehouseId: newItem.warehouseId ? Number(newItem.warehouseId) : null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showNotification('success', 'Creado', 'Item creado correctamente')
        setShowCreateModal(false)
        setNewItem({
          name: '',
          code: '',
          description: '',
          category: '',
          unit: 'unidad',
          minStock: 0,
          warehouseId: '',
        })
        fetchItems(1)
      } else {
        showNotification('error', 'Error', data.error || 'Error al crear el item')
      }
    } catch {
      showNotification('error', 'Error', 'Error al crear el item')
    } finally {
      setCreating(false)
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <motion.div
          className="p-6 space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1
                className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}
              >
                Consumibles
              </h1>
              <p className={cn('text-sm mt-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                Gestiona el inventario de materiales consumibles
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/market/fixed-assets/consumables/entry">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                    theme === 'dark'
                      ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30'
                      : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                  )}
                >
                  <ArrowLeftFromLine className="w-4 h-4" />
                  Nueva Entrada
                </motion.button>
              </Link>
              <Link href="/dashboard/market/fixed-assets/consumables/dispatch">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                    theme === 'dark'
                      ? 'bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 border border-orange-500/30'
                      : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                  )}
                >
                  <ArrowRightFromLine className="w-4 h-4" />
                  Despachar
                </motion.button>
              </Link>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="w-4 h-4" />
                Nuevo Item
              </motion.button>
            </div>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Items */}
            <motion.div
              whileHover={{ y: -2 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Total Items
                    </p>
                    <p className={cn('text-3xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {stats.totalItems}
                    </p>
                  </div>
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                  )}>
                    <Package className={cn('w-6 h-6', theme === 'dark' ? 'text-blue-400' : 'text-blue-600')} />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Low Stock */}
            <motion.div
              whileHover={{ y: -2 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600"></div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Stock Bajo
                    </p>
                    <p className={cn('text-3xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {stats.lowStock}
                    </p>
                  </div>
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-100'
                  )}>
                    <AlertTriangle className={cn('w-6 h-6', theme === 'dark' ? 'text-amber-400' : 'text-amber-600')} />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Dispatches This Month */}
            <motion.div
              whileHover={{ y: -2 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600"></div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                      Despachos este Mes
                    </p>
                    <p className={cn('text-3xl font-bold mt-1', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {stats.dispatchesThisMonth}
                    </p>
                  </div>
                  <div className={cn(
                    'p-3 rounded-xl',
                    theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100'
                  )}>
                    <TrendingUp className={cn('w-6 h-6', theme === 'dark' ? 'text-green-400' : 'text-green-600')} />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Filters */}
          <motion.div
            variants={itemVariants}
            className={cn(
              'rounded-2xl border shadow-xl p-4',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}
          >
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search className={cn(
                  'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )} />
                <input
                  type="text"
                  placeholder="Buscar por nombre o codigo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className={cn(
                    'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                />
              </div>

              {/* Category Filter */}
              <div className="relative w-full md:w-48">
                <Filter className={cn(
                  'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )} />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={cn(
                    'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all appearance-none',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Todas las categorias</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse Filter */}
              <div className="relative w-full md:w-48">
                <Package className={cn(
                  'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )} />
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className={cn(
                    'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all appearance-none',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="">Todos los almacenes</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={String(wh.id)}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refresh */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                className={cn(
                  'p-2.5 rounded-xl border transition-all',
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.button>
            </div>
          </motion.div>

          {/* Table */}
          <motion.div
            variants={itemVariants}
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
                  <tr
                    className={cn(
                      'border-b',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50/50'
                    )}
                  >
                    {['Codigo', 'Nombre', 'Categoria', 'Stock', 'Unidad', 'Almacen', 'Estado', 'Acciones'].map(
                      (header) => (
                        <th
                          key={header}
                          className={cn(
                            'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}
                        >
                          {header}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className={cn('w-5 h-5 animate-spin', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                          <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            Cargando consumibles...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <Package className={cn('w-12 h-12 mx-auto mb-3', theme === 'dark' ? 'text-gray-600' : 'text-gray-300')} />
                        <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          No se encontraron consumibles
                        </p>
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <motion.tr
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn(
                          'border-b transition-colors',
                          theme === 'dark'
                            ? 'border-gray-700/50 hover:bg-gray-700/30'
                            : 'border-gray-100 hover:bg-gray-50/50'
                        )}
                      >
                        <td className={cn('px-4 py-3 text-sm font-mono', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                          {item.code || '-'}
                        </td>
                        <td className={cn('px-4 py-3 text-sm font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {item.name}
                        </td>
                        <td className={cn('px-4 py-3 text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                          <span
                            className={cn(
                              'px-2 py-1 rounded-lg text-xs font-medium',
                              theme === 'dark'
                                ? 'bg-gray-700/50 text-gray-300'
                                : 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {item.category || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full',
                                item.currentStock <= item.minStock
                                  ? 'bg-red-500'
                                  : 'bg-green-500'
                              )}
                            />
                            <span
                              className={cn(
                                'font-medium',
                                item.currentStock <= item.minStock
                                  ? theme === 'dark'
                                    ? 'text-red-400'
                                    : 'text-red-600'
                                  : theme === 'dark'
                                  ? 'text-green-400'
                                  : 'text-green-600'
                              )}
                            >
                              {item.currentStock}
                            </span>
                            <span className={cn('text-xs', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}>
                              / min: {item.minStock}
                            </span>
                          </div>
                        </td>
                        <td className={cn('px-4 py-3 text-sm capitalize', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                          {item.unit}
                        </td>
                        <td className={cn('px-4 py-3 text-sm', theme === 'dark' ? 'text-gray-300' : 'text-gray-600')}>
                          {item.warehouseName || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={cn(
                              'px-2.5 py-1 rounded-full text-xs font-medium',
                              item.status === 'active'
                                ? theme === 'dark'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-green-100 text-green-700'
                                : theme === 'dark'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-red-100 text-red-700'
                            )}
                          >
                            {item.status === 'active' ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleDelete(item.id)}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              theme === 'dark'
                                ? 'text-red-400 hover:bg-red-500/20'
                                : 'text-red-500 hover:bg-red-50'
                            )}
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div
                className={cn(
                  'flex items-center justify-between px-4 py-3 border-t',
                  theme === 'dark' ? 'border-gray-700 bg-gray-800/30' : 'border-gray-200 bg-gray-50/30'
                )}
              >
                <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  Mostrando {(pagination.page - 1) * pagination.limit + 1} -{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} items
                </p>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className={cn(
                      'p-2 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                      theme === 'dark'
                        ? 'border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </motion.button>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      const current = pagination.page
                      return p === 1 || p === pagination.totalPages || Math.abs(p - current) <= 1
                    })
                    .reduce<(number | string)[]>((acc, p, i, arr) => {
                      if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) {
                        acc.push('...')
                      }
                      acc.push(p)
                      return acc
                    }, [])
                    .map((p, idx) =>
                      p === '...' ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className={cn('px-2 text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-400')}
                        >
                          ...
                        </span>
                      ) : (
                        <motion.button
                          key={p}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handlePageChange(p as number)}
                          className={cn(
                            'w-8 h-8 rounded-lg text-sm font-medium transition-all',
                            pagination.page === p
                              ? 'bg-blue-500 text-white shadow-lg'
                              : theme === 'dark'
                              ? 'text-gray-400 hover:bg-gray-700 hover:text-white'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          )}
                        >
                          {p}
                        </motion.button>
                      )
                    )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className={cn(
                      'p-2 rounded-lg border transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                      theme === 'dark'
                        ? 'border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    )}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* Create Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowCreateModal(false)
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={cn(
                  'relative w-full max-w-lg mx-4 rounded-2xl border shadow-2xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-white to-slate-50 border-slate-200'
                )}
              >
                {/* Modal Header */}
                <div
                  className={cn(
                    'flex items-center justify-between px-6 py-4 border-b',
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}
                >
                  <h2 className={cn('text-lg font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    Nuevo Consumible
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowCreateModal(false)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'
                    )}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                  {/* Name */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      placeholder="Nombre del consumible"
                      required
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  {/* Code */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Codigo (opcional)
                    </label>
                    <input
                      type="text"
                      value={newItem.code}
                      onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                      placeholder="Codigo del item"
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className={cn('block text-sm font-medium mb-1.5', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                      Descripcion
                    </label>
                    <textarea
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      placeholder="Descripcion del consumible"
                      rows={2}
                      className={cn(
                        'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                        theme === 'dark'
                          ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                      )}
                    />
                  </div>

                  {/* Category & Unit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={cn('block text-sm font-medium mb-1.5', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Categoria
                      </label>
                      <input
                        type="text"
                        value={newItem.category}
                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                        placeholder="Ej: Limpieza"
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1.5', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Unidad
                      </label>
                      <select
                        value={newItem.unit}
                        onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all appearance-none',
                          theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      >
                        <option value="unidad">Unidad</option>
                        <option value="caja">Caja</option>
                        <option value="rollo">Rollo</option>
                        <option value="litro">Litro</option>
                        <option value="kg">Kg</option>
                      </select>
                    </div>
                  </div>

                  {/* Min Stock & Warehouse */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={cn('block text-sm font-medium mb-1.5', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Stock Minimo
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={newItem.minStock}
                        onChange={(e) => setNewItem({ ...newItem, minStock: Number(e.target.value) })}
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                          theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      />
                    </div>
                    <div>
                      <label className={cn('block text-sm font-medium mb-1.5', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Almacen
                      </label>
                      <select
                        value={newItem.warehouseId}
                        onChange={(e) => setNewItem({ ...newItem, warehouseId: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all appearance-none',
                          theme === 'dark'
                            ? 'bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                            : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                        )}
                      >
                        <option value="">Seleccionar almacen</option>
                        {warehouses.map((wh) => (
                          <option key={wh.id} value={String(wh.id)}>
                            {wh.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCreateModal(false)}
                      className={cn(
                        'px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
                        theme === 'dark'
                          ? 'border-gray-700 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      Cancelar
                    </motion.button>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={creating}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Crear Item
                        </>
                      )}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
