'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Store, Package } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function MarketLoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  })

  const watchedEmail = watch('email')
  const watchedPassword = watch('password')

  // Check if user is already authenticated on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isTokenValid = (token: string): boolean => {
      try {
        const parts = token.split('.')
        if (parts.length !== 3) return false
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        if (payload.exp) {
          const now = Math.floor(Date.now() / 1000)
          if (payload.exp < now) return false
        }
        // Check if it's a market company user
        if (payload.companyType !== 'market') return false
        return true
      } catch {
        return false
      }
    }

    const checkAuthentication = () => {
      const authToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('auth-token='))
        ?.split('=')[1]

      if (authToken && isTokenValid(authToken)) {
        console.log('[MARKET LOGIN] User already authenticated, redirecting to dashboard')
        setShowLoadingOverlay(true)
        window.location.href = '/dashboard/market'
      } else {
        setIsCheckingAuth(false)
      }
    }

    checkAuthentication()
  }, [])

  const onSubmit = async (data: LoginFormData) => {
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Error al iniciar sesión')
      }

      // Check if user belongs to a market company
      if (result.user?.companyType !== 'market') {
        throw new Error('Esta cuenta no pertenece a un mercado. Use el portal principal para iniciar sesión.')
      }

      // Store user data
      localStorage.setItem('user', JSON.stringify(result.user))
      localStorage.setItem('auth-token', result.token)

      // Show loading overlay and redirect
      setShowLoadingOverlay(true)

      // Small delay to ensure cookies are set
      setTimeout(() => {
        window.location.href = '/dashboard/market'
      }, 500)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
      setIsLoading(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/20 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/20 rounded-full filter blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-emerald-400/15 rounded-full filter blur-3xl animate-pulse delay-500" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-teal-400/15 rounded-full filter blur-3xl animate-pulse delay-700" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md mx-auto">
        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl"
        >
          {/* Logo Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="flex flex-col items-center pt-8 pb-4"
          >
            <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
              <Store className="w-12 h-12 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Portal Mercados</h1>
            <p className="text-emerald-300/70 text-sm mt-1">Acceso para empresas de mercado</p>
          </motion.div>

          {/* Form Content */}
          <div className="p-8 pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Error Alert */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-emerald-400/60" />
                  </div>
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    {...register('email')}
                    className={`
                      w-full pl-12 pr-4 py-4 bg-white/5 border ${errors.email ? 'border-red-500' : 'border-emerald-500/30'}
                      rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2
                      focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300
                      ${watchedEmail ? 'bg-white/10 border-emerald-500/50' : ''}
                    `}
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-red-400 flex items-center"
                  >
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.email.message}
                  </motion.p>
                )}
              </motion.div>

              {/* Password Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-emerald-400/60" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Contraseña"
                    {...register('password')}
                    className={`
                      w-full pl-12 pr-12 py-4 bg-white/5 border ${errors.password ? 'border-red-500' : 'border-emerald-500/30'}
                      rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2
                      focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300
                      ${watchedPassword ? 'bg-white/10 border-emerald-500/50' : ''}
                    `}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-emerald-400 transition-colors" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-emerald-400 transition-colors" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-sm text-red-400 flex items-center"
                  >
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.password.message}
                  </motion.p>
                )}
              </motion.div>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`
                    w-full py-4 px-6 rounded-2xl font-semibold text-white
                    bg-gradient-to-r from-emerald-600 to-teal-600
                    hover:from-emerald-500 hover:to-teal-500
                    focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-transparent
                    transition-all duration-300 transform hover:scale-[1.02]
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                    flex items-center justify-center gap-2
                  `}
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      <Store className="w-5 h-5" />
                      Iniciar Sesión
                    </>
                  )}
                </button>
              </motion.div>
            </form>

            {/* Help Link */}
            <div className="mt-8 text-center">
              <p className="text-emerald-300/60 text-sm">
                ¿Necesitas ayuda?{' '}
                <button className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  Contacta soporte
                </button>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8"
        >
          <p className="text-emerald-300/50 text-xs">
            © 2024 LogiRapid - Portal Mercados
          </p>
        </motion.div>
      </div>

      {/* Floating Elements */}
      <motion.div
        className="absolute top-20 right-20 w-4 h-4 bg-emerald-400 rounded-full opacity-60"
        animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-32 left-16 w-3 h-3 bg-teal-400 rounded-full opacity-50"
        animate={{ y: [0, -20, 0], x: [0, -15, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute top-1/3 left-1/4 w-3 h-3 bg-emerald-300 rounded-full opacity-40"
        animate={{ y: [0, -25, 0], x: [0, 10, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />

      {/* Loading Overlay */}
      <AnimatePresence>
        {showLoadingOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-emerald-900/95 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex flex-col items-center justify-center space-y-6"
            >
              <div className="relative">
                <div className="animate-spin rounded-full h-24 w-24 border-b-4 border-t-4 border-emerald-400"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Store className="h-12 w-12 text-emerald-400 animate-pulse" />
                </div>
              </div>

              <div className="text-center space-y-3">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-2xl font-semibold text-white"
                >
                  Cargando tu mercado
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-sm text-emerald-300/70"
                >
                  Preparando el dashboard...
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex space-x-2"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                  className="w-3 h-3 bg-emerald-400 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                  className="w-3 h-3 bg-teal-400 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                  className="w-3 h-3 bg-emerald-400 rounded-full"
                />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
