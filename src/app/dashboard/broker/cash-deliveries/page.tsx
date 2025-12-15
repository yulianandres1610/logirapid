'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DollarSign,
  Clock,
  CheckCircle,
  Truck,
  AlertCircle,
  Loader2,
  RefreshCw,
  User,
  Calendar,
  Banknote,
  X,
  Phone,
  Shield,
  ArrowRight,
  MessageCircle,
  Hash
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'

interface CashDelivery {
  id: number
  order_number: string
  delivery_user_name: string
  delivery_user_phone: string
  currency: string
  total_amount: string | number
  total_bills: number
  bill_denominations?: { [key: string]: number }
  deadline_date: string
  status: string
  created_at: string
}

interface SelectedDelivery extends CashDelivery {
  billDenominations?: { [key: string]: number }
}

const STATUS_CONFIG: { [key: string]: { label: string; color: string; bgColor: string; icon: any } } = {
  pending: { label: 'Pendiente', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', icon: Clock },
  in_transit: { label: 'En Tránsito', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', icon: Truck },
  pending_reception: { label: 'Recibiendo', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30', icon: DollarSign },
  validating: { label: 'Validando OTP', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30', icon: Shield },
  completed: { label: 'Completado', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle },
  blocked: { label: 'Bloqueado', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: AlertCircle }
}

// Bill denominations by currency
const BILL_DENOMINATIONS: { [key: string]: string[] } = {
  USD: ['1', '5', '10', '20', '50', '100'],
  EUR: ['5', '10', '20', '50', '100', '200', '500'],
  CUP: ['1', '5', '10', '20', '50', '100', '200', '500', '1000'],
  MLC: ['1', '5', '10', '20', '50', '100']
}

export default function BrokerCashDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<CashDelivery[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [selectedDelivery, setSelectedDelivery] = useState<SelectedDelivery | null>(null)
  const [modalStep, setModalStep] = useState<'bills' | 'otp' | 'success'>('bills')
  const [isProcessing, setIsProcessing] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  // Bill counting state
  const [billCounts, setBillCounts] = useState<{ [key: string]: number }>({})
  const [receivedTotal, setReceivedTotal] = useState(0)

  // OTP state
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [otpChannel, setOtpChannel] = useState<'sms' | 'whatsapp'>('sms')
  const [otpSentTo, setOtpSentTo] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Success data
  const [successData, setSuccessData] = useState<any>(null)

  useEffect(() => {
    loadDeliveries()
  }, [])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  // Calculate received total when bill counts change
  useEffect(() => {
    let total = 0
    for (const [denom, count] of Object.entries(billCounts)) {
      total += parseInt(denom) * (count || 0)
    }
    setReceivedTotal(total)
  }, [billCounts])

  const loadDeliveries = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/broker/cash-deliveries')
      const data = await res.json()

      if (data.success) {
        setDeliveries(data.data?.deliveries || data.data || [])
      } else {
        setError(data.error || 'Error al cargar las entregas')
      }
    } catch (err) {
      console.error('Error loading deliveries:', err)
      setError('Error al cargar las entregas')
    } finally {
      setIsLoading(false)
    }
  }

  // Start reception - opens the modal
  const handleStartReception = async (delivery: CashDelivery) => {
    setSelectedDelivery(delivery)
    setModalStep('bills')
    setModalError(null)
    setBillCounts({})
    setOtpCode(['', '', '', '', '', ''])
    setSuccessData(null)

    // If already in pending_reception or validating, go to appropriate step
    if (delivery.status === 'validating') {
      setModalStep('otp')
      return
    }

    // If pending or in_transit, start reception process
    if (['pending', 'in_transit'].includes(delivery.status)) {
      setIsProcessing(true)
      try {
        const res = await fetch(`/api/broker/cash-deliveries/${delivery.id}/start-reception`, {
          method: 'POST'
        })
        const data = await res.json()

        if (data.success) {
          // Update local delivery with new data
          setSelectedDelivery(prev => prev ? {
            ...prev,
            status: 'pending_reception',
            billDenominations: data.data.billDenominations
          } : null)

          // Pre-fill expected bills if provided
          if (data.data.billDenominations) {
            const expectedBills: { [key: string]: number } = {}
            for (const [denom, count] of Object.entries(data.data.billDenominations)) {
              expectedBills[denom] = 0 // Start at 0, user needs to count
            }
            setBillCounts(expectedBills)
          }

          // Refresh list
          loadDeliveries()
        } else {
          setModalError(data.error || 'Error al iniciar recepción')
        }
      } catch (err) {
        console.error('Error starting reception:', err)
        setModalError('Error al iniciar recepción')
      } finally {
        setIsProcessing(false)
      }
    }
  }

  // Validate bills and send OTP
  const handleValidateBills = async () => {
    if (!selectedDelivery) return

    setIsProcessing(true)
    setModalError(null)

    try {
      const res = await fetch(`/api/broker/cash-deliveries/${selectedDelivery.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedBillDenominations: billCounts,
          channel: otpChannel
        })
      })
      const data = await res.json()

      if (data.success) {
        setOtpSentTo(data.data.otpSentTo || '')
        setModalStep('otp')
        setResendCooldown(60)
        loadDeliveries()
      } else {
        // Check if amounts mismatch
        if (data.data?.expectedTotal !== undefined) {
          setModalError(`Los montos no coinciden. Esperado: $${data.data.expectedTotal}, Recibido: $${data.data.receivedTotal}`)
        } else {
          setModalError(data.error || 'Error al validar')
        }
      }
    } catch (err) {
      console.error('Error validating:', err)
      setModalError('Error al validar los montos')
    } finally {
      setIsProcessing(false)
    }
  }

  // Confirm with OTP
  const handleConfirmOTP = async () => {
    if (!selectedDelivery) return

    const code = otpCode.join('')
    if (code.length !== 6) {
      setModalError('Ingresa el código completo de 6 dígitos')
      return
    }

    setIsProcessing(true)
    setModalError(null)

    try {
      const res = await fetch(`/api/broker/cash-deliveries/${selectedDelivery.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode: code })
      })
      const data = await res.json()

      if (data.success) {
        setSuccessData(data.data)
        setModalStep('success')
        loadDeliveries()
      } else {
        setModalError(data.error || 'Código incorrecto')
        // Clear OTP on error
        setOtpCode(['', '', '', '', '', ''])
        otpInputRefs.current[0]?.focus()
      }
    } catch (err) {
      console.error('Error confirming:', err)
      setModalError('Error al confirmar')
    } finally {
      setIsProcessing(false)
    }
  }

  // Resend OTP
  const handleResendOTP = async () => {
    if (!selectedDelivery || resendCooldown > 0) return

    setIsProcessing(true)
    setModalError(null)

    try {
      const res = await fetch(`/api/broker/cash-deliveries/${selectedDelivery.id}/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: otpChannel })
      })
      const data = await res.json()

      if (data.success) {
        setResendCooldown(60)
        setOtpSentTo(data.data.otpSentTo || otpSentTo)
      } else {
        setModalError(data.error || 'Error al reenviar código')
      }
    } catch (err) {
      setModalError('Error al reenviar código')
    } finally {
      setIsProcessing(false)
    }
  }

  // OTP input handlers
  const handleOTPChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newOtp = [...otpCode]
    newOtp[index] = value.slice(-1)
    setOtpCode(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Enter' && otpCode.join('').length === 6) {
      handleConfirmOTP()
    }
  }

  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newOtp = [...otpCode]
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i]
    }
    setOtpCode(newOtp)
    if (pasted.length === 6) {
      otpInputRefs.current[5]?.focus()
    }
  }

  const closeModal = () => {
    setSelectedDelivery(null)
    setModalStep('bills')
    setModalError(null)
    setBillCounts({})
    setOtpCode(['', '', '', '', '', ''])
    setSuccessData(null)
  }

  // Filter deliveries by status
  const pendingDeliveries = deliveries.filter(d => ['pending', 'in_transit'].includes(d.status))
  const inProgressDeliveries = deliveries.filter(d => ['pending_reception', 'validating'].includes(d.status))
  const completedDeliveries = deliveries.filter(d => d.status === 'completed')

  const expectedTotal = selectedDelivery ? parseFloat(String(selectedDelivery.total_amount)) : 0
  const amountsMatch = receivedTotal === expectedTotal

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Entregas de Efectivo
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Recibe efectivo de los repartidores
              </p>
            </div>

            <button
              onClick={loadDeliveries}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingDeliveries.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{inProgressDeliveries.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">En Proceso</p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#cc0a46] dark:bg-[#2a5caa]">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedDeliveries.length}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Completadas</p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Deliveries List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center">
              <Banknote className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                No hay entregas pendientes
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Las entregas de efectivo aparecerán aquí cuando sean asignadas
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pending/In Progress Section */}
              {[...inProgressDeliveries, ...pendingDeliveries].length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#cc0a46] dark:bg-[#2a5caa] animate-pulse"></span>
                    Pendientes de Recibir
                  </h2>
                  <div className="space-y-3">
                    <AnimatePresence>
                      {[...inProgressDeliveries, ...pendingDeliveries].map((delivery, index) => {
                        const statusConfig = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending
                        const StatusIcon = statusConfig.icon
                        const isValidating = delivery.status === 'validating'
                        const isReceiving = delivery.status === 'pending_reception'

                        return (
                          <motion.div
                            key={delivery.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="font-bold text-gray-900 dark:text-white">
                                    {delivery.order_number}
                                  </span>
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {statusConfig.label}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-600 dark:text-gray-300">{delivery.delivery_user_name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-600 dark:text-gray-300">{delivery.delivery_user_phone}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-gray-400" />
                                    <span className="font-bold text-gray-900 dark:text-white">
                                      {delivery.currency} ${parseFloat(String(delivery.total_amount)).toLocaleString()}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    <span className="text-gray-500 dark:text-gray-400">
                                      {new Date(delivery.deadline_date).toLocaleDateString('es-ES')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleStartReception(delivery)}
                                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
                                  isValidating
                                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                    : isReceiving
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-[#cc0a46] hover:bg-[#a50837] dark:bg-[#2a5caa] dark:hover:bg-[#1e4387] text-white'
                                }`}
                              >
                                {isValidating ? (
                                  <>
                                    <Shield className="w-4 h-4" />
                                    Ingresar OTP
                                  </>
                                ) : isReceiving ? (
                                  <>
                                    <Hash className="w-4 h-4" />
                                    Contar Billetes
                                  </>
                                ) : (
                                  <>
                                    <Banknote className="w-4 h-4" />
                                    Recibir
                                  </>
                                )}
                              </button>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Completed Section */}
              {completedDeliveries.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                    Completadas Recientemente
                  </h2>
                  <div className="space-y-3">
                    {completedDeliveries.slice(0, 5).map((delivery) => {
                      const statusConfig = STATUS_CONFIG[delivery.status]
                      const StatusIcon = statusConfig.icon

                      return (
                        <div
                          key={delivery.id}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 opacity-70"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {delivery.order_number}
                                </span>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {statusConfig.label}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {delivery.currency} ${parseFloat(String(delivery.total_amount)).toLocaleString()} • {delivery.delivery_user_name}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal */}
        <AnimatePresence>
          {selectedDelivery && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={(e) => e.target === e.currentTarget && !isProcessing && closeModal()}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {modalStep === 'bills' && 'Contar Billetes'}
                      {modalStep === 'otp' && 'Verificar Código OTP'}
                      {modalStep === 'success' && 'Recepción Completada'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedDelivery.order_number}
                    </p>
                  </div>
                  {modalStep !== 'success' && !isProcessing && (
                    <button
                      onClick={closeModal}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  )}
                </div>

                {/* Modal Content */}
                <div className="p-5">
                  {/* Error Message */}
                  {modalError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                      {modalError}
                    </div>
                  )}

                  {/* Step: Bill Counting */}
                  {modalStep === 'bills' && (
                    <div className="space-y-5">
                      {/* Expected Amount */}
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Monto esperado</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {selectedDelivery.currency} ${expectedTotal.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          De: {selectedDelivery.delivery_user_name}
                        </p>
                      </div>

                      {/* Bill Denomination Inputs */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Cuenta los billetes recibidos:
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          {(BILL_DENOMINATIONS[selectedDelivery.currency] || BILL_DENOMINATIONS.USD).map((denom) => (
                            <div
                              key={denom}
                              className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                            >
                              <div className="w-12 h-8 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <span className="text-sm font-bold text-green-700 dark:text-green-400">${denom}</span>
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={billCounts[denom] || ''}
                                onChange={(e) => setBillCounts(prev => ({
                                  ...prev,
                                  [denom]: parseInt(e.target.value) || 0
                                }))}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center font-semibold focus:ring-2 focus:ring-[#cc0a46] dark:focus:ring-[#2a5caa] focus:border-transparent"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Received Total */}
                      <div className={`p-4 rounded-xl border-2 ${
                        amountsMatch
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                          : receivedTotal > 0
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total contado:</span>
                          <span className={`text-xl font-bold ${
                            amountsMatch
                              ? 'text-green-600 dark:text-green-400'
                              : receivedTotal > 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-900 dark:text-white'
                          }`}>
                            ${receivedTotal.toLocaleString()}
                          </span>
                        </div>
                        {receivedTotal > 0 && !amountsMatch && (
                          <p className="text-xs text-red-500 mt-1">
                            Diferencia: ${(receivedTotal - expectedTotal).toLocaleString()}
                          </p>
                        )}
                        {amountsMatch && receivedTotal > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Los montos coinciden
                          </p>
                        )}
                      </div>

                      {/* OTP Channel Selection */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Enviar código OTP por:
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setOtpChannel('sms')}
                            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                              otpChannel === 'sms'
                                ? 'border-[#cc0a46] dark:border-[#2a5caa] bg-[#cc0a46]/10 dark:bg-[#2a5caa]/10 text-[#cc0a46] dark:text-[#2a5caa]'
                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                            }`}
                          >
                            <Phone className="w-4 h-4" />
                            SMS
                          </button>
                          <button
                            onClick={() => setOtpChannel('whatsapp')}
                            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                              otpChannel === 'whatsapp'
                                ? 'border-[#cc0a46] dark:border-[#2a5caa] bg-[#cc0a46]/10 dark:bg-[#2a5caa]/10 text-[#cc0a46] dark:text-[#2a5caa]'
                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                            }`}
                          >
                            <MessageCircle className="w-4 h-4" />
                            WhatsApp
                          </button>
                        </div>
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={handleValidateBills}
                        disabled={!amountsMatch || isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-[#cc0a46] dark:bg-[#2a5caa] hover:bg-[#a50837] dark:hover:bg-[#1e4387] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            Validar y Enviar OTP
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Step: OTP Verification */}
                  {modalStep === 'otp' && (
                    <div className="space-y-5">
                      {/* Info */}
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <Shield className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                        </div>
                        <p className="text-gray-600 dark:text-gray-300">
                          Se envió un código de verificación al repartidor
                        </p>
                        {otpSentTo && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Teléfono: {otpSentTo}
                          </p>
                        )}
                      </div>

                      {/* OTP Inputs */}
                      <div className="flex justify-center gap-2">
                        {otpCode.map((digit, index) => (
                          <input
                            key={index}
                            ref={(el) => { otpInputRefs.current[index] = el }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOTPChange(index, e.target.value)}
                            onKeyDown={(e) => handleOTPKeyDown(index, e)}
                            onPaste={index === 0 ? handleOTPPaste : undefined}
                            className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#cc0a46] dark:focus:ring-[#2a5caa] focus:border-transparent transition-all"
                          />
                        ))}
                      </div>

                      {/* Resend Button */}
                      <div className="text-center">
                        <button
                          onClick={handleResendOTP}
                          disabled={resendCooldown > 0 || isProcessing}
                          className="text-sm text-[#cc0a46] dark:text-[#2a5caa] hover:underline disabled:opacity-50 disabled:no-underline"
                        >
                          {resendCooldown > 0
                            ? `Reenviar en ${resendCooldown}s`
                            : 'Reenviar código'}
                        </button>
                      </div>

                      {/* Submit Button */}
                      <button
                        onClick={handleConfirmOTP}
                        disabled={otpCode.join('').length !== 6 || isProcessing}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-[#cc0a46] dark:bg-[#2a5caa] hover:bg-[#a50837] dark:hover:bg-[#1e4387] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-5 h-5" />
                            Confirmar Recepción
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Step: Success */}
                  {modalStep === 'success' && successData && (
                    <div className="space-y-5 text-center">
                      <div className="w-20 h-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                      </div>

                      <div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                          ¡Efectivo Recibido!
                        </h4>
                        <p className="text-gray-500 dark:text-gray-400">
                          El monto ha sido acreditado a tu wallet
                        </p>
                      </div>

                      {/* Balance Info */}
                      <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Anterior</p>
                            <p className="font-semibold text-gray-700 dark:text-gray-300">
                              ${successData.walletBalance?.balanceBefore?.toLocaleString() || '0'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Añadido</p>
                            <p className="font-bold text-green-600 dark:text-green-400">
                              +${successData.walletBalance?.amountAdded?.toLocaleString() || '0'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Nuevo</p>
                            <p className="font-bold text-[#cc0a46] dark:text-[#2a5caa]">
                              ${successData.walletBalance?.newBalance?.toLocaleString() || '0'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={closeModal}
                        className="w-full px-6 py-3.5 rounded-xl font-semibold text-white bg-[#cc0a46] dark:bg-[#2a5caa] hover:bg-[#a50837] dark:hover:bg-[#1e4387] transition-all"
                      >
                        Cerrar
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
