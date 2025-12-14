'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useNotification } from '@/contexts/notification-context'
import {
  X,
  Smartphone,
  Loader2,
  CheckCircle,
  RefreshCw,
  DollarSign,
  AlertCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface CashDelivery {
  id: number
  order_number: string
  currency: string
  total_amount: string | number
}

interface OTPVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  delivery: CashDelivery | null
  maskedPhone: string
  onSuccess: (result: any) => void
}

export default function OTPVerificationModal({
  isOpen,
  onClose,
  delivery,
  maskedPhone,
  onSuccess
}: OTPVerificationModalProps) {
  const { theme } = useTheme()
  const { showNotification } = useNotification()

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes in seconds
  const [remainingResends, setRemainingResends] = useState(3)
  const [isSuccess, setIsSuccess] = useState(false)
  const [successData, setSuccessData] = useState<any>(null)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setOtp(['', '', '', '', '', ''])
      setTimeLeft(300)
      setIsSuccess(false)
      setSuccessData(null)
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    }
  }, [isOpen])

  // Countdown timer
  useEffect(() => {
    if (!isOpen || isSuccess) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, isSuccess])

  if (!delivery) return null

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newOtp = [...otp]
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i]
    }
    setOtp(newOtp)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const handleVerify = async () => {
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      showNotification('error', 'Error', 'Ingrese el código de 6 dígitos')
      return
    }

    setIsVerifying(true)
    try {
      const res = await fetch(`/api/broker/cash-deliveries/${delivery.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpCode })
      })
      const data = await res.json()

      if (data.success) {
        setIsSuccess(true)
        setSuccessData(data.data)
        showNotification('success', 'Éxito', 'Efectivo recibido exitosamente')
      } else {
        showNotification('error', 'Error', data.error)
        // Clear OTP on error
        setOtp(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error al verificar el código')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (remainingResends <= 0) {
      showNotification('error', 'Error', 'Se alcanzó el límite de reenvíos')
      return
    }

    setIsResending(true)
    try {
      const res = await fetch(`/api/broker/cash-deliveries/${delivery.id}/resend-otp`, {
        method: 'POST'
      })
      const data = await res.json()

      if (data.success) {
        setTimeLeft(300)
        setOtp(['', '', '', '', '', ''])
        setRemainingResends(data.data.remainingResends)
        showNotification('success', 'OTP reenviado', 'Nuevo código enviado al repartidor')
        inputRefs.current[0]?.focus()
      } else {
        showNotification('error', 'Error', data.error)
      }
    } catch (error) {
      showNotification('error', 'Error', 'Error al reenviar el código')
    } finally {
      setIsResending(false)
    }
  }

  const handleClose = () => {
    if (isSuccess) {
      onSuccess(successData)
    }
    onClose()
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
            onClick={!isSuccess ? undefined : handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`${cardBg} rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative z-10`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-gray-100'}`}>
              <div>
                <h2 className={`text-lg font-semibold ${textPrimary}`}>
                  {isSuccess ? 'Efectivo Recibido' : 'Verificación OTP'}
                </h2>
                <p className={`text-sm ${textSecondary}`}>{delivery.order_number}</p>
              </div>
              <button
                onClick={handleClose}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'} transition-colors`}
              >
                <X className={`h-5 w-5 ${textSecondary}`} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {isSuccess ? (
                /* Success State */
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-green-500" />
                  </div>
                  <h3 className={`text-xl font-bold mb-2 ${textPrimary}`}>
                    ¡Efectivo Recibido!
                  </h3>
                  <p className={`mb-6 ${textSecondary}`}>
                    Su wallet ha sido acreditado
                  </p>

                  {successData?.walletBalance && (
                    <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={textSecondary}>Balance anterior:</span>
                        <span className={textPrimary}>
                          {successData.walletBalance.currency} ${successData.walletBalance.balanceBefore?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={textSecondary}>Monto agregado:</span>
                        <span className="text-green-500 font-semibold">
                          +${successData.walletBalance.amountAdded?.toLocaleString()}
                        </span>
                      </div>
                      <div className={`pt-2 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between`}>
                        <span className={`font-medium ${textPrimary}`}>Nuevo balance:</span>
                        <span className={`text-xl font-bold ${textPrimary}`}>
                          {successData.walletBalance.currency} ${successData.walletBalance.newBalance?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleClose}
                    className="mt-6 w-full py-3 rounded-xl font-medium bg-gradient-to-r from-green-500 to-green-600 text-white hover:opacity-90 transition-opacity"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                /* OTP Input State */
                <>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-exa-primary/20 to-exa-secondary/20 flex items-center justify-center">
                      <Smartphone className="h-8 w-8 text-exa-primary" />
                    </div>
                    <p className={textSecondary}>
                      Se ha enviado un código de 6 dígitos al teléfono del repartidor:
                    </p>
                    <p className={`font-semibold ${textPrimary} mt-1`}>{maskedPhone}</p>
                  </div>

                  <p className={`text-sm text-center mb-4 ${textSecondary}`}>
                    Solicite el código al repartidor e ingréselo aquí:
                  </p>

                  {/* OTP Input */}
                  <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={el => { inputRefs.current[index] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className={`
                          w-12 h-14 text-center text-2xl font-bold rounded-xl border-2
                          ${inputBg} ${textPrimary}
                          focus:outline-none focus:border-exa-primary focus:ring-2 focus:ring-exa-primary/20
                          transition-all
                        `}
                      />
                    ))}
                  </div>

                  {/* Timer */}
                  <div className="text-center mb-4">
                    {timeLeft > 0 ? (
                      <p className={textSecondary}>
                        El código expira en{' '}
                        <span className={`font-mono font-semibold ${timeLeft < 60 ? 'text-red-500' : textPrimary}`}>
                          {formatTime(timeLeft)}
                        </span>
                      </p>
                    ) : (
                      <p className="text-red-500 flex items-center justify-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Código expirado
                      </p>
                    )}
                  </div>

                  {/* Resend */}
                  <div className="text-center mb-6">
                    <button
                      onClick={handleResend}
                      disabled={isResending || remainingResends <= 0}
                      className={`text-sm ${textSecondary} hover:text-exa-primary transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto`}
                    >
                      {isResending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {remainingResends > 0
                        ? `Reenviar SMS (${remainingResends} restantes)`
                        : 'Sin reenvíos disponibles'
                      }
                    </button>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className={`flex-1 py-3 rounded-xl font-medium ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'} ${textPrimary} transition-colors`}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleVerify}
                      disabled={otp.join('').length !== 6 || isVerifying || timeLeft === 0}
                      className="flex-1 py-3 rounded-xl font-medium bg-gradient-to-r from-exa-primary to-exa-secondary text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verificando...
                        </span>
                      ) : (
                        'Confirmar Recepción'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
