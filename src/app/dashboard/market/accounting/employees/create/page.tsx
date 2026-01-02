'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Briefcase,
  CreditCard,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  Phone,
  Calendar,
  DollarSign,
  Percent,
  Hash,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface Terminal {
  id: number
  name: string
  location: string
  status: string
}

interface TerminalPermission {
  terminalId: number
  terminalName: string
  canOpenSession: boolean
  canCloseSession: boolean
  canVoidOrders: boolean
  canGiveDiscount: boolean
  canRefund: boolean
  maxDiscountPercent: number
}

const STEPS = [
  { id: 1, title: 'Datos Personales', icon: User },
  { id: 2, title: 'Datos Laborales', icon: Briefcase },
  { id: 3, title: 'Acceso POS', icon: CreditCard },
  { id: 4, title: 'Confirmación', icon: CheckCircle }
]

const ROLES = [
  { value: 'MARKET_MANAGER', label: 'Manager', description: 'Acceso completo, puede aprobar solicitudes' },
  { value: 'MARKET_COMERCIAL', label: 'Comercial', description: 'Ventas, puede ver sus comisiones' },
  { value: 'MARKET_ALMACENERO', label: 'Almacenero', description: 'Inventario, sin acceso a nóminas' },
  { value: 'MARKET_VENDEDOR', label: 'Vendedor', description: 'Solo POS, ve sus ventas y comisiones' }
]

const PAY_TYPES = [
  { value: 'hourly', label: 'Por Hora', description: 'Pago calculado por horas trabajadas' },
  { value: 'daily', label: 'Por Día', description: 'Pago calculado por días trabajados' },
  { value: 'monthly', label: 'Mensual', description: 'Salario fijo mensual' }
]

export default function CreateEmployeePage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Personal
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',

    // Step 2: Employment
    role: '',
    payType: '',
    payRate: '',
    currency: 'USD',
    hireDate: new Date().toISOString().split('T')[0],
    commissionRate: '',

    // Step 3: POS Access
    posPin: '',
    badgeCode: ''
  })

  const [terminalPermissions, setTerminalPermissions] = useState<TerminalPermission[]>([])

  useEffect(() => {
    fetchTerminals()
  }, [])

  const fetchTerminals = async () => {
    try {
      const response = await fetch('/api/market/pos/terminals')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setTerminals(result.data.terminals || [])
        }
      }
    } catch (error) {
      console.error('Error fetching terminals:', error)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const toggleTerminal = (terminal: Terminal) => {
    setTerminalPermissions(prev => {
      const existing = prev.find(p => p.terminalId === terminal.id)
      if (existing) {
        return prev.filter(p => p.terminalId !== terminal.id)
      }
      return [...prev, {
        terminalId: terminal.id,
        terminalName: terminal.name,
        canOpenSession: true,
        canCloseSession: true,
        canVoidOrders: false,
        canGiveDiscount: false,
        canRefund: false,
        maxDiscountPercent: 0
      }]
    })
  }

  const updateTerminalPermission = (terminalId: number, field: string, value: boolean | number) => {
    setTerminalPermissions(prev =>
      prev.map(p =>
        p.terminalId === terminalId ? { ...p, [field]: value } : p
      )
    )
  }

  const validateStep = (step: number): boolean => {
    setError('')

    switch (step) {
      case 1:
        if (!formData.email || !formData.password) {
          setError('Email y contraseña son requeridos')
          return false
        }
        if (!formData.email.includes('@')) {
          setError('Email inválido')
          return false
        }
        if (formData.password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres')
          return false
        }
        return true

      case 2:
        if (!formData.role || !formData.payType || !formData.payRate || !formData.hireDate) {
          setError('Rol, tipo de pago, tarifa y fecha de ingreso son requeridos')
          return false
        }
        if (parseFloat(formData.payRate) <= 0) {
          setError('La tarifa debe ser mayor a 0')
          return false
        }
        return true

      case 3:
        if (formData.posPin && (formData.posPin.length < 4 || formData.posPin.length > 6)) {
          setError('El PIN debe tener entre 4 y 6 dígitos')
          return false
        }
        if (formData.posPin && !/^\d+$/.test(formData.posPin)) {
          setError('El PIN solo debe contener números')
          return false
        }
        return true

      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
    setError('')
  }

  const createEmployee = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/market/accounting/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          phone: formData.phone || null,
          role: formData.role,
          payType: formData.payType,
          payRate: parseFloat(formData.payRate),
          currency: formData.currency,
          hireDate: formData.hireDate,
          commissionRate: formData.commissionRate ? parseFloat(formData.commissionRate) : 0,
          posPin: formData.posPin || null,
          badgeCode: formData.badgeCode || null,
          terminals: terminalPermissions.map(p => ({
            terminalId: p.terminalId,
            canOpenSession: p.canOpenSession,
            canCloseSession: p.canCloseSession,
            canVoidOrders: p.canVoidOrders,
            canGiveDiscount: p.canGiveDiscount,
            canRefund: p.canRefund,
            maxDiscountPercent: p.maxDiscountPercent
          }))
        })
      })

      const result = await response.json()

      if (result.success) {
        router.push('/dashboard/market/accounting/employees')
      } else {
        setError(result.error || 'Error al crear empleado')
      }
    } catch (error) {
      console.error('Error creating employee:', error)
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const getRoleLabel = (roleValue: string) => {
    return ROLES.find(r => r.value === roleValue)?.label || roleValue
  }

  const getPayTypeLabel = (payTypeValue: string) => {
    return PAY_TYPES.find(p => p.value === payTypeValue)?.label || payTypeValue
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              Volver
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Nuevo Empleado
            </h1>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                const isActive = currentStep === step.id
                const isCompleted = currentStep > step.id

                return (
                  <div key={step.id} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isActive
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      <span className={`text-xs mt-2 hidden sm:block ${
                        isActive ? 'text-purple-600 font-medium' : 'text-gray-500'
                      }`}>
                        {step.title}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`w-12 md:w-24 h-0.5 mx-2 ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-700 dark:text-red-400">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step Content */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <AnimatePresence mode="wait">
              {/* Step 1: Personal Data */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                    Datos Personales
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Mail className="w-4 h-4 inline mr-2" />
                        Email *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateFormData('email', e.target.value)}
                        placeholder="empleado@empresa.com"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Lock className="w-4 h-4 inline mr-2" />
                        Contraseña *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => updateFormData('password', e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <User className="w-4 h-4 inline mr-2" />
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => updateFormData('firstName', e.target.value)}
                        placeholder="Nombre"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <User className="w-4 h-4 inline mr-2" />
                        Apellido
                      </label>
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => updateFormData('lastName', e.target.value)}
                        placeholder="Apellido"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Phone className="w-4 h-4 inline mr-2" />
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateFormData('phone', e.target.value)}
                        placeholder="+1 234 567 8900"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Employment Data */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                    Datos Laborales
                  </h2>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Rol *
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ROLES.map(role => (
                        <div
                          key={role.value}
                          onClick={() => updateFormData('role', role.value)}
                          className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                            formData.role === role.value
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <h4 className="font-medium text-gray-900 dark:text-white">{role.label}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{role.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Tipo de Pago *
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {PAY_TYPES.map(payType => (
                        <div
                          key={payType.value}
                          onClick={() => updateFormData('payType', payType.value)}
                          className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                            formData.payType === payType.value
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <h4 className="font-medium text-gray-900 dark:text-white">{payType.label}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{payType.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <DollarSign className="w-4 h-4 inline mr-2" />
                        Tarifa *
                      </label>
                      <input
                        type="number"
                        value={formData.payRate}
                        onChange={(e) => updateFormData('payRate', e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Moneda
                      </label>
                      <select
                        value={formData.currency}
                        onChange={(e) => updateFormData('currency', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      >
                        <option value="USD">USD</option>
                        <option value="COP">COP</option>
                        <option value="EUR">EUR</option>
                        <option value="MXN">MXN</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Percent className="w-4 h-4 inline mr-2" />
                        Comisión %
                      </label>
                      <input
                        type="number"
                        value={formData.commissionRate}
                        onChange={(e) => updateFormData('commissionRate', e.target.value)}
                        placeholder="0"
                        step="0.5"
                        min="0"
                        max="100"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <Calendar className="w-4 h-4 inline mr-2" />
                      Fecha de Ingreso *
                    </label>
                    <input
                      type="date"
                      value={formData.hireDate}
                      onChange={(e) => updateFormData('hireDate', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 3: POS Access */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                    Acceso POS
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <Hash className="w-4 h-4 inline mr-2" />
                        PIN de Acceso (4-6 dígitos)
                      </label>
                      <div className="relative">
                        <input
                          type={showPin ? 'text' : 'password'}
                          value={formData.posPin}
                          onChange={(e) => updateFormData('posPin', e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="••••••"
                          maxLength={6}
                          className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                        >
                          {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Para inicio de sesión rápido en terminal POS</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        <CreditCard className="w-4 h-4 inline mr-2" />
                        Código de Badge
                      </label>
                      <input
                        type="text"
                        value={formData.badgeCode}
                        onChange={(e) => updateFormData('badgeCode', e.target.value)}
                        placeholder="Escanear o ingresar código"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900"
                      />
                      <p className="text-xs text-gray-500 mt-1">Opcional: Para login con tarjeta/badge</p>
                    </div>
                  </div>

                  {terminals.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Terminales y Permisos
                      </label>
                      <div className="space-y-4">
                        {terminals.filter(t => t.status === 'active').map(terminal => {
                          const permission = terminalPermissions.find(p => p.terminalId === terminal.id)
                          const isSelected = !!permission

                          return (
                            <div
                              key={terminal.id}
                              className={`border-2 rounded-xl transition-all ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                  : 'border-gray-200 dark:border-gray-700'
                              }`}
                            >
                              <div
                                onClick={() => toggleTerminal(terminal)}
                                className="p-4 cursor-pointer flex items-center justify-between"
                              >
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-white">{terminal.name}</h4>
                                  <p className="text-sm text-gray-500">{terminal.location}</p>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                  isSelected
                                    ? 'border-purple-500 bg-purple-500'
                                    : 'border-gray-300'
                                }`}>
                                  {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                                </div>
                              </div>

                              {isSelected && permission && (
                                <div className="px-4 pb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {[
                                      { key: 'canOpenSession', label: 'Abrir Sesión' },
                                      { key: 'canCloseSession', label: 'Cerrar Sesión' },
                                      { key: 'canVoidOrders', label: 'Anular Órdenes' },
                                      { key: 'canGiveDiscount', label: 'Dar Descuentos' },
                                      { key: 'canRefund', label: 'Reembolsos' }
                                    ].map(perm => (
                                      <label
                                        key={perm.key}
                                        className="flex items-center gap-2 text-sm cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={(permission as any)[perm.key]}
                                          onChange={(e) => updateTerminalPermission(terminal.id, perm.key, e.target.checked)}
                                          className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                        />
                                        <span className="text-gray-700 dark:text-gray-300">{perm.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                  {permission.canGiveDiscount && (
                                    <div className="mt-3">
                                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                        Descuento máximo (%)
                                      </label>
                                      <input
                                        type="number"
                                        value={permission.maxDiscountPercent}
                                        onChange={(e) => updateTerminalPermission(terminal.id, 'maxDiscountPercent', parseInt(e.target.value) || 0)}
                                        min="0"
                                        max="100"
                                        className="w-24 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {terminals.length === 0 && (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-xl">
                      <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-500">No hay terminales POS configuradas</p>
                      <p className="text-sm text-gray-400">Puedes agregar terminales después</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 4: Confirmation */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                    Confirmar Datos
                  </h2>

                  <div className="space-y-6">
                    {/* Personal Data Summary */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <User className="w-5 h-5 text-purple-600" />
                        Datos Personales
                      </h3>
                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-gray-500">Email</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">{formData.email}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Nombre</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">
                            {formData.firstName} {formData.lastName || '(No especificado)'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Teléfono</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">{formData.phone || 'No especificado'}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Employment Data Summary */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-purple-600" />
                        Datos Laborales
                      </h3>
                      <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <dt className="text-gray-500">Rol</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">{getRoleLabel(formData.role)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Tipo de Pago</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">{getPayTypeLabel(formData.payType)}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Tarifa</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">
                            {formData.currency} {parseFloat(formData.payRate).toLocaleString()}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Comisión</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">
                            {formData.commissionRate ? `${formData.commissionRate}%` : 'Sin comisión'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Fecha de Ingreso</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">
                            {new Date(formData.hireDate).toLocaleDateString('es-ES')}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {/* POS Access Summary */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                        Acceso POS
                      </h3>
                      <dl className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <dt className="text-gray-500">PIN</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">
                            {formData.posPin ? '••••••' : 'No configurado'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-gray-500">Badge</dt>
                          <dd className="font-medium text-gray-900 dark:text-white">
                            {formData.badgeCode || 'No configurado'}
                          </dd>
                        </div>
                      </dl>
                      {terminalPermissions.length > 0 && (
                        <div>
                          <dt className="text-gray-500 mb-2">Terminales Asignadas</dt>
                          <div className="flex flex-wrap gap-2">
                            {terminalPermissions.map(p => (
                              <span
                                key={p.terminalId}
                                className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm"
                              >
                                {p.terminalName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {terminalPermissions.length === 0 && (
                        <p className="text-sm text-gray-500">Sin terminales asignadas</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                  currentStep === 1
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </button>

              {currentStep < 4 ? (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={createEmployee}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Crear Empleado
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
