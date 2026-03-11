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

export default function PurposeQuickSelect({ visitorName, onSelect, loading }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-stone-900/95 p-6"
    >
      <p className="text-lg text-stone-400 mb-1">Visitante</p>
      <p className="text-2xl font-bold text-white mb-6 text-center">{visitorName}</p>
      <p className="text-base text-stone-300 mb-4">Seleccione el propósito de visita</p>

      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {PURPOSES.map((purpose) => {
          const Icon = purpose.icon
          return (
            <button
              key={purpose.id}
              onClick={() => onSelect(purpose.id)}
              disabled={loading}
              className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-stone-800 hover:bg-stone-700 active:scale-95 transition-all disabled:opacity-50"
            >
              <div className={`w-12 h-12 ${purpose.color} rounded-xl flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-base font-semibold text-white">{purpose.label}</span>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}
