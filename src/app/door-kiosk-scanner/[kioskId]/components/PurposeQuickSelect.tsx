'use client'

import { motion } from 'framer-motion'
import { Package, Users, Truck, Settings } from 'lucide-react'

interface Props {
  visitorName: string
  onSelect: (purpose: string) => void
  loading?: boolean
}

const PURPOSES = [
  { id: 'compra', label: 'Compra', icon: Package, color: 'bg-orange-500' },
  { id: 'reunion', label: 'Reunión', icon: Users, color: 'bg-blue-500' },
  { id: 'entrega', label: 'Entrega', icon: Truck, color: 'bg-green-500' },
  { id: 'otro', label: 'Otro', icon: Settings, color: 'bg-stone-500' },
]

/**
 * Purpose quick select — optimized for TC21K 5" screen (360×640 CSS)
 */
export default function PurposeQuickSelect({ visitorName, onSelect, loading }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 px-5"
    >
      <p className="text-sm text-gray-500 mb-0.5">Visitante</p>
      <p className="text-xl font-bold text-gray-900 mb-4 text-center leading-tight">{visitorName}</p>
      <p className="text-sm text-gray-600 mb-3">Propósito de visita</p>

      <div className="grid grid-cols-2 gap-2.5 w-full max-w-[300px]">
        {PURPOSES.map((purpose) => {
          const Icon = purpose.icon
          return (
            <button
              key={purpose.id}
              onClick={() => onSelect(purpose.id)}
              disabled={loading}
              className="flex flex-col items-center gap-1.5 py-4 px-3 rounded-xl bg-white hover:bg-orange-50 active:scale-95 transition-all disabled:opacity-50 shadow-sm border border-gray-200"
            >
              <div className={`w-10 h-10 ${purpose.color} rounded-lg flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-900">{purpose.label}</span>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
