'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  Truck,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Package,
  ListOrdered,
  Route,
  Navigation,
  Eye,
  Calendar,
  Fuel,
  DollarSign,
  Settings,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import RouteMap from '@/components/maps/RouteMap'

interface RouteData {
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
  waypoints?: Array<{
    id: number
    address: string
    latitude: number
    longitude: number
    customerName: string
    status: 'pending' | 'delivered' | 'failed'
  }>
  mechanism: 'automatic' | 'manual'
  timeWindows: string[]
  warehouseId: string
  optimizedRoute?: any
}

export default function RouteDetailPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const params = useParams()
  const routeId = params.id as string

  const [route, setRoute] = useState<RouteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMap, setShowMap] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'stops' | 'map'>('overview')

  useEffect(() => {
    fetchRouteDetails()
  }, [routeId])

  const fetchRouteDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/routes/${routeId}`)

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setRoute(data.data)
        } else {
          showNotification('Error', data.error || 'No se pudo cargar la ruta', 'error')
        }
      } else {
        showNotification('Error', 'No se pudo cargar la ruta', 'error')
      }
    } catch (error) {
      console.error('Error fetching route details:', error)
      showNotification('Error de conexión', 'No se pudo cargar la ruta', 'error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
      case 'active': return 'text-green-600 bg-green-50 dark:bg-green-900/20'
      case 'completed': return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20'
      case 'cancelled': return 'text-red-600 bg-red-50 dark:bg-red-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planning': return 'Planificación'
      case 'active': return 'Activa'
      case 'completed': return 'Completada'
      case 'cancelled': return 'Cancelada'
      default: return status
    }
  }

  const formatTimeWindows = (timeWindows: string[]) => {
    return timeWindows.map(window => {
      switch (window) {
        case '8-12': return '8:00 AM - 12:00 PM'
        case '12-16': return '12:00 PM - 4:00 PM'
        case '16-20': return '4:00 PM - 8:00 PM'
        default: return window
      }
    }).join(', ')
  }

  const calculateProgress = () => {
    if (!route) return 0
    return route.totalPackages > 0 ? (route.deliveredPackages / route.totalPackages) * 100 : 0
  }

  const prepareOptimizationResult = () => {
    if (!route) return null

    return {
      totalOrders: route.totalPackages,
      pickups: route.waypoints?.filter(w => w.status === 'pending').length || 0,
      deliveries: route.deliveredPackages,
      totalDistance: route.distance || 0,
      estimatedDuration: route.estimatedDuration || 'Pendiente',
      optimizedStops: route.waypoints?.length || 0,
      route: {
        start: 'Almacén',
        stops: route.waypoints?.map((waypoint, index) => ({
          id: waypoint.id,
          customer: waypoint.customerName,
          address: waypoint.address,
          type: 'delivery' as const,
          coordinates: [waypoint.longitude, waypoint.latitude] as [number, number],
          orderNumber: `ORD-${waypoint.id}`,
          optimizedIndex: index,
          waypointIndex: index
        })) || [],
        end: 'Almacén'
      }
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Cargando detalles de la ruta...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!route) {
    return (
      <DashboardLayout>
        <div className="min-h-screen p-6 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Ruta no encontrada
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              No se pudo encontrar la ruta solicitada
            </p>
            <Button onClick={() => router.push('/dashboard/admin/routes')}>
              Volver a rutas
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>

            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-4 mb-2">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {route.routeNumber}
                  </h1>
                  <span className={cn(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    getStatusColor(route.status)
                  )}>
                    {getStatusText(route.status)}
                  </span>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {route.name} • {new Date(route.date).toLocaleDateString('es-ES')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowMap(!showMap)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {showMap ? 'Ocultar Mapa' : 'Mostrar Mapa'}
                </Button>
                <Button
                  onClick={fetchRouteDetails}
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Actualizar
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Resumen', icon: BarChart3 },
                { id: 'stops', label: 'Paradas', icon: ListOrdered },
                { id: 'map', label: 'Mapa', icon: MapPin }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    'flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100">Paquetes</h3>
                    </div>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                      {route.deliveredPackages}/{route.totalPackages}
                    </p>
                    <div className="mt-2">
                      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                        <div
                          className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${calculateProgress()}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        {calculateProgress().toFixed(0)}% completado
                      </p>
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                        <Route className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-green-900 dark:text-green-100">Distancia</h3>
                    </div>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                      {route.distance || 0}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-2">millas totales</p>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-purple-900 dark:text-purple-100">Duración</h3>
                    </div>
                    <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                      {route.actualDuration || route.estimatedDuration || 'N/A'}
                    </p>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-2">
                      {route.actualDuration ? 'real' : 'estimada'}
                    </p>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-xl border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-orange-900 dark:text-orange-100">Conductor</h3>
                    </div>
                    <p className="text-xl font-bold text-orange-900 dark:text-orange-100 truncate">
                      {route.driverName || 'No asignado'}
                    </p>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
                      {route.vehiclePlate || 'Sin vehículo'}
                    </p>
                  </div>
                </div>

                {/* Route Details */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Detalles de la Ruta
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">Información General</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Mecanismo:</span>
                          <span className="font-medium text-gray-900 dark:text-white capitalize">
                            {route.mechanism === 'automatic' ? 'Automático' : 'Manual'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Estado:</span>
                          <span className={cn(
                            'px-2 py-1 rounded-full text-xs font-medium',
                            getStatusColor(route.status)
                          )}>
                            {getStatusText(route.status)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Fecha:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {new Date(route.date).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">Ventanas de Tiempo</h4>
                      <div className="space-y-2">
                        {route.timeWindows.length > 0 ? (
                          route.timeWindows.map((window, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-blue-500" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {window === '8-12' && '8:00 AM - 12:00 PM'}
                                {window === '12-16' && '12:00 PM - 4:00 PM'}
                                {window === '16-20' && '4:00 PM - 8:00 PM'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">Sin ventanas específicas</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">Recursos Asignados</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Conductor:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {route.driverName || 'No asignado'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Vehículo:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {route.vehiclePlate || 'No asignado'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">ID Almacén:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {route.warehouseId}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {route.notes && (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Notas</h4>
                      <p className="text-gray-600 dark:text-gray-400">
                        {route.notes}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'stops' && (
              <motion.div
                key="stops"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <ListOrdered className="w-4 h-4" />
                      Paradas de la Ruta ({route.waypoints?.length || 0} total)
                    </h3>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {route.waypoints && route.waypoints.length > 0 ? (
                      route.waypoints.map((waypoint, index) => (
                        <div key={waypoint.id} className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                              waypoint.status === 'delivered'
                                ? 'bg-green-500 text-white'
                                : waypoint.status === 'failed'
                                ? 'bg-red-500 text-white'
                                : 'bg-blue-500 text-white'
                            )}>
                              {index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {waypoint.customerName}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {waypoint.address}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs">
                                <span className={cn(
                                  'flex items-center gap-1',
                                  waypoint.status === 'delivered'
                                    ? 'text-green-600 dark:text-green-400'
                                    : waypoint.status === 'failed'
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-blue-600 dark:text-blue-400'
                                )}>
                                  <Package className="w-3 h-3" />
                                  {waypoint.status === 'delivered'
                                    ? 'Entregado'
                                    : waypoint.status === 'failed'
                                    ? 'Fallido'
                                    : 'Pendiente'
                                  }
                                </span>
                                <span className="flex items-center gap-1 text-gray-500">
                                  <MapPin className="w-3 h-3" />
                                  Parada #{index + 1}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-600 dark:text-gray-400">
                          No hay paradas asignadas a esta ruta
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'map' && (
              <motion.div
                key="map"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {/* Map Container */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Navigation className="w-5 h-5" />
                      Vista del Mapa
                    </h3>
                    <button
                      onClick={() => setShowMap(!showMap)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      {showMap ? 'Ocultar Mapa' : 'Mostrar Mapa'}
                    </button>
                  </div>

                  {/* Route Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Total Paradas</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {route.waypoints?.length || 0}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Route className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Distancia</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {route.distance || 0} mi
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Duración</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {route.actualDuration || route.estimatedDuration || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Map Component */}
                  {showMap && (
                    <div className="h-96 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <RouteMap
                        optimizationResult={prepareOptimizationResult()}
                        theme={theme}
                        warehouseCoordinates={[-80.2395, 25.7548]} // Miami coordinates
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  )
}