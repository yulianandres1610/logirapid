'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Scale, ChevronDown, ClipboardCheck, AlertOctagon, ShieldAlert, HelpCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AdjustmentReason = 'physical_count' | 'system_error' | 'theft_loss' | 'other'

interface AdjustmentReasonOption {
  id: AdjustmentReason
  name: string
  description: string
  icon: LucideIcon
  color: string
}

const adjustmentReasons: AdjustmentReasonOption[] = [
  {
    id: 'physical_count',
    name: 'Conteo Fisico',
    description: 'Diferencia detectada en inventario fisico',
    icon: ClipboardCheck,
    color: 'text-blue-500'
  },
  {
    id: 'system_error',
    name: 'Error de Sistema',
    description: 'Correccion por error en el sistema',
    icon: AlertOctagon,
    color: 'text-amber-500'
  },
  {
    id: 'theft_loss',
    name: 'Robo/Perdida',
    description: 'Producto robado o extraviado',
    icon: ShieldAlert,
    color: 'text-red-500'
  },
  {
    id: 'other',
    name: 'Otro',
    description: 'Otra razon (especificar en notas)',
    icon: HelpCircle,
    color: 'text-gray-500'
  }
]

interface AdjustmentReasonSelectorProps {
  selectedReason: AdjustmentReason | null
  onSelect: (reason: AdjustmentReason) => void
  disabled?: boolean
}

export default function AdjustmentReasonSelector({
  selectedReason,
  onSelect,
  disabled = false
}: AdjustmentReasonSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedOption = adjustmentReasons.find(r => r.id === selectedReason)

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Motivo del Ajuste
      </label>

      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-3 p-4
          bg-white dark:bg-gray-800
          border-2 rounded-xl
          transition-all
          ${isOpen ? 'border-amber-500 ring-2 ring-amber-200 dark:ring-amber-800' : 'border-gray-300 dark:border-gray-600'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-amber-400 cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`
            p-2 rounded-lg
            ${selectedOption ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-gray-100 dark:bg-gray-700'}
          `}>
            {selectedOption ? (
              <selectedOption.icon className={`w-5 h-5 ${selectedOption.color}`} />
            ) : (
              <Scale className="w-5 h-5 text-gray-400" />
            )}
          </div>

          {selectedOption ? (
            <div className="text-left">
              <p className="font-medium text-gray-900 dark:text-white">
                {selectedOption.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedOption.description}
              </p>
            </div>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              Seleccionar motivo...
            </span>
          )}
        </div>

        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute z-20 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
          >
            {adjustmentReasons.map((reason) => {
              const Icon = reason.icon
              return (
                <button
                  key={reason.id}
                  onClick={() => {
                    onSelect(reason.id)
                    setIsOpen(false)
                  }}
                  className={`
                    w-full flex items-center gap-3 p-3
                    hover:bg-gray-50 dark:hover:bg-gray-700
                    transition-colors
                    ${selectedReason === reason.id ? 'bg-amber-50 dark:bg-amber-900/30' : ''}
                  `}
                >
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                    <Icon className={`w-4 h-4 ${reason.color}`} />
                  </div>

                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {reason.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {reason.description}
                    </p>
                  </div>

                  {selectedReason === reason.id && (
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                  )}
                </button>
              )
            })}
          </motion.div>
        </>
      )}
    </div>
  )
}
