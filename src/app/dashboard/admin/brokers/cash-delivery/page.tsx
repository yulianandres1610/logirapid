'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Users,
  Banknote,
  Calendar,
  CheckCircle,
  Search,
  Loader2,
  AlertCircle,
  DollarSign
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

// Bill denominations by currency
const BILL_DENOMINATIONS: { [key: string]: number[] } = {
  USD: [100, 50, 20, 10, 5, 1],
  EUR: [500, 200, 100, 50, 20, 10, 5],
  CUP: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  MLC: [100, 50, 20, 10, 5, 1]
}

interface Broker {
  id: number
  name: string
  broker_province: string
  broker_municipality: string
  balances?: { currency: string; available_balance: number }[]
}

interface User {
  id: number
  name: string
  email: string
  phone: string
  role: string
}

interface FormData {
  selectedBroker: Broker | null
  selectedUser: User | null
  currency: string
  billDenominations: { [key: string]: number }
  deadlineDate: string
  notes: string
}

const STEPS = [
  { id: 1, title: 'Broker y Repartidor', icon: Building2 },
  { id: 2, title: 'Nomenclatura', icon: Banknote },
  { id: 3, title: 'Fecha Límite', icon: Calendar },
  { id: 4, title: 'Confirmación', icon: CheckCircle }
]

export default function CashDeliveryWizardPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [brokerSearch, setBrokerSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')

  const [formData, setFormData] = useState<FormData>({
    selectedBroker: null,
    selectedUser: null,
    currency: 'USD',
    billDenominations: {},
    deadlineDate: '',
    notes: ''
  })

  // Load brokers
  useEffect(() => {
    const loadBrokers = async () => {
      try {
        const res = await fetch('/api/admin/brokers')
        const data = await res.json()
        if (data.success) {
          setBrokers(data.data.brokers || data.data || [])
        }
      } catch (error) {
        console.error('Error loading brokers:', error)
      }
    }
    loadBrokers()
  }, [])

  // Load users (delivery personnel)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users?role=USER,DRIVER')
        const data = await res.json()
        if (data.success) {
          setUsers(data.data || data.users || [])
        }
      } catch (error) {
        console.error('Error loading users:', error)
      }
    }
    loadUsers()
  }, [])

  // Calculate totals
  const calculateTotals = () => {
    let totalAmount = 0
    let totalBills = 0

    for (const [denom, count] of Object.entries(formData.billDenominations)) {
      const quantity = Number(count) || 0
      totalAmount += parseInt(denom) * quantity
      totalBills += quantity
    }

    return { totalAmount, totalBills }
  }

  const { totalAmount, totalBills } = calculateTotals()

  // Validate step
  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.selectedBroker && formData.selectedUser
      case 2:
        return totalAmount > 0
      case 3:
        return formData.deadlineDate
      case 4:
        return true
      default:
        return false
    }
  }

  // Handle bill denomination change
  const handleDenominationChange = (denomination: number, value: string) => {
    const numValue = parseInt(value) || 0
    setFormData(prev => ({
      ...prev,
      billDenominations: {
        ...prev.billDenominations,
        [denomination]: numValue >= 0 ? numValue : 0
      }
    }))
  }

  // Submit order
  const handleSubmit = async () => {
    if (!formData.selectedBroker || !formData.selectedUser) return

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/admin/cash-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brokerCompanyId: formData.selectedBroker.id,
          deliveryUserId: formData.selectedUser.id,
          currency: formData.currency,
          billDenominations: formData.billDenominations,
          deadlineDate: formData.deadlineDate,
          notes: formData.notes
        })
      })

      const data = await res.json()

      if (data.success) {
        showNotification('success', 'Orden creada', `Orden ${data.data.orderNumber} creada exitosamente`)
        router.push('/dashboard/admin/brokers/cash-delivery/list')
      } else {
        showNotification('error', 'Error', data.error || 'Error al crear la orden')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      showNotification('error', 'Error', 'Error al crear la orden')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter brokers
  const filteredBrokers = brokers.filter(broker =>
    broker.name.toLowerCase().includes(brokerSearch.toLowerCase()) ||
    broker.broker_province?.toLowerCase().includes(brokerSearch.toLowerCase())
  )

  // Filter users
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearch.toLowerCase())
  )

  const cardBg = theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100 shadow-sm'
  const inputBg = theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900'
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600'

  return (
    <DashboardLayout>
      <div className="min-h-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className={`p-2 rounded-lg hover:bg-white/10 ${textSecondary}`}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>
                Nueva Entrega de Efectivo
              </h1>
              <p className={textSecondary}>
                Crear orden de entrega de efectivo a broker
              </p>
            </div>
          </div>
        </div>

      {/* Steps indicator */}
      <div className={`${cardBg} rounded-2xl p-4`}>
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStep > step.id

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all
                      ${isActive ? 'bg-gradient-to-r from-exa-primary to-exa-secondary text-white' :
                        isCompleted ? 'bg-green-500 text-white' :
                          theme === 'dark' ? 'bg-white/10 text-gray-400' : 'bg-gray-100 text-gray-400'}
                    `}
                  >
                    {isCompleted ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs ${isActive ? textPrimary : textSecondary}`}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`
                      h-0.5 flex-1 mx-2
                      ${isCompleted ? 'bg-green-500' : theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}
                    `}
                  />
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
        >
          {/* Step 1: Broker and User Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Broker Selection */}
              <div className={`${cardBg} rounded-2xl p-6`}>
                <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>
                  Broker Destino
                </h3>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar broker..."
                    value={brokerSearch}
                    onChange={(e) => setBrokerSearch(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${inputBg} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-exa-primary`}
                  />
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredBrokers.length === 0 ? (
                    <p className={`text-center py-4 ${textSecondary}`}>
                      No se encontraron brokers
                    </p>
                  ) : (
                    filteredBrokers.map(broker => (
                      <button
                        key={broker.id}
                        onClick={() => setFormData(prev => ({ ...prev, selectedBroker: broker }))}
                        className={`
                          w-full p-4 rounded-xl border-2 transition-all text-left
                          ${formData.selectedBroker?.id === broker.id
                            ? 'border-exa-primary bg-exa-primary/10'
                            : `border-transparent ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${textPrimary}`}>{broker.name}</p>
                            <p className={`text-sm ${textSecondary}`}>
                              {broker.broker_province}, {broker.broker_municipality}
                            </p>
                          </div>
                          {formData.selectedBroker?.id === broker.id && (
                            <CheckCircle className="h-5 w-5 text-exa-primary" />
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* User Selection */}
              <div className={`${cardBg} rounded-2xl p-6`}>
                <h3 className={`text-lg font-semibold mb-4 ${textPrimary}`}>
                  Repartidor Asignado
                </h3>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar repartidor..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2 rounded-lg border ${inputBg} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-exa-primary`}
                  />
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <p className={`text-center py-4 ${textSecondary}`}>
                      No se encontraron repartidores
                    </p>
                  ) : (
                    filteredUsers.map(user => (
                      <button
                        key={user.id}
                        onClick={() => setFormData(prev => ({ ...prev, selectedUser: user }))}
                        className={`
                          w-full p-4 rounded-xl border-2 transition-all text-left
                          ${formData.selectedUser?.id === user.id
                            ? 'border-exa-primary bg-exa-primary/10'
                            : `border-transparent ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`font-medium ${textPrimary}`}>{user.name}</p>
                            <p className={`text-sm ${textSecondary}`}>
                              {user.phone || 'Sin teléfono'}
                            </p>
                          </div>
                          {formData.selectedUser?.id === user.id && (
                            <CheckCircle className="h-5 w-5 text-exa-primary" />
                          )}
                        </div>
                        {!user.phone && (
                          <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            El usuario necesita teléfono para recibir OTP
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Bill Denominations */}
          {currentStep === 2 && (
            <div className={`${cardBg} rounded-2xl p-6`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>
                  Nomenclatura de Billetes
                </h3>

                <select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    currency: e.target.value,
                    billDenominations: {}
                  }))}
                  className={`px-4 py-2 rounded-lg border ${inputBg} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-exa-primary`}
                >
                  {Object.keys(BILL_DENOMINATIONS).map(currency => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </div>

              <p className={`${textSecondary} mb-6`}>
                Ingrese la cantidad de billetes por denominación
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {BILL_DENOMINATIONS[formData.currency]?.map(denom => {
                  const count = formData.billDenominations[denom] || 0
                  const subtotal = denom * count

                  return (
                    <div
                      key={denom}
                      className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-semibold ${textPrimary}`}>
                          ${denom}
                        </span>
                        <DollarSign className={`h-4 w-4 ${textSecondary}`} />
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={count || ''}
                        onChange={(e) => handleDenominationChange(denom, e.target.value)}
                        placeholder="0"
                        className={`w-full px-3 py-2 rounded-lg border ${inputBg} ${textPrimary} text-center focus:outline-none focus:ring-2 focus:ring-exa-primary`}
                      />
                      <p className={`text-sm ${textSecondary} mt-2 text-center`}>
                        = ${subtotal.toLocaleString()}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gradient-to-r from-exa-primary/20 to-exa-secondary/20' : 'bg-gradient-to-r from-exa-primary/10 to-exa-secondary/10'} border border-exa-primary/30`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={textSecondary}>Total billetes</p>
                    <p className={`text-2xl font-bold ${textPrimary}`}>{totalBills}</p>
                  </div>
                  <div className="text-right">
                    <p className={textSecondary}>Total a entregar</p>
                    <p className={`text-2xl font-bold ${textPrimary}`}>
                      {formData.currency} ${totalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Deadline */}
          {currentStep === 3 && (
            <div className={`${cardBg} rounded-2xl p-6`}>
              <h3 className={`text-lg font-semibold mb-6 ${textPrimary}`}>
                Fecha Límite de Entrega
              </h3>

              <div className="space-y-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>
                    Fecha límite para completar la entrega
                  </label>
                  <input
                    type="date"
                    value={formData.deadlineDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, deadlineDate: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full px-4 py-3 rounded-xl border ${inputBg} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-exa-primary`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${textSecondary}`}>
                    Notas adicionales (opcional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Coordinar con el broker antes de la entrega..."
                    rows={4}
                    className={`w-full px-4 py-3 rounded-xl border ${inputBg} ${textPrimary} focus:outline-none focus:ring-2 focus:ring-exa-primary resize-none`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {currentStep === 4 && (
            <div className={`${cardBg} rounded-2xl p-6`}>
              <h3 className={`text-lg font-semibold mb-6 ${textPrimary}`}>
                Resumen de la Orden
              </h3>

              <div className="space-y-4">
                {/* Broker */}
                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${textSecondary} mb-1`}>Broker destino</p>
                  <p className={`font-semibold ${textPrimary}`}>{formData.selectedBroker?.name}</p>
                  <p className={`text-sm ${textSecondary}`}>
                    {formData.selectedBroker?.broker_province}, {formData.selectedBroker?.broker_municipality}
                  </p>
                </div>

                {/* Delivery User */}
                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${textSecondary} mb-1`}>Repartidor</p>
                  <p className={`font-semibold ${textPrimary}`}>{formData.selectedUser?.name}</p>
                  <p className={`text-sm ${textSecondary}`}>{formData.selectedUser?.phone}</p>
                </div>

                {/* Amount */}
                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${textSecondary} mb-1`}>Monto a entregar</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>
                    {formData.currency} ${totalAmount.toLocaleString()}
                  </p>
                  <p className={`text-sm ${textSecondary}`}>{totalBills} billetes en total</p>
                </div>

                {/* Nomenclature */}
                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${textSecondary} mb-2`}>Nomenclatura</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(formData.billDenominations)
                      .filter(([_, count]) => count > 0)
                      .map(([denom, count]) => (
                        <span
                          key={denom}
                          className={`px-3 py-1 rounded-full text-sm ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'} ${textPrimary}`}
                        >
                          {count}x${denom}
                        </span>
                      ))
                    }
                  </div>
                </div>

                {/* Deadline */}
                <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <p className={`text-sm ${textSecondary} mb-1`}>Fecha límite</p>
                  <p className={`font-semibold ${textPrimary}`}>
                    {formData.deadlineDate && new Date(formData.deadlineDate + 'T00:00:00').toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                {formData.notes && (
                  <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <p className={`text-sm ${textSecondary} mb-1`}>Notas</p>
                    <p className={textPrimary}>{formData.notes}</p>
                  </div>
                )}
              </div>

              <div className={`mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30`}>
                <p className="text-amber-500 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Al confirmar, se notificará al repartidor y al broker
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
            ${currentStep === 1
              ? 'opacity-50 cursor-not-allowed'
              : `${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`
            }
            ${textPrimary}
          `}
        >
          <ArrowLeft className="h-4 w-4" />
          Anterior
        </button>

        {currentStep < 4 ? (
          <button
            onClick={() => setCurrentStep(prev => Math.min(4, prev + 1))}
            disabled={!isStepValid()}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
              ${isStepValid()
                ? 'bg-gradient-to-r from-exa-primary to-exa-secondary text-white hover:opacity-90'
                : 'opacity-50 cursor-not-allowed bg-gray-300'
              }
            `}
          >
            Siguiente
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-green-500 to-green-600 text-white hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Crear Orden de Entrega
              </>
            )}
          </button>
        )}
        </div>
      </div>
    </DashboardLayout>
  )
}
