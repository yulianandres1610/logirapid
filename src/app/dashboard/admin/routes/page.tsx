'use client'

import { useState, useEffect, useMemo } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Route,
  Plus,
  Search,
  RefreshCw,
  Archive,
  Truck,
  Calendar,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  BarChart3,
  MapPin,
  Package,
  Users,
  Navigation
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import ViewToggle from '@/components/ui/ViewToggle'
import Spinner from '@/components/ui/Spinner'

interface Route {
  id: number
  routeNumber: string
  name: string
  driverId?: number
  driverName?: string
  vehicleId?: number
  vehiclePlate?: string
  status: 'planning' | 'active' | 'completed' | 'cancelled'
  totalPackages: number
  deliveredPackages: number
  estimatedDuration?: string
  actualDuration?: string
  distance?: number
  startTime?: string
  endTime?: string
  date: string
  notes?: string
  createdAt: string
  updatedAt: string
  // Coordinates para el mapa
  waypoints?: Array<{
    id: number
    address: string
    latitude: number
    longitude: number
    customerName: string
    status: 'pending' | 'delivered' | 'failed'
  }>
}

// Force dynamic rendering to avoid static generation issues with useSearchParams
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'
export const fetchCache = 'force-no-store'



export default function RoutesPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Determinar el base path según el rol del usuario
  const getBasePath = () => {
    if (user?.role === 'SUPER_ADMIN') return '/dashboard/admin'
    if (user?.role === 'ADMIN') return '/dashboard/agency-admin'
    if (user?.role === 'MANAGER') return '/dashboard/manager'
    return '/dashboard/user'
  }
  const basePath = getBasePath()

  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRoutes, setTotalRoutes] = useState(0)
  const ROUTES_PER_PAGE = 25
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dayFilter, setDayFilter] = useState<string>('all')
  const [driverFilter, setDriverFilter] = useState<string>('all')

  // View state - inicializar desde URL o por defecto 'table'
  const [activeView, setActiveView] = useState<'table' | 'map' | 'statistics'>(() => {
    const viewFromUrl = searchParams.get('view')
    return viewFromUrl === 'map' ? 'map' : viewFromUrl === 'statistics' ? 'statistics' : 'table'
  })
  const [allRoutes, setAllRoutes] = useState<Route[]>([])

  // Calculate stats from routes data
  const stats = useMemo(() => {
    const active = routes.filter(route => route.status === 'active').length
    const completed = routes.filter(route => route.status === 'completed').length
    const planning = routes.filter(route => route.status === 'planning').length

    return {
      active,
      delivered: completed,
      pending: planning
    }
  }, [routes])

  // Fetch routes
  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ROUTES_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
        ...(dayFilter && dayFilter !== 'all' && { dayFilter: dayFilter }),
        ...(driverFilter && driverFilter !== 'all' && { driver: driverFilter })
      })

      const response = await fetch(`/api/routes?${params}`)
      if (response.ok) {
        const data = await response.json()
        setRoutes(data.routes || [])
        setTotalRoutes(data.total || 0)
      } else {
        console.error('Error fetching routes')
        showNotification('error', 'Error', 'No se pudieron cargar las rutas')
      }
    } catch (error) {
      console.error('Error fetching routes:', error)
      showNotification('error', 'Error', 'No se pudieron cargar las rutas')
    } finally {
      setLoading(false)
    }
  }

  // Fetch all routes for map view
  const fetchAllRoutes = async () => {
    try {
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
        ...(dayFilter && dayFilter !== 'all' && { dayFilter: dayFilter }),
        ...(driverFilter && driverFilter !== 'all' && { driver: driverFilter })
      })

      const response = await fetch(`/api/routes?${params}&limit=1000`)
      if (response.ok) {
        const data = await response.json()
        setAllRoutes(data.routes || [])
      }
    } catch (error) {
      console.error('Error fetching all routes:', error)
    }
  }

  // Cargar datos iniciales
  useEffect(() => {
    fetchData()
  }, [currentPage, searchTerm, statusFilter, dayFilter, driverFilter])

  // Cargar todas las rutas para vista de mapa
  useEffect(() => {
    if (activeView === 'map') {
      fetchAllRoutes()
    }
  }, [activeView, searchTerm, statusFilter, dayFilter, driverFilter])

  // Actualizar URL cuando cambia la vista
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams)
    if (activeView === 'table') {
      newParams.delete('view')
    } else {
      newParams.set('view', activeView)
    }
    const newPath = `${window.location.pathname}?${newParams.toString()}`
    window.history.replaceState({}, '', newPath)
  }, [activeView])

  // Manejadores de eventos
  const handleRefresh = () => {
    fetchData()
  }

  const handleViewChange = (view: 'table' | 'map' | 'statistics') => {
    setActiveView(view)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return theme === 'dark' ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200'
      case 'active':
        return theme === 'dark' ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-green-50 text-green-700 border-green-200'
      case 'completed':
        return theme === 'dark' ? 'bg-purple-900/30 text-purple-400 border-purple-800' : 'bg-purple-50 text-purple-700 border-purple-200'
      case 'cancelled':
        return theme === 'dark' ? 'bg-red-900/30 text-red-400 border-red-800' : 'bg-red-50 text-red-700 border-red-200'
      default:
        return theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'planning':
        return <Clock className="w-4 h-4" />
      case 'active':
        return <Navigation className="w-4 h-4" />
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      case 'cancelled':
        return <XCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planning':
        return 'Planificación'
      case 'active':
        return 'Activa'
      case 'completed':
        return 'Completada'
      case 'cancelled':
        return 'Cancelada'
      default:
        return status
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    if (!timeString) return 'N/A'
    return new Date(timeString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalPages = Math.ceil(totalRoutes / ROUTES_PER_PAGE)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className={cn(
              "text-2xl font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Gestión de Rutas
            </h1>
            <p className={cn(
              "text-sm",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Administra y monitorea las rutas de entrega
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Rutas Activas */}
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
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-600"></div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl shadow-sm',
                    theme === 'dark'
                      ? 'bg-red-900/30 border border-red-800/50'
                      : 'bg-gradient-to-br from-red-50 to-red-100 border border-red-200'
                  )}>
                    <Truck className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>Rutas Activas</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>{stats.active}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <span className={cn(
                    'text-xs font-medium',
                    theme === 'dark' ? 'text-gray-500' : 'text-black'
                  )}>En ruta</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Entregadas Hoy */}
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
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>Entregadas Hoy</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>{stats.delivered}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className={cn(
                    'text-xs font-medium',
                    theme === 'dark' ? 'text-gray-500' : 'text-black'
                  )}>Completadas</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Pendientes */}
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
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>Pendientes</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>{stats.pending}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                  <span className={cn(
                    'text-xs font-medium',
                    theme === 'dark' ? 'text-gray-500' : 'text-black'
                  )}>Esperando</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Eficiencia */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              'relative overflow-hidden rounded-2xl border shadow-xl',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-indigo-600"></div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-gray-400' : 'text-slate-600'
                  )}>
                    Eficiencia
                  </p>
                  <p className={cn(
                    'text-2xl font-bold mt-1',
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  )}>
                    {totalRoutes > 0 ? Math.round((stats.active / totalRoutes) * 100) : 0}%
                  </p>
                </div>
                <div className={cn(
                  'relative overflow-hidden rounded-2xl p-3 shadow-lg border',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-purple-600/20 to-indigo-600/20 border-purple-500/30'
                    : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'
                )}>
                  <div className={cn(
                    'absolute top-0 right-0 w-16 h-16 rounded-full opacity-20 -mr-8 -mt-8',
                    theme === 'dark' ? 'bg-purple-400' : 'bg-purple-600'
                  )}></div>
                  <BarChart3 className={cn(
                    'relative w-6 h-6',
                    theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                  )} />
                </div>
              </div>
              <div className={cn(
                'text-xs mt-4',
                theme === 'dark' ? 'text-gray-500' : 'text-slate-500'
              )}>
                Rutas activas vs total
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters and View Toggle */}
        <div className={cn(
          "rounded-xl p-4 border",
          theme === 'dark' ? "bg-gray-800/80 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Filtros principales - lado izquierdo */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )} />
                <input
                  type="text"
                  placeholder="Buscar rutas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "pl-10 pr-4 py-2.5 h-10 rounded-lg border w-64 transition-colors",
                    theme === 'dark'
                      ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                  )}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={cn(
                  "px-3 py-2.5 h-10 rounded-lg border w-40 transition-colors",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                )}
              >
                <option value="all">Todos los estados</option>
                <option value="planning">Planificación</option>
                <option value="active">Activa</option>
                <option value="completed">Completada</option>
                <option value="cancelled">Cancelada</option>
              </select>
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className={cn(
                  "px-3 py-2.5 h-10 rounded-lg border w-40 transition-colors",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                )}
              >
                <option value="all">Todos los días</option>
                <option value="today">Hoy</option>
                <option value="tomorrow">Mañana</option>
                <option value="week">Esta semana</option>
              </select>
              <select
                value={driverFilter}
                onChange={(e) => setDriverFilter(e.target.value)}
                className={cn(
                  "px-3 py-2.5 h-10 rounded-lg border w-40 transition-colors",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                )}
              >
                <option value="all">Todos los conductores</option>
                <option value="1">Juan Pérez</option>
                <option value="2">María García</option>
                <option value="3">Carlos Rodríguez</option>
              </select>
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={loading}
                className={cn(
                  "px-3 py-2.5 h-10 border transition-colors",
                  theme === 'dark'
                    ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
            </div>

            {/* Acciones - lado derecho */}
            <div className="flex items-center gap-3">
              <ViewToggle
                activeView={activeView}
                onViewChange={handleViewChange}
                counts={{
                  table: routes.length,
                  map: allRoutes.length,
                  statistics: allRoutes.length
                }}
                theme={theme}
                compact={true}
              />
              <Button
                onClick={() => router.push(`${basePath}/routes/create`)}
                className="shadow-lg transform transition-all hover:scale-105 text-white px-4 py-2.5 h-10"
                style={{
                  background: 'var(--brand-blue)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--brand-blue-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--brand-blue)'
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Ruta
              </Button>
            </div>
          </div>
        </div>

        {/* Content based on active view */}
        {activeView === 'table' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "rounded-xl border overflow-hidden",
              theme === 'dark' ? "bg-gray-800/80 border-gray-700" : "bg-white border-gray-200"
            )}
          >
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={cn(
                  "border-b",
                  theme === 'dark' ? "border-gray-700 bg-gray-900/50" : "border-gray-200 bg-gray-50"
                )}>
                  <tr>
                    <th className={cn(
                      "text-left px-6 py-3 text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Ruta
                    </th>
                    <th className={cn(
                      "text-left px-6 py-3 text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Conductor
                    </th>
                    <th className={cn(
                      "text-left px-6 py-3 text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Vehículo
                    </th>
                    <th className={cn(
                      "text-left px-6 py-3 text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Paquetes
                    </th>
                    <th className={cn(
                      "text-left px-6 py-3 text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Estado
                    </th>
                    <th className={cn(
                      "text-left px-6 py-3 text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Fecha
                    </th>
                    <th className={cn(
                      "text-left px-6 py-3 text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Hora
                    </th>
                    <th className={cn(
                      "text-left px-6 py-3 text-xs font-medium uppercase tracking-wider",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className={cn(
                  "divide-y",
                  theme === 'dark' ? "divide-gray-700" : "divide-gray-200"
                )}>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12">
                        <Spinner size="lg" text="Cargando rutas..." />
                      </td>
                    </tr>
                  ) : routes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <div className="text-center">
                          <Route className={cn(
                            "w-12 h-12 mx-auto mb-4 opacity-50",
                            theme === 'dark' ? "text-gray-600" : "text-gray-400"
                          )} />
                          <p className={cn(
                            "text-lg font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            No se encontraron rutas
                          </p>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-500" : "text-gray-500"
                          )}>
                            Intenta ajustar los filtros o crea una nueva ruta
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    routes.map((route, index) => (
                      <motion.tr
                        key={route.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className={cn(
                          "transition-colors hover:bg-gray-50",
                          theme === 'dark' ? "hover:bg-gray-700/50" : ""
                        )}
                      >
                        <td className="px-6 py-4">
                          <div>
                            <div className={cn(
                              "font-medium",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {route.routeNumber}
                            </div>
                            <div className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-500"
                            )}>
                              {route.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            {route.driverName || 'Sin asignar'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            {route.vehiclePlate || 'Sin asignar'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            {route.deliveredPackages}/{route.totalPackages}
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className="bg-green-600 h-1.5 rounded-full"
                              style={{
                                width: `${route.totalPackages > 0 ? (route.deliveredPackages / route.totalPackages) * 100 : 0}%`
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                            getStatusColor(route.status)
                          )}>
                            {getStatusIcon(route.status)}
                            <span className="ml-1">{getStatusText(route.status)}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            {formatDate(route.date)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            {route.startTime ? formatTime(route.startTime) : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => router.push(`${basePath}/routes/${route.id}`)}
                              className={cn(
                                "p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                                theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )}
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => router.push(`${basePath}/routes/${route.id}/edit`)}
                              className={cn(
                                "p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                                theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )}
                              title="Editar ruta"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={cn(
                "flex items-center justify-between px-6 py-4 border-t",
                theme === 'dark' ? "border-gray-700 bg-gray-900/50" : "border-gray-200 bg-gray-50"
              )}>
                <div className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-700"
                )}>
                  Mostrando {((currentPage - 1) * ROUTES_PER_PAGE) + 1} a{' '}
                  {Math.min(currentPage * ROUTES_PER_PAGE, totalRoutes)} de {totalRoutes} rutas
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "border transition-colors",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          currentPage === page
                            ? "text-white"
                            : cn(
                                "border transition-colors",
                                theme === 'dark'
                                  ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
                              )
                        )}
                        style={
                          currentPage === page
                            ? { background: 'var(--brand-blue)' }
                            : {}
                        }
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "border transition-colors",
                      theme === 'dark'
                        ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                        : "border-gray-300 text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    Siguiente
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeView === 'map' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "rounded-xl border overflow-hidden h-[600px]",
              theme === 'dark' ? "bg-gray-800/80 border-gray-700" : "bg-white border-gray-200"
            )}
          >
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <MapPin className={cn(
                  "w-16 h-16 mx-auto mb-4 opacity-50",
                  theme === 'dark' ? "text-gray-600" : "text-gray-400"
                )} />
                <h3 className={cn(
                  "text-lg font-medium mb-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Vista de Mapa
                </h3>
                <p className={cn(
                  "text-sm mb-4",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Visualización de rutas en mapa interactivo
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? "text-gray-500" : "text-gray-500"
                )}>
                  Próximamente disponible
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'statistics' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "rounded-xl border p-6",
              theme === 'dark' ? "bg-gray-800/80 border-gray-700" : "bg-white border-gray-200"
            )}
          >
            <div className="h-96 flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className={cn(
                  "w-16 h-16 mx-auto mb-4 opacity-50",
                  theme === 'dark' ? "text-gray-600" : "text-gray-400"
                )} />
                <h3 className={cn(
                  "text-lg font-medium mb-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Estadísticas de Rutas
                </h3>
                <p className={cn(
                  "text-sm mb-4",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Análisis y métricas de rendimiento
                </p>
                <p className={cn(
                  "text-xs",
                  theme === 'dark' ? "text-gray-500" : "text-gray-500"
                )}>
                  Próximamente disponible
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  )
}