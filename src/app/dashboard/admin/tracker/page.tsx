'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Package,
  Phone,
  User,
  MapPin,
  Mail,
  Calendar,
  Clock,
  Truck,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Box,
  FileText,
  DollarSign,
  Hash,
  Building2,
  RefreshCw,
  AlertCircle,
  Loader2,
  PenLine,
  Camera,
  ExternalLink
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import LoadingBox from '@/components/ui/LoadingBox'

// Status configurations
const ORDER_STATUSES: Record<string, { color: string, bgColor: string, icon: any, label: string }> = {
  pending: { color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: Clock, label: 'Pendiente' },
  reprogrammed: { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: RefreshCw, label: 'Reprogramado' },
  picked_up: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: Package, label: 'Recogido' },
  in_transit: { color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: Truck, label: 'En Tránsito' },
  in_route: { color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30', icon: MapPin, label: 'En Ruta' },
  delivered: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle, label: 'Entregado' },
  completed: { color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', icon: CheckCircle2, label: 'Completado' },
  cancelled: { color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: XCircle, label: 'Cancelado' }
}

const EMPAQUE_STATUSES: Record<string, { color: string, bgColor: string, label: string }> = {
  disponible: { color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-900/30', label: 'Disponible' },
  asignado: { color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Asignado' },
  en_uso_cliente: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'En Uso' },
  en_transito: { color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'En Tránsito' },
  entregado: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', label: 'Entregado' },
  recogida: { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Recogida' },
  en_almacen: { color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', label: 'En Almacén' }
}

const ORDER_TYPES: Record<string, string> = {
  recogida: 'Recogida',
  oficina: 'Oficina',
  entrega_empaques: 'Entrega Empaques',
  retorno: 'Retorno'
}

const SEARCH_TYPES = [
  { id: 'auto', label: 'Auto', icon: Search },
  { id: 'order', label: 'Orden', icon: Hash },
  { id: 'phone', label: 'Teléfono', icon: Phone },
  { id: 'empaque', label: 'Empaque', icon: Box },
  { id: 'customer', label: 'Cliente', icon: User }
]

interface TrackerResult {
  order: any
  customer: any
  empaques: any[]
  timeline: any[]
  deliveryProof?: {
    id: number
    hasSignature: boolean
    signatureData?: string
    signerName?: string
    signerRelation?: string
    photos: Array<{ storagePath: string; signedUrl?: string; uploadedAt: string }>
    location?: { latitude?: number; longitude?: number }
    notes?: string
    createdAt: string
    createdByName?: string
  }
}

export default function TrackerPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState('auto')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TrackerResult | null>(null)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      showNotification('warning', 'Atención', 'Ingrese un término de búsqueda')
      return
    }

    setLoading(true)
    setSearched(true)

    try {
      const response = await fetch(`/api/tracker?q=${encodeURIComponent(searchQuery)}&type=${searchType}`)
      const data = await response.json()

      if (data.success) {
        setResult(data.data)
        if (!data.data) {
          showNotification('info', 'Sin resultados', 'No se encontraron registros para esta búsqueda')
        }
      } else {
        showNotification('error', 'Error', data.error || 'Error al buscar')
        setResult(null)
      }
    } catch (error) {
      console.error('Search error:', error)
      showNotification('error', 'Error', 'Error de conexión. Intente de nuevo.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatAddress = (order: any) => {
    const parts = []
    if (order.street) parts.push(order.street)
    if (order.apartment) parts.push(order.apartment)
    if (order.city) parts.push(order.city)
    if (order.state) parts.push(order.state)
    if (order.zipcode) parts.push(order.zipcode)
    if (order.country) parts.push(order.country)

    if (parts.length > 0) return parts.join(', ')
    return order.customerAddress || order.address || 'Sin dirección'
  }

  const parseServices = (services: any) => {
    if (!services) return []
    let parsed = services
    if (typeof services === 'string') {
      try {
        parsed = JSON.parse(services)
      } catch {
        return []
      }
    }
    if (!Array.isArray(parsed)) return []
    // Normalize: if items are strings, convert to objects
    return parsed.map((item: any) => {
      if (typeof item === 'string') {
        return { name: item, price: 0, quantity: 1 }
      }
      return item
    })
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className={cn(
                'p-3 rounded-xl',
                theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
              )}>
                <Search className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className={cn(
                'text-3xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Rastreador de Órdenes
              </h1>
            </div>
            <p className={cn(
              'text-sm',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              Herramienta para consulta rápida de órdenes y empaques
            </p>
          </motion.div>

          {/* Search Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'relative overflow-hidden rounded-2xl border shadow-xl p-6',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
            )}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600" />

            {/* Search Input */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className={cn(
                  'absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )} />
                <input
                  type="text"
                  placeholder="Buscar por número de orden, teléfono, código de empaque o nombre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className={cn(
                    'w-full h-14 pl-12 pr-4 rounded-xl border text-base transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                    theme === 'dark'
                      ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400'
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  )}
                />
              </div>

              <Button
                onClick={handleSearch}
                disabled={loading}
                className={cn(
                  'h-14 px-8 rounded-xl font-medium text-base',
                  'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
                  'text-white shadow-lg hover:shadow-xl transition-all'
                )}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Search className="w-5 h-5 mr-2" />
                )}
                Buscar
              </Button>
            </div>

            {/* Search Type Filters */}
            <div className="flex flex-wrap gap-2">
              <span className={cn(
                'text-sm font-medium mr-2 self-center',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Tipo:
              </span>
              {SEARCH_TYPES.map((type) => {
                const Icon = type.icon
                return (
                  <button
                    key={type.id}
                    onClick={() => setSearchType(type.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                      searchType === type.id
                        ? 'bg-blue-500 text-white shadow-md'
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {type.label}
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* Loading State */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center py-12"
              >
                <LoadingBox size="lg" text="Buscando orden..." />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {!loading && searched && result && result.order && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {/* Order Header Card */}
                <div className={cn(
                  'relative overflow-hidden rounded-2xl border shadow-xl',
                  theme === 'dark'
                    ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                    : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
                )}>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600" />

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Status Card */}
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <h3 className={cn(
                          'text-sm font-medium mb-3',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Estado Actual
                        </h3>

                        {(() => {
                          const status = ORDER_STATUSES[result.order.status] || ORDER_STATUSES.pending
                          const StatusIcon = status.icon
                          return (
                            <div className="flex items-center gap-3 mb-4">
                              <div className={cn('p-3 rounded-xl', status.bgColor)}>
                                <StatusIcon className={cn('w-6 h-6', status.color)} />
                              </div>
                              <span className={cn('text-xl font-bold', status.color)}>
                                {status.label}
                              </span>
                            </div>
                          )
                        })()}

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-gray-400" />
                            <span className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {result.order.orderNumber}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className={cn(
                              'text-sm',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Tipo: {ORDER_TYPES[result.order.orderType] || result.order.orderType}
                            </span>
                          </div>
                          {result.order.companyName && (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-400" />
                              <span className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {result.order.companyName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Customer Card */}
                      <div className={cn(
                        'p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <h3 className={cn(
                          'text-sm font-medium mb-3',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          Datos del Cliente
                        </h3>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-500" />
                            <span className={cn(
                              'text-base font-semibold',
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {result.order.customerName || `${result.order.firstName || ''} ${result.order.lastName || ''}`.trim() || 'Sin nombre'}
                            </span>
                          </div>
                          {result.order.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-green-500" />
                              <span className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {result.order.phone}
                              </span>
                            </div>
                          )}
                          {result.order.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-purple-500" />
                              <span className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {result.order.email}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <div className={cn(
                      'mt-4 p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                    )}>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className={cn(
                            'text-sm font-medium mb-1',
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Dirección
                          </h4>
                          <p className={cn(
                            'text-base',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {formatAddress(result.order)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Services and Total */}
                    {parseServices(result.order.services).length > 0 && (
                      <div className={cn(
                        'mt-4 p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-amber-500" />
                            <h4 className={cn(
                              'text-sm font-medium',
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            )}>
                              Servicios
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-500" />
                            <span className={cn(
                              'text-xl font-bold',
                              theme === 'dark' ? 'text-green-400' : 'text-green-600'
                            )}>
                              ${parseFloat(result.order.totalAmount || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {parseServices(result.order.services).map((service: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center">
                              <span className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {service.name} {service.quantity > 1 && `(${service.quantity})`}
                              </span>
                              <span className={cn(
                                'text-sm font-medium',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                ${parseFloat(service.price || 0).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Schedule Info */}
                    {(result.order.scheduledDate || result.order.timeSlot) && (
                      <div className={cn(
                        'mt-4 p-4 rounded-xl border',
                        theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            <span className={cn(
                              'text-sm',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              {result.order.scheduledDate
                                ? new Date(result.order.scheduledDate).toLocaleDateString('es-ES')
                                : '-'}
                            </span>
                          </div>
                          {result.order.timeSlot && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-purple-500" />
                              <span className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {result.order.timeSlot}
                              </span>
                            </div>
                          )}
                          {result.order.warehouseName && (
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-gray-500" />
                              <span className={cn(
                                'text-sm',
                                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {result.order.warehouseName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline Card */}
                {result.timeline && result.timeline.length > 0 && (
                  <div className={cn(
                    'relative overflow-hidden rounded-2xl border shadow-xl',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
                  )}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-violet-600" />

                    <div className="p-6">
                      <h3 className={cn(
                        'text-lg font-semibold mb-4 flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Clock className="w-5 h-5 text-purple-500" />
                        Historial de la Orden
                      </h3>

                      <div className="space-y-0">
                        {result.timeline.map((event: any, idx: number) => (
                          <div
                            key={idx}
                            className={cn(
                              'relative pl-6 pb-4',
                              idx !== result.timeline.length - 1 && 'border-l-2',
                              theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                            )}
                          >
                            <div className={cn(
                              'absolute left-0 top-0 w-3 h-3 rounded-full -translate-x-[7px]',
                              idx === 0
                                ? 'bg-blue-500 ring-4 ring-blue-500/20'
                                : theme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
                            )} />

                            <div className="ml-2">
                              <p className={cn(
                                'text-sm font-semibold capitalize',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {event.action}
                              </p>

                              <div className={cn(
                                'flex flex-wrap gap-3 mt-1 text-xs',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatDate(event.date)}
                                </span>
                                {event.user && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {event.user}
                                  </span>
                                )}
                                {event.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {event.location}
                                  </span>
                                )}
                              </div>

                              {event.notes && (
                                <p className={cn(
                                  'text-xs mt-1',
                                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                )}>
                                  {event.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Empaques Card */}
                {result.empaques && result.empaques.length > 0 && (
                  <div className={cn(
                    'relative overflow-hidden rounded-2xl border shadow-xl',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
                  )}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600" />

                    <div className="p-6">
                      <h3 className={cn(
                        'text-lg font-semibold mb-4 flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <Box className="w-5 h-5 text-amber-500" />
                        Empaques Asociados ({result.empaques.length})
                      </h3>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {result.empaques.map((emp: any, idx: number) => {
                          const status = EMPAQUE_STATUSES[emp.estado] || EMPAQUE_STATUSES.disponible
                          return (
                            <div
                              key={idx}
                              className={cn(
                                'p-3 rounded-xl border text-center',
                                theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                              )}
                            >
                              <p className={cn(
                                'text-sm font-bold mb-1',
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {emp.codigo}
                              </p>
                              <p className={cn(
                                'text-xs mb-2',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )}>
                                {emp.tamano || emp.tipo || 'Estándar'}
                              </p>
                              <span className={cn(
                                'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
                                status.bgColor,
                                status.color
                              )}>
                                {status.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Comprobante de Entrega Card */}
                {result.deliveryProof && (
                  <div className={cn(
                    'relative overflow-hidden rounded-2xl border shadow-xl',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-white to-gray-50 border-gray-200'
                  )}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600" />

                    <div className="p-6">
                      <h3 className={cn(
                        'text-lg font-semibold mb-4 flex items-center gap-2',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Comprobante de Entrega
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Firma */}
                        {result.deliveryProof.hasSignature && (
                          <div className={cn(
                            'p-4 rounded-xl border',
                            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                          )}>
                            <h4 className={cn(
                              'text-sm font-medium mb-3 flex items-center gap-2',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              <PenLine className="w-4 h-4 text-blue-500" />
                              Firma Electrónica
                            </h4>
                            {result.deliveryProof.signatureData && (
                              <div className="bg-white rounded-lg p-2 border border-gray-200">
                                <img
                                  src={result.deliveryProof.signatureData}
                                  alt="Firma"
                                  className="max-h-24 mx-auto"
                                />
                              </div>
                            )}
                            <div className="mt-2 text-sm">
                              <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                <span className="font-medium">Firmante:</span> {result.deliveryProof.signerName || 'No especificado'}
                              </p>
                              {result.deliveryProof.signerRelation && (
                                <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
                                  <span className="font-medium">Relación:</span> {result.deliveryProof.signerRelation === 'recipient' ? 'Destinatario' : result.deliveryProof.signerRelation === 'family' ? 'Familiar' : result.deliveryProof.signerRelation === 'neighbor' ? 'Vecino' : result.deliveryProof.signerRelation === 'guard' ? 'Guardia' : result.deliveryProof.signerRelation}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Fotos */}
                        {result.deliveryProof.photos && result.deliveryProof.photos.length > 0 && (
                          <div className={cn(
                            'p-4 rounded-xl border',
                            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                          )}>
                            <h4 className={cn(
                              'text-sm font-medium mb-3 flex items-center gap-2',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              <Camera className="w-4 h-4 text-purple-500" />
                              Fotos ({result.deliveryProof.photos.length})
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                              {result.deliveryProof.photos.slice(0, 4).map((photo, idx) => (
                                <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                                  {photo.signedUrl ? (
                                    <img
                                      src={photo.signedUrl}
                                      alt={`Foto ${idx + 1}`}
                                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(photo.signedUrl, '_blank')}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                      <Camera className="w-8 h-8" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Ubicación */}
                        {result.deliveryProof.location && (result.deliveryProof.location.latitude || result.deliveryProof.location.longitude) && (
                          <div className={cn(
                            'p-4 rounded-xl border',
                            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                          )}>
                            <h4 className={cn(
                              'text-sm font-medium mb-3 flex items-center gap-2',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              <MapPin className="w-4 h-4 text-red-500" />
                              Ubicación de Entrega
                            </h4>
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                'text-sm font-mono',
                                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                              )}>
                                {parseFloat(String(result.deliveryProof.location.latitude)).toFixed(6)}, {parseFloat(String(result.deliveryProof.location.longitude)).toFixed(6)}
                              </span>
                              <button
                                onClick={() => window.open(`https://www.google.com/maps?q=${result.deliveryProof?.location?.latitude},${result.deliveryProof?.location?.longitude}`, '_blank')}
                                className="flex items-center gap-1 text-blue-500 hover:text-blue-600 text-sm"
                              >
                                Ver mapa
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Notas */}
                        {result.deliveryProof.notes && (
                          <div className={cn(
                            'p-4 rounded-xl border',
                            theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                          )}>
                            <h4 className={cn(
                              'text-sm font-medium mb-2 flex items-center gap-2',
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              <FileText className="w-4 h-4 text-gray-500" />
                              Notas
                            </h4>
                            <p className={cn(
                              'text-sm',
                              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                            )}>
                              {result.deliveryProof.notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Metadatos */}
                      <div className={cn(
                        'mt-4 pt-4 border-t text-sm',
                        theme === 'dark' ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'
                      )}>
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(result.deliveryProof.createdAt)}
                          </span>
                          {result.deliveryProof.createdByName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {result.deliveryProof.createdByName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* No Results State */}
          <AnimatePresence>
            {!loading && searched && !result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'text-center py-16 rounded-2xl border',
                  theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}
              >
                <AlertCircle className={cn(
                  'w-16 h-16 mx-auto mb-4',
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )} />
                <h3 className={cn(
                  'text-xl font-semibold mb-2',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  No se encontraron resultados
                </h3>
                <p className={cn(
                  'text-sm max-w-md mx-auto',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Verifique el término de búsqueda e intente de nuevo. Puede buscar por número de orden, teléfono, código de empaque o nombre del cliente.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Initial State */}
          {!searched && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={cn(
                'text-center py-16 rounded-2xl border',
                theme === 'dark' ? 'bg-gray-800/30 border-gray-700' : 'bg-gray-50/50 border-gray-200'
              )}
            >
              <Search className={cn(
                'w-16 h-16 mx-auto mb-4',
                theme === 'dark' ? 'text-gray-600' : 'text-gray-300'
              )} />
              <h3 className={cn(
                'text-xl font-semibold mb-2',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Ingrese un término de búsqueda
              </h3>
              <p className={cn(
                'text-sm max-w-md mx-auto',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              )}>
                Puede buscar por número de orden (ORD-XXX), teléfono del cliente, código de empaque (EMP-XXX) o nombre del cliente.
              </p>
            </motion.div>
          )}

        </div>
      </div>
    </DashboardLayout>
  )
}
