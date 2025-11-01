'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Car,
  Plus,
  Search,
  RefreshCw,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Truck,
  Package,
  Route
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import ViewToggle from '@/components/ui/ViewToggle'
import { ModernVehicleRegistrationForm } from '@/components/forms/ModernVehicleRegistrationForm'
import { VehicleList } from '@/components/dashboard/VehicleList'
import { VehicleFormData, VehicleStatus, VehicleAvailability } from '@/types/vehicle'
import { createVehicle, getVehicles } from '@/services/vehicleService'

interface Vehicle {
  id: string
  vin: string
  make: string
  model: string
  year: number
  body_type: string
  color: string
  photo_url?: string
  capacity: {
    weight_lbs: number
    weight_kg: number
    volume_cubic_ft: number
    volume_cubic_m: number
  }
  status: VehicleStatus
  availability: VehicleAvailability
  current_route_id?: string
  created_at: string
  updated_at: string
}

export default function ManagerVehiclesPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showRegistrationForm, setShowRegistrationForm] = useState(false)
  const [isCreatingVehicle, setIsCreatingVehicle] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalVehicles, setTotalVehicles] = useState(0)
  const VEHICLES_PER_PAGE = 10
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all')

  // View state - inicializar desde URL o por defecto 'table'
  const [activeView, setActiveView] = useState<'table' | 'map' | 'statistics'>(() => {
    const viewFromUrl = searchParams.get('view')
    return viewFromUrl === 'map' ? 'map' : viewFromUrl === 'statistics' ? 'statistics' : 'table'
  })

  // Fetch vehicles
  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await getVehicles(currentPage, VEHICLES_PER_PAGE)

      if (response.success && response.data) {
        setVehicles(response.data.data)
        setTotalVehicles(response.data.pagination.total)
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los vehículos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setCurrentPage(1) // Reset to first page when filters change
  }, [searchTerm, statusFilter, availabilityFilter])

  useEffect(() => {
    fetchData()
  }, [currentPage, searchTerm, statusFilter, availabilityFilter])

  // Actualizar URL cuando cambia la vista
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())

    if (activeView === 'map') {
      params.set('view', 'map')
    } else {
      params.delete('view')
    }

    const newUrl = `/dashboard/manager/vehicles${params.toString() ? '?' + params.toString() : ''}`
    router.push(newUrl, { scroll: false })
  }, [activeView, searchParams, router])

  // Calculate statistics
  const stats = {
    total: vehicles.length,
    active: vehicles.filter(vehicle => vehicle.status === 'ACTIVE').length,
    available: vehicles.filter(vehicle => vehicle.availability === 'AVAILABLE').length,
    inTransit: vehicles.filter(vehicle => vehicle.status === 'IN_TRANSIT').length,
    totalCapacity: vehicles.reduce((sum, v) => sum + v.capacity.weight_lbs, 0),
    usedCapacity: Math.round(vehicles.reduce((sum, v) => sum + v.capacity.weight_lbs, 0) * 0.65) // Simulación
  }

  const STATUSES = {
    ACTIVE: { label: 'Activo', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
    INACTIVE: { label: 'Inactivo', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400', icon: XCircle },
    MAINTENANCE: { label: 'Mantenimiento', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle },
    IN_TRANSIT: { label: 'En tránsito', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Truck }
  }

  const AVAILABILITY = {
    AVAILABLE: { label: 'Disponible', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
    ASSIGNED: { label: 'Asignado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Route },
    UNAVAILABLE: { label: 'No disponible', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle }
  }

  // Manejar registro de nuevo vehículo
  const handleCreateVehicle = async (data: VehicleFormData) => {
    setIsCreatingVehicle(true)

    try {
      const vehicleData = {
        vin: data.vin,
        make: data.vin_data.make,
        model: data.vin_data.model,
        year: data.vin_data.model_year,
        body_type: data.vin_data.body_type,
        color: data.vin_data.color || 'Unknown',
        photo_url: data.photo_url,
        capacity: {
          weight_lbs: data.capacity_weight_lbs,
          weight_kg: data.capacity_weight_kg,
          volume_cubic_ft: data.capacity_volume_cubic_ft,
          volume_cubic_m: data.capacity_volume_cubic_m,
        },
        status: VehicleStatus.ACTIVE,
        availability: VehicleAvailability.AVAILABLE,
      };

      const response = await createVehicle(vehicleData);

      if (response.success) {
        showNotification('success', 'Vehículo Creado', 'El vehículo ha sido creado exitosamente')
        setShowRegistrationForm(false)
        fetchData()
      } else {
        throw new Error(response.error || 'Error creating vehicle')
      }
    } catch (error) {
      console.error('Error creating vehicle:', error)
      showNotification('error', 'Error al crear vehículo', error instanceof Error ? error.message : 'Error desconocido')
    } finally {
      setIsCreatingVehicle(false)
    }
  }

  // Handle view vehicle details
  const handleViewVehicle = (vehicleId: string) => {
    window.location.href = `/dashboard/manager/vehicles/${vehicleId}`
  }

  // Handle edit vehicle
  const handleEditVehicle = (vehicleId: string) => {
    window.location.href = `/dashboard/manager/vehicles/${vehicleId}/edit`
  }

  // Handle delete vehicle
  const handleDeleteVehicle = async (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId)
    if (!vehicle) return

    if (!confirm(`¿Estás seguro de que deseas eliminar el vehículo "${vehicle.make} ${vehicle.model}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      // Aquí iría la llamada a la API para eliminar
      showNotification('success', 'Vehículo Eliminado', 'El vehículo ha sido eliminado exitosamente')
      fetchData()
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      showNotification('error', 'Error al eliminar', 'No se pudo eliminar el vehículo')
    }
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Conditional Rendering based on active view */}
          {activeView === 'table' && (
            <div>
              {/* Panel de Vehículos - Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {/* Total de Vehículos */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    'relative overflow-hidden',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                    'rounded-2xl border shadow-xl'
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
                          <Car className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-gray-400' : 'text-black'
                          )}>Mis Vehículos</p>
                          <p className={cn(
                            'text-3xl font-bold mt-1',
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          )}>{stats.total}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                        <span className={cn(
                          'text-xs font-medium',
                          theme === 'dark' ? 'text-gray-500' : 'text-black'
                        )}>Bajo tu gestión</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Vehículos Activos */}
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
                          )}>Activos</p>
                          <p className={cn(
                            'text-3xl font-bold mt-1',
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          )}>{stats.active}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="w-full bg-green-100 dark:bg-green-900/30 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${stats.total > 0 ? (stats.active / stats.total * 100) : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Capacidad Total */}
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
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-violet-600"></div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-3 rounded-xl shadow-sm',
                          theme === 'dark'
                            ? 'bg-purple-900/30 border border-purple-800/50'
                            : 'bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200'
                        )}>
                          <Package className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <p className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-gray-400' : 'text-black'
                          )}>Capacidad Total</p>
                          <p className={cn(
                            'text-3xl font-bold mt-1',
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          )}>{stats.totalCapacity.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          'text-xs font-medium',
                          theme === 'dark' ? 'text-gray-500' : 'text-black'
                        )}>Utilizada</span>
                        <span className={cn(
                          'text-xs font-bold',
                          theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                        )}>{stats.usedCapacity.toLocaleString()} lbs</span>
                      </div>
                      <div className="w-full bg-purple-100 dark:bg-purple-900/30 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-400 to-violet-500 h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${stats.totalCapacity > 0 ? (stats.usedCapacity / stats.totalCapacity * 100) : 0}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Disponibles */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className={cn(
                    'relative overflow-hidden',
                    theme === 'dark'
                      ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                      : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                    'rounded-2xl border shadow-xl'
                  )}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-3 rounded-xl shadow-sm',
                          theme === 'dark'
                            ? 'bg-amber-900/30 border border-amber-800/50'
                            : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                        )}>
                          <Truck className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <p className={cn(
                            'text-sm font-medium',
                            theme === 'dark' ? 'text-gray-400' : 'text-black'
                          )}>Disponibles</p>
                          <p className={cn(
                            'text-3xl font-bold mt-1',
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          )}>{stats.available}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                      <span className={cn(
                        'text-xs font-medium',
                        theme === 'dark' ? 'text-gray-500' : 'text-black'
                      )}>Listos para asignar</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Filters */}
              <div className="flex flex-col lg:flex-row gap-6 items-center justify-between py-6 px-4 mt-8 mb-6 bg-white dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar por marca, modelo, VIN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={cn(
                      'w-full h-12 pl-10 pr-4 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white placeholder-gray-400 text-sm'
                        : 'bg-white border-gray-300 text-black placeholder-gray-500 text-sm'
                    )}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={cn(
                      'h-12 px-4 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white text-sm'
                        : 'bg-white border-gray-300 text-black text-sm'
                    )}
                  >
                    <option value="all">Todos los estados</option>
                    {Object.entries(STATUSES).map(([key, status]) => (
                      <option key={key} value={key}>{status.label}</option>
                    ))}
                  </select>

                  <select
                    value={availabilityFilter}
                    onChange={(e) => setAvailabilityFilter(e.target.value)}
                    className={cn(
                      'w-full sm:w-auto h-12 px-4 rounded-lg border transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500',
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-600 text-gray-900 dark:text-white text-sm'
                        : 'bg-white border-gray-300 text-black text-sm'
                    )}
                  >
                    <option value="all">Todas las disponibilidades</option>
                    {Object.entries(AVAILABILITY).map(([key, availability]) => (
                      <option key={key} value={key}>{availability.label}</option>
                    ))}
                  </select>

                  {/* View Toggle Buttons */}
                  <ViewToggle
                    activeView={activeView}
                    onViewChange={setActiveView}
                    counts={{
                      table: vehicles.length,
                      map: vehicles.length,
                      statistics: vehicles.length
                    }}
                    theme={theme}
                    compact={true}
                  />

                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button
                      onClick={fetchData}
                      className={cn(
                        'flex-1 sm:flex-none items-center justify-center gap-2 h-12',
                        'bg-blue-600 hover:bg-blue-700 text-black dark:text-white font-medium',
                        'rounded-lg transition-all duration-200',
                        'shadow-sm hover:shadow-md',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/20',
                        'dark:bg-blue-700 dark:hover:bg-blue-800 dark:text-white'
                      )}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Actualizar
                    </Button>

                    <button
                      onClick={() => router.push('/dashboard/manager/vehicles/register')}
                      className={cn(
                        'flex-1 sm:flex-none justify-center whitespace-nowrap',
                        'rounded-lg text-sm font-medium transition-all duration-200',
                        'h-12 bg-green-600 hover:bg-green-700 text-white',
                        'shadow-sm hover:shadow-md',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/20',
                        'flex items-center gap-2 px-6'
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      Nuevo Vehículo
                    </button>
                  </div>
                </div>
              </div>

              {/* Vehicle List */}
              <VehicleList
                onCreateVehicle={() => router.push('/dashboard/manager/vehicles/register')}
                onAssignRoute={(vehicleId) => router.push(`/dashboard/manager/routes?assign=${vehicleId}`)}
                onViewDetails={handleViewVehicle}
                onEdit={handleEditVehicle}
                onToggleStatus={(vehicleId) => console.log('Toggle status:', vehicleId)}
              />

              {/* Pagination */}
              {totalVehicles > VEHICLES_PER_PAGE && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'mt-6 p-4 rounded-xl border',
                    theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-black dark:text-gray-400">
                      Mostrando {((currentPage - 1) * VEHICLES_PER_PAGE) + 1} a{' '}
                      {Math.min(currentPage * VEHICLES_PER_PAGE, totalVehicles)} de {totalVehicles} vehículos
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
                        {Array.from({ length: Math.min(5, Math.ceil(totalVehicles / VEHICLES_PER_PAGE)) }, (_, i) => {
                          const totalPages = Math.ceil(totalVehicles / VEHICLES_PER_PAGE)
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
                        disabled={currentPage >= Math.ceil(totalVehicles / VEHICLES_PER_PAGE)}
                        className="flex items-center gap-1"
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Vista de Mapa */}
          {activeView === 'map' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-12">
                <div className="text-center space-y-6">
                  <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <MapPin className="w-12 h-12 text-black dark:text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-black dark:text-white">
                    Vista de Mapa
                  </h2>
                  <p className="text-xl text-gray-600 dark:text-gray-300">
                    Próximamente podrás ver tus vehículos en un mapa interactivo
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Statistics View */}
          {activeView === 'statistics' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-8"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-12">
                <div className="text-center space-y-6">
                  <div className="mx-auto w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <BarChart3 className="w-12 h-12 text-black dark:text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-black dark:text-white">
                    Estadísticas de Vehículos
                  </h2>
                  <div className="space-y-4">
                    <p className="text-xl text-gray-600 dark:text-gray-300">
                      Estamos trabajando en desarrollar análisis detallados
                    </p>
                    <p className="text-lg text-gray-500 dark:text-gray-400">
                      Próximamente podrás ver aquí gráficos interactivos y métricas importantes sobre tu flota.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {vehicles.length}
                      </div>
                      <div className="text-sm text-black dark:text-gray-300 mt-1">
                        Mis Vehículos
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {stats.active}
                      </div>
                      <div className="text-sm text-black dark:text-gray-300 mt-1">
                        Vehículos Activos
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {stats.usedCapacity.toLocaleString()}
                      </div>
                      <div className="text-sm text-black dark:text-gray-300 mt-1">
                        Capacidad Utilizada (lbs)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </motion.div>

        {/* Modal de Registro de Vehículo */}
        {showRegistrationForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRegistrationForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-black dark:text-white">
                    Registrar Nuevo Vehículo
                  </h2>
                  <button
                    onClick={() => setShowRegistrationForm(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <ModernVehicleRegistrationForm
                  onSubmit={handleCreateVehicle}
                  isLoading={isCreatingVehicle}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  )
}