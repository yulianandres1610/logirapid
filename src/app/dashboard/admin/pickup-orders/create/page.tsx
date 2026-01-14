'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, usePathname } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Package,
  Settings as SettingsIcon,
  CreditCard,
  FileCheck,
  X,
  MapPin,
  Clock,
  Truck,
  PackagePlus,
  RotateCcw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

// Importar los pasos del wizard (reutilizando componentes de office-orders)
import SenderSearchStep from '@/components/office-orders/wizard/SenderSearchStep'
import RecipientSearchStep from '@/components/office-orders/wizard/RecipientSearchStep'
import BillingPOSStep from '@/components/office-orders/wizard/BillingPOSStep'

// Importar pasos específicos de pickup-orders
import OrderTypeSelectionStep from '@/components/pickup-orders/wizard/OrderTypeSelectionStep'
import PickupSchedulingStep from '@/components/pickup-orders/wizard/PickupSchedulingStep'
import PickupServiceConfigurationStep from '@/components/pickup-orders/wizard/PickupServiceConfigurationStep'
import EmpaqueSelectionStep from '@/components/pickup-orders/wizard/EmpaqueSelectionStep'
import PickupOrderConfirmationStep from '@/components/pickup-orders/wizard/PickupOrderConfirmationStep'
import ReturnOrderStep from '@/components/pickup-orders/wizard/ReturnOrderStep'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const dynamicParams = true
export const runtime = 'nodejs'

interface WizardStep {
  id: number
  title: string
  description: string
  icon: any
  component: any
}

export default function CreatePickupOrderPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const [currentStep, setCurrentStep] = useState(1)
  const [canProceed, setCanProceed] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Determinar la ruta base según el pathname
  const basePath = pathname?.startsWith('/dashboard/agency-admin')
    ? '/dashboard/agency-admin/pickup-orders'
    : '/dashboard/admin/pickup-orders'

  // Estado compartido del wizard
  const [wizardData, setWizardData] = useState({
    // Paso 0: Tipo de orden
    orderType: null as 'recogida' | 'entrega' | 'retorno' | null,

    // Paso 1: Remitente (Cliente que solicita la recogida o entrega)
    sender: null as any,

    // Paso 2: Destinatario
    recipient: null as any,

    // Paso 3: Servicios seleccionados (solo para recogida)
    selectedServices: [] as any[],

    // Paso 4: Configuración de servicios (solo para recogida)
    serviceConfigs: [] as any[],

    // Paso 5: Información de pago (solo para recogida)
    payments: [] as any[],
    totalAmount: 0,

    // Empaques seleccionados (solo para entrega)
    selectedEmpaques: [] as any[],

    // Paso final: Orden creada
    orderId: null as number | null,
    orderNumber: null as string | null,

    // Datos específicos de programación
    scheduledDate: null as string | null, // Fecha programada
    timeSlot: null as string | null, // Franja horaria (ej: "9:00 AM - 12:00 PM")
    pickupInstructions: '' as string, // Instrucciones especiales para recogida
    deliveryInstructions: '' as string // Instrucciones especiales para entrega
  })

  // Definir pasos dinámicamente según el tipo de orden
  const getSteps = (): WizardStep[] => {
    const baseSteps: WizardStep[] = [
      {
        id: 1,
        title: 'Tipo de Orden',
        description: 'Recogida o Entrega',
        icon: wizardData.orderType === 'entrega' ? PackagePlus : Truck,
        component: OrderTypeSelectionStep
      }
    ]

    // Si no se ha seleccionado el tipo, solo mostrar el paso 1
    if (!wizardData.orderType) {
      return baseSteps
    }

    // Pasos comunes para ambos tipos
    const commonSteps: WizardStep[] = [
      {
        id: 2,
        title: 'Cliente',
        description: 'Buscar o crear cliente',
        icon: Search,
        component: SenderSearchStep
      },
      {
        id: 3,
        title: 'Destinatario',
        description: 'Buscar o crear destinatario',
        icon: MapPin,
        component: RecipientSearchStep
      },
      {
        id: 4,
        title: 'Programación',
        description: 'Fecha y horario',
        icon: Clock,
        component: PickupSchedulingStep
      }
    ]

    if (wizardData.orderType === 'recogida') {
      // Flujo de RECOGIDA: 7 pasos totales
      return [
        ...baseSteps,
        ...commonSteps,
        {
          id: 5,
          title: 'Configuración',
          description: 'Configurar envíos',
          icon: SettingsIcon,
          component: PickupServiceConfigurationStep
        },
        {
          id: 6,
          title: 'Pago',
          description: 'Procesar pago',
          icon: CreditCard,
          component: BillingPOSStep
        },
        {
          id: 7,
          title: 'Confirmación',
          description: 'Completar orden',
          icon: FileCheck,
          component: PickupOrderConfirmationStep
        }
      ]
    } else if (wizardData.orderType === 'entrega') {
      // Flujo de ENTREGA: 6 pasos totales
      return [
        ...baseSteps,
        ...commonSteps,
        {
          id: 5,
          title: 'Empaques',
          description: 'Seleccionar empaques',
          icon: Package,
          component: EmpaqueSelectionStep
        },
        {
          id: 6,
          title: 'Confirmación',
          description: 'Completar orden',
          icon: FileCheck,
          component: PickupOrderConfirmationStep
        }
      ]
    } else {
      // Flujo de RETORNO: 2 pasos (tipo + wizard de retorno integrado)
      return [
        ...baseSteps,
        {
          id: 2,
          title: 'Crear Retorno',
          description: 'Wizard de retorno',
          icon: RotateCcw,
          component: ReturnOrderStep
        }
      ]
    }
  }

  const steps = getSteps()

  const handleNext = () => {
    if (currentStep < steps.length && canProceed) {
      setCurrentStep(currentStep + 1)
      setCanProceed(false) // Reset for next step
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setCanProceed(true) // Allow going back
    }
  }

  const handleCancel = () => {
    setShowCancelModal(true)
  }

  const confirmCancel = () => {
    router.push(basePath)
  }

  const closeCancelModal = () => {
    setShowCancelModal(false)
  }

  const updateWizardData = (key: string, value: any) => {
    setWizardData(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const CurrentStepComponent = steps[currentStep - 1].component

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        {/* Main Container */}
        <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8 relative">

        {/* Close Button - Minimalista */}
        <motion.button
          onClick={handleCancel}
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

        {/* Progress Indicator */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
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
                            ? 'rgba(59, 130, 246, 0.5)' // blue-500
                            : 'rgba(37, 99, 235, 0.5)' // blue-600
                        }}
                      />
                    )}

                    <motion.div
                    initial={false}
                    animate={{
                      scale: currentStep === step.id ? 1.1 : 1,
                      rotate: currentStep === step.id ? 360 : 0,
                      backgroundColor: currentStep === step.id
                        ? theme === 'dark' ? '#3B82F6' : '#2563EB' // blue colors
                        : currentStep > step.id
                        ? theme === 'dark' ? '#10B981' : '#059669'
                        : theme === 'dark' ? '#374151' : '#E5E7EB'
                    }}
                    transition={{
                      scale: { duration: 0.3 },
                      rotate: { duration: 0.6, ease: "easeInOut" },
                      backgroundColor: { duration: 0.3 }
                    }}
                    whileHover={{ scale: currentStep >= step.id ? 1.15 : 1.05 }}
                    className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                      "transition-shadow duration-300",
                      currentStep === step.id && (
                        theme === 'dark'
                          ? 'shadow-lg shadow-blue-500/50'
                          : 'shadow-lg shadow-blue-400/50'
                      ),
                      currentStep > step.id && (
                        theme === 'dark'
                          ? 'shadow-md shadow-green-500/30'
                          : 'shadow-md shadow-green-400/30'
                      )
                    )}
                  >
                    {currentStep > step.id ? (
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
                        : currentStep > step.id
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

                {index < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                    <div className={cn(
                      "absolute inset-0 rounded-full",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                    )} />
                    <motion.div
                      initial={false}
                      animate={{
                        scaleX: currentStep > step.id ? 1 : 0
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
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <CurrentStepComponent
                wizardData={wizardData}
                updateWizardData={updateWizardData}
                setCanProceed={setCanProceed}
                onNext={handleNext}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center gap-4">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handlePrevious}
              disabled={currentStep === 1}
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
            </Button>
          </motion.div>

          {currentStep < steps.length ? (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                    : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/30',
                  'text-white'
                )}
              >
                Siguiente
                <ArrowRight className="w-5 h-5" />
              </Button>
            </motion.div>
          ) : (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => router.push(basePath)}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                  theme === 'dark'
                    ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/30'
                    : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-400/30',
                  'text-white'
                )}
              >
                <Check className="w-5 h-5" />
                Finalizar
              </Button>
            </motion.div>
          )}
        </div>
        </div>

        {/* Modal de confirmación para cancelar */}
        <AnimatePresence>
          {showCancelModal && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeCancelModal}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              />

              {/* Modal */}
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
                  {/* Header */}
                  <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                        theme === 'dark'
                          ? 'bg-red-900/30'
                          : 'bg-red-100'
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
                          ¿Cancelar orden?
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

                  {/* Actions */}
                  <div className={cn(
                    "flex gap-3 p-6 pt-4 border-t",
                    theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                  )}>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={closeCancelModal}
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
                      onClick={confirmCancel}
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
  )
}
