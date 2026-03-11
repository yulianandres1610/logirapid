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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/95 p-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4 border-2 border-green-500/40"
      >
        <CheckCircle className="w-10 h-10 text-green-400" />
      </motion.div>

      <div className="flex items-center gap-2 text-green-400 mb-4">
        <LogIn className="w-5 h-5" />
        <span className="text-lg font-semibold">Entrada Registrada</span>
      </div>

      <div className="bg-stone-800 rounded-2xl p-5 w-full max-w-sm space-y-3">
        <div className="text-center">
          <p className="text-xl font-bold text-white">{visitorName}</p>
          <p className="text-sm text-stone-400">{idNumber}</p>
        </div>
        <div className="border-t border-stone-700 pt-3 flex justify-between text-sm">
          <span className="text-stone-400">Propósito</span>
          <span className="text-white font-medium">{PURPOSE_LABELS[purpose] || purpose}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-400">Hora</span>
          <span className="text-white font-medium">{timeStr}</span>
        </div>
      </div>

      {/* Countdown */}
      <div className="mt-6 w-12 h-12 rounded-full border-2 border-stone-600 flex items-center justify-center">
        <span className="text-lg font-bold text-stone-400">{countdown}</span>
      </div>
    </motion.div>
  )
}
