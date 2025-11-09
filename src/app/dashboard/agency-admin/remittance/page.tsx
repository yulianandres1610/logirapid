'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  DollarSign,
  CreditCard,
  Users,
  User,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  Calculator,
  Building2,
  MapPin,
  Wallet,
  Globe
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/theme-context'
import { useAgencyRates } from '@/hooks/useAgencyRates'
import { cn } from '@/lib/utils'

// Definir los tipos para los datos del formulario
interface RemesaData {
  currencyType: 'USD' | 'CUP' | 'TARJETA' | 'TRANSFERENCIA'
  amount: number
  senderName: string
  senderPhone: string
  senderEmail: string
  recipientName: string
  recipientId: string
  recipientPhone: string
  recipientAddress: string
  calculatedAmount: number
  exchangeRate: number
}

export default function RemesaPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { rates: agencyRates } = useAgencyRates()

  const [currentStep, setCurrentStep] = useState(1)
  const [exchangeRates, setExchangeRates] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [remesaData, setRemesaData] = useState<RemesaData>({
    currencyType: 'USD',
    amount: 0,
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    recipientName: '',
    recipientId: '',
    recipientPhone: '',
    recipientAddress: '',
    calculatedAmount: 0,
    exchangeRate: 1
  })

  // Efecto para convertir tasas de agencia al formato existente para compatibilidad
  useEffect(() => {
    if (agencyRates) {
      const convertedRates = {
        USD: {
          rate: agencyRates.USD?.agencyRate || 0,
          formatted: agencyRates.USD?.formattedAgencyRate || '0.00'
        },
        EUR: {
          rate: agencyRates.EUR?.agencyRate || 0,
          formatted: agencyRates.EUR?.formattedAgencyRate || '0.00'
        },
        MLC: {
          rate: agencyRates.MLC?.agencyRate || 0,
          formatted: agencyRates.MLC?.formattedAgencyRate || '0.00'
        }
      }

      setExchangeRates(convertedRates)
    }
  }, [agencyRates])

  // Calcular cantidad a recibir basada en la moneda seleccionada usando tasas de agencia
  const calculateReceivedAmount = (amount: number, currencyType: string) => {
    if (!exchangeRates || amount <= 0) return 0

    switch (currencyType) {
      case 'USD':
        return amount // 1:1
      case 'CUP':
        return amount * (exchangeRates.USD?.rate || 470) // 1 x tasa de agencia
      case 'TARJETA':
        return amount * (exchangeRates.USD?.rate || 470) // Similar a CUP
      case 'TRANSFERENCIA':
        return amount * (exchangeRates.USD?.rate || 470) // Similar a CUP
      default:
        return amount
    }
  }

  // Actualizar cantidad calculada cuando cambia el monto o tipo de moneda
  useEffect(() => {
    if (remesaData.amount > 0) {
      const calculated = calculateReceivedAmount(remesaData.amount, remesaData.currencyType)
      const rate = remesaData.currencyType === 'USD' ? 1 : (exchangeRates?.USD?.rate || 470)
      setRemesaData(prev => ({
        ...prev,
        calculatedAmount: calculated,
        exchangeRate: rate
      }))
    }
  }, [remesaData.amount, remesaData.currencyType, exchangeRates])

  const updateData = (field: keyof RemesaData, value: any) => {
    setRemesaData(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 5))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        if (!remesaData.currencyType) {
          setError('Por favor selecciona el tipo de moneda')
          return false
        }
        return true
      case 2:
        if (!remesaData.amount || remesaData.amount <= 0) {
          setError('Por favor ingresa un monto válido')
          return false
        }
        return true
      case 3:
        if (!remesaData.senderName.trim()) {
          setError('Por favor ingresa el nombre del remitente')
          return false
        }
        if (!remesaData.senderPhone.trim()) {
          setError('Por favor ingresa el teléfono del remitente')
          return false
        }
        // El email es opcional, pero si se ingresa debe ser válido
        if (remesaData.senderEmail.trim() && !remesaData.senderEmail.includes('@')) {
          setError('Por favor ingresa un correo electrónico válido')
          return false
        }
        return true
      case 4:
        if (!remesaData.recipientName.trim()) {
          setError('Por favor ingresa el nombre del destinatario')
          return false
        }
        if (!remesaData.recipientId.trim()) {
          setError('Por favor ingresa el documento de identidad del destinatario')
          return false
        }
        return true
      case 5:
        if (!remesaData.recipientPhone.trim()) {
          setError('Por favor ingresa el teléfono de contacto')
          return false
        }
        return true
      default:
        return true
    }
  }

  const handleSubmit = async () => {
    if (!validateStep()) return

    try {
      setLoading(true)
      // Aquí iría la lógica para enviar los datos a tu API
      console.log('Enviando remesa:', remesaData)

      // Simulación de envío
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Redirigir a página de éxito
      router.push('/dashboard/agency-admin/remittance?success=true')
    } catch (error) {
      setError('Error al procesar la remesa')
    } finally {
      setLoading(false)
    }
  }

  const renderStep1 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-exa-primary/10 rounded-full mb-4">
          <DollarSign className="w-8 h-8 text-exa-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-4">¿Cómo quiere recibir su familiar?</h2>
        <p className={cn(
          "text-lg",
          theme === 'dark' ? "text-gray-400" : "text-gray-600"
        )}>
          Selecciona el tipo de moneda o método de entrega
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            type: 'USD',
            label: 'USD Dólares',
            description: 'Efectivo en dólares americanos',
            icon: DollarSign,
            rate: '1:1'
          },
          {
            type: 'CUP',
            label: 'CUP Pesos Cubanos',
            description: 'Efectivo en pesos cubanos (tasa de agencia)',
            icon: Wallet,
            rate: `1:${exchangeRates?.USD?.rate || 470}`
          },
          {
            type: 'TARJETA',
            label: 'Tarjeta Clásica',
            description: 'Recarga en tarjeta de crédito/débito (tasa de agencia)',
            icon: CreditCard,
            rate: `1:${exchangeRates?.USD?.rate || 470}`,
            disabled: true
          },
          {
            type: 'TRANSFERENCIA',
            label: 'Transferencia Bancaria',
            description: 'Depósito en cuenta bancaria (tasa de agencia)',
            icon: Building2,
            rate: `1:${exchangeRates?.USD?.rate || 470}`,
            disabled: true
          }
        ].map((currency) => (
          <motion.button
            key={currency.type}
            onClick={() => !currency.disabled && updateData('currencyType', currency.type as any)}
            disabled={currency.disabled}
            className={cn(
              "p-6 rounded-xl border-2 transition-all duration-300 text-left",
              remesaData.currencyType === currency.type
                ? "border-exa-primary bg-exa-primary/10"
                : theme === 'dark'
                  ? "border-gray-700 hover:border-gray-600 bg-gray-800"
                  : "border-gray-200 hover:border-gray-300 bg-white",
              currency.disabled && "opacity-50 cursor-not-allowed"
            )}
            whileHover={!currency.disabled ? { scale: 1.02 } : {}}
            whileTap={!currency.disabled ? { scale: 0.98 } : {}}
          >
            <div className="flex items-start gap-4">
              <div className={cn(
                "p-3 rounded-lg",
                remesaData.currencyType === currency.type
                  ? "bg-exa-primary text-white"
                  : theme === 'dark'
                    ? "bg-gray-700 text-gray-300"
                    : "bg-gray-100 text-gray-600"
              )}>
                <currency.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{currency.label}</h3>
                <p className={cn(
                  "text-sm mb-2",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  {currency.description}
                </p>
                <div className="text-xs font-medium text-exa-primary">
                  Tasa: {currency.rate}
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-exa-primary/10 rounded-full mb-4">
          <Calculator className="w-8 h-8 text-exa-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-4">¿Cuánto deseas enviar?</h2>
        <p className={cn(
          "text-lg",
          theme === 'dark' ? "text-gray-400" : "text-gray-600"
        )}>
          Ingresa el monto en USD que deseas enviar
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span className="text-gray-500 text-xl font-medium">$</span>
          </div>
          <input
            type="number"
            value={remesaData.amount === 0 ? '' : remesaData.amount}
            onChange={(e) => updateData('amount', e.target.value === '' ? 0 : parseFloat(e.target.value))}
            placeholder="0.00"
            className={cn(
              "w-full pl-10 pr-4 py-4 text-3xl font-bold border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-exa-primary focus:border-transparent",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
            )}
          />
        </div>

        {remesaData.amount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "mt-6 p-6 rounded-xl border-2",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700"
                : "bg-exa-primary/5 border-exa-primary/20"
            )}
          >
            <div className="text-center">
              <p className={cn(
                "text-sm mb-2",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Su familiar recibirá:
              </p>
              <div className="text-3xl font-bold text-exa-primary mb-2">
                {remesaData.currencyType === 'USD' ? '$' : 'CUP '}
                {remesaData.calculatedAmount.toFixed(2)}
              </div>
              <div className="text-sm">
                <span className={cn(
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Tasa de agencia: 1 USD =
                </span>
                <span className="font-semibold text-exa-primary ml-1">
                  {remesaData.currencyType === 'USD'
                    ? '1 USD'
                    : ` ${remesaData.exchangeRate} ${remesaData.currencyType === 'TARJETA' || remesaData.currencyType === 'TRANSFERENCIA' ? 'CUP' : remesaData.currencyType}`
                  }
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )

  const renderStep3 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-full mb-4">
          <User className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Datos del remitente</h2>
        <p className={cn(
          "text-lg",
          theme === 'dark' ? "text-gray-400" : "text-gray-600"
        )}>
          Ingresa tu nombre, teléfono y correo (opcional)
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <div className="relative">
          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={remesaData.senderName}
            onChange={(e) => updateData('senderName', e.target.value)}
            placeholder="Nombre completo del remitente"
            className={cn(
              "w-full pl-12 pr-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
            )}
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="tel"
            value={remesaData.senderPhone}
            onChange={(e) => updateData('senderPhone', e.target.value)}
            placeholder="Número de teléfono del remitente"
            className={cn(
              "w-full pl-12 pr-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
            )}
          />
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            value={remesaData.senderEmail}
            onChange={(e) => updateData('senderEmail', e.target.value)}
            placeholder="Correo electrónico del remitente (opcional)"
            className={cn(
              "w-full pl-12 pr-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
            )}
          />
        </div>
      </div>
    </motion.div>
  )

  const renderStep4 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-exa-primary/10 rounded-full mb-4">
          <Users className="w-8 h-8 text-exa-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Datos del destinatario</h2>
        <p className={cn(
          "text-lg",
          theme === 'dark' ? "text-gray-400" : "text-gray-600"
        )}>
          Ingresa los datos de quien recibirá el dinero
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <input
          type="text"
          value={remesaData.recipientName}
          onChange={(e) => updateData('recipientName', e.target.value)}
          placeholder="Nombre completo del destinatario"
          className={cn(
            "w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-exa-primary focus:border-transparent",
            theme === 'dark'
              ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
          )}
        />
        <input
          type="text"
          value={remesaData.recipientId}
          onChange={(e) => updateData('recipientId', e.target.value)}
          placeholder="Carné de identidad del destinatario"
          className={cn(
            "w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-exa-primary focus:border-transparent",
            theme === 'dark'
              ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
          )}
        />
      </div>
    </motion.div>
  )

  const renderStep5 = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-exa-primary/10 rounded-full mb-4">
          <Phone className="w-8 h-8 text-exa-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Contacto del destinatario</h2>
        <p className={cn(
          "text-lg",
          theme === 'dark' ? "text-gray-400" : "text-gray-600"
        )}>
          Ingresa el teléfono y dirección para la entrega
        </p>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        <input
          type="tel"
          value={remesaData.recipientPhone}
          onChange={(e) => updateData('recipientPhone', e.target.value)}
          placeholder="Teléfono de contacto"
          className={cn(
            "w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-exa-primary focus:border-transparent",
            theme === 'dark'
              ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
          )}
        />

        <textarea
          value={remesaData.recipientAddress}
          onChange={(e) => updateData('recipientAddress', e.target.value)}
          placeholder="Dirección de entrega (opcional)"
          rows={3}
          className={cn(
            "w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-exa-primary focus:border-transparent resize-none",
            theme === 'dark'
              ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
          )}
        />
      </div>
    </motion.div>
  )

  const renderConfirmation = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>

      <h2 className="text-3xl font-bold mb-4">Confirmar remesa</h2>
      <p className={cn(
        "text-lg mb-8",
        theme === 'dark' ? "text-gray-400" : "text-gray-600"
      )}>
        Por favor verifica que todos los datos sean correctos
      </p>

      <div className={cn(
        "max-w-lg mx-auto p-6 rounded-xl border-2 space-y-4 text-left",
        theme === 'dark'
          ? "bg-gray-800 border-gray-700"
          : "bg-gray-50 border-gray-200"
      )}>
        <div className="flex justify-between">
          <span className={cn(theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
            Monto a enviar:
          </span>
          <span className="font-semibold">${remesaData.amount.toFixed(2)} USD</span>
        </div>

        <div className="flex justify-between">
          <span className={cn(theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
            Tipo de entrega:
          </span>
          <span className="font-semibold">
            {remesaData.currencyType === 'USD' ? 'USD Dólares' :
             remesaData.currencyType === 'CUP' ? 'CUP Pesos Cubanos' :
             remesaData.currencyType === 'TARJETA' ? 'Tarjeta Clásica' :
             'Transferencia Bancaria'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className={cn(theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
            Cantidad a recibir:
          </span>
          <span className="font-semibold text-exa-primary">
            {remesaData.currencyType === 'USD' ? '$' : 'CUP '}
            {remesaData.calculatedAmount.toFixed(2)}
          </span>
        </div>

        {/* Remitente */}
        <div className={cn(
          "pt-4 mt-4 border-t",
          theme === 'dark' ? "border-gray-700" : "border-gray-200"
        )}>
          <div className="flex justify-between">
            <span className={cn(theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
              Remitente:
            </span>
            <span className="font-semibold">{remesaData.senderName}</span>
          </div>

          <div className="flex justify-between">
            <span className={cn(theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
              CI Remitente:
            </span>
            <span className="font-semibold">{remesaData.senderName}</span>
          </div>
        </div>

        {/* Destinatario */}
        <div className={cn(
          "pt-4 mt-4 border-t",
          theme === 'dark' ? "border-gray-700" : "border-gray-200"
        )}>
          <div className="flex justify-between">
            <span className={cn(theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
              Destinatario:
            </span>
            <span className="font-semibold">{remesaData.recipientName}</span>
          </div>

          <div className="flex justify-between">
            <span className={cn(theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
              Documento:
            </span>
            <span className="font-semibold">{remesaData.recipientId}</span>
          </div>

          <div className="flex justify-between">
            <span className={cn(theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
              Teléfono:
            </span>
            <span className="font-semibold">{remesaData.recipientPhone}</span>
          </div>

          {remesaData.recipientAddress && (
            <div className="flex justify-between">
              <span className={cn(theme === 'dark' ? "text-gray-400" : "text-gray-600")}>
                Dirección:
              </span>
              <span className="font-semibold">{remesaData.recipientAddress}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )

  const renderStep = () => {
    switch (currentStep) {
      case 1: return renderStep1()
      case 2: return renderStep2()
      case 3: return renderStep3()
      case 4: return renderStep4()
      case 5: return renderStep5()
      case 6: return renderConfirmation()
      default: return renderStep1()
    }
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Tipo de moneda'
      case 2: return 'Monto a enviar'
      case 3: return 'Datos del remitente'
      case 4: return 'Datos del destinatario'
      case 5: return 'Contacto'
      case 6: return 'Confirmación'
      default: return ''
    }
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <DashboardLayout>
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Enviar Remesa
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Asiste a tus familiares en Cuba con nuestro servicio de remesas seguro y rápido
            </p>
          </div>

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className={cn(
                theme === 'dark' ? "text-gray-400 hover:text-white" : "text-gray-600 hover:text-gray-900"
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Nueva Remesa</h1>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Paso {currentStep} de 6: {getStepTitle()}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {[1, 2, 3, 4, 5, 6].map((step) => (
                <div
                  key={step}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-all duration-300",
                    step <= currentStep
                      ? "bg-exa-primary text-white"
                      : theme === 'dark'
                        ? "bg-gray-700 text-gray-400"
                        : "bg-gray-200 text-gray-500"
                  )}
                >
                  {step < 6 ? (
                    step
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                </div>
              ))}
            </div>
            <div className={cn(
              "h-2 rounded-full overflow-hidden",
              theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
            )}>
              <motion.div
                className="h-full bg-exa-primary"
                initial={{ width: '0%' }}
                animate={{ width: `${((currentStep - 1) / 5) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
            >
              {error}
            </motion.div>
          )}

          {/* Step content */}
          <div className={cn(
            "p-8 rounded-xl mb-8",
            theme === 'dark' ? "bg-gray-800" : "bg-white shadow-sm border border-gray-200"
          )}>
            <AnimatePresence mode="wait">
              {renderStep()}
            </AnimatePresence>
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={currentStep === 1 ? () => router.back() : prevStep}
              disabled={loading}
              className={cn(
                theme === 'dark'
                  ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {currentStep === 1 ? 'Cancelar' : 'Anterior'}
            </Button>

            <Button
              onClick={currentStep === 6 ? handleSubmit : nextStep}
              disabled={loading}
              className="bg-exa-primary hover:bg-exa-primary/90 text-white"
            >
              {loading ? (
                'Procesando...'
              ) : currentStep === 6 ? (
                <>
                  Confirmar Remesa
                  <CheckCircle className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Siguiente
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}