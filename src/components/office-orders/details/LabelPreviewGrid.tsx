'use client'

import React, { useRef } from 'react'
import { Printer, Download, Tag } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { Button } from '@/components/ui/button'

interface Label {
  id: string
  trackingCode: string
  serviceName: string
  boxNumber: number
  totalBoxes: number
  boxCode: string
  sender: string
  senderPhone: string
  recipient: string
  recipientAddress: string
  recipientCity: string
  recipientState: string
  weight: string
  contentTypes?: string[]
  barcodeDataUrl?: string
  qrCodeDataUrl?: string
}

interface LabelPreviewGridProps {
  labels: Label[]
  onPrintAll: () => void
  onPrintSingle: (label: Label) => void
}

export default function LabelPreviewGrid({
  labels,
  onPrintAll,
  onPrintSingle
}: LabelPreviewGridProps) {
  const { theme } = useTheme()

  if (labels.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-2xl border p-8 text-center shadow-lg',
          theme === 'dark'
            ? 'bg-gray-800/95 border-gray-700/50'
            : 'bg-white border-gray-200'
        )}
      >
        <p className={cn(
          'text-sm',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          No hay etiquetas generadas para esta orden
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-6 shadow-lg',
        theme === 'dark'
          ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
          : 'bg-white border-gray-200'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shadow-md',
            'bg-gradient-to-br from-orange-500 to-orange-600'
          )}>
            <Tag className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={cn(
              'text-xl font-bold',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              Etiquetas de Envío
            </h3>
            <p className={cn(
              'text-sm mt-0.5',
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            )}>
              {labels.length} {labels.length === 1 ? 'etiqueta generada' : 'etiquetas generadas'}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={onPrintAll}
              className={cn(
                'flex items-center gap-2 rounded-xl shadow-md',
                'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
                'text-white'
              )}
            >
              <Printer className="w-4 h-4" />
              Imprimir Todas
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Labels Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {labels.map((label, index) => (
          <motion.div
            key={label.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              'rounded-xl border p-4 relative group transition-all',
              theme === 'dark'
                ? 'bg-gray-700/50 border-gray-600 hover:border-blue-500 hover:shadow-lg'
                : 'bg-gray-50 border-gray-200 hover:border-blue-400 hover:shadow-lg'
            )}
          >
            {/* Label Preview */}
            <div className={cn(
              'aspect-[4/6] rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-3 mb-3',
              theme === 'dark'
                ? 'border-gray-600 bg-gray-800/50'
                : 'border-gray-300 bg-white'
            )}>
              {/* Box Number Badge */}
              <div className={cn(
                'px-3 py-1.5 rounded-full text-sm font-bold mb-2',
                theme === 'dark'
                  ? 'bg-blue-900/30 text-blue-400'
                  : 'bg-blue-100 text-blue-700'
              )}>
                {label.boxNumber} / {label.totalBoxes}
              </div>

              {/* QR Code */}
              {label.qrCodeDataUrl && (
                <img
                  src={label.qrCodeDataUrl}
                  alt="QR Code"
                  className="w-24 h-24 mb-2"
                />
              )}

              {/* Service Name */}
              <p className={cn(
                'text-xs font-semibold text-center mb-1',
                theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
              )}>
                {label.serviceName}
              </p>

              {/* Box Code */}
              <code className={cn(
                'text-xs px-2 py-1 rounded',
                theme === 'dark'
                  ? 'bg-gray-700 text-gray-300'
                  : 'bg-gray-100 text-gray-700'
              )}>
                {label.boxCode}
              </code>

              {/* Destination */}
              <p className={cn(
                'text-xs text-center mt-2',
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              )}>
                {label.recipientCity}, {label.recipientState}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1">
                <Button
                  onClick={() => onPrintSingle(label)}
                  size="sm"
                  className={cn(
                    'w-full rounded-lg text-xs',
                    theme === 'dark'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-blue-500 hover:bg-blue-600',
                    'text-white'
                  )}
                >
                  <Printer className="w-3 h-3 mr-1" />
                  Imprimir
                </Button>
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
