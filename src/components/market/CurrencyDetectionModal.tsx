'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, DollarSign, AlertCircle, Clock, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

type CurrencyType = 'USD' | 'CUP' | 'MLC'

interface CurrencyDetectionModalProps {
  isOpen: boolean
  onConfirm: (currency: CurrencyType) => void
  detectedHints?: string | null
  total: number
  rates: { USD_CUP: number; USD_MLC: number }
  ratesTimestamp?: string
}

const CURRENCY_OPTIONS: {
  value: CurrencyType
  label: string
  description: string
  color: string
  bgColor: string
  borderColor: string
}[] = [
  {
    value: 'USD',
    label: 'USD (Dólares)',
    description: 'Dólares estadounidenses',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-500'
  },
  {
    value: 'CUP',
    label: 'CUP (Pesos Cubanos)',
    description: 'Peso cubano - moneda nacional',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-500'
  }
]

export function CurrencyDetectionModal({
  isOpen,
  onConfirm,
  detectedHints,
  total,
  rates,
  ratesTimestamp
}: CurrencyDetectionModalProps) {
  const { theme } = useTheme()
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyType | null>(null)

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCurrency(null)
    }
  }, [isOpen])

  // Calculate converted values for preview
  const getConvertedValue = (currency: CurrencyType): number => {
    if (currency === 'USD') return total
    if (currency === 'CUP') return total / rates.USD_CUP
    return total
  }

  // Format time since last update
  const getTimeSinceUpdate = (): string => {
    if (!ratesTimestamp) return 'actualizadas'
    const diff = Date.now() - new Date(ratesTimestamp).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'hace menos de 1 min'
    if (minutes < 60) return `hace ${minutes} min`
    return `hace ${Math.floor(minutes / 60)} horas`
  }

  // Suggest CUP if total is high (typical for Cuban pesos)
  const getSuggestedCurrency = (): CurrencyType | null => {
    if (total > 1000) return 'CUP'
    return null
  }

  const suggestedCurrency = getSuggestedCurrency()

  const handleConfirm = () => {
    if (selectedCurrency) {
      onConfirm(selectedCurrency)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={cn(
              'w-full max-w-md rounded-2xl shadow-2xl overflow-hidden',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}
          >
            {/* Header */}
            <div className={cn(
              'px-6 py-4 border-b',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                )}>
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className={cn(
                    'text-lg font-semibold',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>
                    Seleccionar Moneda
                  </h2>
                  <p className="text-sm text-gray-500">
                    No pudimos detectar la moneda automáticamente
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Detected hints */}
              {detectedHints && (
                <div className={cn(
                  'p-3 rounded-lg flex items-start gap-2',
                  theme === 'dark' ? 'bg-amber-500/10' : 'bg-amber-50'
                )}>
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {detectedHints}
                  </p>
                </div>
              )}

              {/* Total detected */}
              <div className={cn(
                'p-4 rounded-xl text-center',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              )}>
                <p className="text-sm text-gray-500 mb-1">Total detectado en factura</p>
                <p className={cn(
                  'text-3xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {total.toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              {/* Currency options */}
              <div className="space-y-2">
                {CURRENCY_OPTIONS.map((option) => {
                  const isSelected = selectedCurrency === option.value
                  const isSuggested = suggestedCurrency === option.value
                  const convertedValue = getConvertedValue(option.value)

                  return (
                    <button
                      key={option.value}
                      onClick={() => setSelectedCurrency(option.value)}
                      className={cn(
                        'w-full p-4 rounded-xl border-2 text-left transition-all',
                        isSelected
                          ? `${option.bgColor} ${option.borderColor}`
                          : theme === 'dark'
                            ? 'bg-gray-700 border-gray-600 hover:border-gray-500'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                            isSelected
                              ? `${option.borderColor} ${option.color}`
                              : 'border-gray-300'
                          )}>
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'font-medium',
                                isSelected ? option.color : theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {option.label}
                              </span>
                              {isSuggested && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  Sugerido
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {option.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Conversion preview */}
                      <div className={cn(
                        'mt-3 pt-3 border-t',
                        theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                      )}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Convertido a USD:</span>
                          <span className={cn(
                            'font-semibold',
                            option.value === 'USD' ? 'text-gray-500' : 'text-emerald-600'
                          )}>
                            ${convertedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                          </span>
                        </div>
                        {option.value === 'CUP' && (
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Tasa: 1 USD = {rates.USD_CUP.toLocaleString()} CUP
                          </p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Rates timestamp */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                <span>Tasa del sistema: 1 USD = {rates.USD_CUP.toLocaleString()} CUP</span>
              </div>
            </div>

            {/* Footer */}
            <div className={cn(
              'px-6 py-4 border-t flex justify-end',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <button
                onClick={handleConfirm}
                disabled={!selectedCurrency}
                className={cn(
                  'px-6 py-2.5 rounded-xl font-medium transition-all',
                  selectedCurrency
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700'
                )}
              >
                Confirmar Moneda
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
