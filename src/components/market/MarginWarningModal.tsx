'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, TrendingUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

interface LowMarginItem {
  name: string
  costPrice: number
  sellingPrice: number
  margin: number
  suggestedPrice: number
}

interface MarginWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onAdjustPrices: () => void
  items: LowMarginItem[]
  recommendedMargin?: number // Default 40%
}

export function MarginWarningModal({
  isOpen,
  onClose,
  onConfirm,
  onAdjustPrices,
  items,
  recommendedMargin = 40
}: MarginWarningModalProps) {
  const { theme } = useTheme()

  // Calculate price for recommended margin
  const calculateSuggestedPrice = (costPrice: number): number => {
    return Math.round(costPrice * (1 + recommendedMargin / 100) * 100) / 100
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
              'w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}
          >
            {/* Header */}
            <div className={cn(
              'px-6 py-4 border-b',
              theme === 'dark' ? 'border-gray-700 bg-amber-500/10' : 'border-gray-200 bg-amber-50'
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h2 className={cn(
                      'text-lg font-semibold',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      Margen de Ganancia Bajo
                    </h2>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      {items.length} {items.length === 1 ? 'producto' : 'productos'} con margen menor al {recommendedMargin}%
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className={cn(
                    'p-2 rounded-lg transition-colors',
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  )}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Info message */}
              <div className={cn(
                'p-4 rounded-xl',
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              )}>
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className={cn(
                      'font-medium',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      El margen saludable recomendado es {recommendedMargin}%
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Un margen del {recommendedMargin}% ayuda a cubrir gastos operativos y generar ganancias sostenibles.
                    </p>
                  </div>
                </div>
              </div>

              {/* Items list */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-4 rounded-xl border',
                      theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-white border-gray-200'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-medium truncate',
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {item.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className="text-gray-500">
                            Costo: <span className="font-medium">${item.costPrice.toFixed(2)}</span>
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-gray-500">
                            Venta: <span className="font-medium text-amber-600">${item.sellingPrice.toFixed(2)}</span>
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={cn(
                          'inline-block px-2 py-1 rounded-lg text-sm font-medium',
                          item.margin < 10
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}>
                          {item.margin.toFixed(0)}% margen
                        </span>
                      </div>
                    </div>

                    {/* Suggested price */}
                    <div className={cn(
                      'mt-3 pt-3 border-t flex items-center justify-between',
                      theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
                    )}>
                      <span className="text-xs text-gray-500">
                        Precio sugerido ({recommendedMargin}% margen):
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">
                        ${calculateSuggestedPrice(item.costPrice).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Warning note */}
              <p className="text-xs text-gray-500 text-center">
                Puedes continuar con estos precios o ajustarlos antes de guardar.
              </p>
            </div>

            {/* Footer */}
            <div className={cn(
              'px-6 py-4 border-t flex gap-3',
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            )}>
              <button
                onClick={onAdjustPrices}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-xl font-medium transition-all border-2',
                  theme === 'dark'
                    ? 'border-emerald-500 text-emerald-400 hover:bg-emerald-500/10'
                    : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'
                )}
              >
                Ajustar Precios
              </button>
              <button
                onClick={onConfirm}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-xl font-medium transition-all',
                  'bg-amber-500 hover:bg-amber-600 text-white'
                )}
              >
                Continuar de todos modos
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
