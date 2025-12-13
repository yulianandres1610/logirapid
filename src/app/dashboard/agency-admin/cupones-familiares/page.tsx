'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin, DollarSign, User, CreditCard, CheckCircle, Send,
  Loader2, ArrowRight, ArrowLeft, Phone, Mail, Home, Users,
  Banknote, AlertCircle, Clock, Printer, MessageCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

interface Province {
  name: string
  municipalities: {
    name: string
    brokerCount: number
    currencies: string[]
  }[]
}

interface WizardData {
  // Step 1: Location
  province: string
  municipality: string
  // Step 2: Service
  productId: number | null
  serviceType: string
  deliveryFee: number
  // Step 3: Amount
  sendAmount: number
  sendCurrency: string
  receiveCurrency: string
  serviceFee: number
  totalCharged: number
  estimatedDelivery: string
  hasAvailability: boolean
  // Step 4: Recipient
  recipientName: string
  recipientPhone: string
  recipientIdNumber: string
  recipientAddress: string
  recipientNeighborhood: string
  recipientAddressReferences: string
  hasAlternateContact: boolean
  alternateContactName: string
  alternateContactPhone: string
  // Step 5: Sender
  senderName: string
  senderPhone: string
  senderEmail: string
  // Step 6: Payment
  paymentMethod: string
  paymentReference: string
  cashReceived: number
  // Step 7: Confirmation
  orderNumber: string
  orderId: number | null
}

const STEPS = [
  { id: 1, name: 'Ubicación', icon: MapPin },
  { id: 2, name: 'Servicio', icon: Banknote },
  { id: 3, name: 'Monto', icon: DollarSign },
  { id: 4, name: 'Destinatario', icon: User },
  { id: 5, name: 'Remitente', icon: Users },
  { id: 6, name: 'Pago', icon: CreditCard },
  { id: 7, name: 'Confirmación', icon: CheckCircle }
]

const SERVICE_TYPES = [
  { id: 'usd_cash', name: 'USD Efectivo', icon: '💵', currency: 'USD', fee: 5, fixedFee: 3 },
  { id: 'cup_cash', name: 'CUP Efectivo', icon: '🇨🇺', currency: 'CUP', fee: 4, fixedFee: 2 },
  { id: 'mlc_card', name: 'MLC Tarjeta', icon: '💳', currency: 'MLC', fee: 3, fixedFee: 5 }
]

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Efectivo', icon: '💵' },
  { id: 'zelle', name: 'Zelle', icon: '📱' },
  { id: 'card', name: 'Tarjeta', icon: '💳' }
]

export default function CuponesFamiliaresPage() {
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [availability, setAvailability] = useState<any>(null)

  const [wizardData, setWizardData] = useState<WizardData>({
    province: '',
    municipality: '',
    productId: null,
    serviceType: '',
    deliveryFee: 5,
    sendAmount: 100,
    sendCurrency: 'USD',
    receiveCurrency: 'USD',
    serviceFee: 0,
    totalCharged: 0,
    estimatedDelivery: '',
    hasAvailability: false,
    recipientName: '',
    recipientPhone: '',
    recipientIdNumber: '',
    recipientAddress: '',
    recipientNeighborhood: '',
    recipientAddressReferences: '',
    hasAlternateContact: false,
    alternateContactName: '',
    alternateContactPhone: '',
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    paymentMethod: '',
    paymentReference: '',
    cashReceived: 0,
    orderNumber: '',
    orderId: null
  })

  // Load provinces on mount
  useEffect(() => {
    loadProvinces()
  }, [])

  const loadProvinces = async () => {
    try {
      const res = await fetch('/api/brokers/locations')
      const data = await res.json()
      if (data.success) {
        setProvinces(data.data.provinces)
      }
    } catch (error) {
      console.error('Error loading provinces:', error)
    }
  }

  const checkAvailability = async () => {
    if (!wizardData.province || !wizardData.municipality || !wizardData.sendAmount) return

    setLoading(true)
    try {
      const res = await fetch(
        `/api/brokers/availability?province=${encodeURIComponent(wizardData.province)}&municipality=${encodeURIComponent(wizardData.municipality)}&currency=${wizardData.receiveCurrency}&amount=${wizardData.sendAmount}`
      )
      const data = await res.json()
      if (data.success) {
        setAvailability(data.data)
        updateWizardData({
          estimatedDelivery: data.data.estimatedDelivery,
          hasAvailability: data.data.hasAvailability
        })
      }
    } catch (error) {
      console.error('Error checking availability:', error)
    } finally {
      setLoading(false)
    }
  }

  // Check availability when amount or service changes
  useEffect(() => {
    if (currentStep === 3 && wizardData.sendAmount > 0) {
      checkAvailability()
    }
  }, [wizardData.sendAmount, wizardData.receiveCurrency, currentStep])

  const updateWizardData = (updates: Partial<WizardData>) => {
    setWizardData(prev => {
      const newData = { ...prev, ...updates }

      // Calculate totals when relevant fields change
      if ('sendAmount' in updates || 'serviceType' in updates || 'deliveryFee' in updates) {
        const service = SERVICE_TYPES.find(s => s.id === (updates.serviceType || prev.serviceType))
        if (service) {
          const amount = updates.sendAmount ?? prev.sendAmount
          const fee = (amount * service.fee / 100) + service.fixedFee
          newData.serviceFee = fee
          newData.totalCharged = amount + fee + (updates.deliveryFee ?? prev.deliveryFee)
          newData.receiveCurrency = service.currency
        }
      }

      return newData
    })
  }

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!wizardData.province && !!wizardData.municipality
      case 2:
        return !!wizardData.serviceType
      case 3:
        return wizardData.sendAmount > 0
      case 4:
        return !!wizardData.recipientName && !!wizardData.recipientPhone
      case 5:
        return !!wizardData.senderName
      case 6:
        return !!wizardData.paymentMethod
      default:
        return true
    }
  }

  const handleNext = () => {
    if (currentStep < 7 && canProceed()) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const createOrder = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/remittance-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          province: wizardData.province,
          municipality: wizardData.municipality,
          productId: wizardData.productId,
          serviceType: wizardData.serviceType,
          sendAmount: wizardData.sendAmount,
          sendCurrency: wizardData.sendCurrency,
          receiveCurrency: wizardData.receiveCurrency,
          deliveryFee: wizardData.deliveryFee,
          recipient: {
            name: wizardData.recipientName,
            phone: wizardData.recipientPhone,
            idNumber: wizardData.recipientIdNumber,
            address: wizardData.recipientAddress,
            neighborhood: wizardData.recipientNeighborhood,
            addressReferences: wizardData.recipientAddressReferences,
            hasAlternateContact: wizardData.hasAlternateContact,
            alternateContactName: wizardData.alternateContactName,
            alternateContactPhone: wizardData.alternateContactPhone
          },
          sender: {
            name: wizardData.senderName,
            phone: wizardData.senderPhone,
            email: wizardData.senderEmail
          },
          paymentMethod: wizardData.paymentMethod,
          paymentReference: wizardData.paymentReference,
          cashReceived: wizardData.cashReceived
        })
      })

      const data = await res.json()
      if (data.success) {
        updateWizardData({
          orderNumber: data.data.orderNumber,
          orderId: data.data.id,
          estimatedDelivery: data.data.estimatedDelivery
        })
        setCurrentStep(7)
      } else {
        alert(data.error || 'Error al crear orden')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Error al crear orden')
    } finally {
      setLoading(false)
    }
  }

  const resetWizard = () => {
    setWizardData({
      province: '',
      municipality: '',
      productId: null,
      serviceType: '',
      deliveryFee: 5,
      sendAmount: 100,
      sendCurrency: 'USD',
      receiveCurrency: 'USD',
      serviceFee: 0,
      totalCharged: 0,
      estimatedDelivery: '',
      hasAvailability: false,
      recipientName: '',
      recipientPhone: '',
      recipientIdNumber: '',
      recipientAddress: '',
      recipientNeighborhood: '',
      recipientAddressReferences: '',
      hasAlternateContact: false,
      alternateContactName: '',
      alternateContactPhone: '',
      senderName: '',
      senderPhone: '',
      senderEmail: '',
      paymentMethod: '',
      paymentReference: '',
      cashReceived: 0,
      orderNumber: '',
      orderId: null
    })
    setCurrentStep(1)
  }

  const selectedMunicipalities = provinces.find(p => p.name === wizardData.province)?.municipalities || []

  return (
    <DashboardLayout>
      <div className={cn(
        "min-h-screen p-4 sm:p-6",
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        {/* Header */}
        <div className="mb-6">
          <h1 className={cn(
            "text-2xl font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Cupones Familiares
          </h1>
          <p className={cn(
            "text-sm mt-1",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            Envía dinero a Cuba de forma rápida y segura
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px]">
            {STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = currentStep === step.id
              const isCompleted = currentStep > step.id

              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={{
                        scale: isActive ? 1.1 : 1,
                        backgroundColor: isCompleted
                          ? '#10B981'
                          : isActive
                            ? '#3B82F6'
                            : theme === 'dark' ? '#374151' : '#E5E7EB'
                      }}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                        (isCompleted || isActive) && "text-white"
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </motion.div>
                    <span className={cn(
                      "text-xs mt-1 font-medium",
                      isActive
                        ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                        : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      {step.name}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      "w-16 h-0.5 mx-2",
                      isCompleted
                        ? 'bg-green-500'
                        : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
                    )} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "rounded-2xl border p-6 sm:p-8 max-w-2xl mx-auto",
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            )}
          >
            {/* Step 1: Location */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                    theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                  )}>
                    <MapPin className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Ubicación de Entrega
                  </h2>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Selecciona dónde se entregará el dinero en Cuba
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Provincia
                    </label>
                    <select
                      value={wizardData.province}
                      onChange={(e) => updateWizardData({ province: e.target.value, municipality: '' })}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border text-base",
                        theme === 'dark'
                          ? 'bg-gray-700 border-gray-600 text-white'
                          : 'bg-white border-gray-300'
                      )}
                    >
                      <option value="">Seleccionar provincia...</option>
                      {provinces.map(p => (
                        <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {wizardData.province && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Municipio
                      </label>
                      <select
                        value={wizardData.municipality}
                        onChange={(e) => updateWizardData({ municipality: e.target.value })}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border text-base",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-white border-gray-300'
                        )}
                      >
                        <option value="">Seleccionar municipio...</option>
                        {selectedMunicipalities.map(m => (
                          <option key={m.name} value={m.name}>
                            {m.name} ({m.brokerCount} broker{m.brokerCount !== 1 && 's'})
                          </option>
                        ))}
                      </select>
                    </motion.div>
                  )}

                  {wizardData.municipality && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-4 rounded-xl flex items-center gap-3",
                        theme === 'dark' ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'
                      )}
                    >
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-green-400' : 'text-green-700'
                      )}>
                        Hay brokers disponibles en esta zona
                      </span>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Service Type */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                    theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'
                  )}>
                    <Banknote className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Tipo de Servicio
                  </h2>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Selecciona cómo quieres que reciba el dinero
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {SERVICE_TYPES.map(service => (
                    <motion.button
                      key={service.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateWizardData({ serviceType: service.id })}
                      className={cn(
                        "p-6 rounded-xl border-2 text-center transition-all",
                        wizardData.serviceType === service.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : theme === 'dark'
                            ? 'border-gray-600 hover:border-gray-500'
                            : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <span className="text-4xl block mb-3">{service.icon}</span>
                      <h3 className={cn(
                        "font-bold",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {service.name}
                      </h3>
                      <p className={cn(
                        "text-sm mt-1",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        {service.fee}% + ${service.fixedFee}
                      </p>
                    </motion.button>
                  ))}
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wizardData.deliveryFee > 0}
                      onChange={(e) => updateWizardData({ deliveryFee: e.target.checked ? 5 : 0 })}
                      className="w-5 h-5 rounded"
                    />
                    <div>
                      <span className={cn(
                        "font-medium",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        Entrega a domicilio
                      </span>
                      <span className={cn(
                        "text-sm ml-2",
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      )}>
                        (+$5.00)
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Step 3: Amount */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                    theme === 'dark' ? 'bg-yellow-900/30' : 'bg-yellow-100'
                  )}>
                    <DollarSign className="w-8 h-8 text-yellow-600" />
                  </div>
                  <h2 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Monto a Enviar
                  </h2>
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Monto en USD
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">$</span>
                    <Input
                      type="number"
                      value={wizardData.sendAmount}
                      onChange={(e) => updateWizardData({ sendAmount: parseFloat(e.target.value) || 0 })}
                      className={cn(
                        "pl-10 text-2xl font-bold h-16 rounded-xl",
                        theme === 'dark' ? 'bg-gray-700 text-white' : ''
                      )}
                      placeholder="100.00"
                    />
                  </div>
                </div>

                {/* Availability Status */}
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm">Verificando disponibilidad...</span>
                  </div>
                ) : availability && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-4 rounded-xl",
                      availability.hasAvailability
                        ? theme === 'dark' ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'
                        : theme === 'dark' ? 'bg-yellow-900/20 border border-yellow-800' : 'bg-yellow-50 border border-yellow-200'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className={cn(
                        "w-5 h-5",
                        availability.hasAvailability ? 'text-green-600' : 'text-yellow-600'
                      )} />
                      <div>
                        <p className={cn(
                          "font-medium",
                          availability.hasAvailability
                            ? theme === 'dark' ? 'text-green-400' : 'text-green-700'
                            : theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'
                        )}>
                          Entrega estimada: {availability.estimatedDelivery}
                        </p>
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          ${availability.totalAvailable.toFixed(2)} {wizardData.receiveCurrency} disponibles en la zona
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Price Breakdown */}
                <div className={cn(
                  "p-4 rounded-xl space-y-2",
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                )}>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Monto a enviar:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>${wizardData.sendAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Comisión del servicio:</span>
                    <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>${wizardData.serviceFee.toFixed(2)}</span>
                  </div>
                  {wizardData.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Entrega a domicilio:</span>
                      <span className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>${wizardData.deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className={cn(
                    "flex justify-between pt-2 border-t font-bold",
                    theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
                  )}>
                    <span>TOTAL A PAGAR:</span>
                    <span className="text-blue-600">${wizardData.totalCharged.toFixed(2)}</span>
                  </div>
                  <div className={cn(
                    "text-center text-sm pt-2",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    El destinatario recibirá: <strong>${wizardData.sendAmount.toFixed(2)} {wizardData.receiveCurrency}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Recipient */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                    theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100'
                  )}>
                    <User className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Datos del Destinatario
                  </h2>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Información del beneficiario en Cuba
                  </p>
                </div>

                <div className="space-y-4">
                  <Input
                    placeholder="Nombre completo *"
                    value={wizardData.recipientName}
                    onChange={(e) => updateWizardData({ recipientName: e.target.value })}
                    className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-700 text-white' : '')}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      placeholder="Teléfono *"
                      value={wizardData.recipientPhone}
                      onChange={(e) => updateWizardData({ recipientPhone: e.target.value })}
                      className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-700 text-white' : '')}
                    />
                    <Input
                      placeholder="Carnet de Identidad"
                      value={wizardData.recipientIdNumber}
                      onChange={(e) => updateWizardData({ recipientIdNumber: e.target.value })}
                      className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-700 text-white' : '')}
                    />
                  </div>

                  <div className={cn(
                    "p-4 rounded-xl border",
                    theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                  )}>
                    <h4 className={cn(
                      "text-sm font-semibold mb-3 flex items-center gap-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      <Home className="w-4 h-4" />
                      Dirección de Entrega
                    </h4>

                    <div className="space-y-3">
                      <Input
                        placeholder="Calle/Avenida con número"
                        value={wizardData.recipientAddress}
                        onChange={(e) => updateWizardData({ recipientAddress: e.target.value })}
                        className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-600 text-white' : '')}
                      />
                      <Input
                        placeholder="Reparto/Zona"
                        value={wizardData.recipientNeighborhood}
                        onChange={(e) => updateWizardData({ recipientNeighborhood: e.target.value })}
                        className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-600 text-white' : '')}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          value={wizardData.municipality}
                          disabled
                          className={cn("rounded-xl opacity-70", theme === 'dark' ? 'bg-gray-600 text-white' : '')}
                        />
                        <Input
                          value={wizardData.province}
                          disabled
                          className={cn("rounded-xl opacity-70", theme === 'dark' ? 'bg-gray-600 text-white' : '')}
                        />
                      </div>
                      <Input
                        placeholder="Referencias (ej: frente al parque)"
                        value={wizardData.recipientAddressReferences}
                        onChange={(e) => updateWizardData({ recipientAddressReferences: e.target.value })}
                        className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-600 text-white' : '')}
                      />
                    </div>
                  </div>

                  {/* Alternate Contact */}
                  <div className={cn(
                    "p-4 rounded-xl border",
                    theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                  )}>
                    <label className="flex items-center gap-3 cursor-pointer mb-3">
                      <input
                        type="checkbox"
                        checked={wizardData.hasAlternateContact}
                        onChange={(e) => updateWizardData({ hasAlternateContact: e.target.checked })}
                        className="w-5 h-5 rounded"
                      />
                      <span className={cn(
                        "font-medium",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Agregar contacto alternativo
                      </span>
                    </label>

                    {wizardData.hasAlternateContact && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3"
                      >
                        <Input
                          placeholder="Nombre del contacto"
                          value={wizardData.alternateContactName}
                          onChange={(e) => updateWizardData({ alternateContactName: e.target.value })}
                          className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-600 text-white' : '')}
                        />
                        <Input
                          placeholder="Teléfono del contacto"
                          value={wizardData.alternateContactPhone}
                          onChange={(e) => updateWizardData({ alternateContactPhone: e.target.value })}
                          className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-600 text-white' : '')}
                        />
                        <p className={cn(
                          "text-xs flex items-center gap-1",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          <AlertCircle className="w-3 h-3" />
                          El contacto alternativo recibirá SMS si el principal no está disponible
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Sender */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                    theme === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'
                  )}>
                    <Users className="w-8 h-8 text-orange-600" />
                  </div>
                  <h2 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Datos del Remitente
                  </h2>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                  )}>
                    Información de quien envía el dinero
                  </p>
                </div>

                <div className="space-y-4">
                  <Input
                    placeholder="Nombre completo *"
                    value={wizardData.senderName}
                    onChange={(e) => updateWizardData({ senderName: e.target.value })}
                    className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-700 text-white' : '')}
                  />
                  <Input
                    placeholder="Teléfono"
                    value={wizardData.senderPhone}
                    onChange={(e) => updateWizardData({ senderPhone: e.target.value })}
                    className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-700 text-white' : '')}
                  />
                  <Input
                    placeholder="Email (opcional)"
                    type="email"
                    value={wizardData.senderEmail}
                    onChange={(e) => updateWizardData({ senderEmail: e.target.value })}
                    className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-700 text-white' : '')}
                  />
                </div>
              </div>
            )}

            {/* Step 6: Payment */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                    theme === 'dark' ? 'bg-pink-900/30' : 'bg-pink-100'
                  )}>
                    <CreditCard className="w-8 h-8 text-pink-600" />
                  </div>
                  <h2 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Método de Pago
                  </h2>
                  <p className={cn(
                    "text-2xl font-bold mt-2",
                    'text-blue-600'
                  )}>
                    Total: ${wizardData.totalCharged.toFixed(2)}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {PAYMENT_METHODS.map(method => (
                    <motion.button
                      key={method.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateWizardData({ paymentMethod: method.id })}
                      className={cn(
                        "p-4 rounded-xl border-2 text-center transition-all",
                        wizardData.paymentMethod === method.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : theme === 'dark'
                            ? 'border-gray-600 hover:border-gray-500'
                            : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <span className="text-3xl block mb-2">{method.icon}</span>
                      <span className={cn(
                        "font-medium text-sm",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {method.name}
                      </span>
                    </motion.button>
                  ))}
                </div>

                {wizardData.paymentMethod === 'cash' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Efectivo recibido
                      </label>
                      <Input
                        type="number"
                        value={wizardData.cashReceived || ''}
                        onChange={(e) => updateWizardData({ cashReceived: parseFloat(e.target.value) || 0 })}
                        className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-700 text-white' : '')}
                        placeholder="0.00"
                      />
                    </div>
                    {wizardData.cashReceived >= wizardData.totalCharged && (
                      <div className={cn(
                        "p-4 rounded-xl text-center",
                        theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
                      )}>
                        <span className={cn(
                          "text-lg font-bold",
                          theme === 'dark' ? 'text-green-400' : 'text-green-700'
                        )}>
                          Cambio: ${(wizardData.cashReceived - wizardData.totalCharged).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}

                {(wizardData.paymentMethod === 'zelle' || wizardData.paymentMethod === 'card') && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Referencia de pago
                    </label>
                    <Input
                      value={wizardData.paymentReference}
                      onChange={(e) => updateWizardData({ paymentReference: e.target.value })}
                      className={cn("rounded-xl", theme === 'dark' ? 'bg-gray-700 text-white' : '')}
                      placeholder={wizardData.paymentMethod === 'zelle' ? 'ZELLE-XXXXX' : 'Ref. Terminal'}
                    />
                  </motion.div>
                )}
              </div>
            )}

            {/* Step 7: Confirmation */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4",
                      "bg-green-500"
                    )}
                  >
                    <CheckCircle className="w-10 h-10 text-white" />
                  </motion.div>
                  <h2 className={cn(
                    "text-xl font-bold",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    ¡Orden Creada Exitosamente!
                  </h2>
                  <p className={cn(
                    "text-3xl font-bold mt-2",
                    'text-blue-600'
                  )}>
                    {wizardData.orderNumber}
                  </p>
                </div>

                <div className={cn(
                  "p-4 rounded-xl space-y-3",
                  theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                )}>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Destinatario:</span>
                    <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {wizardData.recipientName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Monto a recibir:</span>
                    <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      ${wizardData.sendAmount.toFixed(2)} {wizardData.receiveCurrency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Ubicación:</span>
                    <span className={cn("font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                      {wizardData.municipality}, {wizardData.province}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-600">
                    <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Entrega estimada:</span>
                    <span className={cn(
                      "font-bold px-3 py-1 rounded-full",
                      wizardData.estimatedDelivery === '1-24 horas'
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-yellow-500/20 text-yellow-500'
                    )}>
                      {wizardData.estimatedDelivery}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    variant="outline"
                    className={cn(
                      "flex flex-col items-center gap-1 h-auto py-3",
                      theme === 'dark' ? 'border-gray-600' : ''
                    )}
                  >
                    <Phone className="w-5 h-5" />
                    <span className="text-xs">SMS</span>
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex flex-col items-center gap-1 h-auto py-3",
                      theme === 'dark' ? 'border-gray-600' : ''
                    )}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-xs">WhatsApp</span>
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex flex-col items-center gap-1 h-auto py-3",
                      theme === 'dark' ? 'border-gray-600' : ''
                    )}
                  >
                    <Printer className="w-5 h-5" />
                    <span className="text-xs">Imprimir</span>
                  </Button>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={resetWizard}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Nueva Orden
                  </Button>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            {currentStep < 7 && (
              <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className={cn(
                    "rounded-xl",
                    theme === 'dark' ? 'border-gray-600' : ''
                  )}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Atrás
                </Button>

                {currentStep < 6 ? (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Siguiente
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={createOrder}
                    disabled={!canProceed() || loading}
                    className="rounded-xl bg-green-600 hover:bg-green-700 text-white"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Confirmar Orden
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  )
}
