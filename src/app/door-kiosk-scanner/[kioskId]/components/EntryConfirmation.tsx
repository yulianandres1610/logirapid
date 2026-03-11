'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, LogIn } from 'lucide-react'

interface Props {
  visitorName: string
  idNumber: string
  purpose: string
  onComplete: () => void
}

const PURPOSE_LABELS: Record<string, string> = {
  compra: 'Compra',
  reunion: 'Reunión',
  entrega: 'Entrega',
  servicio: 'Servicio',
  otro: 'Otro',
}

/**
 * Entry/exit success card with countdown — optimized for TC21K 5" screen
 */
export default function EntryConfirmation({ visitorName, idNumber, purpose, onComplete }: Props) {
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onComplete])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 px-5"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3 border-2 border-green-300"
      >
        <CheckCircle className="w-8 h-8 text-green-600" />
      </motion.div>

      <div className="flex items-center gap-1.5 text-green-600 mb-3">
        <LogIn className="w-4 h-4" />
        <span className="text-base font-semibold">Entrada Registrada</span>
      </div>

      <div className="bg-white rounded-xl p-4 w-full max-w-[300px] space-y-2 shadow-sm border border-gray-200">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 leading-tight">{visitorName}</p>
          <p className="text-xs text-gray-500 mt-0.5">{idNumber}</p>
        </div>
        <div className="border-t border-gray-200 pt-2 flex justify-between text-xs">
          <span className="text-gray-500">Propósito</span>
          <span className="text-gray-900 font-medium">{PURPOSE_LABELS[purpose] || purpose}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Hora</span>
          <span className="text-gray-900 font-medium">{timeStr}</span>
        </div>
      </div>

      {/* Countdown */}
      <div className="mt-4 w-10 h-10 rounded-full border-2 border-orange-300 flex items-center justify-center">
        <span className="text-base font-bold text-orange-600">{countdown}</span>
      </div>
    </motion.div>
  )
}
