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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/95 px-5"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-3 border-2 border-green-500/40"
      >
        <CheckCircle className="w-8 h-8 text-green-400" />
      </motion.div>

      <div className="flex items-center gap-1.5 text-green-400 mb-3">
        <LogIn className="w-4 h-4" />
        <span className="text-base font-semibold">Entrada Registrada</span>
      </div>

      <div className="bg-stone-800 rounded-xl p-4 w-full max-w-[300px] space-y-2">
        <div className="text-center">
          <p className="text-lg font-bold text-white leading-tight">{visitorName}</p>
          <p className="text-xs text-stone-400 mt-0.5">{idNumber}</p>
        </div>
        <div className="border-t border-stone-700 pt-2 flex justify-between text-xs">
          <span className="text-stone-400">Propósito</span>
          <span className="text-white font-medium">{PURPOSE_LABELS[purpose] || purpose}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-stone-400">Hora</span>
          <span className="text-white font-medium">{timeStr}</span>
        </div>
      </div>

      {/* Countdown */}
      <div className="mt-4 w-10 h-10 rounded-full border-2 border-stone-600 flex items-center justify-center">
        <span className="text-base font-bold text-stone-400">{countdown}</span>
      </div>
    </motion.div>
  )
}
