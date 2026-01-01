'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  CreditCard,
  KeyRound,
  Check,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  Landmark,
  AlertTriangle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'company' | 'banking' | 'credentials' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'company', title: 'Empresa', description: 'Datos basicos', icon: Building2 },
  { id: 'banking', title: 'Bancos', description: 'Cuentas bancarias', icon: CreditCard },
  { id: 'credentials', title: 'Acceso', description: 'Usuario y clave', icon: KeyRound },
  { id: 'review', title: 'Confirmar', description: 'Revisar y crear', icon: Check }
]

interface BankAccount {
  id: string
  bankName: string
  accountNumber: string
  accountType: string
  holderName: string
}

interface SupplierFormData {
  code: string
  name: string
  legalName: string
  taxId: string
  contactName: string
  email: string
  phone: string
  address: string
  bankAccounts: BankAccount[]
  username: string
  password: string
  confirmPassword: string
}

const initialFormData: SupplierFormData = {
  code: '',
  name: '',
  legalName: '',
  taxId: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  bankAccounts: [],
  username: '',
  password: '',
  confirmPassword: ''
}

export default function CreateSupplierWizardPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('company')
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [createdSupplier, setCreatedSupplier] = useState<{ id: number; code: string } | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)

  const [newBank, setNewBank] = useState({
    bankName: '',
    accountNumber: '',
    accountType: 'checking',
    holderName: ''
  })

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const updateFormData = (field: keyof SupplierFormData, value: string | BankAccount[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const copy = { ...prev }
        delete copy[field]
        return copy
      })
    }
  }

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 'company':
        if (!formData.code.trim()) newErrors.code = 'El codigo es requerido'
        else if (formData.code.length > 10) newErrors.code = 'Maximo 10 caracteres'
        if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = 'Email invalido'
        }
        break

      case 'banking':
        break

      case 'credentials':
        if (formData.username) {
          if (formData.username.length < 3) {
            newErrors.username = 'Minimo 3 caracteres'
          }
          if (!formData.password) {
            newErrors.password = 'La contrasena es requerida'
          } else if (formData.password.length < 6) {
            newErrors.password = 'Minimo 6 caracteres'
          }
          if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Las contrasenas no coinciden'
          }
        }
        break
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

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const addBankAccount = () => {
    if (!newBank.bankName.trim() || !newBank.accountNumber.trim()) {
      setErrors({ bank: 'Nombre del banco y numero de cuenta son requeridos' })
      return
    }

    const account: BankAccount = {
      id: Date.now().toString(),
      bankName: newBank.bankName,
      accountNumber: newBank.accountNumber,
      accountType: newBank.accountType,
      holderName: newBank.holderName || formData.name
    }

    updateFormData('bankAccounts', [...formData.bankAccounts, account])
    setNewBank({ bankName: '', accountNumber: '', accountType: 'checking', holderName: '' })
    setErrors({})
  }

  const removeBankAccount = (id: string) => {
    updateFormData('bankAccounts', formData.bankAccounts.filter(a => a.id !== id))
  }

  const handleSubmit = async () => {
    if (!validateStep('credentials')) return

    setSubmitting(true)
    setErrors({})

    try {
      const response = await fetch('/api/consignments/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formData.code.toUpperCase(),
          name: formData.name,
          legalName: formData.legalName || null,
          taxId: formData.taxId || null,
          contactName: formData.contactName || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          username: formData.username || null,
          password: formData.password || null,
          bankAccounts: formData.bankAccounts
        })
      })

      const data = await response.json()

      if (data.success) {
        setCreatedSupplier(data.data)
      } else {
        setErrors({ submit: data.error || 'Error al crear proveedor' })
      }
    } catch (error) {
      console.error('Error:', error)
      setErrors({ submit: 'Error de conexion' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className={cn(
          "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
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
                                ? 'rgba(16, 185, 129, 0.5)'
                                : 'rgba(5, 150, 105, 0.5)'
                            }}
                          />
                        )}

                        <motion.div
                          initial={false}
                          animate={{
                            scale: currentStep === step.id ? 1.1 : 1,
                            backgroundColor: currentStep === step.id
                              ? theme === 'dark' ? '#10B981' : '#059669'
                              : currentStepIndex > index || createdSupplier
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
                                ? 'shadow-lg shadow-emerald-500/50'
                                : 'shadow-lg shadow-emerald-400/50'
                            ),
                            (currentStepIndex > index || createdSupplier) && (
                              theme === 'dark'
                                ? 'shadow-md shadow-emerald-500/30'
                                : 'shadow-md shadow-emerald-400/30'
                            )
                          )}
                        >
                          {currentStepIndex > index || createdSupplier ? (
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
                            ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                            : currentStepIndex > index || createdSupplier
                              ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
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
                            scaleX: currentStepIndex > index || createdSupplier ? 1 : 0
                          }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          className={cn(
                            "h-full origin-left rounded-full",
                            theme === 'dark' ? 'bg-emerald-500' : 'bg-emerald-600'
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
                  ? 'bg-gray-900 border-gray-700 backdrop-blur-sm'
                  : 'bg-white border-gray-200 backdrop-blur-sm'
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                {/* Step 1: Company Info */}
                {currentStep === 'company' && !createdSupplier && (
                  <motion.div
                    key="company"
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
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      Informacion de la Empresa
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Codigo *
                        </label>
                        <input
                          type="text"
                          value={formData.code}
                          onChange={(e) => updateFormData('code', e.target.value.toUpperCase())}
                          maxLength={10}
                          placeholder="ABC"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                            errors.code
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                        {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Nombre *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => updateFormData('name', e.target.value)}
                          placeholder="Nombre del proveedor"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            errors.name
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Razon Social
                        </label>
                        <input
                          type="text"
                          value={formData.legalName}
                          onChange={(e) => updateFormData('legalName', e.target.value)}
                          placeholder="Razon social"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          RIF / NIT
                        </label>
                        <input
                          type="text"
                          value={formData.taxId}
                          onChange={(e) => updateFormData('taxId', e.target.value)}
                          placeholder="J-12345678-9"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <User className="w-4 h-4" />
                          Persona de Contacto
                        </label>
                        <input
                          type="text"
                          value={formData.contactName}
                          onChange={(e) => updateFormData('contactName', e.target.value)}
                          placeholder="Nombre del contacto"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Mail className="w-4 h-4" />
                          Email
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => updateFormData('email', e.target.value)}
                          placeholder="email@ejemplo.com"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            errors.email
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <Phone className="w-4 h-4" />
                          Telefono
                        </label>
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={(e) => updateFormData('phone', e.target.value)}
                          placeholder="+1 234 567 8900"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <MapPin className="w-4 h-4" />
                          Direccion
                        </label>
                        <textarea
                          value={formData.address}
                          onChange={(e) => updateFormData('address', e.target.value)}
                          rows={2}
                          placeholder="Direccion completa"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                            theme === 'dark'
                              ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Banking */}
                {currentStep === 'banking' && !createdSupplier && (
                  <motion.div
                    key="banking"
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
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      Cuentas Bancarias
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Agrega las cuentas bancarias del proveedor para pagos. Este paso es opcional.
                    </p>

                    {/* Add Bank Account Form */}
                    <div className={cn(
                      "p-4 rounded-xl border",
                      theme === 'dark' ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'
                    )}>
                      <label className={cn(
                        "block text-sm font-medium mb-3",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        Agregar cuenta bancaria
                      </label>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Nombre del Banco *</label>
                          <div className="relative">
                            <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={newBank.bankName}
                              onChange={(e) => setNewBank(p => ({ ...p, bankName: e.target.value }))}
                              placeholder="Bank of America"
                              className={cn(
                                'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                                theme === 'dark'
                                  ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                  : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500/20'
                              )}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Numero de Cuenta *</label>
                          <input
                            type="text"
                            value={newBank.accountNumber}
                            onChange={(e) => setNewBank(p => ({ ...p, accountNumber: e.target.value }))}
                            placeholder="1234567890"
                            className={cn(
                              'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Tipo de Cuenta</label>
                          <select
                            value={newBank.accountType}
                            onChange={(e) => setNewBank(p => ({ ...p, accountType: e.target.value }))}
                            className={cn(
                              'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          >
                            <option value="checking">Corriente</option>
                            <option value="savings">Ahorro</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Titular</label>
                          <input
                            type="text"
                            value={newBank.holderName}
                            onChange={(e) => setNewBank(p => ({ ...p, holderName: e.target.value }))}
                            placeholder={formData.name || 'Nombre del titular'}
                            className={cn(
                              'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                        </div>
                      </div>

                      {errors.bank && (
                        <p className="text-xs text-red-500 mt-2">{errors.bank}</p>
                      )}

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={addBankAccount}
                        className={cn(
                          "mt-4 px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2",
                          theme === 'dark'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        )}
                      >
                        <Plus className="w-4 h-4" />
                        Agregar Cuenta
                      </motion.button>
                    </div>

                    {/* Bank Accounts List */}
                    {formData.bankAccounts.length > 0 && (
                      <div className="space-y-3">
                        <h3 className={cn(
                          "font-semibold",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          Cuentas Agregadas ({formData.bankAccounts.length})
                        </h3>
                        {formData.bankAccounts.map((account, index) => (
                          <motion.div
                            key={account.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                              'p-4 rounded-xl border flex items-center justify-between',
                              theme === 'dark' ? 'bg-gray-900/30 border-gray-700' : 'bg-white border-gray-200'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center',
                                theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'
                              )}>
                                <Landmark className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {account.bankName}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {account.accountType === 'checking' ? 'Corriente' : 'Ahorro'} - ****{account.accountNumber.slice(-4)}
                                </p>
                                <p className="text-xs text-gray-400">{account.holderName}</p>
                              </div>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => removeBankAccount(account.id)}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {formData.bankAccounts.length === 0 && (
                      <div className={cn(
                        "text-center py-12 rounded-xl border-2 border-dashed",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <CreditCard className={cn(
                          "w-12 h-12 mx-auto mb-3",
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
                        )} />
                        <p className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                        )}>
                          No hay cuentas bancarias agregadas
                        </p>
                        <p className={cn(
                          "text-sm mt-1",
                          theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                        )}>
                          Puedes continuar sin agregar cuentas
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Credentials */}
                {currentStep === 'credentials' && !createdSupplier && (
                  <motion.div
                    key="credentials"
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
                        <KeyRound className="w-5 h-5 text-white" />
                      </div>
                      Acceso al Portal
                    </h2>

                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'
                    )}>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        El proveedor podra acceder en <strong>proveedores.logirapid.com</strong> con estas credenciales para ver sus ordenes, ventas y solicitar pagos.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <User className="w-4 h-4" />
                          Nombre de Usuario
                        </label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(e) => updateFormData('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
                          placeholder="usuario123"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            errors.username
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                          )}
                        />
                        {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <KeyRound className="w-4 h-4" />
                          Contrasena
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={(e) => updateFormData('password', e.target.value)}
                            placeholder="Minimo 6 caracteres"
                            className={cn(
                              'w-full px-4 py-3 pr-12 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              errors.password
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2 flex items-center gap-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          <KeyRound className="w-4 h-4" />
                          Confirmar Contrasena
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                            placeholder="Repetir contrasena"
                            className={cn(
                              'w-full px-4 py-3 pr-12 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              errors.confirmPassword
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-purple-500 focus:ring-purple-500/20'
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                      </div>
                    </div>

                    {!formData.username && (
                      <p className={cn(
                        "text-sm text-center",
                        theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                      )}>
                        Este paso es opcional. Si no configuras credenciales, el proveedor no podra acceder al portal.
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Step 4: Review */}
                {currentStep === 'review' && !createdSupplier && (
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
                      Revision del Proveedor
                    </h2>

                    {errors.submit && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <p className="text-red-600 text-sm">{errors.submit}</p>
                      </div>
                    )}

                    <div className={cn(
                      'rounded-2xl p-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      {/* Company Info */}
                      <div className="mb-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Building2 className="w-5 h-5 text-emerald-500" />
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>Informacion de Empresa</h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div className={cn(
                            "p-3 rounded-xl",
                            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                          )}>
                            <p className="text-xs text-gray-500">Codigo</p>
                            <p className="font-bold text-gray-900 dark:text-white font-mono">{formData.code}</p>
                          </div>
                          <div className={cn(
                            "p-3 rounded-xl col-span-2",
                            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                          )}>
                            <p className="text-xs text-gray-500">Nombre</p>
                            <p className="font-bold text-gray-900 dark:text-white">{formData.name}</p>
                          </div>
                          {formData.email && (
                            <div className={cn(
                              "p-3 rounded-xl",
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            )}>
                              <p className="text-xs text-gray-500">Email</p>
                              <p className="text-sm text-gray-900 dark:text-white">{formData.email}</p>
                            </div>
                          )}
                          {formData.phone && (
                            <div className={cn(
                              "p-3 rounded-xl",
                              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                            )}>
                              <p className="text-xs text-gray-500">Telefono</p>
                              <p className="text-sm text-gray-900 dark:text-white">{formData.phone}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bank Accounts */}
                      <div className={cn(
                        "pt-6 border-t mb-6",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className="flex items-center gap-2 mb-4">
                          <CreditCard className="w-5 h-5 text-blue-500" />
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>Cuentas Bancarias ({formData.bankAccounts.length})</h3>
                        </div>
                        {formData.bankAccounts.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {formData.bankAccounts.map((account) => (
                              <span
                                key={account.id}
                                className={cn(
                                  "text-sm px-3 py-1 rounded-full",
                                  theme === 'dark'
                                    ? 'bg-blue-900/30 text-blue-300'
                                    : 'bg-blue-100 text-blue-700'
                                )}
                              >
                                {account.bankName} - ****{account.accountNumber.slice(-4)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Sin cuentas bancarias</p>
                        )}
                      </div>

                      {/* Credentials */}
                      <div className={cn(
                        "pt-6 border-t",
                        theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                      )}>
                        <div className="flex items-center gap-2 mb-4">
                          <KeyRound className="w-5 h-5 text-purple-500" />
                          <h3 className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>Acceso al Portal</h3>
                        </div>
                        {formData.username ? (
                          <div className={cn(
                            "p-3 rounded-xl inline-flex items-center gap-3",
                            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                          )}>
                            <Check className="w-4 h-4 text-green-500" />
                            <div>
                              <p className="text-xs text-gray-500">Usuario</p>
                              <p className="font-medium text-gray-900 dark:text-white">{formData.username}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Sin acceso al portal configurado</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Success */}
                {createdSupplier && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                      className="w-20 h-20 mx-auto mb-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center"
                    >
                      <Check className="w-10 h-10 text-emerald-500" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Proveedor Creado!
                    </h2>
                    <p className="text-gray-500 mb-6">
                      El proveedor ha sido registrado exitosamente
                    </p>

                    <div className={cn(
                      'inline-block p-4 rounded-xl mb-6',
                      theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'
                    )}>
                      <p className="text-sm text-gray-500">Codigo del Proveedor</p>
                      <p className="text-2xl font-bold font-mono text-gray-900 dark:text-white">
                        {createdSupplier.code}
                      </p>
                    </div>

                    {formData.username && (
                      <div className={cn(
                        'p-4 rounded-xl mb-6 text-left max-w-sm mx-auto',
                        theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'
                      )}>
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                          Credenciales del Portal
                        </p>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          Usuario: <strong>{formData.username}</strong>
                        </p>
                        <p className="text-xs text-blue-500 mt-1">
                          proveedores.logirapid.com
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3 justify-center">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/dashboard/market/consignments/suppliers')}
                        className={cn(
                          'px-6 py-3 rounded-xl font-medium transition-all',
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                        )}
                      >
                        Ver Proveedores
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setFormData(initialFormData)
                          setCreatedSupplier(null)
                          setCurrentStep('company')
                        }}
                        className={cn(
                          'px-6 py-3 rounded-xl font-medium transition-all text-white',
                          theme === 'dark'
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800'
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700'
                        )}
                      >
                        Crear Otro
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons */}
            {!createdSupplier && (
              <div className="flex justify-between items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToPreviousStep}
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
                    disabled={submitting}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      theme === 'dark'
                        ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg shadow-emerald-500/30'
                        : 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 shadow-lg shadow-emerald-400/30',
                      'text-white'
                    )}
                  >
                    {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
                    <Check className="w-5 h-5" />
                    Crear Proveedor
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={goToNextStep}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                      theme === 'dark'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-400/30',
                      'text-white'
                    )}
                  >
                    Siguiente
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                )}
              </div>
            )}
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
                            Cancelar creacion?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Se perdera toda la informacion ingresada y no podras recuperarla.
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
                        onClick={() => router.push('/dashboard/market/consignments/suppliers')}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500 hover:bg-red-600'
                        )}
                      >
                        Si, cancelar
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
