'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/theme-context';
import { useNotifications } from '@/contexts/NotificationContext';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  FileText,
  Wrench,
  Gauge,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Shield,
  CreditCard,
  Settings,
  Edit2,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Fuel,
  TrendingUp,
  Activity
} from 'lucide-react';
import { getVehicleById, updateVehicle, deleteVehicle } from '@/services/vehicleService';

interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  model_year: number;
  body_type: string;
  color: string;
  nickname: string;
  photo_url?: string;
  capacity: {
    weight_lbs: number;
    weight_kg: number;
    volume_cubic_ft: number;
    volume_cubic_m: number;
  };
  status: string;
  availability: string;
  current_route_id?: string;
  created_at: string;
  updated_at: string;
  performance?: {
    current_mileage: number;
    average_mpg: number;
    fuel_type: string;
    trips_completed: number;
    total_distance: number;
  };
  maintenance?: {
    last_service_date: string;
    next_service_date: string;
    total_cost: number;
    service_history: Array<{
      id: string;
      date: string;
      type: string;
      description: string;
      cost: number;
      mileage: number;
      provider: string;
    }>;
  };
  driver?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    license_number: string;
    experience_years: number;
  };
  insurance?: {
    company: string;
    policy_number: string;
    coverage_type: string;
    premium_monthly: number;
    expiration_date: string;
    is_active: boolean;
  };
}

export default function VehicleDetailsPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { theme } = useTheme();
  const { showNotification } = useNotifications();
  const router = useRouter()
  const [vehicleId, setVehicleId] = useState<string>('')
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempValue, setTempValue] = useState<string>('')

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params
      setVehicleId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (!vehicleId) return

    const fetchVehicle = async () => {
      try {
        const response = await getVehicleById(vehicleId)
        if (response.success && response.data) {
          // Mock additional data for demonstration
          const mockVehicle = {
            ...(response.data as any),
            model_year: (response.data as any).model_year || (response.data as any).year || new Date().getFullYear(),
            nickname: (response.data as any).nickname || `${(response.data as any).make} ${(response.data as any).model}`,
            performance: {
              current_mileage: 45230,
              average_mpg: 18.5,
              fuel_type: 'Gasolina',
              trips_completed: 342,
              total_distance: 125430
            },
            maintenance: {
              last_service_date: '2024-01-15',
              next_service_date: '2024-04-15',
              total_cost: 3450,
              service_history: [
                {
                  id: '1',
                  date: '2024-01-15',
                  type: 'Cambio de Aceite',
                  description: 'Cambio de aceite y filtro regular',
                  cost: 85,
                  mileage: 44800,
                  provider: 'AutoQuick Service'
                },
                {
                  id: '2',
                  date: '2023-11-20',
                  type: 'Rotación de Llantas',
                  description: 'Rotación y balanceo de llantas',
                  cost: 60,
                  mileage: 42500,
                  provider: 'TirePro Center'
                },
                {
                  id: '3',
                  date: '2023-09-10',
                  type: 'Frenos',
                  description: 'Cambio de pastillas de freno delanteras',
                  cost: 320,
                  mileage: 40000,
                  provider: 'BrakeMaster'
                }
              ]
            },
            driver: {
              id: 'driver_001',
              name: 'Carlos Rodriguez',
              email: 'carlos.rodriguez@logirapid.com',
              phone: '+1 (305) 555-0123',
              license_number: 'A12345678',
              experience_years: 5
            },
            insurance: {
              company: 'Seguros La Protección',
              policy_number: 'POL-2024-001234',
              coverage_type: 'Completo',
              premium_monthly: 285,
              expiration_date: '2024-12-31',
              is_active: true
            }
          }
          setVehicle(mockVehicle)
        } else {
          showNotification('error', 'Error', response.error || 'No se pudo cargar el vehículo')
        }
      } catch (error) {
        console.error('Error fetching vehicle:', error)
        showNotification('error', 'Error', 'Error al cargar el vehículo')
      } finally {
        setLoading(false)
      }
    }

    fetchVehicle()
  }, [vehicleId, router, showNotification])

  const handleUpdateField = async (field: string, value: string) => {
    if (!vehicle) return

    try {
      const updateData = { [field]: value }
      const response = await updateVehicle(vehicle.id, updateData)

      if (response.success) {
        setVehicle({ ...vehicle, ...updateData })
        showNotification('success', 'Actualizado', 'Campo actualizado correctamente')
      } else {
        showNotification('error', 'Error', response.error || 'No se pudo actualizar')
      }
    } catch (error) {
      console.error('Error updating vehicle:', error)
      showNotification('error', 'Error', 'Error al actualizar vehículo')
    }
  }

  const handleDelete = async () => {
    if (!vehicle) return

    if (!confirm(`¿Estás seguro de que deseas eliminar el vehículo "${vehicle.make} ${vehicle.model}"? Esta acción no se puede deshacer.`)) {
      return
    }

    try {
      const response = await deleteVehicle(vehicle.id)

      if (response.success) {
        showNotification('success', 'Eliminado', 'Vehículo eliminado correctamente')
        router.push('/dashboard/admin/vehicles')
      } else {
        showNotification('error', 'Error', response.error || 'No se pudo eliminar')
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      showNotification('error', 'Error', 'Error al eliminar vehículo')
    }
  }

  const handleSaveEdit = () => {
    if (editingField && tempValue) {
      handleUpdateField(editingField, tempValue)
      setEditingField(null)
      setTempValue('')
    }
  }

  const handleCancelEdit = () => {
    setEditingField(null)
    setTempValue('')
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className={cn(
              "text-lg",
              theme === 'dark' ? "text-gray-300" : "text-gray-600"
            )}>
              Cargando detalles del vehículo...
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!vehicle) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className={cn(
              "text-2xl font-bold mb-2",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Vehículo no encontrado
            </h2>
            <p className={cn(
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              El vehículo que buscas no existe o ha sido eliminado.
            </p>
            <Button
              onClick={() => router.push('/dashboard/admin/vehicles')}
              className={cn(
                'mt-6',
                theme === 'dark'
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              Volver a vehículos
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard/admin/vehicles')}
            className={cn(
              "p-2",
              theme === 'dark'
                ? "text-gray-400 hover:text-white hover:bg-white/10"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => router.push(`/dashboard/admin/vehicles/${vehicle.id}/edit`)}
              className={cn(
                "px-4 py-2",
                theme === 'dark'
                  ? "text-gray-400 hover:text-white hover:bg-white/10"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Editar
            </Button>
            <Button
              onClick={handleDelete}
              className={cn(
                "px-4 py-2",
                theme === 'dark'
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-red-600 hover:bg-red-700"
              )}
            >
              Eliminar
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Vehicle Profile and Basic Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vehicle Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "rounded-2xl border overflow-hidden",
                theme === 'dark'
                  ? "bg-gray-800/50 border-gray-700 backdrop-blur-lg"
                  : "bg-white border-gray-200 shadow-lg"
              )}
            >
              {/* Vehicle Header with Image */}
              <div className="relative h-64 bg-gradient-to-br from-blue-500 to-purple-600">
                {vehicle.photo_url ? (
                  <img
                    src={vehicle.photo_url}
                    alt={`${vehicle.make} ${vehicle.model}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Settings className="w-12 h-12" />
                      </div>
                      <p className="text-lg font-medium">Sin foto</p>
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    vehicle.status === 'ACTIVE'
                      ? "bg-green-500 text-white"
                      : vehicle.status === 'MAINTENANCE'
                      ? "bg-yellow-500 text-white"
                      : "bg-red-500 text-white"
                  )}>
                    {vehicle.status === 'ACTIVE' ? 'Activo' :
                     vehicle.status === 'MAINTENANCE' ? 'Mantenimiento' : 'Inactivo'}
                  </div>
                </div>
              </div>

              {/* Vehicle Basic Info */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h1 className={cn(
                      "text-2xl font-bold mb-2",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      {vehicle.nickname}
                    </h1>
                    <p className={cn(
                      "text-lg",
                      theme === 'dark' ? "text-gray-300" : "text-gray-600"
                    )}>
                      {vehicle.make} {vehicle.model} • {vehicle.model_year}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      VIN
                    </p>
                    <p className={cn(
                      "font-mono text-sm",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      {vehicle.vin}
                    </p>
                  </div>
                </div>

                {/* Vehicle Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Tipo
                    </p>
                    <p className={cn(
                      "text-sm font-medium",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      {vehicle.body_type}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Color
                    </p>
                    <p className={cn(
                      "text-sm font-medium",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      {vehicle.color}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Disponibilidad
                    </p>
                    <div className={cn(
                      "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                      vehicle.availability === 'AVAILABLE'
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    )}>
                      {vehicle.availability === 'AVAILABLE' ? 'Disponible' : 'Ocupado'}
                    </div>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      ID
                    </p>
                    <p className={cn(
                      "text-xs font-mono",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      {vehicle.id}
                    </p>
                  </div>
                </div>

                {/* Capacity Information */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className={cn(
                    "text-lg font-semibold mb-4",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Capacidad de Carga
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <span className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        Peso Métrico
                      </span>
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "text-lg font-bold",
                          theme === 'dark' ? "text-gray-200" : "text-gray-900"
                        )}>
                          {vehicle.capacity?.weight_kg?.toLocaleString() || '0'}
                        </p>
                        <span className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          kg
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        Volumen Métrico
                      </span>
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "text-lg font-bold",
                          theme === 'dark' ? "text-gray-200" : "text-gray-900"
                        )}>
                          {vehicle.capacity?.volume_cubic_m || '0'}
                        </p>
                        <span className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          m³
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Performance and Maintenance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Performance Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  "rounded-2xl border p-6",
                  theme === 'dark'
                    ? "bg-gray-800/50 border-gray-700 backdrop-blur-lg"
                    : "bg-white border-gray-200 shadow-lg"
                )}
              >
                <h3 className={cn(
                  "text-lg font-semibold mb-4 flex items-center gap-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  <Gauge className="w-5 h-5" />
                  Rendimiento
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Millaje Actual
                    </span>
                    <span className={cn(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      {vehicle.performance?.current_mileage.toLocaleString() || 'N/A'} mi
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Eficiencia (MPG)
                    </span>
                    <span className={cn(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      {vehicle.performance?.average_mpg || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Tipo de Combustible
                    </span>
                    <span className={cn(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      {vehicle.performance?.fuel_type || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Viajes Completados
                    </span>
                    <span className={cn(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      {vehicle.performance?.trips_completed || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Distancia Total
                    </span>
                    <span className={cn(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      {vehicle.performance?.total_distance.toLocaleString() || 'N/A'} mi
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Maintenance Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  "rounded-2xl border p-6",
                  theme === 'dark'
                    ? "bg-gray-800/50 border-gray-700 backdrop-blur-lg"
                    : "bg-white border-gray-200 shadow-lg"
                )}
              >
                <h3 className={cn(
                  "text-lg font-semibold mb-4 flex items-center gap-2",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  <Wrench className="w-5 h-5" />
                  Mantenimiento
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Último Servicio
                    </span>
                    <span className={cn(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      {vehicle.maintenance?.last_service_date || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Próximo Servicio
                    </span>
                    <span className={cn(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      {vehicle.maintenance?.next_service_date || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Costo Total Mantenimiento
                    </span>
                    <span className={cn(
                      "text-sm font-bold",
                      theme === 'dark' ? "text-gray-200" : "text-gray-900"
                    )}>
                      ${vehicle.maintenance?.total_cost?.toLocaleString() || '0'}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Maintenance History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                "rounded-2xl border p-6",
                theme === 'dark'
                  ? "bg-gray-800/50 border-gray-700 backdrop-blur-lg"
                  : "bg-white border-gray-200 shadow-lg"
              )}
            >
              <h3 className={cn(
                "text-lg font-semibold mb-4 flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Clock className="w-5 h-5" />
                Historial de Mantenimiento
              </h3>

              {vehicle.maintenance?.service_history && vehicle.maintenance.service_history.length > 0 ? (
                <div className="space-y-3">
                  {vehicle.maintenance.service_history.map((service) => (
                    <div
                      key={service.id}
                      className={cn(
                        "p-4 rounded-lg border",
                        theme === 'dark'
                          ? "bg-gray-700/50 border-gray-600"
                          : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className={cn(
                            "font-medium",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            {service.type}
                          </h4>
                          <p className={cn(
                            "text-sm mt-1",
                            theme === 'dark' ? "text-gray-300" : "text-gray-600"
                          )}>
                            {service.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "font-bold",
                            theme === 'dark' ? "text-green-400" : "text-green-600"
                          )}>
                            ${service.cost}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className={cn(
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          {service.date} • {service.provider}
                        </span>
                        <span className={cn(
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          {service.mileage.toLocaleString()} mi
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    No hay historial de servicios disponible
                  </p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Column - Driver and Insurance */}
          <div className="space-y-6">
            {/* Driver Information */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                "rounded-2xl border p-6",
                theme === 'dark'
                  ? "bg-gray-800/50 border-gray-700 backdrop-blur-lg"
                  : "bg-white border-gray-200 shadow-lg"
              )}
            >
              <h3 className={cn(
                "text-lg font-semibold mb-4 flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <User className="w-5 h-5" />
                Conductor Asignado
              </h3>

              {vehicle.driver ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-white font-medium",
                      theme === 'dark' ? "bg-blue-600" : "bg-blue-500"
                    )}>
                      {vehicle.driver.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className={cn(
                        "font-medium",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        {vehicle.driver.name}
                      </h4>
                      <p className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        {vehicle.driver.experience_years} años de experiencia
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-300" : "text-gray-600"
                      )}>
                        {vehicle.driver.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-300" : "text-gray-600"
                      )}>
                        {vehicle.driver.phone}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? "text-gray-300" : "text-gray-600"
                      )}>
                        Licencia: {vehicle.driver.license_number}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <User className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>
                    Sin conductor asignado
                  </p>
                </div>
              )}
            </motion.div>

            {/* Insurance Information */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className={cn(
                "rounded-2xl border p-6",
                theme === 'dark'
                  ? "bg-gray-800/50 border-gray-700 backdrop-blur-lg"
                  : "bg-white border-gray-200 shadow-lg"
              )}
            >
              <h3 className={cn(
                "text-lg font-semibold mb-4 flex items-center gap-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Shield className="w-5 h-5" />
                Información de Seguro
              </h3>

              {vehicle.insurance ? (
                <div className="space-y-4">
                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Compañía
                    </p>
                    <p className={cn(
                      "font-medium",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      {vehicle.insurance.company}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Número de Póliza
                    </p>
                    <p className={cn(
                      "font-mono text-sm",
                      theme === 'dark' ? "text-gray-200" : "text-gray-800"
                    )}>
                      {vehicle.insurance.policy_number}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Tipo de Cobertura
                    </p>
                    <p className={cn(
                      "font-medium",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      {vehicle.insurance.coverage_type}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Prima Mensual
                    </p>
                    <p className={cn(
                      "font-bold text-lg",
                      theme === 'dark' ? "text-green-400" : "text-green-600"
                    )}>
                      ${vehicle.insurance.premium_monthly.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className={cn(
                      "text-sm font-medium mb-1",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      Fecha de Vencimiento
                    </p>
                    <p className={cn(
                      "font-medium",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      {vehicle.insurance.expiration_date}
                    </p>
                  </div>

                  {vehicle.insurance.is_active && (
                    <div className="flex items-center justify-center gap-2 mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Póliza vigente
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className={cn(
                    "text-sm",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>
                    Sin información de seguro
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  )
}

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(' ')
}