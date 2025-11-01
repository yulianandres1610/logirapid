'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Building,
  Plus,
  Search,
  RefreshCw,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Store,
  Package
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import ViewToggle from '@/components/ui/ViewToggle'
import WarehouseMap from '@/components/maps/WarehouseMap'

interface Warehouse {
  id: number
  name: string
  code: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  managerName?: string
  managerEmail?: string
  managerPhone?: string
  totalArea?: number
  usedArea?: number
  status: 'active' | 'inactive' | 'maintenance'
  types: string[]  // Multiple types support
  openingDate?: string
  operatingHours?: string
  capacity?: number
  currentStock?: number
  notes?: string
  createdAt: string
  updatedAt: string
  // Coordinates for mapping
  latitude?: number | null
  longitude?: number | null
}

export default function WarehousesPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalWarehouses, setTotalWarehouses] = useState(0)
  const WAREHOUSES_PER_PAGE = 10
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // View state - inicializar desde URL o por defecto 'table'
  const [activeView, setActiveView] = useState<'table' | 'map' | 'statistics'>(() => {
    const viewFromUrl = searchParams.get('view')
    return viewFromUrl === 'map' ? 'map' : viewFromUrl === 'statistics' ? 'statistics' : 'table'
  })
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>([])

  // Fetch warehouses
  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: WAREHOUSES_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter && typeFilter !== 'all' && { type: typeFilter })
      })

      const response = await fetch(`/api/warehouses?${params}`)
      if (response.ok) {
        const data = await response.json()
        // Convert type string to array for each warehouse
        const processedWarehouses = (data.data || []).map((warehouse: any) => ({
          ...warehouse,
          types: warehouse.type ? warehouse.type.split(',').map((t: string) => t.trim()) : []
        }))
        setWarehouses(processedWarehouses)
        setTotalWarehouses(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los almacenes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [searchTerm, statusFilter, typeFilter])

  useEffect(() => {
    fetchData()
  }, [currentPage, searchTerm, statusFilter, typeFilter])

  // Fetch all warehouses for map view on component mount
  useEffect(() => {
    fetchAllWarehouses()
  }, [])

  // Actualizar URL cuando cambia la vista
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (activeView === 'map') {
      params.set('view', 'map')
    } else {
      params.delete('view')
    }

    const newUrl = `/dashboard/admin/warehouses${params.toString() ? '?' + params.toString() : ''}`
    router.push(newUrl, { scroll: false })
  }, [activeView, searchParams, router])

  // Calculate statistics
  const stats = {
    total: warehouses.length,
    active: warehouses.filter(warehouse => warehouse.status === 'active').length,
    distribution: warehouses.filter(warehouse => warehouse.types.includes('distribution')).length,
    storage: warehouses.filter(warehouse => warehouse.types.includes('storage')).length,
    fulfillment: warehouses.filter(warehouse => warehouse.types.includes('fulfillment')).length,
    crossDocking: warehouses.filter(warehouse => warehouse.types.includes('cross_docking')).length,
    totalCapacity: warehouses.reduce((sum, w) => sum + (w.capacity || 0), 0),
    usedCapacity: warehouses.reduce((sum, w) => sum + (w.currentStock || 0), 0)
  }

  // Fetch all warehouses for map view
  const fetchAllWarehouses = async () => {
    try {
      const response = await fetch('/api/warehouses?limit=1000')
      if (response.ok) {
        const data = await response.json()
        // Convert type string to array for each warehouse
        const processedWarehouses = (data.data || []).map((warehouse: any) => ({
          ...warehouse,
          types: warehouse.type ? warehouse.type.split(',').map((t: string) => t.trim()) : []
        }))
        setAllWarehouses(processedWarehouses)
      }
    } catch (error) {
      console.error('Error fetching all warehouses:', error)
    }
  }

  // Handle warehouse click from map
  const handleWarehouseClick = (warehouse: Warehouse) => {
    setActiveView('table')
    showNotification('info', 'Almacen Seleccionado', `Almacen ${warehouse.name} seleccionado desde el mapa`)
  }

  const STATUSES = {
    active: { label: 'Activo', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
    inactive: { label: 'Inactivo', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: XCircle },
    maintenance: { label: 'Mantenimiento', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle }
  }

  const TYPES = {
    distribution: { label: 'Distribucion', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Store },
    storage: { label: 'Almacenaje', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Package },
    cross_docking: { label: 'Cross-Docking', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: RefreshCw },
    fulfillment: { label: 'Fulfillment', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Package }
  }

  // Handle view warehouse details
  const handleViewWarehouse = (warehouseId: number) => {
    window.location.href = `/dashboard/admin/warehouses/${warehouseId}`
  }

  // Handle edit warehouse
  const handleEditWarehouse = (warehouseId: number) => {
    window.location.href = `/dashboard/admin/warehouses/${warehouseId}/edit`
  }

  // Handle delete warehouse
  const handleDeleteWarehouse = async (warehouseId: number) => {
    const warehouse = warehouses.find(w => w.id === warehouseId)
    if (!warehouse) return

    if (!confirm(`¿Estas seguro de que deseas eliminar el almacen "${warehouse.name}"? Esta accion no se puede deshacer.`)) {
      return
    }

    try {
      const response = await fetch(`/api/warehouses/${warehouseId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        showNotification('success', 'Almacen Eliminado', 'El almacen ha sido eliminado exitosamente')
        fetchData()
      } else {
        const data = await response.json()
        showNotification('error', 'Error al eliminar', data.error || 'No se pudo eliminar el almacen')
      }
    } catch (error) {
      console.error('Error deleting warehouse:', error)
      showNotification('error', 'Error de conexion', 'No se pudo conectar con el servidor. Intenta de nuevo.')
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          {/* Conditional Rendering based on active view */}
          {activeView === 'table' && (
            <div>
              {/* Panel de Almacenes - Stats Cards */}
              <div
                className="grid grid-cols-1 md:grid-cols-4 gap-5"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Total de Almacenes */}
                <div
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
                          <Building className="w-6 h-6 text-blue-600" />
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
                        )}>En sistema</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Almacenes Activos */}
                <div
                  className={cn(
                    'relative overflow-hidden',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                    'rounded-2xl border shadow-xl'
                  )}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-3 rounded-xl shadow-sm',
                          theme === 'dark'
                            ? 'bg-green-900/30 border border-green-800/50'
                            : 'bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200'
                        )}>
                          <CheckCircle className="w-6 h-6 text-green-600" />
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
                      <div className="w-full bg-green-100 dark:bg-green-900/30 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${stats.total > 0 ? (stats.active / stats.total * 100) : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Capacidad Total */}
                <div
                  className={cn(
                    'relative overflow-hidden',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                    'rounded-2xl border shadow-xl'
                  )}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-violet-600"></div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-3 rounded-xl shadow-sm',
                          theme === 'dark'
                            ? 'bg-purple-900/30 border border-purple-800/50'
                            : 'bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200'
                        )}>
                          <Package className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <p className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-gray-400' : 'text-black'
                          )}>Capacidad Total</p>
                          <p className={cn(
                            'text-3xl font-bold mt-1',
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          )}>{stats.totalCapacity.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          'text-xs font-medium',
                          theme === 'dark' ? 'text-gray-500' : 'text-black'
                        )}>Utilizada</span>
                        <span className={cn(
                          'text-xs font-bold',
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                        )}>{stats.usedCapacity.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-purple-100 dark:bg-purple-900/30 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-400 to-violet-500 h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${stats.totalCapacity > 0 ? (stats.usedCapacity / stats.totalCapacity * 100) : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tipos de Almacen */}
                <div
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
                          <Store className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <p className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-gray-400' : 'text-black'
                          )}>Distribucion</p>
                          <p className={cn(
                            'text-3xl font-bold mt-1',
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          )}>{stats.distribution}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                      <span className={cn(
                        'text-xs font-medium',
                        theme === 'dark' ? 'text-gray-500' : 'text-black'
                      )}>
                        Centros de distribucion
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col lg:flex-row gap-6 items-center justify-between py-6 px-4 mt-8 mb-6 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, codigo o direccion..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn(
                      'w-full h-12 pl-10 pr-4 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 text-sm'
                        : 'bg-white border-gray-300 text-black placeholder-gray-500 text-sm'
                    )}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className={cn(
                      'h-12 px-4 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white text-sm'
                        : 'bg-white border-gray-300 text-black text-sm'
                    )}
                  >
                    <option value="all">Todos los tipos</option>
                    {Object.entries(TYPES).map(([key, type]) => (
                      <option key={key} value={key}>{type.label}</option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={cn(
                      'w-full sm:w-auto h-12 px-4 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white text-sm'
                        : 'bg-white border-gray-300 text-black text-sm'
                    )}
                  >
                    <option value="all">Todos los estados</option>
                    {Object.entries(STATUSES).map(([key, status]) => (
                      <option key={key} value={key}>{status.label}</option>
                    ))}
                  </select>

                  {/* View Toggle Buttons */}
                  <ViewToggle
                    activeView={activeView}
                    onViewChange={setActiveView}
                    counts={{
                      table: warehouses.length,
                      map: allWarehouses.length,
                      statistics: allWarehouses.length
                    }}
                    theme={theme}
                    compact={true}
                  />

                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button
                      onClick={fetchData}
                      className={cn(
                        'flex-1 sm:flex-none items-center justify-center gap-2 h-12',
                        'bg-blue-600 hover:bg-blue-700 text-black dark:text-white font-medium',
                        'rounded-lg transition-all duration-200',
                        'shadow-sm hover:shadow-md',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                        'dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white'
                      )}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Actualizar
                    </Button>

                    <button
                      onClick={() => window.location.href = '/dashboard/admin/warehouses/create'}
                      className={cn(
                        'flex-1 sm:flex-none justify-center whitespace-nowrap',
                        'rounded-lg text-sm font-medium transition-all duration-200',
                        'h-12 bg-green-600 hover:bg-green-700 text-white',
                        'shadow-sm hover:shadow-md',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/20',
                        'flex items-center gap-2 px-6'
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo Almacen
                    </button>
                  </div>
                </div>
              </div>

              {/* Warehouses Table */}
              <div className={cn(
                'rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden',
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}>
                {loading ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
                    <p className="mt-2 text-black dark:text-gray-400">Cargando almacenes...</p>
                  </div>
                ) : warehouses.length === 0 ? (
                  <div className="p-8 text-center">
                    <Building className="w-12 h-12 mx-auto text-gray-400" />
                    <p className="mt-2 text-black dark:text-gray-400">
                      {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                        ? 'No se encontraron almacenes con los filtros aplicados'
                        : 'No hay almacenes registrados'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={cn(
                        'border-b border-gray-200 dark:border-gray-700',
                        theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                      )}>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                            Almacen
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                            Ubicacion
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                            Tipo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                            Estado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                            Capacidad
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                            Responsable
                          </th>
                          <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {warehouses.map((warehouse) => (
                          <tr
                            key={warehouse.id}
                            className={cn(
                              'hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
                            )}
                          >
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-base font-bold text-black dark:text-gray-100 mb-1">
                                {warehouse.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Codigo: {warehouse.code}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-black dark:text-gray-400">
                                <div className="font-medium text-black dark:text-gray-100">
                                  {warehouse.city}, {warehouse.state}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {warehouse.address}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex flex-wrap gap-1">
                                {warehouse.types.map((type) => {
                                  const typeConfig = TYPES[type as keyof typeof TYPES]
                                  if (!typeConfig) return null
                                  const TypeIcon = typeConfig.icon
                                  return (
                                    <span
                                      key={type}
                                      className={cn(
                                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                        typeConfig.color
                                      )}
                                    >
                                      <TypeIcon className="w-3 h-3 mr-1" />
                                      {typeConfig.label}
                                    </span>
                                  )
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className={cn(
                                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                                STATUSES[warehouse.status].color
                              )}>
                                {(() => {
                                  const StatusIcon = STATUSES[warehouse.status].icon
                                  return <StatusIcon className="w-3 h-3 mr-1" />
                                })()}
                                {STATUSES[warehouse.status].label}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm">
                                <div className="font-medium text-black dark:text-gray-100">
                                  {warehouse.currentStock || 0} / {warehouse.capacity || 0}
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-1">
                                  <div
                                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${(warehouse.capacity || 0) > 0 ? ((warehouse.currentStock || 0) / (warehouse.capacity || 1) * 100) : 0}%`
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm">
                                <div className="font-medium text-black dark:text-gray-100">
                                  {warehouse.managerName || 'Sin asignar'}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {warehouse.managerEmail || 'Sin email'}
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-4 whitespace-nowrap">
                              <div className="flex gap-1 justify-end">
                                {/* View Details Button */}
                                <button
                                  onClick={() => handleViewWarehouse(warehouse.id)}
                                  className={cn(
                                    'relative p-2 rounded-lg transition-all duration-200',
                                    theme === 'dark'
                                      ? 'text-blue-400 hover:bg-blue-900/30'
                                      : 'text-blue-600 hover:bg-blue-50'
                                  )}
                                  title="Ver detalles"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                {/* Edit Button */}
                                <button
                                  onClick={() => handleEditWarehouse(warehouse.id)}
                                  className={cn(
                                    'relative p-2 rounded-lg transition-all duration-200',
                                    theme === 'dark'
                                      ? 'text-gray-400 hover:bg-gray-700/50'
                                      : 'text-gray-600 hover:bg-gray-100'
                                  )}
                                  title="Editar almacen"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleDeleteWarehouse(warehouse.id)
                                  }}
                                  className={cn(
                                    'relative p-2 rounded-lg transition-all duration-200',
                                    theme === 'dark'
                                      ? 'text-red-400 hover:bg-red-900/30'
                                      : 'text-red-600 hover:bg-red-50'
                                  )}
                                  title="Eliminar almacen"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {totalWarehouses > WAREHOUSES_PER_PAGE && (
                  <div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'mt-6 p-4 rounded-xl border',
                      theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-black dark:text-gray-400">
                        Mostrando {((currentPage - 1) * WAREHOUSES_PER_PAGE) + 1} a{' '}
                        {Math.min(currentPage * WAREHOUSES_PER_PAGE, totalWarehouses)} de {totalWarehouses} almacenes
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="flex items-center gap-1"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Anterior
                        </Button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, Math.ceil(totalWarehouses / WAREHOUSES_PER_PAGE)) }, (_, i) => {
                            const totalPages = Math.ceil(totalWarehouses / WAREHOUSES_PER_PAGE)
                            let pageNum

                            if (totalPages <= 5) {
                              pageNum = i + 1
                            } else if (currentPage <= 3) {
                              pageNum = i + 1
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i
                            } else {
                              pageNum = currentPage - 2 + i
                            }

                            return (
                              <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(pageNum)}
                                className={cn(
                                  'w-8 h-8 p-0',
                                  currentPage === pageNum && theme === 'dark'
                                    ? 'bg-blue-600 hover:bg-blue-700'
                                    : currentPage === pageNum
                                    ? 'bg-blue-600 hover:bg-blue-700'
                                    : ''
                                )}
                              >
                                {pageNum}
                              </Button>
                            )
                          })}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage >= Math.ceil(totalWarehouses / WAREHOUSES_PER_PAGE)}
                          className="flex items-center gap-1"
                        >
                          Siguiente
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Vista de Mapa */}
          {activeView === 'map' && (
            <div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Filters para Mapa */}
              <div className="flex flex-col lg:flex-row gap-6 items-center justify-between py-6 px-4 mt-8 mb-6 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, codigo o direccion..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn(
                      'w-full h-12 pl-10 pr-4 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 text-sm'
                        : 'bg-white border-gray-300 text-black placeholder-gray-500 text-sm'
                    )}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className={cn(
                      'h-12 px-4 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white text-sm'
                        : 'bg-white border-gray-300 text-black text-sm'
                    )}
                  >
                    <option value="all">Todos los tipos</option>
                    {Object.entries(TYPES).map(([key, type]) => (
                      <option key={key} value={key}>{type.label}</option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={cn(
                      'w-full sm:w-auto h-12 px-4 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white text-sm'
                        : 'bg-white border-gray-300 text-black text-sm'
                    )}
                  >
                    <option value="all">Todos los estados</option>
                    {Object.entries(STATUSES).map(([key, status]) => (
                      <option key={key} value={key}>{status.label}</option>
                    ))}
                  </select>

                  {/* View Toggle Buttons */}
                  <ViewToggle
                    activeView={activeView}
                    onViewChange={setActiveView}
                    counts={{
                      table: warehouses.length,
                      map: allWarehouses.length,
                      statistics: allWarehouses.length
                    }}
                    theme={theme}
                    compact={true}
                  />

                  <Button
                    onClick={fetchData}
                    className={cn(
                      'flex-1 sm:flex-none items-center justify-center gap-2 h-12',
                      'bg-blue-600 hover:bg-blue-700 text-black dark:text-white font-medium',
                      'rounded-lg transition-all duration-200',
                      'shadow-sm hover:shadow-md',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                      'dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white'
                    )}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Actualizar
                  </Button>

                  <button
                    onClick={() => window.location.href = '/dashboard/admin/warehouses/create'}
                    className={cn(
                      'flex-1 sm:flex-none justify-center whitespace-nowrap',
                      'items-center gap-2 h-12 px-4',
                      'bg-green-600 hover:bg-green-700 text-white font-medium',
                      'rounded-lg transition-all duration-200',
                      'shadow-sm hover:shadow-md',
                      'focus:outline-none focus:ring-2 focus:ring-green-500/20',
                      'dark:bg-green-700 dark:hover:bg-green-800 dark:text-white'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo Almacen
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <WarehouseMap
                  warehouses={warehouses}
                  theme={theme}
                  onWarehouseClick={handleWarehouseClick}
                />
              </div>
            </div>
          )}

          {/* Statistics View */}
          {activeView === 'statistics' && (
            <div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-12">
                <div className="text-center space-y-6">
                  {/* Icon */}
                  <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <BarChart3 className="w-12 h-12 text-black dark:text-white" />
                  </div>

                  {/* Title */}
                  <h2 className="text-3xl font-bold text-black dark:text-white">
                    Estadisticas de Almacenes
                  </h2>

                  {/* Message */}
                  <div className="space-y-4">
                    <p className="text-xl text-gray-600 dark:text-gray-300">
                      Estamos trabajando en Desarrollar una Solucion Practica
                    </p>
                    <p className="text-lg text-gray-500 dark:text-gray-400">
                      Proximamente podras ver aqui analisis detallados, graficos interactivos y metricas importantes sobre tus almacenes.
                    </p>
                  </div>

                  {/* Stats Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {allWarehouses.length}
                      </div>
                      <div className="text-sm text-black dark:text-gray-300 mt-1">
                        Total de Almacenes
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {allWarehouses.filter(w => w.status === 'active').length}
                      </div>
                      <div className="text-sm text-black dark:text-gray-300 mt-1">
                        Almacenes Activos
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {stats.usedCapacity.toLocaleString()}
                      </div>
                      <div className="text-sm text-black dark:text-gray-300 mt-1">
                        Capacidad Utilizada
                      </div>
                    </div>
                  </div>

                  {/* Progress indicator */}
                  <div className="mt-8">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse delay-150"></div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                      En desarrollo...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  )
}