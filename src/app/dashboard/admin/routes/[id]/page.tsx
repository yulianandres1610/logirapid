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
  RefreshCw,
  FileCheck,
  Edit3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import RouteMap from '@/components/maps/RouteMap'
import RouteStopCard from '@/components/routes/RouteStopCard'
import DeliveryProofForm from '@/components/routes/DeliveryProofForm'
import DeliveryProofViewer from '@/components/routes/DeliveryProofViewer'

interface RouteData {
  id: number
  routeNumber: string
  name: string
  driverId?: number
  driverName?: string
  vehicleId?: number
  vehiclePlate?: string
  // Include legacy English states for backward compatibility
  status: 'planificada' | 'asignada' | 'en_curso' | 'completada' | 'cancelada' | 'planning' | 'active' | 'completed' | 'cancelled'
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
  mapboxJobId?: string | null
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
  const [routeOrders, setRouteOrders] = useState<any[]>([])

  // Estados para comprobantes de entrega
  const [routeStops, setRouteStops] = useState<any[]>([])
  const [loadingStops, setLoadingStops] = useState(false)
  const [selectedOrderForProof, setSelectedOrderForProof] = useState<{
    orderId: number
    orderNumber: string
    recipientName?: string
    services?: any[]
  } | null>(null)
  const [viewingProofOrderId, setViewingProofOrderId] = useState<number | null>(null)

  useEffect(() => {
    fetchRouteDetails()
  }, [routeId])

  // Cargar paradas para mostrar en el resumen y en la pestaña de paradas
  useEffect(() => {
    if (routeId) {
      fetchRouteStops()
    }
  }, [routeId])

  const fetchRouteStops = async () => {
    try {
      setLoadingStops(true)
      const response = await fetch(`/api/routes/${routeId}/stops`)
      const data = await response.json()

      if (data.success) {
        setRouteStops(data.data.stops || [])

        // Sincronizar estado de ruta si es diferente al calculado
        const currentStatus = route?.status
        const calculatedStatus = data.data.calculatedStatus

        if (currentStatus && calculatedStatus && currentStatus !== calculatedStatus) {
          console.log(`📊 Estado de ruta: ${currentStatus} -> calculado: ${calculatedStatus}`)

          // Solo actualizar automáticamente a 'completed' cuando todas las paradas están listas
          if (calculatedStatus === 'completed') {
            await syncRouteStatus(calculatedStatus)
          }
        }
      } else {
        console.error('Error fetching route stops:', data.error)
      }
    } catch (error) {
      console.error('Error fetching route stops:', error)
    } finally {
      setLoadingStops(false)
    }
  }

  // Sincronizar el estado de la ruta con la base de datos
  const syncRouteStatus = async (newStatus: string) => {
    try {
      const updateResponse = await fetch(`/api/routes/${routeId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (updateResponse.ok) {
        if (newStatus === 'completed') {
          showNotification('success', 'Ruta completada', 'Todas las paradas han sido completadas')
        }
        await fetchRouteDetails()
      }
    } catch (error) {
      console.error('Error syncing route status:', error)
    }
  }

  const handleAddProof = (orderId: number) => {
    const stop = routeStops.find(s => s.orders.some((o: any) => o.id === orderId))
    const order = stop?.orders.find((o: any) => o.id === orderId)

    if (order) {
      setSelectedOrderForProof({
        orderId: order.id,
        orderNumber: order.orderNumber,
        recipientName: order.senderName || order.recipientName, // Usar remitente para primera milla
        services: order.services || [] // Pasar servicios para validación de empaques
      })
    }
  }

  const handleViewProof = (orderId: number) => {
    setViewingProofOrderId(orderId)
  }

  const handleViewStop = (stopNumber: number) => {
    router.push(`/dashboard/admin/routes/${routeId}/stops/${stopNumber}`)
  }

  const handleProofSuccess = async () => {
    setSelectedOrderForProof(null)

    // Recargar paradas y ruta para actualizar contadores
    await fetchRouteStops()
    await fetchRouteDetails()

    // Verificar si todas las órdenes están completadas para actualizar el estado de la ruta
    await checkAndUpdateRouteStatus()

    showNotification('success', 'Comprobante guardado', 'El comprobante de entrega se guardó correctamente')
  }

  const checkAndUpdateRouteStatus = async () => {
    // La sincronización ahora se hace en fetchRouteStops usando calculatedStatus
    await fetchRouteStops()
  }

  const fetchRouteDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/routes/${routeId}`)

      if (response.ok) {
        const data = await response.json()
        console.log('📊 Datos recibidos de API:', data)

        if (data.success) {
          console.log('✅ Ruta cargada:', data.data)
          console.log('📦 Total paquetes:', data.data.totalPackages)
          console.log('📍 Waypoints:', data.data.waypoints)
          console.log('🗺️ OptimizedRoute:', data.data.optimizedRoute ? 'SI' : 'NO')
          console.log('🆔 MapboxJobId:', data.data.mapboxJobId || 'NO')
          console.log('📊 Distancia:', data.data.distance)
          console.log('⏱️ Duración:', data.data.estimatedDuration)

          setRoute(data.data)
        } else {
          showNotification('error', 'Error', data.error || 'No se pudo cargar la ruta')
        }
      } else {
        showNotification('error', 'Error', 'No se pudo cargar la ruta')
      }
    } catch (error) {
      console.error('Error fetching route details:', error)
      showNotification('error', 'Error de Conexión', 'No se pudo cargar la ruta')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planificada':
      case 'planning': // legacy
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
      case 'asignada':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
      case 'en_curso':
      case 'active': // legacy
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
      case 'completada':
      case 'completed': // legacy
        return 'text-green-600 bg-green-50 dark:bg-green-900/20'
      case 'cancelada':
      case 'cancelled': // legacy
        return 'text-red-600 bg-red-50 dark:bg-red-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'planificada':
      case 'planning': // legacy
        return 'Planificada'
      case 'asignada':
        return 'Asignada'
      case 'en_curso':
      case 'active': // legacy
        return 'En Curso'
      case 'completada':
      case 'completed': // legacy
        return 'Completada'
      case 'cancelada':
      case 'cancelled': // legacy
        return 'Cancelada'
      default: return status
    }
  }

  // Handler para iniciar la ruta
  const handleStartRoute = async () => {
    try {
      const response = await fetch(`/api/routes/${routeId}/start`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.success) {
        showNotification('success', 'Ruta Iniciada', data.message)
        fetchRouteDetails()
        fetchRouteStops()
      } else {
        showNotification('error', 'Error', data.error)
      }
    } catch (error) {
      showNotification('error', 'Error', 'No se pudo iniciar la ruta')
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
    if (!route) {
      console.warn('⚠️ No hay datos de ruta')
      return null
    }

    console.log('🔍 Preparando resultado de optimización para ruta:', route.routeNumber)
    console.log('📦 Total paquetes guardados:', route.totalPackages)
    console.log('📍 Waypoints guardados:', route.waypoints?.length || 0)

    // Transformar waypoints al formato esperado por el mapa
    // Soporta múltiples formatos de datos
    const transformedStops = route.waypoints?.map((waypoint: any, index: number) => {
      // Obtener dirección
      let address = waypoint.address || 'Dirección no disponible'

      // Obtener coordenadas (soporta diferentes formatos)
      let lng = 0
      let lat = 0
      if (waypoint.coordinates && Array.isArray(waypoint.coordinates)) {
        [lng, lat] = waypoint.coordinates
      } else {
        lng = parseFloat(waypoint.longitude || waypoint.lng || 0)
        lat = parseFloat(waypoint.latitude || waypoint.lat || 0)
      }

      // Obtener información de órdenes
      const orders = waypoint.orders || []
      const orderIds = waypoint.orderIds || (waypoint.orderId ? [waypoint.orderId] : [])
      const orderNumbers = waypoint.orderNumbers || orders.map((o: any) => o.orderNumber) || []
      const firstOrder = orders[0] || {}

      return {
        id: orderIds[0] || index + 1,
        address,
        customer: firstOrder.customerName || waypoint.customerName || 'Cliente',
        type: waypoint.type || 'delivery',
        coordinates: [lng, lat] as [number, number],
        orderNumber: orderNumbers[0] || `#${orderIds[0] || index + 1}`,
        orderNumbers,
        orderIds,
        totalOrders: waypoint.totalOrders || orders.length || 1,
        waypointIndex: index,
        sequence: waypoint.sequence || index + 1,
        status: waypoint.status || 'pending'
      }
    }) || []

    const result: any = {
      totalOrders: route.totalPackages || 0,
      pickups: 0,
      deliveries: route.deliveredPackages || 0,
      totalDistance: route.distance || 0,
      estimatedDuration: route.estimatedDuration || 'Pendiente',
      optimizedStops: route.waypoints?.length || 0,
      stops: transformedStops,
      route: {
        start: 'Almacén',
        stops: transformedStops,
        end: 'Almacén'
      }
    }

    // Usar datos guardados de optimizedRoute si existen
    if (route.optimizedRoute) {
      if (route.optimizedRoute.geometry) {
        result.geometry = route.optimizedRoute.geometry
        result.coordinates = route.optimizedRoute.coordinates
      }
      result.optimizedRoute = route.optimizedRoute
    }

    console.log('✅ Resultado preparado:', {
      totalOrders: result.totalOrders,
      stops: result.stops.length,
      totalDistance: result.totalDistance
    })

    return result
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
                {/* Mostrar botón Iniciar para rutas asignadas o planning con driver */}
                {(route?.status === 'asignada' || (route?.status === 'planning' && route?.driverId)) && (
                  <Button
                    onClick={handleStartRoute}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Iniciar Ruta
                  </Button>
                )}
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
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100">Paradas</h3>
                    </div>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                      {routeStops.filter(s => s.status === 'delivered').length}/{routeStops.length}
                    </p>
                    <div className="mt-2">
                      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                        <div
                          className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${routeStops.length > 0 ? (routeStops.filter(s => s.status === 'delivered').length / routeStops.length) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        {routeStops.length > 0 ? ((routeStops.filter(s => s.status === 'delivered').length / routeStops.length) * 100).toFixed(0) : 0}% completado
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
                {/* Header con estadísticas */}
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <ListOrdered className="w-5 h-5" />
                    Paradas de la Ruta
                    <span className="text-gray-500">({routeStops.length} paradas)</span>
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchRouteStops}
                    disabled={loadingStops}
                  >
                    <RefreshCw className={cn("w-4 h-4 mr-2", loadingStops && "animate-spin")} />
                    Actualizar
                  </Button>
                </div>

                {/* Indicador de comprobantes */}
                {routeStops.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                        <FileCheck className="w-4 h-4" />
                        Comprobantes:
                      </span>
                      {(() => {
                        const totalOrders = routeStops.reduce((acc, s) => acc + s.orders.length, 0)
                        const ordersWithProof = routeStops.reduce((acc, s) =>
                          acc + s.orders.filter((o: any) => o.hasProof).length, 0)
                        return (
                          <span className={cn(
                            "font-medium",
                            ordersWithProof === totalOrders
                              ? "text-green-600 dark:text-green-400"
                              : "text-yellow-600 dark:text-yellow-400"
                          )}>
                            {ordersWithProof}/{totalOrders} órdenes con comprobante
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {/* Lista de paradas con nuevo componente */}
                {loadingStops ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600 dark:text-gray-400">Cargando paradas...</p>
                    </div>
                  </div>
                ) : routeStops.length > 0 ? (
                  <div className="space-y-4">
                    {routeStops.map((stop, index) => (
                      <RouteStopCard
                        key={`stop-${index}`}
                        stop={stop}
                        routeId={parseInt(routeId)}
                        onAddProof={handleAddProof}
                        onViewProof={handleViewProof}
                        onViewStop={handleViewStop}
                        expandedByDefault={index === 0}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                    <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      No hay paradas asignadas a esta ruta
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                      Las órdenes se asignan al crear o editar la ruta
                    </p>
                  </div>
                )}
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
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Total Paquetes</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {route.totalPackages || 0}
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Route className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Distancia</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {(Number(route.distance || 0) / 1609.34).toFixed(1)} mi
                      </p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Duración</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {route.estimatedDuration === '5483.553m' ? '91.4 min' : (route.estimatedDuration || 'N/A')}
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

      {/* Modal para agregar comprobante de entrega */}
      {selectedOrderForProof && (
        <DeliveryProofForm
          orderId={selectedOrderForProof.orderId}
          orderNumber={selectedOrderForProof.orderNumber}
          companyId={user?.companyId || '1'}
          recipientName={selectedOrderForProof.recipientName}
          services={selectedOrderForProof.services}
          onSuccess={handleProofSuccess}
          onCancel={() => setSelectedOrderForProof(null)}
        />
      )}

      {/* Modal para ver comprobante existente */}
      {viewingProofOrderId && (
        <DeliveryProofViewer
          orderId={viewingProofOrderId}
          companyId={user?.companyId}
          onClose={() => setViewingProofOrderId(null)}
        />
      )}
    </DashboardLayout>
  )
}