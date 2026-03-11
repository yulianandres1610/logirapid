'use client'

import { motion } from 'framer-motion'
import { RefreshCw, ScanLine } from 'lucide-react'

interface Props {
  visitorName: string | null
  isError?: boolean
  errorMessage?: string
}

/**
 * Processing / error overlay — optimized for TC21K 5" screen
 */
export default function ScanFeedback({ visitorName, isError, errorMessage }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/95 px-5"
    >
      {isError ? (
        <>
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-3 border-2 border-red-500/40">
            <ScanLine className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-lg font-semibold text-red-400 text-center">
            {errorMessage || 'Error al procesar'}
          </p>
          <p className="text-xs text-stone-400 mt-1">Intente de nuevo</p>
        </>
      ) : (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="mb-4"
          >
            <RefreshCw className="w-10 h-10 text-orange-400" />
          </motion.div>
          {visitorName && (
            <p className="text-xl font-bold text-white mb-1.5 text-center leading-tight">{visitorName}</p>
          )}
          <p className="text-sm text-stone-400">Procesando...</p>
        </>
      )}
    </motion.div>
  )
}
