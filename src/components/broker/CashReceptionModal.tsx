'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  X,
  DollarSign,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Smartphone
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Bill denominations by currency
const BILL_DENOMINATIONS: { [key: string]: number[] } = {
  USD: [100, 50, 20, 10, 5, 1],
  EUR: [500, 200, 100, 50, 20, 10, 5],
  CUP: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  MLC: [100, 50, 20, 10, 5, 1]
}

interface CashDelivery {
  id: number
  order_number: string
  delivery_user_name: string
  delivery_user_phone: string
  currency: string
  total_amount: string | number
  total_bills: number
  bill_denominations?: { [key: string]: number }
}

type OTPChannel = 'sms' | 'whatsapp'

interface CashReceptionModalProps {
  isOpen: boolean
  onClose: () => void
  delivery: CashDelivery | null
  onSuccess: () => void
  onProceedToOTP: (delivery: CashDelivery, maskedPhone: string, channel: OTPChannel) => void
}

export default function CashReceptionModal({
  isOpen,
  onClose,
  delivery,
  onSuccess,
  onProceedToOTP
}: CashReceptionModalProps) {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [receivedDenominations, setReceivedDenominations] = useState<{ [key: string]: number }>({})
  const [isValidating, setIsValidating] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [receptionStarted, setReceptionStarted] = useState(false)
  const [otpChannel, setOtpChannel] = useState<OTPChannel>('sms')

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && delivery) {
      setReceivedDenominations({})
      setReceptionStarted(false)
      setOtpChannel('sms')
    }
  }, [isOpen, delivery])

  if (!delivery) return null

  const expectedAmount = parseFloat(delivery.total_amount as string)
  const currency = delivery.currency || 'USD'
  const denominations = BILL_DENOMINATIONS[currency] || BILL_DENOMINATIONS.USD

  // Calculate received total
  const calculateReceivedTotal = () => {
    let total = 0
    for (const [denom, count] of Object.entries(receivedDenominations)) {
      total += parseInt(denom) * (Number(count) || 0)
    }
    return total
  }

  const receivedTotal = calculateReceivedTotal()
  const amountsMatch = receivedTotal === expectedAmount
  const difference = receivedTotal - expectedAmount

  // Handle denomination change
  const handleDenominationChange = (denomination: number, value: string) => {
    const numValue = parseInt(value) || 0
    setReceivedDenominations(prev => ({
      ...prev,
      [denomination]: numValue >= 0 ? numValue : 0
    }))
  }

  // Start reception process
  const handleStartReception = async () => {
    setIsStarting(true)
    try {
      const res = await fetch(`/api/broker/cash-deliveries/${delivery.id}/start-reception`, {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        setReceptionStarted(true)
        showNotification('info', 'Recepción iniciada', 'Ahora puede contar los billetes')
      } else {
        showNotification('error', 'Error', data.error)
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error al iniciar la recepción')
    } finally {
      setIsStarting(false)
    }
  }

  // Validate amounts and send OTP
  const handleValidate = async () => {
    if (!amountsMatch) {
      showNotification('error', 'Error', 'Los montos no coinciden')
      return
    }

    setIsValidating(true)
    try {
      const res = await fetch(`/api/broker/cash-deliveries/${delivery.id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedBillDenominations: receivedDenominations,
          channel: otpChannel
        })
      })
      const data = await res.json()

      if (data.success) {
        const channelLabel = otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'
        showNotification('success', 'Montos validados', `OTP enviado por ${channelLabel}`)
        onProceedToOTP(delivery, data.data.otpSentTo, otpChannel)
        onClose()
      } else {
        showNotification('error', 'Error', data.error)
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error al validar los montos')
    } finally {
      setIsValidating(false)
    }
  }

  const cardBg = theme === 'dark' ? 'bg-gray-800' : 'bg-white'
  const inputBg = theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
  const textPrimary = theme === 'dark' ? 'text-white' : 'text-gray-900'
  const textSecondary = theme === 'dark' ? 'text-gray-400' : 'text-gray-600'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`${cardBg} rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden relative z-10`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}>
              <div>
                <h2 className={`text-lg font-semibold ${textPrimary}`}>
                  Recibir Efectivo
                </h2>
                <p className={`text-sm ${textSecondary}`}>{delivery.order_number}</p>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'} transition-colors`}
              >
                <X className={`h-5 w-5 ${textSecondary}`} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Delivery Info */}
              <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <User className={`h-5 w-5 ${textSecondary}`} />
                  <div>
                    <p className={`font-medium ${textPrimary}`}>{delivery.delivery_user_name}</p>
                    <p className={`text-sm ${textSecondary}`}>{delivery.delivery_user_phone}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={textSecondary}>Monto esperado:</span>
                  <span className={`text-xl font-bold ${textPrimary}`}>
                    {currency} ${expectedAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {!receptionStarted ? (
                /* Start Reception Button */
                <div className="text-center py-8">
                  <DollarSign className={`h-16 w-16 mx-auto mb-4 ${textSecondary}`} />
                  <p className={`mb-4 ${textSecondary}`}>
                    Haga clic para iniciar el proceso de recepción de efectivo
                  </p>
                  <button
                    onClick={handleStartReception}
                    disabled={isStarting}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-exa-primary to-exa-secondary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isStarting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Iniciando...
                      </span>
                    ) : (
                      'Iniciar Recepción'
                    )}
                  </button>
                </div>
              ) : (
                /* Bill Counting Form */
                <>
                  <p className={`mb-4 ${textSecondary}`}>
                    Ingrese la cantidad de billetes que recibió:
                  </p>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {denominations.map(denom => {
                      const count = receivedDenominations[denom] || 0
                      const subtotal = denom * count

                      return (
                        <div
                          key={denom}
                          className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-semibold ${textPrimary}`}>
                              ${denom}
                            </span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={count || ''}
                            onChange={(e) => handleDenominationChange(denom, e.target.value)}
                            placeholder="0"
                            className={`w-full px-3 py-2 rounded-lg border ${inputBg} ${textPrimary} text-center focus:outline-none focus:ring-2 focus:ring-exa-primary`}
                          />
                          <p className={`text-xs ${textSecondary} mt-1 text-center`}>
                            = ${subtotal.toLocaleString()}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Total */}
                  <div className={`p-4 rounded-xl ${
                    amountsMatch
                      ? 'bg-green-500/10 border border-green-500/30'
                      : receivedTotal > 0
                        ? 'bg-red-500/10 border border-red-500/30'
                        : theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={textSecondary}>Total contado:</span>
                      <span className={`text-xl font-bold ${
                        amountsMatch ? 'text-green-500' : receivedTotal > 0 ? 'text-red-500' : textPrimary
                      }`}>
                        {currency} ${receivedTotal.toLocaleString()}
                      </span>
                    </div>

                    {receivedTotal > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        {amountsMatch ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-green-500 text-sm">Coincide</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-red-500 text-sm">
                              {difference > 0 ? `Exceso de $${difference}` : `Falta $${Math.abs(difference)}`}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Channel Selector */}
                  {amountsMatch && (
                    <div className="mt-4">
                      <p className={`text-sm mb-2 ${textSecondary}`}>
                        Enviar código OTP por:
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setOtpChannel('sms')}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                            otpChannel === 'sms'
                              ? 'border-exa-primary bg-exa-primary/10 text-exa-primary'
                              : `${theme === 'dark' ? 'border-white/10 hover:border-white/30' : 'border-gray-200 hover:border-gray-300'} ${textPrimary}`
                          }`}
                        >
                          <Smartphone className="h-5 w-5" />
                          <span className="font-medium">SMS</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setOtpChannel('whatsapp')}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${
                            otpChannel === 'whatsapp'
                              ? 'border-green-500 bg-green-500/10 text-green-500'
                              : `${theme === 'dark' ? 'border-white/10 hover:border-white/30' : 'border-gray-200 hover:border-gray-300'} ${textPrimary}`
                          }`}
                        >
                          <MessageSquare className="h-5 w-5" />
                          <span className="font-medium">WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {receptionStarted && (
              <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'} flex gap-3`}>
                <button
                  onClick={onClose}
                  className={`flex-1 py-3 rounded-xl font-medium ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'} ${textPrimary} transition-colors`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleValidate}
                  disabled={!amountsMatch || isValidating}
                  className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-green-500 to-green-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isValidating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validando...
                    </span>
                  ) : (
                    'Validar Monto'
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
