'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  User,
  CreditCard,
  Check,
  ArrowLeft,
  ArrowRight,
  Search,
  Loader2,
  X,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Wallet,
  FileText,
  Hash
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface Supplier {
  id: number
  code: string
  name: string
  email: string | null
  phone: string | null
  balanceAvailable: number
  balancePending: number
  totalEarned: number
  totalPaid: number
  pendingRequests: number
  pendingAmount: number
}

type Step = 'supplier' | 'amount' | 'payment' | 'confirm'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'supplier', title: 'Proveedor', description: 'Seleccionar', icon: Building2 },
  { id: 'amount', title: 'Monto', description: 'Definir', icon: DollarSign },
  { id: 'payment', title: 'Metodo', description: 'De pago', icon: CreditCard },
  { id: 'confirm', title: 'Confirmar', description: 'Emitir pago', icon: Check }
]

const PAYMENT_METHODS = [
  { value: 'transfer', label: 'Transferencia Bancaria', icon: Building2, description: 'Pago mediante transferencia bancaria' },
  { value: 'cash', label: 'Efectivo', icon: DollarSign, description: 'Pago en efectivo' },
  { value: 'check', label: 'Cheque', icon: FileText, description: 'Pago mediante cheque' },
  { value: 'zelle', label: 'Zelle', icon: CreditCard, description: 'Pago via Zelle' },
  { value: 'other', label: 'Otro', icon: Wallet, description: 'Otro metodo de pago' }
]

export default function DirectPaymentWizardPage() {
  const { theme } = useTheme()
  const router = useRouter()

  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>('supplier')
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Data state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  // Amount state
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState('')

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('transfer')
  const [paymentReference, setPaymentReference] = useState('')
  const [notes, setNotes] = useState('')

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [paymentResult, setPaymentResult] = useState<{ requestNumber: string; amount: number } | null>(null)

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Load suppliers on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      setLoadingSuppliers(true)
      try {
        const response = await fetch('/api/consignments/payments/suppliers')
        const data = await response.json()
        if (data.success) {
          // Filter only suppliers with balance > 0
          setSuppliers(data.data.suppliers.filter((s: Supplier) => s.balanceAvailable > 0))
        }
      } catch (error) {
        console.error('Error loading suppliers:', error)
      } finally {
        setLoadingSuppliers(false)
      }
    }
    fetchSuppliers()
  }, [])

  // Filter suppliers by search
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  // Navigation
  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 'supplier':
        return !!selectedSupplier
      case 'amount':
        const numAmount = parseFloat(amount)
        return !isNaN(numAmount) && numAmount > 0 && numAmount <= (selectedSupplier?.balanceAvailable || 0)
      case 'payment':
        return !!paymentMethod
      case 'confirm':
        return true
      default:
        return false
    }
  }

  const goNext = () => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep)
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].id)
    }
  }

  const goPrev = () => {
    const stepIndex = STEPS.findIndex(s => s.id === currentStep)
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id)
    }
  }

  // Amount helpers
  const setQuickAmount = (percentage: number) => {
    if (selectedSupplier) {
      const calc = (selectedSupplier.balanceAvailable * percentage) / 100
      setAmount(calc.toFixed(2))
      setAmountError('')
    }
  }

  const validateAmount = (value: string) => {
    const numAmount = parseFloat(value)
    if (isNaN(numAmount) || numAmount <= 0) {
      setAmountError('El monto debe ser mayor a cero')
      return false
    }
    if (numAmount > (selectedSupplier?.balanceAvailable || 0)) {
      setAmountError('El monto excede el saldo disponible')
      return false
    }
    setAmountError('')
    return true
  }

  // Submit payment
  const handleSubmit = async () => {
    if (!selectedSupplier || !amount) return

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const response = await fetch('/api/consignments/payments/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier.id,
          amount: parseFloat(amount),
          paymentMethod,
          paymentReference: paymentReference || undefined,
          notes: notes || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        setPaymentResult({
          requestNumber: data.data.requestNumber,
          amount: data.data.amount
        })
        setSubmitSuccess(true)
      } else {
        setSubmitError(data.error || 'Error al procesar el pago')
      }
    } catch {
      setSubmitError('Error de conexion')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(value)

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'supplier':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className={cn(
                "text-xl font-bold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Seleccionar Proveedor
              </h2>
              <p className="text-gray-500">
                Elige el proveedor al que deseas emitir el pago
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar proveedor..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className={cn(
                  "w-full pl-12 pr-4 py-4 rounded-2xl border-2 focus:outline-none focus:ring-0 transition-all text-lg",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500'
                )}
              />
            </div>

            {/* Suppliers List */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {loadingSuppliers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No hay proveedores con saldo disponible</p>
                </div>
              ) : (
                filteredSuppliers.map((supplier) => (
                  <motion.div
                    key={supplier.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedSupplier(supplier)}
                    className={cn(
                      "p-4 rounded-2xl border-2 cursor-pointer transition-all",
                      selectedSupplier?.id === supplier.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : theme === 'dark'
                          ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          selectedSupplier?.id === supplier.id
                            ? 'bg-emerald-500 text-white'
                            : theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
                        )}>
                          <User className="w-6 h-6" />
                        </div>
                        <div>
                          <p className={cn(
                            "font-semibold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {supplier.name}
                          </p>
                          <p className="text-sm text-gray-500 font-mono">{supplier.code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-emerald-600">
                          {formatCurrency(supplier.balanceAvailable)}
                        </p>
                        <p className="text-xs text-gray-500">Disponible</p>
                      </div>
                    </div>
                    {selectedSupplier?.id === supplier.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800"
                      >
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-gray-500">Total Ganado</p>
                            <p className="font-semibold text-gray-700 dark:text-gray-300">
                              {formatCurrency(supplier.totalEarned)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Total Pagado</p>
                            <p className="font-semibold text-gray-700 dark:text-gray-300">
                              {formatCurrency(supplier.totalPaid)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Pendiente</p>
                            <p className="font-semibold text-amber-600">
                              {formatCurrency(supplier.balancePending)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )

      case 'amount':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className={cn(
                "text-xl font-bold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Definir Monto a Pagar
              </h2>
              <p className="text-gray-500">
                Ingresa el monto que deseas pagar a {selectedSupplier?.name}
              </p>
            </div>

            {/* Supplier Summary */}
            <div className={cn(
              "p-6 rounded-2xl border-2",
              theme === 'dark'
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-gray-50 border-gray-200'
            )}>
              <div className="flex items-center gap-4 mb-4">
                <div className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center bg-emerald-500 text-white"
                )}>
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <p className={cn(
                    "font-semibold text-lg",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {selectedSupplier?.name}
                  </p>
                  <p className="text-sm text-gray-500 font-mono">{selectedSupplier?.code}</p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-500">Saldo disponible</span>
                <span className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(selectedSupplier?.balanceAvailable || 0)}
                </span>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-4">
              <label className={cn(
                "block text-sm font-medium",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Monto a pagar
              </label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={selectedSupplier?.balanceAvailable}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    validateAmount(e.target.value)
                  }}
                  placeholder="0.00"
                  className={cn(
                    "w-full pl-14 pr-4 py-5 rounded-2xl border-2 focus:outline-none focus:ring-0 transition-all text-3xl font-bold text-center",
                    amountError
                      ? 'border-red-500 focus:border-red-500'
                      : theme === 'dark'
                        ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500'
                        : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500'
                  )}
                />
              </div>
              {amountError && (
                <p className="text-red-500 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {amountError}
                </p>
              )}

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-3">
                {[25, 50, 75, 100].map(pct => (
                  <motion.button
                    key={pct}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setQuickAmount(pct)}
                    className={cn(
                      "py-4 text-lg font-semibold rounded-xl transition-all",
                      amount === ((selectedSupplier?.balanceAvailable || 0) * pct / 100).toFixed(2)
                        ? 'bg-emerald-500 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    {pct}%
                  </motion.button>
                ))}
              </div>

              {/* Amount Preview */}
              {amount && parseFloat(amount) > 0 && !amountError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-xl text-center",
                    theme === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50'
                  )}
                >
                  <p className="text-sm text-emerald-600 mb-1">Nuevo saldo despues del pago</p>
                  <p className="text-xl font-bold text-emerald-700">
                    {formatCurrency((selectedSupplier?.balanceAvailable || 0) - parseFloat(amount))}
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        )

      case 'payment':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className={cn(
                "text-xl font-bold mb-2",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Metodo de Pago
              </h2>
              <p className="text-gray-500">
                Selecciona como realizaras el pago
              </p>
            </div>

            {/* Payment Methods */}
            <div className="space-y-3">
              {PAYMENT_METHODS.map((method) => {
                const MethodIcon = method.icon
                return (
                  <motion.div
                    key={method.value}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setPaymentMethod(method.value)}
                    className={cn(
                      "p-4 rounded-2xl border-2 cursor-pointer transition-all",
                      paymentMethod === method.value
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : theme === 'dark'
                          ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        paymentMethod === method.value
                          ? 'bg-emerald-500 text-white'
                          : theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                      )}>
                        <MethodIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className={cn(
                          "font-semibold",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {method.label}
                        </p>
                        <p className="text-sm text-gray-500">{method.description}</p>
                      </div>
                      {paymentMethod === method.value && (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Reference */}
            <div className="space-y-3 pt-4">
              <label className={cn(
                "block text-sm font-medium",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Referencia de pago (opcional)
              </label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Numero de transaccion, cheque, etc."
                  className={cn(
                    "w-full pl-12 pr-4 py-4 rounded-2xl border-2 focus:outline-none focus:ring-0 transition-all",
                    theme === 'dark'
                      ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500'
                      : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500'
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <label className={cn(
                "block text-sm font-medium",
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                Notas adicionales (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales sobre el pago..."
                rows={3}
                className={cn(
                  "w-full px-4 py-4 rounded-2xl border-2 focus:outline-none focus:ring-0 transition-all resize-none",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700 text-white focus:border-emerald-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-emerald-500'
                )}
              />
            </div>
          </motion.div>
        )

      case 'confirm':
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {submitSuccess && paymentResult ? (
              // Success State
              <div className="text-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-24 h-24 mx-auto mb-6 rounded-full bg-emerald-500 flex items-center justify-center"
                >
                  <Check className="w-12 h-12 text-white" />
                </motion.div>
                <h2 className={cn(
                  "text-2xl font-bold mb-2",
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  Pago Emitido Exitosamente
                </h2>
                <p className="text-gray-500 mb-6">
                  El pago ha sido registrado correctamente
                </p>

                <div className={cn(
                  "p-6 rounded-2xl border-2 mb-6",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-gray-50 border-gray-200'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Numero de pago</p>
                  <p className={cn(
                    "text-xl font-mono font-bold mb-4",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    {paymentResult.requestNumber}
                  </p>
                  <p className="text-sm text-gray-500 mb-1">Monto pagado</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {formatCurrency(paymentResult.amount)}
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push('/dashboard/market/consignments/payments')}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-semibold transition-all"
                >
                  Volver a Pagos
                </motion.button>
              </div>
            ) : (
              // Confirmation State
              <>
                <div className="text-center mb-8">
                  <h2 className={cn(
                    "text-xl font-bold mb-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Confirmar Pago
                  </h2>
                  <p className="text-gray-500">
                    Revisa los detalles antes de emitir el pago
                  </p>
                </div>

                {submitError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center gap-3"
                  >
                    <AlertTriangle className="w-5 h-5" />
                    {submitError}
                  </motion.div>
                )}

                {/* Summary Card */}
                <div className={cn(
                  "p-6 rounded-2xl border-2",
                  theme === 'dark'
                    ? 'bg-gray-800/50 border-gray-700'
                    : 'bg-white border-gray-200'
                )}>
                  {/* Supplier */}
                  <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                      <User className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Proveedor</p>
                      <p className={cn(
                        "font-semibold text-lg",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {selectedSupplier?.name}
                      </p>
                      <p className="text-sm text-gray-500 font-mono">{selectedSupplier?.code}</p>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Monto a pagar</span>
                      <span className="text-2xl font-bold text-emerald-600">
                        {formatCurrency(parseFloat(amount) || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Metodo de pago</span>
                      <span className={cn(
                        "font-medium",
                        theme === 'dark' ? 'text-white' : 'text-gray-900'
                      )}>
                        {PAYMENT_METHODS.find(m => m.value === paymentMethod)?.label}
                      </span>
                    </div>
                  </div>

                  {/* Reference */}
                  {paymentReference && (
                    <div className="py-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Referencia</span>
                        <span className={cn(
                          "font-mono",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {paymentReference}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {notes && (
                    <div className="pt-4">
                      <p className="text-sm text-gray-500 mb-1">Notas</p>
                      <p className={cn(
                        "text-sm",
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                      )}>
                        {notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Balance After */}
                <div className={cn(
                  "p-4 rounded-xl text-center",
                  theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
                )}>
                  <p className="text-sm text-gray-500 mb-1">Saldo del proveedor despues del pago</p>
                  <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
                    {formatCurrency((selectedSupplier?.balanceAvailable || 0) - (parseFloat(amount) || 0))}
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )
    }
  }

  return (
    <div className={cn(
      "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
      theme === 'dark' ? 'bg-[#1a2332]' : 'bg-gray-50'
    )}>
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 relative">

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

        {/* Header */}
        <div className="text-center mb-4">
          <Link
            href="/dashboard/market/consignments/payments"
            className={cn(
              "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
              theme === 'dark'
                ? 'text-gray-400 hover:text-gray-200'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a pagos
          </Link>
          <h1 className={cn(
            "text-2xl sm:text-3xl font-bold",
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          )}>
            Nuevo Pago a Proveedor
          </h1>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8 sm:mb-12">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className="relative w-14 h-14">
                    {/* Pulsing ring for active step */}
                    {currentStep === step.id && !submitSuccess && (
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
                          background: 'rgba(16, 185, 129, 0.5)'
                        }}
                      />
                    )}

                    <motion.div
                      initial={false}
                      animate={{
                        scale: currentStep === step.id ? 1.1 : 1,
                        backgroundColor: submitSuccess && step.id === 'confirm'
                          ? '#10B981'
                          : currentStep === step.id
                            ? '#10B981'
                            : currentStepIndex > index
                              ? '#10B981'
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
                        (currentStep === step.id || (submitSuccess && step.id === 'confirm')) && 'shadow-lg shadow-emerald-500/50'
                      )}
                    >
                      {currentStepIndex > index || submitSuccess ? (
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
                        ? 'text-emerald-500'
                        : currentStepIndex > index || submitSuccess
                          ? 'text-emerald-500'
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
                      initial={{ width: '0%' }}
                      animate={{
                        width: currentStepIndex > index || submitSuccess ? '100%' : '0%'
                      }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full bg-emerald-500"
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
            "rounded-2xl p-6 sm:p-8",
            theme === 'dark'
              ? 'bg-gray-800/50 border border-gray-700'
              : 'bg-white border border-gray-200 shadow-sm'
          )}
        >
          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>
        </motion.div>

        {/* Navigation Buttons */}
        {!submitSuccess && (
          <div className="flex gap-4">
            {currentStepIndex > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goPrev}
                disabled={isSubmitting}
                className={cn(
                  "flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2",
                  theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Atras
              </motion.button>
            )}

            {currentStep === 'confirm' ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={isSubmitting || !canGoNext()}
                className={cn(
                  "flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2",
                  "bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-5 h-5" />
                    Emitir Pago
                  </>
                )}
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goNext}
                disabled={!canGoNext()}
                className={cn(
                  "flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2",
                  "bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                )}
              >
                Continuar
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
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className={cn(
                "w-full max-w-sm rounded-2xl p-6",
                theme === 'dark'
                  ? 'bg-gray-800 border border-gray-700'
                  : 'bg-white border border-gray-200'
              )}>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className={cn(
                    "text-lg font-bold mb-2",
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Cancelar pago?
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Los datos ingresados se perderan
                  </p>
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCancelModal(false)}
                      className={cn(
                        "flex-1 py-3 rounded-xl font-medium transition-all",
                        theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      )}
                    >
                      Continuar
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => router.push('/dashboard/market/consignments/payments')}
                      className="flex-1 py-3 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-all"
                    >
                      Cancelar
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
