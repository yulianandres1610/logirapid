'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, CheckCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  theme?: 'light' | 'dark'
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning',
  theme = 'light'
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const iconMap = {
    danger: AlertTriangle,
    warning: AlertTriangle,
    info: CheckCircle
  }

  const Icon = iconMap[type]

  const colorMap = {
    danger: {
      icon: 'text-red-500',
      iconBg: theme === 'dark' ? 'bg-red-500/20' : 'bg-red-50',
      button: theme === 'dark' 
        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30'
        : 'bg-red-600 text-white hover:bg-red-700'
    },
    warning: {
      icon: 'text-yellow-500',
      iconBg: theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-50',
      button: theme === 'dark'
        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/30'
        : 'bg-yellow-600 text-white hover:bg-yellow-700'
    },
    info: {
      icon: 'text-blue-500',
      iconBg: theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-50',
      button: theme === 'dark'
        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border-blue-500/30'
        : 'bg-blue-600 text-white hover:bg-blue-700'
    }
  }

  const colors = colorMap[type]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden',
            theme === 'dark' 
              ? 'bg-gray-800 border border-gray-700'
              : 'bg-white border border-gray-200'
          )}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className={cn(
              'absolute top-4 right-4 p-1 rounded-lg transition-colors',
              theme === 'dark'
                ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            )}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6">
            {/* Icon */}
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mb-4', colors.iconBg)}>
              <Icon className={cn('w-6 h-6', colors.icon)} />
            </div>

            {/* Title */}
            <h3 className={cn(
              'text-xl font-bold mb-2',
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            )}>
              {title}
            </h3>

            {/* Message */}
            <p className={cn(
              'text-sm mb-6 whitespace-pre-line',
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            )}>
              {message}
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors border',
                  theme === 'dark'
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 border-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                )}
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors border',
                  colors.button
                )}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
