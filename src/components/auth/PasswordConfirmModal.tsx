'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck, X } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PasswordConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  description?: string
  operationType?: 'scrap' | 'adjustment' | 'sensitive' | 'exit'
}

export function PasswordConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Identidad',
  description = 'Ingresa tu contraseña para continuar con esta operación.',
  operationType = 'sensitive'
}: PasswordConfirmModalProps) {
  const { theme } = useTheme()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password.trim()) {
      setError('Ingresa tu contraseña')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, operationType })
      })

      const data = await response.json()

      if (data.success) {
        onConfirm()
        onClose()
      } else {
        setError(data.error || 'Contraseña incorrecta')
        setPassword('')
        inputRef.current?.focus()
      }
    } catch (err) {
      setError('Error al verificar contraseña')
    } finally {
      setLoading(false)
    }
  }

  const getOperationInfo = () => {
    switch (operationType) {
      case 'scrap':
        return {
          icon: '🗑️',
          color: 'red',
          message: 'Esta operación eliminará productos del inventario permanentemente.'
        }
      case 'adjustment':
        return {
          icon: '📊',
          color: 'amber',
          message: 'Esta operación modificará las cantidades del inventario.'
        }
      case 'exit':
        return {
          icon: '🚪',
          color: 'purple',
          message: 'Confirma tu identidad para salir al panel de administración.'
        }
      default:
        return {
          icon: '🔐',
          color: 'blue',
          message: 'Esta es una operación sensible que requiere autorización.'
        }
    }
  }

  const opInfo = getOperationInfo()

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden',
            theme === 'dark'
              ? 'bg-gray-900 border-gray-700'
              : 'bg-white border-gray-200'
          )}
        >
          {/* Header */}
          <div className={cn(
            'relative p-6 pb-4',
            theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50'
          )}>
            <button
              onClick={onClose}
              className={cn(
                'absolute top-4 right-4 p-2 rounded-lg transition-colors',
                theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-400'
                  : 'hover:bg-gray-200 text-gray-500'
              )}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center',
                opInfo.color === 'red' && (theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'),
                opInfo.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/30' : 'bg-amber-100'),
                opInfo.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'),
                opInfo.color === 'purple' && (theme === 'dark' ? 'bg-purple-900/30' : 'bg-purple-100')
              )}>
                <ShieldCheck className={cn(
                  'w-7 h-7',
                  opInfo.color === 'red' && 'text-red-500',
                  opInfo.color === 'amber' && 'text-amber-500',
                  opInfo.color === 'blue' && 'text-blue-500',
                  opInfo.color === 'purple' && 'text-purple-500'
                )} />
              </div>
              <div>
                <h2 className={cn(
                  'text-xl font-bold',
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                )}>
                  {title}
                </h2>
                <p className={cn(
                  'text-sm mt-0.5',
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  {description}
                </p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className={cn(
            'mx-6 mt-4 p-3 rounded-xl flex items-start gap-3',
            opInfo.color === 'red' && (theme === 'dark' ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'),
            opInfo.color === 'amber' && (theme === 'dark' ? 'bg-amber-900/20 border border-amber-800' : 'bg-amber-50 border border-amber-200'),
            opInfo.color === 'blue' && (theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'),
            opInfo.color === 'purple' && (theme === 'dark' ? 'bg-purple-900/20 border border-purple-800' : 'bg-purple-50 border border-purple-200')
          )}>
            <span className="text-xl flex-shrink-0">{opInfo.icon}</span>
            <p className={cn(
              'text-sm',
              opInfo.color === 'red' && (theme === 'dark' ? 'text-red-300' : 'text-red-700'),
              opInfo.color === 'amber' && (theme === 'dark' ? 'text-amber-300' : 'text-amber-700'),
              opInfo.color === 'blue' && (theme === 'dark' ? 'text-blue-300' : 'text-blue-700'),
              opInfo.color === 'purple' && (theme === 'dark' ? 'text-purple-300' : 'text-purple-700')
            )}>
              {opInfo.message}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 pt-4">
            <div className="space-y-4">
              <div>
                <label className={cn(
                  'block text-sm font-medium mb-2',
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                )}>
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className={cn(
                    'absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5',
                    theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                  )} />
                  <input
                    ref={inputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError(null)
                    }}
                    placeholder="Ingresa tu contraseña"
                    disabled={loading}
                    className={cn(
                      'w-full pl-12 pr-12 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                      error
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 focus:ring-red-500/20'
                        : theme === 'dark'
                          ? 'bg-gray-800 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20'
                          : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20',
                      loading && 'opacity-50 cursor-not-allowed'
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={cn(
                      'absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded',
                      theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                    )}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-sm text-red-500 mt-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                disabled={loading}
                className={cn(
                  'flex-1 px-4 py-3 rounded-xl font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                Cancelar
              </motion.button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading || !password.trim()}
                className={cn(
                  'flex-1 px-4 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  opInfo.color === 'red' && 'bg-red-600 hover:bg-red-700 text-white',
                  opInfo.color === 'amber' && 'bg-amber-600 hover:bg-amber-700 text-white',
                  opInfo.color === 'blue' && 'bg-blue-600 hover:bg-blue-700 text-white',
                  opInfo.color === 'purple' && 'bg-purple-600 hover:bg-purple-700 text-white'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Confirmar
                  </>
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
