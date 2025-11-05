'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  Save,
  X,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  AlertCircle,
  DollarSign,
  Receipt,
  Calculator
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { AdvancedServicePackageManager } from '@/components/services/AdvancedServicePackageManager'

interface PackageSize {
  id: number
  codigo: string
  tamano: 'pequeno' | 'mediano' | 'grande'
  tipo: string
  descripcion: string
}

interface PackageOrder {
  id: number
  orderNumber: string
  customerId: number
  customerName: string
  customerAddress?: string
  services: string[]
  serviceQuantities?: { [serviceName: string]: number }
  needsBoxConstruction?: { [serviceName: string]: boolean }
  servicePackages?: { [serviceName: string]: string[] }
  boxSize?: string
  boxQuantity?: number
  notes?: string
  scheduledDate?: string
  timeSlot?: string
  status: 'pending' | 'in_transit' | 'reprogrammed' | 'picked_up' | 'delivered' | 'cancelled'
  createdAt: string
  updatedAt: string
  firstName?: string
  lastName?: string
  totalAmount?: number
  subtotal?: number
  taxAmount?: number
  boxCount?: number
  boxPrice?: number
  additionalServices?: string
  phone?: string
  email?: string
  address?: string
  customerNotes?: string
}

const AVAILABLE_SERVICES = [
  'Recogida Caja',
  'Entrega de Caja',
  'Recogida Duraderos',
  'Confección de Caja'
]

// Service pricing configuration
const SERVICE_PRICES = {
  'Recogida Caja': 0,
  'Entrega de Caja': 0,
  'Recogida Duraderos': 0,
  'Confección de Caja': 0
}

// Function to calculate order total with correct pricing logic
const calculateOrderTotal = (services: string[], serviceQuantities: {[key: string]: number}, needsBoxConstruction: {[key: string]: boolean}) => {
  return services.reduce((total, serviceName) => {
    const quantity = serviceQuantities[serviceName] || 1
    const isBoxService = serviceName.toLowerCase().includes('caja') || serviceName.toLowerCase().includes('box')
    const needsConstruction = needsBoxConstruction[serviceName] || false

    let unitPrice = 0
    if (isBoxService) {
      unitPrice = needsConstruction ? 70 : 65
    } else if (serviceName.toLowerCase().includes('duradero')) {
      unitPrice = 0
    } else {
      unitPrice = 0
    }

    return total + (unitPrice * quantity)
  }, 0)
}

const TIME_SLOTS = [
  '8:00 AM - 12:00 PM',
  '12:00 PM - 4:00 PM',
  '4:00 PM - 8:00 PM'
]

const BOX_SIZES = [
  { value: 'pequeno', label: 'Pequeño', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { value: 'mediano', label: 'Mediano', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'grande', label: 'Grande', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' }
]

// Función para obtener la fecha mínima (mañana)
const getMinDate = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0]
}

// Función para formatear fecha a un formato legible
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString + 'T00:00:00')
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
  return date.toLocaleDateString('es-ES', options)
}

// Función para obtener el nombre del día de mañana
const getTomorrowName = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const options: Intl.DateTimeFormatOptions = { weekday: 'long' }
  return tomorrow.toLocaleDateString('es-ES', options)
}

export default function EditPackageOrderPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [order, setOrder] = useState<PackageOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [serviceConfigurations, setServiceConfigurations] = useState<{ [serviceName: string]: any }>({})
  const [formData, setFormData] = useState({
    status: 'pending' as 'pending' | 'reprogrammed' | 'in_transit' | 'delivered' | 'cancelled',
    scheduledDate: '',
    timeSlot: '',
    notes: ''
  })

  // Fetch order details
  const fetchOrder = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/package-orders/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        // Parsear campos JSON si vienen como string
        let services = []
        let serviceQuantities = {}
        let servicePackages = {}

        if (data.data.services) {
          if (typeof data.data.services === 'string') {
            try {
              services = JSON.parse(data.data.services)
            } catch (e) {
              services = []
            }
          } else if (Array.isArray(data.data.services)) {
            services = data.data.services
          }
        }

        if (data.data.serviceQuantities) {
          if (typeof data.data.serviceQuantities === 'string') {
            try {
              serviceQuantities = JSON.parse(data.data.serviceQuantities)
            } catch (e) {
              serviceQuantities = {}
            }
          } else if (typeof data.data.serviceQuantities === 'object') {
            serviceQuantities = data.data.serviceQuantities
          }
        }

        if (data.data.servicePackages) {
          if (typeof data.data.servicePackages === 'string') {
            try {
              servicePackages = JSON.parse(data.data.servicePackages)
            } catch (e) {
              servicePackages = {}
            }
          } else if (typeof data.data.servicePackages === 'object') {
            servicePackages = data.data.servicePackages
          }
        }

        const processedOrder = {
          ...data.data,
          services: services,
          serviceQuantities: serviceQuantities,
          servicePackages: servicePackages
        }

        setOrder(processedOrder)
        setSelectedServices(services)

        // Convertir el formato antiguo al nuevo formato de configuraciones
        const initialConfigurations: { [serviceName: string]: any } = {}
        services.forEach((serviceName: string) => {
          const quantity = (serviceQuantities as { [key: string]: number })[serviceName] || 1
          const packages = (servicePackages as { [key: string]: string[] })[serviceName] || []

          initialConfigurations[serviceName] = {
            serviceName: serviceName,
            cajas: []
          }

          // Si hay paquetes asignados, tratar de extraer el tamaño y cantidad
          if (packages.length > 0) {
            // Agrupar por tamaño (asumiendo que los códigos tienen información de tamaño)
            const boxesBySize: { [size: string]: string[] } = {}
            packages.forEach((pack: any) => {
              const size = pack.tamano || 'mediano' // fallback
              if (!boxesBySize[size]) boxesBySize[size] = []
              if (pack.codigo) boxesBySize[size].push(pack.codigo)
            })

            // Crear configuraciones por tamaño
            Object.entries(boxesBySize).forEach(([size, codes]) => {
              const boxCount = Math.ceil(codes.length / quantity) || 1
              initialConfigurations[serviceName].cajas.push({
                tamano: size as any,
                cantidad: boxCount,
                codigos: codes
              })
            })
          }
        })

        setServiceConfigurations(initialConfigurations)

        setFormData({
          status: data.data.status || 'pending',
          scheduledDate: data.data.scheduledDate || '',
          timeSlot: data.data.timeSlot || '',
          notes: data.data.notes || ''
        })
      } else {
        showNotification('error', 'Error', 'No se pudo cargar la orden')
        router.push('/dashboard/admin/package-orders')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      showNotification('error', 'Error', 'No se pudo cargar la orden')
      router.push('/dashboard/admin/package-orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (params.id) {
      fetchOrder()
    }
  }, [params.id])

  // Efecto para manejar la reprogramación automática
  useEffect(() => {
    if (formData.status === 'reprogrammed') {
      // Siempre establecer la fecha del día siguiente cuando está en estado reprogramado
      // Esto asegura que la fecha sea correcta cada vez que se cambia el estado
      const tomorrow = getMinDate()
      if (formData.scheduledDate !== tomorrow) {
        setFormData(prev => ({
          ...prev,
          scheduledDate: tomorrow
        }))
      }
    }
  }, [formData.status])

  
  // Calculate financial summary
  const calculateFinancialSummary = () => {
    // Use saved order data if available, otherwise calculate from selected services
    let subtotal, tax, total

    if (order && order.totalAmount && order.totalAmount > 0) {
      // Use saved order amounts
      subtotal = order.subtotal || calculateOrderTotal(order.services, order.serviceQuantities || {}, order.needsBoxConstruction || {})
      tax = order.taxAmount || (subtotal * 0.07)
      total = order.totalAmount
    } else {
      // Fallback to calculation based on current selections
      subtotal = selectedServices.reduce((total, service) => {
        const quantity = order?.serviceQuantities?.[service] || 1
        const needsConstruction = order?.needsBoxConstruction?.[service] || false
        let unitPrice = 0
        if (service.toLowerCase().includes('caja') || service.toLowerCase().includes('box')) {
          unitPrice = needsConstruction ? 70 : 65
        }
        return total + (unitPrice * quantity)
      }, 0)
      tax = subtotal * 0.07
      total = subtotal + tax
    }

    return {
      subtotal,
      tax,
      total,
      serviceCount: selectedServices.length
    }
  }

  // Calculate subtotal for individual service display
  const calculateSubtotal = () => {
    // Calculate from current configurations
    return selectedServices.reduce((total, service) => {
      const config = serviceConfigurations[service]
      if (!config || !config.cajas) return total

      const needsConstruction = order?.needsBoxConstruction?.[service] || false
      const unitPrice = service.toLowerCase().includes('caja') || service.toLowerCase().includes('box')
        ? (needsConstruction ? 70 : 65)
        : 0

      // Calcular total de cajas para este servicio
      const totalBoxes = config.cajas.reduce((sum: number, box: any) => sum + box.cantidad, 0)
      return total + (unitPrice * totalBoxes)
    }, 0)
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedServices.length === 0) {
      showNotification('error', 'Error', 'Debes seleccionar al menos un servicio')
      return
    }

    setSaving(true)

    try {
      // Convertir configuraciones al formato esperado por la API
      const serviceQuantitiesForSave: { [serviceName: string]: number } = {}
      const servicePackagesForSave: { [serviceName: string]: string[] } = {}

      Object.entries(serviceConfigurations).forEach(([serviceName, config]) => {
        const totalBoxes = config.cajas?.reduce((sum: number, box: any) => sum + box.cantidad, 0) || 0
        serviceQuantitiesForSave[serviceName] = totalBoxes

        // Recolectar todos los códigos de todos los tamaños
        const allCodes: string[] = []
        config.cajas?.forEach((box: any) => {
          if (box.codigos) {
            allCodes.push(...box.codigos)
          }
        })
        servicePackagesForSave[serviceName] = allCodes
      })

      const response = await fetch(`/api/package-orders/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: selectedServices,
          serviceQuantities: serviceQuantitiesForSave,
          servicePackages: servicePackagesForSave,
          ...formData
        })
      })

      if (response.ok) {
        const data = await response.json()
        // Parsear campos JSON si vienen como string
        let services = []
        let serviceQuantities = {}
        let needsBoxConstruction = {}

        if (data.data.services) {
          if (typeof data.data.services === 'string') {
            try {
              services = JSON.parse(data.data.services)
            } catch (e) {
              services = []
            }
          } else if (Array.isArray(data.data.services)) {
            services = data.data.services
          }
        }

        if (data.data.serviceQuantities) {
          if (typeof data.data.serviceQuantities === 'string') {
            try {
              serviceQuantities = JSON.parse(data.data.serviceQuantities)
            } catch (e) {
              serviceQuantities = {}
            }
          } else if (typeof data.data.serviceQuantities === 'object') {
            serviceQuantities = data.data.serviceQuantities
          }
        }

        if (data.data.needsBoxConstruction) {
          if (typeof data.data.needsBoxConstruction === 'string') {
            try {
              needsBoxConstruction = JSON.parse(data.data.needsBoxConstruction)
            } catch (e) {
              needsBoxConstruction = {}
            }
          } else if (typeof data.data.needsBoxConstruction === 'object') {
            needsBoxConstruction = data.data.needsBoxConstruction
          }
        }

        const updatedOrder = {
          ...data.data,
          services: services,
          serviceQuantities: serviceQuantities,
          needsBoxConstruction: needsBoxConstruction
        }
        setOrder(updatedOrder)
        showNotification('success', 'Orden Actualizada', 'La orden ha sido actualizada exitosamente')
        router.push(`/dashboard/admin/package-orders/${params.id}`)
      } else {
        throw new Error('Error updating order')
      }
    } catch (error) {
      console.error('Error updating order:', error)
      showNotification('error', 'Error', 'No se pudo actualizar la orden')
    } finally {
      setSaving(false)
    }
  }

  // Parse address from JSON if needed
  const parseAddress = (address?: string | object) => {
    if (!address) return null

    // If it's already an object, return as is
    if (typeof address === 'object' && address !== null) {
      return address
    }

    // If it's a string, try to parse as JSON
    try {
      return JSON.parse(address)
    } catch {
      return { street: address }
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 animate-spin rounded-full border-4 border-exa-primary border-t-transparent"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Cargando orden...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="min-h-screen p-6 flex items-center justify-center">
          <div className="text-center">
            <Package className="w-12 h-12 mx-auto text-gray-400" />
            <p className="mt-2 text-gray-600 dark:text-gray-400">Orden no encontrada</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const addressData = parseAddress(order?.address || order?.customerAddress)

  return (
    <DashboardLayout>
      <div className="min-h-screen p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/20"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Editar Orden #{order.orderNumber}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Modificar los detalles de la orden de paquetería
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Services Selection */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    'p-6 rounded-xl border border-gray-200 dark:border-gray-700',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Servicios y Empaques
                  </h2>

                  <AdvancedServicePackageManager
                  services={selectedServices}
                  serviceConfigurations={serviceConfigurations}
                  onServicesChange={setSelectedServices}
                  onServiceConfigurationsChange={setServiceConfigurations}
                />
                </motion.div>

                {/* Status */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={cn(
                    'p-6 rounded-xl border border-gray-200 dark:border-gray-700',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Estado de la Orden
                  </h2>
                  <div className="space-y-3">
                    {/* Mostrar estado En Ruta si aplica */}
                    {order.status === 'in_transit' && (
                      <div className="flex items-center p-3 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
                        <Package className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" />
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          Estado actual: En Ruta
                        </span>
                      </div>
                    )}

                    {/* Mostrar estado Pendiente si aplica */}
                    {order.status === 'pending' && (
                      <div className="flex items-center p-3 rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
                        <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3" />
                        <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                          Estado actual: Pendiente
                        </span>
                      </div>
                    )}

                    {/* Estados editables */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { value: 'reprogrammed', label: 'Reprogramada' },
                        { value: 'picked_up', label: 'Recogido' },
                        { value: 'delivered', label: 'Entregado' },
                        { value: 'cancelled', label: 'Cancelado' }
                      ].map((status) => (
                        <label
                          key={status.value}
                          className={cn(
                            'flex items-center p-3 rounded-lg border cursor-pointer transition-all',
                            'hover:border-exa-primary hover:bg-exa-primary/5',
                            formData.status === status.value
                              ? 'border-exa-primary bg-exa-primary/10'
                              : 'border-gray-200 dark:border-gray-600'
                          )}
                        >
                          <input
                            type="radio"
                            name="status"
                            value={status.value}
                            checked={formData.status === status.value}
                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                            className="mr-3 text-exa-primary focus:ring-exa-primary"
                          />
                          <span className={cn(
                            'text-sm font-medium',
                            formData.status === status.value
                              ? 'text-exa-primary dark:text-exa-secondary'
                              : 'text-gray-700 dark:text-gray-300'
                          )}>
                            {status.label}
                          </span>
                        </label>
                      ))}
                    </div>

                    {/* Nota sobre estados automáticos */}
                    {(order.status === 'in_transit' || order.status === 'pending') && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        <div>
                          {order.status === 'in_transit' && (
                            <>Nota: El estado "En Ruta" solo se modifica a través del sistema de gestión de rutas</>
                          )}
                          {order.status === 'pending' && (
                            <>Nota: El estado "Pendiente" se asigna automáticamente al crear una nueva orden</>
                          )}
                        </div>
                        <div className="mt-1">
                          Estados automáticos no se pueden modificar manualmente
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Schedule - Solo mostrar cuando está reprogramada */}
                {formData.status === 'reprogrammed' && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className={cn(
                      'p-6 rounded-xl border border-gray-200 dark:border-gray-700',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    )}
                  >
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Reprogramación
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Nueva Fecha Programada
                          <span className="text-xs text-amber-600 dark:text-amber-400 ml-2 font-medium">
                            (Día siguiente: {getTomorrowName()})
                          </span>
                        </label>
                        <input
                          type="date"
                          value={formData.scheduledDate}
                          min={getMinDate()}
                          onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                          className={cn(
                            'w-full px-4 py-2 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          )}
                        />
                        {formData.scheduledDate && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Fecha seleccionada: {formatDate(formData.scheduledDate)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Nueva Franja Horaria
                        </label>
                        <select
                          value={formData.timeSlot}
                          onChange={(e) => setFormData(prev => ({ ...prev, timeSlot: e.target.value }))}
                          className={cn(
                            'w-full px-4 py-2 rounded-lg border transition-colors',
                            'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                            theme === 'dark'
                              ? 'bg-gray-700 border-gray-600 text-white'
                              : 'bg-white border-gray-300 text-gray-900'
                          )}
                        >
                          <option value="">Seleccionar franja horaria</option>
                          {TIME_SLOTS.map((slot) => (
                            <option key={slot} value={slot}>{slot}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Nota informativa sobre reglas de reprogramación */}
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-amber-800 dark:text-amber-200">
                          <p className="font-medium mb-1">Reglas de reprogramación:</p>
                          <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300">
                            <li>Las paradas solo pueden reprogramarse para el día siguiente</li>
                            <li>Franjas horarias disponibles: 8:00 AM - 12:00 PM, 12:00 PM - 4:00 PM, 4:00 PM - 8:00 PM</li>
                            <li>No se permite reprogramar para el mismo día</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Notes */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className={cn(
                    'p-6 rounded-xl border border-gray-200 dark:border-gray-700',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Notas</h2>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    placeholder="Agregar notas adicionales sobre la orden..."
                    className={cn(
                      'w-full px-4 py-3 rounded-lg border transition-colors resize-none',
                      'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                      theme === 'dark'
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    )}
                  />
                </motion.div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Customer Information */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className={cn(
                    'p-6 rounded-xl border border-gray-200 dark:border-gray-700',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Información del Cliente
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Nombre</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim()}
                      </p>
                    </div>
                    {order.phone && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Teléfono</p>
                        <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {order.phone}
                        </p>
                      </div>
                    )}
                    {order.email && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Correo</p>
                        <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          {order.email}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Address */}
                {addressData && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className={cn(
                      'p-6 rounded-xl border border-gray-200 dark:border-gray-700',
                      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                    )}
                  >
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Dirección
                    </h2>
                    <div className="space-y-2">
                      {addressData.street && (
                        <p className="text-gray-700 dark:text-gray-300">{addressData.street}</p>
                      )}
                      {addressData.city && addressData.state && (
                        <p className="text-gray-700 dark:text-gray-300">
                          {addressData.city}, {addressData.state} {addressData.zipCode}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Financial Summary */}
                {selectedServices.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-gray-800 rounded-xl p-6 border border-gray-700"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        Resumen Financiero
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {selectedServices.map((service, index) => {
                        const config = serviceConfigurations[service]
                        const totalBoxes = config?.cajas?.reduce((sum: number, box: any) => sum + box.cantidad, 0) || 0
                        const isBoxService = service.toLowerCase().includes('caja') || service.toLowerCase().includes('box')
                        const needsConstruction = order?.needsBoxConstruction?.[service] || false
                        const unitPrice = isBoxService ? (needsConstruction ? 70 : 65) : 0
                        const subtotal = unitPrice * totalBoxes
                        const constructionText = isBoxService && needsConstruction ? ' (Con confección)' : ''

                        // Mostrar desglose por tamaño
                        const sizeDetails = config?.cajas?.map((box: any) =>
                          `${BOX_SIZES.find(s => s.value === box.tamano)?.label}: ${box.cantidad}`
                        ).join(', ') || ''

                        return (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-b-0">
                            <span className="text-gray-300 flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <div>
                                <div>{service}{constructionText}</div>
                                {sizeDetails && (
                                  <div className="text-xs text-gray-500">
                                    {sizeDetails} (Total: {totalBoxes})
                                  </div>
                                )}
                              </div>
                            </span>
                            <span className="font-medium text-white">
                              ${subtotal.toFixed(2)}
                            </span>
                          </div>
                        )
                      })}

                      <div className="flex justify-between items-center pt-3 border-t border-gray-600">
                        <span className="text-gray-400 flex items-center gap-2">
                          <Calculator className="w-4 h-4" />
                          Subtotal:
                        </span>
                        <span className="font-semibold text-white">
                          ${calculateSubtotal().toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">
                          Impuesto (7%):
                        </span>
                        <span className="font-semibold text-white">
                          ${calculateFinancialSummary().tax.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-gray-600">
                        <span className="text-lg font-bold text-white flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-green-400" />
                          Total:
                        </span>
                        <span className="text-xl font-bold text-green-400">
                          ${calculateFinancialSummary().total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex gap-3"
                >
                  <Button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Cancelar
                  </Button>
                </motion.div>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}