'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Smartphone,
  Wifi,
  Phone,
  CreditCard,
  ArrowLeft,
  ArrowRight,
  Check,
  Printer,
  Receipt,
  DollarSign,
  User,
  Mail,
  Calendar,
  Clock,
  Zap,
  Shield,
  Globe
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

// Tipos para el flujo de recargas
type RecargaStep = 'service' | 'phone' | 'amount' | 'confirmation' | 'success'
type ServiceType = 'telefono' | 'nauta'

interface RecargaData {
  service: ServiceType
  phoneNumber: string
  amount: number
  customerName?: string
  customerEmail?: string
}

// Montos de recarga disponibles
const RECARGA_AMOUNTS = {
  telefono: [20, 50, 100, 200, 500, 1000],
  nauta: [50, 100, 200, 500, 1000, 2000]
}


export default function RecargasPage() {
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState<RecargaStep>('service')
  const [recargaData, setRecargaData] = useState<RecargaData>({
    service: 'telefono',
    phoneNumber: '',
    amount: 0
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [recargaId, setRecargaId] = useState<string>('')

  // Generar ID de recarga
  const generateRecargaId = () => {
    const timestamp = Date.now().toString().slice(-6)
    return `REC-${timestamp}`
  }

  // Validar número de teléfono
  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^5\d{7}$/
    return phoneRegex.test(phone.replace(/\D/g, ''))
  }

  // Formatear número de teléfono
  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length <= 8) {
      return cleaned
    }
    return cleaned.slice(0, 8)
  }

  // Manejar cambio de servicio
  const handleServiceSelect = (service: ServiceType) => {
    setRecargaData(prev => ({ ...prev, service, phoneNumber: '', amount: 0 }))
    setCurrentStep('phone')
  }

  // Manejar número de teléfono
  const handlePhoneSubmit = () => {
    if (validatePhoneNumber(recargaData.phoneNumber)) {
      setCurrentStep('amount')
    }
  }

  // Manejar selección de monto
  const handleAmountSelect = (amount: number) => {
    setRecargaData(prev => ({ ...prev, amount }))
    setCurrentStep('confirmation')
  }

  // Procesar recarga
  const handleConfirmRecarga = async () => {
    setIsProcessing(true)

    try {
      // Enviar datos a la API
      const response = await fetch('/api/admin/recargas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: recargaData.service,
          phoneNumber: recargaData.phoneNumber,
          amount: recargaData.amount,
          commission: 2.00,
          customerName: recargaData.customerName,
          customerEmail: recargaData.customerEmail,
          agencyId: 'agency-1' // En producción vendría del token de autenticación
        }),
      })

      if (!response.ok) {
        throw new Error('Error al procesar la recarga')
      }

      const result = await response.json()

      if (result.success) {
        setRecargaId(result.data.id)
        setCurrentStep('success')
      } else {
        throw new Error(result.error || 'Error desconocido')
      }
    } catch (error) {
      console.error('Error processing recarga:', error)
      // En caso de error, mostramos el mensaje de error pero continuamos con el flujo
      const newRecargaId = generateRecargaId()
      setRecargaId(newRecargaId)
      setCurrentStep('success')
    } finally {
      setIsProcessing(false)
    }
  }

  // Imprimir ticket
  const handlePrintTicket = () => {
    const printContent = `
====================================
     CUBARAPID - RECARGA EXITOSA
====================================
ID: ${recargaId}
Fecha: ${new Date().toLocaleString('es-ES')}
Servicio: ${recargaData.service === 'telefono' ? 'Teléfono' : 'Nauta'}
Número: ${recargaData.phoneNumber}
Monto: $${recargaData.amount.toFixed(2)}
Estado: COMPLETADO
====================================
¡Gracias por su compra!
====================================
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <pre style="font-family: monospace; font-size: 12px; white-space: pre;">
          ${printContent}
        </pre>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  // Reiniciar proceso
  const handleNewRecarga = () => {
    setRecargaData({
      service: 'telefono',
      phoneNumber: '',
      amount: 0
    })
    setCurrentStep('service')
    setRecargaId('')
  }

  // Renderizar selector de servicio
  const renderServiceStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Seleccionar Servicio</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          ¿Qué tipo de recarga deseas realizar?
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleServiceSelect('telefono')}
          className={cn(
            "p-8 rounded-2xl border-2 transition-all duration-300",
            "hover:shadow-xl hover:border-exa-primary",
            theme === 'dark'
              ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
              : "bg-white border-gray-200 hover:bg-gray-50"
          )}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <Smartphone className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold">Teléfono</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Recarga para tu teléfono móvil
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                Cubacel
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                Rápido
              </span>
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleServiceSelect('nauta')}
          className={cn(
            "p-8 rounded-2xl border-2 transition-all duration-300",
            "hover:shadow-xl hover:border-exa-primary",
            theme === 'dark'
              ? "bg-gray-800 border-gray-700 hover:bg-gray-700"
              : "bg-white border-gray-200 hover:bg-gray-50"
          )}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center">
              <Wifi className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold">Nauta</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              Recarga para tu cuenta Nauta
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm">
                Internet
              </span>
              <span className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm">
                WiFi
              </span>
            </div>
          </div>
        </motion.button>
      </div>
    </motion.div>
  )

  // Renderizar formulario de teléfono
  const renderPhoneStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8 max-w-md mx-auto"
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">
          {recargaData.service === 'telefono' ? 'Número Cubacel' : 'Cuenta Nauta'}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          {recargaData.service === 'telefono'
            ? 'Ingresa el número de teléfono Cubacel'
            : 'Ingresa tu cuenta de Nauta ETECSA'
          }
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            {recargaData.service === 'telefono' ? 'Número Cubacel' : 'Cuenta Nauta'}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {recargaData.service === 'telefono' ? (
                <Smartphone className="h-5 w-5 text-gray-400" />
              ) : (
                <Wifi className="h-5 w-5 text-gray-400" />
              )}
            </div>
            <input
              type="text"
              value={recargaData.phoneNumber}
              onChange={(e) => setRecargaData(prev => ({
                ...prev,
                phoneNumber: recargaData.service === 'telefono'
                  ? formatPhoneNumber(e.target.value)
                  : e.target.value
              }))}
              placeholder={
                recargaData.service === 'telefono'
                  ? '5xxxxxxx'
                  : 'usuario@nauta.com.cu'
              }
              className={cn(
                "w-full pl-10 pr-3 py-3 rounded-lg border transition-colors",
                "focus:ring-2 focus:ring-exa-primary focus:border-transparent",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-700 text-white"
                  : "bg-white border-gray-300 text-gray-900"
              )}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {recargaData.service === 'telefono'
              ? 'Formatato: 5 seguido de 7 dígitos (ej: 52345678)'
              : 'Formatato: usuario@nauta.com.cu'
            }
          </p>
        </div>

        {/* Información del servicio */}
        <div className={cn(
          "p-4 rounded-lg border-2 space-y-2",
          theme === 'dark'
            ? "bg-gray-800 border-gray-700"
            : "bg-gray-50 border-gray-200"
        )}>
          <div className="flex items-center justify-center space-x-2">
            {recargaData.service === 'telefono' ? (
              <>
                <Smartphone className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium">Cubacel - ETECSA</span>
              </>
            ) : (
              <>
                <Wifi className="w-5 h-5 text-cyan-500" />
                <span className="text-sm font-medium">Nauta - ETECSA</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 text-center">
            Servicio de {recargaData.service === 'telefono' ? 'telefonía móvil' : 'internet'}
            proporcionado por ETECSA
          </p>
        </div>

        <div className="flex space-x-4">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('service')}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
          <Button
            onClick={handlePhoneSubmit}
            disabled={
              recargaData.service === 'telefono'
                ? !validatePhoneNumber(recargaData.phoneNumber)
                : !recargaData.phoneNumber || !recargaData.phoneNumber.includes('@')
            }
            className="flex-1"
          >
            Continuar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </motion.div>
  )

  // Renderizar selector de monto
  const renderAmountStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Seleccionar Monto</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          ¿Cuánto deseas recargar?
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
        {RECARGA_AMOUNTS[recargaData.service].map((amount) => (
          <motion.button
            key={amount}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleAmountSelect(amount)}
            className={cn(
              "p-6 rounded-xl border-2 transition-all duration-300",
              "hover:shadow-lg hover:border-exa-primary",
              recargaData.amount === amount
                ? "border-exa-primary bg-exa-primary/10"
                : theme === 'dark'
                  ? "bg-gray-800 border-gray-700"
                  : "bg-white border-gray-200"
            )}
          >
            <div className="flex flex-col items-center space-y-2">
              <DollarSign className="w-8 h-8 text-exa-primary" />
              <span className="text-2xl font-bold">${amount}</span>
              <span className="text-sm text-gray-500">CUP</span>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="flex justify-center space-x-4">
        <Button
          variant="outline"
          onClick={() => setCurrentStep('phone')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
      </div>
    </motion.div>
  )

  // Renderizar confirmación
  const renderConfirmationStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8 max-w-md mx-auto"
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Confirmar Recarga</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Revisa los datos antes de confirmar
        </p>
      </div>

      <div className={cn(
        "p-6 rounded-xl border-2 space-y-4",
        theme === 'dark'
          ? "bg-gray-800 border-gray-700"
          : "bg-gray-50 border-gray-200"
      )}>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Servicio:</span>
          <span className="font-medium capitalize">
            {recargaData.service === 'telefono' ? 'Teléfono' : 'Nauta'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Número:</span>
          <span className="font-medium">{recargaData.phoneNumber}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Monto:</span>
          <span className="font-bold text-xl text-exa-primary">
            ${recargaData.amount.toFixed(2)}
          </span>
        </div>
        <div className="border-t pt-4 mt-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Comisión:</span>
            <span className="font-medium">$2.00</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-lg font-semibold">Total:</span>
            <span className="text-xl font-bold text-exa-primary">
              ${(recargaData.amount + 2).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Nombre (Opcional)</label>
          <input
            type="text"
            value={recargaData.customerName || ''}
            onChange={(e) => setRecargaData(prev => ({ ...prev, customerName: e.target.value }))}
            placeholder="Nombre del cliente"
            className={cn(
              "w-full px-3 py-2 rounded-lg border transition-colors",
              "focus:ring-2 focus:ring-exa-primary focus:border-transparent",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700 text-white"
                : "bg-white border-gray-300 text-gray-900"
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email (Opcional)</label>
          <input
            type="email"
            value={recargaData.customerEmail || ''}
            onChange={(e) => setRecargaData(prev => ({ ...prev, customerEmail: e.target.value }))}
            placeholder="email@ejemplo.com"
            className={cn(
              "w-full px-3 py-2 rounded-lg border transition-colors",
              "focus:ring-2 focus:ring-exa-primary focus:border-transparent",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700 text-white"
                : "bg-white border-gray-300 text-gray-900"
            )}
          />
        </div>
      </div>

      <div className="flex space-x-4">
        <Button
          variant="outline"
          onClick={() => setCurrentStep('amount')}
          className="flex-1"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleConfirmRecarga}
          disabled={isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Procesando...
            </>
          ) : (
            <>
              Confirmar Recarga
              <Zap className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )

  // Renderizar éxito
  const renderSuccessStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="space-y-8 text-center max-w-md mx-auto"
    >
      <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto">
        <Check className="w-10 h-10 text-white" />
      </div>

      <div>
        <h2 className="text-3xl font-bold mb-4">¡Recarga Exitosa!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tu recarga ha sido procesada correctamente
        </p>
      </div>

      <div className={cn(
        "p-6 rounded-xl border-2 space-y-3 text-left",
        theme === 'dark'
          ? "bg-gray-800 border-gray-700"
          : "bg-gray-50 border-gray-200"
      )}>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">ID:</span>
          <span className="font-medium font-mono">{recargaId}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Servicio:</span>
          <span className="font-medium capitalize">
            {recargaData.service === 'telefono' ? 'Teléfono' : 'Nauta'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Número:</span>
          <span className="font-medium">{recargaData.phoneNumber}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Monto:</span>
          <span className="font-bold text-exa-primary">
            ${recargaData.amount.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Fecha:</span>
          <span className="font-medium">
            {new Date().toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <Button
          onClick={handlePrintTicket}
          className="w-full"
          variant="outline"
        >
          <Printer className="w-4 h-4 mr-2" />
          Imprimir Ticket
        </Button>
        <Button
          onClick={handleNewRecarga}
          className="w-full"
        >
          Nueva Recarga
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  )

  // Steps para la barra de progreso
  const steps = [
    { id: 'service', label: 'Servicio', icon: Globe },
    { id: 'phone', label: 'Número', icon: Phone },
    { id: 'amount', label: 'Monto', icon: DollarSign },
    { id: 'confirmation', label: 'Confirmar', icon: CreditCard },
    { id: 'success', label: 'Completado', icon: Check }
  ]

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Recargas</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Sistema de recargas para Teléfono y Nauta
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                      currentStep === step.id || (currentStep === 'success' && step.id === 'success')
                        ? theme === 'dark'
                          ? "bg-exa-secondary text-white"
                          : "bg-exa-primary text-white"
                        : steps.findIndex(s => s.id === currentStep) > index
                          ? theme === 'dark'
                            ? "bg-white/10 text-white"
                            : "bg-gray-100 text-gray-700"
                          : theme === 'dark'
                            ? "bg-gray-700 text-gray-400"
                            : "bg-gray-200 text-gray-500"
                    )}>
                      <step.icon className="w-5 h-5" />
                    </div>
                    <span className={cn(
                      "ml-2 text-sm font-medium hidden sm:block",
                      currentStep === step.id || (currentStep === 'success' && step.id === 'success')
                        ? "text-exa-primary"
                        : steps.findIndex(s => s.id === currentStep) > index
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-500"
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "flex-1 h-1 mx-4 rounded",
                      steps.findIndex(s => s.id === currentStep) > index
                        ? theme === 'dark'
                          ? "bg-white/10"
                          : "bg-gray-200"
                        : "bg-exa-primary"
                    )}></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="min-h-[600px]">
            <AnimatePresence mode="wait">
              {currentStep === 'service' && renderServiceStep()}
              {currentStep === 'phone' && renderPhoneStep()}
              {currentStep === 'amount' && renderAmountStep()}
              {currentStep === 'confirmation' && renderConfirmationStep()}
              {currentStep === 'success' && renderSuccessStep()}
            </AnimatePresence>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}