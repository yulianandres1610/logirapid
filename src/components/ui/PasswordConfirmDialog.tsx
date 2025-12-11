'use client'

import { useState } from 'react'
import { X, Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface PasswordConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  title?: string
  message?: string
}

export default function PasswordConfirmDialog({
  isOpen,
  onClose,
  onSuccess,
  title = 'Verificacion de Seguridad',
  message = 'Por favor ingresa tu contrasena para continuar.'
}: PasswordConfirmDialogProps) {
  const { theme } = useTheme()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!password.trim()) {
      setError('Ingresa tu contrasena')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      const data = await res.json()

      if (data.success) {
        setPassword('')
        setError(null)
        onSuccess()
      } else {
        setError(data.error || 'Contrasena incorrecta')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setPassword('')
    setError(null)
    setShowPassword(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 backdrop-blur-sm",
          theme === 'dark' ? "bg-black/70" : "bg-black/50"
        )}
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className={cn(
        "relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden",
        theme === 'dark' ? "bg-gray-800" : "bg-white"
      )}>
        {/* Header */}
        <div className={cn(
          "p-5",
          theme === 'dark'
            ? "bg-gradient-to-r from-gray-700 to-gray-600"
            : "bg-gradient-to-r from-gray-800 to-gray-700"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                theme === 'dark' ? "bg-white/10" : "bg-white/20"
              )}>
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{title}</h2>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className={cn(
            "text-sm mb-4",
            theme === 'dark' ? "text-gray-300" : "text-gray-600"
          )}>{message}</p>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-200" : "text-gray-700"
              )}>
                Contrasena
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className={cn(
                    "w-5 h-5",
                    theme === 'dark' ? "text-gray-400" : "text-gray-400"
                  )} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError(null)
                  }}
                  placeholder="Ingresa tu contrasena"
                  className={cn(
                    "w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:outline-none",
                    theme === 'dark'
                      ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400 focus:ring-gray-500 focus:border-gray-500"
                      : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-gray-500 focus:border-gray-500"
                  )}
                  disabled={loading}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "absolute inset-y-0 right-0 pr-3 flex items-center",
                    theme === 'dark' ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"
                  )}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className={cn(
                "mb-4 p-3 border rounded-lg flex items-center gap-2 text-sm",
                theme === 'dark'
                  ? "bg-red-900/30 border-red-800 text-red-300"
                  : "bg-red-50 border-red-200 text-red-700"
              )}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className={cn(
                  "flex-1 py-3 border rounded-lg font-medium transition-all disabled:opacity-50",
                  theme === 'dark'
                    ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50"
                )}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !password.trim()}
                className={cn(
                  "flex-1 py-3 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                  theme === 'dark'
                    ? "bg-gradient-to-r from-gray-600 to-gray-500 text-white hover:from-gray-500 hover:to-gray-400"
                    : "bg-gradient-to-r from-gray-800 to-gray-700 text-white hover:from-gray-700 hover:to-gray-600"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verificar
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
