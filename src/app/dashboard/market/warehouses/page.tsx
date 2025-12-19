'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Warehouse,
  Plus,
  Search,
  MapPin,
  Package,
  Phone,
  Mail,
  User,
  Star,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Filter,
  X,
  Eye,
  Edit,
  Trash2,
  Building
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface WarehouseData {
  id: number
  code: string
  name: string
  isCentral: boolean
  warehouseType: string
  address: string
  city: string
  state: string
  municipality: string
  country: string
  latitude: number | null
  longitude: number | null
  managerName: string
  phone: string
  email: string
  isActive: boolean
  allowNegativeStock: boolean
  productsCount: number
  totalStock: number
  createdAt: string
  updatedAt: string
}

interface Stats {
  total: number
  active: number
  inactive: number
  central: number
}

const WAREHOUSE_TYPES: Record<string, { label: string; color: string }> = {
  storage: { label: 'Almacenaje', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  distribution: { label: 'Distribución', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  retail: { label: 'Punto de Venta', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
}

export default function MarketWarehousesPage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, central: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [deleteWarehouse, setDeleteWarehouse] = useState<WarehouseData | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  const fetchWarehouses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const response = await fetch(`/api/market/warehouses?${params}`)
      const data = await response.json()

      if (data.success) {
        setWarehouses(data.data.warehouses)
        setStats(data.data.stats)
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWarehouses()
  }, [statusFilter])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchWarehouses()
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  const handleDeleteWarehouse = async () => {
    if (!deleteWarehouse) return

    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch(`/api/market/warehouses/${deleteWarehouse.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setWarehouses(prev => prev.filter(w => w.id !== deleteWarehouse.id))
        setStats(prev => ({
          ...prev,
          total: prev.total - 1,
          active: deleteWarehouse.isActive ? prev.active - 1 : prev.active,
          inactive: !deleteWarehouse.isActive ? prev.inactive - 1 : prev.inactive,
          central: deleteWarehouse.isCentral ? prev.central - 1 : prev.central
        }))
        setDeleteWarehouse(null)
      } else {
        setDeleteError(data.error || 'Error al eliminar el almacén')
      }
    } catch (error) {
      console.error('Error deleting warehouse:', error)
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
            {/* Stats Cards - Estilo Productos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* Total Almacenes */}
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
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-blue-900/30 border border-blue-800/50'
                          : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                      )}>
                        <Warehouse className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Total Almacenes</p>
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
                      )}>Registrados</span>
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
                        )}>Activos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.active}</p>
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
                        )}>Operativos</span>
                      </div>
                      <span className={cn(
                        'text-xs font-bold',
                        theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                      )}>
                        {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Inactivos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => setStatusFilter(statusFilter === 'inactive' ? null : 'inactive')}
                className={cn(
                  'relative overflow-hidden cursor-pointer',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl',
                  statusFilter === 'inactive' && 'ring-2 ring-red-500'
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
                        <XCircle className="w-6 h-6 text-red-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Inactivos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.inactive}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                        <span className={cn(
                          'text-xs font-medium',
                          theme === 'dark' ? 'text-gray-500' : 'text-black'
                        )}>Deshabilitados</span>
                      </div>
                      <span className={cn(
                        'text-xs font-bold',
                        theme === 'dark' ? 'text-red-400' : 'text-red-600'
                      )}>
                        {stats.total > 0 ? Math.round((stats.inactive / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-red-100 dark:bg-red-900/30 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-red-400 to-rose-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.inactive / stats.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Centrales */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
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
                        <Star className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-black'
                        )}>Centrales</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.central}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      <span className={cn(
                        'text-xs font-medium',
                        theme === 'dark' ? 'text-gray-500' : 'text-black'
                      )}>Almacenes principales</span>
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
                    placeholder="Buscar por nombre, código o ciudad..."
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

                {/* Clear Filters */}
                {(search || statusFilter) && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSearch('')
                      setStatusFilter(null)
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

                {/* Refresh */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={fetchWarehouses}
                  disabled={loading}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all',
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                </motion.button>

                {/* Nuevo Almacén */}
                <Link href="/dashboard/market/warehouses/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25"
                  >
                    <Plus className="w-5 h-5" />
                    Nuevo Almacén
                  </motion.button>
                </Link>
              </div>
            </motion.div>

            {/* Warehouses Table */}
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
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Almacén</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Productos</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={8} className="py-4 px-4">
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
                    ) : warehouses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center">
                          <Warehouse className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className="text-gray-500 dark:text-gray-400">No hay almacenes</p>
                          <Link href="/dashboard/market/warehouses/create">
                            <button className="mt-3 text-sm text-blue-500 hover:text-blue-600">
                              Crear primer almacén
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      warehouses.map((warehouse, index) => (
                        <motion.tr
                          key={warehouse.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            'group transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-14 h-14 rounded-xl flex items-center justify-center shadow-sm border relative',
                                warehouse.isActive
                                  ? theme === 'dark' ? 'bg-blue-900/30 border-blue-800/50' : 'bg-blue-50 border-blue-200'
                                  : theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'
                              )}>
                                <Warehouse className={cn(
                                  'w-6 h-6',
                                  warehouse.isActive
                                    ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                                    : 'text-gray-400'
                                )} />
                                {warehouse.isCentral && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                                    <Star className="w-3 h-3 text-white" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{warehouse.name}</p>
                                {warehouse.managerName && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                    <User className="w-3 h-3" /> {warehouse.managerName}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">{warehouse.code}</span>
                          </td>
                          <td className="py-4 px-4">
                            <span className={cn(
                              "text-xs px-2.5 py-1 rounded-full font-medium",
                              WAREHOUSE_TYPES[warehouse.warehouseType]?.color || 'bg-gray-100 text-gray-600'
                            )}>
                              {WAREHOUSE_TYPES[warehouse.warehouseType]?.label || warehouse.warehouseType}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {(warehouse.address || warehouse.city) ? (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="truncate max-w-[200px]">
                                  {[warehouse.city, warehouse.state].filter(Boolean).join(', ')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Sin ubicación</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {warehouse.productsCount}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {warehouse.totalStock.toLocaleString()}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={cn(
                              'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium',
                              warehouse.isActive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            )}>
                              {warehouse.isActive ? (
                                <><CheckCircle className="w-3.5 h-3.5" /> Activo</>
                              ) : (
                                <><XCircle className="w-3.5 h-3.5" /> Inactivo</>
                              )}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Link href={`/dashboard/market/warehouses/${warehouse.id}`}>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Ver detalles"
                                >
                                  <Eye className="w-4 h-4 text-blue-500" />
                                </motion.button>
                              </Link>
                              <Link href={`/dashboard/market/warehouses/${warehouse.id}/edit`}>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                  title="Editar almacén"
                                >
                                  <Edit className="w-4 h-4 text-amber-500" />
                                </motion.button>
                              </Link>
                              {isAdmin && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => setDeleteWarehouse(warehouse)}
                                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title="Eliminar almacén"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </motion.button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
              {deleteWarehouse && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                  onClick={() => !deleting && setDeleteWarehouse(null)}
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
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Eliminar Almacén</h3>
                        <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
                      </div>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl mb-4',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    )}>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-12 h-12 rounded-lg flex items-center justify-center',
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )}>
                          <Warehouse className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{deleteWarehouse.name}</p>
                          <p className="text-sm text-gray-500">Código: {deleteWarehouse.code}</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      ¿Estás seguro de que deseas eliminar este almacén? Se eliminará permanentemente del sistema.
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
                        onClick={() => { setDeleteWarehouse(null); setDeleteError(null); }}
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
                        onClick={handleDeleteWarehouse}
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
      </DashboardLayout>
    </ProtectedRoute>
  )
}
