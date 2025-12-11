'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
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
  message = 'Ingresa tu contrasena para continuar.'
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
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog - Simple background */}
      <div className={cn(
        "relative w-full max-w-sm mx-4 p-6 rounded-xl shadow-lg",
        theme === 'dark' ? "bg-gray-900" : "bg-white"
      )}>
        <form onSubmit={handleSubmit}>
          {/* Password Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className={cn(
                "w-5 h-5",
                theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              placeholder="Contrasena"
              className={cn(
                "w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:outline-none",
                theme === 'dark'
                  ? "bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:ring-gray-600 focus:border-gray-600"
                  : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-gray-400 focus:border-gray-400"
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

          {/* Error Message */}
          {error && (
            <p className={cn(
              "mt-2 text-sm",
              theme === 'dark' ? "text-red-400" : "text-red-600"
            )}>
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className={cn(
              "w-full mt-4 py-3 rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2",
              theme === 'dark'
                ? "bg-gray-700 text-white hover:bg-gray-600"
                : "bg-gray-800 text-white hover:bg-gray-700"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando...
              </>
            ) : (
              'Verificar'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
