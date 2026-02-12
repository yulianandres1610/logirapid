'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  Loader2,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Printer,
  Eye,
  Trash2,
  MapPin,
  User,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Package
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'

interface FixedAsset {
  id: number
  assetCode: string
  barcode: string
  name: string
  description: string
  categoryId: number
  categoryName: string
  assetType: string
  warehouseId: number
  warehouseName: string
  locationCode: string
  responsibleEmployeeId: number
  responsibleName: string
  acquisitionDate: string
  acquisitionCost: number
  currency: string
  currentValue: number
  status: string
  condition: string
  lastAuditDate: string
  createdAt: string
}

interface Category {
  id: number
  name: string
  code: string
}

interface Warehouse {
  id: number
  name: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; gradient: string }> = {
  active: { label: 'Activo', color: 'emerald', icon: CheckCircle2, gradient: 'from-emerald-400 to-green-600' },
  in_repair: { label: 'En Reparación', color: 'amber', icon: Wrench, gradient: 'from-amber-400 to-orange-600' },
  disposed: { label: 'Dado de Baja', color: 'gray', icon: Trash2, gradient: 'from-gray-400 to-gray-600' },
  lost: { label: 'Perdido', color: 'red', icon: AlertTriangle, gradient: 'from-red-400 to-rose-600' }
}

export default function FixedAssetsPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Data for filters
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inRepair: 0,
    lost: 0,
    totalValue: 0
  })

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/market/fixed-assets/categories?flat=true')
        const data = await res.json()
        if (data.success) {
          setCategories(data.data)
        }
      } catch {
        console.error('Error fetching categories')
      }
    }
    fetchCategories()
  }, [])

  // Fetch warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await fetch('/api/market/warehouses')
        const data = await res.json()
        if (data.success) {
          setWarehouses(data.data.warehouses || data.data || [])
        }
      } catch {
        console.error('Error fetching warehouses')
      }
    }
    fetchWarehouses()
  }, [])

  const fetchAssets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)
    setError(null)

    try {
      let url = `/api/market/fixed-assets?page=${page}&limit=${limit}`
      if (search) url += `&search=${encodeURIComponent(search)}`
      if (statusFilter) url += `&status=${statusFilter}`
      if (categoryFilter) url += `&categoryId=${categoryFilter}`
      if (warehouseFilter) url += `&warehouseId=${warehouseFilter}`

      const res = await fetch(url)
      const data = await res.json()

      if (data.success) {
        setAssets(data.data.assets)
        setTotalPages(data.data.pagination.totalPages)
        setTotal(data.data.pagination.total)
        setLastUpdated(new Date())

        // Use stats from API if available, otherwise calculate
        if (data.data.stats) {
          setStats({
            total: data.data.pagination.total,
            active: data.data.stats.active || 0,
            inRepair: data.data.stats.inRepair || 0,
            lost: data.data.stats.lost || 0,
            totalValue: data.data.stats.totalValue || 0
          })
        } else {
          // Fallback calculation from current page
          const activeCount = data.data.assets.filter((a: FixedAsset) => a.status === 'active').length
          const inRepairCount = data.data.assets.filter((a: FixedAsset) => a.status === 'in_repair').length
          const lostCount = data.data.assets.filter((a: FixedAsset) => a.status === 'lost').length
          const totalValue = data.data.assets.reduce((sum: number, a: FixedAsset) => sum + (a.currentValue || 0), 0)

          setStats({
            total: data.data.pagination.total,
            active: activeCount,
            inRepair: inRepairCount,
            lost: lostCount,
            totalValue
          })
        }
      } else {
        setError(data.error || 'Error al cargar activos')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }, [page, search, statusFilter, categoryFilter, warehouseFilter])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  // Debounce search
  useEffect(() => {
    const debounce = setTimeout(() => {
      if (page === 1) {
        fetchAssets()
      } else {
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const clearFilters = () => {
    setSearch('')
    setStatusFilter(null)
    setCategoryFilter('')
    setWarehouseFilter('')
    setPage(1)
  }

  const deleteAsset = async (id: number) => {
    if (!confirm('¿Dar de baja este activo? El activo quedará marcado como "disposed".')) return

    try {
      const res = await fetch(`/api/market/fixed-assets/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Dado de baja por usuario' })
      })
      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Activo dado de baja', 'El activo ha sido marcado como dado de baja')
        fetchAssets(true)
      } else {
        showNotification('error', 'Error', data.error || 'Error al dar de baja')
      }
    } catch {
      showNotification('error', 'Error de conexión', 'No se pudo completar la operación')
    }
  }

  const formatCurrency = (value: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(value)
  }

  const handleManualRefresh = () => fetchAssets(true)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
              {/* Total Activos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => setStatusFilter(null)}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  statusFilter === null && 'ring-2 ring-blue-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-blue-900/30 border border-blue-800/50'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                    )}>
                      <Box className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>Total Activos</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.total}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Activos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={() => setStatusFilter(statusFilter === 'active' ? null : 'active')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  statusFilter === 'active' && 'ring-2 ring-emerald-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-emerald-900/30 border border-emerald-800/50'
                        : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                    )}>
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>Activos</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.active}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* En Reparación */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => setStatusFilter(statusFilter === 'in_repair' ? null : 'in_repair')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  statusFilter === 'in_repair' && 'ring-2 ring-amber-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-amber-900/30 border border-amber-800/50'
                        : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                    )}>
                      <Wrench className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>En Reparación</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.inRepair}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Perdidos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => setStatusFilter(statusFilter === 'lost' ? null : 'lost')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  statusFilter === 'lost' && 'ring-2 ring-red-500'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-rose-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-red-900/30 border border-red-800/50'
                        : 'bg-gradient-to-br from-red-50 to-rose-100 border border-red-200'
                    )}>
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>Perdidos</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{stats.lost}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Valor Total */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-purple-900/30 border border-purple-800/50'
                        : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                    )}>
                      <DollarSign className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>Valor Total</p>
                      <p className={cn(
                        'text-2xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{formatCurrency(stats.totalValue)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
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
                    placeholder="Buscar por nombre, código, serie..."
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

                {/* Filter Toggle */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                    showFilters
                      ? 'bg-blue-500 text-white'
                      : theme === 'dark'
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <Filter className="w-4 h-4" />
                  Filtros
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showFilters && "rotate-180")} />
                </motion.button>

                {/* Clear Filters */}
                {(search || statusFilter || categoryFilter || warehouseFilter) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={clearFilters}
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

                {/* Refresh */}
                <div className="flex items-center gap-2">
                  {lastUpdated && (
                    <span className="text-xs text-gray-400 hidden sm:inline">
                      {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleManualRefresh}
                    disabled={loading || isRefreshing}
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

                {/* Action Buttons */}
                <Link href="/dashboard/market/fixed-assets/categories">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    )}
                  >
                    <Tag className="w-4 h-4" />
                    <span className="hidden sm:inline">Categorías</span>
                  </motion.button>
                </Link>

                <Link href="/dashboard/market/fixed-assets/audits">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/25"
                  >
                    <Package className="w-4 h-4" />
                    <span className="hidden sm:inline">Auditorías</span>
                  </motion.button>
                </Link>

                <Link href="/dashboard/market/fixed-assets/new">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Nuevo Activo</span>
                  </motion.button>
                </Link>
              </div>

              {/* Expanded Filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={cn(
                      "mt-4 pt-4 border-t grid grid-cols-1 sm:grid-cols-3 gap-4",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}
                  >
                    <div>
                      <label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Categoría
                      </label>
                      <select
                        value={categoryFilter}
                        onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
                        className={cn(
                          "w-full mt-1 px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        )}
                      >
                        <option value="">Todas las categorías</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={cn("text-sm font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Ubicación
                      </label>
                      <select
                        value={warehouseFilter}
                        onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1) }}
                        className={cn(
                          "w-full mt-1 px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                          theme === 'dark'
                            ? 'bg-gray-800 border-gray-700 text-white'
                            : 'bg-white border-gray-200 text-gray-900'
                        )}
                      >
                        <option value="">Todas las ubicaciones</option>
                        {warehouses.map(wh => (
                          <option key={wh.id} value={wh.id}>{wh.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={clearFilters}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-colors",
                          theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        )}
                      >
                        <X className="w-4 h-4" />
                        Limpiar filtros
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Assets Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className={cn(
                'rounded-2xl border shadow-xl overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
              )}
            >
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : error ? (
                <div className={cn(
                  "p-8 text-center",
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                )}>
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                  <p>{error}</p>
                  <button
                    onClick={() => fetchAssets()}
                    className="mt-4 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600"
                  >
                    Reintentar
                  </button>
                </div>
              ) : assets.length === 0 ? (
                <div className="py-12 text-center">
                  <Box className={cn(
                    "w-16 h-16 mx-auto mb-4",
                    theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                  )} />
                  <h3 className={cn(
                    "text-lg font-semibold mb-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    No hay activos registrados
                  </h3>
                  <p className={cn("mb-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                    Comienza agregando tu primer activo fijo
                  </p>
                  <Link href="/dashboard/market/fixed-assets/new">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25"
                    >
                      <Plus className="w-5 h-5" />
                      Crear Activo
                    </motion.button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={cn(
                          'border-b',
                          theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                        )}>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Activo</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                          <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Responsable</th>
                          <th className="text-right py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                          <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {assets.map((asset, index) => {
                          const statusConfig = STATUS_CONFIG[asset.status] || STATUS_CONFIG.active
                          const StatusIcon = statusConfig.icon

                          return (
                            <motion.tr
                              key={asset.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.02 }}
                              className={cn(
                                'group transition-colors',
                                theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                              )}
                            >
                              <td className="py-4 px-4">
                                <div>
                                  <p className={cn(
                                    "font-medium",
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {asset.name}
                                  </p>
                                  <p className={cn(
                                    "text-xs font-mono",
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                  )}>
                                    {asset.assetCode}
                                  </p>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <span className={cn(
                                  "text-sm",
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  {asset.categoryName || '-'}
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-1.5">
                                  <MapPin className={cn(
                                    "w-3.5 h-3.5",
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                  )} />
                                  <span className={cn(
                                    "text-sm",
                                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                  )}>
                                    {asset.warehouseName || '-'}
                                    {asset.locationCode && ` / ${asset.locationCode}`}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-1.5">
                                  <User className={cn(
                                    "w-3.5 h-3.5",
                                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                  )} />
                                  <span className={cn(
                                    "text-sm",
                                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                  )}>
                                    {asset.responsibleName || '-'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-right">
                                <span className={cn(
                                  "text-sm font-bold",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {formatCurrency(asset.currentValue || asset.acquisitionCost, asset.currency)}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <span className={cn(
                                  'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium',
                                  statusConfig.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
                                  statusConfig.color === 'emerald' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                                  statusConfig.color === 'amber' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                                  statusConfig.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                )}>
                                  <StatusIcon className="w-3.5 h-3.5" />
                                  {statusConfig.label}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Link href={`/dashboard/market/fixed-assets/${asset.id}`}>
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                      title="Ver detalle"
                                    >
                                      <Eye className="w-4 h-4 text-blue-500" />
                                    </motion.button>
                                  </Link>
                                  {asset.status !== 'disposed' && (
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => deleteAsset(asset.id)}
                                      className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                      title="Dar de baja"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                    </motion.button>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className={cn(
                      'flex items-center justify-between px-4 py-3 border-t',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
                    )}>
                      <p className="text-sm text-gray-500">
                        Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
                      </p>
                      <div className="flex items-center gap-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
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
                          {page} / {totalPages}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
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
                </>
              )}
            </motion.div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
