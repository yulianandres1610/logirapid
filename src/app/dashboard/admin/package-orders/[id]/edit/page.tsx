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

interface PackageOrder {
  id: number
  orderNumber: string
  customerId: number
  customerName: string
  customerAddress?: string
  services: string[]
  serviceQuantities?: { [serviceName: string]: number }
  needsBoxConstruction?: { [serviceName: string]: boolean }
  notes?: string
  scheduledDate?: string
  timeSlot?: string
  status: 'pending' | 'scheduled' | 'picked_up' | 'delivered' | 'cancelled'
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
  '08:00 AM - 10:00 AM',
  '10:00 AM - 12:00 PM',
  '12:00 PM - 02:00 PM',
  '02:00 PM - 04:00 PM',
  '04:00 PM - 06:00 PM'
]

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
  const [formData, setFormData] = useState({
    status: 'pending' as const,
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
        setOrder(data.data)
        setSelectedServices(data.data.services || [])
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

  // Handle service selection
  const toggleService = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    )
  }

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
    // If we have saved order data with totalAmount, use that
    if (order && order.totalAmount && order.totalAmount > 0) {
      return order.subtotal || calculateOrderTotal(order.services, order.serviceQuantities || {}, order.needsBoxConstruction || {})
    }

    // Otherwise calculate from current selections
    return selectedServices.reduce((total, service) => {
      const quantity = order?.serviceQuantities?.[service] || 1
      const needsConstruction = order?.needsBoxConstruction?.[service] || false
      let unitPrice = 0
      if (service.toLowerCase().includes('caja') || service.toLowerCase().includes('box')) {
        unitPrice = needsConstruction ? 70 : 65
      }
      return total + (unitPrice * quantity)
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
      const response = await fetch(`/api/package-orders/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: selectedServices,
          ...formData
        })
      })

      if (response.ok) {
        const data = await response.json()
        setOrder(data.data)
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
                className="flex items-center gap-2"
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
                    Servicios
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {AVAILABLE_SERVICES.map((service) => (
                      <label
                        key={service}
                        className={cn(
                          'flex items-center p-3 rounded-lg border cursor-pointer transition-all',
                          'hover:border-exa-primary hover:bg-exa-primary/5',
                          selectedServices.includes(service)
                            ? 'border-exa-primary bg-exa-primary/10'
                            : 'border-gray-200 dark:border-gray-600'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedServices.includes(service)}
                          onChange={() => toggleService(service)}
                          className="mr-3 text-exa-primary focus:ring-exa-primary"
                        />
                        <span className={cn(
                          'text-sm font-medium',
                          selectedServices.includes(service)
                            ? 'text-exa-primary dark:text-exa-secondary'
                            : 'text-gray-700 dark:text-gray-300'
                        )}>
                          {service}
                        </span>
                      </label>
                    ))}
                  </div>
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
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { value: 'pending', label: 'Pendiente' },
                      { value: 'scheduled', label: 'Programado' },
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
                </motion.div>

                {/* Schedule */}
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
                    Programación
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Fecha Programada
                      </label>
                      <input
                        type="date"
                        value={formData.scheduledDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                        className={cn(
                          'w-full px-4 py-2 rounded-lg border transition-colors',
                          'focus:outline-none focus:ring-2 focus:ring-exa-primary',
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300 text-gray-900'
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Franja Horaria
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
                </motion.div>

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
                {order && order.services && order.services.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Resumen Financiero
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {order.services.map((service, index) => {
                        const quantity = order.serviceQuantities?.[service] || 1
                        const isBoxService = service.toLowerCase().includes('caja') || service.toLowerCase().includes('box')
                        const needsConstruction = order.needsBoxConstruction?.[service] || false
                        const unitPrice = isBoxService ? (needsConstruction ? 70 : 65) : 0
                        const subtotal = unitPrice * quantity
                        const constructionText = isBoxService && needsConstruction ? ' (Con confección)' : ''

                        return (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-blue-100 dark:border-blue-800/50 last:border-b-0">
                            <span className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              {service}{constructionText}
                              <span className="text-xs text-gray-500">x{quantity}</span>
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              ${subtotal.toFixed(2)}
                            </span>
                          </div>
                        )
                      })}

                      <div className="flex justify-between items-center pt-3 border-t border-blue-200 dark:border-blue-800">
                        <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                          <Calculator className="w-4 h-4" />
                          Subtotal:
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          ${calculateSubtotal().toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">
                          Impuesto (7%):
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          ${calculateFinancialSummary().tax.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-blue-200 dark:border-blue-800">
                        <span className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-green-600" />
                          Total:
                        </span>
                        <span className="text-xl font-bold text-green-600 dark:text-green-400">
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
                    className="flex-1 bg-exa-primary hover:bg-exa-primary/90 text-white"
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