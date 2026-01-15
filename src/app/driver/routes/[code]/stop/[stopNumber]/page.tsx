'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  MapPin,
  Package,
  User,
  Phone,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Navigation,
  Key,
  FileText,
  Clock
} from 'lucide-react'

interface Order {
  id: number
  orderNumber: string
  senderName: string
  senderPhone: string
  senderAddress: string
  recipientName?: string
  recipientPhone?: string
  status: string
  hasProof: boolean
  services: Array<{
    name: string
    type: string
  }>
}

interface Stop {
  stopNumber: number
  address: string
  city: string
  state: string
  coordinates: [number, number]
  status: string
  orders: Order[]
  entryPin?: string
  entryInstructions?: string
}

interface RouteData {
  routeId: number
  routeNumber: string
  status: string
  stops: Stop[]
}

export default function StopDetailPage() {
  const router = useRouter()
  const params = useParams()
  const code = params.code as string
  const stopNumber = parseInt(params.stopNumber as string)

  const [routeData, setRouteData] = useState<RouteData | null>(null)
  const [stop, setStop] = useState<Stop | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isCompleting, setIsCompleting] = useState(false)

  const fetchStopData = async () => {
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
        setRouteData(data.data)
        const currentStop = data.data.stops.find((s: Stop) => s.stopNumber === stopNumber)
        if (currentStop) {
          setStop(currentStop)
        } else {
          setError('Parada no encontrada')
        }
      } else {
        setError(data.error || 'Error al cargar parada')
      }
    } catch (err) {
      console.error('Error fetching stop:', err)
      setError('Error de conexion')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (code && stopNumber) {
      fetchStopData()
    }
  }, [code, stopNumber])

  const handleOrderClick = (order: Order) => {
    router.push(`/driver/orders/${order.id}`)
  }

  const handleCompleteStop = async () => {
    if (!stop) return

    // Check if all orders are processed
    const allCompleted = stop.orders.every(
      o => o.status === 'completada' || o.status === 'completed' || o.status === 'pagada'
    )

    if (!allCompleted) {
      setError('Debes procesar todas las ordenes antes de completar la parada')
      return
    }

    setIsCompleting(true)
    try {
      const response = await fetch(`/api/driver-app/routes/${code}/stops/${stopNumber}/complete`, {
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
        // Go back to route detail
        router.push(`/driver/routes/${code}`)
      } else {
        setError(data.error || 'Error al completar parada')
      }
    } catch (err) {
      console.error('Error completing stop:', err)
      setError('Error de conexion')
    } finally {
      setIsCompleting(false)
    }
  }

  const openNavigation = () => {
    if (!stop?.coordinates) return
    const [lng, lat] = stop.coordinates
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    window.open(url, '_blank')
  }

  const getOrderStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completada':
      case 'completed':
      case 'pagada':
        return {
          label: 'Completada',
          color: 'bg-green-500/20 text-green-400'
        }
      case 'en_proceso':
      case 'processing':
        return {
          label: 'En Proceso',
          color: 'bg-yellow-500/20 text-yellow-400'
        }
      default:
        return {
          label: 'Pendiente',
          color: 'bg-gray-500/20 text-gray-400'
        }
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-exa-primary/30 border-t-exa-primary rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Cargando parada...</p>
      </div>
    )
  }

  if (error && !stop) {
    return (
      <div className="px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={fetchStopData}
            className="mt-3 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!stop) return null

  const completedOrders = stop.orders.filter(
    o => o.status === 'completada' || o.status === 'completed' || o.status === 'pagada'
  ).length
  const allCompleted = completedOrders === stop.orders.length

  return (
    <div className="pb-6">
      {/* Stop Header */}
      <div className="px-4 pt-4">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-4 mb-4">
          {/* Stop Number and Address */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 bg-exa-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-exa-primary font-bold text-lg">{stop.stopNumber}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-semibold text-lg">{stop.address}</h2>
              <p className="text-gray-400 text-sm">{stop.city}, {stop.state}</p>
            </div>
          </div>

          {/* Entry Info (if available) */}
          {(stop.entryPin || stop.entryInstructions) && (
            <div className="bg-gray-900/50 rounded-xl p-3 mb-4">
              {stop.entryPin && (
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-yellow-400" />
                  <span className="text-gray-400 text-sm">PIN:</span>
                  <span className="text-white font-mono font-semibold">{stop.entryPin}</span>
                </div>
              )}
              {stop.entryInstructions && (
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-400 mt-0.5" />
                  <p className="text-gray-300 text-sm">{stop.entryInstructions}</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={openNavigation}
              className="flex-1 py-3 bg-blue-500/20 text-blue-400 font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-blue-500/30 transition-colors"
            >
              <Navigation className="w-5 h-5" />
              <span>Navegar</span>
            </button>
            {stop.orders[0]?.senderPhone && (
              <a
                href={`tel:${stop.orders[0].senderPhone}`}
                className="flex-1 py-3 bg-green-500/20 text-green-400 font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-green-500/30 transition-colors"
              >
                <Phone className="w-5 h-5" />
                <span>Llamar</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 mb-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Orders Progress */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">Ordenes completadas</span>
          <span className="text-white text-sm font-medium">
            {completedOrders} / {stop.orders.length}
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(completedOrders / stop.orders.length) * 100}%` }}
            className="h-full bg-gradient-to-r from-exa-primary to-exa-secondary rounded-full"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Package className="w-5 h-5 text-exa-primary" />
          Ordenes en esta parada
        </h3>
        <div className="space-y-3">
          {stop.orders.map((order, index) => {
            const statusConfig = getOrderStatusConfig(order.status)
            const isCompleted = ['completada', 'completed', 'pagada'].includes(order.status?.toLowerCase())

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleOrderClick(order)}
                className={`
                  bg-gray-800/50 border rounded-xl p-4 cursor-pointer
                  ${isCompleted
                    ? 'border-green-500/30'
                    : 'border-gray-700/50 hover:border-gray-600'
                  }
                  transition-all active:scale-[0.98]
                `}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-white font-semibold">{order.orderNumber}</h4>
                    <p className="text-gray-400 text-sm flex items-center gap-1 mt-1">
                      <User className="w-3.5 h-3.5" />
                      {order.senderName}
                    </p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                    {statusConfig.label}
                  </div>
                </div>

                {/* Services */}
                {order.services && order.services.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {order.services.slice(0, 3).map((service, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-lg"
                      >
                        {service.name}
                      </span>
                    ))}
                    {order.services.length > 3 && (
                      <span className="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded-lg">
                        +{order.services.length - 3} mas
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                  {order.senderPhone && (
                    <a
                      href={`tel:${order.senderPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 text-sm flex items-center gap-1 hover:text-white"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {order.senderPhone}
                    </a>
                  )}
                  <div className="flex items-center gap-1 text-exa-primary">
                    <span className="text-sm font-medium">
                      {isCompleted ? 'Ver Detalles' : 'Procesar'}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Complete Stop Button */}
      {allCompleted && (
        <div className="px-4 mt-6">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleCompleteStop}
            disabled={isCompleting}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
          >
            {isCompleting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Completando...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Completar Parada</span>
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  )
}
