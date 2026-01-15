'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Route,
  MapPin,
  Clock,
  Package,
  ChevronRight,
  Calendar,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Play
} from 'lucide-react'

interface RouteData {
  id: number
  routeNumber: string
  qrCode: string
  status: string
  scheduledDate: string
  totalStops: number
  completedStops: number
  totalOrders: number
  distance: number
  duration: number
  driverName: string
  vehiclePlate: string
}

export default function DriverRoutesPage() {
  const router = useRouter()
  const [routes, setRoutes] = useState<RouteData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  const fetchRoutes = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/driver-app/routes?date=${selectedDate}`)
      const data = await response.json()

      if (data.success) {
        setRoutes(data.data || [])
      } else {
        setError(data.error || 'Error al cargar rutas')
      }
    } catch (err) {
      console.error('Error fetching routes:', err)
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRoutes()
  }, [selectedDate])

  const getStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'asignada':
      case 'assigned':
      case 'active':
        return {
          label: 'Asignada',
          color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          icon: Clock
        }
      case 'en_curso':
      case 'in_progress':
        return {
          label: 'En Curso',
          color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
          icon: Play
        }
      case 'completada':
      case 'completed':
        return {
          label: 'Completada',
          color: 'bg-green-500/20 text-green-400 border-green-500/30',
          icon: CheckCircle
        }
      case 'cancelled':
      case 'cancelada':
        return {
          label: 'Cancelada',
          color: 'bg-red-500/20 text-red-400 border-red-500/30',
          icon: AlertCircle
        }
      default:
        return {
          label: status || 'Pendiente',
          color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
          icon: Clock
        }
    }
  }

  const handleRouteClick = (route: RouteData) => {
    router.push(`/driver/routes/${route.routeNumber}`)
  }

  return (
    <div className="px-4 py-4">
      {/* Date Selector */}
      <div className="mb-6">
        <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 bg-transparent text-white border-none outline-none"
          />
          <button
            onClick={fetchRoutes}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 border-4 border-exa-primary/30 border-t-exa-primary rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Cargando rutas...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchRoutes}
            className="mt-3 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && routes.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Route className="w-10 h-10 text-gray-600" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">
            Sin rutas asignadas
          </h3>
          <p className="text-gray-400 text-sm">
            No tienes rutas para esta fecha
          </p>
        </div>
      )}

      {/* Routes List */}
      {!isLoading && !error && routes.length > 0 && (
        <div className="space-y-4">
          {routes.map((route, index) => {
            const statusConfig = getStatusConfig(route.status)
            const StatusIcon = statusConfig.icon
            const progress = route.totalStops > 0
              ? Math.round((route.completedStops / route.totalStops) * 100)
              : 0

            return (
              <motion.div
                key={route.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleRouteClick(route)}
                className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4 cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-all active:scale-[0.98]"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold text-lg">
                      {route.routeNumber}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {route.vehiclePlate}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${statusConfig.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{statusConfig.label}</span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-900/50 rounded-xl p-3 text-center">
                    <MapPin className="w-4 h-4 text-exa-primary mx-auto mb-1" />
                    <p className="text-white font-semibold">{route.totalStops}</p>
                    <p className="text-gray-500 text-xs">Paradas</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-xl p-3 text-center">
                    <Package className="w-4 h-4 text-exa-secondary mx-auto mb-1" />
                    <p className="text-white font-semibold">{route.totalOrders}</p>
                    <p className="text-gray-500 text-xs">Ordenes</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-xl p-3 text-center">
                    <Clock className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                    <p className="text-white font-semibold">{route.duration || 0}</p>
                    <p className="text-gray-500 text-xs">Min est.</p>
                  </div>
                </div>

                {/* Progress Bar (if in progress) */}
                {route.status === 'en_curso' && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-400 text-xs">Progreso</span>
                      <span className="text-exa-primary text-xs font-medium">{progress}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-gradient-to-r from-exa-primary to-exa-secondary rounded-full"
                      />
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                  <p className="text-gray-500 text-xs">
                    {route.distance ? `${route.distance.toFixed(1)} mi` : '-- mi'}
                  </p>
                  <div className="flex items-center gap-1 text-exa-primary">
                    <span className="text-sm font-medium">
                      {route.status === 'en_curso' ? 'Continuar' : 'Ver Ruta'}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
