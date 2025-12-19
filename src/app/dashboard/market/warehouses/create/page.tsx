'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Warehouse,
  MapPin,
  User,
  Phone,
  Mail,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Loader2,
  Star,
  Building,
  Store,
  Package,
  Settings
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import MapboxAddressAutofill from '@/components/ui/MapboxAddressAutofill'

type Step = 'info' | 'location' | 'manager' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 'info', title: 'Información', description: 'Datos básicos', icon: Building },
  { id: 'location', title: 'Ubicación', description: 'Dirección y mapa', icon: MapPin },
  { id: 'manager', title: 'Responsable', description: 'Contacto', icon: User },
  { id: 'review', title: 'Revisión', description: 'Confirmar datos', icon: Check }
]

const WAREHOUSE_TYPES = [
  { id: 'storage', label: 'Almacenaje', description: 'Almacenamiento de productos', icon: Warehouse, color: 'blue' },
  { id: 'distribution', label: 'Distribución', description: 'Centro de envíos', icon: Package, color: 'purple' },
  { id: 'retail', label: 'Punto de Venta', description: 'Venta directa al público', icon: Store, color: 'emerald' }
]

export default function CreateMarketWarehousePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    warehouseType: 'storage',
    isCentral: false,
    allowNegativeStock: false,
    // Address
    address: {
      street: '',
      apartment: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'Cuba'
    },
    latitude: null as number | null,
    longitude: null as number | null,
    // Manager
    managerName: '',
    phone: '',
    email: ''
  })

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  useEffect(() => {
    setMounted(true)
  }, [])

  const generateCode = () => {
    const cityCode = (formData.address.city || 'ALM').toUpperCase().substring(0, 3)
    const typeCode = formData.warehouseType.substring(0, 3).toUpperCase()
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `${cityCode}-${typeCode}-${randomSuffix}`
  }

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'info') {
      if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
      if (!formData.code.trim()) newErrors.code = 'El código es requerido'
    }

    if (step === 'location') {
      if (!formData.address.street && !formData.address.city) {
        newErrors.address = 'Ingresa una dirección'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return

    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep('review')) return

    setLoading(true)
    try {
      const response = await fetch('/api/market/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          warehouseType: formData.warehouseType,
          isCentral: formData.isCentral,
          allowNegativeStock: formData.allowNegativeStock,
          address: formData.address.street,
          city: formData.address.city,
          state: formData.address.state,
          municipality: formData.address.apartment,
          country: formData.address.country,
          latitude: formData.latitude,
          longitude: formData.longitude,
          managerName: formData.managerName,
          phone: formData.phone,
          email: formData.email
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear almacén')
      }

      router.push('/dashboard/market/warehouses')
    } catch (error) {
      console.error('Error creating warehouse:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Error al crear almacén' })
    } finally {
      setLoading(false)
    }
  }

  const selectedType = WAREHOUSE_TYPES.find(t => t.id === formData.warehouseType)

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8 relative">

            {/* Close Button */}
            <motion.button
              onClick={() => setShowCancelModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "absolute -top-14 -right-2 sm:-top-12 sm:right-0 z-10 w-8 h-8 rounded-full flex items-center justify-center",
                "transition-colors duration-200",
                theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              )}
            >
              <X className="w-4 h-4" />
            </motion.button>

            {/* Header */}
            <div className="text-center mb-4">
              <Link
                href="/dashboard/market/warehouses"
                className={cn(
                  "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a almacenes
              </Link>
              <h1 className={cn(
                "text-2xl sm:text-3xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Nuevo Almacén
              </h1>
            </div>

            {/* Progress Indicator */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div className="relative w-14 h-14">
                        {/* Pulsing ring for active step */}
                        {currentStep === step.id && (
                          <motion.div
                            className="absolute inset-0 rounded-full"
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 0, 0.5]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            style={{
                              background: theme === 'dark'
                                ? 'rgba(59, 130, 246, 0.5)'
                                : 'rgba(37, 99, 235, 0.5)'
                            }}
                          />
                        )}

                        <motion.div
                          initial={false}
                          animate={{
                            scale: currentStep === step.id ? 1.1 : 1,
                            backgroundColor: currentStep === step.id
                              ? theme === 'dark' ? '#3B82F6' : '#2563EB'
                              : currentStepIndex > index
                                ? theme === 'dark' ? '#10B981' : '#059669'
                                : theme === 'dark' ? '#374151' : '#E5E7EB'
                          }}
                          transition={{
                            scale: { duration: 0.3 },
                            backgroundColor: { duration: 0.3 }
                          }}
                          whileHover={{ scale: currentStepIndex >= index ? 1.15 : 1.05 }}
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                            "transition-shadow duration-300",
                            currentStep === step.id && (
                              theme === 'dark'
                                ? 'shadow-lg shadow-blue-500/50'
                                : 'shadow-lg shadow-blue-400/50'
                            ),
                            currentStepIndex > index && (
                              theme === 'dark'
                                ? 'shadow-md shadow-green-500/30'
                                : 'shadow-md shadow-green-400/30'
                            )
                          )}
                        >
                          {currentStepIndex > index ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            >
                              <Check className="w-7 h-7 text-white" />
                            </motion.div>
                          ) : (
                            <step.icon className={cn(
                              "w-7 h-7",
                              currentStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )} />
                          )}
                        </motion.div>
                      </div>

                      <div className="mt-3 text-center">
                        <p className={cn(
                          "text-xs sm:text-sm font-semibold",
                          currentStep === step.id
                            ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            : currentStepIndex > index
                              ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                              : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {step.title}
                        </p>
                        <p className={cn(
                          "text-xs hidden sm:block mt-0.5",
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-500'
                        )}>
                          {step.description}
                        </p>
                      </div>
                    </div>

                    {index < STEPS.length - 1 && (
                      <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                        <div className={cn(
                          "absolute inset-0 rounded-full",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                        <motion.div
                          initial={false}
                          animate={{
                            scaleX: currentStepIndex > index ? 1 : 0
                          }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          className={cn(
                            "h-full origin-left rounded-full",
                            theme === 'dark' ? 'bg-green-500' : 'bg-green-600'
                          )}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <motion.div
              className={cn(
                "rounded-2xl border p-6 sm:p-8 shadow-lg",
                theme === 'dark'
                  ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
                  : 'bg-white border-gray-200 backdrop-blur-sm'
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                {/* Step 1: Information */}
                {currentStep === 'info' && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Building className="w-5 h-5 text-white" />
                      </div>
                      Información del Almacén
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Nombre del Almacén *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Ej: Almacén Central La Habana"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            errors.name
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Código *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            placeholder="ALM-001"
                            className={cn(
                              'flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                              errors.code
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            onClick={() => setFormData({ ...formData, code: generateCode() })}
                            className={cn(
                              "px-4 py-3 rounded-xl font-medium transition-all",
                              theme === 'dark'
                                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            )}
                          >
                            Auto
                          </motion.button>
                        </div>
                        {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
                      </div>

                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-3",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Tipo de Almacén
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {WAREHOUSE_TYPES.map((type) => (
                            <motion.button
                              key={type.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              type="button"
                              onClick={() => setFormData({ ...formData, warehouseType: type.id })}
                              className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left relative",
                                formData.warehouseType === type.id
                                  ? theme === 'dark'
                                    ? 'border-blue-500 bg-blue-900/20'
                                    : 'border-blue-500 bg-blue-50'
                                  : theme === 'dark'
                                    ? 'border-gray-700 hover:border-gray-600'
                                    : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              {formData.warehouseType === type.id && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                              <type.icon className={cn(
                                "w-6 h-6 mb-2",
                                formData.warehouseType === type.id
                                  ? 'text-blue-500'
                                  : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )} />
                              <p className={cn(
                                "font-medium text-sm",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {type.label}
                              </p>
                              <p className={cn(
                                "text-xs mt-0.5",
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                              )}>
                                {type.description}
                              </p>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Options */}
                      <div className="md:col-span-2 flex flex-wrap gap-4">
                        <label className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          formData.isCentral
                            ? theme === 'dark'
                              ? 'border-amber-500 bg-amber-900/20'
                              : 'border-amber-500 bg-amber-50'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}>
                          <input
                            type="checkbox"
                            checked={formData.isCentral}
                            onChange={(e) => setFormData({ ...formData, isCentral: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            formData.isCentral
                              ? 'bg-amber-500 border-amber-500'
                              : theme === 'dark' ? 'border-gray-500' : 'border-gray-400'
                          )}>
                            {formData.isCentral && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Star className={cn(
                                "w-4 h-4",
                                formData.isCentral ? 'text-amber-500' : 'text-gray-400'
                              )} />
                              <span className={cn(
                                "font-medium text-sm",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                Almacén Central
                              </span>
                            </div>
                            <p className={cn(
                              "text-xs mt-0.5",
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                            )}>
                              Solo puede haber uno por empresa
                            </p>
                          </div>
                        </label>

                        <label className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          formData.allowNegativeStock
                            ? theme === 'dark'
                              ? 'border-red-500 bg-red-900/20'
                              : 'border-red-500 bg-red-50'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}>
                          <input
                            type="checkbox"
                            checked={formData.allowNegativeStock}
                            onChange={(e) => setFormData({ ...formData, allowNegativeStock: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            formData.allowNegativeStock
                              ? 'bg-red-500 border-red-500'
                              : theme === 'dark' ? 'border-gray-500' : 'border-gray-400'
                          )}>
                            {formData.allowNegativeStock && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <span className={cn(
                              "font-medium text-sm",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              Permitir Stock Negativo
                            </span>
                            <p className={cn(
                              "text-xs mt-0.5",
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                            )}>
                              Vender sin stock disponible
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Location */}
                {currentStep === 'location' && (
                  <motion.div
                    key="location"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      Ubicación del Almacén
                    </h2>

                    {mounted && (
                      <MapboxAddressAutofill
                        value={formData.address}
                        onChange={(addressData) => {
                          setFormData({
                            ...formData,
                            address: addressData
                          })
                        }}
                        onCoordinatesChange={(coords) => {
                          if (coords) {
                            setFormData({
                              ...formData,
                              latitude: coords.latitude,
                              longitude: coords.longitude
                            })
                          }
                        }}
                        required={true}
                      />
                    )}

                    {formData.latitude && formData.longitude && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border",
                          theme === 'dark'
                            ? 'bg-green-900/20 border-green-800'
                            : 'bg-green-50 border-green-200'
                        )}
                      >
                        <Check className="w-5 h-5 text-green-600" />
                        <div>
                          <p className={cn(
                            "font-medium text-sm",
                            theme === 'dark' ? 'text-green-300' : 'text-green-700'
                          )}>
                            Coordenadas obtenidas
                          </p>
                          <p className="text-xs text-green-600">
                            Lat: {formData.latitude.toFixed(6)}, Lng: {formData.longitude.toFixed(6)}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {errors.address && (
                      <p className="text-red-500 text-sm">{errors.address}</p>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Manager */}
                {currentStep === 'manager' && (
                  <motion.div
                    key="manager"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      Responsable del Almacén
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Esta información es opcional pero recomendada para contacto.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Nombre del Responsable
                        </label>
                        <div className="relative">
                          <User className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                          <input
                            type="text"
                            value={formData.managerName}
                            onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                            placeholder="Juan Pérez"
                            className={cn(
                              'w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Teléfono
                        </label>
                        <div className="relative">
                          <Phone className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+53 5XXX XXXX"
                            className={cn(
                              'w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Email
                        </label>
                        <div className="relative">
                          <Mail className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="almacen@empresa.com"
                            className={cn(
                              'w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Review */}
                {currentStep === 'review' && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      Revisión del Almacén
                    </h2>

                    <div className={cn(
                      'rounded-2xl p-6 space-y-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      {/* Header */}
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-16 h-16 rounded-xl flex items-center justify-center",
                          theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
                        )}>
                          <Warehouse className={cn(
                            "w-8 h-8",
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          )} />
                        </div>
                        <div className="flex-1">
                          <h3 className={cn(
                            "text-xl font-bold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {formData.name || 'Sin nombre'}
                          </h3>
                          <p className={cn(
                            "font-mono text-sm",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                          )}>
                            {formData.code || 'Sin código'}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              theme === 'dark'
                                ? 'bg-blue-900/50 text-blue-300'
                                : 'bg-blue-100 text-blue-700'
                            )}>
                              {selectedType?.label}
                            </span>
                            {formData.isCentral && (
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full flex items-center gap-1",
                                theme === 'dark'
                                  ? 'bg-amber-900/50 text-amber-300'
                                  : 'bg-amber-100 text-amber-700'
                              )}>
                                <Star className="w-3 h-3" />
                                Central
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Location */}
                      {(formData.address.street || formData.address.city) && (
                        <div className={cn(
                          "p-4 rounded-xl",
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-gray-500">Ubicación</span>
                          </div>
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {[formData.address.street, formData.address.city, formData.address.state, formData.address.country]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                          {formData.latitude && formData.longitude && (
                            <p className="text-xs text-green-600 mt-1">
                              Coordenadas: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Manager */}
                      {formData.managerName && (
                        <div className={cn(
                          "p-4 rounded-xl",
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-purple-500" />
                            <span className="text-xs text-gray-500">Responsable</span>
                          </div>
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {formData.managerName}
                          </p>
                          <div className="flex items-center gap-4 mt-1">
                            {formData.phone && (
                              <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {formData.phone}
                              </span>
                            )}
                            {formData.email && (
                              <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {formData.email}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {errors.submit && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-red-600 text-sm">{errors.submit}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goToPrevStep}
                disabled={currentStepIndex === 0}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white shadow-lg'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900 shadow-md'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </motion.button>

              {currentStep === 'review' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={loading}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-400/30',
                    'text-white'
                  )}
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  <Check className="w-5 h-5" />
                  Crear Almacén
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToNextStep}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    theme === 'dark'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                      : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/30',
                    'text-white'
                  )}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Cancel Modal */}
          <AnimatePresence>
            {showCancelModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowCancelModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-md rounded-2xl shadow-2xl border",
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6 pb-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                          theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                        )}>
                          <X className={cn(
                            "w-6 h-6",
                            theme === 'dark' ? 'text-red-400' : 'text-red-600'
                          )} />
                        </div>
                        <div className="flex-1">
                          <h3 className={cn(
                            "text-xl font-bold mb-2",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            ¿Cancelar creación?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Se perderá toda la información ingresada y no podrás recuperarla.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      "flex gap-3 p-6 pt-4 border-t",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCancelModal(false)}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        )}
                      >
                        Continuar editando
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/dashboard/market/warehouses')}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500 hover:bg-red-600'
                        )}
                      >
                        Sí, cancelar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
