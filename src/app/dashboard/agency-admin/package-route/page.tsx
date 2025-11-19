'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Package,
  Plus,
  Search,
  QrCode,
  Printer,
  Trash2,
  ChevronLeft,
  ChevronRight,
  History,
  X,
  CheckSquare,
  Square,
  Warehouse as WarehouseIcon
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import CreateCajasModalGlobal from './CreateCajasModalGlobal'
import { generateEmpaqueLabel } from '@/components/EmpaqueLabel'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'
export const fetchCache = 'force-no-store'

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
  warehouse_id: number
  warehouse_name: string
  fechaAsignacion: string | null
  descripcion: string | null
  created_at: string
}

interface Warehouse {
  id: number
  name: string
  code: string
  city: string
  cajas_vacias_count: number
  cajas_vacias_capacity: number
}

interface PackageSize {
  id: number
  name: string
  dimensions: string
  weight: number
  price: number
}

export default function PackageRoutePage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { showNotification } = useNotifications()

  // Estados principales
  const [empaques, setEmpaques] = useState<Empaque[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [packageSizes, setPackageSizes] = useState<PackageSize[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingWarehouses, setLoadingWarehouses] = useState(true)

  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAlmacen, setFilterAlmacen] = useState('todos')
  const [filterTamano, setFilterTamano] = useState('todos')
  const [filterEstado, setFilterEstado] = useState('todos')

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [totalEmpaques, setTotalEmpaques] = useState(0)
  const EMPAQUES_PER_PAGE = 50

  // Estados de modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedEmpaque, setSelectedEmpaque] = useState<Empaque | null>(null)
  const [trazabilidad, setTrazabilidad] = useState<any[]>([])

  // Cargar datos iniciales
  useEffect(() => {
    fetchWarehouses()
    fetchPackageSizes()
  }, [])

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterAlmacen, filterEstado, filterTamano])

  // Cargar empaques cuando cambian filtros o página
  useEffect(() => {
    fetchEmpaques()
  }, [currentPage, searchTerm, filterAlmacen, filterEstado, filterTamano])

  const fetchWarehouses = async () => {
    try {
      setLoadingWarehouses(true)
      const response = await fetch('/api/warehouses?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setWarehouses(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los almacenes')
    } finally {
      setLoadingWarehouses(false)
    }
  }

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

      // Siempre usar paginación del servidor
      const params = new URLSearchParams({
        tipo: 'caja',
        page: currentPage.toString(),
        limit: EMPAQUES_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(filterAlmacen && filterAlmacen !== 'todos' && { warehouseId: filterAlmacen }),
        ...(filterEstado && filterEstado !== 'todos' && { estado: filterEstado }),
        ...(filterTamano && filterTamano !== 'todos' && { packageSizeId: filterTamano })
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

  const handlePrintLabel = async (empaque: Empaque) => {
    try {
      // Obtener datos de la compañía autenticada con logo
      // Convertir 'company-1' a '1' si es necesario
      let companyId = user?.companyId || '1'
      if (companyId.startsWith('company-')) {
        companyId = companyId.replace('company-', '')
      }
      const companyResponse = await fetch(`/api/companies/${companyId}`)
      let company = {
        legalName: 'LogiRapid',
        logo: '',
        primary_color: '#8B5CF6',
        phone: '',
        customerServicePhone: ''
      }

      if (companyResponse.ok) {
        const companyData = await companyResponse.json()
        company = {
          legalName: companyData.data?.legalName || 'LogiRapid',
          logo: companyData.data?.logo || companyData.data?.logoUrl || '',
          primary_color: companyData.data?.primaryColor || '#8B5CF6',
          phone: companyData.data?.phone || '',
          customerServicePhone: companyData.data?.customerServicePhone || ''
        }
      }

      // Obtener trazabilidad para encontrar el almacén de creación
      const trazabilidadResponse = await fetch(`/api/empaques/${empaque.id}?trazabilidad=true`)
      let creationWarehouseId = empaque.warehouse_id // Fallback al warehouse actual

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
      const warehouseImpresionResponse = await fetch(`/api/warehouses/${empaque.warehouse_id}`)
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

      // Generar HTML de la etiqueta
      const labelHTML = generateEmpaqueLabel({
        empaque,
        warehouseCreacion,
        warehouseImpresion,
        company,
        fechaImpresion: new Date()
      })

      // Abrir ventana de impresión
      const printWindow = window.open('', '_blank', 'width=600,height=800')
      if (!printWindow) {
        showNotification('error', 'Error', 'No se pudo abrir la ventana de impresión')
        return
      }

      printWindow.document.write(labelHTML)
      printWindow.document.close()
    } catch (error) {
      console.error('Error al generar etiqueta:', error)
      showNotification('error', 'Error', 'No se pudo generar la etiqueta')
    }
  }

  const handleDelete = async (empaqueId: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta caja vacía?')) return

    try {
      const response = await fetch(`/api/empaques/${empaqueId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        showNotification('success', 'Éxito', 'Caja eliminada correctamente')
        fetchEmpaques()
      } else {
        const data = await response.json()
        showNotification('error', 'Error', data.error || 'No se pudo eliminar la caja')
      }
    } catch (error) {
      console.error('Error deleting empaque:', error)
      showNotification('error', 'Error', 'Ocurrió un error al eliminar la caja')
    }
  }

  const handleShowHistory = async (empaque: Empaque) => {
    setSelectedEmpaque(empaque)
    setShowHistoryModal(true)

    try {
      const response = await fetch(`/api/empaques/${empaque.id}?trazabilidad=true`)
      if (response.ok) {
        const data = await response.json()
        setTrazabilidad(data.trazabilidad || [])
      }
    } catch (error) {
      console.error('Error fetching trazabilidad:', error)
      showNotification('error', 'Error', 'No se pudo cargar el historial')
    }
  }

  // Calcular estadísticas
  const stats = {
    total: totalEmpaques,
    disponibles: empaques.filter(e => e.estado === 'disponible').length,
    asignadas: empaques.filter(e => e.estado === 'asignado').length,
    almacenes: warehouses.length
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'relative overflow-hidden rounded-2xl border shadow-xl',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl shadow-sm',
                    theme === 'dark'
                      ? 'bg-blue-900/30 border border-blue-800/50'
                      : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                  )}>
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>
                      Total Cajas
                    </p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>
                      {stats.total}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              'relative overflow-hidden rounded-2xl border shadow-xl',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600"></div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl shadow-sm',
                    theme === 'dark'
                      ? 'bg-green-900/30 border border-green-800/50'
                      : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200'
                  )}>
                    <Package className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>
                      Disponibles
                    </p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>
                      {stats.disponibles}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(
              'relative overflow-hidden rounded-2xl border shadow-xl',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
            )}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-orange-600"></div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl shadow-sm',
                    theme === 'dark'
                      ? 'bg-orange-900/30 border border-orange-800/50'
                      : 'bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200'
                  )}>
                    <Package className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>
                      Asignadas
                    </p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>
                      {stats.asignadas}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={cn(
              'relative overflow-hidden rounded-2xl border shadow-xl',
              theme === 'dark'
                ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                : 'bg-gradient-to-br from-slate-50 to-white border-slate-200'
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
                    <WarehouseIcon className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>
                      Almacenes
                    </p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>
                      {stats.almacenes}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Barra de Filtros */}
        <div className={cn(
          'p-4 rounded-xl border space-y-4',
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        )}>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por código, tipo, estado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 rounded-lg border',
                  theme === 'dark'
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                )}
              />
            </div>

            {/* Filtro Almacén */}
            <select
              value={filterAlmacen}
              onChange={(e) => setFilterAlmacen(e.target.value)}
              className={cn(
                'px-4 py-2.5 rounded-lg border',
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="todos">Todos los Almacenes</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>

            {/* Filtro Tamaño */}
            <select
              value={filterTamano}
              onChange={(e) => setFilterTamano(e.target.value)}
              className={cn(
                'px-4 py-2.5 rounded-lg border',
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="todos">Todos los Tamaños</option>
              {packageSizes.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.name}
                </option>
              ))}
            </select>

            {/* Filtro Estado */}
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className={cn(
                'px-4 py-2.5 rounded-lg border',
                theme === 'dark'
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="todos">Todos los Estados</option>
              <option value="disponible">Disponible</option>
              <option value="asignado">Asignado</option>
              <option value="en_transito">En Tránsito</option>
              <option value="entregado">Entregado</option>
            </select>

            {/* Botón Crear Cajas */}
            <Button
              onClick={() => setShowCreateModal(true)}
              className="justify-center whitespace-nowrap h-12 px-6 py-3 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Crear Cajas
            </Button>
          </div>
        </div>

        {/* Tabla */}
        <div className={cn(
          'rounded-xl border overflow-hidden',
          theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-200'
        )}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : empaques.length === 0 ? (
            <div className="text-center py-12">
              <Package className={cn(
                'h-16 w-16 mx-auto mb-4',
                theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
              )} />
              <h3 className={cn(
                'text-lg font-semibold mb-2',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                No hay cajas vacías
              </h3>
              <p className={cn(
                'text-sm',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                No se encontraron cajas con los filtros aplicados
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={cn(
                  'border-b',
                  theme === 'dark' ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
                )}>
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Código
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Tipo
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Tamaño
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Almacén
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Fecha
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className={cn(
                  'divide-y',
                  theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'
                )}>
                  {empaques.map((empaque) => (
                    <tr
                      key={empaque.id}
                      className={cn(
                        'transition-colors',
                        theme === 'dark'
                          ? 'hover:bg-gray-700/50'
                          : 'hover:bg-gray-50'
                      )}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <QrCode className="h-4 w-4 text-gray-400" />
                          <span className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {empaque.codigo}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {empaque.tipo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {empaque.package_size_name || 'N/A'}
                          </span>
                          {empaque.package_size_dimensions && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {empaque.package_size_dimensions}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          'px-2 py-1 text-xs font-semibold rounded-full',
                          empaque.estado === 'disponible'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                        )}>
                          {empaque.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {empaque.warehouseName || empaque.warehouse_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {empaque.created_at ? new Date(empaque.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        }) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleShowHistory(empaque)}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              theme === 'dark'
                                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                            )}
                            title="Ver historial"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePrintLabel(empaque)}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              theme === 'dark'
                                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                            )}
                            title="Imprimir etiqueta"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(empaque.id)}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              theme === 'dark'
                                ? 'hover:bg-red-900/30 text-gray-400 hover:text-red-400'
                                : 'hover:bg-red-50 text-gray-600 hover:text-red-600'
                            )}
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
          )}
        </div>

        {/* Paginación */}
        {totalEmpaques > EMPAQUES_PER_PAGE && (
          <div className={cn(
            'p-4 rounded-xl border',
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

      {/* Modal Crear */}
      {showCreateModal && (
        <CreateCajasModalGlobal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchEmpaques()
            fetchWarehouses()
          }}
        />
      )}

      {/* Modal Historial */}
      {showHistoryModal && selectedEmpaque && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={cn(
            'rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden',
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className={cn(
              'p-6 border-b flex items-center justify-between',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <h3 className={cn(
                'text-xl font-bold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Historial de Trazabilidad
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                <div className={cn(
                  'p-4 rounded-lg',
                  theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                )}>
                  <p className={cn(
                    'text-sm font-medium',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Código: {selectedEmpaque.codigo}
                  </p>
                  <p className={cn(
                    'text-sm mt-1',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Estado actual: {selectedEmpaque.estado}
                  </p>
                </div>
                {trazabilidad.length > 0 ? (
                  trazabilidad.map((item, index) => (
                    <div key={item.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                        {index < trazabilidad.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-300 dark:bg-gray-600 mt-1"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className={cn(
                          'text-sm font-medium',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {item.accion}
                        </p>
                        <p className={cn(
                          'text-xs mt-1',
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          {item.ubicacion}
                        </p>
                        <p className={cn(
                          'text-xs mt-1',
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          {new Date(item.fecha).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={cn(
                    'text-sm text-center py-4',
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    No hay historial disponible
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
