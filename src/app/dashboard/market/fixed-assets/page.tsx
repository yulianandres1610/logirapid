'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Box,
  Loader2,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Printer,
  Eye,
  Edit,
  Trash2,
  MapPin,
  User,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  X,
  ChevronDown
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Activo', color: 'text-green-500 bg-green-500/10', icon: CheckCircle2 },
  in_repair: { label: 'En Reparación', color: 'text-yellow-500 bg-yellow-500/10', icon: Wrench },
  disposed: { label: 'Dado de Baja', color: 'text-gray-500 bg-gray-500/10', icon: Trash2 },
  lost: { label: 'Perdido', color: 'text-red-500 bg-red-500/10', icon: AlertTriangle }
}

const ASSET_TYPES: Record<string, string> = {
  hardware: 'Hardware',
  furniture: 'Mobiliario',
  equipment: 'Equipamiento',
  vehicle: 'Vehículo',
  other: 'Otro'
}

export default function FixedAssetsPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 20

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
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

        // Calculate simple stats from current page (for demo)
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchAssets()
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('es-ES')
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
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className={cn(
                  "text-2xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Activos Fijos
                </h1>
                <p className={cn(
                  "text-sm mt-1",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Inventario de base material de la empresa
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchAssets(true)}
                  disabled={isRefreshing}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  )}
                >
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
                <Link
                  href="/dashboard/market/fixed-assets/categories"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  )}
                >
                  <Tag className="w-4 h-4" />
                  <span className="hidden sm:inline">Categorías</span>
                </Link>
                <Link
                  href="/dashboard/market/fixed-assets/audits"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                    theme === 'dark'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                  )}
                >
                  <Box className="w-4 h-4" />
                  <span className="hidden sm:inline">Auditorías</span>
                </Link>
                <Link
                  href="/dashboard/market/fixed-assets/new"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                    theme === 'dark'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  )}
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Nuevo Activo</span>
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Total</p>
                <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {stats.total}
                </p>
              </div>
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Activos</p>
                <p className="text-2xl font-bold text-green-500">{stats.active}</p>
              </div>
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>En Reparación</p>
                <p className="text-2xl font-bold text-yellow-500">{stats.inRepair}</p>
              </div>
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Perdidos</p>
                <p className="text-2xl font-bold text-red-500">{stats.lost}</p>
              </div>
              <div className={cn(
                "p-4 rounded-xl",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
                <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Valor Total</p>
                <p className={cn("text-xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                  {formatCurrency(stats.totalValue)}
                </p>
              </div>
            </div>

            {/* Search and Filters */}
            <div className={cn(
              "p-4 rounded-xl",
              theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
            )}>
              <div className="flex flex-col sm:flex-row gap-4">
                <form onSubmit={handleSearch} className="flex-1">
                  <div className="relative">
                    <Search className={cn(
                      "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                    )} />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, código, serie..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={cn(
                        "w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                          : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
                      )}
                    />
                  </div>
                </form>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border",
                    showFilters
                      ? 'bg-blue-500 text-white border-blue-500'
                      : theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700'
                  )}
                >
                  <Filter className="w-4 h-4" />
                  Filtros
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showFilters && "rotate-180")} />
                </button>
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4"
                >
                  <div>
                    <label className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Estado
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                      className={cn(
                        "w-full mt-1 px-3 py-2 rounded-lg border focus:outline-none",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    >
                      <option value="">Todos</option>
                      {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                        <option key={value} value={value}>{config.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Categoría
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
                      className={cn(
                        "w-full mt-1 px-3 py-2 rounded-lg border focus:outline-none",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    >
                      <option value="">Todas</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                      Ubicación
                    </label>
                    <select
                      value={warehouseFilter}
                      onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1) }}
                      className={cn(
                        "w-full mt-1 px-3 py-2 rounded-lg border focus:outline-none",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                      )}
                    >
                      <option value="">Todas</option>
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      onClick={clearFilters}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg",
                        theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
                      )}
                    >
                      <X className="w-4 h-4" />
                      Limpiar filtros
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Assets Table */}
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : error ? (
              <div className={cn(
                "p-8 rounded-xl text-center",
                theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
              )}>
                <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                <p>{error}</p>
                <button
                  onClick={() => fetchAssets()}
                  className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Reintentar
                </button>
              </div>
            ) : assets.length === 0 ? (
              <div className={cn(
                "p-12 rounded-xl text-center",
                theme === 'dark' ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'
              )}>
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
                <Link
                  href="/dashboard/market/fixed-assets/new"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  <Plus className="w-5 h-5" />
                  Crear Activo
                </Link>
              </div>
            ) : (
              <>
                <div className={cn(
                  "rounded-xl overflow-hidden border",
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                )}>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={cn(
                        theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      )}>
                        <tr>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Activo
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Categoría
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Ubicación
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Responsable
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Valor
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Estado
                          </th>
                          <th className={cn(
                            "px-4 py-3 text-right text-xs font-medium uppercase tracking-wider",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className={cn(
                        "divide-y",
                        theme === 'dark' ? 'divide-gray-700 bg-gray-800/30' : 'divide-gray-200 bg-white'
                      )}>
                        {assets.map((asset) => {
                          const statusConfig = STATUS_CONFIG[asset.status] || STATUS_CONFIG.active
                          const StatusIcon = statusConfig.icon

                          return (
                            <tr key={asset.id} className={cn(
                              "transition-colors",
                              theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
                            )}>
                              <td className="px-4 py-3">
                                <div>
                                  <p className={cn(
                                    "font-medium",
                                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                                  )}>
                                    {asset.name}
                                  </p>
                                  <p className={cn(
                                    "text-xs",
                                    theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                                  )}>
                                    {asset.assetCode}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "text-sm",
                                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  {asset.categoryName || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <MapPin className={cn(
                                    "w-3 h-3",
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
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <User className={cn(
                                    "w-3 h-3",
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
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "text-sm font-medium",
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {formatCurrency(asset.currentValue || asset.acquisitionCost, asset.currency)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                                  statusConfig.color
                                )}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusConfig.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  <Link
                                    href={`/dashboard/market/fixed-assets/${asset.id}`}
                                    className={cn(
                                      "p-2 rounded-lg transition-colors",
                                      theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                                    )}
                                    title="Ver detalles"
                                  >
                                    <Eye className={cn(
                                      "w-4 h-4",
                                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                                    )} />
                                  </Link>
                                  <button
                                    onClick={() => deleteAsset(asset.id)}
                                    className={cn(
                                      "p-2 rounded-lg transition-colors",
                                      theme === 'dark' ? 'hover:bg-red-900/50' : 'hover:bg-red-50'
                                    )}
                                    title="Dar de baja"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center">
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className={cn(
                          "px-4 py-2 rounded-lg transition-colors disabled:opacity-50",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className={cn(
                          "px-4 py-2 rounded-lg transition-colors disabled:opacity-50",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        )}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
