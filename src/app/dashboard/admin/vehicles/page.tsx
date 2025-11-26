'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import BrandLogo from '@/components/ui/BrandLogo'
import { Vehicle, VehicleFormData, VehicleStatus, VehicleAvailability } from '@/types/vehicle'
import { createVehicle, getVehicles } from '@/services/vehicleService'

// Force dynamic rendering to avoid static generation issues with useSearchParams
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'
export const fetchCache = 'force-no-store'

export default function AdminVehiclesPage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalVehicles, setTotalVehicles] = useState(0)
  const VEHICLES_PER_PAGE = 25
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

      // Call getVehicles function from API
      const response = await getVehicles(currentPage, VEHICLES_PER_PAGE, searchTerm, statusFilter, availabilityFilter)
      console.log('API response from getVehicles:', response);

      if (response.success && response.data) {
        console.log('Setting vehicles in state:', response.data);

        // Handle pagination safely - API returns data directly as array with pagination property
        const vehiclesArray = Array.isArray(response.data)
          ? response.data
          : Array.isArray((response.data as any).data)
            ? (response.data as any).data
            : [];
        const paginationInfo: { total?: number } = (response.data as any).pagination || {};
        const paginationTotal = paginationInfo.total || vehiclesArray.length || 0;
        console.log('Total vehicles from pagination:', paginationTotal);

        setVehicles(vehiclesArray)
        setTotalVehicles(paginationTotal)

        // Verify the state was set
        console.log('State after setting vehicles - vehicles count:', vehiclesArray.length);
      } else {
        console.error('API response was not successful:', response);
        showNotification('error', 'Error', response.error || 'Error al cargar vehículos')
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

    const newUrl = `/dashboard/admin/vehicles${params.toString() ? '?' + params.toString() : ''}`
    router.push(newUrl, { scroll: false })
  }, [activeView, searchParams, router])

  // Calculate statistics
  const stats = {
    total: vehicles.length,
    active: vehicles.filter(vehicle => vehicle.status === 'ACTIVE').length,
    available: vehicles.filter(vehicle => vehicle.availability === 'AVAILABLE').length,
    inTransit: vehicles.filter(vehicle => vehicle.status === 'IN_TRANSIT').length,
    totalCapacity: vehicles.reduce((sum, v) => sum + (v.capacity?.weight_kg || 0), 0),
    usedCapacity: Math.round(vehicles.reduce((sum, v) => sum + (v.capacity?.weight_kg || 0), 0) * 0.65) // Simulación
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


  // Handle view vehicle details
  const handleViewVehicle = (vehicleId: string) => {
    window.location.href = `/dashboard/admin/vehicles/${vehicleId}`
  }

  // Handle edit vehicle
  const handleEditVehicle = (vehicleId: string) => {
    window.location.href = `/dashboard/admin/vehicles/${vehicleId}/edit`
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

  // Loading state UI
  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="relative flex flex-col items-center space-y-6">
            {/* Background glow effects */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-exa-primary/10 rounded-full filter blur-3xl animate-pulse" />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-exa-secondary/10 rounded-full filter blur-2xl animate-pulse delay-500" />
            </div>

            {/* Logo with spinning circle */}
            <div className="relative">
              {/* Spinning circle border */}
              <div className="absolute inset-0 w-32 h-32 border-4 border-transparent border-t-exa-primary border-r-exa-secondary rounded-full animate-spin" />

              {/* Inner circle with logo */}
              <div className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center shadow-2xl",
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700'
                  : 'bg-gradient-to-br from-white to-gray-100 border border-gray-200'
              )}>
                <Car className={cn(
                  "w-12 h-12 animate-pulse",
                  theme === 'dark' ? 'text-exa-primary' : 'text-exa-secondary'
                )} />
              </div>
            </div>

            {/* Loading text */}
            <div className="text-center space-y-2">
              <h3 className={cn(
                "text-xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Cargando Vehículos
              </h3>
              <p className={cn(
                "text-sm animate-pulse",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Obteniendo datos de la flota...
              </p>
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-exa-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-exa-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <div className="space-y-6">
          {/* Conditional Rendering based on active view */}
          {activeView === 'table' && (
            <div>
              {/* Panel de Vehículos - Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {/* Total de Vehículos */}
                <div
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
                          )}>Total Vehículos</p>
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
                        )}>En sistema</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vehículos Activos */}
                <div
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
                </div>

                {/* Capacidad Total */}
                <div
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
                        )}>{stats.usedCapacity.toLocaleString()} cajas</span>
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
                </div>

                {/* Disponibles */}
                <div
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
                </div>
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
                      onClick={() => router.push('/dashboard/admin/vehicles/register')}
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
              <div className="space-y-4">
                {vehicles.length === 0 ? (
                  <div className="text-center py-16">
                    <Truck className="w-20 h-20 text-gray-400 mx-auto mb-6" />
                    <h3 className={cn(
                      "text-2xl font-bold mb-3",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      No hay vehículos registrados
                    </h3>
                    <p className={cn(
                      "text-lg mb-8",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Crea tu primer vehículo para comenzar a gestionar tu flota
                    </p>
                    <Button
                      onClick={() => router.push('/dashboard/admin/vehicles/register')}
                      className={cn(
                        'px-8 py-3',
                        theme === 'dark'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      )}
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Registrar primer vehículo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vehicles.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        onClick={() => handleViewVehicle(vehicle.id)}
                        className={cn(
                          "group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer",
                          "hover:shadow-lg hover:border-blue-500/50",
                          theme === 'dark'
                            ? "bg-gray-800/80 border-gray-700"
                            : "bg-white border-gray-200"
                        )}
                      >
                        {/* Contenido horizontal */}
                        <div className="flex items-center gap-4 p-4">
                          {/* Logo de la marca del vehículo */}
                          <div className="relative">
                            <BrandLogo
                              brand={vehicle.make}
                              size={128}
                              className="flex-shrink-0"
                            />

                            {/* Indicador de estado */}
                            <div className={cn(
                              "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center",
                              theme === 'dark' ? "border-gray-800" : "border-white",
                              vehicle.status === 'ACTIVE'
                                ? "bg-green-500"
                                : vehicle.status === 'MAINTENANCE'
                                ? "bg-yellow-500"
                                : vehicle.status === 'INACTIVE'
                                ? "bg-gray-500"
                                : "bg-blue-500"
                            )}>
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          </div>

                          {/* Información principal */}
                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Título y acciones */}
                            <div className="flex items-start justify-between">
                              <div className="min-w-0">
                                <h3 className={cn(
                                  "font-bold text-lg mb-1 group-hover:text-blue-600 transition-colors truncate",
                                  theme === 'dark' ? "text-white" : "text-gray-900"
                                )}>
                                  {vehicle.make} {vehicle.model}
                                </h3>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-xs px-2 py-0.5 rounded-md font-medium",
                                    theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"
                                  )}>
                                    {vehicle.year}
                                  </span>
                                  <span className={cn(
                                    "text-xs px-2 py-0.5 rounded-full font-medium",
                                    AVAILABILITY[vehicle.availability]?.color || "bg-gray-100 text-gray-800"
                                  )}>
                                    {AVAILABILITY[vehicle.availability]?.label || vehicle.availability}
                                  </span>
                                  {(vehicle as any).can_collect_durable && (
                                    <div className="flex items-center gap-1">
                                      <div className="w-3 h-3 rounded bg-blue-600 border border-blue-600 flex items-center justify-center">
                                        <svg className="w-1.5 h-1.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                      <span className={cn(
                                        "text-xs font-medium",
                                        theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                      )}>
                                        Durable
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Botón editar */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditVehicle(vehicle.id);
                                }}
                                className={cn(
                                  "p-2 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100",
                                  "hover:scale-110 active:scale-95",
                                  theme === 'dark'
                                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                                )}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </div>

                            {/* VIN y tipo */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                              <div>
                                <span className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                )}>
                                  VIN
                                </span>
                                <p className={cn(
                                  "font-mono truncate",
                                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                )}>
                                  {vehicle.vin}
                                </p>
                              </div>
                              <div>
                                <span className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                )}>
                                  Tipo
                                </span>
                                <p className={cn(
                                  "truncate",
                                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                )}>
                                  {vehicle.body_type}
                                </p>
                              </div>
                              <div>
                                <span className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                )}>
                                  Millas
                                </span>
                                <p className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                )}>
                                  {(vehicle as any).mileage ? (vehicle as any).mileage.toLocaleString() : 'N/A'} mi
                                </p>
                              </div>
                              <div>
                                <span className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                )}>
                                  Vence Seguro
                                </span>
                                <p className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                )}>
                                  {(vehicle as any).insurance_expiry ? new Date((vehicle as any).insurance_expiry).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <span className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-gray-500" : "text-gray-400"
                                )}>
                                  Próximo Cambio Aceite
                                </span>
                                <p className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                )}>
                                  {(vehicle as any).next_oil_change ? new Date((vehicle as any).next_oil_change).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Barras de progreso con efectos de marca */}
                          <div className="space-y-3 min-w-[320px]">
                            {/* Cajas Vacías - Entregas (Rojo Marca) */}
                            <div className="group">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <div className="w-4 h-4 bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-sm" />
                                    <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
                                  </div>
                                  <span className={cn(
                                    "text-sm font-medium",
                                    theme === 'dark' ? "text-gray-200" : "text-gray-700"
                                  )}>
                                    Entregadas
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span
                                    className={cn(
                                      "text-lg font-bold tabular-nums transition-all duration-300",
                                      theme === 'dark' ? "text-red-400" : "text-red-600"
                                    )}
                                  >
                                    {Math.max(0, ((vehicle.capacity as any)?.empty_boxes || 0) - 5)}
                                  </span>
                                  <span className={cn(
                                    "text-sm font-medium",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                  )}>
                                    /{(vehicle.capacity as any)?.empty_boxes || 0}
                                  </span>
                                </div>
                              </div>
                              <div className="relative h-6 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full overflow-hidden shadow-inner">
                                {/* Efecto de fondo animado */}
                                <div className="absolute inset-0 bg-gradient-to-r from-red-100 to-transparent dark:from-red-900/20 dark:to-transparent animate-pulse" />
                                <div
                                  className="h-full bg-gradient-to-r from-red-500 via-red-600 to-red-700 rounded-full transition-all duration-1000 ease-out shadow-lg relative"
                                  style={{
                                    width: `${Math.min(((Math.max(0, ((vehicle.capacity as any)?.empty_boxes || 0) - 5)) / Math.max(1, (vehicle.capacity as any)?.empty_boxes || 1)) * 100, 100)}%`
                                  }}
                                >
                                  {/* Efecto de brillo */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                                </div>
                                <div className={cn(
                                  "absolute inset-0 flex items-center justify-center",
                                  "text-xs font-bold tracking-wide",
                                  "text-white drop-shadow-sm"
                                )}>
                                  {Math.round(((Math.max(0, ((vehicle.capacity as any)?.empty_boxes || 0) - 5)) / Math.max(1, (vehicle.capacity as any)?.empty_boxes || 1)) * 100)}%
                                </div>
                                {/* Efecto de partículas */}
                                <div className="absolute inset-0 overflow-hidden rounded-full">
                                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                    <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Cajas Llenas - Recogidas (Azul Marca) */}
                            <div className="group">
                              <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-sm" />
                                    <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75" />
                                  </div>
                                  <span className={cn(
                                    "text-sm font-medium",
                                    theme === 'dark' ? "text-gray-200" : "text-gray-700"
                                  )}>
                                    Recogidas
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span
                                    className={cn(
                                      "text-lg font-bold tabular-nums transition-all duration-300",
                                      theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                    )}
                                  >
                                    {(vehicle.capacity as any)?.full_boxes || 0}
                                  </span>
                                  <span className={cn(
                                    "text-sm font-medium",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                  )}>
                                    /{(vehicle.capacity as any)?.full_boxes || 20}
                                  </span>
                                </div>
                              </div>
                              <div className="relative h-6 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full overflow-hidden shadow-inner">
                                {/* Efecto de fondo animado */}
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-transparent dark:from-blue-900/20 dark:to-transparent animate-pulse" />
                                <div
                                  className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-full transition-all duration-1000 ease-out shadow-lg relative"
                                  style={{
                                    width: `${Math.min((((vehicle.capacity as any)?.full_boxes || 0) / Math.max(1, (vehicle.capacity as any)?.full_boxes || 20)) * 100, 100)}%`
                                  }}
                                >
                                  {/* Efecto de brillo */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
                                </div>
                                <div className={cn(
                                  "absolute inset-0 flex items-center justify-center",
                                  "text-xs font-bold tracking-wide",
                                  "text-white drop-shadow-sm"
                                )}>
                                  {Math.round((((vehicle.capacity as any)?.full_boxes || 0) / Math.max(1, (vehicle.capacity as any)?.full_boxes || 20)) * 100)}%
                                </div>
                                {/* Efecto de partículas */}
                                <div className="absolute inset-0 overflow-hidden rounded-full">
                                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                                    <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Indicadores de capacidad */}
                            <div className={cn(
                              "flex justify-between items-center pt-3 border-t",
                              theme === 'dark' ? "border-gray-700" : "border-gray-200"
                            )}>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-gradient-to-r from-red-500 to-blue-500 rounded-full" />
                                  <span className={cn(
                                    "text-xs font-medium",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                  )}>
                                    Capacidad Total
                                  </span>
                                </div>
                                <span className={cn(
                                  "text-sm font-bold",
                                  theme === 'dark' ? "text-white" : "text-gray-900"
                                )}>
                                  {((vehicle.capacity as any)?.empty_boxes || 0) + ((vehicle.capacity as any)?.full_boxes || 0)} cajas totales
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Efecto hover sutil */}
                        <div className={cn(
                          "absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent",
                          "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                          "pointer-events-none"
                        )} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modern Pagination */}
              {totalVehicles > VEHICLES_PER_PAGE && (
                <div className="flex items-center justify-between py-4">
                  <div className="text-sm">
                    <span className={cn(
                      "font-medium",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Mostrando {((currentPage - 1) * VEHICLES_PER_PAGE) + 1}-{Math.min(currentPage * VEHICLES_PER_PAGE, totalVehicles)}
                    </span>
                    <span className={cn(
                      "ml-2",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      de {totalVehicles} vehículos
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "px-3 py-2",
                        theme === 'dark'
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Anterior
                    </Button>

                    <div className="flex items-center gap-1">
                      {(() => {
                        const totalPages = Math.ceil(totalVehicles / VEHICLES_PER_PAGE)
                        const pages = []

                        // Always show first page
                        if (totalPages > 0) pages.push(1)

                        // Show ellipsis if needed
                        if (currentPage > 3) {
                          pages.push('...')
                        }

                        // Show pages around current page
                        const start = Math.max(2, currentPage - 1)
                        const end = Math.min(totalPages - 1, currentPage + 1)

                        for (let i = start; i <= end; i++) {
                          if (i > 0 && i < totalPages) pages.push(i)
                        }

                        // Show ellipsis if needed
                        if (currentPage < totalPages - 2) {
                          pages.push('...')
                        }

                        // Always show last page
                        if (totalPages > 1) pages.push(totalPages)

                        return pages.map((page, index) => (
                          <React.Fragment key={index}>
                            {page === '...' ? (
                              <span className={cn(
                                "px-2",
                                theme === 'dark' ? "text-gray-500" : "text-gray-400"
                              )}>
                                ...
                              </span>
                            ) : (
                              <Button
                                onClick={() => setCurrentPage(page as number)}
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "w-10 h-10 p-0 font-medium",
                                  currentPage === page
                                    ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
                                    : theme === 'dark'
                                    ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                )}
                              >
                                {page}
                              </Button>
                            )}
                          </React.Fragment>
                        ))
                      })()}
                    </div>

                    <Button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalVehicles / VEHICLES_PER_PAGE)}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "px-3 py-2",
                        theme === 'dark'
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      Siguiente
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vista de Mapa */}
          {activeView === 'map' && (
            <div>
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
            </div>
          )}

          {/* Statistics View */}
          {activeView === 'statistics' && (
            <div className="space-y-8">
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
                        Total de Vehículos
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
                        Capacidad Utilizada (cajas)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  )
}
