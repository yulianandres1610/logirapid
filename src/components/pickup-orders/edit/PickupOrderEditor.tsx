'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, MapPin, Calendar, Package2, FileText, Loader2, Save, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import MapboxAddressAutofill from '@/components/ui/MapboxAddressAutofill'

interface AddressData {
  street: string
  apartment: string
  city: string
  state: string
  zipCode: string
  country: string
}

interface OrderData {
  customerName: string
  customerPhone: string
  customerEmail: string
  customerAddress: string
  addressData: AddressData
  scheduledDate: string
  timeSlot: string
  services: string[]
  pickupInstructions: string
  latitude?: number | null
  longitude?: number | null
}

interface PickupOrderEditorProps {
  orderId: number
  initialData: OrderData
  onSave: () => void
}

const AVAILABLE_SERVICES = [
  'Paquetería',
  'Documentos',
  'Mensajería Express',
  'Carga Pesada',
  'Frágil',
  'Refrigerado'
]

const TIME_SLOTS = [
  { id: 'morning', label: '8:00 AM - 12:00 PM' },
  { id: 'afternoon', label: '12:00 PM - 4:00 PM' },
  { id: 'evening', label: '4:00 PM - 8:00 PM' }
]

type SectionKey = 'customer' | 'address' | 'schedule' | 'services' | 'instructions'

export default function PickupOrderEditor({ orderId, initialData, onSave }: PickupOrderEditorProps) {
  const { theme } = useTheme()
  const [formData, setFormData] = useState<OrderData>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    new Set(['customer', 'address', 'schedule', 'services'])
  )

  useEffect(() => {
    setFormData(initialData)
  }, [initialData])

  const toggleSection = (section: SectionKey) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handleInputChange = (field: keyof OrderData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleServiceToggle = (service: string) => {
    setFormData(prev => {
      const services = prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
      return { ...prev, services }
    })
  }

  const handleAddressChange = (data: AddressData) => {
    const addressString = `${data.street}${data.apartment ? ', ' + data.apartment : ''}, ${data.city}, ${data.state}, ${data.zipCode}, ${data.country}`
    setFormData(prev => ({
      ...prev,
      customerAddress: addressString,
      addressData: data
    }))
  }

  const handleCoordinatesChange = (coordinates: { latitude: number; longitude: number } | null) => {
    setFormData(prev => ({
      ...prev,
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude
    }))
  }

  const handleSave = async () => {
    if (!formData.customerName.trim()) {
      setErrorMessage('El nombre del cliente es requerido')
      setSaveStatus('error')
      setTimeout(() => {
        setSaveStatus('idle')
        setErrorMessage('')
      }, 3000)
      return
    }

    if (!formData.customerAddress.trim()) {
      setErrorMessage('La dirección es requerida')
      setSaveStatus('error')
      setTimeout(() => {
        setSaveStatus('idle')
        setErrorMessage('')
      }, 3000)
      return
    }

    if (!formData.scheduledDate) {
      setErrorMessage('La fecha de recogida es requerida')
      setSaveStatus('error')
      setTimeout(() => {
        setSaveStatus('idle')
        setErrorMessage('')
      }, 3000)
      return
    }

    if (formData.services.length === 0) {
      setErrorMessage('Debe seleccionar al menos un servicio')
      setSaveStatus('error')
      setTimeout(() => {
        setSaveStatus('idle')
        setErrorMessage('')
      }, 3000)
      return
    }

    setIsSaving(true)
    setSaveStatus('idle')
    setErrorMessage('')

    try {
      const response = await fetch(`/api/pickup-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.customerName,
          customerAddress: formData.customerAddress,
          customerPhone: formData.customerPhone,
          customerEmail: formData.customerEmail,
          scheduledDate: formData.scheduledDate,
          timeSlot: formData.timeSlot,
          services: formData.services,
          pickupInstructions: formData.pickupInstructions,
          latitude: formData.latitude,
          longitude: formData.longitude
        })
      })

      const data = await response.json()

      if (data.success) {
        setSaveStatus('success')
        setTimeout(() => {
          setSaveStatus('idle')
          onSave()
        }, 1500)
      } else {
        setSaveStatus('error')
        setErrorMessage(data.error || 'Error al guardar cambios')
        setTimeout(() => {
          setSaveStatus('idle')
          setErrorMessage('')
        }, 3000)
      }
    } catch (error) {
      console.error('Error saving order:', error)
      setSaveStatus('error')
      setErrorMessage('Error de conexión al servidor')
      setTimeout(() => {
        setSaveStatus('idle')
        setErrorMessage('')
      }, 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const Section = ({
    id,
    icon: Icon,
    title,
    subtitle,
    gradient,
    children
  }: {
    id: SectionKey
    icon: any
    title: string
    subtitle?: string
    gradient: string
    children: React.ReactNode
  }) => {
    const isExpanded = expandedSections.has(id)

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-2xl border shadow-lg overflow-hidden',
          theme === 'dark'
            ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
            : 'bg-white border-gray-200'
        )}
      >
        <button
          onClick={() => toggleSection(id)}
          className={cn(
            'w-full p-6 flex items-center justify-between transition-colors',
            theme === 'dark' ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center',
              gradient
            )}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h3 className={cn(
                'text-lg font-semibold',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {title}
              </h3>
              {subtitle && (
                <p className={cn(
                  'text-sm',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className={cn(
              'w-5 h-5',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )} />
          ) : (
            <ChevronDown className={cn(
              'w-5 h-5',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )} />
          )}
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-6 pb-6">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Customer Information */}
      <Section
        id="customer"
        icon={User}
        title="Información del Cliente"
        subtitle="Datos de contacto del remitente"
        gradient="bg-gradient-to-br from-purple-600 to-purple-700"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className={cn(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => handleInputChange('customerName', e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-xl border text-sm',
                'focus:outline-none focus:ring-2 focus:ring-purple-500',
                theme === 'dark'
                  ? 'bg-gray-700/50 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </div>

          <div>
            <label className={cn(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Teléfono
            </label>
            <input
              type="tel"
              value={formData.customerPhone}
              onChange={(e) => handleInputChange('customerPhone', e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-xl border text-sm',
                'focus:outline-none focus:ring-2 focus:ring-purple-500',
                theme === 'dark'
                  ? 'bg-gray-700/50 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </div>

          <div className="md:col-span-2">
            <label className={cn(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Email
            </label>
            <input
              type="email"
              value={formData.customerEmail}
              onChange={(e) => handleInputChange('customerEmail', e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-xl border text-sm',
                'focus:outline-none focus:ring-2 focus:ring-purple-500',
                theme === 'dark'
                  ? 'bg-gray-700/50 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </div>
        </div>
      </Section>

      {/* Address */}
      <Section
        id="address"
        icon={MapPin}
        title="Dirección de Recogida"
        subtitle="Ubicación donde se recogerán los paquetes"
        gradient="bg-gradient-to-br from-blue-600 to-blue-700"
      >
        <div className="mt-4">
          <MapboxAddressAutofill
            value={formData.addressData}
            onChange={handleAddressChange}
            onCoordinatesChange={handleCoordinatesChange}
          />
        </div>
      </Section>

      {/* Schedule */}
      <Section
        id="schedule"
        icon={Calendar}
        title="Programación de Recogida"
        subtitle="Fecha y horario preferido"
        gradient="bg-gradient-to-br from-green-600 to-green-700"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className={cn(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Fecha de Recogida <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.scheduledDate}
              onChange={(e) => handleInputChange('scheduledDate', e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-xl border text-sm',
                'focus:outline-none focus:ring-2 focus:ring-green-500',
                theme === 'dark'
                  ? 'bg-gray-700/50 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            />
          </div>

          <div>
            <label className={cn(
              'block text-sm font-medium mb-2',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              Horario Preferido
            </label>
            <select
              value={formData.timeSlot}
              onChange={(e) => handleInputChange('timeSlot', e.target.value)}
              className={cn(
                'w-full px-4 py-3 rounded-xl border text-sm',
                'focus:outline-none focus:ring-2 focus:ring-green-500',
                theme === 'dark'
                  ? 'bg-gray-700/50 border-gray-600 text-white'
                  : 'bg-white border-gray-300 text-gray-900'
              )}
            >
              <option value="">Seleccionar horario</option>
              {TIME_SLOTS.map(slot => (
                <option key={slot.id} value={slot.id}>{slot.label}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* Services */}
      <Section
        id="services"
        icon={Package2}
        title="Servicios Solicitados"
        subtitle={`${formData.services.length} servicio${formData.services.length !== 1 ? 's' : ''} seleccionado${formData.services.length !== 1 ? 's' : ''}`}
        gradient="bg-gradient-to-br from-orange-600 to-orange-700"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
          {AVAILABLE_SERVICES.map(service => (
            <motion.button
              key={service}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleServiceToggle(service)}
              className={cn(
                'px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                formData.services.includes(service)
                  ? 'border-orange-500 bg-orange-500 text-white shadow-lg'
                  : theme === 'dark'
                    ? 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-orange-500'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-orange-500'
              )}
            >
              {service}
            </motion.button>
          ))}
        </div>
        {formData.services.length === 0 && (
          <p className={cn(
            'text-sm text-center mt-3',
            theme === 'dark' ? 'text-red-400' : 'text-red-600'
          )}>
            Debe seleccionar al menos un servicio
          </p>
        )}
      </Section>

      {/* Instructions */}
      <Section
        id="instructions"
        icon={FileText}
        title="Instrucciones Especiales"
        subtitle="Indicaciones adicionales para el conductor (opcional)"
        gradient="bg-gradient-to-br from-indigo-600 to-indigo-700"
      >
        <div className="mt-4">
          <textarea
            value={formData.pickupInstructions}
            onChange={(e) => handleInputChange('pickupInstructions', e.target.value)}
            rows={4}
            placeholder="Ej: Tocar el timbre dos veces, buscar en la recepción del edificio, etc."
            className={cn(
              'w-full px-4 py-3 rounded-xl border text-sm resize-none',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500',
              theme === 'dark'
                ? 'bg-gray-700/50 border-gray-600 text-white placeholder-gray-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            )}
          />
        </div>
      </Section>

      {/* Error Message */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'p-4 rounded-xl text-sm font-medium text-center',
              theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'
            )}
          >
            {errorMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={handleSave}
        disabled={isSaving}
        className={cn(
          'w-full py-4 rounded-xl font-semibold text-white text-lg',
          'flex items-center justify-center gap-3',
          'transition-all duration-200 shadow-lg',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          saveStatus === 'success' && 'bg-green-600',
          saveStatus === 'error' && 'bg-red-600',
          saveStatus === 'idle' && (theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600')
        )}
      >
        {isSaving ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            Guardando cambios...
          </>
        ) : saveStatus === 'success' ? (
          <>
            <Save className="w-6 h-6" />
            ¡Guardado exitosamente!
          </>
        ) : (
          <>
            <Save className="w-6 h-6" />
            Guardar Cambios
          </>
        )}
      </motion.button>
    </motion.div>
  )
}
