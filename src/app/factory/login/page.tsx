'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Factory } from 'lucide-react'
import { Button } from '@/components/ui/button'

const factoryLoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type FactoryLoginFormData = z.infer<typeof factoryLoginSchema>

export default function FactoryLoginPage() {
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<FactoryLoginFormData>({
    resolver: zodResolver(factoryLoginSchema),
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
        console.log('[FACTORY LOGIN] User already authenticated, redirecting to dashboard')
        setShowLoadingOverlay(true)
        setIsRedirecting(true)
        window.location.href = '/dashboard/market'
      } else {
        setIsCheckingAuth(false)
      }
    }

    checkAuthentication()
  }, [])

  const onSubmit = async (data: FactoryLoginFormData) => {
    setError(null)
    setIsLoading(true)
    setShowLoadingOverlay(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        setError(result.error || 'Error al iniciar sesión')
        setShowLoadingOverlay(false)
        setIsLoading(false)
        return
      }

      // Check if user belongs to a market company
      if (result.user?.companyType !== 'market') {
        setError('Esta cuenta no pertenece a un mercado. Use el portal principal para iniciar sesión.')
        setShowLoadingOverlay(false)
        setIsLoading(false)
        return
      }

      // Store user data
      localStorage.setItem('user', JSON.stringify(result.user))
      localStorage.setItem('auth-token', result.token)

      // Login exitoso, esperar cookies y redirigir
      setIsRedirecting(true)

      // Esperar a que las cookies se propaguen
      const waitForCookie = () => {
        const maxAttempts = 60
        let attempts = 0

        const checkCookie = () => {
          attempts++
          const cookies = document.cookie
          const hasAuthToken = cookies.includes('auth-token=')

          if (hasAuthToken || attempts >= maxAttempts) {
            window.location.href = '/dashboard/market'
          } else {
            setTimeout(checkCookie, 50)
          }
        }

        checkCookie()
      }

      waitForCookie()

    } catch (err) {
      console.error('Login error:', err)
      setError('Error de conexión')
      setShowLoadingOverlay(false)
      setIsLoading(false)
    }
  }

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-exa-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Verificando sesión...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        {/* Reflejos principales de marca Exa */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-exa-primary/25 rounded-full filter blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-exa-secondary/25 rounded-full filter blur-3xl animate-pulse delay-1000" />

        {/* Más reflejos de color primario (rojo Exa) */}
        <div className="absolute top-20 right-1/4 w-72 h-72 bg-exa-primary/18 rounded-full filter blur-3xl animate-pulse delay-700" />
        <div className="absolute bottom-32 left-1/3 w-80 h-80 bg-exa-primary/15 rounded-full filter blur-3xl animate-pulse delay-300" />
        <div className="absolute top-1/3 right-1/5 w-64 h-64 bg-exa-primary/20 rounded-full filter blur-3xl animate-pulse delay-1200" />
        <div className="absolute bottom-1/4 left-1/6 w-56 h-56 bg-exa-primary/12 rounded-full filter blur-2xl animate-pulse delay-900" />
        <div className="absolute top-3/4 right-1/3 w-48 h-48 bg-exa-primary/16 rounded-full filter blur-2xl animate-pulse delay-600" />
        <div className="absolute left-1/5 top-1/6 w-68 h-68 bg-exa-primary/14 rounded-full filter blur-3xl animate-pulse delay-1500" />
        <div className="absolute right-1/6 bottom-1/5 w-60 h-60 bg-exa-primary/18 rounded-full filter blur-2xl animate-pulse delay-400" />
        <div className="absolute top-2/3 left-1/4 w-52 h-52 bg-exa-primary/10 rounded-full filter blur-3xl animate-pulse delay-1100" />

        {/* Más reflejos de color secundario (azul Exa) */}
        <div className="absolute bottom-1/3 right-1/4 w-76 h-76 bg-exa-secondary/15 rounded-full filter blur-3xl animate-pulse delay-800" />
        <div className="absolute top-1/5 left-1/2 w-64 h-64 bg-exa-secondary/12 rounded-full filter blur-2xl animate-pulse delay-1400" />
        <div className="absolute top-3/5 left-1/6 w-56 h-56 bg-exa-secondary/18 rounded-full filter blur-3xl animate-pulse delay-200" />
        <div className="absolute bottom-2/5 right-1/5 w-48 h-48 bg-exa-secondary/14 rounded-full filter blur-2xl animate-pulse delay-1700" />
        <div className="absolute left-2/5 top-1/4 w-72 h-72 bg-exa-secondary/16 rounded-full filter blur-3xl animate-pulse delay-500" />
        <div className="absolute right-2/5 bottom-1/6 w-40 h-40 bg-exa-secondary/20 rounded-full filter blur-2xl animate-pulse delay-1300" />
        <div className="absolute top-4/5 left-1/3 w-52 h-52 bg-exa-secondary/12 rounded-full filter blur-2xl animate-pulse delay-900" />
        <div className="absolute bottom-1/6 right-2/3 w-44 h-44 bg-exa-secondary/16 rounded-full filter blur-2xl animate-pulse delay-1600" />
        <div className="absolute left-1/4 top-2/3 w-60 h-60 bg-exa-secondary/14 rounded-full filter blur-3xl animate-pulse delay-400" />
        <div className="absolute right-1/3 top-1/6 w-36 h-36 bg-exa-secondary/18 rounded-full filter blur-2xl animate-pulse delay-1100" />
      </div>


      {/* Main Container - Centrado */}
      <div className="relative z-10 w-full max-w-md mx-auto">
        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl"
        >
          {/* Logo Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="flex flex-col items-center pt-8 pb-4"
          >
            <img
              src="/images/blanco.png"
              alt="LogiRapid"
              className="object-contain w-full max-w-xs h-auto"
              onError={(e) => {
                console.error('Error loading logo:', e);
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="text-white font-bold text-3xl tracking-wider px-4 py-2">
                      LogiRapid
                    </div>
                    <p class="text-exa-secondary text-sm mt-2">Portal Fabrica</p>
                  `;
                }
              }}
            />
            <p className="text-exa-secondary text-sm mt-2 font-medium">Portal Fabrica</p>
          </motion.div>

          {/* Form Content */}
          <div className="p-8 pt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Email Field */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    placeholder="Correo electrónico"
                    {...register('email')}
                    className={`
                      w-full pl-12 pr-4 py-4 bg-white/5 border ${errors.email ? 'border-red-500' : 'border-exa-secondary/30'}
                      rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2
                      focus:ring-exa-secondary focus:border-exa-secondary transition-all duration-300
                      ${watchedEmail ? 'bg-white/10 border-exa-secondary/50' : ''}
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
                transition={{ delay: 0.2 }}
              >
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Contraseña"
                    {...register('password')}
                    className={`
                      w-full pl-12 pr-12 py-4 bg-white/5 border ${errors.password ? 'border-red-500' : 'border-exa-secondary/30'}
                      rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2
                      focus:ring-exa-secondary focus:border-exa-secondary transition-all duration-300
                      ${watchedPassword ? 'bg-white/10 border-exa-secondary/50' : ''}
                    `}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
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

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center space-x-2 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl"
                  >
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm text-red-300">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  type="submit"
                  className="w-full h-14 text-base font-semibold bg-exa-secondary hover:bg-exa-secondary/90 text-white rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-exa-secondary/25"
                  loading={isLoading}
                  disabled={!isValid || !watchedEmail || !watchedPassword || isLoading}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <span>{isLoading ? 'Ingresando...' : 'Ingresar'}</span>
                    {!isLoading && (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    )}
                  </div>
                </Button>
              </motion.div>
            </form>

            {/* Alternative Login */}
            <div className="mt-8 text-center">
              <p className="text-gray-400 text-sm mb-4">
                ¿Necesitas ayuda?{' '}
                <button className="text-exa-primary hover:text-exa-secondary transition-colors">
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
          <p className="text-gray-500 text-xs">
            © 2024 LogiRapid. Todos los derechos reservados.
          </p>
        </motion.div>
      </div>

      {/* Floating Elements */}
      <motion.div
        className="absolute top-20 right-20 w-4 h-4 bg-exa-primary rounded-full opacity-80"
        animate={{
          y: [0, -40, 0],
          x: [0, 25, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <motion.div
        className="absolute bottom-32 left-16 w-3 h-3 bg-exa-secondary rounded-full opacity-70"
        animate={{
          y: [0, -25, 0],
          x: [0, -20, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />
      <motion.div
        className="absolute top-1/3 left-1/4 w-3 h-3 bg-exa-primary rounded-full opacity-60"
        animate={{
          y: [0, -30, 0],
          x: [0, 15, 0],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5
        }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/3 w-2 h-2 bg-exa-secondary rounded-full opacity-70"
        animate={{
          y: [0, -20, 0],
          x: [0, -18, 0],
        }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5
        }}
      />
      <motion.div
        className="absolute top-2/3 right-1/5 w-3 h-3 bg-exa-primary rounded-full opacity-60"
        animate={{
          y: [0, -35, 0],
          x: [0, 20, 0],
        }}
        transition={{
          duration: 4.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.8
        }}
      />
      <motion.div
        className="absolute left-1/6 top-1/4 w-2 h-2 bg-exa-secondary rounded-full opacity-80"
        animate={{
          y: [0, -25, 0],
          x: [0, -15, 0],
        }}
        transition={{
          duration: 3.3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.2
        }}
      />
      <motion.div
        className="absolute top-1/5 right-1/3 w-3 h-3 bg-exa-primary rounded-full opacity-70"
        animate={{
          y: [0, -30, 0],
          x: [0, 20, 0],
        }}
        transition={{
          duration: 3.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.8
        }}
      />
      <motion.div
        className="absolute bottom-1/5 left-1/3 w-2 h-2 bg-exa-secondary rounded-full opacity-75"
        animate={{
          y: [0, -25, 0],
          x: [0, -18, 0],
        }}
        transition={{
          duration: 3.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.3
        }}
      />
      <motion.div
        className="absolute top-3/5 left-1/5 w-3 h-3 bg-exa-primary rounded-full opacity-65"
        animate={{
          y: [0, -35, 0],
          x: [0, 15, 0],
        }}
        transition={{
          duration: 4.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.6
        }}
      />
      <motion.div
        className="absolute bottom-3/5 right-1/4 w-2 h-2 bg-exa-secondary rounded-full opacity-70"
        animate={{
          y: [0, -20, 0],
          x: [0, 22, 0],
        }}
        transition={{
          duration: 2.9,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.7
        }}
      />

      {/* Loading Overlay */}
      <AnimatePresence>
        {(isRedirecting || showLoadingOverlay) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/95 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex flex-col items-center justify-center space-y-6"
            >
              {/* Loading Animation */}
              <div className="relative">
                <div className="animate-spin rounded-full h-24 w-24 border-b-4 border-t-4 border-exa-secondary"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Factory className="h-12 w-12 text-exa-secondary animate-pulse" />
                </div>
              </div>

              {/* Loading Text */}
              <div className="text-center space-y-3">
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-2xl font-semibold text-white"
                >
                  Cargando tu fabrica
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-sm text-gray-400"
                >
                  Preparando tu panel...
                </motion.p>
              </div>

              {/* Loading Dots Animation */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex space-x-2"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                  className="w-3 h-3 bg-exa-primary rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                  className="w-3 h-3 bg-exa-secondary rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                  className="w-3 h-3 bg-exa-primary rounded-full"
                />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
