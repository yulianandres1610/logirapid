'use client'

import { useEffect, useState } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  PackageCheck,
  Search,
  MapPin,
  Calendar,
  Package,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  X,
  History
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'

interface BultosTabProps {
  warehouse: any
}

interface Empaque {
  id: number
  codigo: string
  order_number: string | null
  recipient_name: string | null
  recipient_city: string | null
  recipient_state: string | null
  weight_lb: number | null
  weight_kg: number | null
  estado: string
  box_number: number | null
  total_boxes: number | null
  service_name: string | null
  created_at: string
}

interface TrazabilidadEvent {
  id: number
  accion: string
  fecha: string
  warehouse_name?: string
  warehouse_id?: number
  usuario_nombre?: string
  usuario_id?: number
  notas?: string
  orden_numero?: string
  servicio_nombre?: string
  ubicacion?: string
}

export default function BultosTab({ warehouse }: BultosTabProps) {
  const { showNotification } = useNotifications()
  const { theme } = useTheme()
  const [empaques, setEmpaques] = useState<Empaque[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEmpaqueId, setSelectedEmpaqueId] = useState<number | null>(null)
  const [empaqueDetails, setEmpaqueDetails] = useState<Empaque | null>(null)
  const [trazabilidad, setTrazabilidad] = useState<TrazabilidadEvent[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalEmpaques, setTotalEmpaques] = useState(0)
  const EMPAQUES_PER_PAGE = 50

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, warehouse.id])

  // Fetch empaques when page or filters change
  useEffect(() => {
    fetchEmpaques()
  }, [currentPage, searchTerm, warehouse.id])

  const fetchEmpaques = async () => {
    try {
      setLoading(true)

      // Build query parameters
      const params = new URLSearchParams({
        warehouseId: warehouse.id.toString(),
        estado: 'en_almacen', // Solo mostrar bultos que ya fueron recibidos en el almacén
        page: currentPage.toString(),
        limit: EMPAQUES_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/empaques?${params}`)

      if (response.ok) {
        const data = await response.json()
        setEmpaques(data.empaques || data.data || [])
        setTotalEmpaques(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Error fetching empaques:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los empaques')
    } finally {
      setLoading(false)
    }
  }

  const fetchEmpaqueDetails = async (empaqueId: number) => {
    try {
      setLoadingDetails(true)
      setSelectedEmpaqueId(empaqueId)

      // Fetch empaque details with trazabilidad
      const response = await fetch(`/api/empaques/${empaqueId}?trazabilidad=true`)
      const data = await response.json()

      if (data.success) {
        // Find empaque in current list for full details
        const empaque = empaques.find(e => e.id === empaqueId)
        if (empaque) {
          setEmpaqueDetails(empaque)
        }
        setTrazabilidad(data.trazabilidad || [])
      } else {
        showNotification('error', 'Error', 'No se pudieron cargar los detalles del empaque')
      }
    } catch (error) {
      console.error('Error fetching empaque details:', error)
      showNotification('error', 'Error', 'Ocurrió un error al cargar los detalles')
    } finally {
      setLoadingDetails(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      disponible: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: 'Disponible' },
      recogida: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', label: 'Recogida' },
      en_almacen: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400', label: 'En Almacén' },
      enviado: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'Enviado' },
      recibido_destino: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-400', label: 'Recibido Destino' },
      en_reparto: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400', label: 'En Reparto' },
      entregado: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', label: 'Entregado' }
    }

    const badge = badges[estado] || badges.disponible

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Empaques en Almacén
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {totalEmpaques} empaque{totalEmpaques !== 1 ? 's' : ''} en total en {warehouse.name}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Empaques */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden group bg-[#0374e5] rounded-2xl border border-[#0374e5] shadow-xl"
        >
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity"></div>
          <div className="p-6 relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl shadow-sm bg-white/20 border border-white/30">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">Total Empaques</p>
                  <p className="text-3xl font-bold mt-1 text-white">{empaques.length}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-white/80">En inventario</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 2: En Almacén */}
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
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600"></div>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl shadow-sm',
                  theme === 'dark'
                    ? 'bg-purple-900/30 border border-purple-800/50'
                    : 'bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200'
                )}>
                  <AlertCircle className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-gray-400' : 'text-black'
                  )}>En Almacén</p>
                  <p className={cn(
                    'text-3xl font-bold mt-1',
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  )}>{empaques.filter(e => e.estado === 'en_almacen').length}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span className={cn(
                  'text-xs font-medium',
                  theme === 'dark' ? 'text-gray-500' : 'text-black'
                )}>Almacenados</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Enviados */}
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
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-yellow-600"></div>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl shadow-sm',
                  theme === 'dark'
                    ? 'bg-amber-900/30 border border-amber-800/50'
                    : 'bg-gradient-to-br from-amber-50 to-yellow-100 border border-amber-200'
                )}>
                  <CheckCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-gray-400' : 'text-black'
                  )}>Enviados</p>
                  <p className={cn(
                    'text-3xl font-bold mt-1',
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  )}>{empaques.filter(e => e.estado === 'enviado').length}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                <span className={cn(
                  'text-xs font-medium',
                  theme === 'dark' ? 'text-gray-500' : 'text-black'
                )}>En tránsito</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por código, orden o destinatario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Empaques Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : empaques.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <PackageCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No hay empaques en este almacén
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm ? 'No se encontraron resultados para tu búsqueda' : 'Los empaques aparecerán aquí cuando se creen órdenes en este almacén'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Orden
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Destinatario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Destino
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Peso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {empaques.map((empaque) => (
                  <tr
                    key={empaque.id}
                    onClick={() => fetchEmpaqueDetails(empaque.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                        {empaque.codigo}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {empaque.order_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {empaque.recipient_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center max-w-xs">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span className="truncate">
                          {empaque.recipient_city && empaque.recipient_state
                            ? `${empaque.recipient_city}, ${empaque.recipient_state}`
                            : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {empaque.weight_lb
                        ? `${empaque.weight_lb} lb (${empaque.weight_kg} kg)`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getEstadoBadge(empaque.estado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalEmpaques > EMPAQUES_PER_PAGE && (
            <div className={cn(
              'mt-6 p-4 rounded-xl border',
              theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
            )}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando {((currentPage - 1) * EMPAQUES_PER_PAGE) + 1} a{' '}
                  {Math.min(currentPage * EMPAQUES_PER_PAGE, totalEmpaques)} de {totalEmpaques} empaques
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
                    {Array.from({ length: Math.min(5, Math.ceil(totalEmpaques / EMPAQUES_PER_PAGE)) }, (_, i) => {
                      const totalPages = Math.ceil(totalEmpaques / EMPAQUES_PER_PAGE)
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
                    disabled={currentPage >= Math.ceil(totalEmpaques / EMPAQUES_PER_PAGE)}
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
      )}

      {/* Empaque Detail Modal */}
      {selectedEmpaqueId && empaqueDetails && (
        <EmpaqueDetailModal
          empaque={empaqueDetails}
          trazabilidad={trazabilidad}
          loading={loadingDetails}
          onClose={() => {
            setSelectedEmpaqueId(null)
            setEmpaqueDetails(null)
            setTrazabilidad([])
          }}
        />
      )}
    </div>
  )
}

function EmpaqueDetailModal({
  empaque,
  trazabilidad,
  loading,
  onClose
}: {
  empaque: Empaque
  trazabilidad: TrazabilidadEvent[]
  loading: boolean
  onClose: () => void
}) {
  const { theme } = useTheme()

  const getAccionColor = (accion: string) => {
    const action = accion.toLowerCase()
    if (action.includes('creado') || action.includes('disponible')) {
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
    }
    if (action.includes('asignado')) {
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
    }
    if (action.includes('recog')) {
      return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400'
    }
    if (action.includes('almacen')) {
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
    }
    if (action.includes('transito') || action.includes('enviado')) {
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
    }
    if (action.includes('reparto')) {
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'
    }
    if (action.includes('entregado')) {
      return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
    }
    return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      disponible: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: 'Disponible' },
      recogida: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', label: 'Recogida' },
      en_almacen: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400', label: 'En Almacén' },
      enviado: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'Enviado' },
      recibido_destino: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-400', label: 'Recibido Destino' },
      en_reparto: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400', label: 'En Reparto' },
      entregado: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', label: 'Entregado' }
    }

    const badge = badges[estado] || badges.disponible

    return (
      <span className={`px-3 py-1 text-sm font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={cn(
        'rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl',
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      )}>
        {/* Header */}
        <div className={cn(
          'px-6 py-4 border-b flex items-center justify-between',
          theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
        )}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
              <History className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className={cn(
                'text-xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Detalles del Empaque
              </h3>
              <p className="text-sm font-mono text-gray-500 dark:text-gray-400">
                {empaque.codigo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-lg transition-colors',
              theme === 'dark'
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <>
              {/* Empaque Details Section */}
              <div className={cn(
                'rounded-xl border p-6',
                theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
              )}>
                <h4 className={cn(
                  'text-lg font-bold mb-4 flex items-center gap-2',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Package className="w-5 h-5" />
                  Información del Empaque
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Código</p>
                    <p className={cn(
                      'font-mono font-semibold text-lg',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {empaque.codigo}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Estado</p>
                    {getEstadoBadge(empaque.estado)}
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Número de Orden</p>
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {empaque.order_number || '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Servicio</p>
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {empaque.service_name || '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Destinatario</p>
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {empaque.recipient_name || '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Destino</p>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {empaque.recipient_city && empaque.recipient_state
                          ? `${empaque.recipient_city}, ${empaque.recipient_state}`
                          : '-'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Peso</p>
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {empaque.weight_lb
                        ? `${empaque.weight_lb} lb (${empaque.weight_kg} kg)`
                        : '-'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Caja</p>
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {empaque.box_number && empaque.total_boxes
                        ? `${empaque.box_number} de ${empaque.total_boxes}`
                        : '-'}
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Fecha de Creación</p>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <p className={cn(
                        'font-medium',
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {formatDate(empaque.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trazabilidad Timeline Section */}
              <div className={cn(
                'rounded-xl border p-6',
                theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
              )}>
                <h4 className={cn(
                  'text-lg font-bold mb-4 flex items-center gap-2',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  <Clock className="w-5 h-5" />
                  Historial de Trazabilidad ({trazabilidad.length} eventos)
                </h4>

                {trazabilidad.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No hay eventos de trazabilidad registrados
                  </p>
                ) : (
                  <div className="space-y-4">
                    {trazabilidad.map((evento, index) => (
                      <div key={evento.id} className="relative">
                        {/* Timeline connector */}
                        {index !== trazabilidad.length - 1 && (
                          <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600" />
                        )}

                        <div className="flex gap-4">
                          {/* Icon */}
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center relative z-10">
                            <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          </div>

                          {/* Content */}
                          <div className={cn(
                            'flex-1 rounded-lg border p-4',
                            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                          )}>
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getAccionColor(evento.accion)}`}>
                                {evento.accion.replace(/_/g, ' ').toUpperCase()}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {formatDate(evento.fecha)}
                              </span>
                            </div>

                            <div className="space-y-2 text-sm">
                              {evento.warehouse_name && (
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <MapPin className="w-4 h-4" />
                                  <span>{evento.warehouse_name}</span>
                                </div>
                              )}

                              {evento.usuario_nombre && (
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                  <User className="w-4 h-4" />
                                  <span>{evento.usuario_nombre}</span>
                                </div>
                              )}

                              {evento.orden_numero && (
                                <div className="text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Orden:</span> {evento.orden_numero}
                                </div>
                              )}

                              {evento.servicio_nombre && (
                                <div className="text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">Servicio:</span> {evento.servicio_nombre}
                                </div>
                              )}

                              {evento.notas && (
                                <div className={cn(
                                  'mt-2 p-2 rounded border-l-2 border-purple-500',
                                  theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                                )}>
                                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                                    {evento.notas}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
