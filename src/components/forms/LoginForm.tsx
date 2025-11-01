'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login, isLoading, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!email || !password) {
      return
    }

    try {
      console.log('🚀 LoginForm - Iniciando login con:', email)
      await login({
        email,
        password
      })
      console.log('✅ LoginForm - Login exitoso')
      onSuccess?.()
    } catch (err) {
      console.log('❌ LoginForm - Error:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email Field */}
      <div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-exa-secondary/30 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-exa-secondary focus:border-exa-secondary transition-all duration-300"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Password Field */}
      <div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-12 pr-12 py-4 bg-white/5 border border-exa-secondary/30 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-exa-secondary focus:border-exa-secondary transition-all duration-300"
            required
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
            disabled={isLoading}
          >
            {showPassword ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center space-x-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <div>
        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full h-14 text-base font-semibold bg-exa-secondary hover:bg-exa-secondary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-exa-secondary/25 flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Iniciando sesión...</span>
            </div>
          ) : (
            <>
              <span>Ingresar</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Demo Credentials */}
      <div className="text-center">
        <details className="group">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300 transition-colors list-none">
            ¿Credenciales de demostración?
          </summary>
          <div className="mt-3 p-3 bg-white/5 rounded-2xl border border-white/10">
            <p className="text-xs text-gray-300 mb-1">
              <span className="font-mono">Email:</span> admin@cubarapid.com
            </p>
            <p className="text-xs text-gray-300">
              <span className="font-mono">Contraseña:</span> admin123
            </p>
          </div>
        </details>
      </div>
    </form>
  )
}