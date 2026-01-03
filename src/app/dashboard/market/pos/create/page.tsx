'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Monitor,
  Warehouse,
  Users,
  DollarSign,
  Settings,
  CheckCircle,
  Loader2,
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  Check,
  Tag
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'info' | 'currency' | 'permissions' | 'users'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 'info', title: 'Información', description: 'Datos básicos', icon: Monitor },
  { id: 'currency', title: 'Monedas', description: 'Configuración', icon: DollarSign },
  { id: 'permissions', title: 'Permisos', description: 'Accesos', icon: Settings },
  { id: 'users', title: 'Usuarios', description: 'Asignar', icon: Users }
]

interface WarehouseOption {
  id: number
  name: string
  code: string
}

interface PricelistOption {
  id: number
  name: string
}

interface UserOption {
  id: number
  email: string
  firstname: string
  lastname: string
  role: string
}

export default function CreatePOSTerminalPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('info')
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [warehouseId, setWarehouseId] = useState<number | null>(null)
  const [pricelistId, setPricelistId] = useState<number | null>(null)
  const [allowPriceEdit, setAllowPriceEdit] = useState(false)
  const [allowDiscount, setAllowDiscount] = useState(true)
  const [maxDiscountPercent, setMaxDiscountPercent] = useState(100)
  const [requireCustomer, setRequireCustomer] = useState(false)
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [acceptedCurrencies, setAcceptedCurrencies] = useState(['USD', 'CUP', 'MLC'])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])

  // Options state
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [pricelists, setPricelists] = useState<PricelistOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const whRes = await fetch('/api/market/warehouses')
        const whData = await whRes.json()
        if (whData.success) {
          setWarehouses(whData.data.warehouses)
        }

        const plRes = await fetch('/api/market/pricelists')
        const plData = await plRes.json()
        if (plData.success) {
          setPricelists(plData.data.pricelists || [])
        }

        const usersRes = await fetch('/api/users')
        const usersData = await usersRes.json()
        if (usersData.success) {
          setUsers(usersData.data.users || usersData.data || [])
        }
      } catch (err) {
        console.error('Error fetching options:', err)
      } finally {
        setLoadingOptions(false)
      }
    }

    fetchOptions()
  }, [])

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'info') {
      if (!name.trim()) newErrors.name = 'El nombre es requerido'
      if (!warehouseId) newErrors.warehouse = 'Debe seleccionar un almacén'
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
    if (!validateStep('users')) return

    setSubmitting(true)
    setErrors({})

    try {
      const response = await fetch('/api/market/pos/terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          warehouseId,
          pricelistId,
          allowPriceEdit,
          allowDiscount,
          maxDiscountPercent,
          requireCustomer,
          defaultCurrency,
          acceptedCurrencies,
          userIds: selectedUsers
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push('/dashboard/market/pos')
      } else {
        setErrors({ submit: data.error || 'Error al crear terminal' })
      }
    } catch (err) {
      setErrors({ submit: 'Error de conexión' })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleCurrency = (currency: string) => {
    if (currency === defaultCurrency) return

    setAcceptedCurrencies(prev =>
      prev.includes(currency)
        ? prev.filter(c => c !== currency)
        : [...prev, currency]
    )
  }

  const toggleUser = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  return (
    
      
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
                {/* Step 1: Basic Info */}
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
                        <Monitor className="w-5 h-5 text-white" />
                      </div>
                      Información del Terminal
                    </h2>

                    <div className="space-y-5">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Nombre del Terminal *
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ej: Caja Principal, POS Tienda 1"
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
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Warehouse className="w-4 h-4" />
                          Almacén *
                        </label>
                        <select
                          value={warehouseId || ''}
                          onChange={(e) => setWarehouseId(e.target.value ? parseInt(e.target.value) : null)}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            errors.warehouse
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        >
                          <option value="">Seleccionar almacén...</option>
                          {warehouses.map(wh => (
                            <option key={wh.id} value={wh.id}>
                              {wh.name} ({wh.code})
                            </option>
                          ))}
                        </select>
                        {errors.warehouse && <p className="text-red-500 text-xs mt-1">{errors.warehouse}</p>}
                        <p className="text-xs text-gray-500 mt-1">
                          El inventario se descontará de este almacén
                        </p>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Tag className="w-4 h-4" />
                          Lista de Precios
                        </label>
                        <select
                          value={pricelistId || ''}
                          onChange={(e) => setPricelistId(e.target.value ? parseInt(e.target.value) : null)}
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        >
                          <option value="">Precios por defecto</option>
                          {pricelists.map(pl => (
                            <option key={pl.id} value={pl.id}>
                              {pl.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Opcional. Deja vacío para usar precios estándar.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Currency */}
                {currentStep === 'currency' && (
                  <motion.div
                    key="currency"
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
                        <DollarSign className="w-5 h-5 text-white" />
                      </div>
                      Configuración de Monedas
                    </h2>

                    <div className="space-y-6">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-3",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Moneda por Defecto
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {['USD', 'CUP', 'MLC'].map(currency => (
                            <motion.button
                              key={currency}
                              type="button"
                              onClick={() => {
                                setDefaultCurrency(currency)
                                if (!acceptedCurrencies.includes(currency)) {
                                  setAcceptedCurrencies(prev => [...prev, currency])
                                }
                              }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                'py-4 rounded-xl font-bold text-lg transition-all',
                                defaultCurrency === currency
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                                  : theme === 'dark'
                                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              )}
                            >
                              {currency}
                            </motion.button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Esta será la moneda principal para mostrar precios
                        </p>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-3",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Monedas Aceptadas para Pagos
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {['USD', 'CUP', 'MLC'].map(currency => (
                            <motion.button
                              key={currency}
                              type="button"
                              onClick={() => toggleCurrency(currency)}
                              disabled={currency === defaultCurrency}
                              whileHover={{ scale: currency === defaultCurrency ? 1 : 1.02 }}
                              whileTap={{ scale: currency === defaultCurrency ? 1 : 0.98 }}
                              className={cn(
                                'py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2',
                                acceptedCurrencies.includes(currency)
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25'
                                  : theme === 'dark'
                                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-400'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-500',
                                currency === defaultCurrency && 'opacity-70 cursor-not-allowed'
                              )}
                            >
                              {acceptedCurrencies.includes(currency) && <CheckCircle className="w-5 h-5" />}
                              {currency}
                            </motion.button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Los clientes podrán pagar en cualquiera de estas monedas
                        </p>
                      </div>

                      {/* Currency Preview */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'p-5 rounded-xl border-2 border-dashed',
                          theme === 'dark' ? 'border-gray-600 bg-gray-900/30' : 'border-gray-300 bg-gray-50'
                        )}
                      >
                        <p className={cn(
                          "text-sm font-medium mb-3",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Resumen de Configuración
                        </p>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">Principal:</span>
                            <span className={cn(
                              "font-bold",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              {defaultCurrency}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">Aceptadas:</span>
                            <div className="flex gap-1">
                              {acceptedCurrencies.map(c => (
                                <span
                                  key={c}
                                  className={cn(
                                    "px-2 py-0.5 rounded-full text-xs font-medium",
                                    theme === 'dark'
                                      ? 'bg-green-900/50 text-green-300'
                                      : 'bg-green-100 text-green-700'
                                  )}
                                >
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Permissions */}
                {currentStep === 'permissions' && (
                  <motion.div
                    key="permissions"
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
                        <Settings className="w-5 h-5 text-white" />
                      </div>
                      Permisos del Terminal
                    </h2>

                    <div className="space-y-4">
                      <motion.label
                        whileHover={{ scale: 1.01 }}
                        className={cn(
                          'flex items-center justify-between p-5 rounded-xl cursor-pointer transition-all border',
                          allowPriceEdit
                            ? theme === 'dark' ? 'bg-blue-900/20 border-blue-500' : 'bg-blue-50 border-blue-500'
                            : theme === 'dark' ? 'bg-gray-700/50 border-gray-700 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        )}
                      >
                        <div className="flex-1">
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>Permitir editar precios</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Los cajeros pueden modificar el precio de venta durante la transacción
                          </p>
                        </div>
                        <div className={cn(
                          "relative w-12 h-7 rounded-full transition-colors",
                          allowPriceEdit
                            ? 'bg-blue-500'
                            : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                        )}>
                          <motion.div
                            animate={{ x: allowPriceEdit ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow"
                          />
                        </div>
                        <input
                          type="checkbox"
                          checked={allowPriceEdit}
                          onChange={(e) => setAllowPriceEdit(e.target.checked)}
                          className="sr-only"
                        />
                      </motion.label>

                      <motion.label
                        whileHover={{ scale: 1.01 }}
                        className={cn(
                          'flex items-center justify-between p-5 rounded-xl cursor-pointer transition-all border',
                          allowDiscount
                            ? theme === 'dark' ? 'bg-emerald-900/20 border-emerald-500' : 'bg-emerald-50 border-emerald-500'
                            : theme === 'dark' ? 'bg-gray-700/50 border-gray-700 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        )}
                      >
                        <div className="flex-1">
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>Permitir descuentos</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Los cajeros pueden aplicar descuentos a productos o al total
                          </p>
                        </div>
                        <div className={cn(
                          "relative w-12 h-7 rounded-full transition-colors",
                          allowDiscount
                            ? 'bg-emerald-500'
                            : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                        )}>
                          <motion.div
                            animate={{ x: allowDiscount ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow"
                          />
                        </div>
                        <input
                          type="checkbox"
                          checked={allowDiscount}
                          onChange={(e) => setAllowDiscount(e.target.checked)}
                          className="sr-only"
                        />
                      </motion.label>

                      <AnimatePresence>
                        {allowDiscount && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pl-6"
                          >
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              Descuento máximo permitido
                            </label>
                            <div className="flex items-center gap-3">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={maxDiscountPercent}
                                onChange={(e) => setMaxDiscountPercent(parseInt(e.target.value))}
                                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                              <span className={cn(
                                "w-16 text-center font-bold text-lg",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {maxDiscountPercent}%
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.label
                        whileHover={{ scale: 1.01 }}
                        className={cn(
                          'flex items-center justify-between p-5 rounded-xl cursor-pointer transition-all border',
                          requireCustomer
                            ? theme === 'dark' ? 'bg-amber-900/20 border-amber-500' : 'bg-amber-50 border-amber-500'
                            : theme === 'dark' ? 'bg-gray-700/50 border-gray-700 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        )}
                      >
                        <div className="flex-1">
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>Requerir cliente</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Obligatorio seleccionar un cliente antes de completar cada venta
                          </p>
                        </div>
                        <div className={cn(
                          "relative w-12 h-7 rounded-full transition-colors",
                          requireCustomer
                            ? 'bg-amber-500'
                            : theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
                        )}>
                          <motion.div
                            animate={{ x: requireCustomer ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow"
                          />
                        </div>
                        <input
                          type="checkbox"
                          checked={requireCustomer}
                          onChange={(e) => setRequireCustomer(e.target.checked)}
                          className="sr-only"
                        />
                      </motion.label>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Users */}
                {currentStep === 'users' && (
                  <motion.div
                    key="users"
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
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      Usuarios Asignados
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Selecciona los usuarios que tendrán acceso a este terminal POS. Si no seleccionas ninguno, todos los usuarios de la empresa podrán acceder.
                    </p>

                    {loadingOptions ? (
                      <div className="text-center py-12">
                        <Loader2 className="w-10 h-10 animate-spin mx-auto text-blue-500" />
                        <p className="text-gray-500 mt-3">Cargando usuarios...</p>
                      </div>
                    ) : users.length === 0 ? (
                      <div className={cn(
                        "text-center py-12 rounded-xl border-2 border-dashed",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <Users className={cn(
                          "w-12 h-12 mx-auto mb-3",
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                        )} />
                        <p className="text-gray-500">No hay usuarios disponibles</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                        {users.map((user, index) => (
                          <motion.label
                            key={user.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            whileHover={{ scale: 1.01 }}
                            className={cn(
                              'flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border',
                              selectedUsers.includes(user.id)
                                ? theme === 'dark' ? 'bg-blue-900/30 border-blue-500' : 'bg-blue-50 border-blue-500'
                                : theme === 'dark' ? 'bg-gray-700/50 border-gray-700 hover:bg-gray-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                            )}
                          >
                            <div className={cn(
                              "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
                              selectedUsers.includes(user.id)
                                ? 'bg-blue-500 border-blue-500'
                                : theme === 'dark' ? 'border-gray-500' : 'border-gray-300'
                            )}>
                              {selectedUsers.includes(user.id) && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                >
                                  <Check className="w-4 h-4 text-white" />
                                </motion.div>
                              )}
                            </div>
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user.id)}
                              onChange={() => toggleUser(user.id)}
                              className="sr-only"
                            />
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                              user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
                                ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                                : 'bg-gradient-to-br from-blue-500 to-blue-600'
                            )}>
                              {(user.firstname?.[0] || user.email[0]).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-medium truncate",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {user.firstname && user.lastname
                                  ? `${user.firstname} ${user.lastname}`
                                  : user.email}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                            <span className={cn(
                              "text-xs px-3 py-1.5 rounded-full font-medium",
                              user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            )}>
                              {user.role}
                            </span>
                          </motion.label>
                        ))}
                      </div>
                    )}

                    {selectedUsers.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          'p-4 rounded-xl',
                          theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                        )}
                      >
                        <p className={cn(
                          "text-sm font-medium",
                          theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
                        )}>
                          {selectedUsers.length} usuario(s) seleccionado(s)
                        </p>
                      </motion.div>
                    )}

                    {errors.submit && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          'p-4 rounded-xl border',
                          theme === 'dark'
                            ? 'bg-red-900/20 border-red-800 text-red-300'
                            : 'bg-red-50 border-red-200 text-red-700'
                        )}
                      >
                        {errors.submit}
                      </motion.div>
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

              {currentStep === 'users' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-400/30',
                    'text-white'
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Crear Terminal
                    </>
                  )}
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
                        onClick={() => router.push('/dashboard/market/pos')}
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
      
    
  )
}
