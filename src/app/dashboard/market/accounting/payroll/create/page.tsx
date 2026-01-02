'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  User,
  Calendar,
  Calculator,
  Check,
  ArrowLeft,
  ArrowRight,
  DollarSign,
  Clock,
  Loader2,
  AlertCircle,
  TrendingUp,
  Minus,
  Plus as PlusIcon,
  Gift,
  X
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

type Step = 'employee' | 'period' | 'adjustments' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: any
}

const STEPS: WizardStep[] = [
  { id: 'employee', title: 'Empleado', description: 'Selecciona empleado', icon: User },
  { id: 'period', title: 'Periodo', description: 'Define el periodo', icon: Calendar },
  { id: 'adjustments', title: 'Ajustes', description: 'Bonos y deducciones', icon: Calculator },
  { id: 'review', title: 'Confirmar', description: 'Revisa y guarda', icon: Check }
]

interface Employee {
  id: number
  employeeCode: string
  fullName: string
  email: string
  payType: string
  payRate: number
  commissionRate: number
  currency: string
}

interface Calculation {
  basePay: number
  salesTotal: number
  commissionAmount: number
  grossPay: number
  netPay: number
}

export default function CreatePayrollPage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('employee')
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Form data
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState({
    periodStart: '',
    periodEnd: '',
    hoursWorked: '',
    daysWorked: '',
    bonusAmount: '',
    bonusDescription: '',
    deductions: '',
    deductionNotes: ''
  })

  // Calculation state
  const [calculating, setCalculating] = useState(false)
  const [calculation, setCalculation] = useState<Calculation | null>(null)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/market/accounting/employees?status=active')
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setEmployees(result.data.employees)
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
    setLoadingEmployees(false)
  }

  const calculatePayroll = async () => {
    if (!selectedEmployee || !formData.periodStart || !formData.periodEnd) return

    setCalculating(true)
    try {
      const response = await fetch('/api/market/accounting/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          hoursWorked: formData.hoursWorked ? parseFloat(formData.hoursWorked) : undefined,
          daysWorked: formData.daysWorked ? parseInt(formData.daysWorked) : undefined
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const calc = result.data.calculation
          const bonus = parseFloat(formData.bonusAmount) || 0
          const deductions = parseFloat(formData.deductions) || 0
          setCalculation({
            basePay: calc.basePay,
            salesTotal: calc.salesTotal,
            commissionAmount: calc.commissionAmount,
            grossPay: calc.basePay + calc.commissionAmount + bonus,
            netPay: calc.basePay + calc.commissionAmount + bonus - deductions
          })
        }
      }
    } catch (error) {
      console.error('Error calculating:', error)
    }
    setCalculating(false)
  }

  // Recalculate when adjustments change
  useEffect(() => {
    if (calculation) {
      const bonus = parseFloat(formData.bonusAmount) || 0
      const deductions = parseFloat(formData.deductions) || 0
      setCalculation(prev => prev ? {
        ...prev,
        grossPay: prev.basePay + prev.commissionAmount + bonus,
        netPay: prev.basePay + prev.commissionAmount + bonus - deductions
      } : null)
    }
  }, [formData.bonusAmount, formData.deductions])

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'employee') {
      if (!selectedEmployee) {
        newErrors.employee = 'Selecciona un empleado'
      }
    }

    if (step === 'period') {
      if (!formData.periodStart) {
        newErrors.periodStart = 'Fecha de inicio requerida'
      }
      if (!formData.periodEnd) {
        newErrors.periodEnd = 'Fecha de fin requerida'
      }
      if (formData.periodStart && formData.periodEnd && formData.periodStart > formData.periodEnd) {
        newErrors.periodEnd = 'La fecha de fin debe ser posterior al inicio'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const goToNextStep = async () => {
    if (!validateStep(currentStep)) return

    // Calculate when moving from period to adjustments
    if (currentStep === 'period') {
      await calculatePayroll()
    }

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
    if (!selectedEmployee || !calculation) return

    setLoading(true)
    try {
      const response = await fetch('/api/market/accounting/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          basePay: calculation.basePay,
          hoursWorked: formData.hoursWorked ? parseFloat(formData.hoursWorked) : null,
          daysWorked: formData.daysWorked ? parseInt(formData.daysWorked) : null,
          salesTotal: calculation.salesTotal,
          commissionAmount: calculation.commissionAmount,
          bonusAmount: parseFloat(formData.bonusAmount) || 0,
          bonusDescription: formData.bonusDescription || null,
          deductions: parseFloat(formData.deductions) || 0,
          deductionNotes: formData.deductionNotes || null
        })
      })

      if (response.ok) {
        router.push('/dashboard/market/accounting/payroll')
      } else {
        const data = await response.json()
        setErrors({ submit: data.error || 'Error al crear nomina' })
      }
    } catch (error) {
      console.error('Error saving payroll:', error)
      setErrors({ submit: 'Error al crear nomina' })
    }
    setLoading(false)
  }

  const getPayTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      hourly: 'Por hora',
      daily: 'Por dia',
      weekly: 'Semanal',
      biweekly: 'Quincenal',
      monthly: 'Mensual'
    }
    return labels[type] || type
  }

  return (
    <ProtectedRoute>
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
                "absolute -top-8 right-0 z-10 w-8 h-8 rounded-full flex items-center justify-center",
                "transition-colors duration-200",
                theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              )}
            >
              <X className="w-5 h-5" />
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
                                ? 'rgba(147, 51, 234, 0.5)'
                                : 'rgba(126, 34, 206, 0.5)'
                            }}
                          />
                        )}

                        <motion.div
                          initial={false}
                          animate={{
                            scale: currentStep === step.id ? 1.1 : 1,
                            backgroundColor: currentStep === step.id
                              ? theme === 'dark' ? '#9333EA' : '#7E22CE'
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
                                ? 'shadow-lg shadow-purple-500/50'
                                : 'shadow-lg shadow-purple-400/50'
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
                            ? theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
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
            <AnimatePresence mode="wait">
            {/* Step 1: Employee Selection */}
            {currentStep === 'employee' && (
              <motion.div
                key="employee"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Selecciona un empleado
                  </h2>
                  <p className="text-gray-500">
                    Elige el empleado para calcular su nomina
                  </p>
                </div>

                {loadingEmployees ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  </div>
                ) : employees.length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl">
                    <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No hay empleados activos</p>
                    <button
                      onClick={() => router.push('/dashboard/market/accounting/employees/create')}
                      className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-xl"
                    >
                      Crear Empleado
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {employees.map((employee) => (
                      <motion.button
                        key={employee.id}
                        onClick={() => setSelectedEmployee(employee)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={cn(
                          "w-full p-4 rounded-2xl border-2 transition-all text-left flex items-center gap-4",
                          selectedEmployee?.id === employee.id
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center",
                          selectedEmployee?.id === employee.id
                            ? "bg-purple-500 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                        )}>
                          <User className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            {employee.fullName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {employee.employeeCode} • {getPayTypeLabel(employee.payType)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-purple-600">
                            ${employee.payRate.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {employee.commissionRate > 0 && `${employee.commissionRate}% comision`}
                          </p>
                        </div>
                        <div className={cn(
                          "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                          selectedEmployee?.id === employee.id
                            ? "border-purple-500 bg-purple-500"
                            : "border-gray-300 dark:border-gray-600"
                        )}>
                          {selectedEmployee?.id === employee.id && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}

                {errors.employee && (
                  <p className="text-center text-red-500 text-sm">{errors.employee}</p>
                )}
              </motion.div>
            )}

            {/* Step 2: Period Selection */}
            {currentStep === 'period' && (
              <motion.div
                key="period"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                  {/* Selected Employee Summary */}
                  {selectedEmployee && (
                    <div className="flex items-center gap-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl mb-6">
                      <div className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                          {selectedEmployee.fullName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {getPayTypeLabel(selectedEmployee.payType)} • ${selectedEmployee.payRate}/
                          {selectedEmployee.payType === 'hourly' ? 'hora' :
                           selectedEmployee.payType === 'daily' ? 'dia' : 'periodo'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900 dark:text-white">Periodo de Pago</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Fecha de Inicio *
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="date"
                            value={formData.periodStart}
                            onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 border rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500",
                              errors.periodStart ? "border-red-500" : "border-gray-200 dark:border-gray-700"
                            )}
                          />
                        </div>
                        {errors.periodStart && (
                          <p className="mt-1 text-sm text-red-500">{errors.periodStart}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Fecha de Fin *
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="date"
                            value={formData.periodEnd}
                            onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
                            className={cn(
                              "w-full pl-10 pr-4 py-3 border rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500",
                              errors.periodEnd ? "border-red-500" : "border-gray-200 dark:border-gray-700"
                            )}
                          />
                        </div>
                        {errors.periodEnd && (
                          <p className="mt-1 text-sm text-red-500">{errors.periodEnd}</p>
                        )}
                      </div>
                    </div>

                    {/* Optional: Hours/Days worked */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-500 mb-4">
                        Opcional: especifica las horas o dias trabajados (si no se especifica, se calculara automaticamente)
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Horas Trabajadas
                          </label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={formData.hoursWorked}
                              onChange={(e) => setFormData(prev => ({ ...prev, hoursWorked: e.target.value }))}
                              placeholder="Auto"
                              className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Dias Trabajados
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="number"
                              min="0"
                              value={formData.daysWorked}
                              onChange={(e) => setFormData(prev => ({ ...prev, daysWorked: e.target.value }))}
                              placeholder="Auto"
                              className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Adjustments */}
            {currentStep === 'adjustments' && (
              <motion.div
                key="adjustments"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Calculation Preview */}
                {calculation && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4">Calculo Base</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-gray-500">Pago Base</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          ${calculation.basePay.toLocaleString()}
                        </span>
                      </div>
                      {calculation.commissionAmount > 0 && (
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-gray-500 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Comision (ventas: ${calculation.salesTotal.toLocaleString()})
                          </span>
                          <span className="font-medium text-green-600">
                            +${calculation.commissionAmount.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Adjustments Form */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
                  <h3 className="font-bold text-gray-900 dark:text-white">Ajustes</h3>

                  {/* Bonus */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Gift className="w-4 h-4 text-blue-500" />
                      Bono / Incentivo
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.bonusAmount}
                          onChange={(e) => setFormData(prev => ({ ...prev, bonusAmount: e.target.value }))}
                          placeholder="0.00"
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <input
                        type="text"
                        value={formData.bonusDescription}
                        onChange={(e) => setFormData(prev => ({ ...prev, bonusDescription: e.target.value }))}
                        placeholder="Descripcion del bono"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Minus className="w-4 h-4 text-red-500" />
                      Deducciones
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.deductions}
                          onChange={(e) => setFormData(prev => ({ ...prev, deductions: e.target.value }))}
                          placeholder="0.00"
                          className="w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <input
                        type="text"
                        value={formData.deductionNotes}
                        onChange={(e) => setFormData(prev => ({ ...prev, deductionNotes: e.target.value }))}
                        placeholder="Nota de deduccion"
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Updated Totals */}
                {calculation && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-500">Total Bruto</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">
                          ${calculation.grossPay.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Neto a Pagar</p>
                        <p className="text-3xl font-bold text-purple-600">
                          ${calculation.netPay.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 4: Review */}
            {currentStep === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      Confirmar Nomina
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      Revisa los datos antes de guardar
                    </p>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Employee */}
                    {selectedEmployee && (
                      <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                        <div className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center">
                          <User className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">
                            {selectedEmployee.fullName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {selectedEmployee.employeeCode}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Period */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
                      <p className="text-sm text-gray-500 mb-2">Periodo</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {new Date(formData.periodStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {' - '}
                        {new Date(formData.periodEnd).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Breakdown */}
                    {calculation && (
                      <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                          <span className="text-gray-500">Pago Base</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ${calculation.basePay.toLocaleString()}
                          </span>
                        </div>
                        {calculation.commissionAmount > 0 && (
                          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-500">Comision</span>
                            <span className="font-medium text-green-600">
                              +${calculation.commissionAmount.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {parseFloat(formData.bonusAmount) > 0 && (
                          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-500">
                              Bono {formData.bonusDescription && `(${formData.bonusDescription})`}
                            </span>
                            <span className="font-medium text-blue-600">
                              +${parseFloat(formData.bonusAmount).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {parseFloat(formData.deductions) > 0 && (
                          <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                            <span className="text-gray-500">
                              Deducciones {formData.deductionNotes && `(${formData.deductionNotes})`}
                            </span>
                            <span className="font-medium text-red-600">
                              -${parseFloat(formData.deductions).toLocaleString()}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between py-3 border-t-2 border-gray-200 dark:border-gray-600">
                          <span className="font-bold text-gray-900 dark:text-white">Neto a Pagar</span>
                          <span className="text-2xl font-bold text-purple-600">
                            ${calculation.netPay.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}

                    {errors.submit && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        <span>{errors.submit}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

            {/* Navigation Buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between mt-8"
            >
              <button
                onClick={currentStep === 'employee' ? () => setShowCancelModal(true) : goToPrevStep}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl transition-colors",
                  theme === 'dark'
                    ? 'text-gray-400 hover:bg-gray-800'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                {currentStep === 'employee' ? 'Cancelar' : 'Atras'}
              </button>

              <button
                onClick={currentStep === 'review' ? handleSubmit : goToNextStep}
                disabled={loading || calculating}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : calculating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Calculando...
                  </>
                ) : currentStep === 'review' ? (
                  <>
                    <Check className="w-5 h-5" />
                    Crear Nomina
                  </>
                ) : (
                  <>
                    Siguiente
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </motion.div>

          </div>
        </div>

        {/* Cancel Modal */}
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
                onClick={e => e.stopPropagation()}
                className={cn(
                  "w-full max-w-md rounded-2xl p-6",
                  theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                )}
              >
                <h3 className={cn(
                  "text-lg font-bold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Cancelar registro?
                </h3>
                <p className={cn(
                  "mb-6",
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  Los datos ingresados se perderan. Estas seguro?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors",
                      theme === 'dark'
                        ? 'bg-gray-700 text-white hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    Continuar editando
                  </button>
                  <button
                    onClick={() => router.push('/dashboard/market/accounting/payroll')}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                  >
                    Si, cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
