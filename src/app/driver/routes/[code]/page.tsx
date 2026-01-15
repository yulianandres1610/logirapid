'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Package,
  Clock,
  ChevronRight,
  Play,
  CheckCircle,
  AlertCircle,
  Navigation,
  Phone,
  Lock
} from 'lucide-react'

interface Order {
  id: number
  orderNumber: string
  senderName: string
  senderPhone: string
  status: string
}

interface Stop {
  stopNumber: number
  address: string
  city: string
  state: string
  coordinates: [number, number]
  status: string
  orders: Order[]
}

interface RouteDetail {
  routeId: number
  routeNumber: string
  qrCode: string
  status: string
  driverName: string
  vehiclePlate: string
  distance: number
  duration: number
  scheduledDate: string
  stops: Stop[]
  stopsSummary: {
    total: number
    completed: number
    pending: number
    failed: number
  }
}

export default function RouteDetailPage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string

  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  const fetchRouteDetails = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/driver-app/routes/${code}/stops`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()

      if (response.status === 401) {
        window.location.href = '/driver/login'
        return
      }

      if (data.success) {
        setRoute(data.data)
      } else {
        setError(data.error || 'Error al cargar ruta')
      }
    } catch (err) {
      console.error('Error fetching route:', err)
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (code) {
      fetchRouteDetails()
    }
  }, [code])

  const handleStartRoute = async () => {
    setIsStarting(true)
    try {
      const response = await fetch(`/api/driver-app/routes/${code}/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await response.json()

      if (response.status === 401) {
        window.location.href = '/driver/login'
        return
      }

      if (data.success) {
        // Refresh route data
        fetchRouteDetails()
      } else {
        setError(data.error || 'Error al iniciar ruta')
      }
    } catch (err) {
      console.error('Error starting route:', err)
      setError('Error de conexion')
    } finally {
      setIsStarting(false)
    }
  }

  const getStopStatus = (stop: Stop, index: number, currentStopIndex: number) => {
    if (stop.status === 'completed' || stop.status === 'completada') {
      return { isCompleted: true, isLocked: false, isCurrent: false }
    }
    if (stop.status === 'en_curso' || stop.status === 'in_progress') {
      return { isCompleted: false, isLocked: false, isCurrent: true }
    }
    // Check if this stop is accessible (current or previous completed)
    const isAccessible = index <= currentStopIndex
    return { isCompleted: false, isLocked: !isAccessible, isCurrent: index === currentStopIndex }
  }

  const getCurrentStopIndex = () => {
    if (!route) return 0
    const inProgressIndex = route.stops.findIndex(
      s => s.status === 'en_curso' || s.status === 'in_progress'
    )
    if (inProgressIndex >= 0) return inProgressIndex

    // Find first pending stop
    const pendingIndex = route.stops.findIndex(
      s => s.status === 'pending' || s.status === 'pendiente'
    )
    return pendingIndex >= 0 ? pendingIndex : 0
  }

  const handleStopClick = (stop: Stop, stopStatus: ReturnType<typeof getStopStatus>) => {
    if (stopStatus.isLocked) return
    router.push(`/driver/routes/${code}/stop/${stop.stopNumber}`)
  }

  const openNavigation = (stop: Stop) => {
    const [lng, lat] = stop.coordinates
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    window.open(url, '_blank')
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-exa-primary/30 border-t-exa-primary rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Cargando ruta...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchRouteDetails}
            className="mt-3 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!route) return null

  const currentStopIndex = getCurrentStopIndex()
  const canStartRoute = ['asignada', 'assigned', 'active', 'planning'].includes(route.status?.toLowerCase())
  const isInProgress = route.status === 'en_curso' || route.status === 'in_progress'
  const progress = route.stopsSummary.total > 0
    ? Math.round((route.stopsSummary.completed / route.stopsSummary.total) * 100)
    : 0

  return (
    <div className="pb-6">
      {/* Route Header Card */}
      <div className="px-4 pt-4">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-4 mb-4">
          {/* Route Number and Status */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-white font-bold text-xl">{route.routeNumber}</h2>
              <p className="text-gray-400 text-sm">{route.vehiclePlate}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${
              isInProgress
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : canStartRoute
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-green-500/20 text-green-400 border border-green-500/30'
            }`}>
              {isInProgress ? 'En Curso' : canStartRoute ? 'Asignada' : 'Completada'}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{route.stopsSummary.total}</p>
              <p className="text-gray-500 text-xs">Paradas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{route.stopsSummary.completed}</p>
              <p className="text-gray-500 text-xs">Completadas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{route.distance?.toFixed(1) || '--'}</p>
              <p className="text-gray-500 text-xs">Millas</p>
            </div>
          </div>

          {/* Progress Bar */}
          {isInProgress && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-xs">Progreso</span>
                <span className="text-exa-primary text-xs font-medium">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-gradient-to-r from-exa-primary to-exa-secondary rounded-full"
                />
              </div>
            </div>
          )}

          {/* Start Route Button */}
          {canStartRoute && (
            <motion.button
              onClick={handleStartRoute}
              disabled={isStarting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-gradient-to-r from-exa-primary to-exa-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              {isStarting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Iniciando...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Iniciar Ruta</span>
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>

      {/* Stops List */}
      <div className="px-4">
        <h3 className="text-white font-semibold mb-3">Paradas</h3>
        <div className="space-y-3">
          {route.stops.map((stop, index) => {
            const stopStatus = getStopStatus(stop, index, currentStopIndex)

            return (
              <motion.div
                key={stop.stopNumber}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleStopClick(stop, stopStatus)}
                className={`
                  relative bg-gray-800/50 border rounded-xl overflow-hidden
                  ${stopStatus.isLocked
                    ? 'border-gray-700/30 opacity-50 cursor-not-allowed'
                    : stopStatus.isCurrent
                      ? 'border-exa-primary/50 bg-exa-primary/5 cursor-pointer'
                      : stopStatus.isCompleted
                        ? 'border-green-500/30 cursor-pointer'
                        : 'border-gray-700/50 cursor-pointer hover:border-gray-600'
                  }
                `}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Stop Number Circle */}
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                      ${stopStatus.isCompleted
                        ? 'bg-green-500/20'
                        : stopStatus.isCurrent
                          ? 'bg-exa-primary/20'
                          : 'bg-gray-700/50'
                      }
                    `}>
                      {stopStatus.isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : stopStatus.isLocked ? (
                        <Lock className="w-4 h-4 text-gray-500" />
                      ) : (
                        <span className={`font-bold ${stopStatus.isCurrent ? 'text-exa-primary' : 'text-gray-400'}`}>
                          {stop.stopNumber}
                        </span>
                      )}
                    </div>

                    {/* Stop Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        stopStatus.isLocked ? 'text-gray-500' : 'text-white'
                      }`}>
                        {stop.address}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {stop.city}, {stop.state}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-gray-500 text-xs flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {stop.orders.length} ordenes
                        </span>
                        {stopStatus.isCurrent && (
                          <span className="text-exa-primary text-xs font-medium">
                            Siguiente parada
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {!stopStatus.isLocked && (
                      <div className="flex items-center gap-2">
                        {stop.coordinates && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openNavigation(stop)
                            }}
                            className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
                          >
                            <Navigation className="w-4 h-4" />
                          </button>
                        )}
                        <ChevronRight className={`w-5 h-5 ${
                          stopStatus.isCurrent ? 'text-exa-primary' : 'text-gray-500'
                        }`} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Current indicator */}
                {stopStatus.isCurrent && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-exa-primary" />
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
