'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Delete, Check, X } from 'lucide-react'

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
  // Track if user is starting a new number (after clear or initial state)
  const [isNewEntry, setIsNewEntry] = useState(true)

  // Reset isNewEntry when value changes externally (e.g., selecting a product)
  useEffect(() => {
    setIsNewEntry(true)
  }, [])

  const handleNumberClick = (num: string) => {
    if (disabled) return

    // Handle decimal point
    if (num === '.') {
      // If starting new entry, start with "0."
      if (isNewEntry) {
        onChange('0.')
        setIsNewEntry(false)
        return
      }
      // Don't add if already has decimal
      if (value.includes('.')) return
      onChange(value + '.')
      return
    }

    let newValue: string

    // If starting new entry, replace the value entirely
    if (isNewEntry) {
      newValue = num
      setIsNewEntry(false)
    } else {
      // Prevent leading zeros (except for decimals like "0.5")
      if (value === '0' && num !== '0') {
        newValue = num
      } else if (value === '0' && num === '0') {
        newValue = '0'
      } else {
        newValue = value + num
      }
    }

    const numericValue = parseFloat(newValue)

    if (maxValue && numericValue > maxValue) {
      onChange(String(maxValue))
    } else {
      onChange(newValue)
    }
  }

  const handleClear = () => {
    if (disabled) return
    onChange('0')
    setIsNewEntry(true)
  }

  const handleBackspace = () => {
    if (disabled) return

    // If in new entry mode, just clear
    if (isNewEntry) {
      onChange('0')
      return
    }

    if (value.length <= 1) {
      onChange('0')
      setIsNewEntry(true)
    } else {
      const newValue = value.slice(0, -1)
      // If we end up with just a decimal point, add leading zero
      if (newValue === '' || newValue === '-') {
        onChange('0')
        setIsNewEntry(true)
      } else {
        onChange(newValue)
      }
    }
  }

  // Click on display to start fresh
  const handleDisplayClick = () => {
    if (disabled) return
    setIsNewEntry(true)
  }

  type ButtonConfig = {
    label: string
    action: () => void
    special?: boolean
    decimal?: boolean
    clear?: boolean
    icon?: typeof Delete
  }

  const buttons: ButtonConfig[] = [
    { label: '7', action: () => handleNumberClick('7') },
    { label: '8', action: () => handleNumberClick('8') },
    { label: '9', action: () => handleNumberClick('9') },
    { label: '4', action: () => handleNumberClick('4') },
    { label: '5', action: () => handleNumberClick('5') },
    { label: '6', action: () => handleNumberClick('6') },
    { label: '1', action: () => handleNumberClick('1') },
    { label: '2', action: () => handleNumberClick('2') },
    { label: '3', action: () => handleNumberClick('3') },
    { label: 'C', action: handleClear, clear: true },
    { label: '0', action: () => handleNumberClick('0') },
    { label: '.', action: () => handleNumberClick('.'), decimal: true },
  ]

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Display - click to select/start fresh */}
      <div
        onClick={handleDisplayClick}
        className={`
          mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-xl text-center cursor-pointer
          transition-all hover:ring-2 hover:ring-purple-500
          ${isNewEntry ? 'ring-2 ring-purple-500 ring-opacity-50' : ''}
        `}
      >
        <span className={`
          text-3xl font-bold tabular-nums
          ${isNewEntry ? 'text-purple-600 dark:text-purple-400' : 'text-gray-900 dark:text-white'}
        `}>
          {value || '0'}
        </span>
        {isNewEntry && (
          <p className="text-xs text-purple-500 mt-1">Toca un numero para comenzar</p>
        )}
      </div>

      {/* Numpad grid */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {buttons.map((btn) => (
          <motion.button
            key={btn.label}
            whileTap={{ scale: 0.95 }}
            onClick={btn.action}
            disabled={disabled}
            className={`
              p-4 rounded-xl font-bold text-xl
              transition-colors
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${btn.clear
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                : btn.decimal
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
          >
            {btn.label}
          </motion.button>
        ))}
      </div>

      {/* Backspace button - full width */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleBackspace}
        disabled={disabled}
        className={`
          w-full p-3 rounded-xl font-bold text-lg mb-4
          flex items-center justify-center gap-2
          transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50
        `}
      >
        <Delete className="w-5 h-5" />
        Borrar
      </motion.button>

      {/* Confirm button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onConfirm}
        disabled={disabled || parseFloat(value) === 0 || value === ''}
        className={`
          w-full p-4 rounded-xl font-bold text-lg
          flex items-center justify-center gap-2
          transition-colors
          ${disabled || parseFloat(value) === 0 || value === ''
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
