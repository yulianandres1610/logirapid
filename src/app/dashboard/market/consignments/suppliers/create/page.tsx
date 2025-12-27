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
  CheckCircle,
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Eye,
  EyeOff,
  Landmark,
  AlertTriangle
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  { id: 'company', title: 'Empresa', description: 'Informacion basica', icon: Building2 },
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
  // Step 1: Company Info
  code: string
  name: string
  legalName: string
  taxId: string
  contactName: string
  email: string
  phone: string
  address: string
  // Step 2: Bank Accounts
  bankAccounts: BankAccount[]
  // Step 3: Credentials
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

  // New bank account form
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
        // Bank accounts are optional
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

    const stepIndex = STEPS.findIndex(s => s.id === currentStep)
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].id)
    }
  }

  const goToPreviousStep = () => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep)
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id)
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
        <div className="min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Link href="/dashboard/market/consignments/suppliers">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  )}
                >
                  <ArrowLeft className="w-5 h-5" />
                </motion.button>
              </Link>
              <div>
                <h1 className={cn(
                  'text-2xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>Nuevo Proveedor</h1>
                <p className="text-sm text-gray-500">Registra un nuevo proveedor de consignacion</p>
              </div>
            </div>

            {/* Step Indicator */}
            <div className={cn(
              'p-4 rounded-2xl mb-6 border',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => {
                  const isActive = step.id === currentStep
                  const isComplete = index < currentStepIndex || createdSupplier !== null
                  const StepIcon = step.icon

                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                          isComplete
                            ? 'bg-emerald-500 text-white'
                            : isActive
                              ? theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                              : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-400'
                        )}>
                          {isComplete ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <StepIcon className="w-5 h-5" />
                          )}
                        </div>
                        <div className="hidden sm:block">
                          <p className={cn(
                            'text-sm font-medium',
                            isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500'
                          )}>{step.title}</p>
                          <p className="text-xs text-gray-400">{step.description}</p>
                        </div>
                      </div>
                      {index < STEPS.length - 1 && (
                        <div className={cn(
                          'flex-1 h-0.5 mx-4',
                          isComplete
                            ? 'bg-emerald-500'
                            : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className={cn(
              'rounded-2xl border p-6',
              theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'
            )}>
              <AnimatePresence mode="wait">
                {/* Step 1: Company Info */}
                {currentStep === 'company' && !createdSupplier && (
                  <motion.div
                    key="company"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Informacion de la Empresa
                      </h2>
                      <p className="text-sm text-gray-500">
                        Datos basicos del proveedor
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Code */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Codigo *
                        </label>
                        <input
                          type="text"
                          value={formData.code}
                          onChange={(e) => updateFormData('code', e.target.value.toUpperCase())}
                          maxLength={10}
                          placeholder="ABC"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500',
                            errors.code && 'border-red-500'
                          )}
                        />
                        {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
                      </div>

                      {/* Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Nombre *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => updateFormData('name', e.target.value)}
                          placeholder="Nombre del proveedor"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500',
                            errors.name && 'border-red-500'
                          )}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                      </div>

                      {/* Legal Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Razon Social
                        </label>
                        <input
                          type="text"
                          value={formData.legalName}
                          onChange={(e) => updateFormData('legalName', e.target.value)}
                          placeholder="Razon social"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>

                      {/* Tax ID */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          RIF / NIT
                        </label>
                        <input
                          type="text"
                          value={formData.taxId}
                          onChange={(e) => updateFormData('taxId', e.target.value)}
                          placeholder="J-12345678-9"
                          className={cn(
                            'w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            theme === 'dark'
                              ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                              : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                          )}
                        />
                      </div>

                      {/* Contact Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Persona de Contacto
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={formData.contactName}
                            onChange={(e) => updateFormData('contactName', e.target.value)}
                            placeholder="Nombre del contacto"
                            className={cn(
                              'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                            )}
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => updateFormData('email', e.target.value)}
                            placeholder="email@ejemplo.com"
                            className={cn(
                              'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 focus:border-blue-500',
                              errors.email && 'border-red-500'
                            )}
                          />
                        </div>
                        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Telefono
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={formData.phone}
                            onChange={(e) => updateFormData('phone', e.target.value)}
                            placeholder="+1 234 567 8900"
                            className={cn(
                              'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                            )}
                          />
                        </div>
                      </div>

                      {/* Address */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Direccion
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                          <textarea
                            value={formData.address}
                            onChange={(e) => updateFormData('address', e.target.value)}
                            rows={2}
                            placeholder="Direccion completa"
                            className={cn(
                              'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all resize-none',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 focus:border-blue-500'
                            )}
                          />
                        </div>
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
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Cuentas Bancarias
                      </h2>
                      <p className="text-sm text-gray-500">
                        Agrega las cuentas bancarias del proveedor para pagos (opcional)
                      </p>
                    </div>

                    {/* Add Bank Account Form */}
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                    )}>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Agregar Cuenta
                      </h3>

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
                                'w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all text-sm',
                                theme === 'dark'
                                  ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500'
                                  : 'bg-white border-gray-300 focus:border-blue-500'
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
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all text-sm',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500'
                                : 'bg-white border-gray-300 focus:border-blue-500'
                            )}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Tipo de Cuenta</label>
                          <select
                            value={newBank.accountType}
                            onChange={(e) => setNewBank(p => ({ ...p, accountType: e.target.value }))}
                            className={cn(
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all text-sm',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500'
                                : 'bg-white border-gray-300 focus:border-blue-500'
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
                              'w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 transition-all text-sm',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-600 text-white focus:border-blue-500'
                                : 'bg-white border-gray-300 focus:border-blue-500'
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
                        className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Agregar Cuenta
                      </motion.button>
                    </div>

                    {/* Bank Accounts List */}
                    {formData.bankAccounts.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Cuentas Agregadas ({formData.bankAccounts.length})
                        </h3>
                        {formData.bankAccounts.map((account, index) => (
                          <motion.div
                            key={account.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                              'p-4 rounded-xl border flex items-center justify-between',
                              theme === 'dark' ? 'bg-gray-700/30 border-gray-600' : 'bg-white border-gray-200'
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
                      <div className="text-center py-8 text-gray-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No hay cuentas bancarias agregadas</p>
                        <p className="text-sm">Este paso es opcional</p>
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
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Acceso al Portal
                      </h2>
                      <p className="text-sm text-gray-500">
                        Configura las credenciales para que el proveedor acceda a su portal (opcional)
                      </p>
                    </div>

                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'
                    )}>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        El proveedor podra acceder en <strong>proveedores.logirapid.com</strong> con estas credenciales para ver sus ordenes, ventas y solicitar pagos.
                      </p>
                    </div>

                    <div className="space-y-4 max-w-md">
                      {/* Username */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Nombre de Usuario
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => updateFormData('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
                            placeholder="usuario123"
                            className={cn(
                              'w-full pl-10 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 focus:border-blue-500',
                              errors.username && 'border-red-500'
                            )}
                          />
                        </div>
                        {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Contrasena
                        </label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={(e) => updateFormData('password', e.target.value)}
                            placeholder="Minimo 6 caracteres"
                            className={cn(
                              'w-full pl-10 pr-12 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 focus:border-blue-500',
                              errors.password && 'border-red-500'
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                      </div>

                      {/* Confirm Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Confirmar Contrasena
                        </label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                            placeholder="Repetir contrasena"
                            className={cn(
                              'w-full pl-10 pr-12 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500'
                                : 'bg-gray-50 border-gray-200 focus:border-blue-500',
                              errors.confirmPassword && 'border-red-500'
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                      </div>
                    </div>

                    {!formData.username && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        Si no configuras credenciales, el proveedor no podra acceder al portal
                      </div>
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
                    className="space-y-6"
                  >
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        Revisar y Confirmar
                      </h2>
                      <p className="text-sm text-gray-500">
                        Verifica la informacion antes de crear el proveedor
                      </p>
                    </div>

                    {errors.submit && (
                      <div className={cn(
                        'p-4 rounded-xl flex items-center gap-3',
                        theme === 'dark' ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'
                      )}>
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{errors.submit}</p>
                      </div>
                    )}

                    {/* Company Info Summary */}
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'
                    )}>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <h3 className="font-medium text-gray-900 dark:text-white">Informacion de Empresa</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Codigo:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">{formData.code}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Nombre:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">{formData.name}</span>
                        </div>
                        {formData.legalName && (
                          <div>
                            <span className="text-gray-500">Razon Social:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">{formData.legalName}</span>
                          </div>
                        )}
                        {formData.taxId && (
                          <div>
                            <span className="text-gray-500">RIF/NIT:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">{formData.taxId}</span>
                          </div>
                        )}
                        {formData.email && (
                          <div>
                            <span className="text-gray-500">Email:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">{formData.email}</span>
                          </div>
                        )}
                        {formData.phone && (
                          <div>
                            <span className="text-gray-500">Telefono:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">{formData.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bank Accounts Summary */}
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'
                    )}>
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="w-4 h-4 text-gray-500" />
                        <h3 className="font-medium text-gray-900 dark:text-white">Cuentas Bancarias</h3>
                      </div>
                      {formData.bankAccounts.length > 0 ? (
                        <div className="space-y-2">
                          {formData.bankAccounts.map(account => (
                            <div key={account.id} className="text-sm flex items-center gap-2">
                              <Landmark className="w-4 h-4 text-blue-500" />
                              <span className="text-gray-900 dark:text-white">{account.bankName}</span>
                              <span className="text-gray-500">****{account.accountNumber.slice(-4)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Sin cuentas bancarias</p>
                      )}
                    </div>

                    {/* Credentials Summary */}
                    <div className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-50 border-gray-200'
                    )}>
                      <div className="flex items-center gap-2 mb-3">
                        <KeyRound className="w-4 h-4 text-gray-500" />
                        <h3 className="font-medium text-gray-900 dark:text-white">Acceso al Portal</h3>
                      </div>
                      {formData.username ? (
                        <div className="text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="w-4 h-4 text-green-500" />
                            <span className="text-gray-500">Usuario:</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formData.username}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-green-600 dark:text-green-400">Contrasena configurada</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Sin acceso al portal configurado</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Confirmation */}
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
                      <CheckCircle className="w-10 h-10 text-emerald-500" />
                    </motion.div>

                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Proveedor Creado
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
                      <Link href="/dashboard/market/consignments/suppliers">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={cn(
                            'px-6 py-2.5 rounded-xl font-medium transition-colors',
                            theme === 'dark'
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          Ver Proveedores
                        </motion.button>
                      </Link>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setFormData(initialFormData)
                          setCreatedSupplier(null)
                          setCurrentStep('company')
                        }}
                        className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
                      >
                        Crear Otro
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              {!createdSupplier && (
                <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={goToPreviousStep}
                    disabled={currentStepIndex === 0}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all',
                      currentStepIndex === 0
                        ? 'opacity-50 cursor-not-allowed'
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Anterior
                  </motion.button>

                  {currentStep === 'review' ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSubmit}
                      disabled={submitting}
                      className={cn(
                        'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white transition-all',
                        submitting
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25'
                      )}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creando...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Crear Proveedor
                        </>
                      )}
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={goToNextStep}
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/25"
                    >
                      Siguiente
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
