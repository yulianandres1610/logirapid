'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Search,
  Building2,
  Users,
  Banknote,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  DollarSign
} from 'lucide-react'

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
  wallet_number: string
  phone: string
  broker_contact_phone: string
  is_active: boolean
}

interface User {
  id: number
  name: string
  email: string
  phone: string
  role: string
}

interface WizardStep {
  id: number
  title: string
  description: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 1, title: 'Broker', description: 'Seleccionar broker', icon: Building2 },
  { id: 2, title: 'Repartidor', description: 'Asignar repartidor', icon: Users },
  { id: 3, title: 'Billetes', description: 'Nomenclatura', icon: Banknote },
  { id: 4, title: 'Fecha', description: 'Fecha límite', icon: Calendar },
  { id: 5, title: 'Confirmar', description: 'Revisar orden', icon: CheckCircle }
]

export default function CashDeliveryWizardPage() {
  const router = useRouter()
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [brokerSearch, setBrokerSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)

  const [formData, setFormData] = useState({
    selectedBroker: null as Broker | null,
    selectedUser: null as User | null,
    currency: 'USD',
    billDenominations: {} as { [key: string]: number },
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
          const rawBrokers = data.data.brokers || data.data || []
          const mappedBrokers = rawBrokers.map((b: any) => ({
            id: b.id,
            name: b.legalname || b.name || '',
            broker_province: b.broker_province || '',
            broker_municipality: b.broker_municipality || '',
            wallet_number: b.wallet_number || '',
            phone: b.broker_contact_phone || b.phone || '',
            broker_contact_phone: b.broker_contact_phone || '',
            // Default to true if is_active is not explicitly false
            is_active: b.is_active !== false && b.is_active !== 'false'
          }))
          setBrokers(mappedBrokers)
        }
      } catch (error) {
        console.error('Error loading brokers:', error)
      }
    }
    loadBrokers()
  }, [])

  // Load all users from the system
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await fetch('/api/users')
        const data = await res.json()
        if (data.success) {
          const rawUsers = data.data?.users || data.users || []
          const mappedUsers = rawUsers
            .map((u: any) => ({
              id: u.id,
              name: `${u.firstName || u.firstname || ''} ${u.lastName || u.lastname || ''}`.trim() || u.email,
              email: u.email,
              phone: u.phone || '',
              role: u.role
            }))
            // Sort: users with phone first, then alphabetically
            .sort((a: User, b: User) => {
              if (a.phone && !b.phone) return -1
              if (!a.phone && b.phone) return 1
              return a.name.localeCompare(b.name)
            })
          setUsers(mappedUsers)
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

  // Validate current step
  const isStepValid = () => {
    switch (currentStep) {
      case 1: return formData.selectedBroker !== null
      case 2: return formData.selectedUser !== null
      case 3: return totalAmount > 0
      case 4: return formData.deadlineDate !== ''
      case 5: return true
      default: return false
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

  // Filters
  const filteredBrokers = brokers.filter(broker => {
    const search = brokerSearch.toLowerCase()
    return (
      broker.name?.toLowerCase().includes(search) ||
      broker.broker_province?.toLowerCase().includes(search) ||
      broker.broker_municipality?.toLowerCase().includes(search) ||
      broker.wallet_number?.toLowerCase().includes(search) ||
      broker.phone?.includes(brokerSearch) ||
      broker.broker_contact_phone?.includes(brokerSearch)
    )
  })

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.phone?.includes(userSearch)
  )

  const handleNext = () => {
    if (currentStep < STEPS.length && isStepValid()) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
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
                            : currentStep > step.id
                            ? theme === 'dark' ? '#10B981' : '#059669'
                            : theme === 'dark' ? '#374151' : '#E5E7EB'
                        }}
                        transition={{ duration: 0.3 }}
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

                  {index < STEPS.length - 1 && (
                    <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                      <div className={cn(
                        "absolute inset-0 rounded-full",
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                      )} />
                      <motion.div
                        initial={false}
                        animate={{ scaleX: currentStep > step.id ? 1 : 0 }}
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
                {/* Step 1: Select Broker */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className={cn("text-xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Seleccionar Broker
                      </h2>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Elija el broker que recibirá el efectivo
                      </p>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono, wallet o ubicación..."
                        value={brokerSearch}
                        onChange={(e) => setBrokerSearch(e.target.value)}
                        className={cn(
                          "w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 transition-colors",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                        )}
                      />
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-sm">
                      <span className={cn("px-3 py-1 rounded-full", theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700')}>
                        {brokers.filter(b => b.is_active).length} activos
                      </span>
                      <span className={cn("px-3 py-1 rounded-full", theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600')}>
                        {brokers.length} total
                      </span>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {filteredBrokers.length === 0 ? (
                        <p className={cn("text-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          No se encontraron brokers
                        </p>
                      ) : (
                        filteredBrokers.map(broker => {
                          const isSelected = formData.selectedBroker?.id === broker.id

                          return (
                            <button
                              key={broker.id}
                              onClick={() => setFormData(prev => ({ ...prev, selectedBroker: broker }))}
                              className={cn(
                                "w-full p-4 rounded-xl border-2 transition-all text-left",
                                isSelected
                                  ? 'border-blue-500 bg-blue-500/10'
                                  : cn(
                                      'border-transparent',
                                      theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                                    )
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center",
                                    broker.is_active
                                      ? theme === 'dark' ? 'bg-green-900/50' : 'bg-green-100'
                                      : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                  )}>
                                    <Building2 className={cn(
                                      "w-5 h-5",
                                      broker.is_active
                                        ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                                        : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                    )} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className={cn("font-medium truncate", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                        {broker.name}
                                      </p>
                                      {!broker.is_active && (
                                        <span className={cn("px-2 py-0.5 rounded text-xs", theme === 'dark' ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-600')}>
                                          Inactivo
                                        </span>
                                      )}
                                    </div>
                                    {(broker.broker_province || broker.broker_municipality) && (
                                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                        📍 {[broker.broker_municipality, broker.broker_province].filter(Boolean).join(', ')}
                                      </p>
                                    )}
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                      {broker.phone && (
                                        <p className={cn("text-sm", theme === 'dark' ? 'text-blue-400' : 'text-blue-600')}>
                                          📱 {broker.phone}
                                        </p>
                                      )}
                                      {broker.wallet_number && (
                                        <p className={cn("text-sm font-mono", theme === 'dark' ? 'text-purple-400' : 'text-purple-600')}>
                                          💳 {broker.wallet_number}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {isSelected && (
                                  <CheckCircle className="h-5 w-5 text-blue-500 shrink-0" />
                                )}
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2: Select Delivery User */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className={cn("text-xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Asignar Repartidor
                      </h2>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Seleccione el usuario que llevará el efectivo (debe tener teléfono para recibir OTP)
                      </p>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, email o teléfono..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className={cn(
                          "w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 transition-colors",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                        )}
                      />
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-sm">
                      <span className={cn("px-3 py-1 rounded-full", theme === 'dark' ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700')}>
                        {users.filter(u => u.phone).length} con teléfono
                      </span>
                      <span className={cn("px-3 py-1 rounded-full", theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600')}>
                        {users.filter(u => !u.phone).length} sin teléfono
                      </span>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {filteredUsers.length === 0 ? (
                        <p className={cn("text-center py-8", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          No se encontraron usuarios
                        </p>
                      ) : (
                        filteredUsers.map(user => {
                          const hasPhone = !!user.phone
                          const isSelected = formData.selectedUser?.id === user.id

                          return (
                            <button
                              key={user.id}
                              onClick={() => hasPhone && setFormData(prev => ({ ...prev, selectedUser: user }))}
                              disabled={!hasPhone}
                              className={cn(
                                "w-full p-4 rounded-xl border-2 transition-all text-left",
                                !hasPhone && "opacity-50 cursor-not-allowed",
                                isSelected
                                  ? 'border-blue-500 bg-blue-500/10'
                                  : cn(
                                      'border-transparent',
                                      hasPhone
                                        ? theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'
                                        : theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100/50'
                                    )
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center",
                                    hasPhone
                                      ? theme === 'dark' ? 'bg-green-900/50' : 'bg-green-100'
                                      : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                  )}>
                                    <Users className={cn(
                                      "w-5 h-5",
                                      hasPhone
                                        ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                                        : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                                    )} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className={cn(
                                        "font-medium truncate",
                                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                                      )}>
                                        {user.name}
                                      </p>
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-xs font-medium shrink-0",
                                        theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                                      )}>
                                        {user.role}
                                      </span>
                                    </div>
                                    <p className={cn("text-sm truncate", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                                      {user.email}
                                    </p>
                                    {hasPhone ? (
                                      <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-green-400' : 'text-green-600')}>
                                        📱 {user.phone}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Sin teléfono - No puede recibir OTP
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <CheckCircle className="h-5 w-5 text-blue-500 shrink-0" />
                                )}
                              </div>
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Bill Denominations */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className={cn("text-xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          Nomenclatura de Billetes
                        </h2>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                          Ingrese la cantidad de billetes por denominación
                        </p>
                      </div>
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          currency: e.target.value,
                          billDenominations: {}
                        }))}
                        className={cn(
                          "px-4 py-2 rounded-xl border focus:ring-2 focus:ring-blue-500",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-900'
                        )}
                      >
                        {Object.keys(BILL_DENOMINATIONS).map(currency => (
                          <option key={currency} value={currency}>{currency}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {BILL_DENOMINATIONS[formData.currency]?.map(denom => {
                        const count = formData.billDenominations[denom] || 0
                        const subtotal = denom * count

                        return (
                          <div
                            key={denom}
                            className={cn(
                              "p-4 rounded-xl",
                              theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'
                            )}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className={cn("text-lg font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                                ${denom}
                              </span>
                              <DollarSign className={cn("h-4 w-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={count || ''}
                              onChange={(e) => handleDenominationChange(denom, e.target.value)}
                              placeholder="0"
                              className={cn(
                                "w-full px-3 py-2 rounded-lg border text-center text-lg font-medium focus:ring-2 focus:ring-blue-500",
                                theme === 'dark'
                                  ? 'bg-gray-600 border-gray-500 text-white'
                                  : 'bg-white border-gray-200 text-gray-900'
                              )}
                            />
                            <p className={cn("text-sm mt-2 text-center", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                              = ${subtotal.toLocaleString()}
                            </p>
                          </div>
                        )
                      })}
                    </div>

                    {/* Summary */}
                    <div className={cn(
                      "p-5 rounded-xl border",
                      theme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'
                    )}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Total billetes</p>
                          <p className={cn("text-2xl font-bold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>{totalBills}</p>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Total a entregar</p>
                          <p className="text-2xl font-bold text-blue-500">
                            {formData.currency} ${totalAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Deadline */}
                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className={cn("text-xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Fecha Límite
                      </h2>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Establezca la fecha límite para completar la entrega
                      </p>
                    </div>

                    <div>
                      <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Fecha límite de entrega
                      </label>
                      <input
                        type="date"
                        value={formData.deadlineDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, deadlineDate: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white'
                            : 'bg-gray-50 border-gray-200 text-gray-900'
                        )}
                      />
                    </div>

                    <div>
                      <label className={cn("block text-sm font-medium mb-2", theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
                        Notas adicionales (opcional)
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Instrucciones especiales para el repartidor..."
                        rows={4}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 resize-none",
                          theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500'
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Step 5: Confirmation */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div>
                      <h2 className={cn("text-xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                        Confirmar Orden
                      </h2>
                      <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                        Revise los detalles antes de crear la orden
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className={cn("p-4 rounded-xl", theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
                        <p className={cn("text-xs font-medium mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          BROKER DESTINO
                        </p>
                        <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.selectedBroker?.name}
                        </p>
                        {(formData.selectedBroker?.broker_province || formData.selectedBroker?.broker_municipality) && (
                          <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                            {[formData.selectedBroker?.broker_province, formData.selectedBroker?.broker_municipality].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>

                      <div className={cn("p-4 rounded-xl", theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
                        <p className={cn("text-xs font-medium mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          REPARTIDOR
                        </p>
                        <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.selectedUser?.name}
                        </p>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {formData.selectedUser?.phone}
                        </p>
                      </div>

                      <div className={cn("p-4 rounded-xl", theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
                        <p className={cn("text-xs font-medium mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          MONTO A ENTREGAR
                        </p>
                        <p className="text-2xl font-bold text-blue-500">
                          {formData.currency} ${totalAmount.toLocaleString()}
                        </p>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {totalBills} billetes en total
                        </p>
                      </div>

                      <div className={cn("p-4 rounded-xl", theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
                        <p className={cn("text-xs font-medium mb-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          NOMENCLATURA
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(formData.billDenominations)
                            .filter(([_, count]) => count > 0)
                            .map(([denom, count]) => (
                              <span
                                key={denom}
                                className={cn(
                                  "px-3 py-1 rounded-full text-sm font-medium",
                                  theme === 'dark' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-800'
                                )}
                              >
                                {count}x${denom}
                              </span>
                            ))
                          }
                        </div>
                      </div>

                      <div className={cn("p-4 rounded-xl", theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50')}>
                        <p className={cn("text-xs font-medium mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          FECHA LÍMITE
                        </p>
                        <p className={cn("font-semibold", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          {formData.deadlineDate && new Date(formData.deadlineDate + 'T00:00:00').toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    <div className={cn(
                      "p-4 rounded-xl border",
                      theme === 'dark' ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-200'
                    )}>
                      <p className={cn("text-sm flex items-center gap-2", theme === 'dark' ? 'text-amber-400' : 'text-amber-700')}>
                        <AlertCircle className="h-4 w-4" />
                        Al confirmar, se notificará al repartidor y al broker
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center gap-4">
            <motion.button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
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

            {currentStep < STEPS.length ? (
              <motion.button
                onClick={handleNext}
                disabled={!isStepValid()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                    : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/30'
                )}
              >
                Siguiente
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            ) : (
              <motion.button
                onClick={handleSubmit}
                disabled={isSubmitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/30'
                    : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-400/30'
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Crear Orden
                  </>
                )}
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
                    theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                        theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                      )}>
                        <X className={cn("w-6 h-6", theme === 'dark' ? 'text-red-400' : 'text-red-600')} />
                      </div>
                      <div className="flex-1">
                        <h3 className={cn("text-xl font-bold mb-2", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                          ¿Cancelar orden?
                        </h3>
                        <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
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
                      onClick={() => router.push('/dashboard/admin/brokers/cash-delivery/list')}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                        theme === 'dark' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
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
