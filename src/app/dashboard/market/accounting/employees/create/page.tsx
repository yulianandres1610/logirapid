'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Loader2,
  X,
  Warehouse as WarehouseIcon
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Terminal {
  id: number
  name: string
  location: string
  status: string
}

interface Warehouse {
  id: number
  name: string
  code: string
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
  { id: 'personal', title: 'Datos Personales', icon: User },
  { id: 'employment', title: 'Datos Laborales', icon: Briefcase },
  { id: 'pos', title: 'Acceso POS', icon: CreditCard },
  { id: 'confirm', title: 'Confirmación', icon: CheckCircle }
]

const ROLES = [
  { value: 'MARKET_MANAGER', label: 'Manager General', description: 'Acceso completo a todo el sistema' },
  { value: 'MARKET_MANAGER_TIENDA', label: 'Manager Tienda', description: 'Gestiona tienda: acepta transferencias, arqueos, cajeros' },
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
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState<string>('personal')
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [loadingEmployee, setLoadingEmployee] = useState(false)

  // Detectar modo edición
  const editId = searchParams.get('edit')
  const isEditMode = !!editId

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

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
    warehouseId: '', // For MARKET_ALMACENERO

    // Step 3: POS Access
    posPin: '',
    badgeCode: ''
  })

  const [terminalPermissions, setTerminalPermissions] = useState<TerminalPermission[]>([])

  useEffect(() => {
    fetchTerminals()
    fetchWarehouses()
  }, [])

  // Cargar datos del empleado si estamos en modo edición
  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!editId) return

      setLoadingEmployee(true)
      try {
        const response = await fetch(`/api/market/accounting/employees/${editId}`)
        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            const emp = result.data
            // Cargar datos en el formulario
            setFormData({
              email: emp.email || '',
              password: '', // No cargamos la contraseña por seguridad
              firstName: emp.firstName || '',
              lastName: emp.lastName || '',
              phone: emp.phone || '',
              role: emp.role || '',
              payType: emp.payType || '',
              payRate: emp.payRate?.toString() || '',
              currency: emp.currency || 'USD',
              hireDate: emp.hireDate ? new Date(emp.hireDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              commissionRate: emp.commissionRate?.toString() || '',
              warehouseId: emp.warehouseId?.toString() || '',
              posPin: '', // No cargamos el PIN por seguridad
              badgeCode: emp.badgeCode || ''
            })

            // Cargar permisos de terminales si existen
            if (emp.terminals && emp.terminals.length > 0) {
              setTerminalPermissions(emp.terminals.map((t: {
                terminalId: number
                terminalName: string
                canOpenSession: boolean
                canCloseSession: boolean
                canVoidOrders: boolean
                canGiveDiscount: boolean
                canRefund: boolean
                maxDiscountPercent: number
              }) => ({
                terminalId: t.terminalId,
                terminalName: t.terminalName,
                canOpenSession: t.canOpenSession,
                canCloseSession: t.canCloseSession,
                canVoidOrders: t.canVoidOrders,
                canGiveDiscount: t.canGiveDiscount,
                canRefund: t.canRefund,
                maxDiscountPercent: t.maxDiscountPercent || 0
              })))
            }
          }
        }
      } catch (error) {
        console.error('Error fetching employee:', error)
        setError('Error al cargar datos del empleado')
      } finally {
        setLoadingEmployee(false)
      }
    }

    fetchEmployeeData()
  }, [editId])

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

  const fetchWarehouses = async () => {
    try {
      const response = await fetch('/api/market/warehouses')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setWarehouses(result.data.warehouses || [])
        }
      }
    } catch (error) {
      console.error('Error fetching warehouses:', error)
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

  const validateStep = (step: string): boolean => {
    setError('')

    switch (step) {
      case 'personal':
        if (!formData.email) {
          setError('Email es requerido')
          return false
        }
        // En modo edición, la contraseña es opcional
        if (!isEditMode && !formData.password) {
          setError('Email y contraseña son requeridos')
          return false
        }
        if (!formData.email.includes('@')) {
          setError('Email inválido')
          return false
        }
        // Solo validar contraseña si se proporciona o si es modo creación
        if (formData.password && formData.password.length < 6) {
          setError('La contraseña debe tener al menos 6 caracteres')
          return false
        }
        return true

      case 'employment':
        if (!formData.role || !formData.payType || !formData.payRate || !formData.hireDate) {
          setError('Rol, tipo de pago, tarifa y fecha de ingreso son requeridos')
          return false
        }
        if (parseFloat(formData.payRate) <= 0) {
          setError('La tarifa debe ser mayor a 0')
          return false
        }
        if ((formData.role === 'MARKET_ALMACENERO' || formData.role === 'MARKET_MANAGER_TIENDA') && !formData.warehouseId) {
          setError('Debe seleccionar un almacén para este rol')
          return false
        }
        return true

      case 'pos':
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
      const nextIndex = currentStepIndex + 1
      if (nextIndex < STEPS.length) {
        setCurrentStep(STEPS[nextIndex].id)
      }
    }
  }

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
    setError('')
  }

  const saveEmployee = async () => {
    setSaving(true)
    setError('')

    try {
      // Preparar datos para enviar
      const employeeData: Record<string, unknown> = {
        email: formData.email,
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
        warehouseId: formData.warehouseId ? parseInt(formData.warehouseId) : null,
        terminals: terminalPermissions.map(p => ({
          terminalId: p.terminalId,
          canOpenSession: p.canOpenSession,
          canCloseSession: p.canCloseSession,
          canVoidOrders: p.canVoidOrders,
          canGiveDiscount: p.canGiveDiscount,
          canRefund: p.canRefund,
          maxDiscountPercent: p.maxDiscountPercent
        }))
      }

      // Solo incluir contraseña si se proporciona
      if (formData.password) {
        employeeData.password = formData.password
      }

      const url = isEditMode
        ? `/api/market/accounting/employees/${editId}`
        : '/api/market/accounting/employees'

      const response = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
      })

      const result = await response.json()

      if (result.success) {
        router.push('/dashboard/market/accounting/employees')
      } else {
        setError(result.error || (isEditMode ? 'Error al actualizar empleado' : 'Error al crear empleado'))
      }
    } catch (error) {
      console.error('Error saving employee:', error)
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

  const getWarehouseName = (warehouseId: string) => {
    return warehouses.find(w => w.id.toString() === warehouseId)?.name || 'No asignado'
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
          className={cn(
            "absolute -top-2 right-0 sm:right-0 p-2 rounded-full transition-colors z-10",
            theme === 'dark'
              ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              : 'bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-100 shadow-sm'
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <X className="w-5 h-5" />
        </motion.button>

        {/* Header */}
        <div className="text-center">
          <h1 className={cn(
            "text-2xl sm:text-3xl lg:text-4xl font-bold mb-2",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            {isEditMode ? 'Editar Empleado' : 'Nuevo Empleado'}
          </h1>
          <p className={cn(
            "text-sm sm:text-base",
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            {isEditMode ? 'Modifique los datos del empleado' : 'Complete los datos del nuevo empleado'}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isActive = currentStep === step.id
            const isCompleted = currentStepIndex > index

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className="relative w-14 h-14">
                    {/* Pulsing ring for active step */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-purple-500"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 0, 0.5]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}
                    <motion.div
                      className={cn(
                        "relative w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                            ? 'bg-purple-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-800 text-gray-500'
                              : 'bg-gray-200 text-gray-500'
                      )}
                      animate={{
                        scale: isActive ? 1 : 0.9,
                        backgroundColor: isCompleted
                          ? '#22c55e'
                          : isActive
                            ? '#9333ea'
                            : theme === 'dark'
                              ? '#1f2937'
                              : '#e5e7eb'
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-6 h-6" />
                      )}
                    </motion.div>
                  </div>
                  <span className={cn(
                    "text-xs mt-2 hidden sm:block text-center font-medium",
                    isActive
                      ? 'text-purple-600'
                      : isCompleted
                        ? 'text-green-600'
                        : theme === 'dark'
                          ? 'text-gray-500'
                          : 'text-gray-400'
                  )}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="relative w-8 sm:w-16 lg:w-24 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-green-500 rounded-full"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: currentStepIndex > index ? 1 : 0 }}
                      style={{ originX: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                )}
              </React.Fragment>
            )
          })}
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

          {/* Loading Employee Data */}
          {loadingEmployee && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-purple-600" />
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  Cargando datos del empleado...
                </p>
              </div>
            </div>
          )}

          {/* Step Content */}
          {!loadingEmployee && (
          <div className={cn(
            "rounded-2xl shadow-lg p-6",
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <AnimatePresence mode="wait">
              {/* Step 1: Personal Data */}
              {currentStep === 'personal' && (
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
                        Contraseña {isEditMode ? '(dejar vacío para mantener)' : '*'}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => updateFormData('password', e.target.value)}
                          placeholder={isEditMode ? 'Nueva contraseña (opcional)' : 'Mínimo 6 caracteres'}
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
              {currentStep === 'employment' && (
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

                  {/* Warehouse selector - for MARKET_ALMACENERO and MARKET_MANAGER_TIENDA */}
                  {(formData.role === 'MARKET_ALMACENERO' || formData.role === 'MARKET_MANAGER_TIENDA') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        <WarehouseIcon className="w-4 h-4 inline mr-2" />
                        Almacén Asignado *
                      </label>
                      {warehouses.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {warehouses.map(warehouse => (
                            <div
                              key={warehouse.id}
                              onClick={() => updateFormData('warehouseId', warehouse.id.toString())}
                              className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                                formData.warehouseId === warehouse.id.toString()
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <WarehouseIcon className={`w-5 h-5 ${
                                  formData.warehouseId === warehouse.id.toString()
                                    ? 'text-emerald-600'
                                    : 'text-gray-400'
                                }`} />
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-white">{warehouse.name}</h4>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{warehouse.code}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                          <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                            No hay almacenes configurados. Cree un almacén primero.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

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
                        Salario *
                      </label>
                      <input
                        type="number"
                        value={formData.payRate}
                        onChange={(e) => updateFormData('payRate', e.target.value)}
                        placeholder="0.00"
                        step="0.0001"
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
              {currentStep === 'pos' && (
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
              {currentStep === 'confirm' && (
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
                          <dt className="text-gray-500">Salario</dt>
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
                        {(formData.role === 'MARKET_ALMACENERO' || formData.role === 'MARKET_MANAGER_TIENDA') && formData.warehouseId && (
                          <div>
                            <dt className="text-gray-500">Almacén Asignado</dt>
                            <dd className="font-medium text-emerald-600 dark:text-emerald-400">
                              {getWarehouseName(formData.warehouseId)}
                            </dd>
                          </div>
                        )}
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
            <div className={cn(
              "flex items-center justify-between mt-8 pt-6 border-t",
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <motion.button
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors",
                  currentStepIndex === 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : theme === 'dark'
                      ? 'text-gray-300 hover:bg-gray-700'
                      : 'text-gray-600 hover:bg-gray-100'
                )}
                whileHover={currentStepIndex > 0 ? { scale: 1.02 } : {}}
                whileTap={currentStepIndex > 0 ? { scale: 0.98 } : {}}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </motion.button>

              {currentStepIndex < STEPS.length - 1 ? (
                <motion.button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              ) : (
                <motion.button
                  onClick={saveEmployee}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                  whileHover={!saving ? { scale: 1.02 } : {}}
                  whileTap={!saving ? { scale: 0.98 } : {}}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {isEditMode ? 'Guardando...' : 'Creando...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      {isEditMode ? 'Guardar Cambios' : 'Crear Empleado'}
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </div>
          )}
        </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCancelModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-2xl p-6 max-w-md w-full shadow-xl",
                theme === 'dark' ? 'bg-gray-800' : 'bg-white'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={cn(
                "text-lg font-bold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                {isEditMode ? '¿Cancelar edición?' : '¿Cancelar creación?'}
              </h3>
              <p className={cn(
                "mb-6",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {isEditMode ? 'Perderás los cambios realizados. ¿Estás seguro?' : 'Perderás todos los datos ingresados. ¿Estás seguro?'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-medium transition-colors",
                    theme === 'dark'
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Continuar editando
                </button>
                <button
                  onClick={() => router.push('/dashboard/market/accounting/employees')}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
                >
                  Sí, cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
