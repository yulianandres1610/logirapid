'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Package,
  Settings as SettingsIcon,
  Printer,
  CreditCard,
  FileCheck,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

// Importar los pasos del wizard
import SenderSearchStep from '@/components/office-orders/wizard/SenderSearchStep'
import RecipientSearchStep from '@/components/office-orders/wizard/RecipientSearchStep'
import ServiceSelectionStep from '@/components/office-orders/wizard/ServiceSelectionStep'
import ServiceConfigurationStep from '@/components/office-orders/wizard/ServiceConfigurationStep'
import LabelGenerationStep from '@/components/office-orders/wizard/LabelGenerationStep'
import BillingPOSStep from '@/components/office-orders/wizard/BillingPOSStep'
import OrderConfirmationStep from '@/components/office-orders/wizard/OrderConfirmationStep'

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

export default function CreateOfficeOrderPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [canProceed, setCanProceed] = useState(false)

  // Estado compartido del wizard
  const [wizardData, setWizardData] = useState({
    // Paso 1: Remitente
    sender: null as any,

    // Paso 2: Destinatario
    recipient: null as any,

    // Paso 3: Servicios seleccionados
    selectedServices: [] as any[],

    // Paso 4: Configuración de servicios
    serviceConfigs: [] as any[],

    // Paso 5: Etiquetas generadas
    labels: [] as any[],

    // Paso 6: Información de pago
    payments: [] as any[],
    totalAmount: 0,

    // Paso 7: Orden creada
    orderId: null as number | null,
    orderNumber: null as string | null
  })

  const steps: WizardStep[] = [
    {
      id: 1,
      title: 'Remitente',
      description: 'Buscar o crear remitente',
      icon: Search,
      component: SenderSearchStep
    },
    {
      id: 2,
      title: 'Destinatario',
      description: 'Buscar o crear destinatario',
      icon: Search,
      component: RecipientSearchStep
    },
    {
      id: 3,
      title: 'Servicios',
      description: 'Seleccionar servicios',
      icon: Package,
      component: ServiceSelectionStep
    },
    {
      id: 4,
      title: 'Configuración',
      description: 'Configurar envíos',
      icon: SettingsIcon,
      component: ServiceConfigurationStep
    },
    {
      id: 5,
      title: 'Etiquetas',
      description: 'Generar etiquetas',
      icon: Printer,
      component: LabelGenerationStep
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
      component: OrderConfirmationStep
    }
  ]

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
    if (confirm('¿Estás seguro de cancelar? Se perderá toda la información ingresada.')) {
      router.push('/dashboard/admin/office-orders')
    }
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
        <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8">

        {/* Header Title with Close Button */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 relative"
        >
          {/* Close Button - Minimalista */}
          <motion.button
            onClick={handleCancel}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "absolute -top-2 right-0 w-8 h-8 rounded-lg flex items-center justify-center",
              "transition-colors duration-200",
              theme === 'dark'
                ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            )}
          >
            <X className="w-5 h-5" />
          </motion.button>

          <h1 className={cn(
            "text-3xl sm:text-4xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Nueva Orden de Oficina
          </h1>
          <p className={cn(
            "text-sm sm:text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Completa todos los pasos para crear la orden
          </p>
        </motion.div>

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
                            ? 'rgba(59, 130, 246, 0.5)'
                            : 'rgba(37, 99, 235, 0.5)'
                        }}
                      />
                    )}

                    <motion.div
                    initial={false}
                    animate={{
                      scale: currentStep === step.id ? 1.1 : 1,
                      rotate: currentStep === step.id ? 360 : 0,
                      backgroundColor: currentStep === step.id
                        ? theme === 'dark' ? '#3B82F6' : '#2563EB'
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
                onClick={() => router.push('/dashboard/admin/office-orders')}
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
      </div>
    </DashboardLayout>
  )
}
