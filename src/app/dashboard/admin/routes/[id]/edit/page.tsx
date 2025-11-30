'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Truck, User, Calendar, Clock, MapPin, Package, Save,
  AlertTriangle, RefreshCw, Loader2, CheckCircle, X
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

// Helper para leer cookies en el cliente
const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift()
  return undefined
}

interface Driver {
  id: number
  firstName: string
  lastName: string
  phone?: string
  email?: string
  isActive: boolean
  companyId?: number
  companyName?: string
}

interface RouteOrder {
  id: number
  orderNumber: string
  customerName?: string
  senderName?: string
  senderAddress?: string
  status: string
  services?: any[]
}

interface RouteData {
  id: number
  routeNumber: string
  status: string
  driverId: number | null
  driverName: string | null
  scheduledDate: string | null
  stops: RouteOrder[]
}

export default function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const routeId = resolvedParams.id
  const router = useRouter()
  const { user } = useAuth()

  const [route, setRoute] = useState<RouteData | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Modal de reprogramación
  const [reprogramModal, setReprogramModal] = useState<{
    open: boolean
    orderId: number | null
    orderNumber: string
    isLastOrder: boolean
  }>({ open: false, orderId: null, orderNumber: '', isLastOrder: false })
  const [newDate, setNewDate] = useState('')
  const [newTimeSlot, setNewTimeSlot] = useState('')
  const [reprogramming, setReprogramming] = useState(false)

  // Helper para obtener nombre completo del driver
  const getDriverFullName = (driver: Driver) => {
    return `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || 'Sin nombre'
  }

  // Cargar datos de la ruta y drivers
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Obtener headers de autenticación desde cookies
        const companyId = getCookie('user-company-id')
        const userRole = getCookie('user-role')

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        }

        // Solo agregar company-id si no es SUPER_ADMIN
        if (userRole !== 'SUPER_ADMIN' && companyId) {
          headers['x-company-id'] = companyId
        }
        if (userRole) {
          headers['x-user-role'] = userRole
        }

        // Cargar ruta con sus paradas
        const routeRes = await fetch(`/api/routes/${routeId}/stops`, { headers })
        if (!routeRes.ok) throw new Error('Error al cargar la ruta')
        const routeData = await routeRes.json()

        if (!routeData.success) throw new Error(routeData.error || 'Error al cargar la ruta')

        // Transformar datos de paradas a órdenes
        const orders: RouteOrder[] = []
        for (const stop of routeData.data.stops || []) {
          for (const order of stop.orders || []) {
            orders.push({
              id: order.id,
              orderNumber: order.orderNumber,
              customerName: order.senderName || order.customerName,
              senderName: order.senderName,
              senderAddress: order.senderAddress || stop.address,
              status: order.status,
              services: order.services
            })
          }
        }

        setRoute({
          id: routeData.data.routeId,
          routeNumber: routeData.data.routeNumber,
          status: routeData.data.status,
          driverId: routeData.data.driverId,
          driverName: routeData.data.driverName,
          scheduledDate: routeData.data.scheduledDate,
          stops: orders
        })

        setSelectedDriverId(routeData.data.driverId?.toString() || '')

        // Cargar drivers con headers de autenticación
        const driversRes = await fetch('/api/drivers?status=active', { headers })
        if (driversRes.ok) {
          const driversData = await driversRes.json()
          // Filtrar solo drivers activos
          const activeDrivers = (driversData.data || []).filter((d: Driver) => d.isActive !== false)
          setDrivers(activeDrivers)
        }

      } catch (err) {
        console.error('Error fetching data:', err)
        setError(err instanceof Error ? err.message : 'Error al cargar datos')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [routeId])

  // Guardar cambio de driver
  const handleSaveDriver = async () => {
    if (!route) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const selectedDriver = drivers.find(d => d.id.toString() === selectedDriverId)
      const driverFullName = selectedDriver ? getDriverFullName(selectedDriver) : null

      // Obtener headers de autenticación
      const companyId = getCookie('user-company-id')
      const userRole = getCookie('user-role')

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (userRole !== 'SUPER_ADMIN' && companyId) {
        headers['x-company-id'] = companyId
      }
      if (userRole) {
        headers['x-user-role'] = userRole
      }

      const res = await fetch(`/api/routes/${routeId}/driver`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          driverId: selectedDriverId ? parseInt(selectedDriverId) : null,
          driverName: driverFullName
        })
      })

      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al actualizar conductor')
      }

      setSuccess(data.message || 'Conductor actualizado correctamente')
      setRoute(prev => prev ? {
        ...prev,
        driverId: selectedDriverId ? parseInt(selectedDriverId) : null,
        driverName: driverFullName,
        status: data.data?.status || prev.status
      } : null)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Abrir modal de reprogramación
  const openReprogramModal = (order: RouteOrder) => {
    const isLastOrder = route?.stops.length === 1
    setReprogramModal({
      open: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      isLastOrder
    })
    // Establecer fecha por defecto (mañana)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setNewDate(tomorrow.toISOString().split('T')[0])
    setNewTimeSlot('morning')
  }

  // Confirmar reprogramación
  const handleReprogramOrder = async () => {
    if (!reprogramModal.orderId || !newDate || !newTimeSlot) return

    try {
      setReprogramming(true)
      setError(null)

      const res = await fetch(`/api/package-orders/${reprogramModal.orderId}/reprogram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newScheduledDate: newDate,
          newTimeSlot: newTimeSlot
        })
      })

      const data = await res.json()

      if (!data.success && !res.ok) {
        throw new Error(data.error || 'Error al reprogramar orden')
      }

      // Si era la última orden, la ruta fue eliminada
      if (data.data?.routeDeleted) {
        setSuccess('Orden reprogramada y ruta eliminada')
        setTimeout(() => {
          router.push('/dashboard/admin/routes')
        }, 1500)
      } else {
        setSuccess('Orden reprogramada exitosamente')
        // Actualizar lista de órdenes
        setRoute(prev => prev ? {
          ...prev,
          stops: prev.stops.filter(o => o.id !== reprogramModal.orderId)
        } : null)
      }

      setReprogramModal({ open: false, orderId: null, orderNumber: '', isLastOrder: false })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reprogramar')
    } finally {
      setReprogramming(false)
    }
  }

  // Verificar si se puede editar
  const canEditDriver = route && ['planificada', 'planning', 'asignada'].includes(route.status)
  const canReprogramOrders = route && !['completada', 'cancelada', 'completed', 'cancelled'].includes(route.status)

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'planificada': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'planning': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'asignada': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      'en_curso': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'active': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'completada': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'completed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'cancelada': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    }
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
  }

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'planificada': 'Planificada',
      'planning': 'Planificada',
      'asignada': 'Asignada',
      'en_curso': 'En Curso',
      'active': 'En Curso',
      'completada': 'Completada',
      'completed': 'Completada',
      'cancelada': 'Cancelada',
      'cancelled': 'Cancelada'
    }
    return texts[status] || status
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    )
  }

  if (!route) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">Ruta no encontrada</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Editar Ruta: {route.routeNumber}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', getStatusColor(route.status))}>
                {getStatusText(route.status)}
              </span>
              {route.scheduledDate && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {new Date(route.scheduledDate).toLocaleDateString('es-ES')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mensajes */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p className="text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </p>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
          >
            <p className="text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {success}
            </p>
          </motion.div>
        )}

        {/* Sección: Asignar Conductor */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-500" />
            Asignar Conductor
          </h2>

          {!canEditDriver ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                No se puede cambiar el conductor en una ruta con estado "{getStatusText(route.status)}".
                Solo se permite para rutas planificadas o asignadas.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Conductor
                </label>
                <select
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin asignar</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id.toString()}>
                      {getDriverFullName(driver)} {driver.phone ? `(${driver.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {route.driverName && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Conductor actual: <span className="font-medium">{route.driverName}</span>
                </p>
              )}

              <button
                onClick={handleSaveDriver}
                disabled={saving}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors',
                  saving
                    ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar Cambios
              </button>
            </>
          )}
        </div>

        {/* Sección: Órdenes en la Ruta */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-green-500" />
            Órdenes en esta Ruta ({route.stops.length})
          </h2>

          {route.stops.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No hay órdenes en esta ruta
            </p>
          ) : (
            <div className="space-y-3">
              {route.stops.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {order.orderNumber}
                        </span>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                          order.status === 'en_ruta' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                          order.status === 'en_reparto' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                        )}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Cliente: {order.customerName || order.senderName || 'N/A'}
                      </p>
                      {order.senderAddress && (
                        <p className="text-sm text-gray-500 dark:text-gray-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {order.senderAddress}
                        </p>
                      )}
                    </div>

                    {canReprogramOrders && (
                      <button
                        onClick={() => openReprogramModal(order)}
                        className="px-3 py-1.5 text-sm font-medium text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Reprogramar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal de Reprogramación */}
        {reprogramModal.open && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Reprogramar Orden
                </h3>
                <button
                  onClick={() => setReprogramModal({ open: false, orderId: null, orderNumber: '', isLastOrder: false })}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {reprogramModal.isLastOrder && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-yellow-700 dark:text-yellow-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Esta es la única orden. Al reprogramar, la ruta será eliminada.
                  </p>
                </div>
              )}

              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Orden: <span className="font-medium">{reprogramModal.orderNumber}</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Nueva Fecha
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Franja Horaria
                  </label>
                  <select
                    value={newTimeSlot}
                    onChange={(e) => setNewTimeSlot(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="morning">Mañana (8:00 - 12:00)</option>
                    <option value="afternoon">Tarde (12:00 - 16:00)</option>
                    <option value="evening">Noche (16:00 - 20:00)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setReprogramModal({ open: false, orderId: null, orderNumber: '', isLastOrder: false })}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReprogramOrder}
                  disabled={reprogramming || !newDate || !newTimeSlot}
                  className={cn(
                    'flex-1 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2',
                    reprogramming || !newDate || !newTimeSlot
                      ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                      : 'bg-orange-600 hover:bg-orange-700 text-white'
                  )}
                >
                  {reprogramming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Reprogramar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
