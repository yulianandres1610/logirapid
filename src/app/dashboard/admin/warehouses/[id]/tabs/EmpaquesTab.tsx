'use client'

import { useEffect, useState } from 'react'
import { useNotifications } from '@/contexts/NotificationContext'
import { useAuth } from '@/hooks/useAuth'
import {
  Package,
  Plus,
  ScanLine,
  Printer,
  Search,
  Box,
  Calendar,
  User,
  MoreVertical,
  Trash2,
  QrCode,
  History,
  MapPin,
  Clock,
  ChevronLeft,
  ChevronRight,
  Building2
} from 'lucide-react'
import CreateCajasModal from './CreateCajasModal'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'
import { generateEmpaqueLabel } from '@/components/EmpaqueLabel'

interface EmpaquesTabProps {
  warehouse: any
}

interface Empaque {
  id: number
  codigo: string
  package_size_id: number
  package_size_name?: string
  package_size_dimensions?: string
  tipo: string
  estado: string
  clienteId: number | null
  ordenId: number | null
  warehouseId: number
  warehouseName: string
  fechaAsignacion: string | null
  descripcion: string | null
  created_at: string
  company_id?: number
  company_name?: string
}

interface TrazabilidadRecord {
  id: number
  empaque_id: number
  accion: string
  ubicacion: string
  warehouse_id: number | null
  warehouse_name: string | null
  usuario_id: number | null
  usuario_nombre: string | null
  notas: string | null
  fecha: string
}

export default function EmpaquesTab({ warehouse }: EmpaquesTabProps) {
  const { showNotification } = useNotifications()
  const { theme } = useTheme()
  const { user } = useAuth()
  const [empaques, setEmpaques] = useState<Empaque[]>([])
  const [packageSizes, setPackageSizes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterEstado, setFilterEstado] = useState('todos')
  const [filterTamano, setFilterTamano] = useState('todos')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTrazabilidadModal, setShowTrazabilidadModal] = useState(false)
  const [selectedEmpaqueForHistory, setSelectedEmpaqueForHistory] = useState<Empaque | null>(null)

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
  }, [searchTerm, filterEstado, filterTamano, warehouse.id])

  // Fetch empaques when page or filters change
  useEffect(() => {
    fetchEmpaques()
  }, [currentPage, searchTerm, filterEstado, filterTamano, warehouse.id])

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
        warehouseId: warehouse.id.toString(),
        page: currentPage.toString(),
        limit: EMPAQUES_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(filterEstado && filterEstado !== 'todos' && { estado: filterEstado }),
        ...(filterTamano && filterTamano !== 'todos' && { packageSizeId: filterTamano })
      })

      const response = await fetch(`/api/empaques?${params}`)

      if (response.ok) {
        const data = await response.json()
        setEmpaques(data.empaques || [])
        setTotalEmpaques(data.pagination?.total || 0)
      }
    } catch (error) {
      console.error('Error fetching empaques:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los empaques')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEmpaque = async (empaqueId: number) => {
    if (!confirm('¿Estás seguro de eliminar este empaque?')) return

    try {
      const response = await fetch(`/api/empaques/${empaqueId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showNotification('success', 'Empaque Eliminado', 'El empaque ha sido eliminado exitosamente')
        fetchEmpaques()
      } else {
        showNotification('error', 'Error', 'No se pudo eliminar el empaque')
      }
    } catch (error) {
      console.error('Error deleting empaque:', error)
      showNotification('error', 'Error', 'Ocurrió un error al eliminar el empaque')
    }
  }

  const handlePrintLabel = async (empaque: Empaque) => {
    try {
      // Fetch authenticated company data with logo
      // Convertir 'company-1' a '1' si es necesario
      let companyId = user?.companyId || '1'
      if (companyId.startsWith('company-')) {
        companyId = companyId.replace('company-', '')
      }

      console.log('🏢 [EmpaqueLabel] Fetching company data for ID:', companyId)
      const companyResponse = await fetch(`/api/companies/${companyId}`)
      let company = {
        legalName: 'LogiRapid',
        logo: '',
        logoUrl: '',
        primary_color: '#8B5CF6',
        phone: '',
        customerServicePhone: '6452432403',
        website: ''
      }

      if (companyResponse.ok) {
        const companyData = await companyResponse.json()
        console.log('🏢 [EmpaqueLabel] Company data received:', companyData.data)
        console.log('🖼️ [EmpaqueLabel] Logo URL:', companyData.data?.logoUrl)

        company = {
          legalName: companyData.data?.legalName || 'LogiRapid',
          logo: companyData.data?.logoUrl || companyData.data?.logo_url || '',
          logoUrl: companyData.data?.logoUrl || companyData.data?.logo_url || '',
          primary_color: companyData.data?.primaryColor || companyData.data?.primary_color || '#8B5CF6',
          phone: companyData.data?.phone || company.phone,
          customerServicePhone: companyData.data?.customerServicePhone || companyData.data?.customer_service_phone || company.customerServicePhone,
          website: companyData.data?.website || ''
        }

        console.log('🏢 [EmpaqueLabel] Company object for label:', company)
      } else {
        console.error('❌ [EmpaqueLabel] Failed to fetch company:', companyResponse.status)
      }

      // Obtener trazabilidad para encontrar el almacén de creación
      const trazabilidadResponse = await fetch(`/api/empaques/${empaque.id}?trazabilidad=true`)
      let creationWarehouseId = empaque.warehouseId || warehouse.id // Fallback al warehouse actual

      if (trazabilidadResponse.ok) {
        const trazabilidadData = await trazabilidadResponse.json()
        const creationRecord = trazabilidadData.trazabilidad?.find((t: any) => t.accion === 'creado')
        if (creationRecord?.warehouse_id) {
          creationWarehouseId = creationRecord.warehouse_id
        }
      }

      // Obtener datos del almacén de CREACIÓN (donde se creó originalmente)
      const warehouseCreacionResponse = await fetch(`/api/warehouses/${creationWarehouseId}`)
      if (!warehouseCreacionResponse.ok) {
        showNotification('error', 'Error', 'No se pudo obtener información del almacén de creación')
        return
      }
      const warehouseCreacionData = await warehouseCreacionResponse.json()
      const warehouseCreacion = {
        id: warehouseCreacionData.id,
        name: warehouseCreacionData.name,
        code: warehouseCreacionData.code,
        city: warehouseCreacionData.city,
        address: warehouseCreacionData.address
      }

      // Obtener datos del almacén de IMPRESIÓN (donde está actualmente)
      const currentWarehouseId = empaque.warehouseId || warehouse.id
      const warehouseImpresionResponse = await fetch(`/api/warehouses/${currentWarehouseId}`)
      if (!warehouseImpresionResponse.ok) {
        showNotification('error', 'Error', 'No se pudo obtener información del almacén actual')
        return
      }
      const warehouseImpresionData = await warehouseImpresionResponse.json()
      const warehouseImpresion = {
        id: warehouseImpresionData.id,
        name: warehouseImpresionData.name,
        code: warehouseImpresionData.code,
        city: warehouseImpresionData.city,
        address: warehouseImpresionData.address
      }

      // Generate label HTML using the new template
      const labelHTML = generateEmpaqueLabel({
        empaque: {
          id: empaque.id,
          codigo: empaque.codigo,
          warehouse_id: warehouse.id,
          warehouse_name: warehouse.name,
          created_at: empaque.created_at,
          package_size_name: empaque.package_size_name,
          estado: empaque.estado
        },
        warehouseCreacion,
        warehouseImpresion,
        company,
        fechaImpresion: new Date()
      })

      // Open print window
      const printWindow = window.open('', '_blank', 'width=600,height=800')

      if (!printWindow) {
        showNotification('error', 'Error', 'No se pudo abrir la ventana de impresión. Verifica los bloqueadores de ventanas emergentes.')
        return
      }

      printWindow.document.write(labelHTML)
      printWindow.document.close()

      showNotification('success', 'Listo', `Etiqueta generada para ${empaque.codigo}`)
    } catch (error) {
      console.error('Error generating label:', error)
      showNotification('error', 'Error', 'No se pudo generar la etiqueta')
    }
  }

  const handleViewHistory = (empaque: Empaque) => {
    setSelectedEmpaqueForHistory(empaque)
    setShowTrazabilidadModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Cajas Vacías
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {totalEmpaques} caja{totalEmpaques !== 1 ? 's' : ''} en total en {warehouse.name}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Crear Cajas
          </button>
        </div>
      </div>

      {/* Search Bar and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input - Más compacto */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por código..."
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
              <option value="todos">Todos los estados</option>
              <option value="disponible">Disponible</option>
              <option value="en_uso">En uso</option>
              <option value="en_transito">En tránsito</option>
              <option value="dañado">Dañado</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>

          {/* Tamaño Filter */}
          <div className="w-full md:w-48">
            <select
              value={filterTamano}
              onChange={(e) => setFilterTamano(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos los tamaños</option>
              {packageSizes.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filters summary */}
        {(filterEstado !== 'todos' || filterTamano !== 'todos' || searchTerm) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">Filtros activos:</span>
            {searchTerm && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                Búsqueda: {searchTerm}
              </span>
            )}
            {filterEstado !== 'todos' && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Estado: {filterEstado}
              </span>
            )}
            {filterTamano !== 'todos' && (
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                Tamaño: {packageSizes.find(s => s.id === parseInt(filterTamano))?.name}
              </span>
            )}
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterEstado('todos')
                setFilterTamano('todos')
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
            No hay empaques disponibles
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm ? 'No se encontraron resultados para tu búsqueda' : 'Comienza creando un nuevo empaque'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Crear Primer Empaque
          </button>
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
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tamaño
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fecha Creación
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acciones
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
                          {empaque.company_name || 'Sin empresa'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 inline-block w-fit">
                          {empaque.package_size_name || 'N/A'}
                        </span>
                        {empaque.package_size_dimensions && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {empaque.package_size_dimensions}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {empaque.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {empaque.created_at ? new Date(empaque.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      }) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewHistory(empaque)}
                          className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                          title="Ver historial de trazabilidad"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handlePrintLabel(empaque)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Imprimir etiqueta"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmpaque(empaque.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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

      {/* Trazabilidad Modal */}
      {showTrazabilidadModal && selectedEmpaqueForHistory && (
        <TrazabilidadModal
          empaque={selectedEmpaqueForHistory}
          onClose={() => {
            setShowTrazabilidadModal(false)
            setSelectedEmpaqueForHistory(null)
          }}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCajasModal
          warehouse={warehouse}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchEmpaques()
            setShowCreateModal(false)
          }}
        />
      )}
    </div>
  )
}

// Trazabilidad Modal Component
function TrazabilidadModal({ empaque, onClose }: { empaque: Empaque; onClose: () => void }) {
  const { showNotification } = useNotifications()
  const [trazabilidad, setTrazabilidad] = useState<TrazabilidadRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTrazabilidad()
  }, [empaque.id])

  const fetchTrazabilidad = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/empaques/${empaque.id}?trazabilidad=true`)

      if (response.ok) {
        const data = await response.json()
        setTrazabilidad(data.trazabilidad || [])
      } else {
        showNotification('error', 'Error', 'No se pudo cargar el historial de trazabilidad')
      }
    } catch (error) {
      console.error('Error fetching trazabilidad:', error)
      showNotification('error', 'Error', 'Ocurrió un error al cargar el historial')
    } finally {
      setLoading(false)
    }
  }

  const getAccionColor = (accion: string) => {
    const accionLower = accion.toLowerCase()
    if (accionLower.includes('creado')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    if (accionLower.includes('asignado')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    if (accionLower.includes('transito')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    if (accionLower.includes('entregado')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
    if (accionLower.includes('recogido')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <History className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Historial de Trazabilidad
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Código: <span className="font-semibold">{empaque.codigo}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : trazabilidad.length === 0 ? (
            <div className="text-center py-12">
              <History className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Sin historial
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No hay registros de trazabilidad para este empaque
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Timeline */}
              <div className="relative">
                {trazabilidad.map((record, index) => (
                  <div key={record.id} className="relative pb-8 last:pb-0">
                    {/* Timeline line */}
                    {index < trazabilidad.length - 1 && (
                      <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                    )}

                    {/* Timeline item */}
                    <div className="relative flex items-start gap-4">
                      {/* Timeline dot */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getAccionColor(record.accion)}`}>
                                {record.accion}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(record.fecha).toLocaleString('es-ES', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            {record.ubicacion && (
                              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <MapPin className="h-4 w-4" />
                                <span>{record.ubicacion}</span>
                              </div>
                            )}

                            {record.warehouse_name && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <span className="font-medium">Almacén:</span> {record.warehouse_name}
                              </div>
                            )}

                            {record.usuario_nombre && (
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <span className="font-medium">Usuario:</span> {record.usuario_nombre}
                              </div>
                            )}

                            {record.notas && (
                              <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                                <p className="font-medium mb-1">Notas:</p>
                                <p>{record.notas}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
