'use client'

import { motion } from 'framer-motion'
import { RefreshCw, ScanLine } from 'lucide-react'

interface Props {
  visitorName: string | null
  isError?: boolean
  errorMessage?: string
}

export default function ScanFeedback({ visitorName, isError, errorMessage }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/95 p-6"
    >
      {isError ? (
        <>
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-4 border-2 border-red-500/40">
            <ScanLine className="w-10 h-10 text-red-400" />
          </div>
          <p className="text-xl font-semibold text-red-400 text-center">
            {errorMessage || 'Error al procesar'}
          </p>
          <p className="text-sm text-stone-400 mt-2">Intente de nuevo</p>
        </>
      ) : (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="mb-6"
          >
            <RefreshCw className="w-12 h-12 text-orange-400" />
          </motion.div>
          {visitorName && (
            <p className="text-2xl font-bold text-white mb-2 text-center">{visitorName}</p>
          )}
          <p className="text-base text-stone-400">Procesando...</p>
        </>
      )}
    </motion.div>
  )
}
