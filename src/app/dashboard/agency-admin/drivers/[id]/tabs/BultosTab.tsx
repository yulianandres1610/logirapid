'use client'

import { useEffect, useState } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  PackageCheck,
  Search,
  MapPin,
  Package,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'

interface BultosTabProps {
  driver: any
}

interface Bulto {
  id: number
  codigo: string
  tipo: string
  estado: string
  packageSizeId: number | null
  packageSizeName: string | null
  orderNumber: string | null
  serviceName: string | null
  recipientName: string | null
  recipientCity: string | null
  recipientState: string | null
  weightLb: number | null
  weightKg: number | null
  boxNumber: number | null
  totalBoxes: number | null
  companyId: number | null
  companyName: string | null
  assignedAt: string | null
  createdAt: string
  updatedAt: string
}

export default function BultosTab({ driver }: BultosTabProps) {
  const { showNotification } = useNotifications()
  const { theme } = useTheme()
  const [bultos, setBultos] = useState<Bulto[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEstado, setFilterEstado] = useState('all')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalBultos, setTotalBultos] = useState(0)
  const BULTOS_PER_PAGE = 50

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterEstado, driver.id])

  // Fetch bultos when page or filters change
  useEffect(() => {
    fetchBultos()
  }, [currentPage, searchTerm, filterEstado, driver.id])

  const fetchBultos = async () => {
    try {
      setLoading(true)

      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: BULTOS_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(filterEstado && filterEstado !== 'all' && { estado: filterEstado })
      })

      const response = await fetch(`/api/drivers/${driver.id}/bultos?${params}`)

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setBultos(data.data || [])
          setTotalBultos(data.pagination?.total || 0)
        }
      }
    } catch (error) {
      console.error('Error fetching bultos:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los bultos')
    } finally {
      setLoading(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      recogida: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', label: 'Recogida' },
      en_almacen: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400', label: 'En Almacen' },
      en_transito: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', label: 'En Transito' },
      en_reparto: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400', label: 'En Reparto' },
      entregado: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', label: 'Entregado' }
    }

    const badge = badges[estado] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: estado }

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    )
  }

  // Calculate stats
  const stats = {
    total: bultos.length,
    enAlmacen: bultos.filter(b => b.estado === 'en_almacen').length,
    enTransito: bultos.filter(b => b.estado === 'en_transito' || b.estado === 'en_reparto').length,
    entregados: bultos.filter(b => b.estado === 'entregado').length
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Bultos */}
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
                  <p className="text-sm font-medium text-white/80">Total Bultos</p>
                  <p className="text-3xl font-bold mt-1 text-white">{stats.total}</p>
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

        {/* Card 2: En Almacen/Transito */}
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
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-orange-600"></div>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl shadow-sm',
                  theme === 'dark'
                    ? 'bg-yellow-900/30 border border-yellow-800/50'
                    : 'bg-gradient-to-br from-yellow-50 to-orange-100 border border-yellow-200'
                )}>
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-gray-400' : 'text-black'
                  )}>En Movimiento</p>
                  <p className={cn(
                    'text-3xl font-bold mt-1',
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  )}>{stats.enAlmacen + stats.enTransito}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className={cn(
                  'text-xs font-medium',
                  theme === 'dark' ? 'text-gray-500' : 'text-black'
                )}>Almacen + Transito</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Entregados */}
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
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'p-3 rounded-xl shadow-sm',
                  theme === 'dark'
                    ? 'bg-green-900/30 border border-green-800/50'
                    : 'bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200'
                )}>
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-gray-400' : 'text-black'
                  )}>Entregados</p>
                  <p className={cn(
                    'text-3xl font-bold mt-1',
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  )}>{stats.entregados}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className={cn(
                  'text-xs font-medium',
                  theme === 'dark' ? 'text-gray-500' : 'text-black'
                )}>Completados</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por codigo, orden o destinatario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Estado Filter */}
          <div className="w-full md:w-48">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="recogida">Recogida</option>
              <option value="en_almacen">En Almacen</option>
              <option value="en_transito">En Transito</option>
              <option value="en_reparto">En Reparto</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bultos Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : bultos.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <PackageCheck className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No hay bultos asignados
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || filterEstado !== 'all'
              ? 'No se encontraron resultados con los filtros aplicados'
              : 'Este driver no tiene bultos asignados'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Codigo
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
                {bultos.map((bulto) => (
                  <tr
                    key={bulto.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">
                        {bulto.codigo}
                      </span>
                      {bulto.boxNumber && bulto.totalBoxes && (
                        <span className="ml-2 text-xs text-gray-500">
                          ({bulto.boxNumber}/{bulto.totalBoxes})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {bulto.orderNumber || '-'}
                      </div>
                      {bulto.serviceName && (
                        <div className="text-xs text-gray-500 dark:text-gray-500">
                          {bulto.serviceName}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {bulto.recipientName || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center max-w-xs">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span className="truncate">
                          {bulto.recipientCity && bulto.recipientState
                            ? `${bulto.recipientCity}, ${bulto.recipientState}`
                            : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {bulto.weightLb
                        ? `${bulto.weightLb} lb`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getEstadoBadge(bulto.estado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalBultos > BULTOS_PER_PAGE && (
            <div className={cn(
              'p-4 border-t',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Mostrando {((currentPage - 1) * BULTOS_PER_PAGE) + 1} a{' '}
                  {Math.min(currentPage * BULTOS_PER_PAGE, totalBultos)} de {totalBultos} bultos
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
                    {Array.from({ length: Math.min(5, Math.ceil(totalBultos / BULTOS_PER_PAGE)) }, (_, i) => {
                      const totalPages = Math.ceil(totalBultos / BULTOS_PER_PAGE)
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
                    disabled={currentPage >= Math.ceil(totalBultos / BULTOS_PER_PAGE)}
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
    </div>
  )
}
