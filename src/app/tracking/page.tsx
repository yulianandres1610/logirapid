'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, Package, Truck, MapPin, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface TrackingData {
  orderNumber: string
  status: string
  customerName: string
  destination: string
  timeline: TimelineEvent[]
  estimatedDelivery?: string
  driver?: {
    name: string
    vehicle: string
  }
}

interface TimelineEvent {
  status: string
  label: string
  timestamp?: string
  completed: boolean
  current: boolean
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Package }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-500', icon: Clock },
  picked_up: { label: 'Recogido', color: 'text-purple-500', icon: Package },
  in_transit: { label: 'En Tránsito', color: 'text-blue-500', icon: Truck },
  in_route: { label: 'En Reparto', color: 'text-indigo-500', icon: Truck },
  en_ruta: { label: 'En Ruta', color: 'text-cyan-500', icon: Truck },
  en_reparto: { label: 'En Reparto', color: 'text-purple-500', icon: Truck },
  delivered: { label: 'Entregado', color: 'text-green-500', icon: CheckCircle },
  completed: { label: 'Completado', color: 'text-green-500', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'text-red-500', icon: AlertCircle },
  reprogrammed: { label: 'Reprogramado', color: 'text-orange-500', icon: Clock },
}

function TrackingContent() {
  const searchParams = useSearchParams()
  const initialOrder = searchParams.get('order') || ''

  const [orderNumber, setOrderNumber] = useState(initialOrder)
  const [searchInput, setSearchInput] = useState(initialOrder)
  const [tracking, setTracking] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTracking = async (order: string) => {
    if (!order.trim()) return

    setLoading(true)
    setError(null)
    setTracking(null)

    try {
      const response = await fetch(`/api/public/tracking?order=${encodeURIComponent(order.trim())}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Orden no encontrada')
      }

      setTracking(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar la orden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialOrder) {
      fetchTracking(initialOrder)
    }
  }, [initialOrder])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOrderNumber(searchInput)
    fetchTracking(searchInput)
  }

  const getStatusConfig = (status: string) => {
    return statusConfig[status] || { label: status, color: 'text-gray-500', icon: Package }
  }

  return (
    <section className="min-h-screen pt-24 pb-20 bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Rastrear tu{' '}
            <span className="text-[#0374e5]">
              Paquete
            </span>
          </h1>
          <p className="text-lg text-gray-400">
            Ingresa tu número de orden para ver el estado de tu envío en tiempo real.
          </p>
        </motion.div>

        {/* Search Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          onSubmit={handleSearch}
          className="mb-12"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ej: ORD-2024-001234"
                className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#0374e5] focus:ring-1 focus:ring-[#0374e5] transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-4 bg-[#0374e5] text-white rounded-xl font-semibold hover:bg-[#0262c4] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Buscar
                </>
              )}
            </button>
          </div>
        </motion.form>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center mb-8"
          >
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-2">Orden no encontrada</h3>
            <p className="text-gray-400">{error}</p>
          </motion.div>
        )}

        {/* Tracking Result */}
        {tracking && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-gray-800/50 border border-gray-700/50 rounded-2xl overflow-hidden"
          >
            {/* Order Header */}
            <div className="p-6 border-b border-gray-700/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Número de Orden</p>
                  <p className="text-xl font-bold text-white">{tracking.orderNumber}</p>
                </div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700/50 ${getStatusConfig(tracking.status).color}`}>
                  {(() => {
                    const IconComponent = getStatusConfig(tracking.status).icon
                    return <IconComponent className="w-5 h-5" />
                  })()}
                  <span className="font-semibold">{getStatusConfig(tracking.status).label}</span>
                </div>
              </div>
            </div>

            {/* Destination Info */}
            <div className="p-6 border-b border-gray-700/50">
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Destinatario</p>
                  <p className="text-white font-medium">{tracking.customerName}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Dirección de Entrega</p>
                  <p className="text-white font-medium">{tracking.destination}</p>
                </div>
              </div>
              {tracking.estimatedDelivery && (
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Entrega estimada: {tracking.estimatedDelivery}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Historial de Seguimiento</h3>
              <div className="space-y-1">
                {tracking.timeline.map((event, index) => (
                  <div key={index} className="flex gap-4">
                    {/* Timeline Line */}
                    <div className="flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        event.completed
                          ? 'bg-green-500'
                          : event.current
                            ? 'bg-[#0374e5]'
                            : 'bg-gray-600'
                      }`}>
                        {event.completed && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      {index < tracking.timeline.length - 1 && (
                        <div className={`w-0.5 h-12 ${
                          event.completed ? 'bg-green-500' : 'bg-gray-600'
                        }`} />
                      )}
                    </div>

                    {/* Event Info */}
                    <div className="flex-1 pb-8">
                      <p className={`font-medium ${
                        event.completed || event.current ? 'text-white' : 'text-gray-500'
                      }`}>
                        {event.label}
                      </p>
                      {event.timestamp && (
                        <p className="text-gray-400 text-sm mt-1">{event.timestamp}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Driver Info */}
            {tracking.driver && (
              <div className="p-6 border-t border-gray-700/50 bg-gray-800/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#0374e5] flex items-center justify-center">
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Conductor asignado</p>
                    <p className="text-white font-medium">{tracking.driver.name}</p>
                    <p className="text-gray-400 text-sm">{tracking.driver.vehicle}</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Empty State */}
        {!tracking && !error && !loading && orderNumber && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Ingresa un número de orden para comenzar el rastreo</p>
          </div>
        )}
      </div>
    </section>
  )
}

export default function TrackingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen pt-24 pb-20 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#0374e5] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    }>
      <TrackingContent />
    </Suspense>
  )
}
