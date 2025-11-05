'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Package,
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Truck,
  Archive,
  Edit,
  Trash2,
  RefreshCw,
  DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import PackageDeliveryMap from '@/components/maps/PackageDeliveryMap'

interface PackageOrder {
  id: number
  orderNumber: string
  customerId: number
  customerName: string
  customerAddress?: string
  services: string[]
  notes?: string
  scheduledDate?: string
  timeSlot?: string
  status: 'pending' | 'scheduled' | 'picked_up' | 'delivered' | 'cancelled'
  createdAt: string
  updatedAt: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  address?: string
  customerNotes?: string
  // Coordinates for mapping
  latitude?: number | null
  longitude?: number | null
  driverName?: string
  totalAmount?: number
  total?: number
}

export default function PackageOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [order, setOrder] = useState<PackageOrder | null>(null)
  const [loading, setLoading] = useState(true)

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

        const processedOrder = {
          ...data.data,
          services: services,
          serviceQuantities: serviceQuantities,
          needsBoxConstruction: needsBoxConstruction
        }

        console.log('📅 Datos de orden cargados:', {
          id: processedOrder.id,
          status: processedOrder.status,
          scheduledDate: processedOrder.scheduledDate,
          timeSlot: processedOrder.timeSlot,
          updatedAt: processedOrder.updatedAt
        });

        // Forzar actualización del estado para asegurar refresco del componente
        setOrder(null)
        setTimeout(() => {
          setOrder(processedOrder)
        }, 10)
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

  // Helper function para formatear fechas consistentemente
  const formatDate = (dateString: string) => {
    console.log('🗓️ Formateando fecha:', dateString);

    // Crear fecha en UTC para evitar problemas de zona horaria
    const date = new Date(dateString + 'T00:00:00.000Z');
    console.log('🕐 Fecha creada:', date.toString());
    console.log('🌍 Zona horaria:', Intl.DateTimeFormat().resolvedOptions().timeZone);

    const formattedDate = date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });

    console.log('✅ Fecha formateada:', formattedDate);
    return formattedDate;
  };

  // Reprogramar orden
  const reprogramOrder = async () => {
    if (!order) return;

    // Mostrar diálogo simple para nueva fecha
    const newDate = window.prompt('Ingrese la nueva fecha (YYYY-MM-DD):', '2025-11-06');
    if (!newDate) return;

    const timeSlots = [
      '8:00 AM - 12:00 PM',
      '12:00 PM - 4:00 PM',
      '4:00 PM - 8:00 PM'
    ];

    const timeSlotIndex = window.prompt(
      'Seleccione la franja horaria:\n1. 8:00 AM - 12:00 PM\n2. 12:00 PM - 4:00 PM\n3. 4:00 PM - 8:00 PM\n\nIngrese el número (1-3):',
      '1'
    );

    if (!timeSlotIndex) return;

    const slotNum = parseInt(timeSlotIndex);
    if (slotNum < 1 || slotNum > 3 || isNaN(slotNum)) {
      showNotification('error', 'Error', 'Franja horaria inválida');
      return;
    }

    const newTimeSlot = timeSlots[slotNum - 1];

    const confirmReprogram = window.confirm(
      `¿Está seguro que desea reprogramar esta orden para:\n\nFecha: ${newDate}\nFranja: ${newTimeSlot}\n\nSe cambiará el estado a "Reprogramada" y se removerá de la ruta actual.`
    );

    if (!confirmReprogram) return;

    try {
      const response = await fetch(`/api/package-orders/${params.id}/reprogram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newScheduledDate: newDate,
          newTimeSlot: newTimeSlot
        }),
      });

      if (response.ok) {
        const data = await response.json();
        showNotification('success', 'Éxito', 'Orden reprogramada correctamente');

        // Forzar recarga completa de la orden desde la BD
        await new Promise(resolve => setTimeout(resolve, 500)); // Pequeña espera para asegurar que la BD se actualizó
        await fetchOrder(); // Refresh order data

        // Verificación adicional: mostrar los datos que se guardaron
        console.log('✅ Orden reprogramada:', data.data);
      } else {
        const errorData = await response.json();
        showNotification('error', 'Error', errorData.error || 'No se pudo reprogramar la orden');
        console.error('❌ Error en reprogramación:', errorData);
      }
    } catch (error) {
      console.error('Error reprogramming order:', error);
      showNotification('error', 'Error', 'No se pudo reprogramar la orden. Intente nuevamente.');
    }
  };

  useEffect(() => {
    if (params.id) {
      fetchOrder()
    }
  }, [params.id])

  const STATUSES = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: AlertCircle },
    scheduled: { label: 'Programado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: Calendar },
    picked_up: { label: 'Recogido', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Package },
    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
    // Additional common statuses that might exist in the database
    in_transit: { label: 'En Ruta', color: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg border border-blue-200 dark:from-blue-600 dark:to-indigo-700 dark:border-blue-400', icon: Package },
    reprogrammed: { label: 'Reprogramada', color: 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white shadow-lg border border-yellow-200 dark:from-yellow-600 dark:to-orange-700 dark:border-yellow-400', icon: AlertCircle },
    processing: { label: 'Procesando', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle },
    ready: { label: 'Listo', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400', icon: CheckCircle },
    failed: { label: 'Fallido', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle }
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

  const addressData = parseAddress(order?.address || order?.customerAddress)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen p-6 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-600 dark:text-gray-400">Cargando detalles de la orden...</p>
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
                  Orden #{order.orderNumber}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Detalles completos de la orden de paquetería
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {(order.status as any) === 'in_transit' && (
                <Button
                  onClick={reprogramOrder}
                  className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white flex items-center gap-2 shadow-lg"
                >
                  <Calendar className="w-4 h-4" />
                  Reprogramar
                </Button>
              )}
              <Button
                onClick={() => router.push(`/dashboard/admin/package-orders/${order.id}/edit`)}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Editar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Information */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  'p-6 rounded-xl border border-gray-200 dark:border-gray-700',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Información de la Orden
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Número de Orden</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">{order.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Estado</p>
                    <span className={cn(
                      'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                      STATUSES[order.status]?.color || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                    )}>
                      {(() => {
                        const StatusIcon = STATUSES[order.status]?.icon || AlertCircle
                        return <StatusIcon className="w-4 h-4 mr-2" />
                      })()}
                      {STATUSES[order.status]?.label || order.status || 'Desconocido'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Fecha de Creación</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      {new Date(order.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Última Actualización</p>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      {new Date(order.updatedAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Services */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn(
                  'p-6 rounded-xl border border-gray-200 dark:border-gray-700',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Archive className="w-5 h-5" />
                  Servicios Solicitados
                </h2>
                <div className="flex flex-wrap gap-2">
                  {order.services.map((service, index) => (
                    <span
                      key={index}
                      className={cn(
                        'inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium',
                        service.toLowerCase().includes('recogida') || service.toLowerCase().includes('pickup')
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      )}
                    >
                      {service.toLowerCase().includes('recogida') || service.toLowerCase().includes('pickup') ? (
                        <Archive className="w-4 h-4 mr-2" />
                      ) : (
                        <Truck className="w-4 h-4 mr-2" />
                      )}
                      {service}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Map */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className={cn(
                  'p-6 rounded-xl border border-gray-200 dark:border-gray-700',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Ubicación de la Orden
                </h2>
                <div className="h-96 rounded-lg overflow-hidden">
                  <PackageDeliveryMap
                    orders={[order]}
                    onOrderClick={(selectedOrder) => {
                      console.log('Order clicked:', selectedOrder)
                    }}
                  />
                </div>
              </motion.div>

              {/* Notes */}
              {order.notes && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className={cn(
                    'p-6 rounded-xl border border-gray-200 dark:border-gray-700',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Notas de la Orden</h2>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{order.notes}</p>
                </motion.div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Customer Information */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
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
                    <p className="text-sm text-gray-600 dark:text-gray-400">Nombre Completo</p>
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
                      <p className="text-sm text-gray-600 dark:text-gray-400">Correo Electrónico</p>
                      <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {order.email}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Address Information */}
              {addressData && (
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

              {/* Schedule Information */}
              {order.scheduledDate && (
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
                    <Calendar className="w-5 h-5" />
                    Programación
                  </h2>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Fecha Programada</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDate(order.scheduledDate)}
                      </p>
                    </div>
                    {order.timeSlot && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Franja Horaria</p>
                        <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {order.timeSlot}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Driver Information */}
              {order.driverName && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 }}
                  className={cn(
                    'p-4 rounded-xl border border-gray-200 dark:border-gray-700',
                    theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30">
                      <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Conductor Asignado</p>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{order.driverName}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Financial Summary - Minimalist */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className={cn(
                  'p-4 rounded-xl border border-gray-200 dark:border-gray-700',
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de la Orden</span>
                  </div>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    ${(order.totalAmount || order.total || 0).toFixed(2)}
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  )
}