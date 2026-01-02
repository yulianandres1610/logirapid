'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Users, Package } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function EmployeeLoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  })

  const watchedEmail = watch('email')
  const watchedPassword = watch('password')

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const response = await fetch('/api/employee/profile')
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setShowLoadingOverlay(true)
            router.push('/employee/dashboard')
            return
          }
        }
      } catch (error) {
        console.error('[Employee Login] Error checking auth:', error)
      }
      setIsCheckingAuth(false)
    }

    checkAuthentication()
  }, [router])

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/employee/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (result.success) {
        setShowLoadingOverlay(true)
        router.push('/employee/dashboard')
      } else {
        setError(result.error || 'Error al iniciar sesión')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('Error de conexión')
    } finally {
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
            className="flex flex-col items-center justify-center pt-8 pb-4"
          >
            <img
              src="/images/blanco.png"
              alt="LogiRapid"
              className="object-contain w-full max-w-xs h-auto"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = `
                    <div class="text-white font-bold text-3xl tracking-wider px-4 py-2">
                      LogiRapid
                    </div>
                  `
                }
              }}
            />
            <div className="flex items-center gap-2 mt-4">
              <Users className="w-5 h-5 text-exa-secondary" />
              <span className="text-exa-secondary font-medium">Portal de Empleados</span>
            </div>
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
                <button
                  type="submit"
                  className="w-full h-14 text-base font-semibold bg-exa-secondary hover:bg-exa-secondary/90 text-white rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-exa-secondary/25 disabled:opacity-50"
                  disabled={!isValid || !watchedEmail || !watchedPassword || isLoading}
                >
                  <div className="flex items-center justify-center space-x-2">
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Ingresando...</span>
                      </>
                    ) : (
                      <>
                        <span>Ingresar</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </div>
                </button>
              </motion.div>

              {/* Help Link */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-center"
              >
                <p className="text-gray-400 text-sm">
                  ¿Problemas para acceder?{' '}
                  <button
                    type="button"
                    className="text-exa-primary hover:text-exa-secondary transition-colors underline decoration-dotted"
                  >
                    Contacta a tu supervisor
                  </button>
                </p>
              </motion.div>
            </form>
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
            empleados.logirapid.com
          </p>
          <p className="text-gray-600 text-xs mt-1">
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
        {showLoadingOverlay && (
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
                  <Users className="h-12 w-12 text-exa-secondary animate-pulse" />
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
                  Bienvenido
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="text-sm text-gray-400"
                >
                  Preparando tu portal de empleado...
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
