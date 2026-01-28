'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Fingerprint,
  Plus,
  Edit,
  Trash2,
  Warehouse,
  Monitor,
  Wifi,
  WifiOff,
  ExternalLink,
  X,
  Copy,
  Check,
  RefreshCw,
  Search,
  MapPin
} from 'lucide-react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Kiosk {
  id: number
  name: string
  location: string | null
  deviceId: string
  warehouseId: number | null
  warehouseName: string | null
  warehouseAddress: string | null
  isActive: boolean
  lastPing: string | null
  settings: any
  createdAt: string
}

interface WarehouseOption {
  id: number
  name: string
  address: string | null
}

export default function KiosksPage() {
  const { theme } = useTheme()
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingKiosk, setEditingKiosk] = useState<Kiosk | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    warehouseId: ''
  })

  useEffect(() => {
    fetchKiosks()
    fetchWarehouses()
  }, [statusFilter])

  const fetchKiosks = async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const response = await fetch(`/api/market/hr/kiosks?status=${statusFilter}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setKiosks(result.data)
        }
      }
    } catch (error) {
      console.error('Error fetching kiosks:', error)
    } finally {
      if (!silent) setLoading(false)
      else setIsRefreshing(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/market/warehouses')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setWarehouses(result.data.map((w: any) => ({
            id: w.id,
            name: w.name,
            address: w.address
          })))
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingKiosk
        ? `/api/market/hr/kiosks/${editingKiosk.id}`
        : '/api/market/hr/kiosks'

      const response = await fetch(url, {
        method: editingKiosk ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          location: formData.location || null,
          warehouseId: formData.warehouseId ? parseInt(formData.warehouseId) : null
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setShowModal(false)
          setEditingKiosk(null)
          setFormData({ name: '', location: '', warehouseId: '' })
          fetchKiosks()
        }
      }
    } catch (error) {
      console.error('Error saving kiosk:', error)
    }
  }

  const handleEdit = (kiosk: Kiosk) => {
    setEditingKiosk(kiosk)
    setFormData({
      name: kiosk.name,
      location: kiosk.location || '',
      warehouseId: kiosk.warehouseId?.toString() || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de desactivar este kiosco?')) return

    try {
      const response = await fetch(`/api/market/hr/kiosks/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchKiosks()
      }
    } catch (error) {
      console.error('Error deleting kiosk:', error)
    }
  }

  const copyDeviceId = (deviceId: string) => {
    navigator.clipboard.writeText(deviceId)
    setCopied(deviceId)
    setTimeout(() => setCopied(null), 2000)
  }

  const isOnline = (lastPing: string | null) => {
    if (!lastPing) return false
    const pingTime = new Date(lastPing).getTime()
    const now = Date.now()
    return (now - pingTime) < 5 * 60 * 1000 // 5 minutes
  }

  // Filter kiosks by search
  const filteredKiosks = kiosks.filter(k =>
    k.name.toLowerCase().includes(search.toLowerCase()) ||
    k.location?.toLowerCase().includes(search.toLowerCase())
  )

  // Stats
  const stats = {
    total: kiosks.length,
    active: kiosks.filter(k => k.isActive).length,
    online: kiosks.filter(k => k.isActive && isOnline(k.lastPing)).length,
    withWarehouse: kiosks.filter(k => k.warehouseId).length
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
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Kioscos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'relative overflow-hidden',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                  'rounded-2xl border shadow-xl'
                )}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-600"></div>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-indigo-900/30 border border-indigo-800/50'
                          : 'bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200'
                      )}>
                        <Fingerprint className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Total Kioscos</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.total}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Registrados</span>
                  </div>
                </div>
              </motion.div>

              {/* Activos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
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
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-blue-900/30 border border-blue-800/50'
                          : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                      )}>
                        <Monitor className="w-6 h-6 text-blue-600" />
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
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Disponibles</span>
                  </div>
                </div>
              </motion.div>

              {/* En Línea */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
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
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-3 rounded-xl shadow-sm',
                        theme === 'dark'
                          ? 'bg-green-900/30 border border-green-800/50'
                          : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200'
                      )}>
                        <Wifi className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>En Línea</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.online}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Conectados ahora</span>
                  </div>
                </div>
              </motion.div>

              {/* Con Almacén */}
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
                        <Warehouse className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>Con Almacén</p>
                        <p className={cn(
                          'text-3xl font-bold mt-1',
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        )}>{stats.withWarehouse}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                    )}>Vinculados</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Info Banner */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className={cn(
                'p-4 rounded-xl border',
                theme === 'dark'
                  ? 'bg-indigo-900/20 border-indigo-800'
                  : 'bg-indigo-50 border-indigo-200'
              )}
            >
              <div className="flex items-start gap-3">
                <Monitor className="w-5 h-5 text-indigo-600 mt-0.5" />
                <div>
                  <h3 className={cn(
                    'font-medium',
                    theme === 'dark' ? 'text-indigo-300' : 'text-indigo-800'
                  )}>
                    ¿Cómo funciona?
                  </h3>
                  <p className={cn(
                    'text-sm mt-1',
                    theme === 'dark' ? 'text-indigo-400' : 'text-indigo-700'
                  )}>
                    Los kioscos permiten a los empleados registrar su entrada y salida usando PIN, badge o reconocimiento facial.
                    Configura un dispositivo (tablet/computadora) y accede a la URL del kiosco para comenzar.
                  </p>
                </div>
              </div>
            </motion.div>

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
                    placeholder="Buscar por nombre o ubicación..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={cn(
                      'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-indigo-500 focus:ring-indigo-500/20'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-indigo-500/20'
                    )}
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all min-w-[180px]',
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-indigo-500 focus:ring-indigo-500/20'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-indigo-500 focus:ring-indigo-500/20'
                  )}
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>

                {/* Refresh */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchKiosks(true)}
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

                {/* Nuevo Kiosco */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setEditingKiosk(null)
                    setFormData({ name: '', location: '', warehouseId: '' })
                    setShowModal(true)
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-lg shadow-indigo-500/25"
                >
                  <Plus className="w-5 h-5" />
                  Nuevo Kiosco
                </motion.button>
              </div>
            </motion.div>

            {/* Kiosks Table */}
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
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Kiosco</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Almacén</th>
                      <th className="text-left py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Device ID</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="text-center py-4 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan={6} className="py-4 px-4">
                            <div className="animate-pulse flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                              <div className="flex-1">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : filteredKiosks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <Fingerprint className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                          <p className={cn(
                            'font-medium mb-1',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>No hay kioscos</p>
                          <p className="text-gray-500 dark:text-gray-400">
                            Crea un kiosco para permitir el registro de asistencia
                          </p>
                          <button
                            onClick={() => {
                              setEditingKiosk(null)
                              setFormData({ name: '', location: '', warehouseId: '' })
                              setShowModal(true)
                            }}
                            className="mt-3 text-sm text-indigo-500 hover:text-indigo-600"
                          >
                            Crear primer kiosco
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredKiosks.map((kiosk, index) => (
                        <motion.tr
                          key={kiosk.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className={cn(
                            'group transition-colors',
                            !kiosk.isActive && 'opacity-60',
                            theme === 'dark' ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'
                          )}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-lg flex items-center justify-center',
                                kiosk.isActive && isOnline(kiosk.lastPing)
                                  ? theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                                  : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                              )}>
                                <Fingerprint className={cn(
                                  'w-5 h-5',
                                  kiosk.isActive && isOnline(kiosk.lastPing)
                                    ? 'text-green-600'
                                    : 'text-gray-400'
                                )} />
                              </div>
                              <div>
                                <p className={cn(
                                  'font-medium',
                                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                                )}>
                                  {kiosk.name}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {kiosk.isActive && isOnline(kiosk.lastPing) ? (
                                    <span className="flex items-center gap-1 text-xs text-green-600">
                                      <Wifi className="w-3 h-3" />
                                      En línea
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-xs text-gray-500">
                                      <WifiOff className="w-3 h-3" />
                                      Sin conexión
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {kiosk.location ? (
                              <span className={cn(
                                'inline-flex items-center gap-1 text-sm',
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                {kiosk.location}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            {kiosk.warehouseName ? (
                              <span className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700'
                              )}>
                                <Warehouse className="w-3 h-3" />
                                {kiosk.warehouseName}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <code className={cn(
                                'text-xs font-mono truncate max-w-[150px]',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              )}>
                                {kiosk.deviceId}
                              </code>
                              <button
                                onClick={() => copyDeviceId(kiosk.deviceId)}
                                className={cn(
                                  'p-1 rounded transition-colors',
                                  theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                                )}
                              >
                                {copied === kiosk.deviceId ? (
                                  <Check className="w-3.5 h-3.5 text-green-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {kiosk.isActive ? (
                              <span className={cn(
                                'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                              )}>
                                Activo
                              </span>
                            ) : (
                              <span className={cn(
                                'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium',
                                theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-700'
                              )}>
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {kiosk.isActive && (
                                <Link
                                  href={`/dashboard/market/hr/kiosks/${kiosk.id}`}
                                  target="_blank"
                                >
                                  <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                                    title="Abrir Kiosco"
                                  >
                                    <ExternalLink className="w-4 h-4 text-indigo-500" />
                                  </motion.button>
                                </Link>
                              )}
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleEdit(kiosk)}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4 text-gray-500" />
                              </motion.button>
                              {kiosk.isActive && (
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => handleDelete(kiosk.id)}
                                  className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                  title="Desactivar"
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

            {/* Modal */}
            <AnimatePresence>
              {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      'rounded-2xl shadow-2xl max-w-md w-full',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    )}
                  >
                    <div className={cn(
                      'p-6 border-b',
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <div className="flex items-center justify-between">
                        <h2 className={cn(
                          'text-xl font-bold',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {editingKiosk ? 'Editar Kiosco' : 'Nuevo Kiosco'}
                        </h2>
                        <button
                          onClick={() => setShowModal(false)}
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          )}
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                      <div>
                        <label className={cn(
                          'block text-sm font-medium mb-1',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Nombre *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className={cn(
                            'w-full px-4 py-2.5 border rounded-xl focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-900 border-gray-700 text-white focus:ring-indigo-500'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-indigo-500'
                          )}
                          placeholder="Ej: Kiosco Entrada Principal"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          'block text-sm font-medium mb-1',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Ubicación
                        </label>
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          className={cn(
                            'w-full px-4 py-2.5 border rounded-xl focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-900 border-gray-700 text-white focus:ring-indigo-500'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-indigo-500'
                          )}
                          placeholder="Ej: Recepción, Piso 1"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          'block text-sm font-medium mb-1',
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Almacén (opcional)
                        </label>
                        <select
                          value={formData.warehouseId}
                          onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                          className={cn(
                            'w-full px-4 py-2.5 border rounded-xl focus:ring-2',
                            theme === 'dark'
                              ? 'bg-gray-900 border-gray-700 text-white focus:ring-indigo-500'
                              : 'bg-white border-gray-200 text-gray-900 focus:ring-indigo-500'
                          )}
                        >
                          <option value="">Sin almacén asociado</option>
                          {warehouses.map(w => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={cn(
                        'flex gap-3 pt-4 border-t',
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <button
                          type="button"
                          onClick={() => setShowModal(false)}
                          className={cn(
                            'flex-1 px-4 py-2.5 border rounded-xl font-medium transition-colors',
                            theme === 'dark'
                              ? 'border-gray-700 hover:bg-gray-700'
                              : 'border-gray-200 hover:bg-gray-50'
                          )}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-indigo-700 transition-colors"
                        >
                          {editingKiosk ? 'Guardar' : 'Crear'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
