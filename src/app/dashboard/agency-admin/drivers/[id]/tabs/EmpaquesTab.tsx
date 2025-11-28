'use client'

import { useEffect, useState } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  Search,
  Box,
  Calendar,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Building2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'

interface EmpaquesTabProps {
  driver: any
}

interface Empaque {
  id: number
  codigo: string
  tipo: string
  estado: string
  packageSizeId: number | null
  packageSizeName: string | null
  dimensions: string | null
  companyId: number | null
  companyName: string | null
  orderNumber: string | null
  serviceName: string | null
  recipientName: string | null
  recipientCity: string | null
  recipientState: string | null
  assignedAt: string | null
  createdAt: string
  updatedAt: string
}

export default function EmpaquesTab({ driver }: EmpaquesTabProps) {
  const { showNotification } = useNotifications()
  const { theme } = useTheme()
  const [empaques, setEmpaques] = useState<Empaque[]>([])
  const [packageSizes, setPackageSizes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEstado, setFilterEstado] = useState('all')
  const [filterTamano, setFilterTamano] = useState('all')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalEmpaques, setTotalEmpaques] = useState(0)
  const EMPAQUES_PER_PAGE = 50

  useEffect(() => {
    fetchPackageSizes()
  }, [])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterEstado, filterTamano, driver.id])

  // Fetch empaques when page or filters change
  useEffect(() => {
    fetchEmpaques()
  }, [currentPage, searchTerm, filterEstado, filterTamano, driver.id])

  const fetchPackageSizes = async () => {
    try {
      const response = await fetch('/api/package-sizes')
      if (response.ok) {
        const data = await response.json()
        setPackageSizes(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching package sizes:', error)
    }
  }

  const fetchEmpaques = async () => {
    try {
      setLoading(true)

      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: EMPAQUES_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(filterEstado && filterEstado !== 'all' && { estado: filterEstado }),
        ...(filterTamano && filterTamano !== 'all' && { tamano: filterTamano })
      })

      const response = await fetch(`/api/drivers/${driver.id}/empaques?${params}`)

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setEmpaques(data.data || [])
          setTotalEmpaques(data.pagination?.total || 0)
        }
      }
    } catch (error) {
      console.error('Error fetching empaques:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los empaques')
    } finally {
      setLoading(false)
    }
  }

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      disponible: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300' },
      en_uso: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400' },
      en_transito: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400' },
      en_almacen: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400' },
      danado: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400' },
      perdido: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-400' }
    }

    const badge = badges[estado] || badges.disponible

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {estado.replace(/_/g, ' ')}
      </span>
    )
  }

  // Calculate stats
  const stats = {
    total: empaques.length,
    disponibles: empaques.filter(e => e.estado === 'disponible').length,
    enUso: empaques.filter(e => e.estado === 'en_uso' || e.estado === 'en_transito' || e.estado === 'en_almacen').length,
    problemas: empaques.filter(e => e.estado === 'danado' || e.estado === 'perdido').length
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Cajas */}
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
                  <Box className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">Total Cajas</p>
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

        {/* Card 2: En Uso/Transito */}
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
                  )}>{stats.enUso}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className={cn(
                  'text-xs font-medium',
                  theme === 'dark' ? 'text-gray-500' : 'text-black'
                )}>En uso + Transito</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Disponibles */}
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
                  )}>Disponibles</p>
                  <p className={cn(
                    'text-3xl font-bold mt-1',
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  )}>{stats.disponibles}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className={cn(
                  'text-xs font-medium',
                  theme === 'dark' ? 'text-gray-500' : 'text-black'
                )}>Listas para usar</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Search Bar and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por codigo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Estado Filter */}
          <div className="w-full md:w-48">
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="disponible">Disponible</option>
              <option value="en_uso">En uso</option>
              <option value="en_transito">En transito</option>
              <option value="danado">Danado</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>

          {/* Tamano Filter */}
          <div className="w-full md:w-48">
            <select
              value={filterTamano}
              onChange={(e) => setFilterTamano(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los tamanos</option>
              {packageSizes.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filters summary */}
        {(filterEstado !== 'all' || filterTamano !== 'all' || searchTerm) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">Filtros activos:</span>
            {searchTerm && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                Busqueda: {searchTerm}
              </span>
            )}
            {filterEstado !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Estado: {filterEstado}
              </span>
            )}
            {filterTamano !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                Tamano: {packageSizes.find(s => s.id === parseInt(filterTamano))?.name}
              </span>
            )}
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterEstado('all')
                setFilterTamano('all')
              }}
              className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Empaques Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : empaques.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Box className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No hay cajas vacias asignadas
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {searchTerm || filterEstado !== 'all' || filterTamano !== 'all'
              ? 'No se encontraron resultados con los filtros aplicados'
              : 'Este driver no tiene cajas vacias asignadas'}
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
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tamano
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Asignado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {empaques.map((empaque) => (
                  <tr key={empaque.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <QrCode className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {empaque.codigo}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {empaque.tipo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {empaque.companyName || 'Sin empresa'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 inline-block w-fit">
                          {empaque.packageSizeName || 'N/A'}
                        </span>
                        {empaque.dimensions && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {empaque.dimensions}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getEstadoBadge(empaque.estado)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {empaque.assignedAt ? new Date(empaque.assignedAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        }) : 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalEmpaques > EMPAQUES_PER_PAGE && (
            <div className={cn(
              'p-4 border-t',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
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
    </div>
  )
}
