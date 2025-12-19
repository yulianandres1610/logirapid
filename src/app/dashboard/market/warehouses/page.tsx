'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Warehouse,
  Plus,
  Search,
  MapPin,
  Package,
  ArrowRight,
  Phone,
  Mail,
  User,
  Building,
  Star,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  ArrowUpDown,
  Filter
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
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
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, central: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const fetchWarehouses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)

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
  }, [search, statusFilter])

  const statCards = [
    {
      title: 'Total Almacenes',
      value: stats.total,
      icon: Warehouse,
      gradient: 'from-blue-400 to-blue-600',
      bgGradient: theme === 'dark' ? 'from-blue-900/30 to-blue-800/20' : 'from-blue-50 to-white',
      iconBg: theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100',
      textColor: theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
    },
    {
      title: 'Activos',
      value: stats.active,
      icon: CheckCircle,
      gradient: 'from-emerald-400 to-emerald-600',
      bgGradient: theme === 'dark' ? 'from-emerald-900/30 to-emerald-800/20' : 'from-emerald-50 to-white',
      iconBg: theme === 'dark' ? 'bg-emerald-900/50' : 'bg-emerald-100',
      textColor: theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
    },
    {
      title: 'Inactivos',
      value: stats.inactive,
      icon: XCircle,
      gradient: 'from-red-400 to-red-600',
      bgGradient: theme === 'dark' ? 'from-red-900/30 to-red-800/20' : 'from-red-50 to-white',
      iconBg: theme === 'dark' ? 'bg-red-900/50' : 'bg-red-100',
      textColor: theme === 'dark' ? 'text-red-400' : 'text-red-600'
    },
    {
      title: 'Central',
      value: stats.central,
      icon: Star,
      gradient: 'from-amber-400 to-amber-600',
      bgGradient: theme === 'dark' ? 'from-amber-900/30 to-amber-800/20' : 'from-amber-50 to-white',
      iconBg: theme === 'dark' ? 'bg-amber-900/50' : 'bg-amber-100',
      textColor: theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
    }
  ]

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen p-4 lg:p-6",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className={cn(
                  "text-2xl sm:text-3xl font-bold",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Almacenes
                </h1>
                <p className={cn(
                  "text-sm mt-1",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Gestiona los almacenes de tu negocio
                </p>
              </div>

              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchWarehouses()}
                  disabled={loading}
                  className={cn(
                    "p-2.5 rounded-xl transition-all",
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                      : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
                  )}
                >
                  <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
                </motion.button>

                <Link href="/dashboard/market/warehouses/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all",
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-400/25'
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    <span className="hidden sm:inline">Nuevo Almacén</span>
                  </motion.button>
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'relative overflow-hidden',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                    'rounded-2xl border shadow-xl'
                  )}
                >
                  {/* Gradient top border */}
                  <div className={cn("absolute top-0 left-0 w-full h-1 bg-gradient-to-r", stat.gradient)} />

                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn(
                          "text-sm font-medium",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          {stat.title}
                        </p>
                        <p className={cn(
                          "text-3xl font-bold mt-1",
                          stat.textColor
                        )}>
                          {stat.value}
                        </p>
                      </div>
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        stat.iconBg
                      )}>
                        <stat.icon className={cn("w-6 h-6", stat.textColor)} />
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className={cn(
                      "mt-4 h-1.5 rounded-full overflow-hidden",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                    )}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: stats.total > 0 ? `${(stat.value / stats.total) * 100}%` : '0%' }}
                        transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                        className={cn("h-full rounded-full bg-gradient-to-r", stat.gradient)}
                      />
                    </div>
                  </div>

                  {/* Pulsing dot */}
                  <div className="absolute top-3 right-3">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={cn("w-2 h-2 rounded-full bg-gradient-to-r", stat.gradient)}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Filters */}
            <div className={cn(
              "flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border",
              theme === 'dark'
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-white border-gray-200'
            )}>
              {/* Search */}
              <div className="flex-1 relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, código o ciudad..."
                  className={cn(
                    'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                    theme === 'dark'
                      ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20 placeholder:text-gray-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20 placeholder:text-gray-400'
                  )}
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                    theme === 'dark'
                      ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                      : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                  )}
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </div>
            </div>

            {/* Warehouses Grid */}
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className={cn(
                  "w-8 h-8 animate-spin",
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                )} />
              </div>
            ) : warehouses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "text-center py-16 rounded-2xl border",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}
              >
                <Warehouse className={cn(
                  "w-16 h-16 mx-auto mb-4",
                  theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                )} />
                <h3 className={cn(
                  "text-lg font-semibold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  No hay almacenes
                </h3>
                <p className={cn(
                  "text-sm mb-6",
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                )}>
                  Crea tu primer almacén para comenzar a gestionar el inventario
                </p>
                <Link href="/dashboard/market/warehouses/create">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      theme === 'dark'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    )}
                  >
                    <Plus className="w-5 h-5" />
                    Crear Almacén
                  </motion.button>
                </Link>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {warehouses.map((warehouse, index) => (
                  <motion.div
                    key={warehouse.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className={cn(
                      'relative overflow-hidden rounded-2xl border shadow-lg',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                  >
                    {/* Central badge */}
                    {warehouse.isCentral && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
                          <Star className="w-3 h-3 inline mr-1" />
                          CENTRAL
                        </div>
                      </div>
                    )}

                    <div className="p-5">
                      {/* Header */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0",
                          warehouse.isActive
                            ? theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
                            : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}>
                          <Warehouse className={cn(
                            "w-7 h-7",
                            warehouse.isActive
                              ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                              : 'text-gray-400'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className={cn(
                            "font-semibold truncate",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {warehouse.name}
                          </h3>
                          <p className={cn(
                            "text-sm font-mono",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                          )}>
                            {warehouse.code}
                          </p>
                        </div>
                      </div>

                      {/* Type & Status */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-medium",
                          WAREHOUSE_TYPES[warehouse.warehouseType]?.color || 'bg-gray-100 text-gray-600'
                        )}>
                          {WAREHOUSE_TYPES[warehouse.warehouseType]?.label || warehouse.warehouseType}
                        </span>
                        <span className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-medium",
                          warehouse.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        )}>
                          {warehouse.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      {/* Location */}
                      {(warehouse.address || warehouse.city) && (
                        <div className={cn(
                          "flex items-start gap-2 text-sm mb-3",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">
                            {[warehouse.address, warehouse.city, warehouse.state].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}

                      {/* Manager */}
                      {warehouse.managerName && (
                        <div className={cn(
                          "flex items-center gap-2 text-sm mb-3",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          <User className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{warehouse.managerName}</span>
                        </div>
                      )}

                      {/* Stats */}
                      <div className={cn(
                        "grid grid-cols-2 gap-3 pt-4 border-t",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className={cn(
                          "p-3 rounded-xl",
                          theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                        )}>
                          <p className="text-xs text-gray-500">Productos</p>
                          <p className={cn(
                            "text-lg font-bold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {warehouse.productsCount}
                          </p>
                        </div>
                        <div className={cn(
                          "p-3 rounded-xl",
                          theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                        )}>
                          <p className="text-xs text-gray-500">Stock Total</p>
                          <p className={cn(
                            "text-lg font-bold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {warehouse.totalStock.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-4">
                        <Link href={`/dashboard/market/warehouses/${warehouse.id}`} className="flex-1">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all",
                              theme === 'dark'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            )}
                          >
                            Ver Detalles
                            <ArrowRight className="w-4 h-4" />
                          </motion.button>
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
