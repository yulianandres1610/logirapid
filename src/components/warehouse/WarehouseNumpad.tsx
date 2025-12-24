'use client'

import { motion } from 'framer-motion'
import { Delete, Check } from 'lucide-react'

interface WarehouseNumpadProps {
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  maxValue?: number
  disabled?: boolean
}

export default function WarehouseNumpad({
  value,
  onChange,
  onConfirm,
  maxValue,
  disabled = false
}: WarehouseNumpadProps) {
  const handleNumberClick = (num: string) => {
    if (disabled) return

    const newValue = value === '0' ? num : value + num
    const numericValue = parseInt(newValue)

    if (maxValue && numericValue > maxValue) {
      onChange(String(maxValue))
    } else {
      onChange(newValue)
    }
  }

  const handleClear = () => {
    if (disabled) return
    onChange('0')
  }

  const handleBackspace = () => {
    if (disabled) return
    if (value.length <= 1) {
      onChange('0')
    } else {
      onChange(value.slice(0, -1))
    }
  }

  const buttons = [
    { label: '7', action: () => handleNumberClick('7') },
    { label: '8', action: () => handleNumberClick('8') },
    { label: '9', action: () => handleNumberClick('9') },
    { label: '4', action: () => handleNumberClick('4') },
    { label: '5', action: () => handleNumberClick('5') },
    { label: '6', action: () => handleNumberClick('6') },
    { label: '1', action: () => handleNumberClick('1') },
    { label: '2', action: () => handleNumberClick('2') },
    { label: '3', action: () => handleNumberClick('3') },
    { label: 'C', action: handleClear, special: true },
    { label: '0', action: () => handleNumberClick('0') },
    { label: 'del', action: handleBackspace, icon: Delete }
  ]

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Display */}
      <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-xl text-center">
        <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
          {value || '0'}
        </span>
      </div>

      {/* Numpad grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {buttons.map((btn, index) => (
          <motion.button
            key={btn.label}
            whileTap={{ scale: 0.95 }}
            onClick={btn.action}
            disabled={disabled}
            className={`
              p-4 rounded-xl font-bold text-xl
              transition-colors
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${btn.special
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                : btn.icon
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
          >
            {btn.icon ? <btn.icon className="w-6 h-6 mx-auto" /> : btn.label}
          </motion.button>
        ))}
      </div>

      {/* Confirm button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onConfirm}
        disabled={disabled || value === '0' || value === ''}
        className={`
          w-full p-4 rounded-xl font-bold text-lg
          flex items-center justify-center gap-2
          transition-colors
          ${disabled || value === '0' || value === ''
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700'
          }
        `}
      >
        <Check className="w-5 h-5" />
        Aplicar Cantidad
      </motion.button>
    </div>
  )
}
